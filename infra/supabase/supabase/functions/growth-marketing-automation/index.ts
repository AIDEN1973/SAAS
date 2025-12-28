/**
 * 성장 마케팅 자동화 배치 작업
 *
 * AI_자동화_기능_정리.md Section 11 참조
 * growth_marketing 카테고리 자동화 처리
 * 스케줄: 매주 월요일 09:10, 매월 1일 09:10 KST
 *
 * [불변 규칙] Zero-Management: 사용자 개입 없이 자동 실행
 * [불변 규칙] Automation Config First: 모든 자동화는 Policy 기반으로만 동작
 * [불변 규칙] Fail Closed: Policy가 없으면 실행하지 않음
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';
import { assertAutomationEventType } from '../_shared/automation-event-catalog.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';
import { toKSTDate, toKST } from '../_shared/date-utils.ts';
import { checkAndUpdateAutomationSafety } from '../_shared/automation-safety.ts';
import { createTaskCardWithDedup } from '../_shared/create-task-card-with-dedup.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 신규 회원 감소 알림 (new_member_drop)
 * 매주 월요일 09:10 실행
 */
async function processNewMemberDrop(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'new_member_drop';
  assertAutomationEventType(eventType);

  const enabled = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.enabled`
  );
  if (!enabled || enabled !== true) {
    return 0;
  }

  const threshold = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.threshold`
  ) as number;
  if (!threshold || typeof threshold !== 'number') {
    return 0; // Fail Closed
  }

  // Policy에서 priority 조회 (Fail-Closed)
  const priorityPolicy = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.priority`
  ) as number | null;
  if (!priorityPolicy || typeof priorityPolicy !== 'number') {
    return 0; // Fail Closed
  }

  // Policy에서 TTL 조회 (Fail-Closed)
  const ttlDays = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.ttl_days`
  ) as number | null;
  if (!ttlDays || typeof ttlDays !== 'number') {
    return 0; // Fail Closed
  }

  // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
  const safetyCheck = await checkAndUpdateAutomationSafety(
    supabase,
    tenantId,
    'create_task',
    kstTime,
    `auto_notification.${eventType}.throttle.daily_limit`
  );
  if (!safetyCheck.canExecute) {
    console.warn(`[${eventType}] Skipping due to safety check: ${safetyCheck.reason}`);
    return 0;
  }

  const today = toKSTDate(kstTime);
  const lastWeek = toKSTDate(new Date(kstTime.getTime() - 7 * 24 * 60 * 60 * 1000));
  const twoWeeksAgo = toKSTDate(new Date(kstTime.getTime() - 14 * 24 * 60 * 60 * 1000));

  // 최근 1주일 신규 회원 수
  const { data: recentMembers } = await withTenant(
    supabase
      .from('persons')
      .select('id')
      .eq('person_type', 'student')
      .gte('created_at', `${lastWeek}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`),
    tenantId
  );

  // 이전 1주일 신규 회원 수
  const { data: previousMembers } = await withTenant(
    supabase
      .from('persons')
      .select('id')
      .eq('person_type', 'student')
      .gte('created_at', `${twoWeeksAgo}T00:00:00`)
      .lt('created_at', `${lastWeek}T00:00:00`),
    tenantId
  );

  const recentCount = recentMembers?.length || 0;
  const previousCount = previousMembers?.length || 0;

  if (previousCount > 0 && (recentCount / previousCount) <= (1 - threshold / 100)) {
    const dedupKey = `${tenantId}:${eventType}:tenant:${tenantId}:${today}`;
    // ⚠️ 정본 규칙: 부분 유니크 인덱스 사용 시 Supabase client upsert() 직접 사용 불가
    // RPC 함수 create_task_card_with_dedup_v1 사용 (프론트 자동화 문서 2.3 섹션 참조)
    await createTaskCardWithDedup(supabase, {
      tenant_id: tenantId,
      entity_id: tenantId,
      entity_type: 'tenant',
      task_type: 'risk',
      title: '신규 회원 감소 알림',
      description: `최근 1주일간 신규 회원 수가 이전 대비 ${((1 - recentCount / previousCount) * 100).toFixed(1)}% 감소했습니다.`,
      priority: priorityPolicy,
      dedup_key: dedupKey,
      expires_at: new Date(kstTime.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    });

    return 1;
  }

  return 0;
}

