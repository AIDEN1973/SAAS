/**
 * useClassTeacher Hook Unit Tests
 *
 * Tests for teacher management hooks:
 * - useTeachers: teacher list query with filters
 * - useTeacher: single teacher detail query
 * - useCreateTeacher: teacher creation via RPC
 * - useDeleteTeacher: teacher soft delete via RPC
 * - useResignTeacher: teacher resignation via PATCH
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
  useTeachers,
  useTeacher,
  useCreateTeacher,
  useDeleteTeacher,
  useResignTeacher,
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

const mockPersonWithTeacher = {
  id: 'person-1',
  tenant_id: 'test-tenant-id',
  name: 'Teacher Kim',
  email: 'kim@test.com',
  phone: '010-1234-5678',
  address: 'Seoul',
  person_type: 'teacher',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  academy_teachers: [
    {
      employee_id: 'EMP-001',
      specialization: 'math',
      hire_date: '2025-01-01',
      status: 'active',
      position: 'teacher',
      login_id: 'kim@academy.com',
      user_id: 'user-1',
      profile_image_url: null,
      bio: 'Math teacher',
      notes: null,
      pay_type: 'monthly',
      base_salary: 3000000,
      hourly_rate: null,
      bank_name: 'KB',
      bank_account: '1234-5678',
      salary_notes: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      created_by: 'admin-1',
      updated_by: null,
      deleted_at: null,
    },
  ],
};

const mockPersonWithTeacher2 = {
  id: 'person-2',
  tenant_id: 'test-tenant-id',
  name: 'Teacher Park',
  email: 'park@test.com',
  phone: '010-9876-5432',
  address: 'Busan',
  person_type: 'teacher',
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  academy_teachers: [
    {
      employee_id: 'EMP-002',
      specialization: 'english',
      hire_date: '2025-03-01',
      status: 'active',
      position: 'manager',
      login_id: 'park@academy.com',
      user_id: 'user-2',
      profile_image_url: null,
      bio: null,
      notes: null,
      pay_type: 'hourly',
      base_salary: null,
      hourly_rate: 50000,
      bank_name: 'Shinhan',
      bank_account: '9876-5432',
      salary_notes: null,
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      created_by: 'admin-1',
      updated_by: null,
      deleted_at: null,
    },
  ],
};

const mockPersonWithTeacherResigned = {
  id: 'person-3',
  tenant_id: 'test-tenant-id',
  name: 'Teacher Lee',
  email: 'lee@test.com',
  phone: '010-5555-5555',
  address: null,
  person_type: 'teacher',
  created_at: '2026-01-03T00:00:00Z',
  updated_at: '2026-01-03T00:00:00Z',
  academy_teachers: [
    {
      employee_id: 'EMP-003',
      specialization: 'science',
      hire_date: '2024-06-01',
      status: 'resigned',
      position: 'teacher',
      login_id: null,
      user_id: null,
      profile_image_url: null,
      bio: null,
      notes: null,
      pay_type: null,
      base_salary: null,
      hourly_rate: null,
      bank_name: null,
      bank_account: null,
      salary_notes: null,
      created_at: '2026-01-03T00:00:00Z',
      updated_at: '2026-01-03T00:00:00Z',
      created_by: null,
      updated_by: null,
      deleted_at: null,
    },
  ],
};

const mockAcademyTeacherRecord = {
  id: 'at-1',
  tenant_id: 'test-tenant-id',
  person_id: 'person-1',
  position: 'teacher',
  specialization: 'math',
  employee_id: 'EMP-001',
  hire_date: '2025-01-01',
  status: 'active',
  login_id: 'kim@academy.com',
  user_id: 'user-1',
  profile_image_url: null,
  bio: 'Math teacher',
  notes: null,
  pay_type: 'monthly',
  base_salary: 3000000,
  hourly_rate: null,
  bank_name: 'KB',
  bank_account: '1234-5678',
  salary_notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  created_by: 'admin-1',
  updated_by: null,
  deleted_at: null,
  persons: {
    id: 'person-1',
    name: 'Teacher Kim',
    phone: '010-1234-5678',
    email: 'kim@test.com',
    address: 'Seoul',
  },
};

// ===== Tests =====

describe('useTeachers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns teacher list on success', async () => {
    mockGet.mockResolvedValue({
      data: [mockPersonWithTeacher, mockPersonWithTeacher2],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeachers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].name).toBe('Teacher Kim');
    expect(result.current.data![0].specialization).toBe('math');
    expect(result.current.data![1].name).toBe('Teacher Park');
    expect(result.current.data![1].specialization).toBe('english');
  });

  it('returns empty array when no teachers exist', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeachers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('filters by status (single)', async () => {
    mockGet.mockResolvedValue({
      data: [mockPersonWithTeacher, mockPersonWithTeacher2, mockPersonWithTeacherResigned],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useTeachers({ status: 'active' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data!.every((t) => t.status === 'active')).toBe(true);
  });

  it('filters by status (array)', async () => {
    mockGet.mockResolvedValue({
      data: [mockPersonWithTeacher, mockPersonWithTeacher2, mockPersonWithTeacherResigned],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useTeachers({ status: ['active', 'resigned'] }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
  });

  it('filters by search (name)', async () => {
    mockGet.mockResolvedValue({
      data: [mockPersonWithTeacher, mockPersonWithTeacher2],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useTeachers({ search: 'kim' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('Teacher Kim');
  });

  it('filters by specialization', async () => {
    mockGet.mockResolvedValue({
      data: [mockPersonWithTeacher, mockPersonWithTeacher2],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useTeachers({ specialization: 'english' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('Teacher Park');
  });

  it('handles academy_teachers as object (not array)', async () => {
    const personWithObjectTeacher = {
      ...mockPersonWithTeacher,
      academy_teachers: mockPersonWithTeacher.academy_teachers[0], // object, not array
    };

    mockGet.mockResolvedValue({
      data: [personWithObjectTeacher],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeachers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].specialization).toBe('math');
  });

  it('handles missing academy_teachers gracefully', async () => {
    const personWithoutTeacher = {
      id: 'person-4',
      tenant_id: 'test-tenant-id',
      name: 'Orphan Person',
      email: null,
      phone: null,
      address: null,
      person_type: 'teacher',
      created_at: '2026-01-04T00:00:00Z',
      updated_at: '2026-01-04T00:00:00Z',
      academy_teachers: undefined,
    };

    mockGet.mockResolvedValue({
      data: [personWithoutTeacher],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeachers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('Orphan Person');
    expect(result.current.data![0].status).toBe('active'); // default status
  });

  it('is disabled when tenantId is empty', async () => {
    const { getApiContext } = await import('@api-sdk/core');
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      tenantId: '',
      industryType: 'academy',
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeachers(), { wrapper });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockGet).not.toHaveBeenCalled();
  });

  it('throws error when API returns error', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeachers(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Database error');
  });

  it('returns empty array when data is null', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeachers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });
});

describe('useTeacher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns single teacher on success', async () => {
    mockGet.mockResolvedValue({
      data: [mockAcademyTeacherRecord],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeacher('at-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeTruthy();
    expect(result.current.data!.id).toBe('at-1');
    expect(result.current.data!.name).toBe('Teacher Kim');
    expect(result.current.data!.specialization).toBe('math');
    expect(result.current.data!.status).toBe('active');

    expect(mockGet).toHaveBeenCalledWith('academy_teachers', {
      select: expect.stringContaining('persons'),
      filters: {
        id: 'at-1',
        deleted_at: null,
      },
      limit: 1,
    });
  });

  it('returns null when teacher not found', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeacher('non-existent'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });

  it('is disabled when teacherId is null', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeacher(null), { wrapper });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockGet).not.toHaveBeenCalled();
  });

  it('throws error when API returns error', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeacher('at-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Not found');
  });

  it('handles null person fields with fallback to empty string', async () => {
    const teacherWithNullPerson = {
      ...mockAcademyTeacherRecord,
      persons: {
        id: 'person-1',
        name: null,
        phone: null,
        email: null,
        address: null,
      },
    };

    mockGet.mockResolvedValue({
      data: [teacherWithNullPerson],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeacher('at-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // null name falls back to empty string ''
    expect(result.current.data!.name).toBe('');
    // null fields fall back to undefined
    expect(result.current.data!.phone).toBeUndefined();
    expect(result.current.data!.email).toBeUndefined();
  });

  it('handles null optional teacher fields with fallback to undefined', async () => {
    const teacherWithNullFields = {
      ...mockAcademyTeacherRecord,
      specialization: null,
      employee_id: null,
      hire_date: null,
      login_id: null,
      user_id: null,
      profile_image_url: null,
      bio: null,
      notes: null,
      pay_type: null,
      base_salary: null,
      hourly_rate: null,
      bank_name: null,
      bank_account: null,
      salary_notes: null,
      created_by: null,
      updated_by: null,
    };

    mockGet.mockResolvedValue({
      data: [teacherWithNullFields],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeacher('at-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const teacher = result.current.data!;
    expect(teacher.specialization).toBeUndefined();
    expect(teacher.employee_id).toBeUndefined();
    expect(teacher.hire_date).toBeUndefined();
    expect(teacher.login_id).toBeUndefined();
    expect(teacher.user_id).toBeUndefined();
    expect(teacher.profile_image_url).toBeUndefined();
    expect(teacher.bio).toBeUndefined();
    expect(teacher.notes).toBeUndefined();
    expect(teacher.pay_type).toBeUndefined();
    expect(teacher.base_salary).toBeUndefined();
    expect(teacher.hourly_rate).toBeUndefined();
    expect(teacher.bank_name).toBeUndefined();
    expect(teacher.bank_account).toBeUndefined();
    expect(teacher.salary_notes).toBeUndefined();
    expect(teacher.created_by).toBeUndefined();
    expect(teacher.updated_by).toBeUndefined();
  });
});

describe('useCreateTeacher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls RPC create_teacher with all fields', async () => {
    const createdTeacher = {
      id: 'teacher-new',
      name: 'New Teacher',
      status: 'active',
    };

    mockCallRPC.mockResolvedValue({
      data: createdTeacher,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'New Teacher',
        email: 'new@test.com',
        phone: '010-1111-2222',
        address: 'Incheon',
        employee_id: 'EMP-NEW',
        specialization: 'science',
        hire_date: '2026-03-01',
        status: 'active',
        position: 'teacher',
        profile_image_url: 'https://example.com/photo.jpg',
        bio: 'Science expert',
        notes: 'New hire',
        login_id: 'new@academy.com',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCallRPC).toHaveBeenCalledWith('create_teacher', {
      p_tenant_id: 'test-tenant-id',
      p_name: 'New Teacher',
      p_email: 'new@test.com',
      p_phone: '010-1111-2222',
      p_address: 'Incheon',
      p_employee_id: 'EMP-NEW',
      p_specialization: 'science',
      p_hire_date: '2026-03-01',
      p_status: 'active',
      p_profile_image_url: 'https://example.com/photo.jpg',
      p_bio: 'Science expert',
      p_notes: 'New hire',
      p_created_by: 'test-user-id',
      p_position: 'teacher',
      p_login_id: 'new@academy.com',
    });
  });

  it('applies default values for optional fields', async () => {
    mockCallRPC.mockResolvedValue({
      data: { id: 'teacher-new', name: 'Minimal Teacher' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Minimal Teacher',
        position: 'teacher',
      });
    });

    expect(mockCallRPC).toHaveBeenCalledWith('create_teacher', expect.objectContaining({
      p_name: 'Minimal Teacher',
      p_status: 'active',
      p_position: 'teacher',
    }));
  });

  it('uses default position when not provided', async () => {
    mockCallRPC.mockResolvedValue({
      data: { id: 'teacher-new', name: 'No Position Teacher' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'No Position Teacher',
        // position not provided - should default to 'teacher'
      } as Parameters<typeof result.current.mutateAsync>[0]);
    });

    expect(mockCallRPC).toHaveBeenCalledWith('create_teacher', expect.objectContaining({
      p_position: 'teacher',
    }));
  });

  it('throws error when tenantId is missing', async () => {
    const { getApiContext } = await import('@api-sdk/core');
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
      tenantId: '',
      industryType: 'academy',
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateTeacher(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          name: 'No Tenant',
          position: 'teacher',
        });
      })
    ).rejects.toThrow('Tenant ID is required');

    // Restore mock
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
  });

  it('throws error when RPC fails', async () => {
    mockCallRPC.mockResolvedValue({
      data: null,
      error: { message: 'Teacher creation failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateTeacher(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          name: 'Failing Teacher',
          position: 'teacher',
        });
      })
    ).rejects.toThrow('Teacher creation failed');
  });

  it('invalidates teachers and teachers-with-stats queries on success', async () => {
    mockCallRPC.mockResolvedValue({
      data: { id: 'teacher-new', name: 'Test Teacher' },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Test Teacher',
        position: 'teacher',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['teachers', 'test-tenant-id'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['teachers-with-stats', 'test-tenant-id'],
    });
  });

  it('creates execution audit record on success', async () => {
    mockCallRPC.mockResolvedValue({
      data: { id: 'teacher-new', name: 'Audit Teacher' },
      error: null,
    });

    const { createExecutionAuditRecord } = await import(
      '@hooks/use-student/src/execution-audit-utils'
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Audit Teacher',
        position: 'teacher',
      });
    });

    expect(createExecutionAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        operation_type: 'teacher.register',
        status: 'success',
        summary: expect.stringContaining('Audit Teacher'),
      }),
      'test-user-id'
    );
  });
});

describe('useDeleteTeacher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls RPC delete_teacher for soft delete', async () => {
    mockCallRPC.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('teacher-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCallRPC).toHaveBeenCalledWith('delete_teacher', {
      p_tenant_id: 'test-tenant-id',
      p_teacher_id: 'teacher-1',
    });
  });

  it('throws error when tenantId is missing', async () => {
    const { getApiContext } = await import('@api-sdk/core');
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
      tenantId: '',
      industryType: 'academy',
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteTeacher(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync('teacher-1');
      })
    ).rejects.toThrow('Tenant ID is required');

    // Restore mock
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
  });

  it('throws error when RPC fails', async () => {
    mockCallRPC.mockResolvedValue({
      data: null,
      error: { message: 'Delete failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteTeacher(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync('teacher-1');
      })
    ).rejects.toThrow('Delete failed');
  });

  it('invalidates teachers and teachers-with-stats queries on success', async () => {
    mockCallRPC.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('teacher-1');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['teachers', 'test-tenant-id'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['teachers-with-stats', 'test-tenant-id'],
    });
  });

  it('creates execution audit record on success', async () => {
    mockCallRPC.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const { createExecutionAuditRecord } = await import(
      '@hooks/use-student/src/execution-audit-utils'
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('teacher-1');
    });

    expect(createExecutionAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        operation_type: 'teacher.delete',
        status: 'success',
      }),
      'test-user-id'
    );
  });
});

describe('useResignTeacher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resigns a teacher by setting status to resigned', async () => {
    // First: find the academy_teacher record by person_id
    mockGet.mockResolvedValueOnce({
      data: [{ person_id: 'person-1', status: 'active' }],
      error: null,
    });

    // Second: patch the status
    mockPatch.mockResolvedValue({
      data: { person_id: 'person-1', status: 'resigned' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useResignTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('person-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify find query
    expect(mockGet).toHaveBeenCalledWith('academy_teachers', {
      filters: { person_id: 'person-1' },
      limit: 1,
    });

    // Verify patch with status: 'resigned'
    expect(mockPatch).toHaveBeenCalledWith('academy_teachers', 'person-1', {
      status: 'resigned',
    });
  });

  it('throws error when tenantId is missing', async () => {
    const { getApiContext } = await import('@api-sdk/core');
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
      tenantId: '',
      industryType: 'academy',
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useResignTeacher(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync('person-1');
      })
    ).rejects.toThrow('Tenant ID is required');

    // Restore mock
    (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
  });

  it('throws error when teacher not found in academy_teachers', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useResignTeacher(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync('non-existent');
      })
    ).rejects.toThrow();
  });

  it('throws error when find query fails', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { message: 'Find query failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useResignTeacher(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync('person-1');
      })
    ).rejects.toThrow('Find query failed');
  });

  it('throws error when teacher record has no person_id', async () => {
    mockGet.mockResolvedValue({
      data: [{ id: 'at-1', status: 'active' }], // no person_id
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useResignTeacher(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync('person-1');
      })
    ).rejects.toThrow();
  });

  it('throws error when patch fails', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ person_id: 'person-1', status: 'active' }],
      error: null,
    });

    mockPatch.mockResolvedValue({
      data: null,
      error: { message: 'Patch failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useResignTeacher(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync('person-1');
      })
    ).rejects.toThrow('Patch failed');
  });

  it('invalidates teachers and teachers-with-stats queries on success', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ person_id: 'person-1', status: 'active' }],
      error: null,
    });

    mockPatch.mockResolvedValue({
      data: { person_id: 'person-1', status: 'resigned' },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useResignTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('person-1');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['teachers', 'test-tenant-id'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['teachers-with-stats', 'test-tenant-id'],
    });
  });

  it('creates execution audit record on success', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ person_id: 'person-1', status: 'active' }],
      error: null,
    });

    mockPatch.mockResolvedValue({
      data: { person_id: 'person-1', status: 'resigned' },
      error: null,
    });

    const { createExecutionAuditRecord } = await import(
      '@hooks/use-student/src/execution-audit-utils'
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useResignTeacher(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('person-1');
    });

    expect(createExecutionAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        operation_type: 'teacher.resign',
        status: 'success',
      }),
      'test-user-id'
    );
  });
});
