/**
 * Meta Automation Pattern Edge Function
 *
 * 아키텍처 문서 3.7.1 Phase 2 기능
 * 자동화 실행 로그 분석을 통한 패턴/효율 인사이트 생성
 *
 * 분석 항목:
 * - 자동화 실행 성공/실패 패턴
 * - 시간대별 실행 분포
 * - 가장 많이 사용되는 자동화 유형
 * - 실패율 높은 자동화 식별
 * - 자동화 효율성 개선 제안
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

interface AutomationPattern {
  type: 'success_pattern' | 'failure_pattern' | 'time_distribution' | 'usage_trend' | 'efficiency_insight';
  title: string;
  description: string;
  metric_value?: number;
  metric_unit?: string;
  trend?: 'up' | 'down' | 'stable';
  recommendation?: string;
}

interface OperationTypeStats {
  operation_type: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  success_rate: number;
  avg_duration_ms: number;
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
    const sevenDaysAgo = toKST().subtract(7, 'day').format('YYYY-MM-DD');
    const thirtyDaysAgo = toKST().subtract(30, 'day').format('YYYY-MM-DD');

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
      const patterns: AutomationPattern[] = [];

      // 1. 최근 7일 자동화 실행 통계 조회
      const { data: recentRuns } = await supabase
        .from('execution_audit_runs')
        .select('id, operation_type, status, source, duration_ms, occurred_at')
        .eq('tenant_id', tenant.id)
        .gte('occurred_at', `${sevenDaysAgo}T00:00:00`);

      if (!recentRuns || recentRuns.length === 0) {
        continue; // 데이터 없으면 스킵
      }

      // 2. 전체 성공/실패 통계
      const totalRuns = recentRuns.length;
      const successRuns = recentRuns.filter(r => r.status === 'success').length;
      const failedRuns = recentRuns.filter(r => r.status === 'failed').length;
      const overallSuccessRate = Math.round((successRuns / totalRuns) * 100);

      patterns.push({
        type: 'success_pattern',
        title: '주간 자동화 성공률',
        description: `최근 7일간 ${totalRuns}건 실행, 성공률 ${overallSuccessRate}%`,
        metric_value: overallSuccessRate,
        metric_unit: '%',
        trend: overallSuccessRate >= 90 ? 'up' : overallSuccessRate >= 70 ? 'stable' : 'down',
        recommendation: overallSuccessRate < 90
          ? '실패율이 높습니다. 실패 원인을 분석하여 자동화 설정을 개선하세요.'
          : '자동화가 안정적으로 운영되고 있습니다.',
      });

      // 3. 작업 유형별 통계
      const operationStats = new Map<string, { success: number; failed: number; durations: number[] }>();
      for (const run of recentRuns) {
        const opType = run.operation_type || 'unknown';
        if (!operationStats.has(opType)) {
          operationStats.set(opType, { success: 0, failed: 0, durations: [] });
        }
        const stats = operationStats.get(opType)!;
        if (run.status === 'success') stats.success++;
        else if (run.status === 'failed') stats.failed++;
        if (run.duration_ms) stats.durations.push(run.duration_ms);
      }

      const operationTypeStats: OperationTypeStats[] = [];
      for (const [opType, stats] of operationStats) {
        const total = stats.success + stats.failed;
        const avgDuration = stats.durations.length > 0
          ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
          : 0;
        operationTypeStats.push({
          operation_type: opType,
          total_count: total,
          success_count: stats.success,
          failed_count: stats.failed,
          success_rate: Math.round((stats.success / total) * 100),
          avg_duration_ms: avgDuration,
        });
      }

      // 가장 많이 사용된 자동화
      const mostUsed = operationTypeStats.sort((a, b) => b.total_count - a.total_count)[0];
      if (mostUsed) {
        patterns.push({
          type: 'usage_trend',
          title: '가장 활발한 자동화',
          description: `'${mostUsed.operation_type}' 작업이 ${mostUsed.total_count}회로 가장 많이 실행되었습니다.`,
          metric_value: mostUsed.total_count,
          metric_unit: '회',
        });
      }

      // 실패율 높은 자동화 식별
      const highFailureOps = operationTypeStats.filter(op => op.success_rate < 80 && op.total_count >= 3);
      if (highFailureOps.length > 0) {
        const worstOp = highFailureOps.sort((a, b) => a.success_rate - b.success_rate)[0];
        patterns.push({
          type: 'failure_pattern',
          title: '실패율 높은 자동화 감지',
          description: `'${worstOp.operation_type}' 작업의 성공률이 ${worstOp.success_rate}%로 낮습니다.`,
          metric_value: worstOp.success_rate,
          metric_unit: '%',
          trend: 'down',
          recommendation: '해당 자동화의 설정을 점검하고, 실패 원인을 확인하세요.',
        });
      }

      // 4. 시간대별 분포 분석
      const hourDistribution = new Map<number, number>();
      for (const run of recentRuns) {
        const hour = new Date(run.occurred_at).getHours();
        hourDistribution.set(hour, (hourDistribution.get(hour) || 0) + 1);
      }

      let peakHour = 0;
      let peakCount = 0;
      for (const [hour, count] of hourDistribution) {
        if (count > peakCount) {
          peakHour = hour;
          peakCount = count;
        }
      }

      patterns.push({
        type: 'time_distribution',
        title: '피크 실행 시간대',
        description: `자동화가 ${peakHour}시에 가장 많이 실행됩니다 (${peakCount}건).`,
        metric_value: peakHour,
        metric_unit: '시',
      });

      // 5. 30일 전 대비 트렌드 비교
      const { data: previousRuns } = await supabase
        .from('execution_audit_runs')
        .select('id, status')
        .eq('tenant_id', tenant.id)
        .gte('occurred_at', `${thirtyDaysAgo}T00:00:00`)
        .lt('occurred_at', `${sevenDaysAgo}T00:00:00`);

      if (previousRuns && previousRuns.length > 0) {
        const prevSuccessRate = Math.round(
          (previousRuns.filter(r => r.status === 'success').length / previousRuns.length) * 100
        );
        const rateChange = overallSuccessRate - prevSuccessRate;

        patterns.push({
          type: 'efficiency_insight',
          title: '자동화 효율성 추이',
          description: rateChange >= 0
            ? `이전 대비 성공률이 ${Math.abs(rateChange)}%p 개선되었습니다.`
            : `이전 대비 성공률이 ${Math.abs(rateChange)}%p 하락했습니다.`,
          metric_value: rateChange,
          metric_unit: '%p',
          trend: rateChange > 0 ? 'up' : rateChange < 0 ? 'down' : 'stable',
          recommendation: rateChange < 0
            ? '성공률 하락 원인을 분석하고 자동화 설정을 재검토하세요.'
            : undefined,
        });
      }

      // AI 인사이트 생성
      let aiSummary = `${patterns.length}개의 자동화 패턴이 분석되었습니다. 주간 성공률: ${overallSuccessRate}%`;

      if (openaiApiKey && patterns.length > 0) {
        try {
          const prompt = `다음 자동화 패턴 분석 결과를 한국어로 3-4문장으로 요약해주세요. 핵심 인사이트와 개선 방향을 포함해주세요:
${patterns.map(p => `- ${p.title}: ${p.description}${p.recommendation ? ` (권장: ${p.recommendation})` : ''}`).join('\n')}`;

          const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiApiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 300,
              temperature: 0.7,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            aiSummary = aiData.choices?.[0]?.message?.content || aiSummary;
          }
        } catch (e) {
          console.error('[Meta Automation Pattern] AI summary failed:', e);
        }
      }

      // DB 저장
      const { error: insertError } = await supabase.from('ai_insights').insert({
        tenant_id: tenant.id,
        insight_type: 'meta_automation_pattern',
        title: '자동화 패턴 분석',
        summary: aiSummary,
        details: {
          patterns,
          operation_type_stats: operationTypeStats,
          overall_stats: {
            total_runs: totalRuns,
            success_runs: successRuns,
            failed_runs: failedRuns,
            success_rate: overallSuccessRate,
          },
          analysis_period: {
            start: sevenDaysAgo,
            end: today,
          },
        },
        status: 'active',
        metadata: {
          total_patterns: patterns.length,
          analysis_date: today,
        },
      });

      if (insertError) {
        console.error(`[Meta Automation Pattern] Insert error for tenant ${tenant.id}:`, insertError);
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
    console.error('[Meta Automation Pattern] Fatal error:', errorMessage);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
