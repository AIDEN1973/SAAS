/**
 * Optimistic Update Utilities for React Query
 *
 * 낙관적 업데이트 패턴 구현
 * [UX 개선] 네트워크 응답을 기다리지 않고 즉시 UI 업데이트
 */

import type { QueryClient } from '@tanstack/react-query';

export interface OptimisticContext<T> {
  previousData: T | undefined;
}

/**
 * 낙관적 업데이트 헬퍼
 *
 * @example
 * useMutation({
 *   mutationFn: updateStudent,
 *   onMutate: createOptimisticUpdate(
 *     queryClient,
 *     ['student', tenantId, studentId],
 *     (oldData, newData) => ({ ...oldData, ...newData })
 *   ),
 *   onError: createOptimisticRollback(queryClient),
 *   onSettled: () => queryClient.invalidateQueries({ queryKey: ['student'] }),
 * })
 */
export function createOptimisticUpdate<TData, TVariables>(
  queryClient: QueryClient,
  queryKey: unknown[],
  updater: (oldData: TData | undefined, variables: TVariables) => TData
) {
  return async (variables: TVariables): Promise<OptimisticContext<TData>> => {
    // 진행 중인 쿼리 취소
    await queryClient.cancelQueries({ queryKey });

    // 이전 데이터 스냅샷
    const previousData = queryClient.getQueryData<TData>(queryKey);

    // 낙관적 업데이트
    queryClient.setQueryData<TData>(queryKey, (old) => updater(old, variables));

    // 롤백용 컨텍스트 반환
    return { previousData };
  };
}

/**
 * 낙관적 업데이트 롤백 헬퍼
 */
export function createOptimisticRollback<TData>(queryClient: QueryClient) {
  return <TError, TVariables>(
    error: TError,
    variables: TVariables,
    context: OptimisticContext<TData> | undefined
  ) => {
    // 에러 발생 시 이전 데이터로 복구
    if (context?.previousData) {
      const queryKey = ['student']; // 실제로는 컨텍스트에서 가져와야 함
      queryClient.setQueryData(queryKey, context.previousData);
    }
  };
}

/**
 * 리스트 아이템 업데이트 헬퍼
 *
 * @example
 * createOptimisticUpdate(
 *   queryClient,
 *   ['students', tenantId],
 *   createListItemUpdater((student) => student.id === updatedStudent.id, updatedStudent)
 * )
 */
export function createListItemUpdater<T extends { id: string }>(
  predicate: (item: T) => boolean,
  newItem: Partial<T>
) {
  return (oldData: T[] | undefined): T[] => {
    if (!oldData) return [];
    return oldData.map((item) =>
      predicate(item) ? { ...item, ...newItem } : item
    );
  };
}

/**
 * 리스트 아이템 추가 헬퍼
 */
export function createListItemAdder<T>(newItem: T) {
  return (oldData: T[] | undefined): T[] => {
    if (!oldData) return [newItem];
    return [newItem, ...oldData];
  };
}

/**
 * 리스트 아이템 삭제 헬퍼
 */
export function createListItemRemover<T extends { id: string }>(itemId: string) {
  return (oldData: T[] | undefined): T[] => {
    if (!oldData) return [];
    return oldData.filter((item) => item.id !== itemId);
  };
}
