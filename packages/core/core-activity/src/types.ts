/**
 * Core Activity Types
 * 
 * Activity Feed / ??라???벤??기록
 * [불변 규칙] Core Layer는 Industry 모듈에 의존?? ?음
 */

export type ActivityType = 
  | 'person.created'
  | 'person.updated'
  | 'consultation.created'
  | 'invoice.created'
  | 'payment.completed'
  | 'attendance.checked'
  | 'event.created'
  | 'post.created'
  | 'review.created';

export interface Activity {
  id: string;
  tenant_id: string;
  activity_type: ActivityType;
  entity_type: string;  // 'person', 'consultation', 'invoice' ??
  entity_id: string;
  user_id?: string;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface CreateActivityInput {
  activity_type: ActivityType;
  entity_type: string;
  entity_id: string;
  user_id?: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface ActivityFilter {
  activity_type?: ActivityType;
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
}

