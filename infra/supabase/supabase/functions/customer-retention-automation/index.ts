/**
 * 고객 유지 자동화 배치 작업
 *
 * AI_자동화_기능_정리.md Section 11 참조
 * customer_retention 카테고리 자동화 처리
 * 스케줄: 매일 20:00, 매주 월요일 09:00-09:20 KST
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 오늘 수업 리마인더 (class_reminder_today)
 * 수업 시작 전 알림
 */
async function processClassReminderToday(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'class_reminder_today';
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

  // Policy에서 알림 시간 조회 (수업 시작 몇 분 전)
  const minutesBefore = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.minutes_before`
  ) as number;

  if (!minutesBefore || typeof minutesBefore !== 'number') {
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
  const currentHour = kstTime.getHours();
  const currentMinute = kstTime.getMinutes();

  // 오늘 수업 조회
  const { data: classes, error } = await withTenant(
    supabase
      .from('academy_classes')
      .select('id, start_time, name')
      .gte('start_time', `${today}T00:00:00`)
      .lte('start_time', `${today}T23:59:59`),
    tenantId
  );

  if (error || !classes) {
    return 0;
  }

  let sentCount = 0;
  for (const cls of classes) {
    const [hour, minute] = cls.start_time.split('T')[1].split(':').map(Number);
    const classTime = hour * 60 + minute;
    const currentTime = currentHour * 60 + currentMinute;
    const reminderTime = classTime - minutesBefore;

    // 알림 시간이 현재 시간과 일치하는 경우
    if (currentTime >= reminderTime && currentTime < reminderTime + 5) {
      // 수업에 등록된 학생 조회
      const { data: enrollments } = await withTenant(
        supabase
          .from('student_classes')
          .select('student_id')
          .eq('class_id', cls.id)
          .eq('status', 'active'),
        tenantId
      );

      if (enrollments) {
        for (const enrollment of enrollments) {
          const { data: guardian } = await withTenant(
            supabase
              .from('guardians')
              .select('id, phone')
              .eq('student_id', enrollment.student_id)
              .eq('is_primary', true)
              .single(),
            tenantId
          );

          if (guardian) {
            const dedupKey = `${tenantId}:${eventType}:class:${cls.id}:guardian:${guardian.id}:${toKSTDate(kstTime)}`;
            await supabase.from('automation_actions').insert({
              tenant_id: tenantId,
              action_type: 'send_notification',
              executor_role: 'system',
              dedup_key: dedupKey,
              execution_context: {
                event_type: eventType,
                class_id: cls.id,
                recipient_id: guardian.id,
                channel,
                minutes_before: minutesBefore,
              },
            });
            sentCount++;
          }
        }
      }
    }
  }

  return sentCount;
}

/**
 * 내일 수업 일정 안내 (class_schedule_tomorrow)
 * 매일 20:00 실행
 */
async function processClassScheduleTomorrow(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'class_schedule_tomorrow';
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

  const tomorrow = toKSTDate(new Date(kstTime.getTime() + 24 * 60 * 60 * 1000));

  // 내일 수업 조회
  const { data: classes, error } = await withTenant(
    supabase
      .from('academy_classes')
      .select('id, start_time, name')
      .gte('start_time', `${tomorrow}T00:00:00`)
      .lte('start_time', `${tomorrow}T23:59:59`),
    tenantId
  );

  if (error || !classes) {
    return 0;
  }

  let sentCount = 0;
  const classMap = new Map<string, any[]>();

  // 학생별로 내일 수업 그룹화
  for (const cls of classes) {
    const { data: enrollments } = await withTenant(
      supabase
        .from('student_classes')
        .select('student_id')
        .eq('class_id', cls.id)
        .eq('status', 'active'),
      tenantId
    );

    if (enrollments) {
      for (const enrollment of enrollments) {
        if (!classMap.has(enrollment.student_id)) {
          classMap.set(enrollment.student_id, []);
        }
        classMap.get(enrollment.student_id)!.push(cls);
      }
    }
  }

  // 각 학생의 보호자에게 알림
  for (const [studentId, studentClasses] of classMap.entries()) {
    const { data: guardian } = await withTenant(
      supabase
        .from('guardians')
        .select('id, phone')
        .eq('student_id', studentId)
        .eq('is_primary', true)
        .single(),
      tenantId
    );

    if (guardian) {
      const dedupKey = `${tenantId}:${eventType}:student:${studentId}:guardian:${guardian.id}:${toKSTDate(kstTime)}`;
      await supabase.from('automation_actions').insert({
        tenant_id: tenantId,
        action_type: 'send_notification',
        executor_role: 'system',
        dedup_key: dedupKey,
        execution_context: {
          event_type: eventType,
          recipient_id: guardian.id,
          channel,
          classes: studentClasses.map(c => ({ id: c.id, name: c.name, time: c.start_time })),
        },
      });
      sentCount++;
    }
  }

  return sentCount;
}

/**
 * 상담 일정 리마인더 (consultation_reminder)
 * 24시간 전, 2시간 전 알림
 */
async function processConsultationReminder(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'consultation_reminder';
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

  // Policy에서 알림 시간 조회
  const hoursBeforeFirst = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.hours_before_first`
  ) as number;
  const hoursBeforeSecond = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.hours_before_second`
  ) as number;

  if (!hoursBeforeFirst || !hoursBeforeSecond) {
    return 0; // Fail Closed: 설정값이 없으면 실행하지 않음
  }

  const now = kstTime.getTime();
  const inFirstHours = new Date(now + hoursBeforeFirst * 60 * 60 * 1000);
  const inSecondHours = new Date(now + hoursBeforeSecond * 60 * 60 * 1000);

  let sentCount = 0;

  // 첫 번째 알림: hours_before_first시간 전
  const dateFirst = toKSTDate(inFirstHours);
  const { data: consultationsFirst } = await withTenant(
    supabase
      .from('student_consultations')
      .select('id, student_id, consultation_date, consultation_time')
      .eq('consultation_date', dateFirst),
    tenantId
  );

  if (consultationsFirst) {
    for (const consultation of consultationsFirst) {
      const { data: guardian } = await withTenant(
        supabase
          .from('guardians')
          .select('id, phone')
          .eq('student_id', consultation.student_id)
          .eq('is_primary', true)
          .single(),
        tenantId
      );

      if (guardian) {
        const dedupKey = `${tenantId}:${eventType}:consultation:${consultation.id}:guardian:${guardian.id}:${toKSTDate(kstTime)}:${hoursBeforeFirst}h`;
        await supabase.from('automation_actions').insert({
          tenant_id: tenantId,
          action_type: 'send_notification',
          executor_role: 'system',
          dedup_key: dedupKey,
          execution_context: {
            event_type: eventType,
            consultation_id: consultation.id,
            recipient_id: guardian.id,
            channel,
            hours_before: hoursBeforeFirst,
          },
        });
        sentCount++;
      }
    }
  }

  // 두 번째 알림: hours_before_second시간 전
  const dateSecond = toKSTDate(inSecondHours);
  const { data: consultationsSecond } = await withTenant(
    supabase
      .from('student_consultations')
      .select('id, student_id, consultation_date, consultation_time')
      .eq('consultation_date', dateSecond),
    tenantId
  );

  if (consultationsSecond) {
    for (const consultation of consultationsSecond) {
      const { data: guardian } = await withTenant(
        supabase
          .from('guardians')
          .select('id, phone')
          .eq('student_id', consultation.student_id)
          .eq('is_primary', true)
          .single(),
        tenantId
      );

      if (guardian) {
        const dedupKey = `${tenantId}:${eventType}:consultation:${consultation.id}:guardian:${guardian.id}:${toKSTDate(kstTime)}:${hoursBeforeSecond}h`;
        await supabase.from('automation_actions').insert({
          tenant_id: tenantId,
          action_type: 'send_notification',
          executor_role: 'system',
          dedup_key: dedupKey,
          execution_context: {
            event_type: eventType,
            consultation_id: consultation.id,
            recipient_id: guardian.id,
            channel,
            hours_before: hoursBeforeSecond,
          },
        });
        sentCount++;
      }
    }
  }

  return sentCount;
}

/**
 * 이탈 증가 알림 (churn_increase)
 * 매주 월요일 09:20 실행
 */
async function processChurnIncrease(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'churn_increase';
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

  // 최근 1주일 이탈 학생 수
  const { data: recentChurns } = await withTenant(
    supabase
      .from('persons')
      .select('id')
      .eq('person_type', 'student')
      .eq('status', 'inactive')
      .gte('updated_at', `${lastWeek}T00:00:00`)
      .lte('updated_at', `${today}T23:59:59`),
    tenantId
  );

  // 이전 1주일 이탈 학생 수
  const { data: previousChurns } = await withTenant(
    supabase
      .from('persons')
      .select('id')
      .eq('person_type', 'student')
      .eq('status', 'inactive')
      .gte('updated_at', `${twoWeeksAgo}T00:00:00`)
      .lt('updated_at', `${lastWeek}T00:00:00`),
    tenantId
  );

  const recentCount = recentChurns?.length || 0;
  const previousCount = previousChurns?.length || 0;

  if (previousCount > 0 && (recentCount / previousCount) >= threshold) {
    const dedupKey = `${tenantId}:${eventType}:tenant:${tenantId}:${today}`;
    await supabase.from('task_cards').upsert({
      tenant_id: tenantId,
      entity_id: tenantId,  // entity_id = tenantId (entity_type='tenant')
      entity_type: 'tenant', // entity_type
      task_type: 'risk',
      title: '이탈 증가 알림',
      description: `최근 1주일간 이탈 학생 수가 이전 대비 ${((recentCount / previousCount - 1) * 100).toFixed(1)}% 증가했습니다.`,
      priority: 85,
      dedup_key: dedupKey,
      expires_at: new Date(kstTime.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }, {
      onConflict: 'tenant_id,dedup_key',
      ignoreDuplicates: false,
    });

    return 1;
  }

  return 0;
}

/**
 * 주간 출석률 하락 감지 (attendance_rate_drop_weekly)
 * 매주 월요일 09:00 실행
 */
async function processAttendanceRateDropWeekly(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'attendance_rate_drop_weekly';
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

  // 최근 1주일 출석률
  const { data: recentLogs } = await withTenant(
    supabase
      .from('attendance_logs')
      .select('status')
      .gte('occurred_at', `${lastWeek}T00:00:00`)
      .lte('occurred_at', `${today}T23:59:59`),
    tenantId
  );

  // 이전 1주일 출석률
  const { data: previousLogs } = await withTenant(
    supabase
      .from('attendance_logs')
      .select('status')
      .gte('occurred_at', `${twoWeeksAgo}T00:00:00`)
      .lt('occurred_at', `${lastWeek}T00:00:00`),
    tenantId
  );

  const recentPresent = recentLogs?.filter((log: any) => log.status === 'present').length || 0;
  const recentTotal = recentLogs?.length || 0;

  const previousPresent = previousLogs?.filter((log: any) => log.status === 'present').length || 0;
  const previousTotal = previousLogs?.length || 0;

  // ⚠️ Fail Closed: 데이터가 없으면 자동화 실행하지 않음
  if (recentTotal === 0 || previousTotal === 0) {
    return 0;
  }

  const recentRate = (recentPresent / recentTotal) * 100;
  const previousRate = (previousPresent / previousTotal) * 100;

  const dropRate = previousRate - recentRate;

  if (dropRate >= threshold) {
    const dedupKey = `${tenantId}:${eventType}:tenant:${tenantId}:${today}`;
    await supabase.from('task_cards').upsert({
      tenant_id: tenantId,
      entity_id: tenantId,  // entity_id = tenantId (entity_type='tenant')
      entity_type: 'tenant', // entity_type
      task_type: 'risk',
      title: '주간 출석률 하락',
      description: `최근 1주일 출석률이 이전 대비 ${dropRate.toFixed(1)}% 하락했습니다.`,
      priority: 75,
      dedup_key: dedupKey,
      expires_at: new Date(kstTime.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }, {
      onConflict: 'tenant_id,dedup_key',
      ignoreDuplicates: false,
    });

    return 1;
  }

  return 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY);
    const kstTime = toKST();
    const hour = kstTime.getHours();
    const minute = kstTime.getMinutes();
    const dayOfWeek = kstTime.getDay(); // 0=일요일, 1=월요일

    console.log(`[Customer Retention] Starting batch at ${hour}:${minute}, day: ${dayOfWeek}`);

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
        // 매일 설정된 시간: 내일 수업 일정 안내
        // ⚠️ Automation Config First: Policy가 없으면 실행하지 않음 (Fail Closed)
        const notificationTime = await getTenantSettingByPath(
          supabase,
          tenant.id,
          'auto_notification.class_schedule_tomorrow.notification_time'
        ) as string;

        if (notificationTime) {
          const [notifHour, notifMinute] = notificationTime.split(':').map(Number);
          if (hour === notifHour && minute >= notifMinute && minute < notifMinute + 5) {
            totalProcessed += await processClassScheduleTomorrow(supabase, tenant.id, kstTime);
          }
        }
        // Policy가 없으면 실행하지 않음 (Fail Closed)

        // 매일: 오늘 수업 리마인더 (수업 시작 전)
        totalProcessed += await processClassReminderToday(supabase, tenant.id, kstTime);

        // 매일: 상담 일정 리마인더
        totalProcessed += await processConsultationReminder(supabase, tenant.id, kstTime);

        // 매주 월요일 09:00: 주간 출석률 하락
        if (dayOfWeek === 1 && hour === 9 && minute < 5) {
          totalProcessed += await processAttendanceRateDropWeekly(supabase, tenant.id, kstTime);
        }

        // 매주 월요일 09:20: 이탈 증가
        if (dayOfWeek === 1 && hour === 9 && minute >= 20 && minute < 25) {
          totalProcessed += await processChurnIncrease(supabase, tenant.id, kstTime);
        }
      } catch (error) {
        console.error(`[Customer Retention] Error for tenant ${tenant.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed_count: totalProcessed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Customer Retention] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

