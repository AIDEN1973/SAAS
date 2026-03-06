/**
 * ConfigService Unit Tests
 *
 * tenant_settings KV 구조 기반 설정 CRUD + dot-notation 접근
 * [불변 규칙] withTenant() 필수, RLS tenant_id 격리
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/* Hoisted mocks                                                       */
/* ------------------------------------------------------------------ */
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@lib/supabase-client/server', () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

/* ------------------------------------------------------------------ */
/* Chain helper                                                        */
/* ------------------------------------------------------------------ */
function createChainMock(resolvedData: unknown = [], resolvedError: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'is', 'gte', 'lte', 'gt', 'lt',
    'order', 'limit', 'range', 'ilike', 'or', 'not',
    'contains', 'filter', 'textSearch', 'maybeSingle', 'csv',
    'match', 'like',
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

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */
const TENANT_ID = 'test-tenant-id';

/* ------------------------------------------------------------------ */
/* SUT                                                                 */
/* ------------------------------------------------------------------ */
import { ConfigService } from '../service';

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ConfigService();
  });

  /* ================================================================ */
  /* getConfig                                                         */
  /* ================================================================ */
  describe('getConfig', () => {
    it('should return config value on success', async () => {
      const configValue = {
        attendance: { late_after: 10, absent_after: 30 },
        ui: { theme: 'light' },
      };
      const chain = createChainMock({ value: configValue });
      mockFrom.mockReturnValue(chain);

      const result = await service.getConfig(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('tenant_settings');
      expect(chain.select).toHaveBeenCalledWith('value');
      expect(chain.eq).toHaveBeenCalledWith('key', 'config');
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(configValue);
    });

    it('should return null when config not found (PGRST116)', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'not found' });
      mockFrom.mockReturnValue(chain);

      const result = await service.getConfig(TENANT_ID);

      expect(result).toBeNull();
    });

    it('should throw on unexpected error', async () => {
      const chain = createChainMock(null, { code: '42P01', message: 'relation does not exist' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getConfig(TENANT_ID)).rejects.toThrow(
        'Failed to fetch config: relation does not exist'
      );
    });
  });

  /* ================================================================ */
  /* updateConfig                                                      */
  /* ================================================================ */
  describe('updateConfig', () => {
    it('should merge input with existing config and upsert', async () => {
      const existingConfig = {
        attendance: { late_after: 10 },
        ui: { theme: 'light' },
      };
      const updatedConfig = {
        attendance: { late_after: 10 },
        ui: { theme: 'dark' as const },
      };

      // First call: getConfig (select → single)
      const getChain = createChainMock({ value: existingConfig });
      // Second call: upsert → select → single
      const upsertChain = createChainMock({ value: updatedConfig });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? getChain : upsertChain;
      });

      const result = await service.updateConfig(TENANT_ID, { ui: { theme: 'dark' } });

      expect(upsertChain.upsert).toHaveBeenCalled();
      expect(upsertChain.select).toHaveBeenCalledWith('value');
      expect(upsertChain.eq).toHaveBeenCalledWith('key', 'config');
      expect(upsertChain.single).toHaveBeenCalled();
      expect(result).toEqual(updatedConfig);
    });

    it('should normalize kakao channel to kakao_at', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const getChain = createChainMock(null, { code: 'PGRST116', message: 'not found' });
      const normalizedResult = {
        attendance: { notification_channel: 'kakao_at' },
      };
      const upsertChain = createChainMock({ value: normalizedResult });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? getChain : upsertChain;
      });

      const result = await service.updateConfig(TENANT_ID, {
        attendance: { notification_channel: 'kakao' as 'kakao_at' },
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Legacy channel "kakao" detected')
      );
      expect(result).toEqual(normalizedResult);

      warnSpy.mockRestore();
    });

    it('should throw on upsert error', async () => {
      // getConfig succeeds
      const getChain = createChainMock({ value: {} });
      // upsert fails
      const upsertChain = createChainMock(null, { message: 'permission denied' });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? getChain : upsertChain;
      });

      await expect(
        service.updateConfig(TENANT_ID, { ui: { theme: 'dark' } })
      ).rejects.toThrow('Failed to update config: permission denied');
    });
  });

  /* ================================================================ */
  /* getConfigValue                                                    */
  /* ================================================================ */
  describe('getConfigValue', () => {
    it('should return flat key value', async () => {
      const configValue = {
        attendance: { late_after: 15 },
        billing: { cycle: 'monthly' },
      };
      const chain = createChainMock({ value: configValue });
      mockFrom.mockReturnValue(chain);

      const result = await service.getConfigValue<{ late_after: number }>(
        TENANT_ID,
        'attendance'
      );

      expect(result).toEqual({ late_after: 15 });
    });

    it('should return nested dot-notation value', async () => {
      const configValue = {
        attendance: { late_after: 15, absent_after: 30 },
      };
      const chain = createChainMock({ value: configValue });
      mockFrom.mockReturnValue(chain);

      const result = await service.getConfigValue<number>(
        TENANT_ID,
        'attendance.late_after'
      );

      expect(result).toBe(15);
    });

    it('should return null when key path does not exist', async () => {
      const configValue = { attendance: { late_after: 15 } };
      const chain = createChainMock({ value: configValue });
      mockFrom.mockReturnValue(chain);

      const result = await service.getConfigValue(
        TENANT_ID,
        'notification.default_channel'
      );

      expect(result).toBeNull();
    });

    it('should return null when config is empty (PGRST116)', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'not found' });
      mockFrom.mockReturnValue(chain);

      const result = await service.getConfigValue(TENANT_ID, 'anything');

      expect(result).toBeNull();
    });
  });

  /* ================================================================ */
  /* setConfigValue                                                    */
  /* ================================================================ */
  describe('setConfigValue', () => {
    it('should set a flat key value', async () => {
      const existingConfig = { attendance: { late_after: 10 } };

      // getConfig (inside setConfigValue)
      const getChain1 = createChainMock({ value: existingConfig });
      // getConfig (inside updateConfig)
      const getChain2 = createChainMock({
        value: { ...existingConfig, billing: { cycle: 'monthly' } },
      });
      // upsert
      const upsertChain = createChainMock({
        value: { attendance: { late_after: 10 }, billing: { cycle: 'monthly' } },
      });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getChain1;
        if (callCount === 2) return getChain2;
        return upsertChain;
      });

      await expect(
        service.setConfigValue(TENANT_ID, 'billing', { cycle: 'monthly' })
      ).resolves.toBeUndefined();

      // Verify upsert was called
      expect(upsertChain.upsert).toHaveBeenCalled();
    });

    it('should create intermediate objects for nested path', async () => {
      // getConfig returns empty config (PGRST116)
      const getChain1 = createChainMock(null, { code: 'PGRST116', message: 'not found' });
      // getConfig inside updateConfig also returns not found
      const getChain2 = createChainMock(null, { code: 'PGRST116', message: 'not found' });
      // upsert succeeds
      const upsertChain = createChainMock({
        value: { notification: { auto_notification: { check_in: true } } },
      });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getChain1;
        if (callCount === 2) return getChain2;
        return upsertChain;
      });

      await expect(
        service.setConfigValue(TENANT_ID, 'notification.auto_notification.check_in', true)
      ).resolves.toBeUndefined();

      // Verify the upsert was called (intermediate objects created)
      expect(upsertChain.upsert).toHaveBeenCalled();
      const upsertArg = (upsertChain.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
      // The merged config should have nested structure
      expect(upsertArg.value).toEqual(
        expect.objectContaining({
          notification: {
            auto_notification: {
              check_in: true,
            },
          },
        })
      );
    });

    it('should propagate error from updateConfig', async () => {
      // getConfig succeeds
      const getChain1 = createChainMock({ value: {} });
      // getConfig inside updateConfig succeeds
      const getChain2 = createChainMock({ value: {} });
      // upsert fails
      const upsertChain = createChainMock(null, { message: 'disk full' });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getChain1;
        if (callCount === 2) return getChain2;
        return upsertChain;
      });

      await expect(
        service.setConfigValue(TENANT_ID, 'ui.theme', 'dark')
      ).rejects.toThrow('Failed to update config: disk full');
    });
  });
});
