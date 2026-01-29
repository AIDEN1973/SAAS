/**
 * 자동 출석 전환 Cron Edge Function (scheduled → present/late/absent)
 *
 * [목적] 수업 시작 시간이 되면 scheduled 상태를 자동으로 출석(present), 지각(late), 또는 결석(absent)으로 전환
 *
 * [실행 주기] 매 10분마다 (Cron: */10 * * * *)
 *
 * [로직]
 * 1. 모든 테넌트의 scheduled 상태 attendance_logs 조회
 * 2. 각 레코드의 수업 시작 시간 및 종료 시간 확인
 * 3. 현재 시간 기준:
 *    - 수업 시작 전: 건너뛰기 (아직 처리 시점 아님)
 *    - 수업 시작 ~ 지각 허용 시간: present (출석)
 *    - 지각 허용 시간 초과 ~ 수업 종료: late (지각)
 *    - 수업 종료 후: absent (결석, 등원했지만 수업 불참)
 * 4. 각 테넌트의 Policy 설정(late_threshold_minutes) 적용
 *
 * [설계 철학]
 * - scheduled 상태 = "등원했고 수업 예정" → 수업 시작되면 자동 출석 처리
 * - late_threshold_minutes = 지각 허용 시간 (기본 15분)
 * - 수업 종료 후에도 scheduled 상태면 absent 처리 (등원만 하고 수업 불참)
 * - Cron 실행으로 관리자 개입 없이 자동 처리
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';

interface ScheduledLog {
  id: string;
  tenant_id: string;
  student_id: string;
  class_id: string;
  occurred_at: string;
}

interface ClassInfo {
  start_time: string; // HH:MM 형식
  end_time: string;   // HH:MM 형식
}

/**
 * HH:MM 형식의 시간을 분(minute) 단위로 변환
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * KST 기준 현재 시간을 분(minute) 단위로 변환
 */
function getCurrentMinutesKST(kstTime: Date): number {
  const hours = kstTime.getHours();
  const minutes = kstTime.getMinutes();
  return hours * 60 + minutes;
}

/**
 * KST Date 객체를 'YYYY-MM-DD' 문자열로 변환
 */
function getKSTDateString(kstTime: Date): string {
  return kstTime.toISOString().split('T')[0];
}

/**
 * KST 날짜의 시작/종료 시간 (KST timezone 명시)
 */
function getKSTDayRange(kstTime: Date): { startOfDay: string; endOfDay: string } {
  const dateStr = getKSTDateString(kstTime);
  return {
    startOfDay: `${dateStr}T00:00:00+09:00`,
    endOfDay: `${dateStr}T23:59:59+09:00`,
  };
}

