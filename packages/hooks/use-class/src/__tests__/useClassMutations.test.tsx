/**
 * useClassMutations Hook Unit Tests
 *
 * Tests for the complex useUpdateTeacher mutation hook which has
 * two distinct code paths:
 * 1. Edge Function path (when name/phone/login_id/password is provided)
 * 2. Direct academy_teachers PATCH path (when only academy_teacher fields are provided)
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
const mockInvokeFunction = vi.fn();

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    callRPC: (...args: unknown[]) => mockCallRPC(...args),
    invokeFunction: (...args: unknown[]) => mockInvokeFunction(...args),
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

import { useUpdateTeacher } from '../useClass';

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

const mockTeacherPerson = {
  id: 'person-1',
  tenant_id: 'test-tenant-id',
  name: 'Updated Teacher',
  email: 'updated@test.com',
  phone: '010-9999-8888',
  address: 'Seoul',
  person_type: 'teacher',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-06T00:00:00Z',
  academy_teachers: [
    {
      employee_id: 'EMP-001',
      specialization: 'math',
      hire_date: '2025-01-01',
      status: 'active',
      position: 'teacher',
      login_id: 'teacher@academy.com',
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
      updated_at: '2026-03-06T00:00:00Z',
      created_by: 'admin-1',
      updated_by: 'test-user-id',
    },
  ],
};

// ===== Tests =====

describe('useUpdateTeacher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =============================================
  // Edge Function Path (name/phone/login_id/password)
  // =============================================

  describe('Edge Function path (name/phone/login_id/password)', () => {
    it('calls invokeFunction when name is provided', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { id: 'person-1', name: 'New Name', status: 'active' },
        error: null,
      });

      // Mock the post for audit (fire-and-forget)
      mockPost.mockResolvedValue({ data: null, error: null });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          teacherId: 'person-1',
          input: { name: 'New Name' },
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockInvokeFunction).toHaveBeenCalledWith('update-teacher', {
        teacher_id: 'person-1',
        name: 'New Name',
      });
    });

    it('calls invokeFunction when phone is provided', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { id: 'person-1', name: 'Teacher', status: 'active' },
        error: null,
      });
      mockPost.mockResolvedValue({ data: null, error: null });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          teacherId: 'person-1',
          input: { phone: '010-1111-2222' },
        });
      });

      expect(mockInvokeFunction).toHaveBeenCalledWith('update-teacher', {
        teacher_id: 'person-1',
        phone: '010-1111-2222',
      });
    });

    it('calls invokeFunction when login_id is provided', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { id: 'person-1', name: 'Teacher', status: 'active' },
        error: null,
      });
      mockPost.mockResolvedValue({ data: null, error: null });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          teacherId: 'person-1',
          input: { login_id: 'newlogin@academy.com' },
        });
      });

      expect(mockInvokeFunction).toHaveBeenCalledWith('update-teacher', {
        teacher_id: 'person-1',
        login_id: 'newlogin@academy.com',
      });
    });

    it('calls invokeFunction when password is provided', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { id: 'person-1', name: 'Teacher', status: 'active' },
        error: null,
      });
      mockPost.mockResolvedValue({ data: null, error: null });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          teacherId: 'person-1',
          input: { password: 'newpassword123' },
        });
      });

      expect(mockInvokeFunction).toHaveBeenCalledWith('update-teacher', {
        teacher_id: 'person-1',
        password: 'newpassword123',
      });
    });

    it('calls invokeFunction with multiple edge function fields', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { id: 'person-1', name: 'Updated Name', status: 'active' },
        error: null,
      });
      mockPost.mockResolvedValue({ data: null, error: null });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          teacherId: 'person-1',
          input: {
            name: 'Updated Name',
            phone: '010-3333-4444',
            login_id: 'updated@academy.com',
            password: 'newpass',
          },
        });
      });

      expect(mockInvokeFunction).toHaveBeenCalledWith('update-teacher', {
        teacher_id: 'person-1',
        name: 'Updated Name',
        phone: '010-3333-4444',
        login_id: 'updated@academy.com',
        password: 'newpass',
      });
    });

    it('throws error when invokeFunction returns not successful', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: false,
        data: null,
        error: { message: 'Edge function failed' },
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            teacherId: 'person-1',
            input: { name: 'Failing Update' },
          });
        })
      ).rejects.toThrow('Edge function failed');
    });

    it('throws default error message when invokeFunction returns no error message', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: false,
        data: null,
        error: null,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            teacherId: 'person-1',
            input: { name: 'Failing Update' },
          });
        })
      ).rejects.toThrow();
    });

    it('posts audit log for edge function path (fire-and-forget)', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { id: 'person-1', name: 'Audit Teacher', status: 'active' },
        error: null,
      });
      mockPost.mockResolvedValue({ data: null, error: null });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          teacherId: 'person-1',
          input: { name: 'Audit Teacher' },
        });
      });

      // The audit log is posted via apiClient.post (not createExecutionAuditRecord)
      expect(mockPost).toHaveBeenCalledWith(
        'execution_audit_runs',
        expect.objectContaining({
          tenant_id: 'test-tenant-id',
          operation_type: 'teacher.update',
          status: 'success',
          actor_id: 'user:test-user-id',
        })
      );
    });

    it('does not throw when audit log post fails (fire-and-forget)', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { id: 'person-1', name: 'Teacher', status: 'active' },
        error: null,
      });
      // Audit post fails but should not affect the mutation
      mockPost.mockRejectedValue(new Error('Audit log failed'));

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      // Should not throw despite audit post failure
      await act(async () => {
        const data = await result.current.mutateAsync({
          teacherId: 'person-1',
          input: { name: 'Teacher' },
        });
        expect(data).toBeTruthy();
      });
    });
  });

  // =============================================
  // Direct academy_teachers PATCH path
  // =============================================

  describe('Direct academy_teachers PATCH path', () => {
    it('patches academy_teachers when only teacher-specific fields are provided', async () => {
      // Step 1: Find academy_teacher by person_id
      mockGet.mockResolvedValueOnce({
        data: [{ person_id: 'person-1', id: 'at-1' }],
        error: null,
      });

      // Step 2: Patch academy_teachers
      mockPatch.mockResolvedValueOnce({
        data: { person_id: 'person-1', specialization: 'science' },
        error: null,
      });

      // Step 3: Fetch updated person with academy_teachers
      mockGet.mockResolvedValueOnce({
        data: [mockTeacherPerson],
        error: null,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          teacherId: 'person-1',
          input: { specialization: 'science' },
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Verify find query
      expect(mockGet).toHaveBeenCalledWith('academy_teachers', {
        filters: { person_id: 'person-1' },
        limit: 1,
      });

      // Verify patch
      expect(mockPatch).toHaveBeenCalledWith('academy_teachers', 'person-1', {
        specialization: 'science',
      });
    });

    it('patches multiple academy_teacher fields', async () => {
      mockGet.mockResolvedValueOnce({
        data: [{ person_id: 'person-1' }],
        error: null,
      });

      mockPatch.mockResolvedValueOnce({
        data: { person_id: 'person-1' },
        error: null,
      });

      mockGet.mockResolvedValueOnce({
        data: [mockTeacherPerson],
        error: null,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          teacherId: 'person-1',
          input: {
            specialization: 'english',
            hire_date: '2026-03-01',
            status: 'on_leave',
            position: 'manager',
            bio: 'Updated bio',
            notes: 'Updated notes',
            pay_type: 'hourly',
            base_salary: 0,
            hourly_rate: 60000,
            bank_name: 'Shinhan',
            bank_account: '9999-1111',
            salary_notes: 'Rate increase',
          },
        });
      });

      expect(mockPatch).toHaveBeenCalledWith('academy_teachers', 'person-1', {
        specialization: 'english',
        hire_date: '2026-03-01',
        status: 'on_leave',
        position: 'manager',
        bio: 'Updated bio',
        notes: 'Updated notes',
        pay_type: 'hourly',
        base_salary: 0,
        hourly_rate: 60000,
        bank_name: 'Shinhan',
        bank_account: '9999-1111',
        salary_notes: 'Rate increase',
      });
    });

    it('skips patch when no academy_teacher fields are provided (empty update)', async () => {
      // Only fetches the updated person (no patch needed)
      mockGet.mockResolvedValueOnce({
        data: [mockTeacherPerson],
        error: null,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          teacherId: 'person-1',
          input: {}, // empty input - no fields to update
        });
      });

      // Only the final fetch should happen, no patch
      expect(mockPatch).not.toHaveBeenCalled();
    });

    it('throws error when find academy_teacher fails', async () => {
      mockGet.mockResolvedValueOnce({
        data: null,
        error: { message: 'Find failed' },
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            teacherId: 'person-1',
            input: { specialization: 'science' },
          });
        })
      ).rejects.toThrow('Find failed');
    });

    it('throws error when patch fails', async () => {
      mockGet.mockResolvedValueOnce({
        data: [{ person_id: 'person-1' }],
        error: null,
      });

      mockPatch.mockResolvedValueOnce({
        data: null,
        error: { message: 'Patch failed' },
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            teacherId: 'person-1',
            input: { specialization: 'science' },
          });
        })
      ).rejects.toThrow('Patch failed');
    });

    it('throws error when teacher person not found in final fetch', async () => {
      mockGet.mockResolvedValueOnce({
        data: [{ person_id: 'person-1' }],
        error: null,
      });

      mockPatch.mockResolvedValueOnce({
        data: { person_id: 'person-1' },
        error: null,
      });

      // Final fetch returns empty
      mockGet.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            teacherId: 'person-1',
            input: { specialization: 'science' },
          });
        })
      ).rejects.toThrow('Teacher not found');
    });

    it('throws error when final fetch fails', async () => {
      mockGet.mockResolvedValueOnce({
        data: [{ person_id: 'person-1' }],
        error: null,
      });

      mockPatch.mockResolvedValueOnce({
        data: { person_id: 'person-1' },
        error: null,
      });

      // Final fetch fails
      mockGet.mockResolvedValueOnce({
        data: null,
        error: { message: 'Final fetch failed' },
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            teacherId: 'person-1',
            input: { specialization: 'science' },
          });
        })
      ).rejects.toThrow('Final fetch failed');
    });

    it('handles academy_teachers as object (not array) in final fetch', async () => {
      const personWithObjectTeacher = {
        ...mockTeacherPerson,
        academy_teachers: mockTeacherPerson.academy_teachers[0], // object, not array
      };

      mockGet.mockResolvedValueOnce({
        data: [{ person_id: 'person-1' }],
        error: null,
      });

      mockPatch.mockResolvedValueOnce({
        data: { person_id: 'person-1' },
        error: null,
      });

      mockGet.mockResolvedValueOnce({
        data: [personWithObjectTeacher],
        error: null,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        const data = await result.current.mutateAsync({
          teacherId: 'person-1',
          input: { specialization: 'science' },
        });
        expect(data.name).toBe('Updated Teacher');
        expect(data.specialization).toBe('math');
      });
    });

    it('handles missing academy_teachers in final fetch', async () => {
      const personWithoutTeacher = {
        ...mockTeacherPerson,
        academy_teachers: undefined,
      };

      mockGet.mockResolvedValueOnce({
        data: [{ person_id: 'person-1' }],
        error: null,
      });

      mockPatch.mockResolvedValueOnce({
        data: { person_id: 'person-1' },
        error: null,
      });

      mockGet.mockResolvedValueOnce({
        data: [personWithoutTeacher],
        error: null,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        const data = await result.current.mutateAsync({
          teacherId: 'person-1',
          input: { specialization: 'science' },
        });
        // Should still return with default status 'active'
        expect(data.status).toBe('active');
      });
    });

    it('skips academy_teachers patch when person_id not found in record', async () => {
      // academyTeacher found but has no person_id
      mockGet.mockResolvedValueOnce({
        data: [{ id: 'at-1', status: 'active' }], // no person_id
        error: null,
      });

      // Final fetch still happens
      mockGet.mockResolvedValueOnce({
        data: [mockTeacherPerson],
        error: null,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          teacherId: 'person-1',
          input: { specialization: 'science' },
        });
      });

      // Patch should NOT have been called since person_id was missing
      expect(mockPatch).not.toHaveBeenCalled();
    });

    it('creates execution audit record on success for direct path', async () => {
      mockGet.mockResolvedValueOnce({
        data: [{ person_id: 'person-1' }],
        error: null,
      });

      mockPatch.mockResolvedValueOnce({
        data: { person_id: 'person-1' },
        error: null,
      });

      mockGet.mockResolvedValueOnce({
        data: [mockTeacherPerson],
        error: null,
      });

      const { createExecutionAuditRecord } = await import(
        '@hooks/use-student/src/execution-audit-utils'
      );

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          teacherId: 'person-1',
          input: { specialization: 'science' },
        });
      });

      // The direct path uses createExecutionAuditRecord (fire-and-forget with .catch)
      expect(createExecutionAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          operation_type: 'teacher.update',
          status: 'success',
        }),
        'test-user-id'
      );
    });
  });

  // =============================================
  // Common behavior
  // =============================================

  describe('Common behavior', () => {
    it('throws error when tenantId is missing', async () => {
      const { getApiContext } = await import('@api-sdk/core');
      (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
        tenantId: '',
        industryType: 'academy',
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            teacherId: 'person-1',
            input: { name: 'No Tenant' },
          });
        })
      ).rejects.toThrow('Tenant ID is required');

      // Restore mock
      (getApiContext as ReturnType<typeof vi.fn>).mockReturnValue({
        tenantId: 'test-tenant-id',
        industryType: 'academy',
      });
    });

    it('invalidates teachers, teachers-with-stats, and teacher queries on success (edge function path)', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { id: 'person-1', name: 'Teacher', status: 'active' },
        error: null,
      });
      mockPost.mockResolvedValue({ data: null, error: null });

      const { queryClient, wrapper } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          teacherId: 'person-1',
          input: { name: 'Teacher' },
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['teachers', 'test-tenant-id'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['teachers-with-stats', 'test-tenant-id'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['teacher', 'test-tenant-id', 'person-1'],
      });
    });

    it('invalidates teachers, teachers-with-stats, and teacher queries on success (direct path)', async () => {
      // Empty update -> only final fetch
      mockGet.mockResolvedValueOnce({
        data: [mockTeacherPerson],
        error: null,
      });

      const { queryClient, wrapper } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          teacherId: 'person-1',
          input: {},
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['teachers', 'test-tenant-id'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['teachers-with-stats', 'test-tenant-id'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['teacher', 'test-tenant-id', 'person-1'],
      });
    });

    it('patches employee_id field correctly', async () => {
      mockGet.mockResolvedValueOnce({
        data: [{ person_id: 'person-1' }],
        error: null,
      });
      mockPatch.mockResolvedValueOnce({
        data: { person_id: 'person-1' },
        error: null,
      });
      mockGet.mockResolvedValueOnce({
        data: [mockTeacherPerson],
        error: null,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          teacherId: 'person-1',
          input: { employee_id: 'EMP-NEW' },
        });
      });

      expect(mockPatch).toHaveBeenCalledWith('academy_teachers', 'person-1', {
        employee_id: 'EMP-NEW',
      });
    });

    it('patches profile_image_url field correctly', async () => {
      mockGet.mockResolvedValueOnce({
        data: [{ person_id: 'person-1' }],
        error: null,
      });
      mockPatch.mockResolvedValueOnce({
        data: { person_id: 'person-1' },
        error: null,
      });
      mockGet.mockResolvedValueOnce({
        data: [mockTeacherPerson],
        error: null,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTeacher(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          teacherId: 'person-1',
          input: { profile_image_url: 'https://example.com/new-photo.jpg' },
        });
      });

      expect(mockPatch).toHaveBeenCalledWith('academy_teachers', 'person-1', {
        profile_image_url: 'https://example.com/new-photo.jpg',
      });
    });
  });
});
