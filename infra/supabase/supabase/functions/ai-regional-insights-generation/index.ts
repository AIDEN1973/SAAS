/**
 * AI 지역 인사이트 자동 생성 Edge Function
 *
 * 아키텍처 문서 3.6 섹션 참조
 * 스케줄: 매일 07:30 KST (ai-briefing-generation 이후)
 *
 * [불변 규칙] Zero-Management: 사용자 개입 없이 자동 실행
 * [요구사항]
 * 1. AnalyticsPage의 AI 인사이트 생성 로직 재사용
 * 2. 모든 활성 테넌트에 대해 지역 통계 인사이트 생성
 * 3. ai_insights 테이블에 저장
 * 4. 중복 방지: 같은 날짜에 이미 생성된 인사이트는 스킵
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { shouldUseAI, getTenantSettingByPath } from '../_shared/policy-utils.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';
import { toKSTDate, toKST, toKSTMonth } from '../_shared/date-utils.ts';
import { logError, createErrorLogEntry } from '../_shared/error-tracking.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Percentile Rank 계산을 위한 상수 (AnalyticsPage 참조)
const PERCENTILE_FALLBACK_RATIOS = {
  P25_FACTOR: 0.75,
  P75_FACTOR: 1.25,
  TOP10_FACTOR_STUDENTS: 1.2,
  TOP10_FACTOR_REVENUE: 1.2,
  TOP10_FACTOR_ATTENDANCE: 1.1,
  TOP10_FACTOR_GROWTH: 1.15,
  ATTENDANCE_AVG_FALLBACK: 0.95,
  GROWTH_AVG_FALLBACK: 0.9,
} as const;

interface RegionMetric {
  store_count?: number;
  active_members_avg?: string | number;
  active_members_median?: string | number;
  active_members_p25?: string | number;
  active_members_p75?: string | number;
  revenue_avg?: string | number;
  revenue_median?: string | number;
  revenue_p25?: string | number;
  revenue_p75?: string | number;
  avg_attendance_rate?: string | number;
  attendance_rate_p25?: string | number;
  attendance_rate_p75?: string | number;
  student_growth_rate_avg?: string | number;
  student_growth_rate_p25?: string | number;
  student_growth_rate_p75?: string | number;
  revenue_growth_rate_avg?: string | number;
  revenue_growth_rate_p25?: string | number;
  revenue_growth_rate_p75?: string | number;
}

interface LocationInfo {
  region: string;
  si: string;
  gu: string;
  dong: string;
  location_code: string;
  sigungu_code: string;
  sido_code: string;
}

interface AIInsightData {
  tenant_id: string;
  student_id: null;
  insight_type: string;
  title: string;
  summary: string;
  details: Record<string, any>;
  related_entity_type: string;
  related_entity_id: string | null;
  status: string;
}

serve(async (req) => {
  // CORS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY);

    // 기술문서 19-1-2: KST 기준 날짜 처리
    const kstTime = toKST();
    const today = toKSTDate();

    console.log(`[AI Regional Insights] Starting generation for ${today}`);

    // 모든 활성 테넌트 조회
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('status', 'active');

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    if (!tenants || tenants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active tenants', generated_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalGenerated = 0;

    for (const tenant of tenants) {
      try {
        // AI 기능 활성화 여부 확인
        if (!(await shouldUseAI(supabase, tenant.id))) {
          console.log(`[AI Regional Insights] AI disabled for tenant ${tenant.id}, skipping`);
          continue;
        }

        // 중복 방지: 오늘 이미 생성된 regional_analytics 인사이트가 있는지 확인
        const { data: existingInsights, error: checkError } = await supabase
          .from('ai_insights')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('insight_type', 'regional_analytics')
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`)
          .limit(1);

        if (checkError) {
          console.error(`[AI Regional Insights] Failed to check existing insights for ${tenant.id}:`, checkError);
          continue;
        }

        if (existingInsights && existingInsights.length > 0) {
          console.log(`[AI Regional Insights] Regional analytics insight already exists for ${tenant.id} on ${today}, skipping`);
          continue;
        }

        // 테넌트 설정에서 위치 정보 조회
        const { data: config } = await withTenant(
          supabase
            .from('tenant_settings')
            .select('value')
            .eq('key', 'config')
            .single(),
          tenant.id
        );

        if (!config || !config.value) {
          console.log(`[AI Regional Insights] No location config for tenant ${tenant.id}, skipping`);
          continue;
        }

        const locationConfig = config.value as any;
        const location = locationConfig.location || {};
        const industryType = locationConfig.industry_type || 'academy';

        const locationInfo: LocationInfo = {
          region: location.gu || location.dong || location.si || '지역 미설정',
          si: location.si || '',
          gu: location.gu || '',
          dong: location.dong || '',
          location_code: location.location_code || '',
          sigungu_code: location.sigungu_code || '',
          sido_code: location.sido_code || '',
        };

        // 지역 정보가 없으면 스킵
        if (!locationInfo.location_code) {
          console.log(`[AI Regional Insights] No location code for tenant ${tenant.id}, skipping`);
          continue;
        }

        // AnalyticsPage 로직을 재사용하여 지역 통계 인사이트 생성
        const insights = await generateRegionalInsights(
          supabase,
          tenant.id,
          locationInfo,
          industryType,
          today
        );

        if (insights && insights.length > 0) {
          // ai_insights 테이블에 저장
          const { error: insertError } = await supabase
            .from('ai_insights')
            .insert(insights);

          if (!insertError) {
            totalGenerated += insights.length;
            console.log(`[AI Regional Insights] Generated ${insights.length} insights for tenant ${tenant.id}`);
          } else {
            console.error(`[AI Regional Insights] Failed to insert for tenant ${tenant.id}:`, insertError);
          }
        }

      } catch (error) {
        console.error(`[AI Regional Insights] Error processing tenant ${tenant.id}:`, error);
        // P0-2: Error Tracking 추가
        await logError(supabase, createErrorLogEntry(
          error,
          'ai-regional-insights-generation',
          tenant.id,
          { phase: 'tenant_processing', tenant_name: tenant.name }
        ));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated_count: totalGenerated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI Regional Insights] Fatal error:', error);

    // P0-2: Error Tracking 추가 (Fatal Error)
    await logError(supabase, createErrorLogEntry(
      error,
      'ai-regional-insights-generation',
      undefined,
      { phase: 'fatal', is_cron_job: true },
      'critical'
    ));

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * AnalyticsPage의 지역 통계 인사이트 생성 로직 재구현
 * 아키텍처 문서 3.6.2~3.6.3 참조
 */
