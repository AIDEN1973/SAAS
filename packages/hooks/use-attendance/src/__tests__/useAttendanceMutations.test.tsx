/**
 * useAttendance Hook - Additional Coverage Tests
 *
 * Covers uncovered lines 76-225 and 481-655:
 * - useAttendanceNotifications (L75-107)
 * - useQRAttendance (L112-232): verifyQRToken, sendOTP, verifyOTP, submitAttendance, submitAttendanceWithFallback
 * - useUpsertAttendanceLog (L480-658): UPDATE mode, UPSERT/RPC mode, optimistic updates, error rollback
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

const mockCreateExecutionAuditRecord = vi.fn().mockResolvedValue(undefined);
vi.mock('@hooks/use-student/src/execution-audit-utils', () => ({
  createExecutionAuditRecord: (...args: unknown[]) => mockCreateExecutionAuditRecord(...args),
}));

vi.mock('@services/attendance-service', () => ({}));

import {
  useAttendanceNotifications,
  useQRAttendance,
  useUpsertAttendanceLog,
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

// ===== Tests =====

// -------------------------------------------------------
// useAttendanceNotifications (lines 75-107)
// -------------------------------------------------------
describe('useAttendanceNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches attendance notifications successfully', async () => {
    const mockNotifications = [
      {
        id: 'notif-1',
        student_id: 'student-1',
        student_name: 'Alice',
        title: 'Check-in',
        message: 'Alice checked in',
        attendance_type: 'check_in',
        occurred_at: '2026-03-06T09:00:00+09:00',
        created_at: '2026-03-06T09:00:00+09:00',
      },
    ];

    mockGet.mockResolvedValue({
      data: mockNotifications,
      error: null,
      success: true,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAttendanceNotifications('student-1'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockNotifications);
    expect(mockGet).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({
        filters: expect.objectContaining({
          notification_type: 'attendance',
          student_id: 'student-1',
        }),
        orderBy: { column: 'created_at', ascending: false },
        limit: 50,
      })
    );
  });

  it('fetches notifications without studentId filter', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
      success: true,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAttendanceNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
    // When studentId is undefined, filters should NOT contain student_id
    const callArgs = mockGet.mock.calls[0];
    const filters = callArgs[1]?.filters;
    expect(filters?.notification_type).toBe('attendance');
    expect(filters?.student_id).toBeUndefined();
  });

  it('returns empty array when data is null', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: null,
      success: true,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAttendanceNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('throws error when API returns error', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { message: 'Notification fetch failed' },
      success: false,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAttendanceNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect((result.current.error as Error).message).toBe('Notification fetch failed');
  });
});

// -------------------------------------------------------
// useQRAttendance (lines 112-232)
// -------------------------------------------------------
describe('useQRAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyQRToken', () => {
    it('returns valid result on success', async () => {
      const mockResult = {
        valid: true,
        tenantId: 'tenant-123',
        locationType: 'classroom',
        locationId: 'room-1',
      };

      mockPost.mockResolvedValue({
        data: mockResult,
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const qrResult = await result.current.verifyQRToken('test-qr-token');

      expect(qrResult).toEqual(mockResult);
      expect(mockPost).toHaveBeenCalledWith(
        'functions/v1/fns-attendance-verify-qr-token',
        { qr_token: 'test-qr-token' }
      );
    });

    it('returns invalid result when API returns error', async () => {
      mockPost.mockResolvedValue({
        data: null,
        error: { message: 'Token expired' },
        success: false,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const qrResult = await result.current.verifyQRToken('expired-token');

      expect(qrResult).toEqual({ valid: false, error: 'Token expired' });
    });

    it('returns fallback invalid result when data is null', async () => {
      mockPost.mockResolvedValue({
        data: null,
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const qrResult = await result.current.verifyQRToken('some-token');

      expect(qrResult).toEqual({ valid: false, error: expect.any(String) });
    });

    it('catches thrown error and returns invalid result', async () => {
      mockPost.mockRejectedValue(new Error('Network failure'));

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const qrResult = await result.current.verifyQRToken('some-token');

      expect(qrResult).toEqual({ valid: false, error: 'Network failure' });
    });

    it('handles non-Error thrown values', async () => {
      mockPost.mockRejectedValue('string error');

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const qrResult = await result.current.verifyQRToken('some-token');

      expect(qrResult).toEqual({ valid: false, error: expect.any(String) });
    });
  });

  describe('sendOTP', () => {
    it('sends OTP successfully', async () => {
      mockPost.mockResolvedValue({
        data: null,
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      await expect(result.current.sendOTP('010-1234-5678')).resolves.toBeUndefined();

      expect(mockPost).toHaveBeenCalledWith(
        'functions/v1/fns-auth-send-otp',
        { phone: '010-1234-5678' }
      );
    });

    it('throws error when API returns error', async () => {
      mockPost.mockResolvedValue({
        data: null,
        error: { message: 'Invalid phone number' },
        success: false,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      await expect(result.current.sendOTP('invalid')).rejects.toThrow(
        'Invalid phone number'
      );
    });
  });

  describe('verifyOTP', () => {
    it('verifies OTP successfully', async () => {
      const mockResult = {
        success: true,
        studentId: 'student-1',
      };

      mockPost.mockResolvedValue({
        data: mockResult,
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const otpResult = await result.current.verifyOTP('010-1234-5678', '123456');

      expect(otpResult).toEqual(mockResult);
      expect(mockPost).toHaveBeenCalledWith(
        'functions/v1/fns-auth-verify-otp',
        { phone: '010-1234-5678', otp: '123456' }
      );
    });

    it('returns failure when API returns error', async () => {
      mockPost.mockResolvedValue({
        data: null,
        error: { message: 'OTP expired' },
        success: false,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const otpResult = await result.current.verifyOTP('010-1234-5678', '000000');

      expect(otpResult).toEqual({ success: false, error: 'OTP expired' });
    });

    it('returns fallback failure when data is null', async () => {
      mockPost.mockResolvedValue({
        data: null,
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const otpResult = await result.current.verifyOTP('010-1234-5678', '123456');

      expect(otpResult).toEqual({ success: false, error: expect.any(String) });
    });

    it('catches thrown error and returns failure', async () => {
      mockPost.mockRejectedValue(new Error('Network error'));

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const otpResult = await result.current.verifyOTP('010-1234-5678', '123456');

      expect(otpResult).toEqual({ success: false, error: 'Network error' });
    });

    it('handles non-Error thrown values in verifyOTP', async () => {
      mockPost.mockRejectedValue(42);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const otpResult = await result.current.verifyOTP('010-1234-5678', '123456');

      expect(otpResult).toEqual({ success: false, error: 'OTP 검증 실패' });
    });
  });

  describe('submitAttendance', () => {
    it('submits attendance successfully', async () => {
      const mockResult = {
        success: true,
        attendanceId: 'att-1',
      };

      mockPost.mockResolvedValue({
        data: mockResult,
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const submitResult = await result.current.submitAttendance({
        qrToken: 'qr-token-123',
        studentId: 'student-1',
        authMethod: 'otp',
        gps: { lat: 37.5665, lng: 126.978 },
      });

      expect(submitResult).toEqual(mockResult);
      expect(mockPost).toHaveBeenCalledWith(
        'functions/v1/fns-attendance-submit',
        {
          qr_token: 'qr-token-123',
          student_id: 'student-1',
          auth_method: 'otp',
          gps_lat: 37.5665,
          gps_lng: 126.978,
          source: 'qr',
        }
      );
    });

    it('submits attendance without GPS data', async () => {
      mockPost.mockResolvedValue({
        data: { success: true, attendanceId: 'att-2' },
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const submitResult = await result.current.submitAttendance({
        qrToken: 'qr-token-456',
        studentId: 'student-2',
        authMethod: 'phone',
      });

      expect(submitResult.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith(
        'functions/v1/fns-attendance-submit',
        expect.objectContaining({
          gps_lat: undefined,
          gps_lng: undefined,
        })
      );
    });

    it('returns failure when API returns error', async () => {
      mockPost.mockResolvedValue({
        data: null,
        error: { message: 'Duplicate attendance' },
        success: false,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const submitResult = await result.current.submitAttendance({
        qrToken: 'qr-token',
        studentId: 'student-1',
        authMethod: 'otp',
      });

      expect(submitResult).toEqual({ success: false, error: 'Duplicate attendance' });
    });

    it('returns fallback failure when data is null', async () => {
      mockPost.mockResolvedValue({
        data: null,
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const submitResult = await result.current.submitAttendance({
        qrToken: 'qr-token',
        studentId: 'student-1',
        authMethod: 'otp',
      });

      expect(submitResult).toEqual({ success: false, error: expect.any(String) });
    });

    it('catches thrown error and returns failure', async () => {
      mockPost.mockRejectedValue(new Error('Server unavailable'));

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const submitResult = await result.current.submitAttendance({
        qrToken: 'qr-token',
        studentId: 'student-1',
        authMethod: 'otp',
      });

      expect(submitResult).toEqual({ success: false, error: 'Server unavailable' });
    });

    it('handles non-Error thrown values in submitAttendance', async () => {
      mockPost.mockRejectedValue({ code: 500 });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const submitResult = await result.current.submitAttendance({
        qrToken: 'qr-token',
        studentId: 'student-1',
        authMethod: 'otp',
      });

      expect(submitResult).toEqual({ success: false, error: expect.any(String) });
    });
  });

  describe('submitAttendanceWithFallback', () => {
    it('submits attendance with fallback auth successfully', async () => {
      const mockResult = {
        success: true,
        attendanceId: 'att-fallback-1',
      };

      mockPost.mockResolvedValue({
        data: mockResult,
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const submitResult = await result.current.submitAttendanceWithFallback({
        qrToken: 'qr-token-123',
        studentId: 'student-1',
        birthDate: '2015',
      });

      expect(submitResult).toEqual(mockResult);
      expect(mockPost).toHaveBeenCalledWith(
        'functions/v1/fns-attendance-submit-fallback',
        {
          qrToken: 'qr-token-123',
          studentId: 'student-1',
          birthDate: '2015',
        }
      );
    });

    it('returns failure when API returns error', async () => {
      mockPost.mockResolvedValue({
        data: null,
        error: { message: 'Birth date mismatch' },
        success: false,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const submitResult = await result.current.submitAttendanceWithFallback({
        qrToken: 'qr-token-123',
        studentId: 'student-1',
        birthDate: '9999',
      });

      expect(submitResult).toEqual({ success: false, error: 'Birth date mismatch' });
    });

    it('returns fallback failure when data is null', async () => {
      mockPost.mockResolvedValue({
        data: null,
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const submitResult = await result.current.submitAttendanceWithFallback({
        qrToken: 'qr-token',
        studentId: 'student-1',
        birthDate: '2015',
      });

      expect(submitResult).toEqual({ success: false, error: expect.any(String) });
    });

    it('catches thrown error and returns failure', async () => {
      mockPost.mockRejectedValue(new Error('Fallback auth unavailable'));

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const submitResult = await result.current.submitAttendanceWithFallback({
        qrToken: 'qr-token',
        studentId: 'student-1',
        birthDate: '2015',
      });

      expect(submitResult).toEqual({
        success: false,
        error: 'Fallback auth unavailable',
      });
    });

    it('handles non-Error thrown values in submitAttendanceWithFallback', async () => {
      mockPost.mockRejectedValue(undefined);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useQRAttendance(), { wrapper });

      const submitResult = await result.current.submitAttendanceWithFallback({
        qrToken: 'qr-token',
        studentId: 'student-1',
        birthDate: '2015',
      });

      expect(submitResult).toEqual({ success: false, error: expect.any(String) });
    });
  });
});

// -------------------------------------------------------
// useUpsertAttendanceLog (lines 480-658)
// -------------------------------------------------------
describe('useUpsertAttendanceLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('UPDATE mode (when id is provided)', () => {
    it('updates existing attendance log via apiClient.patch', async () => {
      const updatedLog: AttendanceLog = {
        ...mockAttendanceLog,
        id: 'log-existing',
        status: 'late',
      };

      mockPatch.mockResolvedValue({
        data: updatedLog,
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpsertAttendanceLog(), { wrapper });

      const input: CreateAttendanceLogInput & { id?: string } = {
        id: 'log-existing',
        student_id: 'student-1',
        class_id: 'class-1',
        occurred_at: '2026-03-06T09:00:00+09:00',
        attendance_type: 'check_in',
        status: 'late',
        notes: 'Late arrival',
      };

      await act(async () => {
        const data = await result.current.mutateAsync(input);
        expect(data).toEqual(updatedLog);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Should use patch, NOT callRPC
      expect(mockPatch).toHaveBeenCalledWith(
        'attendance_logs',
        'log-existing',
        expect.objectContaining({
          student_id: 'student-1',
          status: 'late',
        })
      );
      expect(mockCallRPC).not.toHaveBeenCalled();
    });

    it('throws error when patch fails', async () => {
      mockPatch.mockResolvedValue({
        data: null,
        error: { message: 'Record not found' },
        success: false,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpsertAttendanceLog(), { wrapper });

      const input: CreateAttendanceLogInput & { id?: string } = {
        id: 'log-nonexistent',
        student_id: 'student-1',
        occurred_at: '2026-03-06T09:00:00+09:00',
        attendance_type: 'check_in',
        status: 'present',
      };

      await expect(
        act(async () => {
          await result.current.mutateAsync(input);
        })
      ).rejects.toThrow('Record not found');
    });

    it('creates execution audit record on successful update', async () => {
      const updatedLog: AttendanceLog = {
        ...mockAttendanceLog,
        id: 'log-audit-test',
      };

      mockPatch.mockResolvedValue({
        data: updatedLog,
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpsertAttendanceLog(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 'log-audit-test',
          student_id: 'student-1',
          occurred_at: '2026-03-06T09:00:00+09:00',
          attendance_type: 'check_in',
          status: 'present',
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockCreateExecutionAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          operation_type: 'attendance.update',
          status: 'success',
          details: expect.objectContaining({
            attendance_log_id: 'log-audit-test',
            student_id: 'student-1',
          }),
          reference: expect.objectContaining({
            entity_type: 'attendance_log',
            entity_id: 'log-audit-test',
          }),
        }),
        'test-user-id'
      );
    });

    it('converts numeric id to string for patch call', async () => {
      mockPatch.mockResolvedValue({
        data: { ...mockAttendanceLog, id: '123' },
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpsertAttendanceLog(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 123 as unknown as string, // numeric id
          student_id: 'student-1',
          occurred_at: '2026-03-06T09:00:00+09:00',
          attendance_type: 'check_in',
          status: 'present',
        });
      });

      // Should convert id to string
      expect(mockPatch).toHaveBeenCalledWith(
        'attendance_logs',
        '123',
        expect.any(Object)
      );
    });
  });

  describe('UPSERT/RPC mode (when id is not provided)', () => {
    it('calls apiClient.callRPC for upsert_attendance_log', async () => {
      const upsertedLog: AttendanceLog = {
        ...mockAttendanceLog,
        id: 'new-upserted-log',
      };

      mockCallRPC.mockResolvedValue({
        data: upsertedLog,
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpsertAttendanceLog(), { wrapper });

      const input: CreateAttendanceLogInput = {
        student_id: 'student-1',
        class_id: 'class-1',
        occurred_at: '2026-03-06T09:00:00+09:00',
        attendance_type: 'check_in',
        status: 'present',
        notes: 'New entry',
      };

      await act(async () => {
        const data = await result.current.mutateAsync(input);
        expect(data).toEqual(upsertedLog);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Should use callRPC, NOT patch
      expect(mockCallRPC).toHaveBeenCalledWith(
        'upsert_attendance_log',
        expect.objectContaining({
          p_tenant_id: 'test-tenant-id',
          p_student_id: 'student-1',
          p_class_id: 'class-1',
          p_occurred_at: '2026-03-06T09:00:00+09:00',
          p_attendance_type: 'check_in',
          p_status: 'present',
          p_check_in_method: 'manual',
          p_notes: 'New entry',
        })
      );
      expect(mockPatch).not.toHaveBeenCalled();
    });

    it('uses default check_in_method "manual" when not provided', async () => {
      mockCallRPC.mockResolvedValue({
        data: { ...mockAttendanceLog, id: 'new-log' },
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpsertAttendanceLog(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          student_id: 'student-1',
          occurred_at: '2026-03-06T09:00:00+09:00',
          attendance_type: 'check_in',
          status: 'present',
        });
      });

      expect(mockCallRPC).toHaveBeenCalledWith(
        'upsert_attendance_log',
        expect.objectContaining({
          p_check_in_method: 'manual',
          p_class_id: null,
          p_notes: null,
        })
      );
    });

    it('passes check_in_method from input when provided', async () => {
      mockCallRPC.mockResolvedValue({
        data: { ...mockAttendanceLog, id: 'new-log' },
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpsertAttendanceLog(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          student_id: 'student-1',
          occurred_at: '2026-03-06T09:00:00+09:00',
          attendance_type: 'check_in',
          status: 'present',
          check_in_method: 'qr_scan',
        } as CreateAttendanceLogInput);
      });

      expect(mockCallRPC).toHaveBeenCalledWith(
        'upsert_attendance_log',
        expect.objectContaining({
          p_check_in_method: 'qr_scan',
        })
      );
    });

    it('throws error when RPC call fails', async () => {
      mockCallRPC.mockResolvedValue({
        data: null,
        error: { message: 'RPC function not found' },
        success: false,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpsertAttendanceLog(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            student_id: 'student-1',
            occurred_at: '2026-03-06T09:00:00+09:00',
            attendance_type: 'check_in',
            status: 'present',
          });
        })
      ).rejects.toThrow('RPC function not found');
    });

    it('throws generic error when RPC fails without error message', async () => {
      mockCallRPC.mockResolvedValue({
        data: null,
        error: null,
        success: false,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpsertAttendanceLog(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            student_id: 'student-1',
            occurred_at: '2026-03-06T09:00:00+09:00',
            attendance_type: 'check_in',
            status: 'present',
          });
        })
      ).rejects.toThrow('RPC 호출 실패');
    });

    it('creates execution audit record for upsert operation', async () => {
      const upsertedLog: AttendanceLog = {
        ...mockAttendanceLog,
        id: 'upserted-audit',
      };

      mockCallRPC.mockResolvedValue({
        data: upsertedLog,
        error: null,
        success: true,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpsertAttendanceLog(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          student_id: 'student-1',
          occurred_at: '2026-03-06T09:00:00+09:00',
          attendance_type: 'absent',
          status: 'absent',
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockCreateExecutionAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          operation_type: 'attendance.upsert',
          status: 'success',
          summary: expect.stringContaining('absent'),
          details: expect.objectContaining({
            attendance_log_id: 'upserted-audit',
            student_id: 'student-1',
            attendance_type: 'absent',
            status: 'absent',
          }),
          reference: expect.objectContaining({
            entity_type: 'attendance_log',
            entity_id: 'upserted-audit',
          }),
        }),
        'test-user-id'
      );
    });
  });

  describe('optimistic updates (onMutate)', () => {
    it('adds new optimistic log when id is not provided', async () => {
      // Set up a slow RPC response so we can check optimistic update
      mockCallRPC.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: { ...mockAttendanceLog, id: 'new-from-server' },
                  error: null,
                  success: true,
                }),
              50
            )
          )
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      const { wrapper } = createWrapper(queryClient);

      // Seed cache with existing data
      const cacheKey = ['attendance-logs', 'test-tenant-id', JSON.stringify(undefined)];
      queryClient.setQueryData(cacheKey, [mockAttendanceLog]);

      const { result } = renderHook(() => useUpsertAttendanceLog(), { wrapper });

      // Start mutation (don't await)
      act(() => {
        result.current.mutate({
          student_id: 'student-new',
          occurred_at: '2026-03-06T10:00:00+09:00',
          attendance_type: 'check_in',
          status: 'present',
        });
      });

      // Wait for optimistic data to appear in cache
      await waitFor(() => {
        const cachedData = queryClient.getQueryData<AttendanceLog[]>(cacheKey);
        // Should have 2 items: the new optimistic + original
        return expect(cachedData?.length).toBe(2);
      });

      const cachedData = queryClient.getQueryData<AttendanceLog[]>(cacheKey);
      // New optimistic log should be first (prepended)
      expect(cachedData![0].student_id).toBe('student-new');
      expect(cachedData![0].id).toMatch(/^temp-/);

      // Wait for mutation to complete
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('replaces existing log optimistically when id is provided', async () => {
      mockPatch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: { ...mockAttendanceLog, id: 'log-1', status: 'late' },
                  error: null,
                  success: true,
                }),
              50
            )
          )
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      const { wrapper } = createWrapper(queryClient);

      // Seed cache with existing data
      const cacheKey = ['attendance-logs', 'test-tenant-id', JSON.stringify(undefined)];
      queryClient.setQueryData(cacheKey, [mockAttendanceLog]);

      const { result } = renderHook(() => useUpsertAttendanceLog(), { wrapper });

      // Start mutation with existing id
      act(() => {
        result.current.mutate({
          id: 'log-1',
          student_id: 'student-1',
          occurred_at: '2026-03-06T09:00:00+09:00',
          attendance_type: 'check_in',
          status: 'late',
        });
      });

      // Wait for optimistic update
      await waitFor(() => {
        const cachedData = queryClient.getQueryData<AttendanceLog[]>(cacheKey);
        return expect(cachedData?.[0]?.status).toBe('late');
      });

      const cachedData = queryClient.getQueryData<AttendanceLog[]>(cacheKey);
      expect(cachedData).toHaveLength(1); // Same number (update, not insert)
      expect(cachedData![0].id).toBe('log-1');

      // Wait for mutation to complete
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('creates optimistic log with temp id for empty cache', async () => {
      mockCallRPC.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: { ...mockAttendanceLog, id: 'new-id' },
                  error: null,
                  success: true,
                }),
              50
            )
          )
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      const { wrapper } = createWrapper(queryClient);

      // Seed cache with empty array
      const cacheKey = ['attendance-logs', 'test-tenant-id', JSON.stringify(undefined)];
      queryClient.setQueryData(cacheKey, []);

      const { result } = renderHook(() => useUpsertAttendanceLog(), { wrapper });

      act(() => {
        result.current.mutate({
          student_id: 'student-new',
          occurred_at: '2026-03-06T10:00:00+09:00',
          attendance_type: 'check_in',
          status: 'present',
        });
      });

      // Wait for optimistic update
      await waitFor(() => {
        const cachedData = queryClient.getQueryData<AttendanceLog[]>(cacheKey);
        return expect(cachedData?.length).toBe(1);
      });

      const cachedData = queryClient.getQueryData<AttendanceLog[]>(cacheKey);
      expect(cachedData![0].student_id).toBe('student-new');
      expect(cachedData![0].tenant_id).toBe('test-tenant-id');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe('error rollback (onError)', () => {
    it('rolls back to previous data on mutation error', async () => {
      mockCallRPC.mockRejectedValue(new Error('Server error'));

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      const { wrapper } = createWrapper(queryClient);

      // Seed cache with original data
      const cacheKey = ['attendance-logs', 'test-tenant-id', JSON.stringify(undefined)];
      const originalData = [mockAttendanceLog];
      queryClient.setQueryData(cacheKey, originalData);

      const { result } = renderHook(() => useUpsertAttendanceLog(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            student_id: 'student-fail',
            occurred_at: '2026-03-06T10:00:00+09:00',
            attendance_type: 'check_in',
            status: 'present',
          });
        } catch {
          // Expected to throw
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      // Cache should be rolled back to original data
      const cachedData = queryClient.getQueryData<AttendanceLog[]>(cacheKey);
      expect(cachedData).toEqual(originalData);
    });
  });

  describe('cache invalidation (onSuccess)', () => {
    it('invalidates attendance-logs queries on successful upsert', async () => {
      mockCallRPC.mockResolvedValue({
        data: { ...mockAttendanceLog, id: 'new-log-id' },
        error: null,
        success: true,
      });

      const { queryClient, wrapper } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpsertAttendanceLog(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          student_id: 'student-1',
          occurred_at: '2026-03-06T09:00:00+09:00',
          attendance_type: 'check_in',
          status: 'present',
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalled();

      invalidateSpy.mockRestore();
    });

    it('invalidates attendance-logs queries on successful update', async () => {
      mockPatch.mockResolvedValue({
        data: { ...mockAttendanceLog, id: 'log-1', status: 'excused' },
        error: null,
        success: true,
      });

      const { queryClient, wrapper } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpsertAttendanceLog(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 'log-1',
          student_id: 'student-1',
          occurred_at: '2026-03-06T09:00:00+09:00',
          attendance_type: 'check_in',
          status: 'excused',
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalled();

      invalidateSpy.mockRestore();
    });
  });
});
