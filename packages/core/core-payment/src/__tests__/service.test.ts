/**
 * Core Payment Service Unit Tests
 *
 * Core Layer의 결제 생성/조회/수정 검증
 * Supabase 클라이언트를 모킹하여 단위 테스트 수행
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@lib/supabase-client/server', () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

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

import { PaymentService } from '../service';

const TENANT_ID = 'test-tenant-id';

const mockPayment = {
  id: 'pay-1',
  tenant_id: TENANT_ID,
  invoice_id: 'inv-1',
  provider: 'toss' as const,
  amount: 300000,
  status: 'pending' as const,
  metadata: undefined,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
};

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(() => {
    service = new PaymentService();
    vi.clearAllMocks();
  });

  // ─── createPayment ───────────────────────────────────────────

  describe('createPayment', () => {
    it('pending 상태로 결제 생성 성공', async () => {
      const chain = createChainMock(mockPayment);
      mockFrom.mockReturnValue(chain);

      const input = {
        invoice_id: 'inv-1',
        provider: 'toss' as const,
        amount: 300000,
      };

      const result = await service.createPayment(TENANT_ID, input);

      expect(mockFrom).toHaveBeenCalledWith('payments');
      expect(chain.insert).toHaveBeenCalledWith({
        tenant_id: TENANT_ID,
        invoice_id: 'inv-1',
        provider: 'toss',
        amount: 300000,
        status: 'pending',
        metadata: undefined,
      });
      expect(result.status).toBe('pending');
      expect(result.id).toBe('pay-1');
    });

    it('metadata 포함하여 결제 생성 성공', async () => {
      const metadata = { pg_transaction_id: 'pg-123', order_name: 'test' };
      const paymentWithMeta = { ...mockPayment, metadata };
      const chain = createChainMock(paymentWithMeta);
      mockFrom.mockReturnValue(chain);

      const input = {
        invoice_id: 'inv-1',
        provider: 'toss' as const,
        amount: 300000,
        metadata,
      };

      const result = await service.createPayment(TENANT_ID, input);

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ metadata })
      );
      expect(result.metadata).toEqual(metadata);
    });

    it('생성 실패 시 에러 throw', async () => {
      const chain = createChainMock(null, { message: 'Insert failed' });
      mockFrom.mockReturnValue(chain);

      const input = {
        invoice_id: 'inv-1',
        provider: 'toss' as const,
        amount: 300000,
      };

      await expect(service.createPayment(TENANT_ID, input))
        .rejects.toThrow('Failed to create payment: Insert failed');
    });
  });

  // ─── getPayments ─────────────────────────────────────────────

  describe('getPayments', () => {
    it('결제 목록 조회 성공', async () => {
      const chain = createChainMock([mockPayment]);
      mockFrom.mockReturnValue(chain);

      const result = await service.getPayments(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('payments');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual([mockPayment]);
    });

    it('invoice_id 필터 적용', async () => {
      const chain = createChainMock([mockPayment]);
      mockFrom.mockReturnValue(chain);

      await service.getPayments(TENANT_ID, { invoice_id: 'inv-1' });

      expect(chain.eq).toHaveBeenCalledWith('invoice_id', 'inv-1');
    });

    it('provider 필터 적용', async () => {
      const chain = createChainMock([mockPayment]);
      mockFrom.mockReturnValue(chain);

      await service.getPayments(TENANT_ID, { provider: 'toss' });

      expect(chain.eq).toHaveBeenCalledWith('provider', 'toss');
    });

    it('status 필터 적용', async () => {
      const chain = createChainMock([mockPayment]);
      mockFrom.mockReturnValue(chain);

      await service.getPayments(TENANT_ID, { status: 'pending' });

      expect(chain.eq).toHaveBeenCalledWith('status', 'pending');
    });

    it('조회 실패 시 에러 throw', async () => {
      const chain = createChainMock(null, { message: 'DB error' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getPayments(TENANT_ID))
        .rejects.toThrow('Failed to fetch payments: DB error');
    });
  });

  // ─── getPayment ──────────────────────────────────────────────

  describe('getPayment', () => {
    it('결제 상세 조회 성공', async () => {
      const chain = createChainMock(mockPayment);
      mockFrom.mockReturnValue(chain);

      const result = await service.getPayment(TENANT_ID, 'pay-1');

      expect(mockFrom).toHaveBeenCalledWith('payments');
      expect(chain.eq).toHaveBeenCalledWith('id', 'pay-1');
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(mockPayment);
    });

    it('존재하지 않는 결제 (PGRST116) -> null 반환', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'Not found' });
      mockFrom.mockReturnValue(chain);

      const result = await service.getPayment(TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
    });

    it('기타 DB 에러 시 throw', async () => {
      const chain = createChainMock(null, { code: 'OTHER', message: 'DB error' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getPayment(TENANT_ID, 'pay-1'))
        .rejects.toThrow('Failed to fetch payment: DB error');
    });
  });

  // ─── updatePayment ───────────────────────────────────────────

  describe('updatePayment', () => {
    it('결제 상태 업데이트 성공', async () => {
      const updated = { ...mockPayment, status: 'completed' as const, paid_at: '2026-03-01T12:00:00Z' };
      const chain = createChainMock(updated);
      mockFrom.mockReturnValue(chain);

      const result = await service.updatePayment(TENANT_ID, 'pay-1', {
        status: 'completed',
        paid_at: '2026-03-01T12:00:00Z',
      });

      expect(mockFrom).toHaveBeenCalledWith('payments');
      expect(chain.update).toHaveBeenCalledWith({
        status: 'completed',
        paid_at: '2026-03-01T12:00:00Z',
      });
      expect(chain.eq).toHaveBeenCalledWith('id', 'pay-1');
      expect(result.status).toBe('completed');
    });

    it('업데이트 실패 시 에러 throw', async () => {
      const chain = createChainMock(null, { message: 'Update failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.updatePayment(TENANT_ID, 'pay-1', { status: 'failed' })
      ).rejects.toThrow('Failed to update payment: Update failed');
    });
  });
});
