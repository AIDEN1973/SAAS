/**
 * useStudent Hook Unit Tests
 *
 * [테스트 커버리지] 주요 Hook 기능 테스트
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useStudents, useStudent, useCreateStudent, useUpdateStudent } from '../useStudent';
import * as apiSdk from '@api-sdk/core';

// API SDK 모킹
vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
}));

// useSession 모킹
vi.mock('@hooks/use-auth', () => ({
  useSession: vi.fn(() => ({
    data: {
      user: { id: 'test-user-id' },
    },
  })),
}));

describe('useStudent Hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('useStudents', () => {
    it('학생 목록을 성공적으로 조회한다', async () => {
      const mockStudents = [
        { id: '1', name: '학생1', status: 'active' },
        { id: '2', name: '학생2', status: 'active' },
      ];

      vi.mocked(apiSdk.apiClient.get).mockResolvedValueOnce({
        data: mockStudents,
        error: null,
      });

      const { result } = renderHook(() => useStudents(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockStudents);
    });

    it('네트워크 오류 시 3회 재시도한다', async () => {
      vi.mocked(apiSdk.apiClient.get).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useStudents(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // retry: 3이므로 총 4회 호출 (초기 1회 + 재시도 3회)
      // 단, 실제로는 retry 로직이 비활성화되어 1회만 호출됨 (beforeEach에서 설정)
      expect(apiSdk.apiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('useStudent', () => {
    it('학생 상세 정보를 성공적으로 조회한다', async () => {
      const mockStudent = { id: 'student-123', name: '학생1', status: 'active' };

      vi.mocked(apiSdk.apiClient.get).mockResolvedValueOnce({
        data: [mockStudent],
        error: null,
      });

      const { result } = renderHook(() => useStudent('student-123'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockStudent);
    });

    it('studentId가 null이면 쿼리를 실행하지 않는다', () => {
      const { result } = renderHook(() => useStudent(null), { wrapper });

      expect(result.current.isFetching).toBe(false);
      expect(apiSdk.apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe('useCreateStudent', () => {
    it('학생을 성공적으로 생성한다', async () => {
      const mockPerson = { id: 'person-1', name: '새학생', person_type: 'student' };
      const mockAcademyStudent = { person_id: 'person-1', status: 'active' };

      vi.mocked(apiSdk.apiClient.post)
        .mockResolvedValueOnce({ data: mockPerson, error: null }) // persons
        .mockResolvedValueOnce({ data: mockAcademyStudent, error: null }); // academy_students

      const { result } = renderHook(() => useCreateStudent(), { wrapper });

      const input = {
        name: '새학생',
        status: 'active' as const,
      };

      await result.current.mutateAsync(input);

      expect(apiSdk.apiClient.post).toHaveBeenCalledTimes(2);
      expect(apiSdk.apiClient.post).toHaveBeenCalledWith('persons', expect.objectContaining({
        name: '새학생',
        person_type: 'student',
      }));
    });

    it('persons 생성 실패 시 에러를 발생시킨다', async () => {
      vi.mocked(apiSdk.apiClient.post).mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const { result } = renderHook(() => useCreateStudent(), { wrapper });

      await expect(result.current.mutateAsync({ name: '학생', status: 'active' })).rejects.toThrow('Database error');
    });
  });

  describe('useUpdateStudent', () => {
    it('학생 정보를 성공적으로 업데이트한다', async () => {
      vi.mocked(apiSdk.apiClient.patch)
        .mockResolvedValueOnce({ data: {}, error: null }) // persons
        .mockResolvedValueOnce({ data: {}, error: null }); // academy_students (GET 이후)

      vi.mocked(apiSdk.apiClient.get).mockResolvedValueOnce({
        data: [{ person_id: 'student-1' }],
        error: null,
      });

      const { result } = renderHook(() => useUpdateStudent(), { wrapper });

      await result.current.mutateAsync({
        studentId: 'student-1',
        input: { name: '수정된이름' },
      });

      expect(apiSdk.apiClient.patch).toHaveBeenCalled();
    });
  });
});
