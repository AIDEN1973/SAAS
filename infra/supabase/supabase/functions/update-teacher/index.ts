/**
 * update-teacher Edge Function
 *
 * [불변 규칙] Zero-Trust: JWT에서 tenant_id 추출
 * [불변 규칙] persons, academy_teachers, auth.users 모두 업데이트
 *
 * 요청 본문:
 * - teacher_id: string (academy_teachers.id)
 * - name?: string
 * - phone?: string
 * - login_id?: string (이메일)
 * - password?: string
 * - employee_id?: string
 * - specialization?: string
 * - hire_date?: string
 * - status?: string
 * - position?: string
 * - profile_image_url?: string
 * - bio?: string
 * - notes?: string
 * - pay_type?: string
 * - base_salary?: number
 * - hourly_rate?: number
 * - bank_name?: string
 * - bank_account?: string
 * - salary_notes?: string
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

// CORS 헤더
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // JWT에서 tenant_id 추출
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // 사용자 세션 확인
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // JWT에서 tenant_id 추출
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    const tenantId = payload.tenant_id;

    if (!tenantId) {
      throw new Error('tenant_id not found in JWT');
    }

    // 요청 본문 파싱
    const body = await req.json();
    const {
      teacher_id,
      name,
      phone,
      login_id,
      password,
      employee_id,
      specialization,
      hire_date,
      status,
      position,
      profile_image_url,
      bio,
      notes,
      pay_type,
      base_salary,
      hourly_rate,
      bank_name,
      bank_account,
      salary_notes,
    } = body;

    if (!teacher_id) {
      throw new Error('teacher_id is required');
    }

    // Service role client 생성 (auth.users 수정 권한 필요)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 0. academy_teachers에서 person_id, user_id 조회 (teacher_id는 academy_teachers.id)
    const { data: teacherInfo, error: teacherInfoError } = await supabaseAdmin
      .from('academy_teachers')
      .select('id, person_id, user_id')
      .eq('id', teacher_id)
      .eq('tenant_id', tenantId)
      .single();

    if (teacherInfoError || !teacherInfo) {
      throw new Error(`Failed to fetch teacher info: ${teacherInfoError?.message || 'Teacher not found'}`);
    }

    const personId = teacherInfo.person_id;
    const userId = teacherInfo.user_id;

    // [최적화] 병렬 업데이트 준비
    const updatePromises: Promise<{ type: string; error?: Error }>[] = [];

    // 1. persons 테이블 업데이트 (name, phone)
    if (name || phone) {
      const personUpdate: Record<string, unknown> = {};
      if (name) personUpdate.name = name;
      if (phone) personUpdate.phone = phone;

      updatePromises.push(
        supabaseAdmin
          .from('persons')
          .update(personUpdate)
          .eq('id', personId)
          .eq('tenant_id', tenantId)
          .then(({ error }) => ({ type: 'person', error: error ? new Error(error.message) : undefined }))
      );
    }

    // 2. academy_teachers 테이블 업데이트
    const teacherUpdate: Record<string, unknown> = {};
    if (login_id) teacherUpdate.login_id = login_id;
    if (employee_id !== undefined) teacherUpdate.employee_id = employee_id;
    if (specialization !== undefined) teacherUpdate.specialization = specialization;
    if (hire_date !== undefined) teacherUpdate.hire_date = hire_date;
    if (status !== undefined) teacherUpdate.status = status;
    if (position !== undefined) teacherUpdate.position = position;
    if (profile_image_url !== undefined) teacherUpdate.profile_image_url = profile_image_url;
    if (bio !== undefined) teacherUpdate.bio = bio;
    if (notes !== undefined) teacherUpdate.notes = notes;
    if (pay_type !== undefined) teacherUpdate.pay_type = pay_type;
    if (base_salary !== undefined) teacherUpdate.base_salary = base_salary;
    if (hourly_rate !== undefined) teacherUpdate.hourly_rate = hourly_rate;
    if (bank_name !== undefined) teacherUpdate.bank_name = bank_name;
    if (bank_account !== undefined) teacherUpdate.bank_account = bank_account;
    if (salary_notes !== undefined) teacherUpdate.salary_notes = salary_notes;

    if (Object.keys(teacherUpdate).length > 0) {
      updatePromises.push(
        supabaseAdmin
          .from('academy_teachers')
          .update(teacherUpdate)
          .eq('id', teacher_id)
          .eq('tenant_id', tenantId)
          .then(({ error }) => ({ type: 'teacher', error: error ? new Error(error.message) : undefined }))
      );
    }

    // 3. auth.users 업데이트 (login_id, password)
    if (userId && (login_id || password)) {
      const authUpdate: Record<string, unknown> = {};
      if (login_id) authUpdate.email = login_id;
      if (password) authUpdate.password = password;

      updatePromises.push(
        supabaseAdmin.auth.admin.updateUserById(userId, authUpdate)
          .then(({ error }) => ({ type: 'auth', error: error ? new Error(error.message) : undefined }))
      );
    }

    // [최적화] 모든 업데이트를 병렬로 실행
    if (updatePromises.length > 0) {
      const results = await Promise.all(updatePromises);
      const failedResult = results.find(r => r.error);
      if (failedResult) {
        throw new Error(`Failed to update ${failedResult.type}: ${failedResult.error?.message}`);
      }
    }

    // 4. 업데이트된 강사 정보 조회
    const { data: updatedTeacher, error: fetchError } = await supabaseAdmin
      .from('academy_teachers')
      .select(`
        id,
        person_id,
        employee_id,
        specialization,
        hire_date,
        status,
        position,
        login_id,
        user_id,
        profile_image_url,
        bio,
        notes,
        pay_type,
        base_salary,
        hourly_rate,
        bank_name,
        bank_account,
        salary_notes,
        created_at,
        updated_at,
        created_by,
        updated_by,
        persons (
          id,
          name,
          phone,
          email,
          address
        )
      `)
      .eq('id', teacher_id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch updated teacher: ${fetchError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedTeacher,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
