/**
 * CouponsService Unit Tests
 *
 * 쿠폰 서비스 단위 테스트
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

vi.mock('@lib/date-utils', () => ({
  toKST: vi.fn(() => ({ format: (_fmt: string) => '2026-03-05' })),
}));

function createChainMock(resolvedData: unknown = [], resolvedError: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'is', 'gte', 'lte', 'gt', 'lt', 'order', 'limit', 'range', 'ilike', 'or', 'not', 'contains', 'filter', 'textSearch', 'maybeSingle', 'csv', 'match', 'like', 'upsert'];
  for (const method of methods) { chain[method] = vi.fn(() => chain); }
  chain.single = vi.fn(() => ({ data: resolvedData, error: resolvedError }));
  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: unknown) => void) => { resolve({ data: resolvedData, error: resolvedError }); },
  });
  return chain;
}

const TENANT_ID = 'test-tenant-id';

// Import after mocks
import { CouponsService } from '../service';

const mockCoupon = {
  id: 'coupon-1',
  tenant_id: TENANT_ID,
  code: 'SAVE10',
  name: '10% Discount',
  discount_type: 'percentage' as const,
  discount_value: 10,
  min_purchase_amount: 10000,
  max_discount_amount: 5000,
  valid_from: '2026-01-01',
  valid_until: '2026-12-31',
  usage_limit: 100,
  usage_count: 5,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
};

const mockUsage = {
  id: 'usage-1',
  tenant_id: TENANT_ID,
  coupon_id: 'coupon-1',
  person_id: 'person-1',
  invoice_id: 'invoice-1',
  used_at: '2026-03-05T10:00:00Z',
};

describe('CouponsService', () => {
  let service: CouponsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CouponsService();
  });

  // ─── getCoupons ───────────────────────────────────────────────

  describe('getCoupons', () => {
    it('should return all coupons', async () => {
      const chain = createChainMock([mockCoupon]);
      mockFrom.mockReturnValue(chain);

      const result = await service.getCoupons(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('coupons');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual([mockCoupon]);
    });

    it('should filter by is_active', async () => {
      const chain = createChainMock([mockCoupon]);
      mockFrom.mockReturnValue(chain);

      await service.getCoupons(TENANT_ID, { is_active: true });

      expect(chain.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('should filter by code', async () => {
      const chain = createChainMock([mockCoupon]);
      mockFrom.mockReturnValue(chain);

      await service.getCoupons(TENANT_ID, { code: 'SAVE10' });

      expect(chain.eq).toHaveBeenCalledWith('code', 'SAVE10');
    });

    it('should throw on error', async () => {
      const chain = createChainMock(null, { message: 'DB error' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getCoupons(TENANT_ID)).rejects.toThrow(
        'Failed to fetch coupons: DB error'
      );
    });
  });

  // ─── getCoupon ────────────────────────────────────────────────

  describe('getCoupon', () => {
    it('should return a coupon by id', async () => {
      const chain = createChainMock(mockCoupon);
      mockFrom.mockReturnValue(chain);

      const result = await service.getCoupon(TENANT_ID, 'coupon-1');

      expect(mockFrom).toHaveBeenCalledWith('coupons');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.eq).toHaveBeenCalledWith('id', 'coupon-1');
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(mockCoupon);
    });

    it('should return null when not found (PGRST116)', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'Not found' });
      mockFrom.mockReturnValue(chain);

      const result = await service.getCoupon(TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
    });

    it('should throw on non-PGRST116 error', async () => {
      const chain = createChainMock(null, { code: 'OTHER', message: 'Server error' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getCoupon(TENANT_ID, 'coupon-1')).rejects.toThrow(
        'Failed to fetch coupon: Server error'
      );
    });
  });

  // ─── getCouponByCode ─────────────────────────────────────────

  describe('getCouponByCode', () => {
    it('should return a coupon by code', async () => {
      const chain = createChainMock(mockCoupon);
      mockFrom.mockReturnValue(chain);

      const result = await service.getCouponByCode(TENANT_ID, 'SAVE10');

      expect(chain.eq).toHaveBeenCalledWith('code', 'SAVE10');
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(mockCoupon);
    });

    it('should return null when not found (PGRST116)', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'Not found' });
      mockFrom.mockReturnValue(chain);

      const result = await service.getCouponByCode(TENANT_ID, 'INVALID');

      expect(result).toBeNull();
    });
  });

  // ─── createCoupon ─────────────────────────────────────────────

  describe('createCoupon', () => {
    it('should create a coupon with defaults (usage_count=0, is_active=true)', async () => {
      const chain = createChainMock(mockCoupon);
      mockFrom.mockReturnValue(chain);

      const input = {
        code: 'SAVE10',
        name: '10% Discount',
        discount_type: 'percentage' as const,
        discount_value: 10,
        min_purchase_amount: 10000,
        max_discount_amount: 5000,
        valid_from: '2026-01-01',
        valid_until: '2026-12-31',
        usage_limit: 100,
      };

      const result = await service.createCoupon(TENANT_ID, input);

      expect(mockFrom).toHaveBeenCalledWith('coupons');
      expect(chain.insert).toHaveBeenCalledWith({
        tenant_id: TENANT_ID,
        code: 'SAVE10',
        name: '10% Discount',
        discount_type: 'percentage',
        discount_value: 10,
        min_purchase_amount: 10000,
        max_discount_amount: 5000,
        valid_from: '2026-01-01',
        valid_until: '2026-12-31',
        usage_limit: 100,
        usage_count: 0,
        is_active: true,
      });
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(mockCoupon);
    });

    it('should throw on error', async () => {
      const chain = createChainMock(null, { message: 'Duplicate code' });
      mockFrom.mockReturnValue(chain);

      const input = {
        code: 'SAVE10',
        name: '10% Discount',
        discount_type: 'percentage' as const,
        discount_value: 10,
        valid_from: '2026-01-01',
        valid_until: '2026-12-31',
      };

      await expect(service.createCoupon(TENANT_ID, input)).rejects.toThrow(
        'Failed to create coupon: Duplicate code'
      );
    });
  });

  // ─── updateCoupon ─────────────────────────────────────────────

  describe('updateCoupon', () => {
    it('should update a coupon partially', async () => {
      const updated = { ...mockCoupon, name: 'Updated Name' };
      const chain = createChainMock(updated);
      mockFrom.mockReturnValue(chain);

      const result = await service.updateCoupon(TENANT_ID, 'coupon-1', { name: 'Updated Name' });

      expect(mockFrom).toHaveBeenCalledWith('coupons');
      expect(chain.update).toHaveBeenCalledWith({ name: 'Updated Name' });
      expect(chain.eq).toHaveBeenCalledWith('id', 'coupon-1');
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('should throw on error', async () => {
      const chain = createChainMock(null, { message: 'Update failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.updateCoupon(TENANT_ID, 'coupon-1', { name: 'X' })
      ).rejects.toThrow('Failed to update coupon: Update failed');
    });
  });

  // ─── deleteCoupon ─────────────────────────────────────────────

  describe('deleteCoupon', () => {
    it('should delete a coupon', async () => {
      const chain = createChainMock();
      mockFrom.mockReturnValue(chain);

      await service.deleteCoupon(TENANT_ID, 'coupon-1');

      expect(mockFrom).toHaveBeenCalledWith('coupons');
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'coupon-1');
    });

    it('should throw on error', async () => {
      const chain = createChainMock(null, { message: 'Delete failed' });
      mockFrom.mockReturnValue(chain);

      await expect(service.deleteCoupon(TENANT_ID, 'coupon-1')).rejects.toThrow(
        'Failed to delete coupon: Delete failed'
      );
    });
  });

  // ─── useCoupon ────────────────────────────────────────────────

  describe('useCoupon', () => {
    it('should use a valid coupon successfully', async () => {
      // First call: getCoupon (from('coupons').select.eq.single)
      const getCouponChain = createChainMock({
        ...mockCoupon,
        is_active: true,
        valid_from: '2026-01-01',
        valid_until: '2026-12-31',
        usage_limit: 100,
        usage_count: 5,
      });

      // Second call: insert usage (from('coupon_usages').insert.select.single)
      const insertUsageChain = createChainMock(mockUsage);

      // Third call: update usage_count (from('coupons').update.eq)
      const updateCountChain = createChainMock();

      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        if (table === 'coupons' && callCount === 1) return getCouponChain;
        if (table === 'coupon_usages') return insertUsageChain;
        if (table === 'coupons') return updateCountChain;
        return getCouponChain;
      });

      const result = await service.useCoupon(TENANT_ID, 'coupon-1', 'person-1', 'invoice-1');

      expect(result).toEqual(mockUsage);
      expect(insertUsageChain.insert).toHaveBeenCalledWith({
        tenant_id: TENANT_ID,
        coupon_id: 'coupon-1',
        person_id: 'person-1',
        invoice_id: 'invoice-1',
      });
    });

    it('should throw when coupon not found', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'Not found' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.useCoupon(TENANT_ID, 'nonexistent')
      ).rejects.toThrow('Coupon not found');
    });

    it('should throw when coupon is not active', async () => {
      const chain = createChainMock({ ...mockCoupon, is_active: false });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.useCoupon(TENANT_ID, 'coupon-1')
      ).rejects.toThrow('Coupon is not active');
    });

    it('should throw when coupon is expired (valid_until before today)', async () => {
      // toKST mocked to return '2026-03-05'
      const chain = createChainMock({
        ...mockCoupon,
        is_active: true,
        valid_from: '2025-01-01',
        valid_until: '2025-12-31', // expired before 2026-03-05
      });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.useCoupon(TENANT_ID, 'coupon-1')
      ).rejects.toThrow('Coupon is not valid for current date');
    });

    it('should throw when usage limit is reached', async () => {
      const chain = createChainMock({
        ...mockCoupon,
        is_active: true,
        valid_from: '2026-01-01',
        valid_until: '2026-12-31',
        usage_limit: 10,
        usage_count: 10, // limit reached
      });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.useCoupon(TENANT_ID, 'coupon-1')
      ).rejects.toThrow('Coupon usage limit exceeded');
    });
  });

  // ─── getCouponUsages ──────────────────────────────────────────

  describe('getCouponUsages', () => {
    it('should return all usages for tenant', async () => {
      const chain = createChainMock([mockUsage]);
      mockFrom.mockReturnValue(chain);

      const result = await service.getCouponUsages(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('coupon_usages');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.order).toHaveBeenCalledWith('used_at', { ascending: false });
      expect(result).toEqual([mockUsage]);
    });

    it('should filter by couponId when provided', async () => {
      const chain = createChainMock([mockUsage]);
      mockFrom.mockReturnValue(chain);

      await service.getCouponUsages(TENANT_ID, 'coupon-1');

      expect(chain.eq).toHaveBeenCalledWith('coupon_id', 'coupon-1');
    });
  });
});
