/**
 * Core Billing Service Extended Tests
 *
 * Coverage target: 79% -> 80%+
 * Additional coverage for:
 * - getInvoices with payer_id filter
 * - getInvoices with due_date_from and due_date_to filters
 * - createInvoice with items that fail to insert
 * - addInvoiceItem: success and error
 * - getInvoiceItems: error case
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use a factory approach: create fresh mock chains for each test
function createMockChain() {
  const mockSingle = vi.fn(() => ({ data: null, error: null }));
  const mockOrder = vi.fn(() => ({ data: [], error: null }));
  const mockLte = vi.fn((): Record<string, unknown> => ({ order: mockOrder, data: [], error: null }));
  const mockGte = vi.fn((): Record<string, unknown> => ({ lte: mockLte, order: mockOrder, data: [], error: null }));
  const mockEq = vi.fn((): Record<string, unknown> => ({
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
    order: mockOrder,
    select: vi.fn(() => ({ single: mockSingle })),
    single: mockSingle,
    data: [],
    error: null,
  }));
  const mockSelect = vi.fn((): Record<string, unknown> => ({
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
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
}

let mocks = createMockChain();

vi.mock('@lib/supabase-client/server', () => ({
  createServerClient: () => ({
    from: (...args: unknown[]) => mocks.mockFrom(...args),
  }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

import { BillingService } from '../service';

const TENANT_ID = 'test-tenant-id';

describe('BillingService Extended', () => {
  let service: BillingService;

  beforeEach(() => {
    // Create fresh mock chain for each test
    mocks = createMockChain();
    service = new BillingService();
  });

  // ========== getInvoices with filters ==========

  describe('getInvoices - extended filters', () => {
    it('applies payer_id filter', async () => {
      mocks.mockOrder.mockReturnValueOnce({ data: [], error: null });

      await service.getInvoices(TENANT_ID, { payer_id: 'student-1' });

      expect(mocks.mockEq).toHaveBeenCalledWith('payer_id', 'student-1');
    });

    it('applies due_date_from filter', async () => {
      mocks.mockOrder.mockReturnValueOnce({ data: [], error: null });

      await service.getInvoices(TENANT_ID, { due_date_from: '2026-01-01' });

      expect(mocks.mockGte).toHaveBeenCalledWith('due_date', '2026-01-01');
    });

    it('applies due_date_to filter', async () => {
      mocks.mockOrder.mockReturnValueOnce({ data: [], error: null });

      await service.getInvoices(TENANT_ID, { due_date_to: '2026-12-31' });

      expect(mocks.mockLte).toHaveBeenCalledWith('due_date', '2026-12-31');
    });

    it('applies all filters combined', async () => {
      mocks.mockOrder.mockReturnValueOnce({ data: [], error: null });

      await service.getInvoices(TENANT_ID, {
        payer_id: 'student-1',
        status: 'pending',
        due_date_from: '2026-01-01',
        due_date_to: '2026-12-31',
      });

      expect(mocks.mockEq).toHaveBeenCalled();
      expect(mocks.mockGte).toHaveBeenCalled();
      expect(mocks.mockLte).toHaveBeenCalled();
    });

    it('returns empty array when data is null', async () => {
      mocks.mockOrder.mockReturnValueOnce({ data: null, error: null });

      const result = await service.getInvoices(TENANT_ID);
      expect(result).toEqual([]);
    });
  });

  // ========== createInvoice with items error ==========

  describe('createInvoice - items error', () => {
    it('throws when invoice items insertion fails', async () => {
      const input = {
        payer_id: 'student-1',
        amount: 300000,
        due_date: '2026-03-31',
        industry_type: 'academy',
        items: [
          { item_type: 'tuition', category: 'math', quantity: 1, unit_price: 300000 },
        ],
      };

      // First call: from('invoices').insert().select().single() succeeds
      mocks.mockSingle.mockReturnValueOnce({
        data: { id: 'inv-new', ...input, status: 'draft' },
        error: null,
      });

      // Second call: from('invoice_items').insert() fails
      // Need to make the second mockInsert call return an error
      let insertCallCount = 0;
      mocks.mockInsert.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          // First insert (invoices) - returns select chain
          return {
            select: vi.fn(() => ({ single: mocks.mockSingle })),
            data: null,
            error: null,
          };
        }
        // Second insert (invoice_items) - returns error
        return {
          data: null,
          error: { message: 'Items insert failed' },
          select: vi.fn(),
        };
      });

      await expect(service.createInvoice(TENANT_ID, input))
        .rejects.toThrow('Failed to create invoice items');
    });
  });

  // ========== addInvoiceItem ==========

  describe('addInvoiceItem', () => {
    it('adds an invoice item successfully', async () => {
      const itemData = {
        id: 'item-new',
        tenant_id: TENANT_ID,
        invoice_id: 'inv-1',
        item_type: 'tuition',
        category: 'math',
        quantity: 1,
        unit_price: 300000,
        description: 'Math class fee',
      };
      mocks.mockSingle.mockReturnValueOnce({ data: itemData, error: null });

      const result = await service.addInvoiceItem(TENANT_ID, 'inv-1', {
        item_type: 'tuition',
        category: 'math',
        quantity: 1,
        unit_price: 300000,
        description: 'Math class fee',
      });

      expect(result).toEqual(itemData);
      expect(mocks.mockFrom).toHaveBeenCalledWith('invoice_items');
    });

    it('throws on error', async () => {
      mocks.mockSingle.mockReturnValueOnce({
        data: null,
        error: { message: 'Insert failed' },
      });

      await expect(
        service.addInvoiceItem(TENANT_ID, 'inv-1', {
          item_type: 'tuition',
          quantity: 1,
          unit_price: 100000,
        }),
      ).rejects.toThrow('Failed to add invoice item');
    });
  });

  // ========== getInvoiceItems error ==========

  describe('getInvoiceItems - extended', () => {
    it('throws on error', async () => {
      // getInvoiceItems chain: from().select().eq().order()
      // Need to make the final result have an error
      // The chain: select -> eq -> order
      // mockOrder is the terminal, need it to return error
      mocks.mockOrder.mockReturnValueOnce({
        data: null,
        error: { message: 'Query failed' },
      });

      await expect(service.getInvoiceItems(TENANT_ID, 'inv-1'))
        .rejects.toThrow('Failed to fetch invoice items');
    });

    it('returns empty array when data is null', async () => {
      mocks.mockOrder.mockReturnValueOnce({ data: null, error: null });

      const result = await service.getInvoiceItems(TENANT_ID, 'inv-1');
      expect(result).toEqual([]);
    });
  });
});