/**
 * 지역 평균 대비 저하 알림 (regional_underperformance)
 * 매주 월요일 09:10 실행
 */
async function processRegionalUnderperformance(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'regional_underperformance';
  assertAutomationEventType(eventType);

  const enabled = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.enabled`
  );
  if (!enabled || enabled !== true) {
    return 0;
  }

  // 테넌트의 지역 정보 조회 (RLS 준수를 위해 withTenant 사용)
  const { data: tenant } = await withTenant(
    supabase
      .from('tenants')
      .select('location_code')
      .eq('id', tenantId)
      .single(),
    tenantId
  );

  if (!tenant || !tenant.location_code) {
    return 0;
  }

  // Policy에서 priority 조회 (Fail-Closed)
  const priorityPolicy = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.priority`
  ) as number | null;
  if (!priorityPolicy || typeof priorityPolicy !== 'number') {
    return 0; // Fail Closed
  }

  // Policy에서 TTL 조회 (Fail-Closed)
  const ttlDays = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.ttl_days`
  ) as number | null;
  if (!ttlDays || typeof ttlDays !== 'number') {
    return 0; // Fail Closed
  }

  // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
  const safetyCheck = await checkAndUpdateAutomationSafety(
    supabase,
    tenantId,
    'create_task',
    kstTime,
    `auto_notification.${eventType}.throttle.daily_limit`
  );
  if (!safetyCheck.canExecute) {
    console.warn(`[${eventType}] Skipping due to safety check: ${safetyCheck.reason}`);
    return 0;
  }

  // 지역 평균 데이터 조회 (analytics.ranking_snapshot 또는 별도 테이블)
  // 여기서는 예시로 처리
  const dedupKey = `${tenantId}:${eventType}:tenant:${tenantId}:${toKSTDate(kstTime)}`;
  // ⚠️ 정본 규칙: 부분 유니크 인덱스 사용 시 Supabase client upsert() 직접 사용 불가
  // RPC 함수 create_task_card_with_dedup_v1 사용 (프론트 자동화 문서 2.3 섹션 참조)
  await createTaskCardWithDedup(supabase, {
    tenant_id: tenantId,
    entity_id: tenantId,
    entity_type: 'tenant',
    task_type: 'risk',
    title: '지역 평균 대비 저하',
    description: '지역 평균 대비 성과가 저조합니다. 운영 방식을 개선해보세요.',
    priority: priorityPolicy,
    dedup_key: dedupKey,
    expires_at: new Date(kstTime.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  });

  return 1;
}

/**
 * 지역 순위 하락 알림 (regional_rank_drop)
 * 매월 1일 09:10 실행
 */
async function processRegionalRankDrop(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'regional_rank_drop';
  assertAutomationEventType(eventType);

  const enabled = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.enabled`
  );
  if (!enabled || enabled !== true) {
    return 0;
  }

  const threshold = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.threshold`
  ) as number;
  if (!threshold || typeof threshold !== 'number') {
    return 0; // Fail Closed
  }

  // Policy에서 priority 조회 (Fail-Closed)
  const priorityPolicy = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.priority`
  ) as number | null;
  if (!priorityPolicy || typeof priorityPolicy !== 'number') {
    return 0; // Fail Closed
  }

  // Policy에서 TTL 조회 (Fail-Closed)
  const ttlDays = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.ttl_days`
  ) as number | null;
  if (!ttlDays || typeof ttlDays !== 'number') {
    return 0; // Fail Closed
  }

  // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
  const safetyCheck = await checkAndUpdateAutomationSafety(
    supabase,
    tenantId,
    'create_task',
    kstTime,
    `auto_notification.${eventType}.throttle.daily_limit`
  );
  if (!safetyCheck.canExecute) {
    console.warn(`[${eventType}] Skipping due to safety check: ${safetyCheck.reason}`);
    return 0;
  }

  // 이번 달 순위
  // [불변 규칙] SELECT 쿼리는 withTenant() 사용하여 tenant_id 필터 강제
  // withTenant() 내부에서 이미 tenant_id 필터가 적용되므로 .eq('tenant_id') 중복 사용 금지
  const currentMonth = toKSTDate(kstTime).slice(0, 7);
  const { data: currentRank } = await withTenant(
    supabase
      .from('analytics.ranking_snapshot')
      .select('rank')
      .eq('metric', 'students')
      .eq('date_kst', `${currentMonth}-01`)
      .single(),
    tenantId
  );

  // 지난 달 순위
  // [불변 규칙] SELECT 쿼리는 withTenant() 사용하여 tenant_id 필터 강제
  // withTenant() 내부에서 이미 tenant_id 필터가 적용되므로 .eq('tenant_id') 중복 사용 금지
  const lastMonth = new Date(kstTime.getFullYear(), kstTime.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  const { data: previousRank } = await withTenant(
    supabase
      .from('analytics.ranking_snapshot')
      .select('rank')
      .eq('metric', 'students')
      .eq('date_kst', `${lastMonthStr}-01`)
      .single(),
    tenantId
  );

  if (currentRank && previousRank) {
    const rankDrop = (previousRank.rank || 0) - (currentRank.rank || 0);
    if (rankDrop >= threshold) {
      const dedupKey = `${tenantId}:${eventType}:tenant:${tenantId}:${toKSTDate(kstTime)}`;
      // ⚠️ 정본 규칙: 부분 유니크 인덱스 사용 시 Supabase client upsert() 직접 사용 불가
      // RPC 함수 create_task_card_with_dedup_v1 사용 (프론트 자동화 문서 2.3 섹션 참조)
      await createTaskCardWithDedup(supabase, {
        tenant_id: tenantId,
        entity_id: tenantId,  // entity_id = tenantId (entity_type='tenant')
        entity_type: 'tenant', // entity_type
        task_type: 'risk',
        title: '지역 순위 하락',
        description: `이번 달 지역 순위가 ${rankDrop}위 하락했습니다.`,
        priority: priorityPolicy,
        dedup_key: dedupKey,
        expires_at: new Date(kstTime.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      });

      return 1;
    }
  }

  return 0;
}

/**
 * 상담 전환율 하락 알림 (inquiry_conversion_drop)
 * 매주 월요일 09:30 실행
 */
async function processInquiryConversionDrop(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'inquiry_conversion_drop';
  assertAutomationEventType(eventType);

  const enabled = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.enabled`
  );
  if (!enabled || enabled !== true) {
    return 0;
  }

  const threshold = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.threshold`
  ) as number;
  if (!threshold || typeof threshold !== 'number') {
    return 0; // Fail Closed
  }

  // Policy에서 priority 조회 (Fail-Closed)
  const priorityPolicy = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.priority`
  ) as number | null;
  if (!priorityPolicy || typeof priorityPolicy !== 'number') {
    return 0; // Fail Closed
  }

  // Policy에서 TTL 조회 (Fail-Closed)
  const ttlDays = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.ttl_days`
  ) as number | null;
  if (!ttlDays || typeof ttlDays !== 'number') {
    return 0; // Fail Closed
  }

  // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
  const safetyCheck = await checkAndUpdateAutomationSafety(
    supabase,
    tenantId,
    'create_task',
    kstTime,
    `auto_notification.${eventType}.throttle.daily_limit`
  );
  if (!safetyCheck.canExecute) {
    console.warn(`[${eventType}] Skipping due to safety check: ${safetyCheck.reason}`);
    return 0;
  }

  const today = toKSTDate(kstTime);
  const lastWeek = toKSTDate(new Date(kstTime.getTime() - 7 * 24 * 60 * 60 * 1000));
  const twoWeeksAgo = toKSTDate(new Date(kstTime.getTime() - 14 * 24 * 60 * 60 * 1000));

  // 최근 1주일 상담 수 및 전환 수
  const { data: recentConsultations } = await withTenant(
    supabase
      .from('student_consultations')
      .select('id, student_id, status')
      .gte('created_at', `${lastWeek}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`),
    tenantId
  );

  // 이전 1주일 상담 수 및 전환 수
  const { data: previousConsultations } = await withTenant(
    supabase
      .from('student_consultations')
      .select('id, student_id, status')
      .gte('created_at', `${twoWeeksAgo}T00:00:00`)
      .lt('created_at', `${lastWeek}T00:00:00`),
    tenantId
  );

  const recentTotal = recentConsultations?.length || 0;
  const recentConverted = recentConsultations?.filter((c: any) => c.status === 'enrolled' || c.status === 'completed').length || 0;
  const recentRate = recentTotal > 0 ? (recentConverted / recentTotal) * 100 : 0;

  const previousTotal = previousConsultations?.length || 0;
  const previousConverted = previousConsultations?.filter((c: any) => c.status === 'enrolled' || c.status === 'completed').length || 0;
  const previousRate = previousTotal > 0 ? (previousConverted / previousTotal) * 100 : 0;

  const dropRate = previousRate - recentRate;

  if (previousRate > 0 && dropRate >= threshold) {
    const dedupKey = `${tenantId}:${eventType}:tenant:${tenantId}:${today}`;
    // ⚠️ 정본 규칙: 부분 유니크 인덱스 사용 시 Supabase client upsert() 직접 사용 불가
    // RPC 함수 create_task_card_with_dedup_v1 사용 (프론트 자동화 문서 2.3 섹션 참조)
    await createTaskCardWithDedup(supabase, {
      tenant_id: tenantId,
      entity_id: tenantId,  // entity_id = tenantId (entity_type='tenant')
      entity_type: 'tenant', // entity_type
      task_type: 'risk',
      title: '상담 전환율 하락 알림',
      description: `최근 1주일 상담 전환율이 이전 대비 ${dropRate.toFixed(1)}% 하락했습니다. (최근: ${recentRate.toFixed(1)}%, 이전: ${previousRate.toFixed(1)}%)`,
      priority: priorityPolicy,
      dedup_key: dedupKey,
      expires_at: new Date(kstTime.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    });

    return 1;
  }

  return 0;
}

/**
 * 생일 인사 (birthday_greeting)
 * 매일 실행
 */
async function processBirthdayGreeting(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'birthday_greeting';
  assertAutomationEventType(eventType);

  const enabled = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.enabled`
  );
  if (!enabled || enabled !== true) {
    return 0;
  }

  const channel = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.channel`
  ) as string;

  if (!channel) {
    return 0; // Fail Closed
  }

  // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
  const safetyCheck = await checkAndUpdateAutomationSafety(
    supabase,
    tenantId,
    'send_notification',
    kstTime,
    `auto_notification.${eventType}.throttle.daily_limit`
  );
  if (!safetyCheck.canExecute) {
    console.warn(`[${eventType}] Skipping due to safety check: ${safetyCheck.reason}`);
    return 0;
  }

  const today = toKSTDate(kstTime);
  const todayMonthDay = `${String(kstTime.getMonth() + 1).padStart(2, '0')}-${String(kstTime.getDate()).padStart(2, '0')}`;

  // 오늘 생일인 학생 조회
  // ⚠️ 참고: persons 테이블에 birth_date 필드가 없을 수 있으므로, 필요시 마이그레이션 추가 필요
  // 현재는 created_at 기반으로 처리하지 않음 (정확한 생일 정보 필요)
  const { data: students } = await withTenant(
    supabase
      .from('persons')
      .select('id, name')
      .eq('person_type', 'student')
      .eq('status', 'active'),
    tenantId
  );

  if (!students || students.length === 0) {
    return 0;
  }

  let sentCount = 0;
  // ⚠️ 임시: birth_date 필드가 없으면 처리하지 않음 (정확한 생일 정보 필요)
  // 실제 구현 시 persons 테이블에 birth_date 필드 추가 필요
  // for (const student of students) {
  //   if (student.birth_date && student.birth_date.slice(5) === todayMonthDay) {
  //     const { data: guardian } = await withTenant(
  //       supabase
  //         .from('guardians')
  //         .select('id, phone')
  //         .eq('student_id', student.id)
  //         .eq('is_primary', true)
  //         .single(),
  //       tenantId
  //     );

  //     if (guardian) {
  //       await supabase.from('automation_actions').insert({
  //         tenant_id: tenantId,
  //         action_type: 'send_notification',
  //         executor_role: 'system',
  //         execution_context: {
  //           event_type: eventType,
  //           student_id: student.id,
  //           recipient_id: guardian.id,
  //           channel,
  //         },
  //       });
  //       sentCount++;
  //     }
  //   }
  // }

  return sentCount;
}

/**
 * 등록 기념일 인사 (enrollment_anniversary)
 * 매일 실행
 */
async function processEnrollmentAnniversary(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'enrollment_anniversary';
  assertAutomationEventType(eventType);

  const enabled = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.enabled`
  );
  if (!enabled || enabled !== true) {
    return 0;
  }

  const channel = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.channel`
  ) as string;

  if (!channel) {
    return 0; // Fail Closed
  }

  // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
  const safetyCheck = await checkAndUpdateAutomationSafety(
    supabase,
    tenantId,
    'send_notification',
    kstTime,
    `auto_notification.${eventType}.throttle.daily_limit`
  );
  if (!safetyCheck.canExecute) {
    console.warn(`[${eventType}] Skipping due to safety check: ${safetyCheck.reason}`);
    return 0;
  }

  const today = toKSTDate(kstTime);
  const todayMonthDay = `${String(kstTime.getMonth() + 1).padStart(2, '0')}-${String(kstTime.getDate()).padStart(2, '0')}`;

  // 오늘 등록 기념일인 학생 조회 (created_at 기반)
  const { data: students } = await withTenant(
    supabase
      .from('persons')
      .select('id, name, created_at')
      .eq('person_type', 'student')
      .eq('status', 'active'),
    tenantId
  );

  if (!students || students.length === 0) {
    return 0;
  }

  let sentCount = 0;
  for (const student of students) {
    if (student.created_at) {
      const enrollmentDate = new Date(student.created_at);
      const enrollmentMonthDay = `${String(enrollmentDate.getMonth() + 1).padStart(2, '0')}-${String(enrollmentDate.getDate()).padStart(2, '0')}`;

      // 등록 기념일인 경우 (월-일만 비교, 연도는 무시)
      if (enrollmentMonthDay === todayMonthDay && enrollmentDate.getFullYear() < kstTime.getFullYear()) {
        const { data: guardian } = await withTenant(
          supabase
            .from('guardians')
            .select('id, phone')
            .eq('student_id', student.id)
            .eq('is_primary', true)
            .single(),
          tenantId
        );

        if (guardian) {
          const yearsSince = kstTime.getFullYear() - enrollmentDate.getFullYear();
          const dedupKey = `${tenantId}:${eventType}:student:${student.id}:guardian:${guardian.id}:${toKSTDate(kstTime)}`;
          await supabase.from('automation_actions').insert({
            tenant_id: tenantId,
            action_type: 'send_notification',
            executor_role: 'system',
            dedup_key: dedupKey,
            execution_context: {
              event_type: eventType,
              student_id: student.id,
              recipient_id: guardian.id,
              channel,
              years_since: yearsSince,
            },
          });
          sentCount++;
        }
      }
    }
  }

  return sentCount;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY);
    const kstTime = toKST();
    const hour = kstTime.getHours();
    const minute = kstTime.getMinutes();
    const dayOfWeek = kstTime.getDay();
    const dayOfMonth = kstTime.getDate();

    console.log(`[Growth Marketing] Starting batch at ${hour}:${minute}, day: ${dayOfWeek}, date: ${dayOfMonth}`);

    const { data: tenants } = await supabase
      .from('tenants')
      .select('id')
      .eq('status', 'active');

    if (!tenants || tenants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active tenants' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalProcessed = 0;

    for (const tenant of tenants) {
      try {
        // 매주 월요일 09:10
        if (dayOfWeek === 1 && hour === 9 && minute >= 10 && minute < 15) {
          totalProcessed += await processNewMemberDrop(supabase, tenant.id, kstTime);
          totalProcessed += await processRegionalUnderperformance(supabase, tenant.id, kstTime);
        }

        // 매주 월요일 09:30 (inquiry_conversion_drop)
        if (dayOfWeek === 1 && hour === 9 && minute >= 30 && minute < 35) {
          totalProcessed += await processInquiryConversionDrop(supabase, tenant.id, kstTime);
        }

        // 매일 (birthday_greeting, enrollment_anniversary)
        totalProcessed += await processBirthdayGreeting(supabase, tenant.id, kstTime);
        totalProcessed += await processEnrollmentAnniversary(supabase, tenant.id, kstTime);

        // 매월 1일 09:10
        if (dayOfMonth === 1 && hour === 9 && minute >= 10 && minute < 15) {
          totalProcessed += await processRegionalRankDrop(supabase, tenant.id, kstTime);
        }
      } catch (error) {
        console.error(`[Growth Marketing] Error for tenant ${tenant.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed_count: totalProcessed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Growth Marketing] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

