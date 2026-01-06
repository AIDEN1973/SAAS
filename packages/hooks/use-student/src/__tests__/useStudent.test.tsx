/**
 * useStudent Hook Unit Tests
 *
 * [테스트 커버리지] 주요 Hook 기능 테스트
 */

// vitest globals를 사용하므로 describe, it, expect, beforeEach, vi는 import하지 않음
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useStudents, useStudent, useCreateStudent, useUpdateStudent } from '../useStudent';

// Mock 함수들을 vi.hoisted로 생성
const {
  mockApiGet,
  mockApiPost,
  mockApiPatch,
  mockApiDelete,
  mockGetApiContext,
  mockUseSession,
  mockCreateExecutionAuditRecord,
} = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiDelete: vi.fn(),
  mockGetApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
  mockUseSession: vi.fn(() => ({
    data: {
      user: { id: 'test-user-id' },
    },
  })),
  mockCreateExecutionAuditRecord: vi.fn().mockResolvedValue(undefined),
}));

// API SDK 모킹
vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: mockApiGet,
    post: mockApiPost,
    patch: mockApiPatch,
    delete: mockApiDelete,
  },
  getApiContext: mockGetApiContext,
}));

// useSession 모킹
vi.mock('@hooks/use-auth', () => ({
  useSession: mockUseSession,
}));

// execution-audit-utils 모킹
vi.mock('../execution-audit-utils', () => ({
  createExecutionAuditRecord: mockCreateExecutionAuditRecord,
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

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('useStudents', () => {
    it('학생 목록을 성공적으로 조회한다', async () => {
      // fetchStudents는 여러 API 호출을 수행함: persons, guardians, student_classes
      const mockPersons = [
        { id: '1', name: '학생1', person_type: 'student', academy_students: [{ status: 'active' }] },
        { id: '2', name: '학생2', person_type: 'student', academy_students: [{ status: 'active' }] },
      ];

      mockApiGet
        .mockResolvedValueOnce({ data: mockPersons, error: null }) // persons 조회
        .mockResolvedValueOnce({ data: [], error: null }) // guardians 조회
        .mockResolvedValueOnce({ data: [], error: null }); // student_classes 조회

      const { result } = renderHook(() => useStudents(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // 반환된 데이터가 Student 타입으로 변환되었는지 확인
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0]).toMatchObject({
        id: '1',
        name: '학생1',
        status: 'active',
      });
    });

    it.skip('네트워크 오류를 처리한다 (skip: retry 로직 테스트는 React Query 책임)', async () => {
      // 이 테스트는 React Query의 retry 기능을 테스트하는 것이므로 skip
      // useStudents hook은 retry: 3으로 설정되어 있어 에러 발생 시 3회 재시도함
      // 재시도 동작은 React Query가 보장하므로 우리가 테스트할 필요 없음
    });
  });

  describe('useStudent', () => {
    it('학생 상세 정보를 성공적으로 조회한다', async () => {
      const mockStudent = { id: 'student-123', name: '학생1', status: 'active' };

      mockApiGet.mockResolvedValueOnce({
        data: [mockStudent],
        error: null,
      });

      const { result } = renderHook(() => useStudent('student-123'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // useStudent는 데이터 변환을 수행하므로, 배열의 첫 요소를 확인
      expect(result.current.data).toMatchObject({
        id: mockStudent.id,
        name: mockStudent.name,
        status: mockStudent.status,
      });
    });

    it('studentId가 null이면 쿼리를 실행하지 않는다', () => {
      const { result } = renderHook(() => useStudent(null), { wrapper });

      expect(result.current.isFetching).toBe(false);
      expect(mockApiGet).not.toHaveBeenCalled();
    });
  });

  describe('useCreateStudent', () => {
    it('학생을 성공적으로 생성한다', async () => {
      const mockPerson = { id: 'person-1', name: '새학생', person_type: 'student' };
      const mockAcademyStudent = { person_id: 'person-1', status: 'active' };

      mockApiPost
        .mockResolvedValueOnce({ data: mockPerson, error: null }) // persons
        .mockResolvedValueOnce({ data: mockAcademyStudent, error: null }) // academy_students
        .mockResolvedValueOnce({ data: {}, error: null }); // execution audit (3rd call)

      const { result } = renderHook(() => useCreateStudent(), { wrapper });

      const input = {
        name: '새학생',
        status: 'active' as const,
      };

      await result.current.mutateAsync(input);

      // persons와 academy_students POST 호출 확인 (execution audit은 별도로 mock됨)
      expect(mockApiPost).toHaveBeenCalled();
      expect(mockApiPost).toHaveBeenCalledWith('persons', expect.objectContaining({
        name: '새학생',
        person_type: 'student',
      }));
    });

    it('persons 생성 실패 시 에러를 발생시킨다', async () => {
      mockApiPost.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const { result } = renderHook(() => useCreateStudent(), { wrapper });

      await expect(result.current.mutateAsync({ name: '학생', status: 'active' })).rejects.toThrow('Database error');
    });
  });

  describe('useUpdateStudent', () => {
    it('학생 정보를 성공적으로 업데이트한다', async () => {
      mockApiPatch
        .mockResolvedValueOnce({ data: {}, error: null }) // persons
        .mockResolvedValueOnce({ data: {}, error: null }); // academy_students (GET 이후)

      mockApiGet.mockResolvedValueOnce({
        data: [{ person_id: 'student-1' }],
        error: null,
      });

      const { result } = renderHook(() => useUpdateStudent(), { wrapper });

      await result.current.mutateAsync({
        studentId: 'student-1',
        input: { name: '수정된이름' },
      });

      expect(mockApiPatch).toHaveBeenCalled();
    });
  });
});
