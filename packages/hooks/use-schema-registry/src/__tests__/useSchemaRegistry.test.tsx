/**
 * useSchemaRegistry Hook Tests
 *
 * Tests for:
 * - useSchemaList: Schema list query with filters
 * - useSchema: Single schema query by ID
 * - useCreateSchema: Draft schema creation mutation
 * - useUpdateSchema: Draft schema update mutation with optimistic locking
 * - useActivateSchema: Schema activation mutation (draft -> active)
 * - useDeleteSchema: Draft schema deletion mutation
 * - useIsSuperAdmin: Super admin role check
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { ReactNode } from 'react';

// ===== Mocks =====

const mockCallRPC = vi.fn();

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    callRPC: (...args: unknown[]) => mockCallRPC(...args),
  },
  getApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
}));

// Mock supabase client for useIsSuperAdmin
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockGetUser = vi.fn();

vi.mock('@lib/supabase-client', () => ({
  createClient: () => ({
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

import {
  useSchemaList,
  useSchema,
  useCreateSchema,
  useUpdateSchema,
  useActivateSchema,
  useDeleteSchema,
} from '../useSchemaRegistry';
import type { SchemaRegistryEntry, CreateSchemaInput, UpdateSchemaInput } from '../useSchemaRegistry';
import { useIsSuperAdmin } from '../useIsSuperAdmin';

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

function createMockSchemaEntry(overrides?: Partial<SchemaRegistryEntry>): SchemaRegistryEntry {
  return {
    id: 'schema-1',
    entity: 'student',
    industry_type: 'academy',
    version: '1.0.0',
    status: 'draft',
    schema_json: { type: 'form', fields: [] } as unknown as SchemaRegistryEntry['schema_json'],
    min_supported_client: '1.0.0',
    migration_script: null,
    registered_by: 'admin-1',
    registered_at: '2026-01-01T00:00:00Z',
    activated_at: null,
    deprecated_at: null,
    ...overrides,
  };
}

// ===== useSchemaList Tests =====

describe('useSchemaList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches schema list without filters', async () => {
    const mockSchemas = [
      createMockSchemaEntry({ id: 'schema-1' }),
      createMockSchemaEntry({ id: 'schema-2', entity: 'teacher' }),
    ];
    mockCallRPC.mockResolvedValue({ data: mockSchemas, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSchemaList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCallRPC).toHaveBeenCalledWith('get_schema_registry_list', {
      p_entity: null,
      p_industry_type: null,
      p_status: null,
    });
    expect(result.current.data).toHaveLength(2);
  });

  it('fetches schema list with entity filter', async () => {
    const mockSchemas = [createMockSchemaEntry({ entity: 'student' })];
    mockCallRPC.mockResolvedValue({ data: mockSchemas, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useSchemaList({ entity: 'student' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCallRPC).toHaveBeenCalledWith('get_schema_registry_list', {
      p_entity: 'student',
      p_industry_type: null,
      p_status: null,
    });
    expect(result.current.data).toHaveLength(1);
  });

  it('fetches schema list with status filter', async () => {
    const mockSchemas = [createMockSchemaEntry({ status: 'active' })];
    mockCallRPC.mockResolvedValue({ data: mockSchemas, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useSchemaList({ status: 'active' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCallRPC).toHaveBeenCalledWith('get_schema_registry_list', {
      p_entity: null,
      p_industry_type: null,
      p_status: 'active',
    });
  });

  it('fetches schema list with all filters', async () => {
    mockCallRPC.mockResolvedValue({ data: [], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useSchemaList({ entity: 'student', industry_type: 'academy', status: 'draft' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCallRPC).toHaveBeenCalledWith('get_schema_registry_list', {
      p_entity: 'student',
      p_industry_type: 'academy',
      p_status: 'draft',
    });
    expect(result.current.data).toEqual([]);
  });

  it('handles RPC error gracefully', async () => {
    mockCallRPC.mockResolvedValue({
      data: null,
      error: { message: 'Permission denied', code: '42501' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSchemaList(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toContain('Failed to fetch schemas');
    expect(result.current.error?.message).toContain('Permission denied');
  });

  it('returns empty array when data is null', async () => {
    mockCallRPC.mockResolvedValue({ data: null, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSchemaList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });
});

// ===== useSchema Tests =====

describe('useSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches single schema by ID', async () => {
    const mockSchema = createMockSchemaEntry({ id: 'schema-abc' });
    mockCallRPC.mockResolvedValue({ data: [mockSchema], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSchema('schema-abc'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCallRPC).toHaveBeenCalledWith('get_schema_registry', { p_id: 'schema-abc' });
    expect(result.current.data?.id).toBe('schema-abc');
  });

  it('handles non-array response', async () => {
    const mockSchema = createMockSchemaEntry({ id: 'schema-single' });
    mockCallRPC.mockResolvedValue({ data: mockSchema, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSchema('schema-single'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.id).toBe('schema-single');
  });

  it('throws error when schema not found (empty array)', async () => {
    mockCallRPC.mockResolvedValue({ data: [], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSchema('nonexistent'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Schema not found');
  });

  it('throws error when schema not found (null data)', async () => {
    mockCallRPC.mockResolvedValue({ data: null, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSchema('nonexistent'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Schema not found');
  });

  it('is disabled when id is empty string', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSchema(''), { wrapper });

    // Query should not fire since enabled: !!id is false
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockCallRPC).not.toHaveBeenCalled();
  });

  it('handles RPC error', async () => {
    mockCallRPC.mockResolvedValue({
      data: null,
      error: { message: 'Internal server error', code: '50000' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSchema('schema-err'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toContain('Failed to fetch schema');
  });
});

// ===== useCreateSchema Tests =====

describe('useCreateSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates schema via RPC and invalidates cache', async () => {
    const createdSchema = createMockSchemaEntry({ id: 'new-schema-1', entity: 'enrollment' });
    mockCallRPC.mockResolvedValue({ data: [createdSchema], error: null });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateSchema(), { wrapper });

    const input: CreateSchemaInput = {
      entity: 'enrollment',
      version: '1.0.0',
      minSupportedClient: '1.0.0',
      schema_json: { type: 'form', fields: [] } as unknown as CreateSchemaInput['schema_json'],
    };

    let returnedData: SchemaRegistryEntry | undefined;
    await act(async () => {
      returnedData = await result.current.mutateAsync(input);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(returnedData?.id).toBe('new-schema-1');
    expect(mockCallRPC).toHaveBeenCalledWith('create_schema_registry', {
      p_entity: 'enrollment',
      p_industry_type: null,
      p_version: '1.0.0',
      p_min_supported_client: '1.0.0',
      p_min_client: null,
      p_schema_json: input.schema_json,
      p_migration_script: null,
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['schema-registry'] });
  });

  it('passes optional fields correctly', async () => {
    const createdSchema = createMockSchemaEntry();
    mockCallRPC.mockResolvedValue({ data: [createdSchema], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateSchema(), { wrapper });

    const input: CreateSchemaInput = {
      entity: 'teacher',
      industry_type: 'academy',
      version: '2.0.0',
      minSupportedClient: '2.0.0',
      minClient: '1.5.0',
      schema_json: { type: 'table', columns: [] } as unknown as CreateSchemaInput['schema_json'],
      migration_script: 'ALTER TABLE ...',
    };

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(mockCallRPC).toHaveBeenCalledWith('create_schema_registry', {
      p_entity: 'teacher',
      p_industry_type: 'academy',
      p_version: '2.0.0',
      p_min_supported_client: '2.0.0',
      p_min_client: '1.5.0',
      p_schema_json: input.schema_json,
      p_migration_script: 'ALTER TABLE ...',
    });
  });

  it('throws error when RPC fails', async () => {
    mockCallRPC.mockResolvedValue({
      data: null,
      error: { message: 'Duplicate entity/version', code: '23505' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateSchema(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          entity: 'student',
          version: '1.0.0',
          minSupportedClient: '1.0.0',
          schema_json: {} as CreateSchemaInput['schema_json'],
        });
      })
    ).rejects.toThrow('Failed to create schema');
  });

  it('throws error when no data returned', async () => {
    mockCallRPC.mockResolvedValue({ data: [], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateSchema(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          entity: 'student',
          version: '1.0.0',
          minSupportedClient: '1.0.0',
          schema_json: {} as CreateSchemaInput['schema_json'],
        });
      })
    ).rejects.toThrow('No data returned');
  });
});

// ===== useUpdateSchema Tests =====

describe('useUpdateSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates schema and invalidates cache', async () => {
    const updatedSchema = createMockSchemaEntry({ id: 'schema-upd' });
    mockCallRPC.mockResolvedValue({ data: [updatedSchema], error: null });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateSchema(), { wrapper });

    const input: UpdateSchemaInput = {
      schema_json: { type: 'form', fields: [{ name: 'updated' }] } as unknown as UpdateSchemaInput['schema_json'],
    };

    let returnedData: SchemaRegistryEntry | undefined;
    await act(async () => {
      returnedData = await result.current.mutateAsync({ id: 'schema-upd', input });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(returnedData?.id).toBe('schema-upd');
    expect(mockCallRPC).toHaveBeenCalledWith('update_schema_registry', {
      p_id: 'schema-upd',
      p_schema_json: input.schema_json,
      p_migration_script: null,
      p_min_supported_client: null,
      p_min_client: null,
      p_expected_updated_at: null,
    });

    // Should invalidate both list and detail caches
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['schema-registry'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['schema-registry', 'schema-upd'] });
  });

  it('passes optimistic locking timestamp', async () => {
    const updatedSchema = createMockSchemaEntry();
    mockCallRPC.mockResolvedValue({ data: [updatedSchema], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateSchema(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'schema-lock',
        input: { schema_json: {} as UpdateSchemaInput['schema_json'] },
        expectedUpdatedAt: '2026-01-01T12:00:00Z',
      });
    });

    expect(mockCallRPC).toHaveBeenCalledWith('update_schema_registry', expect.objectContaining({
      p_expected_updated_at: '2026-01-01T12:00:00Z',
    }));
  });

  it('throws localized error on optimistic locking conflict', async () => {
    mockCallRPC.mockResolvedValue({
      data: null,
      error: { message: 'Schema was modified by another user', code: 'CONFLICT' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateSchema(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          id: 'schema-conflict',
          input: { schema_json: {} as UpdateSchemaInput['schema_json'] },
          expectedUpdatedAt: '2026-01-01T00:00:00Z',
        });
      })
    ).rejects.toThrow('다른 관리자가 먼저 수정했습니다');
  });

  it('throws generic error on non-conflict failure', async () => {
    mockCallRPC.mockResolvedValue({
      data: null,
      error: { message: 'Network timeout', code: 'TIMEOUT' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateSchema(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          id: 'schema-err',
          input: { schema_json: {} as UpdateSchemaInput['schema_json'] },
        });
      })
    ).rejects.toThrow('Failed to update schema: Network timeout');
  });
});

// ===== useActivateSchema Tests =====

describe('useActivateSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('activates schema then re-fetches full data', async () => {
    const activatedSchema = createMockSchemaEntry({ id: 'schema-act', status: 'active' });

    // First call: activate_schema_registry, Second call: get_schema_registry
    mockCallRPC
      .mockResolvedValueOnce({ data: [{ id: 'schema-act', status: 'active' }], error: null })
      .mockResolvedValueOnce({ data: [activatedSchema], error: null });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useActivateSchema(), { wrapper });

    await act(async () => {
      const resultData = await result.current.mutateAsync('schema-act');
      expect(resultData.id).toBe('schema-act');
      expect(resultData.status).toBe('active');
    });

    // Verify activation RPC was called
    expect(mockCallRPC).toHaveBeenCalledWith('activate_schema_registry', { p_id: 'schema-act' });

    // Verify re-fetch RPC was called
    expect(mockCallRPC).toHaveBeenCalledWith('get_schema_registry', { p_id: 'schema-act' });

    // Cache invalidation
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['schema-registry'] });
  });

  it('throws error when activation RPC fails', async () => {
    mockCallRPC.mockResolvedValue({
      data: null,
      error: { message: 'Only draft schemas can be activated', code: 'INVALID_STATUS' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useActivateSchema(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync('schema-wrong-status');
      })
    ).rejects.toThrow('Failed to activate schema');
  });

  it('throws error when re-fetch after activation fails', async () => {
    mockCallRPC
      .mockResolvedValueOnce({ data: [{ id: 'schema-act-err' }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'Schema not found' } });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useActivateSchema(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync('schema-act-err');
      })
    ).rejects.toThrow('Failed to fetch activated schema');
  });

  it('throws error when activation returns empty data', async () => {
    mockCallRPC.mockResolvedValue({ data: [], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useActivateSchema(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync('schema-empty');
      })
    ).rejects.toThrow('Failed to activate schema: No data returned');
  });
});

// ===== useDeleteSchema Tests =====

describe('useDeleteSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes schema and invalidates cache', async () => {
    mockCallRPC.mockResolvedValue({ data: null, error: null });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteSchema(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('schema-del');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCallRPC).toHaveBeenCalledWith('delete_schema_registry', { p_id: 'schema-del' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['schema-registry'] });
  });

  it('throws error when deletion fails', async () => {
    mockCallRPC.mockResolvedValue({
      data: null,
      error: { message: 'Cannot delete active schema', code: 'INVALID_STATUS' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteSchema(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync('schema-active');
      })
    ).rejects.toThrow('Failed to delete schema');
  });
});

// ===== useIsSuperAdmin Tests =====

describe('useIsSuperAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chained mock behavior
    mockEq.mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it('returns true when user has super_admin role', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-admin', email: 'admin@test.com' } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({ data: { role: 'super_admin' }, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIsSuperAdmin(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('user_platform_roles');
    expect(mockSelect).toHaveBeenCalledWith('role');
  });

  it('returns false when user does not have super_admin role', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-regular', email: 'user@test.com' } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIsSuperAdmin(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(false);
  });

  it('returns false when getUser fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Auth session expired' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIsSuperAdmin(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(false);
  });

  it('returns false when user is null (not logged in)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIsSuperAdmin(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(false);
  });

  it('returns false when role query errors', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-err', email: 'err@test.com' } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'RLS policy violation', code: '42501' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIsSuperAdmin(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(false);
  });
});
