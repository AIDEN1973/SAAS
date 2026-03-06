/**
 * useConfig Hook Tests
 *
 * Tests for:
 * - useConfig: Tenant config query (fetches from tenant_settings KV store)
 * - useTenantSettingByPath: Path-based nested config lookup (reuses useConfig cache)
 * - useUpdateConfig: Config update mutation (merge, PATCH/POST, audit, kakao normalization)
 * - useStoreLocation: Store location query with zone mapping
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { ReactNode } from 'react';

// ===== Mocks =====

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: vi.fn(),
    callRPC: vi.fn(),
  },
  getApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
}));

vi.mock('@hooks/use-auth', () => ({
  useSession: () => ({ data: { user: { id: 'test-user-id' } } }),
}));

vi.mock('@hooks/use-student/src/execution-audit-utils', () => ({
  createExecutionAuditRecord: vi.fn().mockResolvedValue(undefined),
}));

import { useConfig, useTenantSettingByPath, useUpdateConfig, useStoreLocation } from '../useConfig';
import type { TenantConfig } from '@core/config';
import { createExecutionAuditRecord } from '@hooks/use-student/src/execution-audit-utils';

// ===== Test Helpers =====

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

const sampleConfig: TenantConfig = {
  attendance: {
    late_after: 10,
    absent_after: 30,
    auto_notification: true,
    notification_channel: 'sms',
    qr_enabled: false,
  },
  notification: {
    auto_notification: {
      check_in: true,
      check_out: true,
      absent: true,
      overdue: false,
    },
    default_channel: 'kakao_at',
  },
  billing: {
    cycle: 'monthly',
  },
  ui: {
    theme: 'light',
    zoom: 100,
  },
};

// ===== useConfig Tests =====

describe('useConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches config from tenant_settings KV store', async () => {
    mockGet.mockResolvedValue({
      data: [{ key: 'config', value: sampleConfig }],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useConfig(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('tenant_settings', {
      filters: { key: 'config' },
    });
    expect(result.current.data).toEqual(sampleConfig);
  });

  it('returns empty object when no config record exists', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useConfig(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({});
  });

  it('returns empty object when config record has no value', async () => {
    mockGet.mockResolvedValue({
      data: [{ key: 'config', value: null }],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useConfig(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({});
  });

  it('returns empty object on PGRST116 error (no data)', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { message: 'No rows found', code: 'PGRST116' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useConfig(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({});
  });

  it('returns empty object on PGRST205 error (table not in schema cache)', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { message: 'Table not found in schema cache', code: 'PGRST205' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useConfig(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({});
  });

  it('returns empty object on unknown error (does not throw)', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { message: 'Internal error', code: '50000' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useConfig(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({});
  });

  it('returns empty object when data is null', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useConfig(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({});
  });

  it('ignores records with different key', async () => {
    mockGet.mockResolvedValue({
      data: [{ key: 'other-setting', value: { some: 'data' } }],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useConfig(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({});
  });
});

// ===== useTenantSettingByPath Tests =====

describe('useTenantSettingByPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts top-level config value by path', async () => {
    mockGet.mockResolvedValue({
      data: [{ key: 'config', value: sampleConfig }],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTenantSettingByPath('billing'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual({ cycle: 'monthly' });
  });

  it('extracts deeply nested config value', async () => {
    mockGet.mockResolvedValue({
      data: [{ key: 'config', value: sampleConfig }],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useTenantSettingByPath('notification.auto_notification.check_in'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBe(true);
  });

  it('returns null for nonexistent path (Fail Closed)', async () => {
    mockGet.mockResolvedValue({
      data: [{ key: 'config', value: sampleConfig }],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useTenantSettingByPath('nonexistent.deep.path'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
  });

  it('returns null for empty path', async () => {
    mockGet.mockResolvedValue({
      data: [{ key: 'config', value: sampleConfig }],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useTenantSettingByPath(''),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
  });

  it('returns null when config is empty', async () => {
    mockGet.mockResolvedValue({ data: [], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useTenantSettingByPath('attendance.late_after'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
  });
});

// ===== useUpdateConfig Tests =====

describe('useUpdateConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('patches existing config record and updates cache', async () => {
    // Existing config fetch
    mockGet.mockResolvedValue({
      data: [{ id: 'setting-1', key: 'config', value: sampleConfig }],
      error: null,
    });

    // PATCH success
    const updatedConfig = { ...sampleConfig, attendance: { ...sampleConfig.attendance, late_after: 15 } };
    mockPatch.mockResolvedValue({
      data: { key: 'config', value: updatedConfig },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    const { result } = renderHook(() => useUpdateConfig(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ attendance: { late_after: 15 } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify PATCH was called with merged config
    expect(mockPatch).toHaveBeenCalledWith(
      'tenant_settings',
      'setting-1',
      expect.objectContaining({
        value: expect.objectContaining({
          attendance: expect.objectContaining({ late_after: 15 }),
        }),
      })
    );

    // Verify cache was updated directly
    expect(setQueryDataSpy).toHaveBeenCalledWith(
      ['config', 'test-tenant-id'],
      expect.anything()
    );
  });

  it('creates new config record via POST when none exists', async () => {
    // No existing config
    mockGet.mockResolvedValue({ data: [], error: null });

    const newConfig = { attendance: { late_after: 20 } };
    mockPost.mockResolvedValue({
      data: { key: 'config', value: newConfig },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateConfig(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ attendance: { late_after: 20 } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify POST was called with tenant_id
    expect(mockPost).toHaveBeenCalledWith('tenant_settings', expect.objectContaining({
      tenant_id: 'test-tenant-id',
      key: 'config',
      value: expect.objectContaining({
        attendance: expect.objectContaining({ late_after: 20 }),
      }),
    }));
  });

  it('normalizes legacy kakao channel to kakao_at (SSOT-3)', async () => {
    mockGet.mockResolvedValue({
      data: [{ id: 'setting-1', key: 'config', value: {} }],
      error: null,
    });
    mockPatch.mockResolvedValue({
      data: { key: 'config', value: { attendance: { notification_channel: 'kakao_at' } } },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateConfig(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        attendance: { notification_channel: 'kakao' as unknown as 'sms' | 'kakao_at' },
      });
    });

    // Verify that the PATCH payload has normalized 'kakao' to 'kakao_at'
    const patchCall = mockPatch.mock.calls[0];
    const patchValue = patchCall[2].value;
    expect(patchValue.attendance.notification_channel).toBe('kakao_at');
  });

  it('creates execution audit record on success', async () => {
    mockGet.mockResolvedValue({
      data: [{ id: 'setting-1', key: 'config', value: {} }],
      error: null,
    });
    mockPatch.mockResolvedValue({
      data: { key: 'config', value: { billing: { cycle: 'yearly' } } },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateConfig(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ billing: { cycle: 'yearly' } });
    });

    expect(createExecutionAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        operation_type: 'config.update',
        status: 'success',
        summary: expect.stringContaining('billing'),
        reference: expect.objectContaining({
          entity_type: 'tenant',
          entity_id: 'test-tenant-id',
        }),
      }),
      'test-user-id'
    );
  });

  it('throws error when PATCH fails', async () => {
    mockGet.mockResolvedValue({
      data: [{ id: 'setting-1', key: 'config', value: {} }],
      error: null,
    });
    mockPatch.mockResolvedValue({
      data: null,
      error: { message: 'Permission denied' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateConfig(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ ui: { theme: 'dark' } });
      })
    ).rejects.toThrow('Permission denied');
  });

  it('throws error when POST fails with foreign key violation', async () => {
    mockGet.mockResolvedValue({ data: [], error: null });
    mockPost.mockResolvedValue({
      data: null,
      error: { message: 'tenant_settings_tenant_id_fkey foreign key constraint' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateConfig(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ ui: { theme: 'dark' } });
      })
    ).rejects.toThrow('테넌트가 존재하지 않습니다');
  });

  it('merges input with existing config', async () => {
    mockGet.mockResolvedValue({
      data: [{
        id: 'setting-1',
        key: 'config',
        value: { attendance: { late_after: 10 }, billing: { cycle: 'monthly' } },
      }],
      error: null,
    });
    mockPatch.mockResolvedValue({
      data: {
        key: 'config',
        value: { attendance: { late_after: 10 }, billing: { cycle: 'yearly' } },
      },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateConfig(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ billing: { cycle: 'yearly' } });
    });

    // Verify merged config was sent (attendance preserved, billing updated)
    const patchCall = mockPatch.mock.calls[0];
    const mergedValue = patchCall[2].value;
    expect(mergedValue.attendance).toEqual({ late_after: 10 });
    expect(mergedValue.billing).toEqual({ cycle: 'yearly' });
  });

  it('uses fallback config when PATCH response has no value', async () => {
    mockGet.mockResolvedValue({
      data: [{ id: 'setting-1', key: 'config', value: {} }],
      error: null,
    });
    mockPatch.mockResolvedValue({
      data: { key: 'config' }, // no value field
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    const { result } = renderHook(() => useUpdateConfig(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ ui: { zoom: 120 } });
    });

    // Should use mergedConfig as fallback
    expect(setQueryDataSpy).toHaveBeenCalledWith(
      ['config', 'test-tenant-id'],
      expect.objectContaining({ ui: { zoom: 120 } })
    );
  });
});

// ===== useStoreLocation Tests =====

describe('useStoreLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches store location with zone mapping', async () => {
    // core_stores response
    mockGet.mockImplementation((table: string) => {
      if (table === 'core_stores') {
        return Promise.resolve({
          data: [{
            id: 'store-1',
            address: '서울시 강남구 역삼동 123-45',
            sido_code: '11',
            sido_name: '서울특별시',
            sigungu_code: '11680',
            sigungu_name: '강남구',
            dong_code: '1168010100',
            dong_name: '역삼동',
          }],
          error: null,
        });
      }
      if (table === 'core_sido_zone_mappings') {
        return Promise.resolve({
          data: [{
            zone_id: 'zone-1',
            core_region_zones: {
              zone_code: 'CAPITAL',
              zone_name: '수도권',
            },
          }],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStoreLocation(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      region: '서울특별시 강남구 역삼동',
      si: '서울특별시',
      gu: '강남구',
      dong: '역삼동',
      location_code: '1168010100',
      sigungu_code: '11680',
      sido_code: '11',
      zone_code: 'CAPITAL',
      zone_name: '수도권',
      address: '서울시 강남구 역삼동 123-45',
    });
  });

  it('returns empty location when store has no dong_code', async () => {
    mockGet.mockImplementation((table: string) => {
      if (table === 'core_stores') {
        return Promise.resolve({
          data: [{
            id: 'store-nocode',
            address: '서울시 강남구',
            sido_code: null,
            sido_name: null,
            sigungu_code: null,
            sigungu_name: null,
            dong_code: null,
            dong_name: null,
          }],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStoreLocation(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.region).toBe('');
    expect(result.current.data?.location_code).toBe('');
    expect(result.current.data?.zone_code).toBe('');
  });

  it('returns empty location when no store found', async () => {
    mockGet.mockResolvedValue({ data: [], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStoreLocation(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.region).toBe('');
    expect(result.current.data?.address).toBe('');
  });

  it('returns empty location when store query errors', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { message: 'Table not found', code: 'PGRST205' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStoreLocation(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.region).toBe('');
  });

  it('handles missing zone mapping gracefully', async () => {
    mockGet.mockImplementation((table: string) => {
      if (table === 'core_stores') {
        return Promise.resolve({
          data: [{
            id: 'store-nozone',
            address: '제주시 한림읍',
            sido_code: '50',
            sido_name: '제주특별자치도',
            sigungu_code: '50110',
            sigungu_name: '제주시',
            dong_code: '5011025300',
            dong_name: '한림읍',
          }],
          error: null,
        });
      }
      if (table === 'core_sido_zone_mappings') {
        // No zone mapping found
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStoreLocation(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.si).toBe('제주특별자치도');
    expect(result.current.data?.zone_code).toBe('');
    expect(result.current.data?.zone_name).toBe('');
  });

  it('passes correct select and filter params to API', async () => {
    mockGet.mockImplementation((table: string) => {
      if (table === 'core_stores') {
        return Promise.resolve({
          data: [{
            id: 'store-1',
            address: '서울시',
            sido_code: '11',
            sido_name: '서울',
            sigungu_code: '11680',
            sigungu_name: '강남구',
            dong_code: '1168010100',
            dong_name: '역삼동',
          }],
          error: null,
        });
      }
      if (table === 'core_sido_zone_mappings') {
        return Promise.resolve({
          data: [{ zone_id: 'z', core_region_zones: { zone_code: 'C', zone_name: 'Cap' } }],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    const { wrapper } = createWrapper();
    renderHook(() => useStoreLocation(), { wrapper });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('core_stores', expect.objectContaining({
        select: 'id,address,sido_code,sido_name,sigungu_code,sigungu_name,dong_code,dong_name',
      }));
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('core_sido_zone_mappings', expect.objectContaining({
        select: 'zone_id,core_region_zones(zone_code,zone_name)',
        filters: { sido_code: '11' },
      }));
    });
  });
});
