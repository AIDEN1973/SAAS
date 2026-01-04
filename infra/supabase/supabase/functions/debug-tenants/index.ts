import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { envServer } from '../_shared/env-registry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY);

    // 1. 활성 테넌트 확인
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, status')
      .eq('status', 'active');

    if (tenantsError) {
      return new Response(JSON.stringify({ error: `테넌트 조회 실패: ${tenantsError.message}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const debug: Record<string, unknown> = {
      active_tenants: tenants?.length || 0,
      tenants: tenants || [],
    };

    // 2. 각 테넌트별 클래스 및 AI 설정 확인
    const tenantDetails: Record<string, unknown>[] = [];
    for (const tenant of (tenants || [])) {
      // AI 기능 활성화 여부
      const { data: aiFeature, error: aiError } = await supabase
        .from('tenant_features')
        .select('enabled')
        .eq('tenant_id', tenant.id)
        .eq('feature_key', 'ai')
        .single();

      // 활성 클래스 수
      const { data: classes, error: classError } = await supabase
        .from('academy_classes')
        .select('id, name')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active');

      tenantDetails.push({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        ai_feature: aiFeature,
        ai_error: aiError?.message || null,
        active_classes: classes?.length || 0,
        class_error: classError?.message || null,
      });
    }

    debug.tenant_details = tenantDetails;

    // 3. ai_insights 테이블의 CHECK 제약 조건 확인
    const { data: constraints, error: constraintError } = await supabase.rpc('exec_sql', {
      sql: `SELECT con.conname AS constraint_name, pg_get_constraintdef(con.oid) AS constraint_definition
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            WHERE rel.relname = 'ai_insights' AND con.contype = 'c'`
    });

    debug.ai_insights_constraints = constraints || [];
    debug.constraint_error = constraintError?.message || null;

    // 기존 insight_type 값들 확인
    const { data: existingTypes, error: typesError } = await supabase
      .from('ai_insights')
      .select('insight_type')
      .limit(100);

    const uniqueTypes = [...new Set((existingTypes || []).map((r: { insight_type: string }) => r.insight_type))];
    debug.existing_insight_types = uniqueTypes;
    debug.types_error = typesError?.message || null;

    return new Response(JSON.stringify(debug, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
