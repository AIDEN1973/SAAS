/**
 * 키오스크 하원 Edge Function (v2 - 조퇴 감지 & 자동 결석 처리)
 *
 * [목적] 학생이 하원 시 1회만 터치하면 아직 시작되지 않은 수업을 자동으로 결석 처리
 *
 * [주요 기능]
 * 1. 등원 확인: 오늘 등원 기록이 없으면 하원 불가 (409 Conflict)
 * 2. 중복 방지: 이미 하원한 경우 거부 (409 Conflict)
 * 3. 조퇴 감지: scheduled 상태 수업을 absent로 자동 전환
 * 4. 하원 이벤트 기록 (attendance_type: 'check_out', status: null, class_id: null)
 * 5. 보호자 알림: 하원 시간 + 조퇴한 수업 목록
 *
 * [처리 규칙]
 * - present/late 상태 수업: 이미 출석 처리되었으므로 변경 없음
 * - scheduled 상태 수업: 아직 시작 안 됨 → absent (조퇴)
 * - 이미 absent 수업: 변경 없음
 *
 * [보안]
 * - Service Role Key 사용 (RLS 우회)
 * - 모든 쿼리에서 tenant_id 명시적 확인
 * - Policy 기반 기능 활성화 검증 (kiosk.enabled)
 *
 * [에러 처리]
 * - 등원 기록 없이 하원 시도 감지
 * - 중복 하원 감지 및 거부
 * - 상세 로깅 및 응답 메시지
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';

interface KioskCheckOutRequest {
  tenant_id: string;
  student_phone: string;
}

interface Student {
  id: string;
  name: string;
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

/**
 * 오늘 등원했는지 확인 (check_in 이벤트 존재 여부)
 */
