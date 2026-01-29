/**
 * 키오스크 등원 Edge Function (v3 - 스마트 자동 출석 + 중복 방지)
 *
 * [목적] 학생이 등원 시 1회만 터치하면 오늘 모든 수업이 자동으로 예비 출석(scheduled) 처리
 *
 * [주요 기능]
 * 1. 등원 이벤트 기록 (attendance_type: 'check_in', status: null, class_id: null)
 * 2. 오늘 등록된 모든 수업을 scheduled 상태로 자동 기록
 * 3. 중복 방지: 이미 출석 기록이 있는 수업은 건너뛰기
 * 4. 부분 실패 허용: 일부 수업 실패 시에도 나머지 수업 계속 처리
 *
 * [자동 전환 로직] (별도 Function)
 * - 수업 시작 시: scheduled → present/late (auto-convert-scheduled-attendance Cron)
 * - 하원 시: scheduled → absent (kiosk-check-out Function)
 *
 * [보안]
 * - Service Role Key 사용 (RLS 우회)
 * - 모든 쿼리에서 tenant_id 명시적 확인
 * - Policy 기반 기능 활성화 검증 (kiosk.enabled)
 *
 * [에러 처리]
 * - 중복 등원 감지 및 거부 (409 Conflict)
 * - 수업별 에러 정보 응답에 포함
 * - 상세 로깅 (수업 ID, 이름, 에러 메시지)
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';

interface KioskCheckInRequest {
  tenant_id: string;
  student_phone: string;
}

interface ClassInfo {
  id: string;
  name: string;
  subject: string | null;
  start_time: string;
  end_time: string;
  day_of_week: string | string[];
}

interface Student {
  id: string;
  name: string;
}

/**
 * KST Date 객체를 'YYYY-MM-DD' 문자열로 변환
 * (kstTime은 이미 KST로 변환된 Date 객체여야 함)
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
 * 학생이 오늘 등록된 모든 수업 조회
 */
