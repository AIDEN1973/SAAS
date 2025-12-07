/**
 * Core Analytics Service
 * 
 * ?µê³„ ?Œì´?„ë¼???œë¹„??
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 * 
 * ? ï¸ ì¤‘ìš”: Analytics??replica ê¸°ë°˜ heavy query ?¤í–‰
 * ?ì‹œ ?´ë²¤???Œì´ë¸????¸ë? ?°í???ì§‘ê³„ ??daily_metrics / monthly_revenue
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  AnalyticsEvent,
  DailyMetrics,
  MonthlyRevenue,
  RecordEventInput,
} from './types';

export class AnalyticsService {
  private supabase = createServerClient();

  /**
   * ?´ë²¤??ê¸°ë¡
   */
  async recordEvent(
    tenantId: string,
    input: RecordEventInput
  ): Promise<AnalyticsEvent> {
    // KST ê¸°ì? ?¼ì ê³„ì‚° (UTC ??KST)
    const occurredAt = input.occurred_at 
      ? new Date(input.occurred_at)
      : new Date();
    
    // KST = UTC + 9?œê°„
    const kstDate = new Date(occurredAt.getTime() + 9 * 60 * 60 * 1000);
    const eventDateKst = kstDate.toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('analytics.events')
      .insert({
        tenant_id: tenantId,
        user_id: input.user_id,
        event_type: input.event_type,
        occurred_at: input.occurred_at || new Date().toISOString(),
        payload: input.payload,
        store_id: input.store_id,
        region_id: input.region_id,
        industry_type: input.industry_type,
        event_date_kst: eventDateKst,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record event: ${error.message}`);
    }

    return data as AnalyticsEvent;
  }

  /**
   * ?¼ë³„ ë©”íŠ¸ë¦?ì¡°íšŒ
   */
  async getDailyMetrics(
    tenantId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<DailyMetrics[]> {
    const { data, error } = await withTenant(
      this.supabase
        .from('analytics.daily_metrics')
        .select('*')
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: true }),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to fetch daily metrics: ${error.message}`);
    }

    return (data || []) as DailyMetrics[];
  }

  /**
   * ?”ë³„ ë§¤ì¶œ ì¡°íšŒ
   */
  async getMonthlyRevenue(
    tenantId: string,
    year: number,
    month?: number
  ): Promise<MonthlyRevenue[]> {
    let query = withTenant(
      this.supabase
        .from('analytics.monthly_revenue')
        .select('*')
        .eq('year', year),
      tenantId
    );

    if (month) {
      query = query.eq('month', month);
    }

    query = query.order('month', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch monthly revenue: ${error.message}`);
    }

    return (data || []) as MonthlyRevenue[];
  }
}

/**
 * Default Service Instance
 */
export const analyticsService = new AnalyticsService();

