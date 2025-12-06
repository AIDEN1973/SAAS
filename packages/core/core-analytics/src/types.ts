/**
 * Core Analytics Types
 * 
 * 통계 파이프라인 (이벤트 기반 집계)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

export interface AnalyticsEvent {
  id: string;
  tenant_id: string;
  user_id?: string;
  event_type: string;
  occurred_at: string;  // timestamptz (UTC)
  payload?: Record<string, any>;
  store_id?: string;
  region_id?: string;
  industry_type?: string;
  event_date_kst?: string;  // date (KST 기준)
}

export interface DailyMetrics {
  tenant_id: string;
  date: string;  // date (KST 기준)
  total_revenue?: number;
  total_attendance?: number;
  no_show_count?: number;
  new_students?: number;
}

export interface MonthlyRevenue {
  tenant_id: string;
  year: number;
  month: number;  // KST 기준 월
  revenue: number;
}

export interface RecordEventInput {
  event_type: string;
  user_id?: string;
  payload?: Record<string, any>;
  store_id?: string;
  region_id?: string;
  industry_type?: string;
  occurred_at?: string;
}

