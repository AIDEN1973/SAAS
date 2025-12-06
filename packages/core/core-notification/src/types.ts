/**
 * Core Notification Types
 * 
 * 메시징/알림 (SMS, 카카오 알림톡, 이메일, 앱 Push)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

export type NotificationChannel = 'sms' | 'kakao' | 'email' | 'push';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'delivered';

export interface Notification {
  id: string;
  tenant_id: string;
  channel: NotificationChannel;
  recipient: string;  // 전화번호, 이메일 등
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

