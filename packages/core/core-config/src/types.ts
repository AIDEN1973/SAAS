/**
 * Core Config Types
 *
 * 환경 설정 (tenant_settings 기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 * [불변 규칙] Automation & AI Industry-Neutral Rule (SSOT) 준수
 * - Policy Key는 업종과 무관한 중립 키 사용
 * - 업종별 차이는 Label/UI 표현에서만 허용
 */

export interface TenantConfig {
  attendance?: {
    // ⚠️ 중요: attendance는 업종 중립 Policy Key (academy: 출결, salon: 방문 등)
    late_after?: number;  // 지연 기준 (분, 업종 중립)
    absent_after?: number;  // 미참석 기준 (분, 업종 중립: 결석 → 미참석)
    auto_notification?: boolean;  // 자동 알림 발송 (업종 중립)
    notification_channel?: 'sms' | 'kakao_at';  // 기본 알림 채널 (업종 중립, SSOT-3)
    qr_enabled?: boolean;  // QR 인증 활성화 (업종 중립: 출결 → 인증)
  };
  billing?: {
    cycle?: 'monthly' | 'quarterly' | 'yearly';
  };
  ui?: {
    theme?: 'light' | 'dark';
    zoom?: number;  // 100 = 기본?
  };
  [key: string]: unknown;  // ?종??장 ?정
}

export interface UpdateConfigInput {
  attendance?: {
    // ⚠️ 중요: attendance는 업종 중립 Policy Key
    late_after?: number;
    absent_after?: number;
    auto_notification?: boolean;
    notification_channel?: 'sms' | 'kakao_at';  // SSOT-3
    qr_enabled?: boolean;
  };
  billing?: {
    cycle?: 'monthly' | 'quarterly' | 'yearly';
  };
  ui?: {
    theme?: 'light' | 'dark';
    zoom?: number;
  };
  [key: string]: unknown;
}

