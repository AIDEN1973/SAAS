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

    // 1. 기존 제약 조건 확인
    const { data: existingConstraints, error: checkError } = await supabase.rpc('check_constraint_exists', {
      constraint_name: 'ai_insights_insight_type_check',
      table_name: 'ai_insights'
    });

    // RPC가 없으면 직접 실행
    if (checkError) {
      // 기존 제약 조건 삭제 시도 (존재하지 않으면 무시)
      const dropResult = await supabase.from('ai_insights').delete().eq('id', 'non-existent-id-for-constraint-check');

      // 새로운 제약 조건을 추가하기 위해 먼저 기존 것을 삭제 시도
      // 직접 SQL 실행 불가능하므로, 테스트 insert로 확인

      // 테스트: performance_analysis 타입으로 insert 시도
      const testInsert = {
        tenant_id: '4b356e08-55ba-48a5-97af-35db55c872c0',
        insight_type: 'performance_analysis',
        title: 'Test Insight',
        summary: 'Test Summary',
        details: {},
        related_entity_type: 'class',
        related_entity_id: '557afcfe-f78d-46cc-a544-19f527315822',
        status: 'active',
      };

      const { data: testData, error: testError } = await supabase
        .from('ai_insights')
        .insert(testInsert)
        .select()
        .single();

      if (testError) {
        // 제약 조건 위반인 경우
        if (testError.message.includes('violates check constraint')) {
          return new Response(JSON.stringify({
            success: false,
            error: 'CHECK 제약 조건이 존재합니다. Supabase Dashboard에서 직접 SQL을 실행해주세요.',
            sql: `
-- 기존 제약 조건 삭제
ALTER TABLE public.ai_insights DROP CONSTRAINT IF EXISTS ai_insights_insight_type_check;

-- 새 제약 조건 추가
ALTER TABLE public.ai_insights
ADD CONSTRAINT ai_insights_insight_type_check
CHECK (insight_type IN (
  'daily_briefing',
  'weekly_briefing',
  'monthly_report',
  'consultation_summary',
  'daily_automation_digest',
  'regional_analytics',
  'regional_comparison',
  'risk_analysis',
  'performance_analysis',
  'attendance_anomaly',
  'proactive_recommendation',
  'meta_automation_pattern'
));
            `
          }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ error: testError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 테스트 성공 - 삽입된 레코드 삭제
      if (testData?.id) {
        await supabase.from('ai_insights').delete().eq('id', testData.id);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'performance_analysis 타입이 이미 허용됩니다.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, constraints: existingConstraints }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
