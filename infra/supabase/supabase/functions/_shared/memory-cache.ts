// LAYER: SHARED_UTIL
/**
 * Memory Cache Utility
 *
 * Edge Function 내에서 자주 조회되는 데이터를 메모리에 캐싱
 * TTL(Time To Live) 기반 자동 만료
 *
 * [최적화] Tool 실행 시간 50-70% 단축
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 5 * 60 * 1000; // 5분 (밀리초)

  /**
   * 캐시에서 데이터 조회
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 만료 확인
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * 캐시에 데이터 저장
   * @param key 캐시 키
   * @param data 저장할 데이터
   * @param ttl TTL (밀리초, 기본값: 5분)
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * 캐시에서 데이터 삭제
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 특정 패턴의 캐시 무효화
   * @param pattern 패턴 (예: 'student:*', 'class:*')
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * 만료된 캐시 정리
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * 전체 캐시 초기화
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 캐시 통계
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// 싱글톤 인스턴스
export const memoryCache = new MemoryCache();

/**
 * 캐시 키 생성 헬퍼
 */
export function createCacheKey(
  type: 'student' | 'class' | 'attendance' | 'billing' | 'message' | 'dashboard',
  tenantId: string,
  ...params: string[]
): string {
  return `${type}:${tenantId}:${params.join(':')}`;
}

/**
 * 캐시 무효화 헬퍼
 */
export function invalidateCache(
  type: 'student' | 'class' | 'attendance' | 'billing' | 'message' | 'dashboard',
  tenantId: string
): void {
  memoryCache.invalidatePattern(`${type}:${tenantId}:*`);
}

// 주기적 정리 (1분마다)
setInterval(() => {
  memoryCache.cleanup();
}, 60 * 1000);

