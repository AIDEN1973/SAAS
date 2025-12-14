/**
 * Core Analytics Service
 *
 * 통계 대시보드 서비스
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 *
 * ⚠️ 중요: Analytics는 replica 기반 heavy query 실행
 * 실시간 이벤트는 이벤트 테이블에 저장하고, 배치로 집계하여 daily_metrics / monthly_revenue
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
   * 이벤트 기록
   */
  async recordEvent(
    tenantId: string,
    input: RecordEventInput
  ): Promise<AnalyticsEvent> {
    // KST 기준 날짜 계산 (UTC에서 KST)
    const occurredAt = input.occurred_at
      ? new Date(input.occurred_at)
      : new Date();

    // KST = UTC + 9시간
    const kstDate = new Date(occurredAt.getTime() + 9 * 60 * 60 * 1000);
    const eventDateKst = kstDate.toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('analytics.events')
      .insert({
        tenant_id: tenantId,
        user_id: input.user_id,
        event_type: input.event_type,
        // 기술문서 19-1-1: 타임스탬프는 UTC로 저장 (DB 저장 규칙)
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
   * 일별 메트릭 조회
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
   * 월별 매출 조회
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
