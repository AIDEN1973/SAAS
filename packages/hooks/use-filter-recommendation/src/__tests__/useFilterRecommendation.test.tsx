/**
 * useRecommendFilterTags Hook Unit Tests
 *
 * Test scope:
 * - useRecommendFilterTags: mutation hook for AI-powered filter tag recommendations
 * - recommendFilterTags: internal fetch function calling Edge Function
 * - Error handling for failed API calls
 *
 * Note: The hook has retry: 1, so error tests need to account for the retry delay.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@env-registry/client', () => ({
  envClient: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  },
}));

// ============================================================================
// Import (after mocks)
// ============================================================================

import { useRecommendFilterTags } from '../index';
import type { FilterTagRecommendation } from '../index';

// ============================================================================
// Test Helpers
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      // Note: do NOT set mutations.retry here - the hook overrides with retry:1
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

const mockRecommendation: FilterTagRecommendation = {
  tag_ids: ['tag-1', 'tag-2'],
  reasoning: '중학생 필터와 수학 성적 태그를 추천합니다.',
  confidence: 'high',
  suggested_query: 'grade:middle AND subject:math AND performance:low',
};

// ============================================================================
// Tests
// ============================================================================

describe('useRecommendFilterTags', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls Edge Function with correct URL and headers on mutate', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRecommendation),
    });

    const { result } = renderHook(
      () => useRecommendFilterTags('test-access-token'),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.mutate({
        tenantId: 'tenant-123',
        naturalLanguageQuery: '중학생 중에서 수학 성적이 낮은 학생',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:54321/functions/v1/recommend-filter-tags',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-access-token',
        },
        body: JSON.stringify({
          tenantId: 'tenant-123',
          naturalLanguageQuery: '중학생 중에서 수학 성적이 낮은 학생',
        }),
      }),
    );
  });

  it('returns recommendation data on success', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRecommendation),
    });

    const { result } = renderHook(
      () => useRecommendFilterTags('test-access-token'),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.mutate({
        tenantId: 'tenant-123',
        naturalLanguageQuery: '테스트 쿼리',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockRecommendation);
    expect(result.current.data?.tag_ids).toEqual(['tag-1', 'tag-2']);
    expect(result.current.data?.confidence).toBe('high');
  });

  it('throws error when API response is not ok (after retry)', async () => {
    // The hook has retry: 1, so the function will be called twice before isError is true
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'AI 필터 추천에 실패했습니다.' }),
    });

    const { result } = renderHook(
      () => useRecommendFilterTags('test-access-token'),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.mutate({
        tenantId: 'tenant-123',
        naturalLanguageQuery: '실패 테스트',
      });
    });

    // Wait for error state (retry: 1 means initial + 1 retry = 2 calls)
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });

    expect(result.current.error?.message).toBe('AI 필터 추천에 실패했습니다.');
    // Confirm it was called twice (initial + 1 retry)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws default error message when error response has no error field', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(
      () => useRecommendFilterTags('test-access-token'),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.mutate({
        tenantId: 'tenant-123',
        naturalLanguageQuery: '기본 에러 메시지 테스트',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });

    expect(result.current.error?.message).toBe('AI 필터 추천에 실패했습니다.');
  });

  it('handles JSON parse failure gracefully in error response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error('Invalid JSON')),
    });

    const { result } = renderHook(
      () => useRecommendFilterTags('test-access-token'),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.mutate({
        tenantId: 'tenant-123',
        naturalLanguageQuery: 'JSON 파싱 실패',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });

    // Should use default error message since json() failed
    expect(result.current.error?.message).toBe('AI 필터 추천에 실패했습니다.');
  });

  it('retries once on failure then succeeds', async () => {
    // The hook has retry: 1. First call fails, second succeeds.
    let callCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount <= 1) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockRecommendation),
      });
    });

    const { result } = renderHook(
      () => useRecommendFilterTags('test-access-token'),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.mutate({
        tenantId: 'tenant-123',
        naturalLanguageQuery: '재시도 테스트',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    // Should have been called twice (initial + 1 retry)
    expect(callCount).toBe(2);
    expect(result.current.data).toEqual(mockRecommendation);
  });
});
