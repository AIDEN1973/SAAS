/**
 * Core Billing Service Unit Tests
 *
 * Core Layer의 인보이스 생성/조회/수정 검증
 * Supabase 클라이언트를 모킹하여 단위 테스트 수행
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockFrom,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockEq,
  mockGte,
  mockLte,
  mockOrder,
  mockSingle,
} = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockOrder = vi.fn(() => ({ data: [], error: null }));
  const mockLte = vi.fn(() => ({ order: mockOrder, data: [], error: null }));
  const mockGte = vi.fn(() => ({ lte: mockLte, order: mockOrder, data: [], error: null }));
  const mockEq = vi.fn(() => ({
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
    order: mockOrder,
    select: vi.fn(() => ({ single: mockSingle })),
    single: mockSingle,
    data: [],
    error: null,
  }));
  const mockSelect = vi.fn(() => ({
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
    data: [],
    error: null,
  }));
  const mockInsert = vi.fn(() => ({
    select: vi.fn(() => ({ single: mockSingle })),
    data: null,
    error: null,
  }));
  const mockUpdate = vi.fn(() => ({
    eq: mockEq,
    select: vi.fn(() => ({ single: mockSingle })),
  }));
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  }));

  return {
    mockFrom,
    mockSelect,
    mockInsert,
    mockUpdate,
    mockEq,
    mockGte,
    mockLte,
    mockOrder,
    mockSingle,
  };
});

vi.mock('@lib/supabase-client/server', () => ({
  createServerClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

import { BillingService } from '../service';

const TENANT_ID = 'test-tenant-id';

const mockInvoice = {
  id: 'inv-1',
  tenant_id: TENANT_ID,
  payer_id: 'student-1',
  amount: 300000,
  due_date: '2026-03-31',
  status: 'draft',
  industry_type: 'academy',
  created_at: '2026-03-01T00:00:00Z',
};

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(() => {
    service = new BillingService();
    vi.clearAllMocks();
  });

  describe('getInvoices', () => {
    it('테넌트별 인보이스 목록 조회', async () => {
      mockOrder.mockReturnValueOnce({ data: [mockInvoice], error: null });

      const result = await service.getInvoices(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('invoices');
      expect(result).toBeDefined();
    });

    it('status 필터 적용', async () => {
      mockOrder.mockReturnValueOnce({ data: [mockInvoice], error: null });

      await service.getInvoices(TENANT_ID, { status: 'draft' });

      expect(mockEq).toHaveBeenCalled();
    });

    it('조회 실패 시 에러 throw', async () => {
      mockOrder.mockReturnValueOnce({ data: null, error: { message: 'DB error' } });

      await expect(service.getInvoices(TENANT_ID))
        .rejects.toThrow('Failed to fetch invoices');
    });
  });

  describe('getInvoice', () => {
    it('인보이스 상세 조회', async () => {
      mockSingle.mockReturnValueOnce({ data: mockInvoice, error: null });

      const result = await service.getInvoice(TENANT_ID, 'inv-1');

      expect(result).toEqual(mockInvoice);
    });

    it('존재하지 않는 인보이스 → null', async () => {
      mockSingle.mockReturnValueOnce({ data: null, error: { code: 'PGRST116', message: 'Not found' } });

      const result = await service.getInvoice(TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
    });

    it('DB 에러 시 throw', async () => {
      mockSingle.mockReturnValueOnce({ data: null, error: { code: 'OTHER', message: 'DB error' } });

      await expect(service.getInvoice(TENANT_ID, 'inv-1'))
        .rejects.toThrow('Failed to fetch invoice');
    });
  });

  describe('createInvoice', () => {
    it('정상 생성 (금액 > 0)', async () => {
      const input = {
        payer_id: 'student-1',
        amount: 300000,
        due_date: '2026-03-31',
        industry_type: 'academy',
      };
      mockSingle.mockReturnValueOnce({ data: { id: 'inv-new', ...input, status: 'draft' }, error: null });

      const result = await service.createInvoice(TENANT_ID, input);

      expect(mockFrom).toHaveBeenCalledWith('invoices');
      expect(mockInsert).toHaveBeenCalled();
      expect(result.status).toBe('draft');
    });

    it('인보이스 + 아이템 함께 생성', async () => {
      const input = {
        payer_id: 'student-1',
        amount: 300000,
        due_date: '2026-03-31',
        industry_type: 'academy',
        items: [
          { item_type: 'tuition', category: '수학', quantity: 1, unit_price: 300000 },
        ],
      };
      // 첫 번째 insert (invoices): 기본 구현 사용 → .select().single() 체인 유지
      mockSingle.mockReturnValueOnce({
        data: { id: 'inv-new', ...input, status: 'draft' },
        error: null,
      });
      // 두 번째 insert (invoice_items): mockInsert 기본 구현이 반환하므로 별도 설정 불필요
      // (기본: { select: vi.fn(...), data: null, error: null })

      const result = await service.createInvoice(TENANT_ID, input);

      expect(result).toBeDefined();
    });

    it('생성 실패 시 에러', async () => {
      mockSingle.mockReturnValueOnce({ data: null, error: { message: 'Insert failed' } });

      await expect(
        service.createInvoice(TENANT_ID, {
          payer_id: 'student-1',
          amount: 300000,
          due_date: '2026-03-31',
          industry_type: 'academy',
        })
      ).rejects.toThrow('Failed to create invoice');
    });
  });

  describe('updateInvoice', () => {
    it('상태 변경 (draft → pending)', async () => {
      const updated = { ...mockInvoice, status: 'pending' };
      mockSingle.mockReturnValueOnce({ data: updated, error: null });

      const result = await service.updateInvoice(TENANT_ID, 'inv-1', { status: 'pending' });

      expect(result.status).toBe('pending');
    });

    it('수정 실패 시 에러', async () => {
      mockSingle.mockReturnValueOnce({ data: null, error: { message: 'Update failed' } });

      await expect(
        service.updateInvoice(TENANT_ID, 'inv-1', { status: 'paid' })
      ).rejects.toThrow('Failed to update invoice');
    });
  });

  describe('getInvoiceItems', () => {
    it('인보이스 아이템 목록 조회', async () => {
      const items = [
        { id: 'item-1', invoice_id: 'inv-1', item_type: 'tuition', unit_price: 300000 },
      ];
      // withTenant 래핑 후의 최종 결과
      mockOrder.mockReturnValueOnce({ data: items, error: null });

      const result = await service.getInvoiceItems(TENANT_ID, 'inv-1');

      expect(result).toBeDefined();
    });
  });
});
