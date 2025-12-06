/**
 * Core Calendar Service
 * 
 * 일정/예약/수업 스케줄 서비스
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
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
   * 스케줄 목록 조회
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
   * 스케줄 상세 조회
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
   * 스케줄 생성
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
   * 스케줄 수정
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
   * 스케줄 삭제
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

