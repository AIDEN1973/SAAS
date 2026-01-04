/**
 * Core Notification Types
 *
 * 메시지 알림 (알림톡 기본, SMS 폴백)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 * [불변 규칙] 채널 선택 제거됨 - 알림톡 기본, SMS는 폴백으로만 작동
 * [SSOT-3] 저장용 channel 코드는 발송 결과에 따라 'sms' | 'kakao_at' | 'alimtalk'
 */

/** 저장용 채널 타입 (발송 결과에 따라 설정됨) */
export type NotificationChannel = 'sms' | 'kakao_at' | 'alimtalk';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'delivered';

export interface Notification {
  id: string;
  tenant_id: string;
  /** 채널 (발송 결과에 따라 설정됨, 옵셔널) */
  channel?: NotificationChannel;
  recipient: string;  // 전화번호
  template_id?: string;
  content: string;
  status: NotificationStatus;
  sent_at?: string;
  error_message?: string;
  created_at: string;
}

/** [불변 규칙] 채널 선택 제거됨 - 입력에서 채널 필드 제거 */
export interface CreateNotificationInput {
  recipient: string;
  template_id?: string;
  content: string;
}

export interface NotificationFilter {
  status?: NotificationStatus;
  date_from?: string;
  date_to?: string;
}

