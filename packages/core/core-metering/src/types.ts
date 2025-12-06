/**
 * Core Metering Types
 * 
 * 사용량 계측 (출결 건수, 문자발송 수, 활성 모듈 수, 사용자 수 등)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

export type MetricType = 'attendance_count' | 'sms_count' | 'active_modules' | 'user_count';

export interface UsageMetric {
  id: string;
  tenant_id: string;
  metric_type: MetricType;
  value: number;
  recorded_at: string;  // timestamptz
  created_at: string;
}

export interface RecordUsageInput {
  metric_type: MetricType;
  value: number;
  recorded_at?: string;
}

export interface UsageMetricFilter {
  metric_type?: MetricType;
  date_from?: string;
  date_to?: string;
}

