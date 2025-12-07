/**
 * Core Config Types
 * 
 * 환경설정 (tenant_settings 기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

export interface TenantConfig {
  attendance?: {
    late_after?: number;  // 지각 기준 (분)
    absent_after?: number;  // 결석 기준 (분)
    auto_notification?: boolean;  // 자동 출결 알림 발송
    notification_channel?: 'sms' | 'kakao';  // 기본 알림 채널
  };
  billing?: {
    cycle?: 'monthly' | 'quarterly' | 'yearly';
  };
  ui?: {
    theme?: 'light' | 'dark';
    zoom?: number;  // 100 = 기본값
  };
  [key: string]: any;  // 업종별 확장 설정
}

export interface UpdateConfigInput {
  attendance?: {
    late_after?: number;
    absent_after?: number;
    auto_notification?: boolean;
    notification_channel?: 'sms' | 'kakao';
  };
  billing?: {
    cycle?: 'monthly' | 'quarterly' | 'yearly';
  };
  ui?: {
    theme?: 'light' | 'dark';
    zoom?: number;
  };
  [key: string]: any;
}

