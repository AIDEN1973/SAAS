/**
 * Daily Automation Digest Edge Function
 *
 * 아키텍처 문서 3.7.1 Phase 2 기능
 * 오늘 실행된 자동화 작업 일일 요약
 *
 * 분석 항목:
 * - 오늘 실행된 자동화 총 건수
 * - 성공/실패/부분 성공 건수
 * - 주요 실행 항목 요약
 * - 실패 건 상세 (있는 경우)
 * - 내일 예정된 자동화 미리보기
 *
 * [불변 규칙] Zero-Trust: tenant_id는 JWT에서 추출
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { envServer } from '../_shared/env-registry.ts';
import { toKSTDate, toKST } from '../_shared/date-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface DigestItem {
  operation_type: string;
  count: number;
  success: number;
  failed: number;
  partial: number;
}

interface FailedRunSummary {
  operation_type: string;
  error_summary: string;
  occurred_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = envServer.SUPABASE_URL;
    const supabaseServiceKey = envServer.SERVICE_ROLE_KEY;
    const openaiApiKey = envServer.OPENAI_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = toKSTDate();
    const todayStart = `${today}T00:00:00`;
    const todayEnd = `${today}T23:59:59`;

    // 모든 테넌트 조회
    const { data: tenants, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('status', 'active');

    if (tenantError) throw tenantError;
    if (!tenants || tenants.length === 0) {
      return new Response(JSON.stringify({ success: true, generated_count: 0, message: 'No active tenants' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalGenerated = 0;

    for (const tenant of tenants) {
      // 1. 오늘 실행된 자동화 조회
      const { data: todayRuns } = await supabase
        .from('execution_audit_runs')
        .select('id, operation_type, status, source, summary, error_summary, occurred_at, duration_ms')
        .eq('tenant_id', tenant.id)
        .gte('occurred_at', todayStart)
        .lte('occurred_at', todayEnd)
        .order('occurred_at', { ascending: false });

      if (!todayRuns || todayRuns.length === 0) {
        continue; // 오늘 실행된 것이 없으면 스킵
      }

      // 2. 통계 집계
      const totalCount = todayRuns.length;
      const successCount = todayRuns.filter(r => r.status === 'success').length;
      const failedCount = todayRuns.filter(r => r.status === 'failed').length;
      const partialCount = todayRuns.filter(r => r.status === 'partial').length;
      const successRate = Math.round((successCount / totalCount) * 100);

      // 3. 작업 유형별 집계
      const operationMap = new Map<string, DigestItem>();
      for (const run of todayRuns) {
        const opType = run.operation_type || 'unknown';
        if (!operationMap.has(opType)) {
          operationMap.set(opType, {
            operation_type: opType,
            count: 0,
            success: 0,
            failed: 0,
            partial: 0,
          });
        }
        const item = operationMap.get(opType)!;
        item.count++;
        if (run.status === 'success') item.success++;
        else if (run.status === 'failed') item.failed++;
        else if (run.status === 'partial') item.partial++;
      }

      const digestItems: DigestItem[] = Array.from(operationMap.values())
        .sort((a, b) => b.count - a.count);

      // 4. 실패 건 상세
      const failedRuns: FailedRunSummary[] = todayRuns
        .filter(r => r.status === 'failed')
        .slice(0, 5) // 최대 5건만
        .map(r => ({
          operation_type: r.operation_type || 'unknown',
          error_summary: r.error_summary || '오류 정보 없음',
          occurred_at: r.occurred_at,
        }));

      // 5. 소스별 통계
      const sourceStats = {
        ai: todayRuns.filter(r => r.source === 'ai').length,
        automation: todayRuns.filter(r => r.source === 'automation').length,
        scheduler: todayRuns.filter(r => r.source === 'scheduler').length,
        manual: todayRuns.filter(r => r.source === 'manual').length,
        webhook: todayRuns.filter(r => r.source === 'webhook').length,
      };

      // 6. 평균 실행 시간
      const durations = todayRuns.filter(r => r.duration_ms).map(r => r.duration_ms);
      const avgDuration = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

      // 7. AI 요약 생성
      let aiSummary = `오늘 ${totalCount}건의 자동화가 실행되었습니다. 성공률: ${successRate}%`;

      if (openaiApiKey) {
        try {
          const topOperations = digestItems.slice(0, 3).map(d =>
            `${d.operation_type}: ${d.count}건 (성공 ${d.success}, 실패 ${d.failed})`
          ).join(', ');

          const prompt = `다음 일일 자동화 실행 결과를 한국어로 2-3문장으로 간결하게 요약해주세요:
- 총 실행: ${totalCount}건
- 성공: ${successCount}건, 실패: ${failedCount}건, 부분 성공: ${partialCount}건
- 성공률: ${successRate}%
- 주요 작업: ${topOperations}
${failedRuns.length > 0 ? `- 실패 건: ${failedRuns.map(f => f.operation_type).join(', ')}` : ''}`;

          const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiApiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 200,
              temperature: 0.7,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            aiSummary = aiData.choices?.[0]?.message?.content || aiSummary;
          }
        } catch (e) {
          console.error('[Daily Automation Digest] AI summary failed:', e);
        }
      }

      // 8. DB 저장
      const { error: insertError } = await supabase.from('ai_insights').insert({
        tenant_id: tenant.id,
        insight_type: 'daily_automation_digest',
        title: `${toKST().format('MM월 DD일')} 자동화 실행 요약`,
        summary: aiSummary,
        details: {
          date: today,
          total_count: totalCount,
          success_count: successCount,
          failed_count: failedCount,
          partial_count: partialCount,
          success_rate: successRate,
          avg_duration_ms: avgDuration,
          digest_items: digestItems,
          failed_runs: failedRuns,
          source_stats: sourceStats,
        },
        status: 'active',
        metadata: {
          analysis_date: today,
          has_failures: failedCount > 0,
        },
      });

      if (insertError) {
        console.error(`[Daily Automation Digest] Insert error for tenant ${tenant.id}:`, insertError);
      } else {
        totalGenerated++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      generated_count: totalGenerated,
      date: today,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    console.error('[Daily Automation Digest] Fatal error:', errorMessage);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
