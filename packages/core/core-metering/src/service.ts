/**
 * Core Metering Service
 *
 * 사용량 계측 서비스
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 *
 * ⚠️ 주의: Edge Function에서 집계하여 billing engine으로 전송합니다.
 * 배치 실행 예정: 매일 04:00 KST 고정.
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  UsageMetric,
  RecordUsageInput,
  UsageMetricFilter,
  MetricType,
} from './types';

export class MeteringService {
  private supabase = createServerClient();

  /**
   * 사용량 기록
   */
  async recordUsage(
    tenantId: string,
    input: RecordUsageInput
  ): Promise<UsageMetric> {
    const { data, error } = await this.supabase
      .from('usage_metrics')
      .insert({
        tenant_id: tenantId,
        metric_type: input.metric_type,
        value: input.value,
        recorded_at: input.recorded_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record usage: ${error.message}`);
    }

    return data as UsageMetric;
  }

  /**
   * 사용량 목록 조회
   */
  async getUsageMetrics(
    tenantId: string,
    filter?: UsageMetricFilter
  ): Promise<UsageMetric[]> {
    let query = withTenant(
      this.supabase.from('usage_metrics').select('*'),
      tenantId
    );

    if (filter?.metric_type) {
      query = query.eq('metric_type', filter.metric_type);
    }

    if (filter?.date_from) {
      query = query.gte('recorded_at', filter.date_from);
    }

    if (filter?.date_to) {
      query = query.lte('recorded_at', filter.date_to);
    }

    query = query.order('recorded_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch usage metrics: ${error.message}`);
    }

    return (data || []) as UsageMetric[];
  }

  /**
   * 특정 기간의 사용량 합계 조회
   */
  async getUsageSum(
    tenantId: string,
    metricType: MetricType,
    dateFrom: string,
    dateTo: string
  ): Promise<number> {
    const { data, error } = await withTenant(
      this.supabase
        .from('usage_metrics')
        .select('value')
        .eq('metric_type', metricType)
        .gte('recorded_at', dateFrom)
        .lte('recorded_at', dateTo),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to calculate usage sum: ${error.message}`);
    }

    return (data || []).reduce((sum, item) => sum + (item.value || 0), 0);
  }
}

/**
 * Default Service Instance
 */
export const meteringService = new MeteringService();
