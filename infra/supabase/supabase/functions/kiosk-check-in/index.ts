/**
 * 키오스크 출석 체크 Edge Function
 *
 * [목적] 태블릿 단말기에서 학생 본인 휴대폰 번호 입력으로 출석 체크
 * [인증] 공개 API (인증 불필요, IP/Rate Limiting으로 보안)
 * [Zero-Management] 출석 완료 시 보호자에게 자동 알림 발송
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';

interface KioskCheckInRequest {
  tenant_id: string;
  student_phone: string;
  class_id?: string; // 선택적: 특정 수업 출석 체크
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

    // 5. 출석 기록 생성
    const now = new Date();
    const kstOffset = 9 * 60;
    const kstTime = new Date(now.getTime() + (kstOffset * 60 * 1000));

    const { data: attendanceLog, error: attendanceError } = await supabase
      .from('attendance_logs')
      .insert({
        tenant_id: tenant_id,
        student_id: student.id,
        class_id: class_id || null,
        occurred_at: kstTime.toISOString(),
        status: 'present',
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

    // 6. 보호자 자동 알림 발송 (Policy 기반)
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

    // 7. 성공 응답
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
        },
        message: `${student.name} 학생의 출석이 완료되었습니다.`,
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