async function getTodayClasses(
  supabase: SupabaseClient,
  tenantId: string,
  studentId: string,
  currentDay: string
): Promise<ClassInfo[]> {
  // 학생이 등록된 수업 조회
  const { data: studentClasses, error } = await supabase
    .from('student_classes')
    .select(`
      class_id,
      classes:class_id (
        id,
        name,
        subject,
        start_time,
        end_time,
        day_of_week,
        status
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('student_id', studentId);

  if (error || !studentClasses || studentClasses.length === 0) {
    console.log('[kiosk-check-in] No classes found for student:', studentId);
    return [];
  }

  // 오늘 요일에 해당하는 활성 수업만 필터링
  const todayClasses: ClassInfo[] = [];
  for (const sc of studentClasses) {
    const classInfo = sc.classes as unknown as ClassInfo & { status: string };
    if (!classInfo || classInfo.status !== 'active') continue;

    // day_of_week가 배열이거나 단일 값일 수 있음
    const dayOfWeek = classInfo.day_of_week;
    let matchesToday = false;

    if (Array.isArray(dayOfWeek)) {
      matchesToday = dayOfWeek.includes(currentDay);
    } else if (typeof dayOfWeek === 'string') {
      matchesToday = dayOfWeek === currentDay;
    }

    if (matchesToday) {
      todayClasses.push(classInfo);
    }
  }

  return todayClasses;
}

/**
 * 오늘 이미 등원 이벤트(check_in)가 있는지 확인
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
    console.error('[kiosk-check-in] Check-in check error:', error);
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
    const { tenant_id, student_phone }: KioskCheckInRequest = await req.json();

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

    // 6. 오늘 이미 등원했는지 확인 (중복 방지)
    const alreadyCheckedIn = await hasTodayCheckIn(supabase, tenant_id, student.id, kstTime);

    if (alreadyCheckedIn) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '이미 등원이 완료되었습니다.',
          student: { id: student.id, name: student.name },
          message: `${student.name} 학생은 이미 오늘 등원했습니다.`,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. 오늘 등록된 수업 조회
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[kstTime.getDay()];
    const todayClasses = await getTodayClasses(supabase, tenant_id, student.id, currentDay);

    // 8. 등원 이벤트 레코드 생성 (attendance_type: 'check_in', status: null, class_id: null)
    const { error: checkInError } = await supabase
      .from('attendance_logs')
      .insert({
        tenant_id: tenant_id,
        student_id: student.id,
        class_id: null, // 등원 이벤트는 수업과 무관
        occurred_at: kstTime.toISOString(),
        attendance_type: 'check_in',
        status: null, // 등원 이벤트는 status 없음
        check_in_method: 'kiosk_phone',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });

    if (checkInError) {
      console.error('[kiosk-check-in] Check-in event creation failed:', checkInError);
      return new Response(
        JSON.stringify({ error: '등원 기록 생성에 실패했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 9. 오늘 등록된 모든 수업을 scheduled 상태로 기록 (중복 방지)
    const { startOfDay, endOfDay } = getKSTDayRange(kstTime);

    const scheduledRecords = [];
    for (const classInfo of todayClasses) {
      // 이미 해당 수업에 대한 출석 기록이 있는지 확인
      const { data: existingLog } = await supabase
        .from('attendance_logs')
        .select('id, status')
        .eq('tenant_id', tenant_id)
        .eq('student_id', student.id)
        .eq('class_id', classInfo.id)
        .gte('occurred_at', startOfDay)
        .lte('occurred_at', endOfDay)
        .is('attendance_type', null) // 수업 출석 레코드만
        .limit(1);

      if (existingLog && existingLog.length > 0) {
        // 이미 출석 기록이 있으면 건너뛰기 (중복 방지)
        const existingStatus = existingLog[0].status;
        console.log(`[kiosk-check-in] Attendance record already exists for class ${classInfo.id} (${classInfo.name}), status: ${existingStatus}`);

        // 기존 레코드 정보를 응답에 포함 (이미 출석 처리된 수업)
        scheduledRecords.push({
          class_id: classInfo.id,
          class_name: classInfo.name,
          subject: classInfo.subject,
          start_time: classInfo.start_time,
          already_exists: true,
          existing_status: existingStatus,
        });
        continue;
      }

      // 새 scheduled 레코드 생성
      const { error: scheduledError } = await supabase
        .from('attendance_logs')
        .insert({
          tenant_id: tenant_id,
          student_id: student.id,
          class_id: classInfo.id,
          occurred_at: kstTime.toISOString(),
          attendance_type: null, // 수업 출석은 attendance_type 없음
          status: 'scheduled', // 예비 출석 상태
          check_in_method: null,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        });

      if (scheduledError) {
        console.error(`[kiosk-check-in] Scheduled record creation failed for class ${classInfo.id} (${classInfo.name}):`, scheduledError);
        // 에러가 발생해도 계속 진행 (일부 수업만 실패할 수 있음)
        scheduledRecords.push({
          class_id: classInfo.id,
          class_name: classInfo.name,
          subject: classInfo.subject,
          start_time: classInfo.start_time,
          error: scheduledError.message || 'Unknown error',
        });
      } else {
        scheduledRecords.push({
          class_id: classInfo.id,
          class_name: classInfo.name,
          subject: classInfo.subject,
          start_time: classInfo.start_time,
        });
      }
    }

    // 10. 보호자 자동 알림 발송 (Policy 기반)
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

        // 알림 발송 (dispatch-notification Edge Function 호출)
        // TODO: 실제 알림 발송 구현
        const timeStr = kstTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
        const message = `${student.name} 학생이 ${timeStr}에 등원했습니다. (오늘 총 ${todayClasses.length}개 수업 예정)`;

        console.log(`[kiosk-check-in] Guardian notification: ${guardian.phone_number} - ${message}`);
      }
    }

    // 11. 성공 응답
    const timeStr = kstTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const classList = scheduledRecords.map(r => r.class_name).join(', ');

    return new Response(
      JSON.stringify({
        success: true,
        student: { id: student.id, name: student.name },
        check_in_time: kstTime.toISOString(),
        scheduled_classes: scheduledRecords,
        message: `${student.name} 학생의 등원이 완료되었습니다. (${timeStr})\n오늘 수업: ${classList || '없음'}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[kiosk-check-in] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
