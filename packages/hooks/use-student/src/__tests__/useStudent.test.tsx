/**
 * useStudent Hook Unit Tests
 *
 * [테스트 커버리지] 주요 Hook 기능 테스트
 *
 * 파이프라인 구조:
 *   useStudents → fetchStudents → resolveStudentFilterIds → apiClient.get('persons') → enrichStudentsWithRelations
 *   useStudent → apiClient.get('academy_students') → apiClient.get('persons') → extractAcademyData → mapPersonToStudent
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import * as apiSdk from '@api-sdk/core';

// student-list-core 모킹 (파이프라인 단순화)
vi.mock('../student-list-core', () => ({
  resolveStudentFilterIds: vi.fn().mockResolvedValue(undefined),
  enrichStudentsWithRelations: vi.fn().mockResolvedValue({
    guardiansMap: new Map(),
    studentClassMap: new Map(),
  }),
  PERSONS_WITH_ACADEMY_SELECT: '*, academy_students (*)',
}));

// industry adapter 모킹
vi.mock('@industry/academy', () => ({
  extractAcademyData: vi.fn((data: unknown) => data || {}),
  mapPersonToStudent: vi.fn((person: Record<string, unknown>, academyData: unknown, extra?: Record<string, unknown>) => ({
    ...person,
    ...((academyData && typeof academyData === 'object') ? academyData : {}),
    ...(extra || {}),
  })),
}));

// API SDK 모킹
vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    callRPC: vi.fn(),
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

// student-service 타입 모킹
vi.mock('@services/student-service', () => ({}));

// 모킹 후 import
import { useStudents, useStudent, useCreateStudent, useUpdateStudent } from '../useStudent';
import { fetchStudents } from '../student-queries';

describe('useStudent Hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
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
      const mockPersons = [
        { id: '1', name: '학생1', person_type: 'student', academy_students: { status: 'active' } },
        { id: '2', name: '학생2', person_type: 'student', academy_students: { status: 'active' } },
      ];

      vi.mocked(apiSdk.apiClient.get).mockResolvedValueOnce({
        data: mockPersons,
        error: null,
      });

      const { result } = renderHook(() => useStudents(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data).toHaveLength(2);
    });

    it('네트워크 오류 시 fetchStudents가 에러를 throw한다', async () => {
      // hook의 retry:3 때문에 hook 레벨 에러 테스트는 시간이 오래 걸림
      // 대신 queryFn인 fetchStudents를 직접 테스트
      vi.mocked(apiSdk.apiClient.get).mockResolvedValueOnce({
        data: null,
        error: { message: 'Network error' },
      });

      await expect(fetchStudents('test-tenant-id')).rejects.toThrow('Network error');
      expect(apiSdk.apiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('useStudent', () => {
    it('학생 상세 정보를 성공적으로 조회한다', async () => {
      const mockPerson = {
        id: 'student-123',
        name: '학생1',
        person_type: 'student',
        academy_students: [{ status: 'active' }],
      };

      // 1차: academy_students 삭제 확인 (deleted_at 체크)
      vi.mocked(apiSdk.apiClient.get).mockResolvedValueOnce({
        data: [{ person_id: 'student-123' }],
        error: null,
      });
      // 2차: persons 조회
      vi.mocked(apiSdk.apiClient.get).mockResolvedValueOnce({
        data: [mockPerson],
        error: null,
      });

      const { result } = renderHook(() => useStudent('student-123'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(apiSdk.apiClient.get).toHaveBeenCalledTimes(2);
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
        .mockResolvedValueOnce({ data: mockAcademyStudent, error: null }) // academy_students
        .mockResolvedValueOnce({ data: null, error: null }); // execution audit (3번째 post)

      const { result } = renderHook(() => useCreateStudent(), { wrapper });

      const input = {
        name: '새학생',
        status: 'active' as const,
      };

      await result.current.mutateAsync(input);

      // persons + academy_students + (execution audit 등) 최소 2회
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
        .mockResolvedValueOnce({ data: {}, error: null }); // academy_students

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
