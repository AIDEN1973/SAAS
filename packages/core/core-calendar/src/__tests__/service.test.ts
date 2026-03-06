/**
 * CalendarService Unit Tests
 *
 * 일정 CRUD 검증
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

import { CalendarService } from '../service';

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

describe('CalendarService', () => {
  let service: CalendarService;

  beforeEach(() => {
    service = new CalendarService();
    vi.clearAllMocks();
  });

  // ─── getSchedules ───────────────────────────────────────────

  describe('getSchedules', () => {
    it('성공: from(schedules).select 호출 후 start_time ascending 정렬', async () => {
      const schedules = [
        { id: 's1', title: '수업', start_time: '2026-03-06T09:00:00' },
        { id: 's2', title: '회의', start_time: '2026-03-06T14:00:00' },
      ];
      const chain = createChainMock(schedules);
      mockFrom.mockReturnValue(chain);

      const result = await service.getSchedules(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('schedules');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.order).toHaveBeenCalledWith('start_time', { ascending: true });
      expect(result).toEqual(schedules);
    });

    it('필터 적용: assigned_to, date_from, date_to, repeat_pattern', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await service.getSchedules(TENANT_ID, {
        assigned_to: 'user-1',
        date_from: '2026-03-01',
        date_to: '2026-03-31',
        repeat_pattern: 'weekly',
      });

      expect(chain.eq).toHaveBeenCalledWith('assigned_to', 'user-1');
      expect(chain.gte).toHaveBeenCalledWith('start_time', '2026-03-01');
      expect(chain.lte).toHaveBeenCalledWith('end_time', '2026-03-31');
      expect(chain.eq).toHaveBeenCalledWith('repeat_pattern', 'weekly');
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'DB connection failed' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getSchedules(TENANT_ID)).rejects.toThrow(
        'Failed to fetch schedules: DB connection failed'
      );
    });
  });

  // ─── getSchedule ────────────────────────────────────────────

  describe('getSchedule', () => {
    it('성공: 단건 조회 반환', async () => {
      const schedule = { id: 's1', title: '수업', start_time: '2026-03-06T09:00:00' };
      const chain = createChainMock(schedule);
      mockFrom.mockReturnValue(chain);

      const result = await service.getSchedule(TENANT_ID, 's1');

      expect(mockFrom).toHaveBeenCalledWith('schedules');
      expect(chain.eq).toHaveBeenCalledWith('id', 's1');
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(schedule);
    });

    it('PGRST116 에러 시 null 반환', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'not found' });
      mockFrom.mockReturnValue(chain);

      const result = await service.getSchedule(TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { code: 'OTHER', message: 'unexpected error' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getSchedule(TENANT_ID, 's1')).rejects.toThrow(
        'Failed to fetch schedule: unexpected error'
      );
    });
  });

  // ─── createSchedule ─────────────────────────────────────────

  describe('createSchedule', () => {
    it('성공: tenant_id 포함, repeat_pattern 기본값 none', async () => {
      const created = { id: 's-new', title: '새 일정', repeat_pattern: 'none' };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      const result = await service.createSchedule(TENANT_ID, {
        title: '새 일정',
        start_time: '2026-03-06T09:00:00',
        end_time: '2026-03-06T10:00:00',
      } as never);

      expect(mockFrom).toHaveBeenCalledWith('schedules');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          title: '새 일정',
          repeat_pattern: 'none',
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
        service.createSchedule(TENANT_ID, {
          title: '새 일정',
          start_time: '2026-03-06T09:00:00',
          end_time: '2026-03-06T10:00:00',
        } as never)
      ).rejects.toThrow('Failed to create schedule: insert failed');
    });
  });

  // ─── updateSchedule ─────────────────────────────────────────

  describe('updateSchedule', () => {
    it('성공: update + eq + select + single 호출', async () => {
      const updated = { id: 's1', title: '수정된 일정' };
      const chain = createChainMock(updated);
      mockFrom.mockReturnValue(chain);

      const result = await service.updateSchedule(TENANT_ID, 's1', { title: '수정된 일정' });

      expect(mockFrom).toHaveBeenCalledWith('schedules');
      expect(chain.update).toHaveBeenCalledWith({ title: '수정된 일정' });
      expect(chain.eq).toHaveBeenCalledWith('id', 's1');
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'update failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.updateSchedule(TENANT_ID, 's1', { title: '수정' })
      ).rejects.toThrow('Failed to update schedule: update failed');
    });
  });

  // ─── deleteSchedule ─────────────────────────────────────────

  describe('deleteSchedule', () => {
    it('성공: delete + eq 호출', async () => {
      const chain = createChainMock(null, null);
      mockFrom.mockReturnValue(chain);

      await service.deleteSchedule(TENANT_ID, 's1');

      expect(mockFrom).toHaveBeenCalledWith('schedules');
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 's1');
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'delete failed' });
      mockFrom.mockReturnValue(chain);

      await expect(service.deleteSchedule(TENANT_ID, 's1')).rejects.toThrow(
        'Failed to delete schedule: delete failed'
      );
    });
  });
});
