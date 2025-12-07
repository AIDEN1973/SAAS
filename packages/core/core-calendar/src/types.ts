/**
 * Core Calendar Types
 * 
 * ?¼ì •/?ˆì•½/?˜ì—… ?¤ì?ì¤?ê³µí†µ ?„ë©”??
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 */

export type RepeatPattern = 'daily' | 'weekly' | 'monthly' | 'none';

export interface Schedule {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  start_time: string;  // timestamptz
  end_time: string;  // timestamptz
  repeat_pattern?: RepeatPattern;
  capacity?: number;
  assigned_to?: string;  // auth.users(id)
  created_at: string;
  updated_at: string;
}

export interface CreateScheduleInput {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  repeat_pattern?: RepeatPattern;
  capacity?: number;
  assigned_to?: string;
}

export interface UpdateScheduleInput {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  repeat_pattern?: RepeatPattern;
  capacity?: number;
  assigned_to?: string;
}

export interface ScheduleFilter {
  assigned_to?: string;
  date_from?: string;
  date_to?: string;
  repeat_pattern?: RepeatPattern;
}

