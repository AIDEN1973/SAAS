/**
 * Core Analytics Service Tests
 *
 * AnalyticsService 단위 테스트
 * - recordEvent: 이벤트 기록 (INSERT, KST 날짜 변환)
 * - getDailyMetrics: 일별 메트릭 조회 (withTenant, 날짜 범위 필터)
 * - getMonthlyRevenue: 월별 매출 조회 (withTenant, 연도/월 필터)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('@lib/supabase-client/server', () => ({
  createServerClient: () => ({ from: mockFrom, rpc: mockRpc }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

vi.mock('@lib/date-utils', () => ({
  toKST: vi.fn(() => ({ format: () => '2026-03-05' })),
}));

// ---------------------------------------------------------------------------
// Chain mock helper
// ---------------------------------------------------------------------------
function createChainMock(resolvedData: unknown = [], resolvedError: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'is',
    'gte', 'lte', 'gt', 'lt', 'order', 'limit', 'range', 'ilike', 'or',
    'not', 'contains', 'filter', 'textSearch', 'maybeSingle', 'csv',
    'match', 'like', 'upsert',
  ];
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

const TENANT_ID = 'test-tenant-id';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AnalyticsService', () => {
  let service: InstanceType<typeof import('../service').AnalyticsService>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../service');
    service = new mod.AnalyticsService();
  });

  // =========================================================================
  // recordEvent
  // =========================================================================
  describe('recordEvent', () => {
    it('should insert an event and return the created record', async () => {
      const eventData = {
        id: 'evt-1',
        tenant_id: TENANT_ID,
        event_type: 'attendance.check_in',
        occurred_at: '2026-03-05T10:00:00Z',
        event_date_kst: '2026-03-05',
      };
      const chain = createChainMock(eventData);
      mockFrom.mockReturnValue(chain);

      const result = await service.recordEvent(TENANT_ID, {
        event_type: 'attendance.check_in',
        occurred_at: '2026-03-05T10:00:00Z',
      });

      expect(mockFrom).toHaveBeenCalledWith('analytics.events');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          event_type: 'attendance.check_in',
          event_date_kst: '2026-03-05',
        }),
      );
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(eventData);
    });

    it('should compute event_date_kst using toKST helper', async () => {
      const chain = createChainMock({ id: 'evt-2', event_date_kst: '2026-03-05' });
      mockFrom.mockReturnValue(chain);

      await service.recordEvent(TENANT_ID, {
        event_type: 'page_view',
        occurred_at: '2026-03-05T15:30:00Z',
      });

      // toKST is called to convert occurred_at → KST date string
      const { toKST } = await import('@lib/date-utils');
      expect(toKST).toHaveBeenCalled();
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ event_date_kst: '2026-03-05' }),
      );
    });

    it('should throw when insert fails', async () => {
      const chain = createChainMock(null, { message: 'insert error' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.recordEvent(TENANT_ID, { event_type: 'fail_event' }),
      ).rejects.toThrow('Failed to record event: insert error');
    });
  });

  // =========================================================================
  // getDailyMetrics
  // =========================================================================
  describe('getDailyMetrics', () => {
    it('should return daily metrics for the given date range', async () => {
      const metrics = [
        { tenant_id: TENANT_ID, date: '2026-03-01', total_revenue: 100 },
        { tenant_id: TENANT_ID, date: '2026-03-02', total_revenue: 200 },
      ];
      const chain = createChainMock(metrics);
      mockFrom.mockReturnValue(chain);

      const result = await service.getDailyMetrics(TENANT_ID, '2026-03-01', '2026-03-05');

      expect(mockFrom).toHaveBeenCalledWith('analytics.daily_store_metrics');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.gte).toHaveBeenCalledWith('date_kst', '2026-03-01');
      expect(chain.lte).toHaveBeenCalledWith('date_kst', '2026-03-05');
      expect(chain.order).toHaveBeenCalledWith('date_kst', { ascending: true });
      expect(result).toEqual(metrics);
    });

    it('should apply date range filters correctly', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await service.getDailyMetrics(TENANT_ID, '2026-01-01', '2026-01-31');

      expect(chain.gte).toHaveBeenCalledWith('date_kst', '2026-01-01');
      expect(chain.lte).toHaveBeenCalledWith('date_kst', '2026-01-31');
    });

    it('should return empty array when no data', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      const result = await service.getDailyMetrics(TENANT_ID, '2026-03-01', '2026-03-05');

      expect(result).toEqual([]);
    });

    it('should throw when query fails', async () => {
      const chain = createChainMock(null, { message: 'query error' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.getDailyMetrics(TENANT_ID, '2026-03-01', '2026-03-05'),
      ).rejects.toThrow('Failed to fetch daily metrics: query error');
    });
  });

  // =========================================================================
  // getMonthlyRevenue
  // =========================================================================
  describe('getMonthlyRevenue', () => {
    it('should return monthly revenue data for a given year', async () => {
      const revenueData = [
        { tenant_id: TENANT_ID, date_kst: '2026-01-15', total_revenue: 500 },
      ];
      const chain = createChainMock(revenueData);
      mockFrom.mockReturnValue(chain);

      const result = await service.getMonthlyRevenue(TENANT_ID, 2026);

      expect(mockFrom).toHaveBeenCalledWith('analytics.daily_store_metrics');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.gte).toHaveBeenCalledWith('date_kst', '2026-01-01');
      expect(chain.lte).toHaveBeenCalledWith('date_kst', '2026-12-31');
      expect(result).toEqual(revenueData);
    });

    it('should filter by specific month when month is provided', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await service.getMonthlyRevenue(TENANT_ID, 2026, 3);

      expect(chain.gte).toHaveBeenCalledWith('date_kst', '2026-03-01');
      expect(chain.lte).toHaveBeenCalledWith('date_kst', '2026-03-31');
    });

    it('should throw when query fails', async () => {
      const chain = createChainMock(null, { message: 'revenue error' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.getMonthlyRevenue(TENANT_ID, 2026),
      ).rejects.toThrow('Failed to fetch monthly revenue: revenue error');
    });
  });
});
