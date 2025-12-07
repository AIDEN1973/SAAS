/**
 * Core Analytics Types
 * 
 * ?µê³„ ?Œì´?„ë¼??(?´ë²¤??ê¸°ë°˜ ì§‘ê³„)
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
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
  event_date_kst?: string;  // date (KST ê¸°ì?)
}

export interface DailyMetrics {
  tenant_id: string;
  date: string;  // date (KST ê¸°ì?)
  total_revenue?: number;
  total_attendance?: number;
  no_show_count?: number;
  new_students?: number;
}

export interface MonthlyRevenue {
  tenant_id: string;
  year: number;
  month: number;  // KST ê¸°ì? ??
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

