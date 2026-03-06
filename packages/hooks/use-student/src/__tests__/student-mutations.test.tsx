/**
 * Student Mutations 유닛 테스트
 *
 * 테스트 대상:
 * - useCreateStudent: persons + academy_students 2단계 생성, 소프트 삭제 복원, 롤백
 * - useUpdateStudent: persons + academy_students PATCH 분리, Optimistic Update, 롤백
 * - useDeleteStudent: RPC soft_delete_student 호출, Optimistic Update
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
const mockCallRPC = vi.fn();

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    callRPC: (...args: unknown[]) => mockCallRPC(...args),
  },
  getApiContext: () => ({ tenantId: 'test-tenant-id', industryType: 'academy' }),
}));

vi.mock('@hooks/use-auth', () => ({
  useSession: () => ({ data: { user: { id: 'test-user-id' } } }),
}));

vi.mock('@lib/normalization', () => ({
  normalizePhoneNumber: (phone?: string) =>
    phone ? phone.replace(/-/g, '').replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3') : null,
}));

vi.mock('./audit-mutation', () => ({
  recordMutationAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@services/student-service', () => ({
  extractAcademyData: (data: unknown) => {
    if (Array.isArray(data)) return data[0] || null;
    return data;
  },
  mapPersonToStudent: (
    person: Record<string, unknown>,
    academyData: Record<string, unknown> | null
  ) => ({
    id: person.id,
    tenant_id: 'test-tenant-id',
    name: person.name,
    phone: person.phone,
    status: (academyData as { status?: string } | null)?.status || 'active',
    ...(academyData || {}),
  }),
}));

import { useCreateStudent, useUpdateStudent, useDeleteStudent } from '../student-mutations';
import type { Student } from '@services/student-service';

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

/**
 * useCreateStudent 공통 mock 설정
 * - callRPC('find_deleted_student') → 빈 결과
 * - callRPC('generate_attendance_number') → 출결번호 반환
 */
