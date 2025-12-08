/**
 * Core Config Types
 * 
 * ?경?정 (tenant_settings 기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존?? ?음
 */

export interface TenantConfig {
  attendance?: {
    late_after?: number;  // 지?기? (?
    absent_after?: number;  // 결석 기? (?
    auto_notification?: boolean;  // ?동 출결 ?림 발송
    notification_channel?: 'sms' | 'kakao';  // 기본 ?림 채널
  };
  billing?: {
    cycle?: 'monthly' | 'quarterly' | 'yearly';
  };
  ui?: {
    theme?: 'light' | 'dark';
    zoom?: number;  // 100 = 기본?
  };
  [key: string]: any;  // ?종??장 ?정
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

