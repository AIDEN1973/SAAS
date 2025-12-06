/**
 * Core Events Service
 * 
 * 이벤트/프로모션 관리 서비스
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  Event,
  EventParticipant,
  CreateEventInput,
  UpdateEventInput,
  EventFilter,
} from './types';

export class EventsService {
  private supabase = createServerClient();

  /**
   * 이벤트 목록 조회
   */
  async getEvents(
    tenantId: string,
    filter?: EventFilter
  ): Promise<Event[]> {
    let query = withTenant(
      this.supabase.from('events').select('*'),
      tenantId
    );

    if (filter?.event_type) {
      query = query.eq('event_type', filter.event_type);
    }

    if (filter?.is_active !== undefined) {
      query = query.eq('is_active', filter.is_active);
    }

    if (filter?.date_from) {
      query = query.gte('start_date', filter.date_from);
    }

    if (filter?.date_to) {
      query = query.lte('end_date', filter.date_to);
    }

    query = query.order('start_date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch events: ${error.message}`);
    }

    return (data || []) as Event[];
  }

  /**
   * 이벤트 상세 조회
   */
  async getEvent(tenantId: string, eventId: string): Promise<Event | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('events')
        .select('*')
        .eq('id', eventId),
      tenantId
    ).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch event: ${error.message}`);
    }

    return data as Event;
  }

  /**
   * 이벤트 생성
   */
  async createEvent(
    tenantId: string,
    input: CreateEventInput
  ): Promise<Event> {
    const { data, error } = await this.supabase
      .from('events')
      .insert({
        tenant_id: tenantId,
        title: input.title,
        description: input.description,
        event_type: input.event_type,
        start_date: input.start_date,
        end_date: input.end_date,
        is_active: input.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create event: ${error.message}`);
    }

    return data as Event;
  }

  /**
   * 이벤트 수정
   */
  async updateEvent(
    tenantId: string,
    eventId: string,
    input: UpdateEventInput
  ): Promise<Event> {
    const { data, error } = await withTenant(
      this.supabase
        .from('events')
        .update(input)
        .eq('id', eventId)
        .select(),
      tenantId
    ).single();

    if (error) {
      throw new Error(`Failed to update event: ${error.message}`);
    }

    return data as Event;
  }

  /**
   * 이벤트 삭제
   */
  async deleteEvent(tenantId: string, eventId: string): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('events')
        .delete()
        .eq('id', eventId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to delete event: ${error.message}`);
    }
  }

  /**
   * 이벤트 참여
   */
  async participateInEvent(
    tenantId: string,
    eventId: string,
    personId?: string
  ): Promise<EventParticipant> {
    const { data, error } = await this.supabase
      .from('event_participants')
      .insert({
        tenant_id: tenantId,
        event_id: eventId,
        person_id: personId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to participate in event: ${error.message}`);
    }

    return data as EventParticipant;
  }

  /**
   * 이벤트 참여자 목록 조회
   */
  async getEventParticipants(
    tenantId: string,
    eventId: string
  ): Promise<EventParticipant[]> {
    const { data, error } = await withTenant(
      this.supabase
        .from('event_participants')
        .select('*')
        .eq('event_id', eventId)
        .order('participated_at', { ascending: false }),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to fetch event participants: ${error.message}`);
    }

    return (data || []) as EventParticipant[];
  }
}

/**
 * Default Service Instance
 */
export const eventsService = new EventsService();

