/**
 * Core Calendar Service
 * 
 * ?¼ì •/?ˆì•½/?˜ì—… ?¤ì?ì¤??œë¹„??
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  Schedule,
  CreateScheduleInput,
  UpdateScheduleInput,
  ScheduleFilter,
} from './types';

export class CalendarService {
  private supabase = createServerClient();

  /**
   * ?¤ì?ì¤?ëª©ë¡ ì¡°íšŒ
   */
  async getSchedules(
    tenantId: string,
    filter?: ScheduleFilter
  ): Promise<Schedule[]> {
    let query = withTenant(
      this.supabase.from('schedules').select('*'),
      tenantId
    );

    if (filter?.assigned_to) {
      query = query.eq('assigned_to', filter.assigned_to);
    }

    if (filter?.date_from) {
      query = query.gte('start_time', filter.date_from);
    }

    if (filter?.date_to) {
      query = query.lte('end_time', filter.date_to);
    }

    if (filter?.repeat_pattern) {
      query = query.eq('repeat_pattern', filter.repeat_pattern);
    }

    query = query.order('start_time', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch schedules: ${error.message}`);
    }

    return (data || []) as Schedule[];
  }

  /**
   * ?¤ì?ì¤??ì„¸ ì¡°íšŒ
   */
  async getSchedule(
    tenantId: string,
    scheduleId: string
  ): Promise<Schedule | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('schedules')
        .select('*')
        .eq('id', scheduleId),
      tenantId
    ).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch schedule: ${error.message}`);
    }

    return data as Schedule;
  }

  /**
   * ?¤ì?ì¤??ì„±
   */
  async createSchedule(
    tenantId: string,
    input: CreateScheduleInput
  ): Promise<Schedule> {
    const { data, error } = await this.supabase
      .from('schedules')
      .insert({
        tenant_id: tenantId,
        title: input.title,
        description: input.description,
        start_time: input.start_time,
        end_time: input.end_time,
        repeat_pattern: input.repeat_pattern || 'none',
        capacity: input.capacity,
        assigned_to: input.assigned_to,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create schedule: ${error.message}`);
    }

    return data as Schedule;
  }

  /**
   * ?¤ì?ì¤??˜ì •
   */
  async updateSchedule(
    tenantId: string,
    scheduleId: string,
    input: UpdateScheduleInput
  ): Promise<Schedule> {
    const { data, error } = await withTenant(
      this.supabase
        .from('schedules')
        .update(input)
        .eq('id', scheduleId)
        .select(),
      tenantId
    ).single();

    if (error) {
      throw new Error(`Failed to update schedule: ${error.message}`);
    }

    return data as Schedule;
  }

  /**
   * ?¤ì?ì¤??? œ
   */
  async deleteSchedule(
    tenantId: string,
    scheduleId: string
  ): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to delete schedule: ${error.message}`);
    }
  }
}

/**
 * Default Service Instance
 */
export const calendarService = new CalendarService();

