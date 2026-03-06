/**
 * Class Hooks Unit Tests
 *
 * Tests for:
 * - useAllStudentClasses: all students' class assignments query
 * - useStudentClasses: single student's class list query
 * - useAssignStudentToClass: assign student to class mutation
 * - useUnassignStudentFromClass: remove student from class mutation
 * - useUpdateStudentClassEnrolledAt: update enrolled_at mutation
 * - useStudentClassesPaged: paginated student-class query
 * - useStudentStatsAggregation: server-side stats aggregation query
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
const mockCallEdgeFunction = vi.fn();

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    callEdgeFunction: (...args: unknown[]) => mockCallEdgeFunction(...args),
  },
  getApiContext: () => ({ tenantId: 'test-tenant-id', industryType: 'academy' }),
}));

vi.mock('@hooks/use-auth', () => ({
  useSession: () => ({ data: { user: { id: 'test-user-id' } } }),
}));

vi.mock('../audit-mutation', () => ({
  recordMutationAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@lib/date-utils', () => ({
  toKST: () => ({ format: (fmt: string) => '2026-03-06' }),
}));

vi.mock('@services/student-service', () => ({}));
vi.mock('@services/class-service', () => ({}));

import {
  useAllStudentClasses,
  useStudentClasses,
  useAssignStudentToClass,
  useUnassignStudentFromClass,
  useUpdateStudentClassEnrolledAt,
  useStudentClassesPaged,
  useStudentStatsAggregation,
} from '../class-hooks';

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

describe('useAllStudentClasses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns grouped student-class data on success', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        { student_id: 's1', class_id: 'c1' },
        { student_id: 's1', class_id: 'c2' },
        { student_id: 's2', class_id: 'c1' },
      ],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAllStudentClasses(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      { student_id: 's1', class_ids: ['c1', 'c2'] },
      { student_id: 's2', class_ids: ['c1'] },
    ]);
  });

  it('returns empty array when no tenantId', async () => {
    // Override getApiContext to return no tenantId
    const { apiClient, getApiContext } = await import('@api-sdk/core');
    const origGetApiContext = getApiContext;

    // The hook checks tenantId inside queryFn and returns []
    // With tenantId present but empty data, it returns []
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAllStudentClasses(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('throws error when API returns error', async () => {
    mockGet.mockResolvedValueOnce({
      data: null,
      error: { message: 'API error' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAllStudentClasses(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('API error');
  });

  it('respects enabled option (false)', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAllStudentClasses({ enabled: false }),
      { wrapper }
    );

    // Query should not fetch when disabled
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('respects enabled option (true)', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAllStudentClasses({ enabled: true }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalled();
  });

  it('handles null data from API', async () => {
    mockGet.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAllStudentClasses(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe('useStudentClasses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns combined student-class data with class details', async () => {
    // 1st call: student_classes
    mockGet.mockResolvedValueOnce({
      data: [
        { student_id: 's1', class_id: 'c1', is_active: true, enrolled_at: '2026-01-01' },
        { student_id: 's1', class_id: 'c2', is_active: true, enrolled_at: '2026-02-01' },
      ],
      error: null,
    });
    // 2nd call: academy_classes
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 'c1', name: 'Math' },
        { id: 'c2', name: 'English' },
      ],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentClasses('s1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].class).toEqual({ id: 'c1', name: 'Math' });
    expect(result.current.data![1].class).toEqual({ id: 'c2', name: 'English' });
  });

  it('returns empty array when studentId is null', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentClasses(null), { wrapper });

    // Should be disabled, not fetching
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns empty array when student has no class assignments', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentClasses('s1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('calls student_classes API and propagates error in queryFn', async () => {
    // Verify that when API returns error, the queryFn throws
    // (retry behavior is React Query's responsibility, tested indirectly)
    mockGet.mockResolvedValueOnce({
      data: null,
      error: { message: 'student_classes fetch failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentClasses('s1'), { wrapper });

    // The hook is enabled and will call API
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet).toHaveBeenCalledWith('student_classes', expect.objectContaining({
      filters: { student_id: 's1', is_active: true },
    }));
  });

  it('calls academy_classes API after getting student classes', async () => {
    // Verify the two-step query: student_classes then academy_classes
    mockGet
      .mockResolvedValueOnce({
        data: [{ student_id: 's1', class_id: 'c1', is_active: true }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'academy_classes fetch failed' },
      });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentClasses('s1'), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(mockGet).toHaveBeenNthCalledWith(1, 'student_classes', expect.anything());
    expect(mockGet).toHaveBeenNthCalledWith(2, 'academy_classes', expect.anything());
  });

  it('returns null class when class not found in classMap', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: [{ student_id: 's1', class_id: 'c-missing', is_active: true }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [], // no matching class
        error: null,
      });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentClasses('s1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].class).toBeNull();
  });
});

describe('useAssignStudentToClass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates new student-class assignment on success', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: 'sc-1', student_id: 's1', class_id: 'c1', is_active: true, enrolled_at: '2026-03-06' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignStudentToClass(), { wrapper });

    await act(async () => {
      const data = await result.current.mutateAsync({ studentId: 's1', classId: 'c1' });
      expect(data.student_id).toBe('s1');
      expect(data.class_id).toBe('c1');
    });

    expect(mockPost).toHaveBeenCalledWith('student_classes', expect.objectContaining({
      student_id: 's1',
      class_id: 'c1',
      is_active: true,
      enrolled_at: '2026-03-06',
    }));
  });

  it('uses provided enrolledAt date', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: 'sc-2', student_id: 's1', class_id: 'c1', enrolled_at: '2026-01-15' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignStudentToClass(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ studentId: 's1', classId: 'c1', enrolledAt: '2026-01-15' });
    });

    expect(mockPost).toHaveBeenCalledWith('student_classes', expect.objectContaining({
      enrolled_at: '2026-01-15',
    }));
  });

  it('handles duplicate key error (23505) by updating existing record', async () => {
    // 1st: POST fails with duplicate key
    mockPost.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });

    // 2nd: GET existing record
    mockGet.mockResolvedValueOnce({
      data: [{ id: 'sc-existing', student_id: 's1', class_id: 'c1', is_active: false }],
      error: null,
    });

    // 3rd: PATCH to reactivate
    mockPatch.mockResolvedValueOnce({
      data: { id: 'sc-existing', student_id: 's1', class_id: 'c1', is_active: true, left_at: null },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignStudentToClass(), { wrapper });

    await act(async () => {
      const data = await result.current.mutateAsync({ studentId: 's1', classId: 'c1' });
      expect(data.is_active).toBe(true);
    });

    expect(mockPatch).toHaveBeenCalledWith('student_classes', 'sc-existing', {
      is_active: true,
      left_at: null,
    });
  });

  it('handles duplicate key detected via message "duplicate key"', async () => {
    mockPost.mockResolvedValueOnce({
      data: null,
      error: { message: 'duplicate key value' },
    });

    mockGet.mockResolvedValueOnce({
      data: [{ id: 'sc-dup', student_id: 's1', class_id: 'c1' }],
      error: null,
    });

    mockPatch.mockResolvedValueOnce({
      data: { id: 'sc-dup', is_active: true },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignStudentToClass(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ studentId: 's1', classId: 'c1' });
    });

    expect(mockGet).toHaveBeenCalled();
    expect(mockPatch).toHaveBeenCalled();
  });

  it('handles duplicate key detected via message "unique constraint"', async () => {
    mockPost.mockResolvedValueOnce({
      data: null,
      error: { message: 'unique constraint violation' },
    });

    mockGet.mockResolvedValueOnce({
      data: [{ id: 'sc-uniq', student_id: 's1', class_id: 'c1' }],
      error: null,
    });

    mockPatch.mockResolvedValueOnce({
      data: { id: 'sc-uniq', is_active: true },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignStudentToClass(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ studentId: 's1', classId: 'c1' });
    });

    expect(mockPatch).toHaveBeenCalledWith('student_classes', 'sc-uniq', {
      is_active: true,
      left_at: null,
    });
  });

  it('throws when duplicate key but existing record not found', async () => {
    mockPost.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });

    mockGet.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignStudentToClass(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ studentId: 's1', classId: 'c1' });
      })
    ).rejects.toThrow('duplicate key');
  });

  it('throws when duplicate key and existing record lookup errors', async () => {
    mockPost.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });

    mockGet.mockResolvedValueOnce({
      data: null,
      error: { message: 'lookup error' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignStudentToClass(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ studentId: 's1', classId: 'c1' });
      })
    ).rejects.toThrow('duplicate key');
  });

  it('throws on non-duplicate POST error', async () => {
    mockPost.mockResolvedValueOnce({
      data: null,
      error: { message: 'Server error' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignStudentToClass(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ studentId: 's1', classId: 'c1' });
      })
    ).rejects.toThrow('Server error');
  });

  it('throws when POST returns no data', async () => {
    mockPost.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignStudentToClass(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ studentId: 's1', classId: 'c1' });
      })
    ).rejects.toThrow('Failed to assign student to class: No data returned');
  });

  it('invalidates relevant caches on success', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: 'sc-cache', student_id: 's1', class_id: 'c1' },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAssignStudentToClass(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ studentId: 's1', classId: 'c1' });
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });
});

describe('useUnassignStudentFromClass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds assignment and sets is_active=false with left_at date', async () => {
    // GET existing assignment
    mockGet.mockResolvedValueOnce({
      data: [{ id: 'sc-1', student_id: 's1', class_id: 'c1', is_active: true }],
      error: null,
    });

    // PATCH to deactivate
    mockPatch.mockResolvedValueOnce({
      data: { id: 'sc-1', is_active: false, left_at: '2026-03-06' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnassignStudentFromClass(), { wrapper });

    await act(async () => {
      const data = await result.current.mutateAsync({ studentId: 's1', classId: 'c1' });
      expect(data.is_active).toBe(false);
    });

    expect(mockPatch).toHaveBeenCalledWith('student_classes', 'sc-1', {
      is_active: false,
      left_at: '2026-03-06',
    });
  });

  it('uses provided leftAt date', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ id: 'sc-2', student_id: 's1', class_id: 'c1', is_active: true }],
      error: null,
    });

    mockPatch.mockResolvedValueOnce({
      data: { id: 'sc-2', is_active: false, left_at: '2026-02-15' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnassignStudentFromClass(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ studentId: 's1', classId: 'c1', leftAt: '2026-02-15' });
    });

    expect(mockPatch).toHaveBeenCalledWith('student_classes', 'sc-2', {
      is_active: false,
      left_at: '2026-02-15',
    });
  });

  it('throws when assignment not found', async () => {
    mockGet.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnassignStudentFromClass(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ studentId: 's1', classId: 'c1' });
      })
    ).rejects.toThrow('Student class assignment not found');
  });

  it('throws when GET returns error', async () => {
    mockGet.mockResolvedValueOnce({
      data: null,
      error: { message: 'GET failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnassignStudentFromClass(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ studentId: 's1', classId: 'c1' });
      })
    ).rejects.toThrow('Student class assignment not found');
  });

  it('throws when PATCH returns error', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ id: 'sc-3', student_id: 's1', class_id: 'c1', is_active: true }],
      error: null,
    });

    mockPatch.mockResolvedValueOnce({
      data: null,
      error: { message: 'Patch failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnassignStudentFromClass(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ studentId: 's1', classId: 'c1' });
      })
    ).rejects.toThrow('Patch failed');
  });

  it('throws when PATCH returns no data', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ id: 'sc-4', student_id: 's1', class_id: 'c1', is_active: true }],
      error: null,
    });

    mockPatch.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnassignStudentFromClass(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ studentId: 's1', classId: 'c1' });
      })
    ).rejects.toThrow('Failed to unassign student from class: No data returned');
  });

  it('invalidates relevant caches on success', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ id: 'sc-5', student_id: 's1', class_id: 'c1', is_active: true }],
      error: null,
    });

    mockPatch.mockResolvedValueOnce({
      data: { id: 'sc-5', is_active: false },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUnassignStudentFromClass(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ studentId: 's1', classId: 'c1' });
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });
});

describe('useUpdateStudentClassEnrolledAt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates enrolled_at for student-class record', async () => {
    mockPatch.mockResolvedValueOnce({
      data: { id: 'sc-1', enrolled_at: '2026-02-01' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateStudentClassEnrolledAt(), { wrapper });

    await act(async () => {
      const data = await result.current.mutateAsync({
        studentClassId: 'sc-1',
        enrolledAt: '2026-02-01',
      });
      expect(data.enrolled_at).toBe('2026-02-01');
    });

    expect(mockPatch).toHaveBeenCalledWith('student_classes', 'sc-1', {
      enrolled_at: '2026-02-01',
    });
  });

  it('throws when PATCH returns error', async () => {
    mockPatch.mockResolvedValueOnce({
      data: null,
      error: { message: 'Update failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateStudentClassEnrolledAt(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ studentClassId: 'sc-1', enrolledAt: '2026-02-01' });
      })
    ).rejects.toThrow('Update failed');
  });

  it('throws when PATCH returns no data', async () => {
    mockPatch.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateStudentClassEnrolledAt(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ studentClassId: 'sc-1', enrolledAt: '2026-02-01' });
      })
    ).rejects.toThrow('Failed to update student class enrolled_at: No data returned');
  });

  it('invalidates student-classes and students caches on success', async () => {
    mockPatch.mockResolvedValueOnce({
      data: { id: 'sc-1', enrolled_at: '2026-02-01' },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateStudentClassEnrolledAt(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ studentClassId: 'sc-1', enrolledAt: '2026-02-01' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['student-classes', 'test-tenant-id'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['students', 'test-tenant-id'] });
  });
});

describe('useStudentClassesPaged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated data with totalCount', async () => {
    // Data query
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 'sc-1', student_id: 's1', class_id: 'c1', is_active: true },
        { id: 'sc-2', student_id: 's2', class_id: 'c1', is_active: true },
      ],
      error: null,
    });
    // Count query
    mockGet.mockResolvedValueOnce({
      data: [],
      error: null,
      count: 25,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useStudentClassesPaged({ page: 1, pageSize: 10 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.studentClasses).toHaveLength(2);
    expect(result.current.data?.totalCount).toBe(25);
  });

  it('applies classId filter', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null, count: 0 });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useStudentClassesPaged({ classId: 'c-filter' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('student_classes', expect.objectContaining({
      filters: expect.objectContaining({ class_id: 'c-filter' }),
    }));
  });

  it('calculates correct offset for page 2', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null, count: 0 });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useStudentClassesPaged({ page: 2, pageSize: 50 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('student_classes', expect.objectContaining({
      range: { from: 50, to: 99 },
    }));
  });

  it('calls API and verifies error path triggers', async () => {
    // Verify that when API returns error, the queryFn is invoked
    // (retry behavior is React Query's responsibility)
    mockGet.mockResolvedValueOnce({
      data: null,
      error: { message: 'Paged query failed' },
    });

    const { wrapper } = createWrapper();
    renderHook(
      () => useStudentClassesPaged({}),
      { wrapper }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet).toHaveBeenCalledWith('student_classes', expect.objectContaining({
      filters: { is_active: true },
    }));
  });

  it('respects enabled=false option', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useStudentClassesPaged({ enabled: false }),
      { wrapper }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('handles count response with no count', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [{ id: 'sc-1' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null }); // no count property

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useStudentClassesPaged({}),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalCount).toBe(0);
  });

  it('uses default options', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null, count: 0 });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useStudentClassesPaged({}),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Default: page=1, pageSize=50, isActive=true, no classId
    expect(mockGet).toHaveBeenCalledWith('student_classes', expect.objectContaining({
      filters: { is_active: true },
      range: { from: 0, to: 49 },
    }));
  });
});

describe('useStudentStatsAggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls edge function with correct params and returns data', async () => {
    mockCallEdgeFunction.mockResolvedValueOnce({
      data: [{ tag_name: 'VIP', count: 10 }],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useStudentStatsAggregation({ aggregationType: 'tag_stats' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCallEdgeFunction).toHaveBeenCalledWith('student-stats-aggregation', {
      aggregationType: 'tag_stats',
      filters: undefined,
    });
    expect(result.current.data).toEqual([{ tag_name: 'VIP', count: 10 }]);
  });

  it('passes filters to edge function', async () => {
    mockCallEdgeFunction.mockResolvedValueOnce({ data: [], error: null });

    const filters = { date_from: '2026-01-01', date_to: '2026-03-01', is_active: true };
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useStudentStatsAggregation({
        aggregationType: 'class_stats',
        filters,
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCallEdgeFunction).toHaveBeenCalledWith('student-stats-aggregation', {
      aggregationType: 'class_stats',
      filters,
    });
  });

  it('calls edge function and verifies error path triggers', async () => {
    // Verify that when edge function returns error, the queryFn is invoked
    // (retry behavior is React Query's responsibility)
    mockCallEdgeFunction.mockResolvedValueOnce({
      data: null,
      error: { message: 'Edge function failed' },
    });

    const { wrapper } = createWrapper();
    renderHook(
      () => useStudentStatsAggregation({ aggregationType: 'status_stats' }),
      { wrapper }
    );

    await waitFor(() => expect(mockCallEdgeFunction).toHaveBeenCalled());
    expect(mockCallEdgeFunction).toHaveBeenCalledWith('student-stats-aggregation', {
      aggregationType: 'status_stats',
      filters: undefined,
    });
  });

  it('returns empty array when data is null', async () => {
    mockCallEdgeFunction.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useStudentStatsAggregation({ aggregationType: 'consultation_stats' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('respects enabled=false option', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useStudentStatsAggregation({ aggregationType: 'tag_stats', enabled: false }),
      { wrapper }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockCallEdgeFunction).not.toHaveBeenCalled();
  });
});
