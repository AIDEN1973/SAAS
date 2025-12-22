/**
 * Core Analytics Service
 *
 * 통계 대시보드 서비스
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 *
 * ⚠️ 중요: Analytics는 replica 기반 heavy query 실행
 * 실시간 이벤트는 이벤트 테이블에 저장하고, 배치로 집계하여 analytics.daily_store_metrics (정본)
 * ⚠️ 참고: analytics.daily_metrics, analytics.monthly_revenue는 구버전/폐기된 네이밍입니다.
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import { toKST } from '@lib/date-utils';
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

    // [불변 규칙] 파일명 생성 시 날짜 형식은 반드시 KST 기준을 사용합니다.
    const eventDateKst = toKST(occurredAt).format('YYYY-MM-DD');

    const { data, error } = await this.supabase
      .from('analytics.events')
      .insert({
        tenant_id: tenantId,
        user_id: input.user_id,
        // ⚠️ 참고: analytics.events.event_type은 자동화 카탈로그의 event_type과 다른 도메인 값입니다.
        // analytics.events.event_type은 시스템 이벤트 타입(예: 'attendance.check_in', 'payment_webhook')이며,
        // 자동화 카탈로그의 event_type은 자동화 시나리오 키(예: 'overdue_outstanding_over_limit', 'payment_due_reminder')입니다.
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
        .from('analytics.daily_store_metrics')  // 정본: daily_metrics는 구버전
        .select('*')
        .gte('date_kst', dateFrom)
        .lte('date_kst', dateTo)
        .order('date_kst', { ascending: true }),
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
    // 정본: monthly_revenue는 구버전, daily_store_metrics에서 파생
    // 월별 집계는 date_kst 기준으로 필터링하여 계산
    let query = withTenant(
      this.supabase
        .from('analytics.daily_store_metrics')  // 정본: monthly_revenue는 구버전
        .select('*')
        .gte('date_kst', `${year}-${month ? String(month).padStart(2, '0') : '01'}-01`)
        .lte('date_kst', `${year}-${month ? String(month).padStart(2, '0') : '12'}-31`),
      tenantId
    );

    query = query.order('date_kst', { ascending: true });

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