Deno.serve(async (_req) => {
  try {
    // 1. Supabase 클라이언트 생성 (Service Role - RLS 우회)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 2. KST 시간 계산
    const now = new Date();
    const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC + 9시간
    const currentMinutes = getCurrentMinutesKST(kstTime);

    console.log(`[auto-convert] Starting cron job at ${kstTime.toISOString()}`);

    // 3. 오늘 scheduled 상태인 모든 레코드 조회
    const { startOfDay, endOfDay } = getKSTDayRange(kstTime);

    const { data: scheduledLogs, error: fetchError } = await supabase
      .from('attendance_logs')
      .select(`
        id,
        tenant_id,
        student_id,
        class_id,
        occurred_at,
        classes:class_id (
          start_time,
          end_time
        )
      `)
      .eq('status', 'scheduled')
      .gte('occurred_at', startOfDay)
      .lte('occurred_at', endOfDay);

    if (fetchError) {
      console.error('[auto-convert] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch scheduled logs', details: fetchError }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!scheduledLogs || scheduledLogs.length === 0) {
      console.log('[auto-convert] No scheduled logs found for today.');
      return new Response(
        JSON.stringify({ success: true, message: 'No scheduled logs to process', converted: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[auto-convert] Found ${scheduledLogs.length} scheduled logs to process.`);

    // 4. 각 레코드 처리 (테넌트별로 그룹화하여 처리)
    const tenantGroups = new Map<string, (ScheduledLog & { classes: ClassInfo })[]>();

    for (const log of scheduledLogs) {
      const scheduledLog = log as unknown as ScheduledLog & { classes: ClassInfo };
      if (!tenantGroups.has(scheduledLog.tenant_id)) {
        tenantGroups.set(scheduledLog.tenant_id, []);
      }
      tenantGroups.get(scheduledLog.tenant_id)!.push(scheduledLog);
    }

    let convertedCount = 0;
    const conversionResults = [];

    // 5. 테넌트별로 처리 (Policy 조회 최소화)
    for (const [tenantId, logs] of tenantGroups) {
      try {
        // 테넌트별 지각 허용 시간 조회 (한 번만)
        const lateThreshold = await getTenantSettingByPath(
          supabase,
          tenantId,
          'attendance.late_threshold_minutes'
        ) as number | null;

        const lateThresholdMinutes = lateThreshold ?? 15; // 기본 15분

        // 6. 각 로그 처리
        for (const scheduledLog of logs) {
          try {
            const classInfo = scheduledLog.classes;

            if (!classInfo || !classInfo.start_time || !classInfo.end_time) {
              console.warn(`[auto-convert] Class info missing for log ${scheduledLog.id}`);
              continue;
            }

            // 수업 시작/종료 시간 (분 단위)
            const classStartMinutes = timeToMinutes(classInfo.start_time);
            const classEndMinutes = timeToMinutes(classInfo.end_time);

            // 수업 시작 시간이 아직 안 됨 → 건너뛰기
            if (currentMinutes < classStartMinutes) {
              continue;
            }

            // 수업 시작 후 경과 시간 (분)
            const elapsedMinutes = currentMinutes - classStartMinutes;

            // 7. 출석 상태 결정
            let newStatus: 'present' | 'late' | 'absent' = 'present';

            if (currentMinutes > classEndMinutes) {
              // 수업 종료 후에도 scheduled 상태 = 등원했지만 수업 불참
              newStatus = 'absent';
              console.warn(`[auto-convert] Class ended but still scheduled. Converting to absent. Log: ${scheduledLog.id}, Class: ${classInfo.start_time}-${classInfo.end_time}`);
            } else if (elapsedMinutes > lateThresholdMinutes) {
              // 지각 허용 시간 초과
              newStatus = 'late';
            } else {
              // 정상 출석
              newStatus = 'present';
            }

            // 8. attendance_logs 업데이트
            const { error: updateError } = await supabase
              .from('attendance_logs')
              .update({
                status: newStatus,
                updated_at: now.toISOString(),
              })
              .eq('id', scheduledLog.id);

            if (updateError) {
              console.error(`[auto-convert] Update error for log ${scheduledLog.id}:`, updateError);
            } else {
              convertedCount++;
              conversionResults.push({
                log_id: scheduledLog.id,
                tenant_id: scheduledLog.tenant_id,
                student_id: scheduledLog.student_id,
                class_id: scheduledLog.class_id,
                new_status: newStatus,
                elapsed_minutes: elapsedMinutes,
                late_threshold: lateThresholdMinutes,
              });
            }
          } catch (logError) {
            console.error(`[auto-convert] Error processing log ${scheduledLog.id}:`, logError);
          }
        }
      } catch (tenantError) {
        console.error(`[auto-convert] Error processing tenant ${tenantId}:`, tenantError);
      }
    }

    console.log(`[auto-convert] Successfully converted ${convertedCount}/${scheduledLogs.length} logs.`);

    // 8. 성공 응답
    return new Response(
      JSON.stringify({
        success: true,
        message: `Converted ${convertedCount} scheduled logs to present/late`,
        converted: convertedCount,
        total_scheduled: scheduledLogs.length,
        results: conversionResults,
        execution_time: kstTime.toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[auto-convert] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Unexpected server error', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