async function generateRegionalInsights(
  supabase: any,
  tenantId: string,
  locationInfo: LocationInfo,
  industryType: string,
  today: string
): Promise<AIInsightData[]> {
  const insights: AIInsightData[] = [];
  const metrics = ['students', 'revenue', 'attendance', 'growth'] as const;

  for (const metric of metrics) {
    try {
      const insight = await generateMetricInsight(
        supabase,
        tenantId,
        locationInfo,
        industryType,
        metric,
        today
      );

      if (insight) {
        insights.push(insight);
      }
    } catch (error) {
      console.error(`[AI Regional Insights] Error generating insight for metric ${metric}:`, error);
    }
  }

  return insights;
}

/**
 * 특정 메트릭에 대한 지역 인사이트 생성
 */
async function generateMetricInsight(
  supabase: any,
  tenantId: string,
  locationInfo: LocationInfo,
  industryType: string,
  metric: 'students' | 'revenue' | 'attendance' | 'growth',
  today: string
): Promise<AIInsightData | null> {
  const minimumSampleSize = 3;

  // 1. 우리 학원의 지표 값 계산
  let value = 0;

  if (metric === 'students') {
    // 정본 규칙: persons 테이블에서 학생 수 조회
    const { data: students } = await withTenant(
      supabase
        .from('persons')
        .select('id')
        .eq('person_type', 'student'),
      tenantId
    );
    value = students?.length || 0;
  } else if (metric === 'revenue') {
    // 현재 달 매출 조회
    const currentMonth = toKSTMonth();
    const { data: invoices } = await withTenant(
      supabase
        .from('invoices')
        .select('amount_paid')
        .gte('period_start', `${currentMonth}-01`),
      tenantId
    );
    value = invoices?.reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0) || 0;
  } else if (metric === 'attendance') {
    // 현재 달 출석률 계산
    const currentMonth = toKSTMonth();
    const { data: logs } = await withTenant(
      supabase
        .from('attendance_logs')
        .select('status')
        .gte('occurred_at', `${currentMonth}-01T00:00:00`),
      tenantId
    );
    if (logs && logs.length > 0) {
      const presentCount = logs.filter((log: any) => log.status === 'present').length;
      value = Math.round((presentCount / logs.length) * 100);
    }
  } else if (metric === 'growth') {
    // 성장률 계산 (현재 월 vs 전월)
    const kstTime = toKST();
    const currentDate = new Date(kstTime);

    // 현재 월의 마지막 날
    const currentYear = currentDate.getUTCFullYear();
    const currentMonthNum = currentDate.getUTCMonth() + 1;
    const lastDayOfCurrentMonth = new Date(Date.UTC(currentYear, currentMonthNum, 0, 23, 59, 59, 999));
    const currentMonthEnd = lastDayOfCurrentMonth.toISOString().slice(0, 19);

    // 전월의 마지막 날
    const lastYear = currentMonthNum === 1 ? currentYear - 1 : currentYear;
    const lastMonthNum = currentMonthNum === 1 ? 12 : currentMonthNum - 1;
    const lastDayOfLastMonth = new Date(Date.UTC(lastYear, lastMonthNum, 0, 23, 59, 59, 999));
    const lastMonthEnd = lastDayOfLastMonth.toISOString().slice(0, 19);

    const { data: currentStudents } = await withTenant(
      supabase
        .from('persons')
        .select('id')
        .eq('person_type', 'student')
        .lte('created_at', currentMonthEnd),
      tenantId
    );

    const { data: lastStudents } = await withTenant(
      supabase
        .from('persons')
        .select('id')
        .eq('person_type', 'student')
        .lte('created_at', lastMonthEnd),
      tenantId
    );

    const currentCount = currentStudents?.length || 0;
    const lastCount = lastStudents?.length || 0;

    value = lastCount > 0
      ? Math.round(((currentCount - lastCount) / lastCount) * 100)
      : 0;
  }

  // 2. 지역 비교 그룹 결정 (동 → 구 → 시도 → 권역 fallback)
  let average = 0;
  let top10Percent = 0;
  let percentile = 50;
  let rank = 0;
  let comparisonGroup: 'same_dong' | 'same_sigungu' | 'same_sido' | 'same_region_zone' | 'insufficient' = 'insufficient';
  let sampleCount = 0;
  let usedFallback = false;
  let fallbackLevel: 'same_sigungu' | 'same_sido' | 'same_region_zone' | null = null;

  let dongMetrics: RegionMetric[] = [];
  let sigunguMetrics: RegionMetric[] = [];
  let sidoMetrics: RegionMetric[] = [];
  let regionZoneMetrics: RegionMetric[] = [];

  // 1순위: 같은 행정동(location_code)
  if (locationInfo.location_code) {
    try {
      const { data: metrics } = await supabase
        .from('analytics.daily_region_metrics')
        .select('*')
        .eq('industry_type', industryType)
        .eq('region_level', 'dong')
        .eq('region_code', locationInfo.location_code)
        .lte('date_kst', today)
        .order('date_kst', { ascending: false })
        .limit(1);

      dongMetrics = metrics || [];
    } catch (error) {
      console.warn(`[AI Regional Insights] Error fetching dong metrics:`, error);
    }

    if (dongMetrics.length > 0 && (dongMetrics[0] as any).store_count && (dongMetrics[0] as any).store_count >= minimumSampleSize) {
      comparisonGroup = 'same_dong';
      sampleCount = (dongMetrics[0] as any).store_count;
      usedFallback = false;
      average = getMetricValue(dongMetrics[0], metric, 'avg', 0);
      top10Percent = getMetricValue(dongMetrics[0], metric, 'p75', average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_STUDENTS);
      percentile = calculatePercentile(value, dongMetrics[0], metric, average);
      rank = calculateRank(percentile, sampleCount);
    } else {
      // 2순위: 같은 구(sigungu_code)
      if (locationInfo.sigungu_code) {
        try {
          const { data: metrics } = await supabase
            .from('analytics.daily_region_metrics')
            .select('*')
            .eq('industry_type', industryType)
            .eq('region_level', 'gu_gun')
            .eq('region_code', locationInfo.sigungu_code)
            .lte('date_kst', today)
            .order('date_kst', { ascending: false })
            .limit(1);

          sigunguMetrics = metrics || [];
        } catch (error) {
          console.warn(`[AI Regional Insights] Error fetching sigungu metrics:`, error);
        }

        if (sigunguMetrics.length > 0 && (sigunguMetrics[0] as any).store_count && (sigunguMetrics[0] as any).store_count >= minimumSampleSize) {
          comparisonGroup = 'same_sigungu';
          sampleCount = (sigunguMetrics[0] as any).store_count;
          usedFallback = true;
          fallbackLevel = 'same_sigungu';
          average = getMetricValue(sigunguMetrics[0], metric, 'avg', 0);
          top10Percent = getMetricValue(sigunguMetrics[0], metric, 'p75', average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_STUDENTS);
          percentile = calculatePercentile(value, sigunguMetrics[0], metric, average);
          rank = calculateRank(percentile, sampleCount);
        } else {
          // 3순위: 같은 시도(sido_code)
          if (locationInfo.sido_code) {
            try {
              const { data: metrics } = await supabase
                .from('analytics.daily_region_metrics')
                .select('*')
                .eq('industry_type', industryType)
                .eq('region_level', 'si')
                .eq('region_code', locationInfo.sido_code)
                .lte('date_kst', today)
                .order('date_kst', { ascending: false })
                .limit(1);

              sidoMetrics = metrics || [];
            } catch (error) {
              console.warn(`[AI Regional Insights] Error fetching sido metrics:`, error);
            }

            if (sidoMetrics.length > 0 && (sidoMetrics[0] as any).store_count && (sidoMetrics[0] as any).store_count >= minimumSampleSize) {
              comparisonGroup = 'same_sido';
              sampleCount = (sidoMetrics[0] as any).store_count;
              usedFallback = true;
              fallbackLevel = 'same_sido';
              average = getMetricValue(sidoMetrics[0], metric, 'avg', 0);
              top10Percent = getMetricValue(sidoMetrics[0], metric, 'p75', average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_STUDENTS);
              percentile = calculatePercentile(value, sidoMetrics[0], metric, average);
              rank = calculateRank(percentile, sampleCount);
            }
          }
        }
      }
    }
  }

  // 3. 비교 불가능한 경우 (샘플 수 부족)
  if (comparisonGroup === 'insufficient' || sampleCount < minimumSampleSize) {
    return null;
  }

  // 4. AI 인사이트 생성
  const metricLabels: Record<string, string> = {
    students: '학생 수',
    revenue: '매출',
    attendance: '출석률',
    growth: '성장률',
  };

  const comparisonGroupLabels: Record<string, string> = {
    same_dong: '동',
    same_sigungu: '구',
    same_sido: '시도',
    same_region_zone: '권역',
    insufficient: '',
  };

  const trend = value > average ? `+${Math.round(((value - average) / average) * 100)}%` : `${Math.round(((value - average) / average) * 100)}%`;

  const summaryLines: string[] = [];

  if (usedFallback && fallbackLevel) {
    const fallbackLabel = comparisonGroupLabels[fallbackLevel] || '';
    const comparisonResult = value > average ? '우수합니다' : '부족합니다';
    const comparisonPercent = Math.abs(Math.round(((value - average) / average) * 100));
    summaryLines.push(
      `동에서는 비교 불가했지만, ${fallbackLabel} 기준으로 평균 대비 ${value > average ? '+' : ''}${comparisonPercent}% ${comparisonResult}.`
    );
  } else {
    const isImproving = value > average;
    summaryLines.push(
      `${metricLabels[metric] || metric}는 지역 평균 대비 ${trend} ${isImproving ? '우수합니다' : '부족합니다'}.`
    );
  }

  summaryLines.push(
    `${locationInfo.region}에서 ${metricLabels[metric] || metric} 상위 ${percentile}%입니다.`
  );

  const summary = summaryLines.join(' ');

  return {
    tenant_id: tenantId,
    student_id: null,
    insight_type: 'regional_analytics',
    title: `${locationInfo.region} 지역 ${metricLabels[metric] || metric} 분석`,
    summary: summary,
    details: {
      metric: metric,
      value: value,
      average: average,
      percentile: percentile,
      rank: rank,
      comparison_group: comparisonGroup,
      sample_count: sampleCount,
      top10_percent: top10Percent,
      trend: trend,
    },
    related_entity_type: 'regional_analytics',
    related_entity_id: locationInfo.location_code || null,
    status: 'active',
  };
}

