/**
 * Shared Test Helpers
 *
 * Supabase 체이닝 mock + 공통 상수
 * [SSOT] service.test.ts의 createChainMock을 추출하여 재사용
 */

import { vi } from 'vitest';

export const TENANT_ID = 'test-tenant-id';
export const MOCK_USER_ID = 'test-user-id';

/**
 * Supabase 체이닝 헬퍼 — 유연한 체인 빌더
 *
 * @param resolvedData - await 또는 .single() 시 반환될 데이터
 * @param resolvedError - 에러 시뮬레이션
 * @param resolvedCount - count 쿼리 시 반환될 숫자
 */
export function createChainMock(
  resolvedData: unknown = [],
  resolvedError: unknown = null,
  resolvedCount?: number
) {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'is', 'gte', 'lte', 'gt', 'lt',
    'order', 'limit', 'range', 'ilike', 'or', 'not',
    'contains', 'filter', 'textSearch', 'maybeSingle', 'csv',
    'match', 'like',
  ];

  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }

  chain.single = vi.fn(() => ({
    data: resolvedData,
    error: resolvedError,
    count: resolvedCount,
  }));

  // 최종 결과 반환 (await 시)
  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: unknown) => void) => {
      resolve({
        data: resolvedData,
        error: resolvedError,
        count: resolvedCount,
      });
    },
  });

  return chain;
}

/**
 * mockFrom/mockRpc 팩토리
 * 각 테스트 파일에서 vi.mock 호이스팅 제약으로 인라인해야 하지만,
 * 반환 타입 참조용으로 제공
 */
export function createMockSupabaseClient() {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return { mockFrom, mockRpc };
}
