/**
 * Core Metering Service
 * 
 * ?¬ìš©??ê³„ì¸¡ ?œë¹„??
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 * 
 * ? ï¸ ì£¼ì˜: Edge Function?ì„œ ?˜ì§‘?˜ì—¬ billing engine???¸ë³´?´ìŠ¤ ?ë™ ?ì„±.
 * ë°°ì¹˜ ?¤í–‰ ?œê°?€ ë§¤ì¼ 04:00 KST ê³ ì •.
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
   * ?¬ìš©??ê¸°ë¡
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
   * ?¬ìš©??ëª©ë¡ ì¡°íšŒ
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
   * ?¹ì • ê¸°ê°„???¬ìš©???©ê³„ ì¡°íšŒ
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

