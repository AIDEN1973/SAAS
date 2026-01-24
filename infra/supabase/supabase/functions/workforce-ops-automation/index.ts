/**
 * 인력 운영 자동화 배치 작업
 *
 * AI_자동화_기능_정리.md Section 11 참조
 * workforce_ops 카테고리 자동화 처리
 * 스케줄: 매주 월요일 08:40 KST
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
 * 강사 업무량 불균형 알림 (teacher_workload_imbalance)
 * 매주 월요일 08:40 실행
 */
async function processTeacherWorkloadImbalance(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'teacher_workload_imbalance';
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

  // 강사별 수업 수 조회
  // ⚠️ 중요: class_teachers 테이블을 조회해야 함 (academy_teachers는 person_id만 가지고 있음)
  const { data: teacherClasses, error } = await withTenant(
    supabase
      .from('class_teachers')
      .select('teacher_id, class_id')
      .eq('is_active', true),
    tenantId
  );

  if (error || !teacherClasses) {
    return 0;
  }

  // 강사별 수업 수 집계
  const teacherWorkload = new Map<string, number>();
  for (const tc of teacherClasses) {
    const count = teacherWorkload.get(tc.teacher_id) || 0;
    teacherWorkload.set(tc.teacher_id, count + 1);
  }

  if (teacherWorkload.size === 0) {
    return 0;
  }

  const workloads = Array.from(teacherWorkload.values());
  const avgWorkload = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
  const maxWorkload = Math.max(...workloads);
  const minWorkload = Math.min(...workloads);
  const imbalance = maxWorkload - minWorkload;

  if (imbalance >= threshold) {
    const dedupKey = `${tenantId}:${eventType}:tenant:${tenantId}:${toKSTDate(kstTime)}`;
    // ⚠️ 정본 규칙: 부분 유니크 인덱스 사용 시 Supabase client upsert() 직접 사용 불가
    // RPC 함수 create_task_card_with_dedup_v1 사용 (프론트 자동화 문서 2.3 섹션 참조)
    await createTaskCardWithDedup(supabase, {
      tenant_id: tenantId,
      entity_id: tenantId,  // entity_id = tenantId (entity_type='tenant')
      entity_type: 'tenant', // entity_type
      task_type: 'risk',
      title: '강사 업무량 불균형',
      description: `강사 간 업무량 차이가 ${imbalance}개 수업으로 ${threshold}개 이상입니다. 평균: ${avgWorkload.toFixed(1)}개, 최대: ${maxWorkload}개, 최소: ${minWorkload}개`,
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
 * 직원 결근 일정 리스크 알림 (staff_absence_schedule_risk)
 * 매일 18:00 실행
 */
async function processStaffAbsenceScheduleRisk(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'staff_absence_schedule_risk';
  assertAutomationEventType(eventType);

  const enabled = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.enabled`
  );
  if (!enabled || enabled !== true) {
    return 0;
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

  const tomorrow = toKSTDate(new Date(kstTime.getTime() + 24 * 60 * 60 * 1000));

  // 내일 수업이 있는 강사 조회
  const { data: tomorrowClasses } = await withTenant(
    supabase
      .from('class_teachers')
      .select(`
        teacher_id,
        academy_classes!inner (
          id,
          name,
          start_time
        )
      `)
      .gte('academy_classes.start_time', `${tomorrow}T00:00:00`)
      .lte('academy_classes.start_time', `${tomorrow}T23:59:59`)
      .eq('is_active', true),
    tenantId
  );

  if (!tomorrowClasses || tomorrowClasses.length === 0) {
    return 0;
  }

  // 내일 수업을 담당하는 강사 ID 목록
  const teacherIds = [...new Set(tomorrowClasses.map((c: any) => c.teacher_id))];

  // staff_absences 테이블에서 내일 결근 예정인 강사 조회
  const { data: absences } = await withTenant(
    supabase
      .from('staff_absences')
      .select('teacher_id, absence_type, reason')
      .in('teacher_id', teacherIds)
      .lte('start_date', tomorrow)
      .gte('end_date', tomorrow)
      .eq('status', 'approved'),
    tenantId
  );

  if (absences && absences.length > 0) {
    // 결근 예정인 강사가 담당하는 수업 찾기
    const affectedClasses = tomorrowClasses.filter((tc: any) =>
      absences.some((a: any) => a.teacher_id === tc.teacher_id)
    );

    const dedupKey = `${tenantId}:${eventType}:tenant:${tenantId}:${tomorrow}`;
    await createTaskCardWithDedup(supabase, {
      tenant_id: tenantId,
      entity_id: tenantId,
      entity_type: 'tenant',
      task_type: 'risk',
      title: '직원 결근 일정 리스크',
      description: `내일 결근 예정인 강사 ${absences.length}명으로 인해 ${affectedClasses.length}개 수업에 영향이 있을 수 있습니다. 대체 강사 배정을 확인해주세요.`,
      priority: priorityPolicy,
      dedup_key: dedupKey,
      expires_at: new Date(kstTime.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    });

    return 1;
  }

  return 0;
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

    console.log(`[Workforce Ops] Starting batch at ${hour}:${minute}, day: ${dayOfWeek}`);

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
        if (hour === 8 && minute >= 40 && minute < 45) {
          totalProcessed += await processTeacherWorkloadImbalance(supabase, tenant.id, kstTime);
        }

        // 매일 18:00 (staff_absence_schedule_risk)
        if (hour === 18 && minute >= 0 && minute < 5) {
          totalProcessed += await processStaffAbsenceScheduleRisk(supabase, tenant.id, kstTime);
        }
      } catch (error) {
        console.error(`[Workforce Ops] Error for tenant ${tenant.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed_count: totalProcessed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Workforce Ops] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

