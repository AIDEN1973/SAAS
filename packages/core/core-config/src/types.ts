/**
 * Core Config Types
 * 
 * ?˜ê²½?¤ì • (tenant_settings ê¸°ë°˜)
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 */

export interface TenantConfig {
  attendance?: {
    late_after?: number;  // ì§€ê°?ê¸°ì? (ë¶?
    absent_after?: number;  // ê²°ì„ ê¸°ì? (ë¶?
    auto_notification?: boolean;  // ?ë™ ì¶œê²° ?Œë¦¼ ë°œì†¡
    notification_channel?: 'sms' | 'kakao';  // ê¸°ë³¸ ?Œë¦¼ ì±„ë„
  };
  billing?: {
    cycle?: 'monthly' | 'quarterly' | 'yearly';
  };
  ui?: {
    theme?: 'light' | 'dark';
    zoom?: number;  // 100 = ê¸°ë³¸ê°?
  };
  [key: string]: any;  // ?…ì¢…ë³??•ì¥ ?¤ì •
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