/**
 * 메트릭에서 특정 값 추출 (평균, p25, p75 등)
 */
function getMetricValue(
  metrics: RegionMetric,
  metric: string,
  type: 'avg' | 'p25' | 'p75',
  fallback: number
): number {
  const keyMap: Record<string, Record<string, string>> = {
    students: {
      avg: 'active_members_avg',
      p25: 'active_members_p25',
      p75: 'active_members_p75',
    },
    revenue: {
      avg: 'revenue_avg',
      p25: 'revenue_p25',
      p75: 'revenue_p75',
    },
    attendance: {
      avg: 'avg_attendance_rate',
      p25: 'attendance_rate_p25',
      p75: 'attendance_rate_p75',
    },
    growth: {
      avg: 'student_growth_rate_avg',
      p25: 'student_growth_rate_p25',
      p75: 'student_growth_rate_p75',
    },
  };

  const key = keyMap[metric]?.[type];
  if (!key) return fallback;

  const value = (metrics as any)[key];
  return value ? Math.round(Number(value)) : fallback;
}

/**
 * Percentile 계산 (AnalyticsPage 로직 참조)
 */
function calculatePercentile(
  value: number,
  metrics: RegionMetric,
  metric: string,
  average: number
): number {
  const p25 = getMetricValue(metrics, metric, 'p25', average * PERCENTILE_FALLBACK_RATIOS.P25_FACTOR);
  const p75 = getMetricValue(metrics, metric, 'p75', average * PERCENTILE_FALLBACK_RATIOS.P75_FACTOR);
  const median = average;

  let percentile = 50;

  if (value >= p75) {
    const range = p75 - median;
    if (range > 0) {
      const excess = value - p75;
      percentile = 75 + Math.min(25, Math.round((excess / (range + 1)) * 25));
    } else {
      percentile = 75;
    }
  } else if (value >= median) {
    const range = p75 - median;
    if (range > 0) {
      percentile = 50 + Math.round(((value - median) / range) * 25);
    } else {
      percentile = 50;
    }
  } else if (value >= p25) {
    const range = median - p25;
    if (range > 0) {
      percentile = 25 + Math.round(((value - p25) / range) * 25);
    } else {
      percentile = 25;
    }
  } else {
    if (p25 > 0) {
      percentile = Math.max(1, Math.round((value / p25) * 25));
    } else {
      percentile = 1;
    }
  }

  return Math.max(1, Math.min(99, percentile));
}

/**
 * Rank 계산
 */
function calculateRank(percentile: number, sampleCount: number): number {
  const number_of_values_below = Math.round((100 - percentile) / 100 * sampleCount);
  return Math.max(1, number_of_values_below + 1);
}
