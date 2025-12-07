/**
 * Core Notification Types
 * 
 * ë©”ì‹œì§??Œë¦¼ (SMS, ì¹´ì¹´???Œë¦¼?? ?´ë©”?? ??Push)
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 */

export type NotificationChannel = 'sms' | 'kakao' | 'email' | 'push';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'delivered';

export interface Notification {
  id: string;
  tenant_id: string;
  channel: NotificationChannel;
  recipient: string;  // ?„í™”ë²ˆí˜¸, ?´ë©”????
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

