/**
 * Core Events Types
 * 
 * ?´ë²¤???„ë¡œëª¨ì…˜ ê´€ë¦?
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 */

export interface Event {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  event_type: string;
  start_date: string;  // date
  end_date: string;  // date
  is_active: boolean;
  created_at: string;
}

export interface EventParticipant {
  id: string;
  tenant_id: string;
  event_id: string;
  person_id?: string;
  participated_at: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  event_type: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  event_type?: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
}

export interface EventFilter {
  event_type?: string;
  is_active?: boolean;
  date_from?: string;
  date_to?: string;
}

