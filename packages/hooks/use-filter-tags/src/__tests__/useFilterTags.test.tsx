/**
 * useFilterTags Hook Unit Tests
 *
 * 테스트 범위:
 * - useFilterTags: 필터 태그 목록 조회 Hook
 * - fetchFilterTags: 독립 함수 (성공/에러/빈 결과)
 * - useCreateFilterTag: 생성 Mutation
 * - useDeleteFilterTag: Soft Delete Mutation
 * - fetchFilteredStudents: 독립 함수 (성공/에러)
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

vi.mock('@hooks/use-auth', () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: 'test-user-id' } },
  })),
}));

vi.mock('@core/notification', () => ({}));

// ============================================================================
// Imports (after mocks due to hoisting)
// ============================================================================

import {
  useFilterTags,
  useCreateFilterTag,
  useDeleteFilterTag,
  fetchFilterTags,
  fetchFilteredStudents,
} from '../useFilterTags';
import type { FilterTag, FilteredStudent } from '../useFilterTags';

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

function createMockFilterTag(overrides?: Partial<FilterTag>): FilterTag {
  return {
    id: 'tag-1',
    tenant_id: TENANT_ID,
    name: 'active-students',
    display_label: '활성 학생',
    category: 'status' as FilterTag['category'],
    color: '#4CAF50',
    icon: 'check',
    condition_type: 'eq',
    condition_params: { status: 'active' },
    is_active: true,
    is_system_default: false,
    sort_order: 1,
    usage_count: 10,
    created_at: '2026-01-01T00:00:00Z',
    created_by: 'user-1',
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: 'user-1',
    ...overrides,
  };
}

// ============================================================================
// Tests: fetchFilterTags (standalone function)
// ============================================================================

describe('fetchFilterTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('성공 시 태그 배열을 반환한다', async () => {
    const mockTags = [createMockFilterTag(), createMockFilterTag({ id: 'tag-2', name: 'inactive' })];

    mockApiClient.get.mockResolvedValue({
      data: mockTags,
      error: null,
    });

    const result = await fetchFilterTags(TENANT_ID);

    expect(result).toEqual(mockTags);
    expect(mockApiClient.get).toHaveBeenCalledWith('message_filter_tags', {
      filters: { is_active: true },
      orderBy: { column: 'sort_order', ascending: true },
      limit: 500,
    });
  });

  it('tenantId가 비어있으면 빈 배열을 반환한다', async () => {
    const result = await fetchFilterTags('');

    expect(result).toEqual([]);
    expect(mockApiClient.get).not.toHaveBeenCalled();
  });

  it('category 필터를 적용한다', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    await fetchFilterTags(TENANT_ID, { category: 'status' as FilterTag['category'] });

    expect(mockApiClient.get).toHaveBeenCalledWith('message_filter_tags', {
      filters: { is_active: true, category: 'status' },
      orderBy: { column: 'sort_order', ascending: true },
      limit: 500,
    });
  });

  it('search 필터로 클라이언트 사이드 검색을 수행한다', async () => {
    const mockTags = [
      createMockFilterTag({ name: 'active-students', display_label: '활성 학생' }),
      createMockFilterTag({ id: 'tag-2', name: 'inactive-students', display_label: '비활성 학생' }),
    ];

    mockApiClient.get.mockResolvedValue({
      data: mockTags,
      error: null,
    });

    const result = await fetchFilterTags(TENANT_ID, { search: '활성' });

    expect(result).toHaveLength(2);
  });

  it('search 필터로 이름 기반 필터링을 수행한다', async () => {
    const mockTags = [
      createMockFilterTag({ name: 'active-students', display_label: '활성 학생' }),
      createMockFilterTag({ id: 'tag-2', name: 'vip-students', display_label: 'VIP 학생' }),
    ];

    mockApiClient.get.mockResolvedValue({
      data: mockTags,
      error: null,
    });

    const result = await fetchFilterTags(TENANT_ID, { search: 'vip' });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('vip-students');
  });

  it('테이블 미존재 에러 시 빈 배열을 반환한다 (graceful)', async () => {
    mockApiClient.get.mockResolvedValue({
      data: null,
      error: { message: 'relation "message_filter_tags" does not exist' },
    });

    const result = await fetchFilterTags(TENANT_ID);

    expect(result).toEqual([]);
  });

  it('일반 에러 시 빈 배열을 반환한다 (catch fallback)', async () => {
    mockApiClient.get.mockRejectedValue(new Error('Network error'));

    const result = await fetchFilterTags(TENANT_ID);

    expect(result).toEqual([]);
  });
});

// ============================================================================
// Tests: useFilterTags (React Query Hook)
// ============================================================================

describe('useFilterTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('성공 시 태그 데이터를 반환한다', async () => {
    const mockTags = [createMockFilterTag()];

    mockApiClient.get.mockResolvedValue({
      data: mockTags,
      error: null,
    });

    const { result } = renderHook(() => useFilterTags(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTags);
  });

  it('빈 결과 시 빈 배열을 반환한다', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useFilterTags(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('tenantId가 있을 때 enabled=true', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useFilterTags(), {
      wrapper: createWrapper(),
    });

    // Hook이 fetch를 시도 (enabled=true because tenantId exists in mock)
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.get).toHaveBeenCalled();
  });

  it('tenantId가 없으면 쿼리가 비활성화된다', async () => {
    vi.mocked(apiSdk.getApiContext).mockReturnValueOnce({
      tenantId: '',
      industryType: 'academy',
    } as ReturnType<typeof apiSdk.getApiContext>);

    const { result } = renderHook(() => useFilterTags(), {
      wrapper: createWrapper(),
    });

    // enabled=false이므로 fetchStatus는 idle
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiClient.get).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Tests: useCreateFilterTag (Mutation)
// ============================================================================

describe('useCreateFilterTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('성공 시 태그를 생성하고 반환한다', async () => {
    const createdTag = createMockFilterTag({ id: 'new-tag' });

    mockApiClient.post.mockResolvedValue({
      data: createdTag,
      error: null,
    });

    const { result } = renderHook(() => useCreateFilterTag(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: 'new-tag',
      display_label: '신규 태그',
      category: 'status' as FilterTag['category'],
      condition_type: 'eq',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(createdTag);
    expect(mockApiClient.post).toHaveBeenCalledWith('message_filter_tags', {
      tenant_id: TENANT_ID,
      name: 'new-tag',
      display_label: '신규 태그',
      category: 'status',
      condition_type: 'eq',
      condition_params: {},
      color: '#E5E7EB',
      sort_order: 0,
    });
  });

  it('API 에러 시 mutation이 실패한다', async () => {
    mockApiClient.post.mockResolvedValue({
      data: null,
      error: { message: 'Duplicate name' },
    });

    const { result } = renderHook(() => useCreateFilterTag(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: 'duplicate',
      display_label: '중복 태그',
      category: 'status' as FilterTag['category'],
      condition_type: 'eq',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Duplicate name');
  });
});

// ============================================================================
// Tests: useDeleteFilterTag (Soft Delete Mutation)
// ============================================================================

describe('useDeleteFilterTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('성공 시 is_active=false로 soft delete한다', async () => {
    const deletedTag = createMockFilterTag({ is_active: false });

    mockApiClient.patch.mockResolvedValue({
      data: deletedTag,
      error: null,
    });

    const { result } = renderHook(() => useDeleteFilterTag(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('tag-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(deletedTag);
    expect(mockApiClient.patch).toHaveBeenCalledWith('message_filter_tags', 'tag-1', {
      is_active: false,
    });
  });

  it('API 에러 시 mutation이 실패한다', async () => {
    mockApiClient.patch.mockResolvedValue({
      data: null,
      error: { message: 'Tag not found' },
    });

    const { result } = renderHook(() => useDeleteFilterTag(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('nonexistent-tag');

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Tag not found');
  });
});

// ============================================================================
// Tests: fetchFilteredStudents (standalone function)
// ============================================================================

describe('fetchFilteredStudents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('성공 시 필터링된 학생 배열을 반환한다', async () => {
    const mockStudents: FilteredStudent[] = [
      { student_id: 's1', student_name: '학생1', phone: '010-1234-5678', metadata: {} },
      { student_id: 's2', student_name: '학생2', phone: '010-8765-4321', metadata: {} },
    ];

    mockApiClient.callRPC.mockResolvedValue({
      data: mockStudents,
      error: null,
    });

    const result = await fetchFilteredStudents(TENANT_ID, 'tag-1');

    expect(result).toEqual(mockStudents);
    expect(mockApiClient.callRPC).toHaveBeenCalledWith('apply_filter_tag', {
      p_tenant_id: TENANT_ID,
      p_tag_id: 'tag-1',
    });
  });

  it('tenantId가 비어있으면 빈 배열을 반환한다', async () => {
    const result = await fetchFilteredStudents('', 'tag-1');

    expect(result).toEqual([]);
    expect(mockApiClient.callRPC).not.toHaveBeenCalled();
  });

  it('tagId가 비어있으면 빈 배열을 반환한다', async () => {
    const result = await fetchFilteredStudents(TENANT_ID, '');

    expect(result).toEqual([]);
    expect(mockApiClient.callRPC).not.toHaveBeenCalled();
  });

  it('RPC 함수 미존재 에러 시 빈 배열을 반환한다 (graceful)', async () => {
    mockApiClient.callRPC.mockResolvedValue({
      data: null,
      error: { message: 'function "apply_filter_tag" does not exist' },
    });

    const result = await fetchFilteredStudents(TENANT_ID, 'tag-1');

    expect(result).toEqual([]);
  });

  it('네트워크 에러 시 빈 배열을 반환한다 (catch fallback)', async () => {
    mockApiClient.callRPC.mockRejectedValue(new Error('Network error'));

    const result = await fetchFilteredStudents(TENANT_ID, 'tag-1');

    expect(result).toEqual([]);
  });

  it('빈 데이터 응답 시 빈 배열을 반환한다', async () => {
    mockApiClient.callRPC.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await fetchFilteredStudents(TENANT_ID, 'tag-1');

    expect(result).toEqual([]);
  });
});