async function hasTodayCheckIn(
  supabase: SupabaseClient,
  tenantId: string,
  studentId: string,
  date: Date
): Promise<boolean> {
  const { startOfDay, endOfDay } = getKSTDayRange(date);

  const { data, error } = await supabase
    .from('attendance_logs')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('student_id', studentId)
    .eq('attendance_type', 'check_in')
    .gte('occurred_at', startOfDay)
    .lte('occurred_at', endOfDay)
    .limit(1);

  if (error) {
    console.error('[kiosk-check-out] Check-in check error:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * 오늘 이미 하원 이벤트(check_out)가 있는지 확인
 */
async function hasTodayCheckOut(
  supabase: SupabaseClient,
  tenantId: string,
  studentId: string,
  date: Date
): Promise<boolean> {
  const { startOfDay, endOfDay } = getKSTDayRange(date);

  const { data, error } = await supabase
    .from('attendance_logs')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('student_id', studentId)
    .eq('attendance_type', 'check_out')
    .gte('occurred_at', startOfDay)
    .lte('occurred_at', endOfDay)
    .limit(1);

  if (error) {
    console.error('[kiosk-check-out] Check-out check error:', error);
    return false;
  }

  return data && data.length > 0;
}

Deno.serve(async (req) => {
  // CORS 헤더 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. 요청 파싱
    const { tenant_id, student_phone }: KioskCheckOutRequest = await req.json();

    if (!tenant_id || !student_phone) {
      return new Response(
        JSON.stringify({ error: '테넌트 ID와 휴대폰 번호는 필수입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 휴대폰 번호 형식 검증 (하이픈 제거)
    const normalizedPhone = student_phone.replace(/-/g, '');
    if (!/^01[0-9]{8,9}$/.test(normalizedPhone)) {
      return new Response(
        JSON.stringify({ error: '올바른 휴대폰 번호 형식이 아닙니다. (예: 01012345678)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Supabase 클라이언트 생성 (Service Role - RLS 우회)
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

    // 3. 키오스크 기능 활성화 여부 확인 (Policy 기반)
    const kioskEnabled = await getTenantSettingByPath(
      supabase,
      tenant_id,
      'kiosk.enabled'
    ) as boolean | null;

    if (kioskEnabled !== true) {
      return new Response(
        JSON.stringify({ error: '키오스크 기능이 비활성화되어 있습니다.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. KST 시간 계산
    const now = new Date();
    const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC + 9시간

    // 5. 학생 조회 (휴대폰 번호로)
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('id, name, status')
      .eq('tenant_id', tenant_id)
      .eq('student_phone', normalizedPhone)
      .limit(1);

    if (studentError || !students || students.length === 0) {
      return new Response(
        JSON.stringify({ error: '등록되지 않은 휴대폰 번호입니다.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const student = students[0] as Student & { status: string };

    if (student.status !== 'active') {
      return new Response(
        JSON.stringify({ error: '활성 상태가 아닌 학생입니다.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. 오늘 등원했는지 확인 (등원 없이 하원 불가)
    const alreadyCheckedIn = await hasTodayCheckIn(supabase, tenant_id, student.id, kstTime);

    if (!alreadyCheckedIn) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '오늘 등원 기록이 없습니다.',
          student: { id: student.id, name: student.name },
          message: `${student.name} 학생은 오늘 등원하지 않았습니다.`,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. 오늘 이미 하원했는지 확인 (중복 방지)
    const alreadyCheckedOut = await hasTodayCheckOut(supabase, tenant_id, student.id, kstTime);

    if (alreadyCheckedOut) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '이미 하원이 완료되었습니다.',
          student: { id: student.id, name: student.name },
          message: `${student.name} 학생은 이미 오늘 하원했습니다.`,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. 오늘 scheduled 상태 수업 조회
    const { startOfDay, endOfDay } = getKSTDayRange(kstTime);

    const { data: scheduledLogs } = await supabase
      .from('attendance_logs')
      .select('id, class_id, classes:class_id(name, subject)')
      .eq('tenant_id', tenant_id)
      .eq('student_id', student.id)
      .eq('status', 'scheduled')
      .gte('occurred_at', startOfDay)
      .lte('occurred_at', endOfDay);

    // 9. scheduled 수업을 absent로 전환 (조퇴 처리)
    const missedClasses = [];
    if (scheduledLogs && scheduledLogs.length > 0) {
      for (const log of scheduledLogs) {
        const { error: updateError } = await supabase
          .from('attendance_logs')
          .update({
            status: 'absent',
            updated_at: now.toISOString(),
          })
          .eq('id', log.id);

        if (updateError) {
          console.error('[kiosk-check-out] Failed to update scheduled to absent:', updateError);
        } else {
          const classInfo = log.classes as { name: string; subject: string | null };
          missedClasses.push({
            class_id: log.class_id,
            class_name: classInfo?.name || '알 수 없음',
            subject: classInfo?.subject,
          });
        }
      }
    }

    // 10. 하원 이벤트 레코드 생성 (attendance_type: 'check_out', status: null, class_id: null)
    const { error: checkOutError } = await supabase
      .from('attendance_logs')
      .insert({
        tenant_id: tenant_id,
        student_id: student.id,
        class_id: null, // 하원 이벤트는 수업과 무관
        occurred_at: kstTime.toISOString(),
        attendance_type: 'check_out',
        status: null, // 하원 이벤트는 status 없음
        check_in_method: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });

    if (checkOutError) {
      console.error('[kiosk-check-out] Check-out event creation failed:', checkOutError);
      return new Response(
        JSON.stringify({ error: '하원 기록 생성에 실패했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 11. 보호자 자동 알림 발송 (Policy 기반)
    const autoNotify = await getTenantSettingByPath(
      supabase,
      tenant_id,
      'kiosk.auto_notify_guardian'
    ) as boolean | null;

    if (autoNotify === true) {
      // 보호자 정보 조회
      const { data: guardians } = await supabase
        .from('guardians')
        .select('id, name, phone_number, relationship')
        .eq('tenant_id', tenant_id)
        .eq('student_id', student.id)
        .eq('is_primary', true)
        .limit(1);

      if (guardians && guardians.length > 0) {
        const guardian = guardians[0];

        // 알림 발송
        const timeStr = kstTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
        let message = `${student.name} 학생이 ${timeStr}에 하원했습니다.`;

        if (missedClasses.length > 0) {
          const classList = missedClasses.map(c => c.class_name).join(', ');
          message += ` (미참석 수업: ${classList})`;
        }

        console.log(`[kiosk-check-out] Guardian notification: ${guardian.phone_number} - ${message}`);
      }
    }

    // 12. 성공 응답
    const timeStr = kstTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    let responseMessage = `${student.name} 학생의 하원이 완료되었습니다. (${timeStr})`;

    if (missedClasses.length > 0) {
      const classList = missedClasses.map(c => c.class_name).join(', ');
      responseMessage += `\n미참석 수업: ${classList}`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        student: { id: student.id, name: student.name },
        check_out_time: kstTime.toISOString(),
        missed_classes: missedClasses,
        message: responseMessage,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[kiosk-check-out] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
