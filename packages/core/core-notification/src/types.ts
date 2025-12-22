/**
 * Core Notification Types
 *
 * 메시지 알림 (SMS, 카카오 알림톡)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 * [SSOT-3] 저장/실행용 channel 코드는 'sms' | 'kakao_at'이며, UI 표시명(알림톡 등)은 별도 매핑한다.
 */

export type NotificationChannel = 'sms' | 'kakao_at';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'delivered';

export interface Notification {
  id: string;
  tenant_id: string;
  channel: NotificationChannel;
  recipient: string;  // 전화번호
  template_id?: string;
  content: string;
  status: NotificationStatus;
  sent_at?: string;
  error_message?: string;
  created_at: string;
}

export interface CreateNotificationInput {
  channel: NotificationChannel;
  recipient: string;
  template_id?: string;
  content: string;
}

export interface NotificationFilter {
  channel?: NotificationChannel;
  status?: NotificationStatus;
  date_from?: string;
  date_to?: string;
}

