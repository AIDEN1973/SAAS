/**
 * Shared Test Helpers
 *
 * Supabase 체이닝 mock + 공통 상수 + apiClient mock factory
 * [SSOT] industry-academy/__tests__/test-helpers.ts 기반 확장
 */

import { vi } from 'vitest';

export const TENANT_ID = 'test-tenant-id';
export const MOCK_USER_ID = 'test-user-id';
export const MOCK_INDUSTRY_TYPE = 'academy';

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
 * API SDK apiClient mock factory
 * vi.mock('@api-sdk/core')에서 사용
 */
export function createMockApiClient() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    callRPC: vi.fn(),
  };
}

/**
 * API SDK getApiContext mock factory
 */
export function createMockApiContext(overrides?: { tenantId?: string; industryType?: string }) {
  return vi.fn(() => ({
    tenantId: overrides?.tenantId ?? TENANT_ID,
    industryType: overrides?.industryType ?? MOCK_INDUSTRY_TYPE,
  }));
}

/**
 * Supabase 클라이언트 mock factory
 * vi.mock('@lib/supabase-client')에서 사용
 */
export function createMockSupabaseClient() {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return { mockFrom, mockRpc };
}
