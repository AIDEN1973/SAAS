/**
 * useClass Hook Unit Tests
 *
 * Tests for the main class management hooks:
 * - useClasses: class list query
 * - useClass: single class detail query
 * - useCreateClass: class creation via RPC
 * - useUpdateClass: class update via PATCH + optional teacher RPC
 * - useDeleteClass: soft delete via PATCH (status -> 'inactive')
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { ReactNode } from 'react';

// ===== Mock function references =====

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();
const mockCallRPC = vi.fn();

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    callRPC: (...args: unknown[]) => mockCallRPC(...args),
  },
  getApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
}));

vi.mock('@hooks/use-auth', () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: 'test-user-id' } },
  })),
}));

vi.mock('@services/class-service', () => ({}));
vi.mock('@core/party', () => ({}));

vi.mock('@lib/date-utils', () => ({
  toKST: vi.fn(() => ({ format: () => '2026-03-06' })),
}));

vi.mock('@hooks/use-student/src/execution-audit-utils', () => ({
  createExecutionAuditRecord: vi.fn().mockResolvedValue(undefined),
}));

import {
  useClasses,
  useClass,
  useCreateClass,
  useUpdateClass,
  useDeleteClass,
  fetchClasses,
} from '../useClass';

// ===== Test Wrapper =====

function createWrapper(queryClient?: QueryClient) {
  const qc =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  return {
    queryClient: qc,
    wrapper: ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children),
  };
}

// ===== Mock Data =====

const mockClass = {
  id: 'class-1',
  tenant_id: 'test-tenant-id',
  name: 'Math Class A',
  subject: 'math',
  grade: '3',
  day_of_week: 'monday',
  start_time: '14:00:00',
  end_time: '15:30:00',
  capacity: 20,
  current_count: 10,
  color: '#FF5733',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockClass2 = {
  id: 'class-2',
  tenant_id: 'test-tenant-id',
  name: 'English Class B',
  subject: 'english',
  grade: '4',
  day_of_week: 'wednesday',
  start_time: '16:00:00',
  end_time: '17:30:00',
  capacity: 15,
  current_count: 8,
  color: '#3366FF',
  status: 'active',
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

// ===== Tests =====

describe('useClasses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns class list on success', async () => {
    mockGet.mockResolvedValue({
      data: [mockClass, mockClass2],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClasses(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].id).toBe('class-1');
    expect(result.current.data![1].id).toBe('class-2');

    // Verify apiClient.get was called with correct table
    expect(mockGet).toHaveBeenCalledWith('academy_classes', {
      filters: {},
    });
  });

  it('returns empty array when no classes exist', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClasses(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('is disabled when tenantId is empty', async () => {
    // Override getApiContext to return empty tenantId
    const { getApiContext } = await import('@api-sdk/core');
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      tenantId: '',
      industryType: 'academy',
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClasses(), { wrapper });

    // Query should not fetch when tenantId is falsy
    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockGet).not.toHaveBeenCalled();
  });

  it('passes filter to apiClient.get', async () => {
    mockGet.mockResolvedValue({
      data: [mockClass],
      error: null,
    });

    const filter = { status: 'active' as const, subject: 'math' };
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClasses(filter), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('academy_classes', {
      filters: filter,
    });
  });

  it('throws error when apiClient returns error', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { message: 'Database connection error' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClasses(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Database connection error');
  });
});

describe('useClass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns single class on success', async () => {
    mockGet.mockResolvedValue({
      data: [mockClass],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClass('class-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeTruthy();
    expect(result.current.data!.id).toBe('class-1');
    expect(result.current.data!.name).toBe('Math Class A');

    // Verify apiClient.get called with id filter and limit
    expect(mockGet).toHaveBeenCalledWith('academy_classes', {
      filters: { id: 'class-1' },
      limit: 1,
    });
  });

  it('returns null when classId is null (query disabled)', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClass(null), { wrapper });

    // Query should be idle when classId is null
    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns null when class is not found', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useClass('non-existent-class'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });

  it('throws error when apiClient returns error', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClass('class-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Not found');
  });
});

describe('useCreateClass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls RPC create_class_with_teachers with teacher_ids', async () => {
    mockCallRPC.mockResolvedValue({
      data: { ...mockClass, id: 'new-class-1' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateClass(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'New Math Class',
        subject: 'math',
        grade: '3',
        teacher_ids: ['teacher-1', 'teacher-2'],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify RPC was called with correct params
    expect(mockCallRPC).toHaveBeenCalledWith(
      'create_class_with_teachers',
      expect.objectContaining({
        p_tenant_id: 'test-tenant-id',
        p_name: 'New Math Class',
        p_subject: 'math',
        p_grade: '3',
        p_teacher_ids: ['teacher-1', 'teacher-2'],
        p_created_by: 'test-user-id',
      })
    );
  });

  it('calls RPC create_class_with_teachers without teacher_ids', async () => {
    mockCallRPC.mockResolvedValue({
      data: { ...mockClass, id: 'new-class-2' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateClass(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'English Class',
        subject: 'english',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // RPC still called but with null teacher_ids
    expect(mockCallRPC).toHaveBeenCalledWith(
      'create_class_with_teachers',
      expect.objectContaining({
        p_tenant_id: 'test-tenant-id',
        p_name: 'English Class',
        p_subject: 'english',
        p_teacher_ids: null,
        p_teacher_roles: null,
      })
    );
  });

  it('applies default values for optional fields', async () => {
    mockCallRPC.mockResolvedValue({
      data: { ...mockClass, id: 'new-class-3' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateClass(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Minimal Class',
      });
    });

    expect(mockCallRPC).toHaveBeenCalledWith(
      'create_class_with_teachers',
      expect.objectContaining({
        p_day_of_week: 'monday',
        p_start_time: '14:00:00',
        p_end_time: '15:30:00',
        p_capacity: 20,
        p_status: 'active',
        p_color: null,
        p_room: null,
      })
    );
  });

  it('throws error when RPC fails', async () => {
    mockCallRPC.mockResolvedValue({
      data: null,
      error: { message: 'RPC execution failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateClass(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          name: 'Failing Class',
        });
      })
    ).rejects.toThrow('RPC execution failed');
  });

  it('throws error when tenantId is missing', async () => {
    const { getApiContext } = await import('@api-sdk/core');
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
      tenantId: '',
      industryType: 'academy',
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateClass(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ name: 'No Tenant Class' });
      })
    ).rejects.toThrow('Tenant ID is required');

    // Restore mock
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
  });

  it('invalidates classes query on success', async () => {
    mockCallRPC.mockResolvedValue({
      data: { ...mockClass, id: 'new-class-4' },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateClass(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Invalidate Test' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['classes', 'test-tenant-id'],
    });
  });
});

describe('useUpdateClass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls apiClient.patch for class fields', async () => {
    mockPatch.mockResolvedValue({
      data: { ...mockClass, name: 'Updated Name' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateClass(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        classId: 'class-1',
        input: { name: 'Updated Name', subject: 'science' },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify PATCH was called with correct params (teacher_ids excluded)
    expect(mockPatch).toHaveBeenCalledWith(
      'academy_classes',
      'class-1',
      { name: 'Updated Name', subject: 'science' }
    );
  });

  it('calls update_class_teachers RPC when teacher_ids is provided', async () => {
    mockPatch.mockResolvedValue({
      data: { ...mockClass, name: 'With Teachers' },
      error: null,
    });

    mockCallRPC.mockResolvedValue({
      success: true,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateClass(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        classId: 'class-1',
        input: {
          name: 'With Teachers',
          teacher_ids: ['teacher-1', 'teacher-3'],
        },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // PATCH for class fields (without teacher_ids)
    expect(mockPatch).toHaveBeenCalledWith(
      'academy_classes',
      'class-1',
      { name: 'With Teachers' }
    );

    // RPC for teacher assignment update
    expect(mockCallRPC).toHaveBeenCalledWith('update_class_teachers', {
      p_class_id: 'class-1',
      p_teacher_ids: ['teacher-1', 'teacher-3'],
    });
  });

  it('throws error when PATCH fails', async () => {
    mockPatch.mockResolvedValue({
      data: null,
      error: { message: 'Update failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateClass(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          classId: 'class-1',
          input: { name: 'Fail Update' },
        });
      })
    ).rejects.toThrow('Update failed');
  });

  it('throws error when teacher RPC fails', async () => {
    mockPatch.mockResolvedValue({
      data: { ...mockClass },
      error: null,
    });

    mockCallRPC.mockResolvedValue({
      success: false,
      error: { message: 'Teacher assignment failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateClass(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          classId: 'class-1',
          input: { teacher_ids: ['bad-teacher'] },
        });
      })
    ).rejects.toThrow('Teacher assignment failed');
  });

  it('invalidates classes, class detail, and class-teachers queries on success', async () => {
    mockPatch.mockResolvedValue({
      data: { ...mockClass },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateClass(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        classId: 'class-1',
        input: { name: 'Invalidate Test' },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['classes', 'test-tenant-id'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['class', 'test-tenant-id', 'class-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['class-teachers', 'test-tenant-id', 'class-1'],
    });
  });
});

describe('useDeleteClass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('performs soft delete by patching status to inactive', async () => {
    mockPatch.mockResolvedValue({
      data: { ...mockClass, status: 'inactive' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteClass(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('class-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify soft delete: PATCH with status: 'inactive'
    expect(mockPatch).toHaveBeenCalledWith(
      'academy_classes',
      'class-1',
      { status: 'inactive' }
    );
  });

  it('throws error when PATCH fails', async () => {
    mockPatch.mockResolvedValue({
      data: null,
      error: { message: 'Delete failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteClass(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync('class-1');
      })
    ).rejects.toThrow('Delete failed');
  });

  it('throws error when tenantId is missing', async () => {
    const { getApiContext } = await import('@api-sdk/core');
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
      tenantId: '',
      industryType: 'academy',
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteClass(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync('class-1');
      })
    ).rejects.toThrow('Tenant ID is required');

    // Restore mock
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
  });

  it('invalidates classes query on success', async () => {
    mockPatch.mockResolvedValue({
      data: { ...mockClass, status: 'inactive' },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteClass(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('class-1');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['classes', 'test-tenant-id'],
    });
  });
});

describe('fetchClasses (exported utility)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when tenantId is empty', async () => {
    const result = await fetchClasses('');
    expect(result).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('calls apiClient.get and returns data', async () => {
    mockGet.mockResolvedValue({
      data: [mockClass],
      error: null,
    });

    const result = await fetchClasses('test-tenant-id');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('class-1');
    expect(mockGet).toHaveBeenCalledWith('academy_classes', {
      filters: {},
    });
  });

  it('passes filter to apiClient.get', async () => {
    mockGet.mockResolvedValue({
      data: [mockClass],
      error: null,
    });

    const filter = { status: 'active' as const };
    await fetchClasses('test-tenant-id', filter);

    expect(mockGet).toHaveBeenCalledWith('academy_classes', {
      filters: filter,
    });
  });

  it('throws error when apiClient returns error', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { message: 'Query failed' },
    });

    await expect(fetchClasses('test-tenant-id')).rejects.toThrow('Query failed');
  });

  it('returns empty array when data is null', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await fetchClasses('test-tenant-id');
    expect(result).toEqual([]);
  });
});
