/**
 * useAiMessage Hook Unit Tests
 *
 * 테스트 범위:
 * - useGenerateMessage: AI 메시지 생성 Mutation Hook
 * - generateFilterMessage: Edge Function API 호출 (성공, 에러, JSON 파싱 실패)
 * - FilterTag, MessageContext, GenerateMessageRequest 인터페이스 검증
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@env-registry/client', () => ({
  envClient: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  },
}));

// Global fetch mock
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ============================================================================
// Imports (after mocks due to hoisting)
// ============================================================================

import {
  useGenerateMessage,
  type GenerateMessageRequest,
  type MessageSuggestion,
} from '../index';

// ============================================================================
// Test Helpers
// ============================================================================

const ACCESS_TOKEN = 'test-access-token';

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

function createMockRequest(overrides?: Partial<GenerateMessageRequest>): GenerateMessageRequest {
  return {
    tenantId: 'test-tenant-id',
    filterTags: [
      { id: 'tag-1', name: '중등 1학년', type: 'grade' },
    ],
    targetCount: 25,
    messageContext: { purpose: '공지사항', tone: 'friendly' },
    ...overrides,
  };
}

function createMockSuggestion(overrides?: Partial<MessageSuggestion>): MessageSuggestion {
  return {
    title: '중등 1학년 학부모님 안내',
    content: '안녕하세요, 중등 1학년 학부모님께 안내드립니다.',
    reasoning: '대상 학년에 맞는 친근한 톤으로 작성했습니다.',
    ...overrides,
  };
}

function createFetchResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

// ============================================================================
// Tests: useGenerateMessage
// ============================================================================

describe('useGenerateMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('성공 시 AI 메시지 제안을 반환한다', async () => {
    const mockSuggestion = createMockSuggestion();
    mockFetch.mockResolvedValue(createFetchResponse(mockSuggestion));

    const { result } = renderHook(() => useGenerateMessage(ACCESS_TOKEN), {
      wrapper: createWrapper(),
    });

    const request = createMockRequest();
    result.current.mutate(request);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockSuggestion);
  });

  it('올바른 Edge Function URL로 fetch를 호출한다', async () => {
    const mockSuggestion = createMockSuggestion();
    mockFetch.mockResolvedValue(createFetchResponse(mockSuggestion));

    const { result } = renderHook(() => useGenerateMessage(ACCESS_TOKEN), {
      wrapper: createWrapper(),
    });

    result.current.mutate(createMockRequest());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      'https://test-project.supabase.co/functions/v1/generate-filter-message',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
      }),
    );
  });

  it('요청 body에 올바른 데이터를 전달한다', async () => {
    const mockSuggestion = createMockSuggestion();
    mockFetch.mockResolvedValue(createFetchResponse(mockSuggestion));

    const { result } = renderHook(() => useGenerateMessage(ACCESS_TOKEN), {
      wrapper: createWrapper(),
    });

    const request = createMockRequest();
    result.current.mutate(request);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body).toEqual(request);
  });

  it('API 에러 응답 시 에러 메시지를 반환한다', async () => {
    mockFetch.mockResolvedValue(
      createFetchResponse({ error: 'AI quota exceeded' }, 429),
    );

    const { result } = renderHook(() => useGenerateMessage(ACCESS_TOKEN), {
      wrapper: createWrapper(),
    });

    result.current.mutate(createMockRequest());

    // retry: 1이므로 재시도 후 에러 확정까지 대기 시간이 필요
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });

    expect(result.current.error?.message).toBe('AI quota exceeded');
  });

  it('API 에러 응답의 JSON 파싱 실패 시 기본 에러 메시지를 반환한다', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
    });

    const { result } = renderHook(() => useGenerateMessage(ACCESS_TOKEN), {
      wrapper: createWrapper(),
    });

    result.current.mutate(createMockRequest());

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });

    expect(result.current.error?.message).toBe('AI 메시지 생성에 실패했습니다.');
  });

  it('네트워크 에러 시 에러를 반환한다', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));

    const { result } = renderHook(() => useGenerateMessage(ACCESS_TOKEN), {
      wrapper: createWrapper(),
    });

    result.current.mutate(createMockRequest());

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });

    expect(result.current.error?.message).toBe('Network failure');
  });

  it('messageContext 없이도 요청할 수 있다', async () => {
    const mockSuggestion = createMockSuggestion();
    mockFetch.mockResolvedValue(createFetchResponse(mockSuggestion));

    const { result } = renderHook(() => useGenerateMessage(ACCESS_TOKEN), {
      wrapper: createWrapper(),
    });

    const request = createMockRequest({ messageContext: undefined });
    result.current.mutate(request);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockSuggestion);
  });

  it('여러 filterTags로 요청할 수 있다', async () => {
    const mockSuggestion = createMockSuggestion();
    mockFetch.mockResolvedValue(createFetchResponse(mockSuggestion));

    const { result } = renderHook(() => useGenerateMessage(ACCESS_TOKEN), {
      wrapper: createWrapper(),
    });

    const request = createMockRequest({
      filterTags: [
        { id: 'tag-1', name: '중등 1학년', type: 'grade' },
        { id: 'tag-2', name: '수학반', type: 'course' },
        { id: 'tag-3', name: 'VIP', type: 'custom' },
      ],
      targetCount: 10,
    });
    result.current.mutate(request);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.filterTags).toHaveLength(3);
  });

  it('urgent tone으로 요청할 수 있다', async () => {
    const mockSuggestion = createMockSuggestion({ title: '긴급 공지' });
    mockFetch.mockResolvedValue(createFetchResponse(mockSuggestion));

    const { result } = renderHook(() => useGenerateMessage(ACCESS_TOKEN), {
      wrapper: createWrapper(),
    });

    const request = createMockRequest({
      messageContext: { purpose: '긴급 안내', tone: 'urgent' },
    });
    result.current.mutate(request);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.title).toBe('긴급 공지');
  });

  it('isPending 상태가 올바르게 변경된다', async () => {
    let resolveFetch: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    mockFetch.mockReturnValue(fetchPromise);

    const { result } = renderHook(() => useGenerateMessage(ACCESS_TOKEN), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(false);

    result.current.mutate(createMockRequest());

    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolveFetch!(createFetchResponse(createMockSuggestion()));

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isSuccess).toBe(true);
  });

  it('에러 응답에 error 필드가 없으면 기본 에러 메시지를 사용한다', async () => {
    mockFetch.mockResolvedValue(
      createFetchResponse({}, 400),
    );

    const { result } = renderHook(() => useGenerateMessage(ACCESS_TOKEN), {
      wrapper: createWrapper(),
    });

    result.current.mutate(createMockRequest());

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });

    expect(result.current.error?.message).toBe('AI 메시지 생성에 실패했습니다.');
  });
});
