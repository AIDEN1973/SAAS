/**
 * TenancyReferralService Unit Tests
 *
 * B2B 추천인 코드 서비스 단위 테스트
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
import { TenancyReferralService } from '../service';

const mockReferralCode = {
  id: 'ref-code-1',
  referrer_tenant_id: TENANT_ID,
  code: 'REFER50',
  reward_type: 'discount' as const,
  reward_value: 50,
  is_active: true,
  expires_at: '2026-12-31T23:59:59Z',
  created_at: '2026-01-01T00:00:00Z',
};

const mockUsage = {
  id: 'usage-1',
  referral_code_id: 'ref-code-1',
  new_tenant_id: 'new-tenant-id',
  used_at: '2026-03-05T10:00:00Z',
  reward_applied: false,
  reward_applied_at: null,
};

describe('TenancyReferralService', () => {
  let service: TenancyReferralService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TenancyReferralService();
  });

  // ─── getReferralCodes ─────────────────────────────────────────

  describe('getReferralCodes', () => {
    it('should return referral codes filtered by referrer_tenant_id (not withTenant)', async () => {
      const chain = createChainMock([mockReferralCode]);
      mockFrom.mockReturnValue(chain);

      const result = await service.getReferralCodes(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('referral_codes');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.eq).toHaveBeenCalledWith('referrer_tenant_id', TENANT_ID);
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual([mockReferralCode]);
    });

    it('should throw on error', async () => {
      const chain = createChainMock(null, { message: 'DB error' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getReferralCodes(TENANT_ID)).rejects.toThrow(
        'Failed to fetch referral codes: DB error'
      );
    });
  });

  // ─── getReferralCode ──────────────────────────────────────────

  describe('getReferralCode', () => {
    it('should return a referral code by id and referrer_tenant_id', async () => {
      const chain = createChainMock(mockReferralCode);
      mockFrom.mockReturnValue(chain);

      const result = await service.getReferralCode(TENANT_ID, 'ref-code-1');

      expect(mockFrom).toHaveBeenCalledWith('referral_codes');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.eq).toHaveBeenCalledWith('id', 'ref-code-1');
      expect(chain.eq).toHaveBeenCalledWith('referrer_tenant_id', TENANT_ID);
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(mockReferralCode);
    });

    it('should return null when not found (PGRST116)', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'Not found' });
      mockFrom.mockReturnValue(chain);

      const result = await service.getReferralCode(TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
    });

    it('should throw on non-PGRST116 error', async () => {
      const chain = createChainMock(null, { code: 'OTHER', message: 'Server error' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.getReferralCode(TENANT_ID, 'ref-code-1')
      ).rejects.toThrow('Failed to fetch referral code: Server error');
    });
  });

  // ─── getReferralCodeByCode ────────────────────────────────────

  describe('getReferralCodeByCode', () => {
    it('should return a referral code by code string and referrer_tenant_id', async () => {
      const chain = createChainMock(mockReferralCode);
      mockFrom.mockReturnValue(chain);

      const result = await service.getReferralCodeByCode(TENANT_ID, 'REFER50');

      expect(chain.eq).toHaveBeenCalledWith('code', 'REFER50');
      expect(chain.eq).toHaveBeenCalledWith('referrer_tenant_id', TENANT_ID);
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(mockReferralCode);
    });

    it('should return null when not found (PGRST116)', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'Not found' });
      mockFrom.mockReturnValue(chain);

      const result = await service.getReferralCodeByCode(TENANT_ID, 'INVALID');

      expect(result).toBeNull();
    });
  });

  // ─── createReferralCode ───────────────────────────────────────

  describe('createReferralCode', () => {
    it('should create a referral code with default is_active=true', async () => {
      const chain = createChainMock(mockReferralCode);
      mockFrom.mockReturnValue(chain);

      const input = {
        code: 'REFER50',
        reward_type: 'discount' as const,
        reward_value: 50,
        expires_at: '2026-12-31T23:59:59Z',
      };

      const result = await service.createReferralCode(TENANT_ID, input);

      expect(mockFrom).toHaveBeenCalledWith('referral_codes');
      expect(chain.insert).toHaveBeenCalledWith({
        referrer_tenant_id: TENANT_ID,
        code: 'REFER50',
        reward_type: 'discount',
        reward_value: 50,
        is_active: true,
        expires_at: '2026-12-31T23:59:59Z',
      });
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(mockReferralCode);
    });

    it('should throw on error', async () => {
      const chain = createChainMock(null, { message: 'Duplicate code' });
      mockFrom.mockReturnValue(chain);

      const input = {
        code: 'REFER50',
        reward_type: 'discount' as const,
      };

      await expect(service.createReferralCode(TENANT_ID, input)).rejects.toThrow(
        'Failed to create referral code: Duplicate code'
      );
    });
  });

  // ─── updateReferralCode ───────────────────────────────────────

  describe('updateReferralCode', () => {
    it('should update a referral code with referrer_tenant_id and id filter', async () => {
      const updated = { ...mockReferralCode, reward_value: 75 };
      const chain = createChainMock(updated);
      mockFrom.mockReturnValue(chain);

      const result = await service.updateReferralCode(TENANT_ID, 'ref-code-1', { reward_value: 75 });

      expect(mockFrom).toHaveBeenCalledWith('referral_codes');
      expect(chain.update).toHaveBeenCalledWith({ reward_value: 75 });
      expect(chain.eq).toHaveBeenCalledWith('id', 'ref-code-1');
      expect(chain.eq).toHaveBeenCalledWith('referrer_tenant_id', TENANT_ID);
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('should throw on error', async () => {
      const chain = createChainMock(null, { message: 'Update failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.updateReferralCode(TENANT_ID, 'ref-code-1', { is_active: false })
      ).rejects.toThrow('Failed to update referral code: Update failed');
    });
  });

  // ─── useReferralCode ──────────────────────────────────────────

  describe('useReferralCode', () => {
    it('should use a valid referral code successfully', async () => {
      // First call: getReferralCodeWithoutTenant (from('referral_codes').select.eq.single)
      const getCodeChain = createChainMock({
        ...mockReferralCode,
        is_active: true,
        expires_at: '2026-12-31T23:59:59Z',
      });

      // Second call: insert usage (from('referral_usages').insert.select.single)
      const insertUsageChain = createChainMock(mockUsage);

      mockFrom.mockImplementation((table: string) => {
        if (table === 'referral_codes') return getCodeChain;
        if (table === 'referral_usages') return insertUsageChain;
        return getCodeChain;
      });

      const result = await service.useReferralCode('ref-code-1', 'new-tenant-id');

      expect(result).toEqual(mockUsage);
      expect(insertUsageChain.insert).toHaveBeenCalledWith({
        referral_code_id: 'ref-code-1',
        new_tenant_id: 'new-tenant-id',
        reward_applied: false,
      });
    });

    it('should throw when referral code not found', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'Not found' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.useReferralCode('nonexistent', 'new-tenant-id')
      ).rejects.toThrow('Referral code not found');
    });

    it('should throw when referral code is not active', async () => {
      const chain = createChainMock({ ...mockReferralCode, is_active: false });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.useReferralCode('ref-code-1', 'new-tenant-id')
      ).rejects.toThrow('Referral code is not active');
    });

    it('should throw when referral code has expired', async () => {
      const chain = createChainMock({
        ...mockReferralCode,
        is_active: true,
        expires_at: '2020-01-01T00:00:00Z', // expired
      });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.useReferralCode('ref-code-1', 'new-tenant-id')
      ).rejects.toThrow('Referral code has expired');
    });
  });

  // ─── getReferralUsages ────────────────────────────────────────

  describe('getReferralUsages', () => {
    it('should return usages filtered by new_tenant_id', async () => {
      const chain = createChainMock([mockUsage]);
      mockFrom.mockReturnValue(chain);

      const result = await service.getReferralUsages('new-tenant-id');

      expect(mockFrom).toHaveBeenCalledWith('referral_usages');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.eq).toHaveBeenCalledWith('new_tenant_id', 'new-tenant-id');
      expect(chain.order).toHaveBeenCalledWith('used_at', { ascending: false });
      expect(result).toEqual([mockUsage]);
    });

    it('should filter by referralCodeId when provided', async () => {
      const chain = createChainMock([mockUsage]);
      mockFrom.mockReturnValue(chain);

      await service.getReferralUsages('new-tenant-id', 'ref-code-1');

      expect(chain.eq).toHaveBeenCalledWith('new_tenant_id', 'new-tenant-id');
      expect(chain.eq).toHaveBeenCalledWith('referral_code_id', 'ref-code-1');
    });
  });

  // ─── applyReward ──────────────────────────────────────────────

  describe('applyReward', () => {
    it('should set reward_applied=true and reward_applied_at timestamp', async () => {
      const chain = createChainMock();
      mockFrom.mockReturnValue(chain);

      await service.applyReward('new-tenant-id', 'usage-1');

      expect(mockFrom).toHaveBeenCalledWith('referral_usages');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          reward_applied: true,
          reward_applied_at: expect.any(String),
        })
      );
      expect(chain.eq).toHaveBeenCalledWith('id', 'usage-1');
      expect(chain.eq).toHaveBeenCalledWith('new_tenant_id', 'new-tenant-id');
    });

    it('should throw on error', async () => {
      const chain = createChainMock(null, { message: 'Update failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.applyReward('new-tenant-id', 'usage-1')
      ).rejects.toThrow('Failed to apply reward: Update failed');
    });
  });
});
