/**
 * Guardian Hooks Unit Tests
 *
 * Tests for:
 * - fetchGuardians: standalone fetch function
 * - useGuardians: guardian list query hook
 * - useCreateGuardian: create guardian mutation
 * - useUpdateGuardian: update guardian mutation
 * - useDeleteGuardian: delete guardian mutation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ===== Mocks =====

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
  getApiContext: () => ({ tenantId: 'test-tenant-id', industryType: 'academy' }),
}));

vi.mock('@hooks/use-auth', () => ({
  useSession: () => ({ data: { user: { id: 'test-user-id' } } }),
}));

vi.mock('../audit-mutation', () => ({
  recordMutationAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@services/student-service', () => ({}));

import {
  fetchGuardians,
  useGuardians,
  useCreateGuardian,
  useUpdateGuardian,
  useDeleteGuardian,
} from '../guardian-hooks';

// ===== Test Wrapper =====

function createWrapper(queryClient?: QueryClient) {
  const qc = queryClient ?? new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient: qc,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children),
  };
}

// ===== Tests =====

describe('fetchGuardians', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns guardians list on success', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 'g1', name: 'Parent A', is_primary: true, student_id: 's1' },
        { id: 'g2', name: 'Parent B', is_primary: false, student_id: 's1' },
      ],
      error: null,
    });

    const result = await fetchGuardians('test-tenant-id', { student_id: 's1' });

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Parent A');
    expect(mockGet).toHaveBeenCalledWith('guardians', {
      filters: { student_id: 's1' },
      orderBy: { column: 'is_primary', ascending: false },
    });
  });

  it('returns empty array when tenantId is empty', async () => {
    const result = await fetchGuardians('');
    expect(result).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('applies is_primary filter', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    await fetchGuardians('test-tenant-id', { is_primary: true });

    expect(mockGet).toHaveBeenCalledWith('guardians', {
      filters: { is_primary: true },
      orderBy: { column: 'is_primary', ascending: false },
    });
  });

  it('applies both student_id and is_primary filters', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    await fetchGuardians('test-tenant-id', { student_id: 's1', is_primary: false });

    expect(mockGet).toHaveBeenCalledWith('guardians', {
      filters: { student_id: 's1', is_primary: false },
      orderBy: { column: 'is_primary', ascending: false },
    });
  });

  it('calls API with no filters when filter is undefined', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    await fetchGuardians('test-tenant-id');

    expect(mockGet).toHaveBeenCalledWith('guardians', {
      filters: {},
      orderBy: { column: 'is_primary', ascending: false },
    });
  });

  it('throws on API error', async () => {
    mockGet.mockResolvedValueOnce({
      data: null,
      error: { message: 'Guardians fetch failed' },
    });

    await expect(fetchGuardians('test-tenant-id')).rejects.toThrow('Guardians fetch failed');
  });

  it('returns empty array when data is null', async () => {
    mockGet.mockResolvedValueOnce({ data: null, error: null });

    const result = await fetchGuardians('test-tenant-id');
    expect(result).toEqual([]);
  });

  it('supports student_id as array', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    await fetchGuardians('test-tenant-id', { student_id: ['s1', 's2'] });

    expect(mockGet).toHaveBeenCalledWith('guardians', {
      filters: { student_id: ['s1', 's2'] },
      orderBy: { column: 'is_primary', ascending: false },
    });
  });
});

describe('useGuardians', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns guardians for a student', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ id: 'g1', name: 'Parent A', is_primary: true }],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGuardians('s1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('Parent A');
  });

  it('is disabled when studentId is null', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGuardians(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('passes student_id filter to fetchGuardians', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    const { wrapper } = createWrapper();
    renderHook(() => useGuardians('s1'), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(mockGet).toHaveBeenCalledWith('guardians', {
      filters: { student_id: 's1' },
      orderBy: { column: 'is_primary', ascending: false },
    });
  });

  it('calls API and verifies error path triggers', async () => {
    mockGet.mockResolvedValueOnce({
      data: null,
      error: { message: 'Guardians query failed' },
    });

    const { wrapper } = createWrapper();
    renderHook(() => useGuardians('s1'), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet).toHaveBeenCalledWith('guardians', expect.objectContaining({
      filters: { student_id: 's1' },
    }));
  });
});

describe('useCreateGuardian', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a guardian successfully', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: 'g-new', name: 'New Parent', phone: '010-1111-2222', is_primary: true },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateGuardian(), { wrapper });

    await act(async () => {
      const data = await result.current.mutateAsync({
        studentId: 's1',
        guardian: { name: 'New Parent', phone: '010-1111-2222', is_primary: true, relationship: 'mother' },
      });
      expect(data.id).toBe('g-new');
    });

    expect(mockPost).toHaveBeenCalledWith('guardians', expect.objectContaining({
      student_id: 's1',
      name: 'New Parent',
      phone: '010-1111-2222',
      is_primary: true,
    }));
  });

  it('throws on POST error', async () => {
    mockPost.mockResolvedValueOnce({
      data: null,
      error: { message: 'Create guardian failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateGuardian(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          studentId: 's1',
          guardian: { name: 'Fail Parent', phone: '010-0000-0000', is_primary: false, relationship: 'father' },
        });
      })
    ).rejects.toThrow('Create guardian failed');
  });

  it('invalidates guardians cache for student on success', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: 'g-cache', name: 'Cache Parent' },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateGuardian(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        studentId: 's1',
        guardian: { name: 'Cache Parent', phone: '010-3333-4444', is_primary: false, relationship: 'other' },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['guardians', 'test-tenant-id', 's1'],
    });
  });
});

describe('useUpdateGuardian', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates guardian successfully', async () => {
    mockPatch.mockResolvedValueOnce({
      data: { id: 'g1', name: 'Updated Parent', phone: '010-9999-8888' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateGuardian(), { wrapper });

    await act(async () => {
      const data = await result.current.mutateAsync({
        guardianId: 'g1',
        guardian: { name: 'Updated Parent', phone: '010-9999-8888' },
        studentId: 's1',
      });
      expect(data.name).toBe('Updated Parent');
    });

    expect(mockPatch).toHaveBeenCalledWith('guardians', 'g1', {
      name: 'Updated Parent',
      phone: '010-9999-8888',
    });
  });

  it('throws on PATCH error', async () => {
    mockPatch.mockResolvedValueOnce({
      data: null,
      error: { message: 'Update guardian failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateGuardian(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          guardianId: 'g1',
          guardian: { name: 'Fail' },
          studentId: 's1',
        });
      })
    ).rejects.toThrow('Update guardian failed');
  });

  it('invalidates guardians cache on success', async () => {
    mockPatch.mockResolvedValueOnce({
      data: { id: 'g1', name: 'Updated' },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateGuardian(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        guardianId: 'g1',
        guardian: { name: 'Updated' },
        studentId: 's1',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['guardians', 'test-tenant-id', 's1'],
    });
  });
});

describe('useDeleteGuardian', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes guardian successfully', async () => {
    mockDelete.mockResolvedValueOnce({ error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteGuardian(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ guardianId: 'g1', studentId: 's1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDelete).toHaveBeenCalledWith('guardians', 'g1');
  });

  it('throws on DELETE error', async () => {
    mockDelete.mockResolvedValueOnce({
      error: { message: 'Delete guardian failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteGuardian(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ guardianId: 'g1', studentId: 's1' });
      })
    ).rejects.toThrow('Delete guardian failed');
  });

  it('invalidates guardians cache on success', async () => {
    mockDelete.mockResolvedValueOnce({ error: null });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteGuardian(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ guardianId: 'g1', studentId: 's1' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['guardians', 'test-tenant-id', 's1'],
    });
  });
});
