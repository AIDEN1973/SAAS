/**
 * 안전 및 규정 준수 자동화 배치 작업
 *
 * AI_자동화_기능_정리.md Section 11 참조
 * safety_compliance 카테고리 자동화 처리
 * 스케줄: 수업 시작/종료 시점, 트리거 기반
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 체크인 리마인더 (checkin_reminder)
 * 수업 시작 전 알림
 */
async function processCheckinReminder(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'checkin_reminder';
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

  // Industry Adapter: 업종별 클래스 테이블명 동적 조회
  const classTableName = await getTenantTableName(supabase, tenantId, 'class');

  const today = toKSTDate(kstTime);
  const currentHour = kstTime.getHours();
  const currentMinute = kstTime.getMinutes();

  const { data: classes, error } = await withTenant(
    supabase
      .from(classTableName || 'academy_classes') // Fallback
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

    if (currentTime >= reminderTime && currentTime < reminderTime + 5) {
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
 * 체크아웃 누락 알림 (checkout_missing_alert)
 * 수업 종료 후 grace period 경과 시 알림
 */
async function processCheckoutMissingAlert(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'checkout_missing_alert';
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

  const gracePeriod = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.grace_period_minutes`
  ) as number;
  if (!gracePeriod || typeof gracePeriod !== 'number') {
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

  // Industry Adapter: 업종별 클래스 테이블명 동적 조회
  const classTableName = await getTenantTableName(supabase, tenantId, 'class');

  const today = toKSTDate(kstTime);
  const currentTime = kstTime.getTime();

  // 오늘 종료된 수업 조회
  const { data: classes, error } = await withTenant(
    supabase
      .from(classTableName || 'academy_classes') // Fallback
      .select('id, start_time, duration_minutes, name')
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
    const endTime = new Date(kstTime);
    endTime.setHours(hour, minute, 0, 0);
    endTime.setMinutes(endTime.getMinutes() + (cls.duration_minutes || 60));
    const graceEndTime = endTime.getTime() + gracePeriod * 60 * 1000;

    // grace period가 지났고 체크아웃이 없는 경우
    if (currentTime > graceEndTime && currentTime < graceEndTime + 5 * 60 * 1000) {
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
          // 체크아웃 로그 확인
          const { data: checkout } = await withTenant(
            supabase
              .from('attendance_logs')
              .select('id')
              .eq('student_id', enrollment.student_id)
              .eq('class_id', cls.id)
              .eq('status', 'present')
              .gte('occurred_at', endTime.toISOString())
              .limit(1),
            tenantId
          );

          if (!checkout || checkout.length === 0) {
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
                  grace_period: gracePeriod,
                },
              });
              sentCount++;
            }
          }
        }
      }
    }
  }

  return sentCount;
}

/**
 * 긴급 공지 알림 (announcement_urgent)
 * urgent insert 시 트리거 기반
 * ⚠️ 참고: announcements 테이블이 없을 수 있으므로, 트리거는 별도 마이그레이션에서 처리
 */
async function processAnnouncementUrgent(
  supabase: any,
  tenantId: string,
  announcementId: string
): Promise<number> {
  const eventType = 'announcement_urgent';
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
  const kstTime = toKST();
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

  // announcements 테이블에서 긴급 공지 조회
  const { data: announcement } = await withTenant(
    supabase
      .from('announcements')
      .select('id, title, urgent, target_audience')
      .eq('id', announcementId)
      .single(),
    tenantId
  );

  if (!announcement || !announcement.urgent) {
    return 0;
  }

  // 대상자에게 알림 발송
  // 예시: 모든 보호자에게 발송
  const { data: guardians } = await withTenant(
    supabase
      .from('guardians')
      .select('id, phone')
      .eq('is_primary', true),
    tenantId
  );

  if (guardians) {
    for (const guardian of guardians) {
      const dedupKey = `${tenantId}:${eventType}:announcement:${announcementId}:guardian:${guardian.id}:${toKSTDate(kstTime)}`;
      await supabase.from('automation_actions').insert({
        tenant_id: tenantId,
        action_type: 'send_notification',
        executor_role: 'system',
        dedup_key: dedupKey,
        execution_context: {
          event_type: eventType,
          announcement_id: announcementId,
          announcement_title: announcement.title,
          recipient_id: guardian.id,
          channel,
        },
      });
    }
    return guardians.length;
  }

  return 0;
}

/**
 * 공지 요약 (announcement_digest)
 * 주간/월간 배치 실행
 */
async function processAnnouncementDigest(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'announcement_digest';
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

  // announcements 테이블에서 최근 1주일 공지 조회
  const today = toKSTDate(kstTime);
  const lastWeek = toKSTDate(new Date(kstTime.getTime() - 7 * 24 * 60 * 60 * 1000));

  const { data: announcements } = await withTenant(
    supabase
      .from('announcements')
      .select('id, title, created_at')
      .gte('created_at', `${lastWeek}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`),
    tenantId
  );

  if (!announcements || announcements.length === 0) {
    return 0;
  }

  // 모든 보호자에게 주간 공지 요약 발송
  const { data: guardians } = await withTenant(
    supabase
      .from('guardians')
      .select('id, phone')
      .eq('is_primary', true),
    tenantId
  );

  if (guardians) {
    for (const guardian of guardians) {
      const dedupKey = `${tenantId}:${eventType}:guardian:${guardian.id}:${today}`;
      await supabase.from('automation_actions').insert({
        tenant_id: tenantId,
        action_type: 'send_notification',
        executor_role: 'system',
        dedup_key: dedupKey,
        execution_context: {
          event_type: eventType,
          recipient_id: guardian.id,
          channel,
          announcement_count: announcements.length,
          announcements: announcements.map((a: any) => ({ id: a.id, title: a.title })),
        },
      });
    }
    return guardians.length;
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

    console.log(`[Safety Compliance] Starting batch`);

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
        // 매일 실행: 체크인 리마인더, 체크아웃 누락 알림
        totalProcessed += await processCheckinReminder(supabase, tenant.id, kstTime);
        totalProcessed += await processCheckoutMissingAlert(supabase, tenant.id, kstTime);
      } catch (error) {
        console.error(`[Safety Compliance] Error for tenant ${tenant.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed_count: totalProcessed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Safety Compliance] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

