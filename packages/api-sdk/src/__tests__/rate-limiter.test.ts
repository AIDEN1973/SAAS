/**
 * Rate Limiter Unit Tests
 *
 * [테스트 커버리지] Token Bucket 알고리즘 기반 Rate Limiting 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter, RateLimitExceededError, createRateLimiter } from '../rate-limiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = createRateLimiter({
      requestsPerSecond: 10,
      burstLimit: 15,
      maxRetries: 3,
      baseDelayMs: 10,
      maxDelayMs: 100,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('기본 동작', () => {
    it('버스트 한도 내에서 즉시 요청을 처리한다', async () => {
      const tenantId = 'tenant-123';
      const results: number[] = [];

      // 버스트 한도(15) 내에서 즉시 처리
      for (let i = 0; i < 10; i++) {
        const result = await rateLimiter.executeWithRateLimit(tenantId, async () => i);
        results.push(result);
      }

      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('테넌트별로 독립적인 버킷을 사용한다', async () => {
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';

      // 테넌트1로 10개 요청
      for (let i = 0; i < 10; i++) {
        await rateLimiter.executeWithRateLimit(tenant1, async () => i);
      }

      // 테넌트2는 여전히 full 버킷
      const status1 = rateLimiter.getStatus(tenant1);
      const status2 = rateLimiter.getStatus(tenant2);

      expect(status1.availableTokens).toBe(5); // 15 - 10
      expect(status2.availableTokens).toBe(15); // full
    });
  });

  describe('토큰 리필', () => {
    it('시간이 지나면 토큰이 리필된다', async () => {
      const tenantId = 'tenant-refill';

      // 토큰 소비
      for (let i = 0; i < 15; i++) {
        await rateLimiter.executeWithRateLimit(tenantId, async () => i);
      }

      const statusBefore = rateLimiter.getStatus(tenantId);
      expect(statusBefore.availableTokens).toBe(0);

      // 1초 후 (10 req/s 설정이므로 10개 토큰 리필)
      vi.advanceTimersByTime(1000);

      const statusAfter = rateLimiter.getStatus(tenantId);
      expect(statusAfter.availableTokens).toBe(10);
    });

    it('버스트 한도를 초과하여 리필되지 않는다', async () => {
      const tenantId = 'tenant-burst';

      // 10초 대기 (100개 토큰 리필 가능하지만 버스트 한도 15로 제한)
      vi.advanceTimersByTime(10000);

      const status = rateLimiter.getStatus(tenantId);
      expect(status.availableTokens).toBe(15); // 버스트 한도
    });
  });

  describe('Rate Limit 에러 처리', () => {
    it('429 에러 시 자동으로 재시도한다', async () => {
      const tenantId = 'tenant-retry';
      let attempts = 0;

      const mockFn = vi.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('429 Too Many Requests');
        }
        return 'success';
      });

      const resultPromise = rateLimiter.executeWithRateLimit(tenantId, mockFn);

      // 재시도 대기시간 진행
      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(20);

      const result = await resultPromise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('재시도 횟수 초과 시 에러를 throw한다', async () => {
      vi.useRealTimers(); // 이 테스트는 실제 타이머 사용

      const customLimiter = createRateLimiter({
        requestsPerSecond: 10,
        burstLimit: 15,
        maxRetries: 2,
        baseDelayMs: 1, // 빠른 테스트를 위해 짧게
        maxDelayMs: 10,
      });

      const tenantId = 'tenant-exceed';

      const mockFn = vi.fn(async () => {
        throw new Error('429 rate limit');
      });

      await expect(
        customLimiter.executeWithRateLimit(tenantId, mockFn)
      ).rejects.toThrow('429 rate limit');

      expect(mockFn).toHaveBeenCalled();
    });

    it('Rate Limit 외의 에러는 즉시 throw한다', async () => {
      const tenantId = 'tenant-other-error';

      const mockFn = vi.fn(async () => {
        throw new Error('Database connection failed');
      });

      await expect(
        rateLimiter.executeWithRateLimit(tenantId, mockFn)
      ).rejects.toThrow('Database connection failed');

      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('RateLimitExceededError', () => {
    it('에러에 테넌트 ID와 대기 시간이 포함된다', () => {
      const error = new RateLimitExceededError('Rate limit exceeded', 'tenant-xyz', 5000);

      expect(error.name).toBe('RateLimitExceededError');
      expect(error.tenantId).toBe('tenant-xyz');
      expect(error.waitTimeMs).toBe(5000);
      expect(error.message).toBe('Rate limit exceeded');
    });
  });

  describe('상태 조회', () => {
    it('테넌트별 상태를 조회할 수 있다', async () => {
      const tenantId = 'tenant-status';

      // 5개 요청 처리
      for (let i = 0; i < 5; i++) {
        await rateLimiter.executeWithRateLimit(tenantId, async () => i);
      }

      const status = rateLimiter.getStatus(tenantId);

      expect(status.availableTokens).toBe(10); // 15 - 5
      expect(status.pendingRequests).toBe(0);
    });

    it('전체 통계를 조회할 수 있다', async () => {
      // 여러 테넌트에서 요청
      await rateLimiter.executeWithRateLimit('tenant-a', async () => 1);
      await rateLimiter.executeWithRateLimit('tenant-b', async () => 2);
      await rateLimiter.executeWithRateLimit('tenant-c', async () => 3);

      const stats = rateLimiter.getGlobalStats();

      expect(stats.activeTenants).toBe(3);
      expect(stats.totalPendingRequests).toBe(0);
    });
  });

  describe('버킷 초기화', () => {
    it('특정 테넌트 버킷을 초기화할 수 있다', async () => {
      const tenantId = 'tenant-reset';

      // 토큰 소비
      for (let i = 0; i < 10; i++) {
        await rateLimiter.executeWithRateLimit(tenantId, async () => i);
      }

      expect(rateLimiter.getStatus(tenantId).availableTokens).toBe(5);

      // 초기화
      rateLimiter.resetBucket(tenantId);

      // 새 버킷 생성 (full 상태)
      expect(rateLimiter.getStatus(tenantId).availableTokens).toBe(15);
    });

    it('모든 버킷을 초기화할 수 있다', async () => {
      await rateLimiter.executeWithRateLimit('tenant-1', async () => 1);
      await rateLimiter.executeWithRateLimit('tenant-2', async () => 2);

      expect(rateLimiter.getGlobalStats().activeTenants).toBe(2);

      rateLimiter.resetAll();

      expect(rateLimiter.getGlobalStats().activeTenants).toBe(0);
    });
  });

  describe('createRateLimiter 팩토리 함수', () => {
    it('커스텀 설정으로 RateLimiter를 생성한다', () => {
      const customLimiter = createRateLimiter({
        requestsPerSecond: 50,
        burstLimit: 100,
      });

      const status = customLimiter.getStatus('test-tenant');
      expect(status.availableTokens).toBe(100);
    });

    it('기본 설정을 사용할 수 있다', () => {
      const defaultLimiter = createRateLimiter();
      const status = defaultLimiter.getStatus('test-tenant');
      expect(status.availableTokens).toBe(150); // 기본 버스트 한도
    });
  });
});
