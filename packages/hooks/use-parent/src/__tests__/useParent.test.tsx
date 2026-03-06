/**
 * useParent Hook Unit Tests
 *
 * 테스트 범위:
 * - useChildren: 자녀 목록 조회 Hook (성공, 에러, 빈 결과, disabled)
 * - guardians + persons API 호출 체이닝
 * - PostgREST 1:1/1:N 관계 데이터 변환
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import * as apiSdk from '@api-sdk/core';

// ============================================================================
// Mocks
// ============================================================================

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

vi.mock('@services/student-service', () => ({}));
vi.mock('@core/party', () => ({}));

// ============================================================================
// Imports (after mocks due to hoisting)
// ============================================================================

import { useChildren } from '../useParent';

// ============================================================================
// Test Helpers
// ============================================================================

const TENANT_ID = 'test-tenant-id';

const mockApiClient = apiSdk.apiClient as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  callRPC: ReturnType<typeof vi.fn>;
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

function createMockGuardian(overrides?: Record<string, unknown>) {
  return {
    id: 'guardian-1',
    tenant_id: TENANT_ID,
    student_id: 'student-1',
    parent_id: 'parent-1',
    is_primary: true,
    relationship: 'mother',
    ...overrides,
  };
}

function createMockPersonWithStudent(overrides?: Record<string, unknown>) {
  return {
    id: 'student-1',
    tenant_id: TENANT_ID,
    name: 'Test Student',
    phone: '010-1234-5678',
    email: 'student@test.com',
    address: 'Seoul',
    academy_students: [
      {
        birth_date: '2015-03-15',
        gender: 'male',
        school_name: 'Test School',
        grade: 3,
        status: 'active',
        notes: 'Good student',
      },
    ],
    ...overrides,
  };
}

// ============================================================================
// Tests: useChildren
// ============================================================================

describe('useChildren', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('성공 시 자녀 목록을 반환한다', async () => {
    const mockGuardians = [createMockGuardian()];
    const mockPersons = [createMockPersonWithStudent()];

    mockApiClient.get
      .mockResolvedValueOnce({ data: mockGuardians, error: null })
      .mockResolvedValueOnce({ data: mockPersons, error: null });

    const { result } = renderHook(() => useChildren(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0]).toMatchObject({
      id: 'student-1',
      tenant_id: TENANT_ID,
      name: 'Test Student',
      phone: '010-1234-5678',
      school_name: 'Test School',
      grade: 3,
      status: 'active',
    });
  });

  it('보호자가 없으면 빈 배열을 반환한다', async () => {
    mockApiClient.get.mockResolvedValueOnce({ data: [], error: null });

    const { result } = renderHook(() => useChildren(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
    // persons 조회는 호출되지 않아야 함
    expect(mockApiClient.get).toHaveBeenCalledTimes(1);
  });

  it('guardians API 에러 시 에러를 반환한다', async () => {
    mockApiClient.get.mockResolvedValueOnce({
      data: null,
      error: { message: 'guardians table error' },
    });

    const { result } = renderHook(() => useChildren(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('guardians table error');
  });

  it('persons API 에러 시 에러를 반환한다', async () => {
    const mockGuardians = [createMockGuardian()];

    mockApiClient.get
      .mockResolvedValueOnce({ data: mockGuardians, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'persons table error' } });

    const { result } = renderHook(() => useChildren(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('persons table error');
  });

  it('tenantId가 없으면 쿼리가 비활성화된다', async () => {
    vi.mocked(apiSdk.getApiContext).mockReturnValueOnce({
      tenantId: '',
      industryType: 'academy',
    } as ReturnType<typeof apiSdk.getApiContext>);

    const { result } = renderHook(() => useChildren(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiClient.get).not.toHaveBeenCalled();
  });

  it('여러 자녀를 가진 보호자의 자녀 목록을 반환한다', async () => {
    const mockGuardians = [
      createMockGuardian({ student_id: 'student-1' }),
      createMockGuardian({ id: 'guardian-2', student_id: 'student-2', is_primary: false }),
    ];
    const mockPersons = [
      createMockPersonWithStudent({ id: 'student-1', name: 'Child One' }),
      createMockPersonWithStudent({ id: 'student-2', name: 'Child Two' }),
    ];

    mockApiClient.get
      .mockResolvedValueOnce({ data: mockGuardians, error: null })
      .mockResolvedValueOnce({ data: mockPersons, error: null });

    const { result } = renderHook(() => useChildren(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].name).toBe('Child One');
    expect(result.current.data![1].name).toBe('Child Two');
  });

  it('중복 student_id를 가진 보호자 데이터에서 중복을 제거한다', async () => {
    const mockGuardians = [
      createMockGuardian({ student_id: 'student-1' }),
      createMockGuardian({ id: 'guardian-3', student_id: 'student-1', is_primary: false }),
    ];
    const mockPersons = [createMockPersonWithStudent({ id: 'student-1' })];

    mockApiClient.get
      .mockResolvedValueOnce({ data: mockGuardians, error: null })
      .mockResolvedValueOnce({ data: mockPersons, error: null });

    const { result } = renderHook(() => useChildren(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
  });

  it('PostgREST 1:1 관계(단일 객체)도 올바르게 변환한다', async () => {
    const mockGuardians = [createMockGuardian()];
    const mockPersons = [
      createMockPersonWithStudent({
        id: 'student-1',
        name: 'Single Relation Student',
        academy_students: {
          birth_date: '2014-05-20',
          gender: 'female',
          school_name: 'Another School',
          grade: 4,
          status: 'active',
          notes: null,
        },
      }),
    ];

    mockApiClient.get
      .mockResolvedValueOnce({ data: mockGuardians, error: null })
      .mockResolvedValueOnce({ data: mockPersons, error: null });

    const { result } = renderHook(() => useChildren(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data![0]).toMatchObject({
      name: 'Single Relation Student',
      school_name: 'Another School',
      grade: 4,
      gender: 'female',
    });
  });

  it('academy_students가 없는 경우 기본값으로 변환한다', async () => {
    const mockGuardians = [createMockGuardian()];
    const mockPersons = [
      createMockPersonWithStudent({
        id: 'student-1',
        name: 'No Academy Data',
        academy_students: undefined,
      }),
    ];

    mockApiClient.get
      .mockResolvedValueOnce({ data: mockGuardians, error: null })
      .mockResolvedValueOnce({ data: mockPersons, error: null });

    const { result } = renderHook(() => useChildren(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data![0]).toMatchObject({
      name: 'No Academy Data',
      status: 'active', // 기본값
    });
  });

  it('guardians API를 올바른 파라미터로 호출한다', async () => {
    mockApiClient.get.mockResolvedValueOnce({ data: [], error: null });

    const { result } = renderHook(() => useChildren(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.get).toHaveBeenCalledWith('guardians', {
      filters: {},
      orderBy: { column: 'is_primary', ascending: false },
    });
  });

  it('persons 조회 시 올바른 select와 filters를 전달한다', async () => {
    const mockGuardians = [
      createMockGuardian({ student_id: 'student-1' }),
      createMockGuardian({ id: 'guardian-2', student_id: 'student-2' }),
    ];

    mockApiClient.get
      .mockResolvedValueOnce({ data: mockGuardians, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const { result } = renderHook(() => useChildren(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.get).toHaveBeenCalledTimes(2);
    const personsCall = mockApiClient.get.mock.calls[1];
    expect(personsCall[0]).toBe('persons');
    expect(personsCall[1]).toMatchObject({
      filters: {
        id: { in: ['student-1', 'student-2'] },
        person_type: 'student',
      },
    });
  });

  it('persons data가 null이면 빈 배열을 반환한다', async () => {
    const mockGuardians = [createMockGuardian()];

    mockApiClient.get
      .mockResolvedValueOnce({ data: mockGuardians, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => useChildren(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });
});
