// LAYER: SHARED_UTIL
/**
 * Cache Strategy - 고급 캐싱 전략
 *
 * 1만+ 테넌트 대응을 위한 다층 캐싱 전략
 * - L1: Edge Function 내 메모리 캐시 (5분 TTL)
 * - L2: Tenant-specific 캐시 무효화
 * - L3: 통계/분석 데이터 장기 캐시 (1시간)
 *
 * [성능 목표] 대시보드 응답 시간 50% 단축
 */

import { memoryCache, createCacheKey } from './memory-cache.ts';

/**
 * 캐시 TTL 상수 (밀리초)
 */
export const CACHE_TTL = {
  /** 빈번하게 변경되는 데이터 (출결, 알림) */
  SHORT: 1 * 60 * 1000, // 1분
  /** 일반 데이터 (학생, 수업 목록) */
  MEDIUM: 5 * 60 * 1000, // 5분
  /** 느리게 변경되는 데이터 (설정, 스키마) */
  LONG: 15 * 60 * 1000, // 15분
  /** 통계/분석 데이터 */
  ANALYTICS: 60 * 60 * 1000, // 1시간
  /** 메타데이터 (스키마 레지스트리) */
  METADATA: 24 * 60 * 60 * 1000, // 24시간
} as const;

/**
 * 캐시 태그 - 관련 데이터를 그룹화하여 일괄 무효화
 */
export type CacheTag =
  | 'student'
  | 'class'
  | 'teacher'
  | 'attendance'
  | 'billing'
  | 'settings'
  | 'analytics'
  | 'schema';

/**
 * 캐시된 함수 실행
 * @param key 캐시 키
 * @param fn 실행할 함수
 * @param ttl TTL (밀리초)
 * @returns 캐시된 결과 또는 새로 실행한 결과
 */
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = CACHE_TTL.MEDIUM
): Promise<T> {
  // 캐시 확인
  const cachedData = memoryCache.get<T>(key);
  if (cachedData !== null) {
    return cachedData;
  }

  // 캐시 미스: 함수 실행
  const result = await fn();

  // 결과 캐싱
  memoryCache.set(key, result, ttl);

  return result;
}

/**
 * 테넌트별 캐시 키 생성
 */
export function tenantCacheKey(
  tenantId: string,
  tag: CacheTag,
  ...params: string[]
): string {
  return `tenant:${tenantId}:${tag}:${params.join(':')}`;
}

/**
 * 테넌트 캐시 무효화
 * 특정 테넌트의 특정 태그 관련 모든 캐시 삭제
 */
export function invalidateTenantCache(
  tenantId: string,
  tags: CacheTag[]
): void {
  tags.forEach(tag => {
    memoryCache.invalidatePattern(`tenant:${tenantId}:${tag}:*`);
  });
}

/**
 * 전역 캐시 무효화 (특정 태그)
 * 모든 테넌트의 특정 태그 캐시 삭제
 */
export function invalidateGlobalCache(tag: CacheTag): void {
  memoryCache.invalidatePattern(`tenant:*:${tag}:*`);
}

/**
 * 대시보드 통계 캐시 키
 */
export function dashboardCacheKey(
  tenantId: string,
  dateKey: string
): string {
  return tenantCacheKey(tenantId, 'analytics', 'dashboard', dateKey);
}

/**
 * 출결 통계 캐시 키
 */
export function attendanceCacheKey(
  tenantId: string,
  date: string
): string {
  return tenantCacheKey(tenantId, 'attendance', 'stats', date);
}

/**
 * 스키마 레지스트리 캐시 키
 */
export function schemaCacheKey(
  entity: string,
  industryType: string,
  type: string
): string {
  return `schema:${entity}:${industryType}:${type}`;
}

/**
 * 캐시 상태 모니터링
 */
export function getCacheMetrics(): {
  totalEntries: number;
  entriesByTag: Record<string, number>;
} {
  const stats = memoryCache.getStats();
  const entriesByTag: Record<string, number> = {};

  stats.keys.forEach(key => {
    // tenant:xxx:tag:... 형식에서 tag 추출
    const parts = key.split(':');
    if (parts.length >= 3) {
      const tag = parts[2];
      entriesByTag[tag] = (entriesByTag[tag] || 0) + 1;
    }
  });

  return {
    totalEntries: stats.size,
    entriesByTag,
  };
}

/**
 * 데이터 변경 시 캐시 무효화 가이드
 *
 * 학생 추가/수정/삭제:
 *   invalidateTenantCache(tenantId, ['student', 'class', 'analytics'])
 *
 * 수업 추가/수정/삭제:
 *   invalidateTenantCache(tenantId, ['class', 'teacher', 'analytics'])
 *
 * 출결 기록:
 *   invalidateTenantCache(tenantId, ['attendance', 'analytics'])
 *
 * 설정 변경:
 *   invalidateTenantCache(tenantId, ['settings'])
 *
 * 스키마 변경 (플랫폼 관리자):
 *   invalidateGlobalCache('schema')
 */
