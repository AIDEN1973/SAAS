/**
 * EventsService Unit Tests
 *
 * 이벤트 CRUD + 참여자 관리 검증
 * [SECURITY] withTenant 적용 여부, INSERT tenant_id 포함 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@lib/supabase-client/server', () => ({
  createServerClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

import { EventsService } from '../service';

const TENANT_ID = 'test-tenant-id';

function createChainMock(resolvedData: unknown = [], resolvedError: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'is', 'gte', 'lte', 'gt', 'lt', 'order', 'limit', 'range', 'ilike', 'or', 'not', 'contains', 'filter', 'textSearch', 'maybeSingle', 'csv', 'match', 'like', 'upsert'];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => ({ data: resolvedData, error: resolvedError }));
  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: unknown) => void) => {
      resolve({ data: resolvedData, error: resolvedError });
    },
  });
  return chain;
}

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(() => {
    service = new EventsService();
    vi.clearAllMocks();
  });

  // ─── getEvents ──────────────────────────────────────────────

  describe('getEvents', () => {
    it('성공: from(events).select 호출 후 start_date descending 정렬', async () => {
      const events = [
        { id: 'e1', title: '이벤트1', start_date: '2026-03-10' },
        { id: 'e2', title: '이벤트2', start_date: '2026-03-05' },
      ];
      const chain = createChainMock(events);
      mockFrom.mockReturnValue(chain);

      const result = await service.getEvents(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('events');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.order).toHaveBeenCalledWith('start_date', { ascending: false });
      expect(result).toEqual(events);
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'DB connection failed' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getEvents(TENANT_ID)).rejects.toThrow(
        'Failed to fetch events: DB connection failed'
      );
    });
  });

  // ─── getEvent ───────────────────────────────────────────────

  describe('getEvent', () => {
    it('성공: 단건 조회 반환', async () => {
      const event = { id: 'e1', title: '이벤트1', is_active: true };
      const chain = createChainMock(event);
      mockFrom.mockReturnValue(chain);

      const result = await service.getEvent(TENANT_ID, 'e1');

      expect(mockFrom).toHaveBeenCalledWith('events');
      expect(chain.eq).toHaveBeenCalledWith('id', 'e1');
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(event);
    });

    it('PGRST116 에러 시 null 반환', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'not found' });
      mockFrom.mockReturnValue(chain);

      const result = await service.getEvent(TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { code: 'OTHER', message: 'unexpected error' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getEvent(TENANT_ID, 'e1')).rejects.toThrow(
        'Failed to fetch event: unexpected error'
      );
    });
  });

  // ─── createEvent ────────────────────────────────────────────

  describe('createEvent', () => {
    it('성공: tenant_id 포함, is_active 기본값 true', async () => {
      const created = { id: 'e-new', title: '새 이벤트', is_active: true };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      const result = await service.createEvent(TENANT_ID, {
        title: '새 이벤트',
        description: '설명',
        event_type: 'promotion',
        start_date: '2026-03-10',
        end_date: '2026-03-20',
      } as never);

      expect(mockFrom).toHaveBeenCalledWith('events');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          title: '새 이벤트',
          is_active: true,
        })
      );
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(created);
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'insert failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.createEvent(TENANT_ID, {
          title: '새 이벤트',
          event_type: 'promotion',
          start_date: '2026-03-10',
          end_date: '2026-03-20',
        } as never)
      ).rejects.toThrow('Failed to create event: insert failed');
    });
  });

  // ─── updateEvent ────────────────────────────────────────────

  describe('updateEvent', () => {
    it('성공: update + eq + select + single 호출', async () => {
      const updated = { id: 'e1', title: '수정된 이벤트' };
      const chain = createChainMock(updated);
      mockFrom.mockReturnValue(chain);

      const result = await service.updateEvent(TENANT_ID, 'e1', { title: '수정된 이벤트' });

      expect(mockFrom).toHaveBeenCalledWith('events');
      expect(chain.update).toHaveBeenCalledWith({ title: '수정된 이벤트' });
      expect(chain.eq).toHaveBeenCalledWith('id', 'e1');
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'update failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.updateEvent(TENANT_ID, 'e1', { title: '수정' })
      ).rejects.toThrow('Failed to update event: update failed');
    });
  });

  // ─── deleteEvent ────────────────────────────────────────────

  describe('deleteEvent', () => {
    it('성공: delete + eq 호출', async () => {
      const chain = createChainMock(null, null);
      mockFrom.mockReturnValue(chain);

      await service.deleteEvent(TENANT_ID, 'e1');

      expect(mockFrom).toHaveBeenCalledWith('events');
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'e1');
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'delete failed' });
      mockFrom.mockReturnValue(chain);

      await expect(service.deleteEvent(TENANT_ID, 'e1')).rejects.toThrow(
        'Failed to delete event: delete failed'
      );
    });
  });

  // ─── participateInEvent ─────────────────────────────────────

  describe('participateInEvent', () => {
    it('성공: event_participants에 tenant_id 포함 insert', async () => {
      const participant = { event_id: 'e1', person_id: 'p1', tenant_id: TENANT_ID };
      const chain = createChainMock(participant);
      mockFrom.mockReturnValue(chain);

      const result = await service.participateInEvent(TENANT_ID, 'e1', 'p1');

      expect(mockFrom).toHaveBeenCalledWith('event_participants');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          event_id: 'e1',
          person_id: 'p1',
        })
      );
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(participant);
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'participate failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.participateInEvent(TENANT_ID, 'e1', 'p1')
      ).rejects.toThrow('Failed to participate in event: participate failed');
    });
  });

  // ─── getEventParticipants ───────────────────────────────────

  describe('getEventParticipants', () => {
    it('성공: event_participants 조회 후 participated_at descending 정렬', async () => {
      const participants = [
        { event_id: 'e1', person_id: 'p1', participated_at: '2026-03-06T10:00:00' },
        { event_id: 'e1', person_id: 'p2', participated_at: '2026-03-06T09:00:00' },
      ];
      const chain = createChainMock(participants);
      mockFrom.mockReturnValue(chain);

      const result = await service.getEventParticipants(TENANT_ID, 'e1');

      expect(mockFrom).toHaveBeenCalledWith('event_participants');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.eq).toHaveBeenCalledWith('event_id', 'e1');
      expect(chain.order).toHaveBeenCalledWith('participated_at', { ascending: false });
      expect(result).toEqual(participants);
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'fetch participants failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.getEventParticipants(TENANT_ID, 'e1')
      ).rejects.toThrow('Failed to fetch event participants: fetch participants failed');
    });
  });
});
