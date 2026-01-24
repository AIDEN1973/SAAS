/**
 * 정원 최적화 자동화 배치 작업
 *
 * AI_자동화_기능_정리.md Section 11 참조
 * capacity_optimization 카테고리 자동화 처리
 * 스케줄: 매주 월요일 08:00-08:50 KST
 *
 * [불변 규칙] Zero-Management: 사용자 개입 없이 자동 실행
 * [불변 규칙] Automation Config First: 모든 자동화는 Policy 기반으로만 동작
 * [불변 규칙] Fail Closed: Policy가 없으면 실행하지 않음
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTenantSettingByPath, shouldUseAI } from '../_shared/policy-utils.ts';
import { assertAutomationEventType } from '../_shared/automation-event-catalog.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';
import { toKSTDate, toKST } from '../_shared/date-utils.ts';
import { checkAndUpdateAutomationSafety } from '../_shared/automation-safety.ts';
import { createTaskCardWithDedup } from '../_shared/create-task-card-with-dedup.ts';
import { getTenantTableName } from '../_shared/industry-adapter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 반 정원률 저조 지속 알림 (class_fill_rate_low_persistent)
 * 매주 월요일 08:10 실행
 */
async function processClassFillRateLowPersistent(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'class_fill_rate_low_persistent';
  assertAutomationEventType(eventType);

  const enabled = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.enabled`
  );
  if (!enabled || enabled !== true) {
    return 0;
  }

  // Policy에서 임계값 조회
  const threshold = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.threshold`
  ) as number;
  if (!threshold || typeof threshold !== 'number') {
    return 0; // Fail Closed
  }

  const persistentDays = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.persistent_days`
  ) as number;
  if (!persistentDays || typeof persistentDays !== 'number') {
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

  // Industry Adapter: 업종별 클래스 테이블명 동적 조회
  const classTableName = await getTenantTableName(supabase, tenantId, 'class');

  // 최근 N일간 정원률이 임계값 미만인 반 조회
  const { data: classes, error } = await withTenant(
    supabase
      .from(classTableName || 'academy_classes') // Fallback
      .select('id, name, max_students, current_students')
      .eq('status', 'active'),
    tenantId
  );

  if (error || !classes) {
    return 0;
  }

  let createdCount = 0;
  for (const cls of classes) {
    const fillRate = cls.max_students > 0
      ? (cls.current_students / cls.max_students) * 100
      : 0;

    if (fillRate < threshold) {
      const dedupKey = `${tenantId}:${eventType}:class:${cls.id}:${toKSTDate(kstTime)}`;
      // ⚠️ 정본 규칙: 부분 유니크 인덱스 사용 시 Supabase client upsert() 직접 사용 불가
      // RPC 함수 create_task_card_with_dedup_v1 사용 (프론트 자동화 문서 2.3 섹션 참조)
      await createTaskCardWithDedup(supabase, {
        tenant_id: tenantId,
        entity_id: cls.id,  // entity_id = class_id (entity_type='class')
        entity_type: 'class', // entity_type
        task_type: 'risk',
        title: `${cls.name} 정원률 저조`,
        description: `${cls.name}의 정원률이 ${fillRate.toFixed(1)}%로 ${threshold}% 미만입니다.`,
        priority: priorityPolicy,
        dedup_key: dedupKey,
        expires_at: new Date(kstTime.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      });
      createdCount++;
    }
  }

  return createdCount;
}

/**
 * 시간대별 정원률 저조 알림 (time_slot_fill_rate_low)
 * 매주 월요일 08:20 실행
 */
async function processTimeSlotFillRateLow(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'time_slot_fill_rate_low';
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

  // Industry Adapter: 업종별 클래스 테이블명 동적 조회
  const classTableName = await getTenantTableName(supabase, tenantId, 'class');

  // 시간대별 수업 그룹화 및 정원률 계산
  const { data: classes, error } = await withTenant(
    supabase
      .from(classTableName || 'academy_classes') // Fallback
      .select('id, name, start_time, max_students, current_students')
      .eq('status', 'active'),
    tenantId
  );

  if (error || !classes) {
    return 0;
  }

  const timeSlotMap = new Map<string, { total: number; current: number; classes: any[] }>();
  for (const cls of classes) {
    const hour = cls.start_time.split('T')[1]?.split(':')[0] || '00';
    const slot = `${hour}:00`;
    if (!timeSlotMap.has(slot)) {
      timeSlotMap.set(slot, { total: 0, current: 0, classes: [] });
    }
    const slotData = timeSlotMap.get(slot)!;
    slotData.total += cls.max_students || 0;
    slotData.current += cls.current_students || 0;
    slotData.classes.push(cls);
  }

  let createdCount = 0;
  for (const [slot, data] of timeSlotMap.entries()) {
    const fillRate = data.total > 0 ? (data.current / data.total) * 100 : 0;
    if (fillRate < threshold) {
      const dedupKey = `${tenantId}:${eventType}:timeslot:${slot}:${toKSTDate(kstTime)}`;
      // ⚠️ 정본 규칙: 부분 유니크 인덱스 사용 시 Supabase client upsert() 직접 사용 불가
      // RPC 함수 create_task_card_with_dedup_v1 사용 (프론트 자동화 문서 2.3 섹션 참조)
      await createTaskCardWithDedup(supabase, {
        tenant_id: tenantId,
        entity_id: tenantId,  // entity_id = tenantId (entity_type='tenant')
        entity_type: 'tenant', // entity_type
        task_type: 'risk',
        title: `${slot} 시간대 정원률 저조`,
        description: `${slot} 시간대의 정원률이 ${fillRate.toFixed(1)}%로 ${threshold}% 미만입니다.`,
        priority: priorityPolicy,
        dedup_key: dedupKey,
        expires_at: new Date(kstTime.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      });
      createdCount++;
    }
  }

  return createdCount;
}

/**
 * 고정원 반 확장 제안 (high_fill_rate_expand_candidate)
 * 매주 월요일 08:15 실행
 */
async function processHighFillRateExpandCandidate(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'high_fill_rate_expand_candidate';
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

  // Industry Adapter: 업종별 클래스 테이블명 동적 조회
  const classTableName = await getTenantTableName(supabase, tenantId, 'class');

  const { data: classes, error } = await withTenant(
    supabase
      .from(classTableName || 'academy_classes') // Fallback
      .select('id, name, max_students, current_students')
      .eq('status', 'active'),
    tenantId
  );

  if (error || !classes) {
    return 0;
  }

  let createdCount = 0;
  for (const cls of classes) {
    const fillRate = cls.max_students > 0
      ? (cls.current_students / cls.max_students) * 100
      : 0;

    if (fillRate >= threshold) {
      const dedupKey = `${tenantId}:${eventType}:class:${cls.id}:${toKSTDate(kstTime)}`;
      // ⚠️ 정본 규칙: 부분 유니크 인덱스 사용 시 Supabase client upsert() 직접 사용 불가
      // RPC 함수 create_task_card_with_dedup_v1 사용 (프론트 자동화 문서 2.3 섹션 참조)
      await createTaskCardWithDedup(supabase, {
        tenant_id: tenantId,
        entity_id: cls.id,  // entity_id = class_id (entity_type='class')
        entity_type: 'class', // entity_type
        task_type: 'ai_suggested',
        title: `${cls.name} 확장 제안`,
        description: `${cls.name}의 정원률이 ${fillRate.toFixed(1)}%로 높습니다. 추가 반 개설을 고려해보세요.`,
        priority: priorityPolicy,
        dedup_key: dedupKey,
        expires_at: new Date(kstTime.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      });
      createdCount++;
    }
  }

  return createdCount;
}

/**
 * AI 반 병합 제안 (ai_suggest_class_merge)
 * 매주 월요일 08:30 실행
 */
async function processAISuggestClassMerge(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'ai_suggest_class_merge';
  assertAutomationEventType(eventType);

  const enabled = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.enabled`
  );
  if (!enabled || enabled !== true) {
    return 0;
  }

  // AI 사용 여부 확인
  const useAI = await shouldUseAI(supabase, tenantId);
  if (!useAI) {
    return 0; // AI 미사용 시 실행하지 않음
  }

  // Policy에서 병합 임계값 조회 (각 반의 정원률이 이 값 미만이면 병합 대상)
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

  // Industry Adapter: 업종별 클래스 테이블명 동적 조회
  const classTableName = await getTenantTableName(supabase, tenantId, 'class');

  // 정원률이 낮은 반 조회
  const { data: classes, error } = await withTenant(
    supabase
      .from(classTableName || 'academy_classes')
      .select('id, name, max_students, current_students, start_time, subject')
      .eq('status', 'active'),
    tenantId
  );

  if (error || !classes) {
    return 0;
  }

  // 정원률이 임계값 미만인 반 필터링
  const lowFillClasses = classes.filter((cls: any) => {
    const fillRate = cls.max_students > 0
      ? (cls.current_students / cls.max_students) * 100
      : 0;
    return fillRate < threshold && fillRate > 0; // 학생이 최소 1명 이상 있는 경우만
  });

  if (lowFillClasses.length < 2) {
    return 0; // 병합 대상이 2개 미만이면 제안하지 않음
  }

  // 같은 과목 또는 유사한 시간대의 반끼리 그룹화하여 병합 제안
  const subjectGroups = new Map<string, any[]>();
  for (const cls of lowFillClasses) {
    const subject = cls.subject || 'general';
    if (!subjectGroups.has(subject)) {
      subjectGroups.set(subject, []);
    }
    subjectGroups.get(subject)!.push(cls);
  }

  let createdCount = 0;
  for (const [subject, subjectClasses] of subjectGroups.entries()) {
    if (subjectClasses.length >= 2) {
      // 병합 가능한 후보 쌍 찾기
      for (let i = 0; i < subjectClasses.length - 1; i++) {
        for (let j = i + 1; j < subjectClasses.length; j++) {
          const cls1 = subjectClasses[i];
          const cls2 = subjectClasses[j];

          // 병합 후 정원 초과 여부 확인
          const combinedStudents = (cls1.current_students || 0) + (cls2.current_students || 0);
          const maxCapacity = Math.max(cls1.max_students || 0, cls2.max_students || 0);

          if (combinedStudents <= maxCapacity) {
            const dedupKey = `${tenantId}:${eventType}:class:${cls1.id}:${cls2.id}:${toKSTDate(kstTime)}`;
            await createTaskCardWithDedup(supabase, {
              tenant_id: tenantId,
              entity_id: cls1.id,
              entity_type: 'class',
              task_type: 'ai_suggested',
              title: `반 병합 제안: ${cls1.name} + ${cls2.name}`,
              description: `정원률이 낮은 두 반을 병합하면 효율적인 운영이 가능합니다. 현재 인원: ${combinedStudents}명 (정원: ${maxCapacity}명)`,
              priority: priorityPolicy,
              dedup_key: dedupKey,
              expires_at: new Date(kstTime.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
              status: 'pending',
            });
            createdCount++;
          }
        }
      }
    }
  }

  return createdCount;
}

