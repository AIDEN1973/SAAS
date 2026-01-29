/**
 * 키오스크 출석 체크 Edge Function
 *
 * [목적] 태블릿 단말기에서 학생 본인 휴대폰 번호 입력으로 출석 체크
 * [인증] 공개 API (인증 불필요, IP/Rate Limiting으로 보안)
 * [Zero-Management] 출석 완료 시 보호자에게 자동 알림 발송
 * [연속 수업] 현재 시간 기준 가장 가까운 수업에 자동 매칭 + 중복 방지
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';

interface KioskCheckInRequest {
  tenant_id: string;
  student_phone: string;
  class_id?: string; // 선택적: 특정 수업 출석 체크 (없으면 자동 매칭)
}

interface ClassInfo {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  day_of_week: string;
}

/**
 * 현재 시간 기준으로 학생의 "아직 출석하지 않은" 가장 가까운 수업을 찾습니다.
 * - 오늘 요일에 해당하는 수업만 조회
 * - 수업 시작 30분 전 ~ 수업 종료 시간 사이에 출석 가능
 * - 이미 출석한 수업은 제외
 * - 여러 수업이 있으면 시작 시간 순서로 미출석 수업 선택
 */
async function findMatchingClass(
  supabase: SupabaseClient,
  tenantId: string,
  studentId: string,
  currentTime: Date
): Promise<ClassInfo | null> {
  // 현재 요일 (KST 기준)
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[currentTime.getDay()];

  // 현재 시간 (HH:mm 형식)
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  // 학생이 등록된 수업 조회 (student_classes 조인)
  const { data: studentClasses, error } = await supabase
    .from('student_classes')
    .select(`
      class_id,
      classes:class_id (
        id,
        name,
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
    return null;
  }

  // 오늘 이미 출석한 수업 ID 목록 조회
  const dateStr = currentTime.toISOString().split('T')[0];
  const startOfDay = `${dateStr}T00:00:00+09:00`;
  const endOfDay = `${dateStr}T23:59:59+09:00`;

  const { data: todayAttendance } = await supabase
    .from('attendance_logs')
    .select('class_id')
    .eq('tenant_id', tenantId)
    .eq('student_id', studentId)
    .eq('attendance_type', 'check_in')
    .gte('occurred_at', startOfDay)
    .lte('occurred_at', endOfDay);

  const attendedClassIds = new Set(
    (todayAttendance || []).map(log => log.class_id).filter(Boolean)
  );

  // 오늘 요일에 해당하고, 현재 시간에 출석 가능한 수업 필터링
  const matchingClasses: (ClassInfo & { startMinutes: number })[] = [];

  for (const sc of studentClasses) {
    const classInfo = sc.classes as unknown as ClassInfo & { status: string };
    if (!classInfo || classInfo.status !== 'active') continue;
    if (classInfo.day_of_week !== currentDay) continue;

    // 이미 출석한 수업은 제외
    if (attendedClassIds.has(classInfo.id)) {
      console.log(`[kiosk-check-in] Skipping already attended class: ${classInfo.name}`);
      continue;
    }

    // 수업 시작/종료 시간 파싱
    const [startHour, startMinute] = classInfo.start_time.split(':').map(Number);
    const [endHour, endMinute] = classInfo.end_time.split(':').map(Number);
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    // 출석 가능 시간: 수업 시작 30분 전 ~ 수업 종료 시간
    const checkInWindowStart = startTimeMinutes - 30;
    const checkInWindowEnd = endTimeMinutes;

    if (currentTimeMinutes >= checkInWindowStart && currentTimeMinutes <= checkInWindowEnd) {
      matchingClasses.push({ ...classInfo, startMinutes: startTimeMinutes });
    }
  }

  if (matchingClasses.length === 0) {
    console.log('[kiosk-check-in] No matching classes for current time (all attended or outside window)');
    return null;
  }

  // 시작 시간 순서로 정렬 (가장 빠른 미출석 수업 선택)
  matchingClasses.sort((a, b) => a.startMinutes - b.startMinutes);
  const bestMatch = matchingClasses[0];

  console.log(`[kiosk-check-in] Auto-matched class: ${bestMatch.name} (${bestMatch.start_time}) - ${matchingClasses.length} classes available`);
  return bestMatch;
}

/**
 * 같은 날 같은 수업에 이미 출석했는지 확인
 */
async function checkDuplicateAttendance(
  supabase: SupabaseClient,
  tenantId: string,
  studentId: string,
  classId: string,
  date: Date
): Promise<boolean> {
  // 오늘 날짜 범위 (KST 기준 00:00 ~ 23:59)
  const dateStr = date.toISOString().split('T')[0];
  const startOfDay = `${dateStr}T00:00:00+09:00`;
  const endOfDay = `${dateStr}T23:59:59+09:00`;

  const { data: existingLog, error } = await supabase
    .from('attendance_logs')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('student_id', studentId)
    .eq('class_id', classId)
    .eq('attendance_type', 'check_in')
    .gte('occurred_at', startOfDay)
    .lte('occurred_at', endOfDay)
    .limit(1);

  if (error) {
    console.error('[kiosk-check-in] Duplicate check error:', error);
    return false; // 에러 시 출석 허용 (fail-open)
  }

  return existingLog && existingLog.length > 0;
}

Deno.serve(async (req) => {
  // CORS 헤더 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. 요청 파싱
    const { tenant_id, student_phone, class_id }: KioskCheckInRequest = await req.json();

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

    // 3. Policy 확인: 키오스크 모드 활성화 여부
    const kioskEnabled = await getTenantSettingByPath(
      supabase,
      tenant_id,
      'kiosk.enabled'
    ) as boolean | null;

    if (kioskEnabled !== true) {
      return new Response(
        JSON.stringify({ error: '키오스크 모드가 비활성화되어 있습니다.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. 학생 조회 (휴대폰 번호로)
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, tenant_id, status')
      .eq('tenant_id', tenant_id)
      .eq('student_phone', normalizedPhone)
      .eq('status', 'active')
      .single();

    if (studentError || !student) {
      console.error('[kiosk-check-in] Student lookup failed:', studentError);
      return new Response(
        JSON.stringify({
          error: '등록되지 않은 휴대폰 번호입니다.',
          hint: '관리자에게 학생 휴대폰 번호 등록을 요청하세요.'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. 수업 자동 매칭 (class_id가 없는 경우)
    const now = new Date();
    const kstOffset = 9 * 60;
    const kstTime = new Date(now.getTime() + (kstOffset * 60 * 1000));

    let targetClassId = class_id || null;
    let matchedClassName: string | null = null;

    if (!targetClassId) {
      // 현재 시간 기준으로 가장 가까운 수업 자동 매칭
      const matchedClass = await findMatchingClass(supabase, tenant_id, student.id, kstTime);
      if (matchedClass) {
        targetClassId = matchedClass.id;
        matchedClassName = matchedClass.name;
      }
    }

    // 6. 중복 출석 방지
    if (targetClassId) {
      const isDuplicate = await checkDuplicateAttendance(
        supabase,
        tenant_id,
        student.id,
        targetClassId,
        kstTime
      );

      if (isDuplicate) {
        return new Response(
          JSON.stringify({
            success: false,
            error: '이미 출석이 완료되었습니다.',
            student: { id: student.id, name: student.name },
            message: `${student.name} 학생은 이미 해당 수업에 출석했습니다.`,
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 7. 지각 여부 판정 (수업 시작 10분 이후 출석 = 지각)
    let attendanceStatus: 'present' | 'late' = 'present';

    if (targetClassId && matchedClassName) {
      // 매칭된 수업 정보로 지각 판정
      const { data: classInfo } = await supabase
        .from('classes')
        .select('start_time')
        .eq('id', targetClassId)
        .single();

      if (classInfo) {
        const [startHour, startMinute] = classInfo.start_time.split(':').map(Number);
        const classStartMinutes = startHour * 60 + startMinute;
        const currentMinutes = kstTime.getHours() * 60 + kstTime.getMinutes();

        // 수업 시작 10분 이후 = 지각
        if (currentMinutes > classStartMinutes + 10) {
          attendanceStatus = 'late';
        }
      }
    }

    // 8. 출석 기록 생성
    const { data: attendanceLog, error: attendanceError } = await supabase
      .from('attendance_logs')
      .insert({
        tenant_id: tenant_id,
        student_id: student.id,
        class_id: targetClassId,
        occurred_at: kstTime.toISOString(),
        attendance_type: 'check_in',
        status: attendanceStatus,
        check_in_method: 'kiosk_phone',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (attendanceError) {
      console.error('[kiosk-check-in] Attendance log creation failed:', attendanceError);
      return new Response(
        JSON.stringify({ error: '출석 기록 생성에 실패했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 9. 보호자 자동 알림 발송 (Policy 기반)
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

        // 알림 채널 및 템플릿 조회
        const notificationChannel = await getTenantSettingByPath(
          supabase,
          tenant_id,
          'kiosk.notification_channel'
        ) as string || 'sms';

        const templateRaw = await getTenantSettingByPath(
          supabase,
          tenant_id,
          'kiosk.notification_template'
        ) as string || '${student_name} 학생이 ${time}에 출석했습니다.';

        // 템플릿 변수 치환
        const timeStr = kstTime.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const message = templateRaw
          .replace('${student_name}', student.name)
          .replace('${time}', timeStr);

        // 알림 발송 (dispatch-notification 호출)
        try {
          const notificationResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/dispatch-notification`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
              },
              body: JSON.stringify({
                tenant_id: tenant_id,
                recipient_id: guardian.id,
                recipient_type: 'guardian',
                channel: notificationChannel,
                message: message,
                metadata: {
                  student_id: student.id,
                  student_name: student.name,
                  attendance_log_id: attendanceLog.id,
                  check_in_time: kstTime.toISOString(),
                  check_in_method: 'kiosk_phone',
                },
              }),
            }
          );

          if (!notificationResponse.ok) {
            console.error('[kiosk-check-in] Notification dispatch failed:', await notificationResponse.text());
          } else {
            console.log(`[kiosk-check-in] Notification sent to guardian ${guardian.id}`);
          }
        } catch (notifyError) {
          // 알림 실패는 출석 체크 성공에 영향 없음 (로그만 기록)
          console.error('[kiosk-check-in] Notification error:', notifyError);
        }
      }
    }

    // 10. 성공 응답
    const statusMessage = attendanceStatus === 'late' ? ' (지각)' : '';
    const classMessage = matchedClassName ? ` [${matchedClassName}]` : '';

    return new Response(
      JSON.stringify({
        success: true,
        student: {
          id: student.id,
          name: student.name,
        },
        attendance: {
          id: attendanceLog.id,
          occurred_at: kstTime.toISOString(),
          check_in_method: 'kiosk_phone',
          status: attendanceStatus,
          class_id: targetClassId,
          class_name: matchedClassName,
        },
        message: `${student.name} 학생의 출석이 완료되었습니다.${classMessage}${statusMessage}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[kiosk-check-in] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: '서버 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
