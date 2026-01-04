/**
 * 최적화된 Query Hook
 *
 * [LAYER: HOOK]
 * [성능 최적화] React Query 기본 옵션 최적화
 *
 * 캐싱 전략:
 * - staleTime: 5분 (데이터가 fresh 상태로 유지되는 시간)
 * - cacheTime: 10분 (메모리에 캐시 유지 시간)
 * - refetchOnWindowFocus: false (포커스 시 재조회 방지)
 * - keepPreviousData: true (페이지네이션 시 깜빡임 방지)
 */

import { useQuery, UseQueryOptions, QueryKey } from '@tanstack/react-query';

/**
 * 기본 캐시 시간 상수
 * [SSOT] 매직 넘버 제거
 */
const DEFAULT_CACHE_TIMES = {
  STALE_TIME: 5 * 60 * 1000,  // 5분
  CACHE_TIME: 10 * 60 * 1000, // 10분
} as const;

/**
 * 최적화된 Query Hook
 *
 * @param queryKey - React Query 키
 * @param queryFn - 데이터 조회 함수
 * @param options - 추가 옵션 (기본 옵션 오버라이드 가능)
 */
export function useOptimizedQuery<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  queryKey: TQueryKey,
  queryFn: () => Promise<TQueryFnData>,
  options?: Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TQueryFnData, TError, TData, TQueryKey>({
    queryKey,
    queryFn,
    staleTime: DEFAULT_CACHE_TIMES.STALE_TIME,
    gcTime: DEFAULT_CACHE_TIMES.CACHE_TIME,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    ...options,
  });
}
