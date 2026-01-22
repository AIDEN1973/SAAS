/**
 * 강사 직접 등록 Edge Function
 *
 * [불변 규칙] 관리자가 직접 강사를 등록 (auth.users + persons + academy_teachers)
 * [불변 규칙] SERVICE_ROLE_KEY 사용 (admin API 필요)
 *
 * 기능:
 * - auth.users 계정 생성
 * - persons 생성
 * - academy_teachers 생성
 * - user_tenant_roles에 역할 연결
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

interface CreateTeacherRequest {
  name: string;
  phone: string;
  position: string;
  login_id: string;
  password: string;
  email?: string;
  specialization?: string;
  hire_date?: string;
  employee_id?: string;
  profile_image_url?: string;
  bio?: string;
  notes?: string;
  pay_type?: string;
  base_salary?: number;
  hourly_rate?: number;
  bank_name?: string;
  bank_account?: string;
  salary_notes?: string;
}

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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: '인증이 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 현재 사용자 확인
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: '사용자 인증에 실패했습니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // JWT에서 tenant_id 추출 (app_metadata 또는 JWT payload에서)
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    const tenantId = payload.tenant_id || user.app_metadata?.tenant_id;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id를 확인할 수 없습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const input: CreateTeacherRequest = await req.json();

    // 입력 검증
    if (!input.name || !input.phone || !input.position || !input.login_id || !input.password) {
      return new Response(
        JSON.stringify({ success: false, error: '필수 항목을 입력해주세요.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (input.password.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: '비밀번호는 8자 이상이어야 합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 중복 검사: login_id
    const { data: existingTeacher } = await supabaseAdmin
      .from('academy_teachers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('login_id', input.login_id)
      .is('deleted_at', null)
      .single();

    if (existingTeacher) {
      return new Response(
        JSON.stringify({ success: false, error: '이미 사용 중인 아이디입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. persons 생성과 auth.users 생성을 병렬로 실행
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isLoginIdEmail = emailRegex.test(input.login_id);
    const tenantHash = tenantId.replace(/-/g, '').slice(0, 8);
    const authEmail = input.email || (isLoginIdEmail ? input.login_id : `${input.login_id}@t${tenantHash}.local`);

    const [personResult, authResult] = await Promise.all([
      // persons 테이블 생성
      supabaseAdmin
        .from('persons')
        .insert({
          tenant_id: tenantId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          person_type: 'teacher',
          created_by: user.id,
        })
        .select()
        .single(),
      // auth.users 계정 생성
      supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          name: input.name,
          login_id: input.login_id,
          tenant_id: tenantId,
        },
        app_metadata: {
          tenant_id: tenantId,
        },
      }),
    ]);

    const { data: person, error: personError } = personResult;
    const { data: authUser, error: authError } = authResult;

    // 에러 처리 및 롤백
    if (personError || authError) {
      // 부분 성공 시 롤백
      if (person && !personError) {
        await supabaseAdmin.from('persons').delete().eq('id', person.id);
      }
      if (authUser?.user && !authError) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      }
      const errorMsg = personError?.message || authError?.message || '알 수 없는 오류';
      return new Response(
        JSON.stringify({ success: false, error: `생성 실패: ${errorMsg}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authUser.user.id;
    const role = POSITION_TO_ROLE[input.position] || 'teacher';

    // 2. academy_teachers와 user_tenant_roles를 병렬로 생성
    const [teacherResult, roleResult] = await Promise.all([
      // academy_teachers 테이블 생성
      supabaseAdmin
        .from('academy_teachers')
        .insert({
          person_id: person.id,
          tenant_id: tenantId,
          position: input.position,
          login_id: input.login_id,
          user_id: userId,
          employee_id: input.employee_id,
          specialization: input.specialization,
          hire_date: input.hire_date,
          status: 'active',
          profile_image_url: input.profile_image_url,
          bio: input.bio,
          notes: input.notes,
          pay_type: input.pay_type,
          base_salary: input.base_salary,
          hourly_rate: input.hourly_rate,
          bank_name: input.bank_name,
          bank_account: input.bank_account,
          salary_notes: input.salary_notes,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single(),
      // user_tenant_roles에 역할 연결
      supabaseAdmin
        .from('user_tenant_roles')
        .insert({
          user_id: userId,
          tenant_id: tenantId,
          role: role,
        }),
    ]);

    const { data: teacher, error: teacherError } = teacherResult;
    const { error: roleError } = roleResult;

    // 에러 처리 및 롤백
    if (teacherError || roleError) {
      // 롤백 (병렬 실행)
      await Promise.all([
        teacher ? supabaseAdmin.from('academy_teachers').delete().eq('id', teacher.id) : Promise.resolve(),
        supabaseAdmin.auth.admin.deleteUser(userId),
        supabaseAdmin.from('persons').delete().eq('id', person.id),
        !roleError ? supabaseAdmin.from('user_tenant_roles').delete().eq('user_id', userId).eq('tenant_id', tenantId) : Promise.resolve(),
      ]);
      const errorMsg = teacherError?.message || roleError?.message || '알 수 없는 오류';
      return new Response(
        JSON.stringify({ success: false, error: `강사 생성 실패: ${errorMsg}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          teacher_id: teacher.id,
          person_id: person.id,
          user_id: userId,
          login_id: input.login_id,
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
