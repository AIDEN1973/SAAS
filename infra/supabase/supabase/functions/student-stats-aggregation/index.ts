/**
 * 학생 통계 집계 Edge Function
 *
 * [목적]
 * - 클라이언트에서 대량 데이터를 로딩하지 않고 서버에서 통계 집계
 * - 태그별 학생 수, 수업별 학생 수 등 집계 연산 수행
 *
 * [성능]
 * - DB 레벨에서 GROUP BY 연산 수행
 * - 최소한의 데이터만 클라이언트로 전송
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

// CORS 헤더 (인라인)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface TagStatsResult {
  tag_id: string;
  tag_name: string;
  tag_color: string;
  student_count: number;
}

interface ClassStatsResult {
  class_id: string;
  class_name: string;
  student_count: number;
}

interface StudentStatusStatsResult {
  status: string;
  count: number;
}

Deno.serve(async (req) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authorization 헤더에서 JWT 토큰 추출
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supabase 클라이언트 생성
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // 사용자 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // tenant_id 가져오기
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = userData.tenant_id;

    // Request body 파싱
    const { aggregationType, filters } = await req.json();

    let result;

    switch (aggregationType) {
      case 'tag_stats': {
        // 태그별 학생 수 집계
        result = await aggregateTagStats(supabase, tenantId, filters);
        break;
      }

      case 'class_stats': {
        // 수업별 학생 수 집계
        result = await aggregateClassStats(supabase, tenantId, filters);
        break;
      }

      case 'status_stats': {
        // 상태별 학생 수 집계
        result = await aggregateStatusStats(supabase, tenantId, filters);
        break;
      }

      case 'consultation_stats': {
        // 상담 유형별 통계 집계
        result = await aggregateConsultationStats(supabase, tenantId, filters);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid aggregation type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in student-stats-aggregation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * 태그별 학생 수 집계
 */
async function aggregateTagStats(
  supabase: any,
  tenantId: string,
  filters?: any
): Promise<TagStatsResult[]> {
  // RPC 함수 호출 (PostgreSQL에서 집계)
  const { data, error } = await supabase.rpc('aggregate_student_tag_stats', {
    p_tenant_id: tenantId,
  });

  if (error) {
    throw new Error(`Tag stats aggregation failed: ${error.message}`);
  }

  return data || [];
}

/**
 * 수업별 학생 수 집계
 */
async function aggregateClassStats(
  supabase: any,
  tenantId: string,
  filters?: any
): Promise<ClassStatsResult[]> {
  const { data, error } = await supabase.rpc('aggregate_student_class_stats', {
    p_tenant_id: tenantId,
    p_is_active: filters?.is_active !== false,
  });

  if (error) {
    throw new Error(`Class stats aggregation failed: ${error.message}`);
  }

  return data || [];
}

/**
 * 상태별 학생 수 집계
 */
async function aggregateStatusStats(
  supabase: any,
  tenantId: string,
  filters?: any
): Promise<StudentStatusStatsResult[]> {
  const { data, error } = await supabase.rpc('aggregate_student_status_stats', {
    p_tenant_id: tenantId,
    p_date_from: filters?.date_from,
    p_date_to: filters?.date_to,
  });

  if (error) {
    throw new Error(`Status stats aggregation failed: ${error.message}`);
  }

  return data || [];
}

/**
 * 상담 유형별 통계 집계
 */
async function aggregateConsultationStats(
  supabase: any,
  tenantId: string,
  filters?: any
): Promise<any> {
  const { data, error } = await supabase.rpc('aggregate_consultation_stats', {
    p_tenant_id: tenantId,
    p_date_from: filters?.date_from,
    p_date_to: filters?.date_to,
  });

  if (error) {
    throw new Error(`Consultation stats aggregation failed: ${error.message}`);
  }

  return data || [];
}
