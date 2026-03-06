/**
 * useAttendance Hook Unit Tests
 *
 * Test targets:
 * - useAttendanceLogs: query hook for fetching attendance logs
 * - useCreateAttendanceLog: mutation for creating attendance log
 * - useUpdateAttendanceLog: mutation for updating attendance log
 * - useDeleteAttendanceLog: mutation for deleting attendance log
 * - fetchAttendanceLogs: standalone fetch function
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
const mockDeleteFn = vi.fn();
const mockCallRPC = vi.fn();

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDeleteFn(...args),
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

vi.mock('@hooks/use-student/src/execution-audit-utils', () => ({
  createExecutionAuditRecord: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@services/attendance-service', () => ({}));

import {
  useAttendanceLogs,
  fetchAttendanceLogs,
  useCreateAttendanceLog,
  useUpdateAttendanceLog,
  useDeleteAttendanceLog,
} from '../useAttendance';

import type { AttendanceLog, CreateAttendanceLogInput } from '@services/attendance-service';

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

const mockAttendanceLog: AttendanceLog = {
  id: 'log-1',
  tenant_id: 'test-tenant-id',
  student_id: 'student-1',
  class_id: 'class-1',
  occurred_at: '2026-03-06T09:00:00+09:00',
  attendance_type: 'check_in',
  status: 'present',
  notes: 'On time',
  created_at: '2026-03-06T09:00:00+09:00',
};

const mockAttendanceLogs: AttendanceLog[] = [
  mockAttendanceLog,
  {
    id: 'log-2',
    tenant_id: 'test-tenant-id',
    student_id: 'student-2',
    class_id: 'class-1',
    occurred_at: '2026-03-06T09:05:00+09:00',
    attendance_type: 'check_in',
    status: 'late',
    notes: '5 minutes late',
    created_at: '2026-03-06T09:05:00+09:00',
  },
];

// ===== Tests =====

describe('useAttendanceLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches attendance logs successfully with data', async () => {
    mockGet.mockResolvedValue({
      data: mockAttendanceLogs,
      error: null,
      success: true,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAttendanceLogs(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockAttendanceLogs);
    expect(result.current.data).toHaveLength(2);

    // apiClient.get called with correct table and options
    expect(mockGet).toHaveBeenCalledWith(
      'attendance_logs',
      expect.objectContaining({
        orderBy: { column: 'occurred_at', ascending: false },
        limit: 1000,
      })
    );
  });

  it('returns empty array when no attendance logs exist', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
      success: true,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAttendanceLogs(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
    expect(result.current.data).toHaveLength(0);
  });

  it('is enabled when tenantId exists', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
      success: true,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAttendanceLogs(), { wrapper });

    // Query should be enabled and fetch
    await waitFor(() => expect(result.current.isFetching || result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalled();
  });

  it('passes filter parameters to the query', async () => {
    mockGet.mockResolvedValue({
      data: [mockAttendanceLog],
      error: null,
      success: true,
    });

    const filter = {
      student_id: 'student-1',
      class_id: 'class-1',
      attendance_type: 'check_in' as const,
    };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAttendanceLogs(filter), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      'attendance_logs',
      expect.objectContaining({
        filters: expect.objectContaining({
          student_id: 'student-1',
          class_id: 'class-1',
          attendance_type: 'check_in',
        }),
      })
    );
  });

  it('excludes class_id filter when value is "all"', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
      success: true,
    });

    const filter = {
      class_id: 'all',
    };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAttendanceLogs(filter), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The filters should NOT contain class_id when it's 'all'
    const callArgs = mockGet.mock.calls[0];
    const filters = callArgs[1]?.filters;
    expect(filters?.class_id).toBeUndefined();
  });
});

describe('fetchAttendanceLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches logs successfully and returns data', async () => {
    mockGet.mockResolvedValue({
      data: mockAttendanceLogs,
      error: null,
      success: true,
    });

    const result = await fetchAttendanceLogs('test-tenant-id');

    expect(result).toEqual(mockAttendanceLogs);
    expect(result).toHaveLength(2);
    expect(mockGet).toHaveBeenCalledWith(
      'attendance_logs',
      expect.objectContaining({
        orderBy: { column: 'occurred_at', ascending: false },
        limit: 1000,
      })
    );
  });

  it('returns empty array when data is null', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: null,
      success: true,
    });

    const result = await fetchAttendanceLogs('test-tenant-id');

    expect(result).toEqual([]);
  });

  it('throws error when API returns error', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
      success: false,
    });

    await expect(fetchAttendanceLogs('test-tenant-id')).rejects.toThrow(
      'Database connection failed'
    );
  });

  it('applies date filters with KST timezone', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
      success: true,
    });

    await fetchAttendanceLogs('test-tenant-id', {
      date_from: '2026-03-06',
      date_to: '2026-03-06',
    });

    const callArgs = mockGet.mock.calls[0];
    const filters = callArgs[1]?.filters;

    // date_from should be converted to KST start of day
    expect(filters?.occurred_at?.gte).toBe('2026-03-06T00:00:00+09:00');
    // date_to should be converted to KST end of day
    expect(filters?.occurred_at?.lte).toBe('2026-03-06T23:59:59.999+09:00');
  });

  it('preserves timestamp format when date already includes time', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
      success: true,
    });

    await fetchAttendanceLogs('test-tenant-id', {
      date_from: '2026-03-06T10:00:00+09:00',
    });

    const callArgs = mockGet.mock.calls[0];
    const filters = callArgs[1]?.filters;

    // When date already includes 'T', it should be passed as-is
    expect(filters?.occurred_at?.gte).toBe('2026-03-06T10:00:00+09:00');
  });

  it('applies student_id and status filters', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
      success: true,
    });

    await fetchAttendanceLogs('test-tenant-id', {
      student_id: 'student-1',
      status: 'present',
    });

    const callArgs = mockGet.mock.calls[0];
    const filters = callArgs[1]?.filters;

    expect(filters?.student_id).toBe('student-1');
    expect(filters?.status).toBe('present');
  });
});

describe('useCreateAttendanceLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates attendance log successfully', async () => {
    const newLog: AttendanceLog = {
      ...mockAttendanceLog,
      id: 'log-new',
    };

    mockPost.mockResolvedValue({
      data: newLog,
      error: null,
      success: true,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAttendanceLog(), { wrapper });

    const input: CreateAttendanceLogInput = {
      student_id: 'student-1',
      class_id: 'class-1',
      occurred_at: '2026-03-06T09:00:00+09:00',
      attendance_type: 'check_in',
      status: 'present',
      notes: 'On time',
    };

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith(
      'attendance_logs',
      expect.objectContaining({
        student_id: 'student-1',
        class_id: 'class-1',
        attendance_type: 'check_in',
        status: 'present',
      })
    );
  });

  it('throws error when API returns error', async () => {
    mockPost.mockResolvedValue({
      data: null,
      error: { message: 'Insert failed' },
      success: false,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAttendanceLog(), { wrapper });

    const input: CreateAttendanceLogInput = {
      student_id: 'student-1',
      occurred_at: '2026-03-06T09:00:00+09:00',
      attendance_type: 'check_in',
      status: 'present',
    };

    await expect(
      act(async () => {
        await result.current.mutateAsync(input);
      })
    ).rejects.toThrow('Insert failed');
  });

  it('invalidates attendance-logs queries on success', async () => {
    mockPost.mockResolvedValue({
      data: { ...mockAttendanceLog, id: 'log-new' },
      error: null,
      success: true,
    });

    const { queryClient, wrapper } = createWrapper();

    // Set up initial cached data
    queryClient.setQueryData(
      ['attendance-logs', 'test-tenant-id', JSON.stringify(undefined)],
      mockAttendanceLogs
    );

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateAttendanceLog(), { wrapper });

    const input: CreateAttendanceLogInput = {
      student_id: 'student-1',
      occurred_at: '2026-03-06T09:00:00+09:00',
      attendance_type: 'check_in',
      status: 'present',
    };

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // invalidateQueries should have been called
    expect(invalidateSpy).toHaveBeenCalled();

    invalidateSpy.mockRestore();
  });
});

describe('useUpdateAttendanceLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates attendance log successfully', async () => {
    const updatedLog: AttendanceLog = {
      ...mockAttendanceLog,
      status: 'late',
      notes: 'Updated to late',
    };

    mockPatch.mockResolvedValue({
      data: updatedLog,
      error: null,
      success: true,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateAttendanceLog(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        logId: 'log-1',
        input: { status: 'late', notes: 'Updated to late' },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPatch).toHaveBeenCalledWith(
      'attendance_logs',
      'log-1',
      expect.objectContaining({
        status: 'late',
        notes: 'Updated to late',
      })
    );
  });

  it('throws error when API returns error', async () => {
    mockPatch.mockResolvedValue({
      data: null,
      error: { message: 'Update failed - record not found' },
      success: false,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateAttendanceLog(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          logId: 'log-nonexistent',
          input: { status: 'absent' },
        });
      })
    ).rejects.toThrow('Update failed - record not found');
  });

  it('invalidates attendance-logs queries on success', async () => {
    mockPatch.mockResolvedValue({
      data: { ...mockAttendanceLog, status: 'excused' },
      error: null,
      success: true,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateAttendanceLog(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        logId: 'log-1',
        input: { status: 'excused' },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalled();

    invalidateSpy.mockRestore();
  });
});

describe('useDeleteAttendanceLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes attendance log successfully', async () => {
    mockDeleteFn.mockResolvedValue({
      data: null,
      error: null,
      success: true,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteAttendanceLog(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('log-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDeleteFn).toHaveBeenCalledWith('attendance_logs', 'log-1');
  });

  it('throws error when API returns error', async () => {
    mockDeleteFn.mockResolvedValue({
      data: null,
      error: { message: 'Delete failed - permission denied' },
      success: false,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteAttendanceLog(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync('log-1');
      })
    ).rejects.toThrow('Delete failed - permission denied');
  });

  it('invalidates attendance-logs queries on success', async () => {
    mockDeleteFn.mockResolvedValue({
      data: null,
      error: null,
      success: true,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteAttendanceLog(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('log-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalled();

    invalidateSpy.mockRestore();
  });
});
