/**
 * Core Metering Service Tests
 *
 * MeteringService 단위 테스트
 * - recordUsage: 사용량 기록 (INSERT, tenant_id in row)
 * - getUsageMetrics: 사용량 목록 조회 (withTenant, 필터)
 * - getUsageSum: 특정 기간의 사용량 합계 (withTenant, reduce)
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
describe('MeteringService', () => {
  let service: InstanceType<typeof import('../service').MeteringService>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../service');
    service = new mod.MeteringService();
  });

  // =========================================================================
  // recordUsage
  // =========================================================================
  describe('recordUsage', () => {
    it('should insert a usage metric and return the created record', async () => {
      const usageData = {
        id: 'usage-1',
        tenant_id: TENANT_ID,
        metric_type: 'sms_count',
        value: 50,
        recorded_at: '2026-03-05T10:00:00Z',
        created_at: '2026-03-05T10:00:00Z',
      };
      const chain = createChainMock(usageData);
      mockFrom.mockReturnValue(chain);

      const result = await service.recordUsage(TENANT_ID, {
        metric_type: 'sms_count',
        value: 50,
        recorded_at: '2026-03-05T10:00:00Z',
      });

      expect(mockFrom).toHaveBeenCalledWith('usage_metrics');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          metric_type: 'sms_count',
          value: 50,
          recorded_at: '2026-03-05T10:00:00Z',
        }),
      );
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(usageData);
    });

    it('should throw when insert fails', async () => {
      const chain = createChainMock(null, { message: 'insert error' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.recordUsage(TENANT_ID, { metric_type: 'sms_count', value: 10 }),
      ).rejects.toThrow('Failed to record usage: insert error');
    });
  });

  // =========================================================================
  // getUsageMetrics
  // =========================================================================
  describe('getUsageMetrics', () => {
    it('should return usage metrics without filters', async () => {
      const metrics = [
        { id: 'u-1', tenant_id: TENANT_ID, metric_type: 'sms_count', value: 10, recorded_at: '2026-03-05T08:00:00Z' },
        { id: 'u-2', tenant_id: TENANT_ID, metric_type: 'user_count', value: 5, recorded_at: '2026-03-05T07:00:00Z' },
      ];
      const chain = createChainMock(metrics);
      mockFrom.mockReturnValue(chain);

      const result = await service.getUsageMetrics(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('usage_metrics');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.order).toHaveBeenCalledWith('recorded_at', { ascending: false });
      expect(result).toEqual(metrics);
    });

    it('should filter by metric_type when provided', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await service.getUsageMetrics(TENANT_ID, { metric_type: 'sms_count' });

      expect(chain.eq).toHaveBeenCalledWith('metric_type', 'sms_count');
    });

    it('should filter by date range when provided', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await service.getUsageMetrics(TENANT_ID, {
        date_from: '2026-03-01T00:00:00Z',
        date_to: '2026-03-31T23:59:59Z',
      });

      expect(chain.gte).toHaveBeenCalledWith('recorded_at', '2026-03-01T00:00:00Z');
      expect(chain.lte).toHaveBeenCalledWith('recorded_at', '2026-03-31T23:59:59Z');
    });

    it('should throw when query fails', async () => {
      const chain = createChainMock(null, { message: 'fetch error' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.getUsageMetrics(TENANT_ID),
      ).rejects.toThrow('Failed to fetch usage metrics: fetch error');
    });
  });

  // =========================================================================
  // getUsageSum
  // =========================================================================
  describe('getUsageSum', () => {
    it('should return the sum of values for the given metric and date range', async () => {
      const data = [
        { value: 10 },
        { value: 20 },
        { value: 30 },
      ];
      const chain = createChainMock(data);
      mockFrom.mockReturnValue(chain);

      const result = await service.getUsageSum(
        TENANT_ID,
        'sms_count',
        '2026-03-01',
        '2026-03-31',
      );

      expect(mockFrom).toHaveBeenCalledWith('usage_metrics');
      expect(chain.select).toHaveBeenCalledWith('value');
      expect(chain.eq).toHaveBeenCalledWith('metric_type', 'sms_count');
      expect(chain.gte).toHaveBeenCalledWith('recorded_at', '2026-03-01');
      expect(chain.lte).toHaveBeenCalledWith('recorded_at', '2026-03-31');
      expect(result).toBe(60);
    });

    it('should return 0 when no data exists', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      const result = await service.getUsageSum(
        TENANT_ID,
        'user_count',
        '2026-01-01',
        '2026-01-31',
      );

      expect(result).toBe(0);
    });

    it('should throw when query fails', async () => {
      const chain = createChainMock(null, { message: 'sum error' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.getUsageSum(TENANT_ID, 'sms_count', '2026-03-01', '2026-03-31'),
      ).rejects.toThrow('Failed to calculate usage sum: sum error');
    });
  });
});
