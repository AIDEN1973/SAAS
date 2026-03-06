/**
 * React Hook Test Render Helpers
 *
 * QueryClient + Provider 래핑 유틸리티
 * [SSOT] useStudent.test.tsx 기반 표준화
 */

import React from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';

/**
 * 테스트용 QueryClient 생성 (retry 비활성화)
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * QueryClientProvider wrapper 생성
 */
export function createWrapper(queryClient?: QueryClient) {
  const client = queryClient ?? createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

/**
 * renderHook with QueryClientProvider
 * 편의 함수: renderHook + wrapper 자동 적용
 */
export function renderHookWithProviders<TResult>(
  hook: () => TResult,
  queryClient?: QueryClient
) {
  const client = queryClient ?? createTestQueryClient();
  const wrapper = createWrapper(client);
  return {
    ...renderHook(hook, { wrapper }),
    queryClient: client,
  };
}
