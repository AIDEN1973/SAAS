/**
 * useAISuggestion Hook Unit Tests
 *
 * 테스트 범위:
 * - useAISuggestion: AI 제안 조회 (성공, 에러, 비활성화)
 * - approveSuggestion: 승인 Mutation
 * - rejectSuggestion: 거부 Mutation (피드백 포함/미포함)
 * - dismissSuggestion: 무시 Mutation
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

// ============================================================================
// Imports (after mocks due to hoisting)
// ============================================================================

import { useAISuggestion, type AISuggestion } from '../useAISuggestion';

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

function createMockSuggestion(overrides?: Partial<AISuggestion>): AISuggestion {
  return {
    id: 'suggestion-1',
    tenant_id: TENANT_ID,
    suggestion_type: 'message_draft',
    title: '안부 문자 초안 준비됨',
    summary: '3명의 학생에게 안부 문자를 보내는 것을 추천합니다.',
    suggested_action: {
      type: 'send_message',
      payload: { message: 'Hello' },
    },
    context_data: {
      student_ids: ['student-1', 'student-2', 'student-3'],
      reason: '최근 출석률 저조',
    },
    priority: 5,
    status: 'pending',
    created_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// Tests: useAISuggestion - Query
// ============================================================================

describe('useAISuggestion - Query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('성공 시 pending 상태의 제안 목록을 반환한다', async () => {
    const mockSuggestions = [
      createMockSuggestion(),
      createMockSuggestion({ id: 'suggestion-2', title: '출석률 분석' }),
    ];

    mockApiClient.get.mockResolvedValue({
      data: mockSuggestions,
      error: null,
    });

    const { result } = renderHook(() => useAISuggestion(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.suggestions).toHaveLength(2);
    expect(result.current.suggestions[0].title).toBe('안부 문자 초안 준비됨');
  });

  it('올바른 파라미터로 API를 호출한다', async () => {
    mockApiClient.get.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useAISuggestion(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApiClient.get).toHaveBeenCalledWith('ai_suggestions', {
      filters: { status: 'pending' },
      orderBy: { column: 'priority', ascending: false },
      limit: 10,
    });
  });

  it('API 에러 시 빈 배열을 기본값으로 제공한다', async () => {
    mockApiClient.get.mockResolvedValue({
      data: null,
      error: { message: 'Table not found' },
    });

    const { result } = renderHook(() => useAISuggestion(), {
      wrapper: createWrapper(),
    });

    // 에러가 throw되지만, suggestions 기본값은 []
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // suggestions defaults to [] due to `suggestions || []`
    expect(result.current.suggestions).toEqual([]);
  });

  it('tenantId가 없으면 쿼리가 비활성화된다', async () => {
    vi.mocked(apiSdk.getApiContext).mockReturnValueOnce({
      tenantId: '',
      industryType: 'academy',
    } as ReturnType<typeof apiSdk.getApiContext>);

    const { result } = renderHook(() => useAISuggestion(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.suggestions).toEqual([]);
    expect(mockApiClient.get).not.toHaveBeenCalled();
  });

  it('data가 null이면 빈 배열을 반환한다', async () => {
    mockApiClient.get.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useAISuggestion(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.suggestions).toEqual([]);
  });
});

// ============================================================================
// Tests: useAISuggestion - approveSuggestion
// ============================================================================

describe('useAISuggestion - approveSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 초기 쿼리 모킹
    mockApiClient.get.mockResolvedValue({ data: [], error: null });
  });

  it('성공 시 상태를 approved로 업데이트한다', async () => {
    mockApiClient.patch.mockResolvedValue({ data: { id: 'suggestion-1', status: 'approved' }, error: null });

    const { result } = renderHook(() => useAISuggestion(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.approveSuggestion('suggestion-1');

    expect(mockApiClient.patch).toHaveBeenCalledWith('ai_suggestions', 'suggestion-1', {
      status: 'approved',
    });
  });

  it('API 에러 시 에러를 throw한다', async () => {
    mockApiClient.patch.mockResolvedValue({
      data: null,
      error: { message: 'Suggestion not found' },
    });

    const { result } = renderHook(() => useAISuggestion(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.approveSuggestion('nonexistent')).rejects.toThrow('Suggestion not found');
  });
});

// ============================================================================
// Tests: useAISuggestion - rejectSuggestion
// ============================================================================

describe('useAISuggestion - rejectSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.get.mockResolvedValue({ data: [], error: null });
  });

  it('피드백 없이 거부할 수 있다', async () => {
    mockApiClient.patch.mockResolvedValue({ data: { id: 'suggestion-1', status: 'rejected' }, error: null });

    const { result } = renderHook(() => useAISuggestion(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.rejectSuggestion('suggestion-1');

    expect(mockApiClient.patch).toHaveBeenCalledWith('ai_suggestions', 'suggestion-1', {
      status: 'rejected',
      user_feedback: undefined,
    });
  });

  it('피드백과 함께 거부할 수 있다', async () => {
    mockApiClient.patch.mockResolvedValue({ data: { id: 'suggestion-1', status: 'rejected' }, error: null });

    const { result } = renderHook(() => useAISuggestion(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.rejectSuggestion('suggestion-1', '필요 없는 제안입니다');

    expect(mockApiClient.patch).toHaveBeenCalledWith('ai_suggestions', 'suggestion-1', {
      status: 'rejected',
      user_feedback: '필요 없는 제안입니다',
    });
  });

  it('API 에러 시 에러를 throw한다', async () => {
    mockApiClient.patch.mockResolvedValue({
      data: null,
      error: { message: 'Reject failed' },
    });

    const { result } = renderHook(() => useAISuggestion(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.rejectSuggestion('suggestion-1')).rejects.toThrow('Reject failed');
  });
});

// ============================================================================
// Tests: useAISuggestion - dismissSuggestion
// ============================================================================

describe('useAISuggestion - dismissSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.get.mockResolvedValue({ data: [], error: null });
  });

  it('무시 시 dismissed_at과 status=rejected로 업데이트한다', async () => {
    mockApiClient.patch.mockResolvedValue({ data: { id: 'suggestion-1', status: 'rejected' }, error: null });

    const { result } = renderHook(() => useAISuggestion(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.dismissSuggestion('suggestion-1');

    expect(mockApiClient.patch).toHaveBeenCalledWith('ai_suggestions', 'suggestion-1', {
      dismissed_at: expect.any(String),
      status: 'rejected',
    });
  });

  it('API 에러 시 에러를 throw한다', async () => {
    mockApiClient.patch.mockResolvedValue({
      data: null,
      error: { message: 'Dismiss failed' },
    });

    const { result } = renderHook(() => useAISuggestion(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.dismissSuggestion('suggestion-1')).rejects.toThrow('Dismiss failed');
  });
});