/**
 * 미사용 반 지속 알림 (unused_class_persistent)
 * 매주 월요일 08:50 실행
 */
async function processUnusedClassPersistent(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'unused_class_persistent';
  assertAutomationEventType(eventType);

  const enabled = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.enabled`
  );
  if (!enabled || enabled !== true) {
    return 0;
  }

  const persistentDays = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.persistent_days`
  ) as number;
  if (!persistentDays || typeof persistentDays !== 'number') {
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

  const cutoffDate = toKSTDate(new Date(kstTime.getTime() - persistentDays * 24 * 60 * 60 * 1000));

  // Industry Adapter: 업종별 클래스 테이블명 동적 조회
  const classTableName = await getTenantTableName(supabase, tenantId, 'class');

  // 학생이 없는 반 또는 최근 출석이 없는 반 조회
  const { data: classes, error } = await withTenant(
    supabase
      .from(classTableName || 'academy_classes') // Fallback
      .select('id, name, current_students')
      .eq('status', 'active')
      .eq('current_students', 0),
    tenantId
  );

  if (error || !classes) {
    return 0;
  }

  let createdCount = 0;
  for (const cls of classes) {
    // 최근 출석 로그 확인
    const { data: attendance } = await withTenant(
      supabase
        .from('attendance_logs')
        .select('id')
        .eq('class_id', cls.id)
        .gte('occurred_at', `${cutoffDate}T00:00:00`)
        .limit(1),
      tenantId
    );

    if (!attendance || attendance.length === 0) {
      const dedupKey = `${tenantId}:${eventType}:class:${cls.id}:${toKSTDate(kstTime)}`;
      // ⚠️ 정본 규칙: 부분 유니크 인덱스 사용 시 Supabase client upsert() 직접 사용 불가
      // RPC 함수 create_task_card_with_dedup_v1 사용 (프론트 자동화 문서 2.3 섹션 참조)
      await createTaskCardWithDedup(supabase, {
        tenant_id: tenantId,
        entity_id: cls.id,  // entity_id = class_id (entity_type='class')
        entity_type: 'class', // entity_type
        task_type: 'risk',
        title: `${cls.name} 미사용 알림`,
        description: `${cls.name}가 ${persistentDays}일 이상 사용되지 않고 있습니다.`,
        priority: priorityPolicy,
        dedup_key: dedupKey,
        expires_at: new Date(kstTime.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      });
      createdCount++;
    }
  }

  return createdCount;
}

serve(async (req) => {
  // CORS preflight 요청 처리
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

    console.log(`[Capacity Optimization] Starting batch at ${hour}:${minute}, day: ${dayOfWeek}`);

    // 매주 월요일만 실행
    if (dayOfWeek !== 1) {
      return new Response(
        JSON.stringify({ success: true, message: 'Not Monday, skipping' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        if (hour === 8) {
          if (minute >= 10 && minute < 15) {
            totalProcessed += await processClassFillRateLowPersistent(supabase, tenant.id, kstTime);
          } else if (minute >= 15 && minute < 20) {
            totalProcessed += await processHighFillRateExpandCandidate(supabase, tenant.id, kstTime);
          } else if (minute >= 20 && minute < 25) {
            totalProcessed += await processTimeSlotFillRateLow(supabase, tenant.id, kstTime);
          } else if (minute >= 30 && minute < 35) {
            // ai_suggest_class_merge: 매주 월요일 08:30 실행
            totalProcessed += await processAISuggestClassMerge(supabase, tenant.id, kstTime);
          } else if (minute >= 50 && minute < 55) {
            totalProcessed += await processUnusedClassPersistent(supabase, tenant.id, kstTime);
          }
        }
      } catch (error) {
        console.error(`[Capacity Optimization] Error for tenant ${tenant.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed_count: totalProcessed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Capacity Optimization] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

