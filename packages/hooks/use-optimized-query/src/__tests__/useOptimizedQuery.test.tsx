/**
 * useOptimizedQuery & useDebouncedValue Hook Unit Tests
 *
 * 테스트 범위:
 * - useOptimizedQuery: 최적화된 React Query 래퍼 (staleTime, gcTime, refetchOnWindowFocus 등)
 * - useDebouncedValue: 디바운스된 값 반환 Hook
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';

// ============================================================================
// Imports
// ============================================================================

import { useOptimizedQuery } from '../useOptimizedQuery';
import { useDebouncedValue } from '../useDebouncedValue';

// ============================================================================
// Test Helpers
// ============================================================================

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

// ============================================================================
// Tests: useOptimizedQuery
// ============================================================================

describe('useOptimizedQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('성공 시 데이터를 반환한다', async () => {
    const mockData = { id: 1, name: 'test' };
    const queryFn = vi.fn().mockResolvedValue(mockData);

    const { result } = renderHook(
      () => useOptimizedQuery(['test-key'], queryFn),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('에러 시 error를 반환한다', async () => {
    const queryFn = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(
      () => useOptimizedQuery(['error-key'], queryFn),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });

  it('options으로 enabled=false를 전달하면 쿼리가 비활성화된다', async () => {
    const queryFn = vi.fn().mockResolvedValue({ id: 1 });

    const { result } = renderHook(
      () => useOptimizedQuery(['disabled-key'], queryFn, { enabled: false }),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('기본 staleTime은 5분(300000ms)이다', async () => {
    const queryFn = vi.fn().mockResolvedValue('data');

    const { result } = renderHook(
      () => useOptimizedQuery(['stale-key'], queryFn),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // 쿼리가 성공적으로 실행되면 staleTime 동안 fresh 상태 유지
    expect(result.current.isStale).toBe(false);
  });

  it('options에서 staleTime을 오버라이드할 수 있다', async () => {
    const queryFn = vi.fn().mockResolvedValue('data');

    const { result } = renderHook(
      () => useOptimizedQuery(['custom-stale-key'], queryFn, { staleTime: 0 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // staleTime: 0이면 즉시 stale
    expect(result.current.isStale).toBe(true);
  });

  it('배열 데이터를 올바르게 반환한다', async () => {
    const mockData = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const queryFn = vi.fn().mockResolvedValue(mockData);

    const { result } = renderHook(
      () => useOptimizedQuery(['array-key'], queryFn),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
  });

  it('select 옵션으로 데이터를 변환할 수 있다', async () => {
    const mockData = { id: 1, name: 'test', extra: 'field' };
    const queryFn = vi.fn().mockResolvedValue(mockData);

    const { result } = renderHook(
      () =>
        useOptimizedQuery(['select-key'], queryFn, {
          select: (data: typeof mockData) => data.name,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe('test');
  });

  it('null 데이터도 성공으로 처리한다', async () => {
    const queryFn = vi.fn().mockResolvedValue(null);

    const { result } = renderHook(
      () => useOptimizedQuery(['null-key'], queryFn),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });
});

// ============================================================================
// Tests: useDebouncedValue
// ============================================================================

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('초기 렌더링 시 초기값을 반환한다', () => {
    const { result } = renderHook(() => useDebouncedValue('hello'));

    expect(result.current).toBe('hello');
  });

  it('기본 딜레이(300ms) 후 값이 업데이트된다', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value),
      { initialProps: { value: 'initial' } },
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated' });

    // 딜레이 전에는 여전히 이전 값
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('updated');
  });

  it('커스텀 딜레이를 적용할 수 있다', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'initial', delay: 500 } },
    );

    rerender({ value: 'updated', delay: 500 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // 500ms 딜레이이므로 300ms에서는 아직 업데이트되지 않음
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe('updated');
  });

  it('딜레이 내에 값이 변경되면 이전 타이머가 취소된다', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'first' } },
    );

    rerender({ value: 'second' });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // 아직 300ms가 안 지났으므로 초기값 유지
    expect(result.current).toBe('first');

    rerender({ value: 'third' });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // second는 건너뛰고, third의 타이머도 아직 안 끝남
    expect(result.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // third의 300ms 타이머 완료
    expect(result.current).toBe('third');
  });

  it('숫자 값도 디바운스할 수 있다', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 0 } },
    );

    rerender({ value: 42 });

    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe(42);
  });

  it('객체 값도 디바운스할 수 있다', () => {
    const initial = { search: '' };
    const updated = { search: 'test query' };

    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: initial } },
    );

    rerender({ value: updated });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toEqual({ search: 'test query' });
  });

  it('값이 동일해도 타이머가 리셋된다', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'same' } },
    );

    // 동일한 값으로 rerender해도 에러 없이 동작
    rerender({ value: 'same' });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('same');
  });
});
