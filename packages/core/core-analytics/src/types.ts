/**
 * Core Analytics Types
 *
 * ?계 ?이?라??(?벤??기반 집계)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존?? ?음
 */

export interface AnalyticsEvent {
  id: string;
  tenant_id: string;
  user_id?: string;
  event_type: string;
  occurred_at: string;  // timestamptz (UTC)
  payload?: Record<string, unknown>;
  store_id?: string;
  region_id?: string;
  industry_type?: string;
  event_date_kst?: string;  // date (KST 기?)
}

export interface DailyMetrics {
  tenant_id: string;
  date: string;  // date (KST 기?)
  total_revenue?: number;
  total_presence?: number;  // 업종 중립 정본 키 (academy: 출결, salon: 방문 등)
  total_attendance?: number;  // backward compatibility (deprecated, use total_presence)
  no_show_count?: number;
  new_active_persons?: number;  // 업종 중립: academy는 new_students로, salon은 new_customers로 해석
}

export interface MonthlyRevenue {
  tenant_id: string;
  year: number;
  month: number;  // KST 기? ??
  revenue: number;
}

export interface RecordEventInput {
  event_type: string;
  user_id?: string;
  payload?: Record<string, unknown>;
  store_id?: string;
  region_id?: string;
  industry_type?: string;
  occurred_at?: string;
}

