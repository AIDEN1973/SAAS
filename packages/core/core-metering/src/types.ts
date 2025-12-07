/**
 * Core Metering Types
 * 
 * ?�용??계측 (출결 건수, 문자발송 ?? ?�성 모듈 ?? ?�용??????
 * [불�? 규칙] Core Layer??Industry 모듈???�존?��? ?�음
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

