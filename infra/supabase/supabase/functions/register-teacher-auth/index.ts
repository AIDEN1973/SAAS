/**
 * 강사 가입 신청 승인 Edge Function
 *
 * [불변 규칙] 관리자 승인 시 실제 teacher + auth.users 계정 생성
 * [불변 규칙] SERVICE_ROLE_KEY 사용 (admin API 필요)
 *
 * 기능:
 * - teacher_registration_requests에서 신청 정보 조회
 * - persons + academy_teachers 생성
 * - auth.users 계정 생성
 * - user_tenant_roles에 역할 연결
 * - teacher_registration_requests 상태 업데이트
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Position -> TenantRole 매핑
const POSITION_TO_ROLE: Record<string, string> = {
  vice_principal: 'sub_admin',
  manager: 'manager',
  teacher: 'teacher',
  assistant: 'staff',
  other: 'staff',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // SERVICE_ROLE_KEY 필수 (admin API 사용)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { request_id, approved_by } = await req.json();

    if (!request_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'request_id가 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. 가입 신청 정보 조회
    const { data: request, error: requestError } = await supabaseAdmin
      .from('teacher_registration_requests')
      .select('*')
      .eq('id', request_id)
      .single();

    if (requestError || !request) {
      return new Response(
        JSON.stringify({ success: false, error: '가입 신청을 찾을 수 없습니다.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (request.status !== 'pending') {
      return new Response(
        JSON.stringify({ success: false, error: '이미 처리된 신청입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. 중복 검사 (최종 확인)
    const { data: existingTeacher } = await supabaseAdmin
      .from('academy_teachers')
      .select('id')
      .eq('tenant_id', request.tenant_id)
      .eq('login_id', request.login_id)
      .is('deleted_at', null)
      .single();

    if (existingTeacher) {
      return new Response(
        JSON.stringify({ success: false, error: '이미 등록된 아이디입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. persons 테이블에 생성 (persons에는 updated_by 컬럼 없음)
    const { data: person, error: personError } = await supabaseAdmin
      .from('persons')
      .insert({
        tenant_id: request.tenant_id,
        name: request.name,
        email: request.email,
        phone: request.phone,
        person_type: 'teacher',
        created_by: approved_by,
      })
      .select()
      .single();

    if (personError || !person) {
      return new Response(
        JSON.stringify({ success: false, error: `persons 생성 실패: ${personError?.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. auth.users 계정 생성
    // password_encoded는 base64 인코딩된 비밀번호
    let plainPassword: string;
    try {
      plainPassword = atob(request.password_encoded);
    } catch {
      // 디코딩 실패 시 에러 반환
      return new Response(
        JSON.stringify({ success: false, error: '비밀번호 복호화에 실패했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authEmail = request.email || request.login_id;

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: plainPassword,
      email_confirm: true,
      user_metadata: {
        name: request.name,
        login_id: request.login_id,
        tenant_id: request.tenant_id,
      },
    });

    if (authError) {
      // 롤백: persons 삭제
      await supabaseAdmin.from('persons').delete().eq('id', person.id);
      return new Response(
        JSON.stringify({ success: false, error: `계정 생성 실패: ${authError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authUser.user.id;

    // 5. academy_teachers 테이블에 생성
    const { data: teacher, error: teacherError } = await supabaseAdmin
      .from('academy_teachers')
      .insert({
        person_id: person.id,
        tenant_id: request.tenant_id,
        position: request.position,
        login_id: request.login_id,
        user_id: userId,
        status: 'active',
        created_by: approved_by,
        updated_by: approved_by,
      })
      .select()
      .single();

    if (teacherError || !teacher) {
      // 롤백
      await supabaseAdmin.auth.admin.deleteUser(userId);
      await supabaseAdmin.from('persons').delete().eq('id', person.id);
      return new Response(
        JSON.stringify({ success: false, error: `강사 생성 실패: ${teacherError?.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. user_tenant_roles에 역할 연결
    const role = POSITION_TO_ROLE[request.position] || 'teacher';

    const { error: roleError } = await supabaseAdmin
      .from('user_tenant_roles')
      .insert({
        user_id: userId,
        tenant_id: request.tenant_id,
        role: role,
      });

    if (roleError) {
      // 롤백
      await supabaseAdmin.from('academy_teachers').delete().eq('id', teacher.id);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      await supabaseAdmin.from('persons').delete().eq('id', person.id);
      return new Response(
        JSON.stringify({ success: false, error: `역할 연결 실패: ${roleError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. teacher_registration_requests 상태 업데이트
    await supabaseAdmin
      .from('teacher_registration_requests')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: approved_by,
        created_teacher_id: teacher.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', request_id);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          teacher_id: teacher.id,
          person_id: person.id,
          user_id: userId,
          login_id: request.login_id,
          email: authEmail,
          role: role,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('강사 계정 생성 오류:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