function setupCreateMocks() {
  // find_deleted_student: 삭제된 학생 없음
  mockCallRPC.mockImplementation((rpcName: string) => {
    if (rpcName === 'find_deleted_student') {
      return Promise.resolve({ data: [], error: null });
    }
    if (rpcName === 'generate_attendance_number') {
      return Promise.resolve({ data: 'ATT-001', error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
}

// ===== Tests =====

describe('useCreateStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persons POST → academy_students POST 2단계 생성', async () => {
    setupCreateMocks();

    // persons POST 성공
    mockPost.mockImplementation((table: string) => {
      if (table === 'persons') {
        return Promise.resolve({
          data: { id: 'person-1', name: '홍길동', phone: '010-1234-5678', person_type: 'student' },
          error: null,
        });
      }
      if (table === 'academy_students') {
        return Promise.resolve({
          data: { person_id: 'person-1', tenant_id: 'test-tenant-id', status: 'active' },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateStudent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: '홍길동',
        phone: '01012345678',
        email: 'hong@example.com',
        address: '서울시 강남구',
        birth_date: '2010-03-15',
        gender: 'male',
        status: 'active',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // find_deleted_student RPC 호출 확인
    expect(mockCallRPC).toHaveBeenCalledWith('find_deleted_student', expect.objectContaining({
      p_tenant_id: 'test-tenant-id',
      p_name: '홍길동',
    }));

    // persons POST 호출 확인
    expect(mockPost).toHaveBeenCalledWith('persons', expect.objectContaining({
      name: '홍길동',
      person_type: 'student',
    }));

    // academy_students POST 호출 확인
    expect(mockPost).toHaveBeenCalledWith('academy_students', expect.objectContaining({
      person_id: 'person-1',
    }));

    // 호출 순서 확인 (persons → academy_students)
    const postCalls = mockPost.mock.calls;
    expect(postCalls[0][0]).toBe('persons');
    expect(postCalls[1][0]).toBe('academy_students');
  });

  it('전화번호 정규화 호출', async () => {
    setupCreateMocks();

    mockPost.mockImplementation((table: string) => {
      if (table === 'persons') {
        return Promise.resolve({
          data: { id: 'person-2', name: '김철수', phone: '010-1234-5678', person_type: 'student' },
          error: null,
        });
      }
      if (table === 'academy_students') {
        return Promise.resolve({
          data: { person_id: 'person-2', tenant_id: 'test-tenant-id', status: 'active' },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateStudent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: '김철수', phone: '01012345678' });
    });

    // 정규화된 전화번호로 persons POST 호출 확인
    expect(mockPost).toHaveBeenCalledWith(
      'persons',
      expect.objectContaining({ phone: '010-1234-5678' })
    );
  });

  it('소프트 삭제 복원 경로', async () => {
    // find_deleted_student: 삭제된 학생 발견
    mockCallRPC.mockImplementation((rpcName: string) => {
      if (rpcName === 'find_deleted_student') {
        return Promise.resolve({
          data: [{
            person_id: 'deleted-person-1',
            name: '이영희',
            phone: '010-1234-5678',
            deleted_at: '2026-01-01T00:00:00Z',
          }],
          error: null,
        });
      }
      if (rpcName === 'restore_deleted_student') {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // persons + academy PATCH 성공
    mockPatch.mockResolvedValue({ data: null, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateStudent(), { wrapper });

    let student: Student & { restored?: boolean };
    await act(async () => {
      student = await result.current.mutateAsync({
        name: '이영희',
        phone: '01012345678',
        address: '서울시 서초구',
        birth_date: '2009-05-20',
        status: 'active',
      });
    });

    // restore_deleted_student RPC 호출 확인
    expect(mockCallRPC).toHaveBeenCalledWith('restore_deleted_student', {
      p_person_id: 'deleted-person-1',
      p_status: 'active',
    });

    // 복원 플래그 확인
    expect(student!.restored).toBe(true);
  });

  it('persons POST 실패 시 에러 throw', async () => {
    setupCreateMocks();

    // persons POST 실패
    mockPost.mockImplementation((table: string) => {
      if (table === 'persons') {
        return Promise.resolve({ data: null, error: { message: 'Database connection error' } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateStudent(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ name: '박민수', phone: '01012345678' });
      })
    ).rejects.toThrow('Database connection error');
  });

  it('academy_students POST 실패 시 persons 롤백', async () => {
    setupCreateMocks();

    mockPost.mockImplementation((table: string) => {
      if (table === 'persons') {
        return Promise.resolve({
          data: { id: 'person-new', name: '최수진', phone: '010-1234-5678', person_type: 'student' },
          error: null,
        });
      }
      if (table === 'academy_students') {
        return Promise.resolve({ data: null, error: { message: 'Duplicate key violation' } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockDelete.mockImplementation(() => Promise.resolve({ data: null, error: null }));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateStudent(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ name: '최수진', phone: '01012345678' });
      })
    ).rejects.toThrow('Duplicate key violation');

    await waitFor(() => {
      // persons 롤백 호출 확인
      expect(mockDelete).toHaveBeenCalledWith('persons', 'person-new');
    });
  });

  it('보호자 + 태그 병렬 생성', async () => {
    setupCreateMocks();

    mockPost.mockImplementation((table: string) => {
      if (table === 'persons') {
        return Promise.resolve({
          data: { id: 'person-3', name: '정하늘', phone: '010-1234-5678', person_type: 'student' },
          error: null,
        });
      }
      if (table === 'academy_students') {
        return Promise.resolve({
          data: { person_id: 'person-3', tenant_id: 'test-tenant-id', status: 'active' },
          error: null,
        });
      }
      if (table === 'guardians') {
        return Promise.resolve({ data: { id: 'guardian-1' }, error: null });
      }
      if (table === 'tag_assignments') {
        return Promise.resolve({ data: { id: 'tag-assign-1' }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateStudent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: '정하늘',
        phone: '01012345678',
        guardians: [{ name: '학부모1', phone: '01011112222' }],
        tag_ids: ['tag-1', 'tag-2'],
      });
    });

    // guardians POST 호출 확인
    expect(mockPost).toHaveBeenCalledWith(
      'guardians',
      expect.objectContaining({
        tenant_id: 'test-tenant-id',
        student_id: 'person-3',
        name: '학부모1',
      })
    );

    // tag_assignments POST 호출 확인 (2번)
    expect(mockPost).toHaveBeenCalledWith(
      'tag_assignments',
      expect.objectContaining({ entity_id: 'person-3', tag_id: 'tag-1' })
    );
    expect(mockPost).toHaveBeenCalledWith(
      'tag_assignments',
      expect.objectContaining({ entity_id: 'person-3', tag_id: 'tag-2' })
    );
  });
});

describe('useUpdateStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persons + academy_students PATCH 분리', async () => {
    // persons PATCH 성공
    mockPatch.mockImplementation((table: string) => {
      return Promise.resolve({ data: null, error: null });
    });

    // academy_students GET → persons GET (업데이트된 학생)
    mockGet.mockImplementation((table: string, opts?: Record<string, unknown>) => {
      if (table === 'academy_students') {
        return Promise.resolve({
          data: [{
            person_id: 'student-1', tenant_id: 'test-tenant-id',
            status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01',
          }],
          error: null,
        });
      }
      if (table === 'persons') {
        return Promise.resolve({
          data: [{
            id: 'student-1', name: '수정된이름', phone: '010-9876-5432',
            person_type: 'student',
            academy_students: [{ person_id: 'student-1', status: 'inactive' }],
          }],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateStudent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        studentId: 'student-1',
        input: { name: '수정된이름', status: 'inactive', phone: '01098765432' },
      });
    });

    expect(result.current.isSuccess).toBe(true);

    // persons PATCH 호출 확인
    expect(mockPatch).toHaveBeenCalledWith(
      'persons', 'student-1',
      expect.objectContaining({ name: '수정된이름' })
    );

    // academy_students PATCH 호출 확인
    expect(mockPatch).toHaveBeenCalledWith(
      'academy_students', 'student-1',
      expect.objectContaining({ status: 'inactive' })
    );
  });

  it('Optimistic Update 적용', async () => {
    const { queryClient, wrapper } = createWrapper();

    // 초기 데이터 설정
    const initialStudent: Student = {
      id: 'student-opt',
      tenant_id: 'test-tenant-id',
      industry_type: 'academy',
      name: '원래이름',
      phone: '010-0000-0000',
      status: 'active',
    };
    queryClient.setQueryData(['student', 'test-tenant-id', 'student-opt'], initialStudent);

    // PATCH + GET를 느린 Promise로 설정 (Optimistic Update 확인 시간 확보)
    let resolvePatches: Array<(val: unknown) => void> = [];
    mockPatch.mockImplementation(() =>
      new Promise((resolve) => { resolvePatches.push(resolve); })
    );

    mockGet.mockImplementation((table: string) => {
      if (table === 'academy_students') {
        return Promise.resolve({
          data: [{ person_id: 'student-opt', tenant_id: 'test-tenant-id', status: 'active' }],
          error: null,
        });
      }
      if (table === 'persons') {
        return Promise.resolve({
          data: [{
            id: 'student-opt', name: '낙관적업데이트', phone: '010-1111-2222',
            person_type: 'student',
            academy_students: [{ person_id: 'student-opt', status: 'active' }],
          }],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    const { result } = renderHook(() => useUpdateStudent(), { wrapper });

    // mutateAsync를 시작하지만 await하지 않음 → onMutate가 즉시 실행
    let mutatePromise: Promise<unknown>;
    act(() => {
      mutatePromise = result.current.mutateAsync({
        studentId: 'student-opt',
        input: { name: '낙관적업데이트', phone: '01011112222' },
      });
    });

    // Optimistic Update 확인
    await waitFor(() => {
      const optimisticData = queryClient.getQueryData<Student>(['student', 'test-tenant-id', 'student-opt']);
      expect(optimisticData?.name).toBe('낙관적업데이트');
    });

    // Patch를 resolve하여 mutation 완료
    resolvePatches.forEach((r) => r({ data: null, error: null }));
    await act(async () => { await mutatePromise!.catch(() => {}); });
  });

  it('에러 시 롤백', async () => {
    const { queryClient, wrapper } = createWrapper();

    // 초기 데이터 설정
    const initialStudent: Student = {
      id: 'student-rb',
      tenant_id: 'test-tenant-id',
      industry_type: 'academy',
      name: '원래이름',
      phone: '010-0000-0000',
      status: 'active',
    };
    queryClient.setQueryData(['student', 'test-tenant-id', 'student-rb'], initialStudent);

    // persons PATCH 실패
    mockPatch.mockResolvedValue({ data: null, error: { message: 'Update failed' } });

    const { result } = renderHook(() => useUpdateStudent(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ studentId: 'student-rb', input: { name: '에러발생' } });
      })
    ).rejects.toThrow('Update failed');

    // 롤백 확인 - 원래 데이터 복원
    await waitFor(() => {
      const rolledBackData = queryClient.getQueryData<Student>(['student', 'test-tenant-id', 'student-rb']);
      expect(rolledBackData?.name).toBe('원래이름');
    });
  });
});

describe('useDeleteStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('RPC soft_delete_student 호출 + Optimistic Update', async () => {
    const { queryClient, wrapper } = createWrapper();

    // 초기 학생 목록 설정
    const initialStudents: Student[] = [
      { id: 'student-1', tenant_id: 'test-tenant-id', industry_type: 'academy', name: '학생1', phone: '010-0001', status: 'active' },
      { id: 'student-del', tenant_id: 'test-tenant-id', industry_type: 'academy', name: '삭제대상', phone: '010-0002', status: 'active' },
      { id: 'student-3', tenant_id: 'test-tenant-id', industry_type: 'academy', name: '학생3', phone: '010-0003', status: 'active' },
    ];
    queryClient.setQueryData(['students', 'test-tenant-id'], initialStudents);

    // persons GET (학생 정보 조회) + soft_delete RPC
    mockGet.mockResolvedValue({
      data: [{ id: 'student-del', name: '삭제대상', person_type: 'student' }],
      error: null,
    });

    // RPC를 느린 Promise로 만들어 Optimistic Update 확인
    let resolveRPC: (val: unknown) => void;
    mockCallRPC.mockImplementation(() =>
      new Promise((resolve) => { resolveRPC = resolve; })
    );

    const { result } = renderHook(() => useDeleteStudent(), { wrapper });

    // mutateAsync 시작 (await 하지 않음)
    let deletePromise: Promise<unknown>;
    act(() => {
      deletePromise = result.current.mutateAsync('student-del');
    });

    // Optimistic Update 확인 (즉시 목록에서 제거)
    await waitFor(() => {
      const optimisticStudents = queryClient.getQueryData<Student[]>(['students', 'test-tenant-id']);
      expect(optimisticStudents?.length).toBe(2);
      expect(optimisticStudents?.find((s) => s.id === 'student-del')).toBeUndefined();
    });

    // RPC resolve
    resolveRPC!({ data: null, error: null });
    await act(async () => { await deletePromise!.catch(() => {}); });

    // soft_delete_student RPC 호출 확인
    expect(mockCallRPC).toHaveBeenCalledWith('soft_delete_student', {
      p_person_id: 'student-del',
    });
  });
});
