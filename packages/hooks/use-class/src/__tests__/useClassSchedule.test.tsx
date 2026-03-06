/**
 * useClassSchedule Hook Unit Tests
 *
 * Tests for schedule-related hooks:
 * - useClassStatistics: class statistics query
 * - useClassTeachers: class-teacher assignment query
 * - useCheckScheduleConflicts: schedule conflict detection
 * - useAssignTeacher: teacher assignment mutation
 * - useUnassignTeacher: teacher unassignment mutation
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
  useClassStatistics,
  useClassTeachers,
  useCheckScheduleConflicts,
  useAssignTeacher,
  useUnassignTeacher,
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

const mockClassTeacher = {
  id: 'ct-1',
  tenant_id: 'test-tenant-id',
  class_id: 'class-1',
  teacher_id: 'teacher-1',
  role: 'teacher',
  assigned_at: '2026-01-01',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
};

const mockClassTeacher2 = {
  id: 'ct-2',
  tenant_id: 'test-tenant-id',
  class_id: 'class-1',
  teacher_id: 'teacher-2',
  role: 'assistant',
  assigned_at: '2026-01-02',
  is_active: true,
  created_at: '2026-01-02T00:00:00Z',
};

// ===== Tests =====

describe('useClassStatistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns statistics for a class with students', async () => {
    mockGet.mockResolvedValue({
      data: [mockClass],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClassStatistics('class-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      attendance_rate: 0,
      capacity_rate: 50, // (10 / 20) * 100
      late_rate: 0,
    });

    expect(mockGet).toHaveBeenCalledWith('academy_classes', {
      filters: { id: 'class-1' },
      limit: 1,
    });
  });

  it('returns 0 capacity_rate when capacity is 0', async () => {
    mockGet.mockResolvedValue({
      data: [{ ...mockClass, capacity: 0, current_count: 0 }],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClassStatistics('class-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      attendance_rate: 0,
      capacity_rate: 0,
      late_rate: 0,
    });
  });

  it('is disabled when classId is null', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClassStatistics(null), { wrapper });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockGet).not.toHaveBeenCalled();
  });

  it('throws error when class not found', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClassStatistics('non-existent'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Class not found');
  });

  it('throws error when API returns error', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClassStatistics('class-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Class not found');
  });

  it('is disabled when tenantId is empty', async () => {
    const { getApiContext } = await import('@api-sdk/core');
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      tenantId: '',
      industryType: 'academy',
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClassStatistics('class-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('useClassTeachers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns teacher list for a class', async () => {
    mockGet.mockResolvedValue({
      data: [mockClassTeacher, mockClassTeacher2],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClassTeachers('class-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].teacher_id).toBe('teacher-1');
    expect(result.current.data![1].teacher_id).toBe('teacher-2');

    expect(mockGet).toHaveBeenCalledWith('class_teachers', {
      filters: { class_id: 'class-1', is_active: true },
    });
  });

  it('returns empty array when no teachers assigned', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClassTeachers('class-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('is disabled when classId is null', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClassTeachers(null), { wrapper });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns empty array when data is null', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClassTeachers('class-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('throws error when API returns error', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { message: 'Query failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClassTeachers('class-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Query failed');
  });
});

describe('useCheckScheduleConflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects schedule conflicts with single dayOfWeek', async () => {
    const conflictResult = {
      has_conflicts: true,
      conflict_count: 1,
      conflicts: [
        {
          type: 'teacher_conflict',
          class_id: 'class-2',
          class_name: 'English Class',
          teacher_name: 'Teacher A',
          day_of_week: 'monday',
          start_time: '14:00:00',
          end_time: '15:30:00',
          message: 'Teacher conflict detected',
        },
      ],
    };

    mockCallRPC.mockResolvedValue({
      data: conflictResult,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckScheduleConflicts(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        dayOfWeek: 'monday',
        startTime: '14:00:00',
        endTime: '15:30:00',
        teacherIds: ['teacher-1'],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(conflictResult);

    expect(mockCallRPC).toHaveBeenCalledWith('check_schedule_conflicts', {
      p_class_id: null,
      p_day_of_week: ['monday'],
      p_start_time: '14:00:00',
      p_end_time: '15:30:00',
      p_teacher_ids: ['teacher-1'],
      p_room: null,
    });
  });

  it('detects schedule conflicts with multiple dayOfWeek', async () => {
    const conflictResult = {
      has_conflicts: false,
      conflict_count: 0,
      conflicts: [],
    };

    mockCallRPC.mockResolvedValue({
      data: conflictResult,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckScheduleConflicts(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        dayOfWeek: ['monday', 'wednesday'],
        startTime: '10:00:00',
        endTime: '11:30:00',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCallRPC).toHaveBeenCalledWith('check_schedule_conflicts', {
      p_class_id: null,
      p_day_of_week: ['monday', 'wednesday'],
      p_start_time: '10:00:00',
      p_end_time: '11:30:00',
      p_teacher_ids: null,
      p_room: null,
    });
  });

  it('passes classId and room when provided', async () => {
    mockCallRPC.mockResolvedValue({
      data: { has_conflicts: false, conflict_count: 0, conflicts: [] },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckScheduleConflicts(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        classId: 'class-1',
        dayOfWeek: 'friday',
        startTime: '09:00:00',
        endTime: '10:00:00',
        room: 'Room A',
      });
    });

    expect(mockCallRPC).toHaveBeenCalledWith('check_schedule_conflicts', {
      p_class_id: 'class-1',
      p_day_of_week: ['friday'],
      p_start_time: '09:00:00',
      p_end_time: '10:00:00',
      p_teacher_ids: null,
      p_room: 'Room A',
    });
  });

  it('throws error when RPC fails', async () => {
    mockCallRPC.mockResolvedValue({
      data: null,
      error: { message: 'RPC execution failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckScheduleConflicts(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          dayOfWeek: 'monday',
          startTime: '14:00:00',
          endTime: '15:30:00',
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
    const { result } = renderHook(() => useCheckScheduleConflicts(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          dayOfWeek: 'monday',
          startTime: '14:00:00',
          endTime: '15:30:00',
        });
      })
    ).rejects.toThrow('Tenant ID is required');

    // Restore mock
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
  });
});

describe('useAssignTeacher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assigns a teacher to a class', async () => {
    const assignmentResult = {
      ...mockClassTeacher,
      assigned_at: '2026-03-06',
    };

    mockPost.mockResolvedValue({
      data: assignmentResult,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        class_id: 'class-1',
        teacher_id: 'teacher-1',
        role: 'teacher' as const,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('class_teachers', {
      class_id: 'class-1',
      teacher_id: 'teacher-1',
      role: 'teacher',
      assigned_at: '2026-03-06',
      is_active: true,
    });
  });

  it('uses provided assigned_at date', async () => {
    mockPost.mockResolvedValue({
      data: { ...mockClassTeacher, assigned_at: '2026-02-15' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        class_id: 'class-1',
        teacher_id: 'teacher-2',
        role: 'assistant' as const,
        assigned_at: '2026-02-15',
      });
    });

    expect(mockPost).toHaveBeenCalledWith('class_teachers', {
      class_id: 'class-1',
      teacher_id: 'teacher-2',
      role: 'assistant',
      assigned_at: '2026-02-15',
      is_active: true,
    });
  });

  it('throws error when POST fails', async () => {
    mockPost.mockResolvedValue({
      data: null,
      error: { message: 'Assignment failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignTeacher(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          class_id: 'class-1',
          teacher_id: 'teacher-1',
          role: 'teacher' as const,
        });
      })
    ).rejects.toThrow('Assignment failed');
  });

  it('throws error when tenantId is missing', async () => {
    const { getApiContext } = await import('@api-sdk/core');
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
      tenantId: '',
      industryType: 'academy',
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignTeacher(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          class_id: 'class-1',
          teacher_id: 'teacher-1',
          role: 'teacher' as const,
        });
      })
    ).rejects.toThrow('Tenant ID is required');

    // Restore mock
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
  });

  it('invalidates class-teachers and classes queries on success', async () => {
    mockPost.mockResolvedValue({
      data: { ...mockClassTeacher, class_id: 'class-1' },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAssignTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        class_id: 'class-1',
        teacher_id: 'teacher-1',
        role: 'teacher' as const,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['class-teachers', 'test-tenant-id', 'class-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['classes', 'test-tenant-id'],
    });
  });

  it('creates execution audit record on success', async () => {
    mockPost.mockResolvedValue({
      data: { ...mockClassTeacher },
      error: null,
    });

    const { createExecutionAuditRecord } = await import(
      '@hooks/use-student/src/execution-audit-utils'
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssignTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        class_id: 'class-1',
        teacher_id: 'teacher-1',
        role: 'teacher' as const,
      });
    });

    expect(createExecutionAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        operation_type: 'class.assign-teacher',
        status: 'success',
      }),
      'test-user-id'
    );
  });
});

describe('useUnassignTeacher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unassigns a teacher from a class', async () => {
    // First call: find the assignment
    mockGet.mockResolvedValueOnce({
      data: [{ id: 'ct-1', class_id: 'class-1', teacher_id: 'teacher-1', is_active: true }],
      error: null,
    });

    // Second call: patch to deactivate
    mockPatch.mockResolvedValue({
      data: { ...mockClassTeacher, is_active: false, unassigned_at: '2026-03-06' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnassignTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        classId: 'class-1',
        teacherId: 'teacher-1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify find query
    expect(mockGet).toHaveBeenCalledWith('class_teachers', {
      filters: { class_id: 'class-1', teacher_id: 'teacher-1', is_active: true },
      limit: 1,
    });

    // Verify patch to deactivate
    expect(mockPatch).toHaveBeenCalledWith('class_teachers', 'ct-1', {
      is_active: false,
      unassigned_at: '2026-03-06',
    });
  });

  it('throws error when assignment not found (empty data)', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnassignTeacher(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          classId: 'class-1',
          teacherId: 'teacher-1',
        });
      })
    ).rejects.toThrow('Class teacher assignment not found');
  });

  it('throws error when find query fails', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { message: 'Find query failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnassignTeacher(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          classId: 'class-1',
          teacherId: 'teacher-1',
        });
      })
    ).rejects.toThrow('Class teacher assignment not found');
  });

  it('throws error when assignment has no id', async () => {
    mockGet.mockResolvedValue({
      data: [{ class_id: 'class-1', teacher_id: 'teacher-1' }], // no id field
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnassignTeacher(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          classId: 'class-1',
          teacherId: 'teacher-1',
        });
      })
    ).rejects.toThrow('Assignment not found');
  });

  it('throws error when patch fails', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ id: 'ct-1', class_id: 'class-1', teacher_id: 'teacher-1' }],
      error: null,
    });

    mockPatch.mockResolvedValue({
      data: null,
      error: { message: 'Patch failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnassignTeacher(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          classId: 'class-1',
          teacherId: 'teacher-1',
        });
      })
    ).rejects.toThrow('Patch failed');
  });

  it('throws error when tenantId is missing', async () => {
    const { getApiContext } = await import('@api-sdk/core');
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
      tenantId: '',
      industryType: 'academy',
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnassignTeacher(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          classId: 'class-1',
          teacherId: 'teacher-1',
        });
      })
    ).rejects.toThrow('Tenant ID is required');

    // Restore mock
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
  });

  it('invalidates class-teachers and classes queries on success', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ id: 'ct-1', class_id: 'class-1', teacher_id: 'teacher-1' }],
      error: null,
    });

    mockPatch.mockResolvedValue({
      data: { ...mockClassTeacher, is_active: false },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUnassignTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        classId: 'class-1',
        teacherId: 'teacher-1',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['class-teachers', 'test-tenant-id', 'class-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['classes', 'test-tenant-id'],
    });
  });

  it('creates execution audit record on success', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ id: 'ct-1', class_id: 'class-1', teacher_id: 'teacher-1' }],
      error: null,
    });

    mockPatch.mockResolvedValue({
      data: { ...mockClassTeacher, is_active: false },
      error: null,
    });

    const { createExecutionAuditRecord } = await import(
      '@hooks/use-student/src/execution-audit-utils'
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnassignTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        classId: 'class-1',
        teacherId: 'teacher-1',
      });
    });

    expect(createExecutionAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        operation_type: 'class.unassign-teacher',
        status: 'success',
      }),
      'test-user-id'
    );
  });
});
