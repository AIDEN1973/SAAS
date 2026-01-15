/**
 * Rate Limiter for API SDK
 *
 * [불변 규칙] 테넌트별 요청 제한을 적용하여 시스템 안정성을 보장합니다.
 * [불변 규칙] Token Bucket 알고리즘을 사용하여 순간 트래픽과 평균 트래픽을 모두 제어합니다.
 *
 * 기본 설정:
 * - 테넌트당 100 req/s
 * - 버스트 허용량: 150 req (순간 트래픽 대응)
 * - 요청 초과 시 자동 대기 후 재시도 (최대 3회)
 */

export interface RateLimiterConfig {
  /** 초당 허용 요청 수 (기본값: 100) */
  requestsPerSecond: number;
  /** 버스트 허용량 - 순간적으로 허용되는 최대 요청 수 (기본값: 150) */
  burstLimit: number;
  /** 최대 재시도 횟수 (기본값: 3) */
  maxRetries: number;
  /** 재시도 대기 시간 배수 (기본값: 1.5) */
  retryBackoffMultiplier: number;
  /** 기본 대기 시간 ms (기본값: 100) */
  baseDelayMs: number;
  /** 최대 대기 시간 ms (기본값: 5000) */
  maxDelayMs: number;
}

interface TenantBucket {
  tokens: number;
  lastRefill: number;
  pendingRequests: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  requestsPerSecond: 100,
  burstLimit: 150,
  maxRetries: 3,
  retryBackoffMultiplier: 1.5,
  baseDelayMs: 100,
  maxDelayMs: 5000,
};

/**
 * Rate Limiter 클래스
 *
 * Token Bucket 알고리즘 기반 테넌트별 요청 제한
 */
export class RateLimiter {
  private config: RateLimiterConfig;
  private buckets: Map<string, TenantBucket> = new Map();
  private globalRequestCount = 0;
  private globalLastReset = Date.now();

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 테넌트의 토큰 버킷 가져오기 (없으면 생성)
   */
  private getBucket(tenantId: string): TenantBucket {
    if (!this.buckets.has(tenantId)) {
      this.buckets.set(tenantId, {
        tokens: this.config.burstLimit,
        lastRefill: Date.now(),
        pendingRequests: 0,
      });
    }
    return this.buckets.get(tenantId)!;
  }

  /**
   * 토큰 버킷 리필
   */
  private refillBucket(bucket: TenantBucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000; // 초 단위
    const tokensToAdd = elapsed * this.config.requestsPerSecond;

    bucket.tokens = Math.min(this.config.burstLimit, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * 요청 허용 여부 확인 및 토큰 소비
   */
  private tryConsumeToken(tenantId: string): boolean {
    const bucket = this.getBucket(tenantId);
    this.refillBucket(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * 다음 토큰까지 대기 시간 계산 (ms)
   */
  private getWaitTimeMs(tenantId: string): number {
    const bucket = this.getBucket(tenantId);
    this.refillBucket(bucket);

    if (bucket.tokens >= 1) {
      return 0;
    }

    // 토큰 1개가 리필되는데 필요한 시간
    const tokensNeeded = 1 - bucket.tokens;
    const secondsNeeded = tokensNeeded / this.config.requestsPerSecond;
    return Math.ceil(secondsNeeded * 1000);
  }

  /**
   * 지연 함수
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Rate Limit이 적용된 요청 실행
   *
   * @param tenantId 테넌트 ID
   * @param requestFn 실행할 요청 함수
   * @returns 요청 결과
   * @throws RateLimitExceededError 재시도 횟수 초과 시
   */
  async executeWithRateLimit<T>(
    tenantId: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const bucket = this.getBucket(tenantId);
    bucket.pendingRequests++;

    try {
      let attempt = 0;
      let lastError: Error | null = null;

      while (attempt < this.config.maxRetries) {
        // 토큰 소비 시도
        if (this.tryConsumeToken(tenantId)) {
          try {
            const result = await requestFn();
            return result;
          } catch (error) {
            // 429 에러인 경우 Rate Limit 재시도
            if (this.isRateLimitError(error)) {
              lastError = error as Error;
              attempt++;
              const delayMs = this.calculateBackoff(attempt);

              if (process.env.NODE_ENV === 'development') {
                console.warn(
                  `[RateLimiter] Rate limit hit for tenant ${tenantId.substring(0, 8)}... ` +
                  `Attempt ${attempt}/${this.config.maxRetries}. Waiting ${delayMs}ms`
                );
              }

              await this.delay(delayMs);
              continue;
            }
            // 다른 에러는 그대로 throw
            throw error;
          }
        }

        // 토큰이 없으면 대기
        const waitTime = this.getWaitTimeMs(tenantId);
        if (waitTime > this.config.maxDelayMs) {
          throw new RateLimitExceededError(
            `Rate limit exceeded for tenant. Max wait time exceeded.`,
            tenantId,
            waitTime
          );
        }

        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[RateLimiter] Waiting ${waitTime}ms for token refill (tenant: ${tenantId.substring(0, 8)}...)`
          );
        }

        await this.delay(waitTime);
        attempt++;
      }

      throw lastError || new RateLimitExceededError(
        'Rate limit exceeded after maximum retries',
        tenantId,
        0
      );
    } finally {
      bucket.pendingRequests--;
    }
  }

  /**
   * 429 에러 여부 확인
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes('429') ||
        error.message.includes('rate limit') ||
        error.message.includes('too many requests') ||
        error.message.toLowerCase().includes('throttl')
      );
    }
    return false;
  }

  /**
   * 지수 백오프 계산
   */
  private calculateBackoff(attempt: number): number {
    const delay = this.config.baseDelayMs * Math.pow(this.config.retryBackoffMultiplier, attempt - 1);
    // 지터 추가 (0-20% 랜덤)
    const jitter = delay * Math.random() * 0.2;
    return Math.min(delay + jitter, this.config.maxDelayMs);
  }

  /**
   * 테넌트별 현재 상태 조회
   */
  getStatus(tenantId: string): {
    availableTokens: number;
    pendingRequests: number;
    nextRefillMs: number;
  } {
    const bucket = this.getBucket(tenantId);
    this.refillBucket(bucket);

    return {
      availableTokens: Math.floor(bucket.tokens),
      pendingRequests: bucket.pendingRequests,
      nextRefillMs: this.getWaitTimeMs(tenantId),
    };
  }

  /**
   * 전체 통계 조회
   */
  getGlobalStats(): {
    activeTenants: number;
    totalPendingRequests: number;
  } {
    let totalPending = 0;
    this.buckets.forEach((bucket) => {
      totalPending += bucket.pendingRequests;
    });

    return {
      activeTenants: this.buckets.size,
      totalPendingRequests: totalPending,
    };
  }

  /**
   * 특정 테넌트의 버킷 초기화 (테스트용)
   */
  resetBucket(tenantId: string): void {
    this.buckets.delete(tenantId);
  }

  /**
   * 모든 버킷 초기화 (테스트용)
   */
  resetAll(): void {
    this.buckets.clear();
  }
}

/**
 * Rate Limit 초과 에러
 */
export class RateLimitExceededError extends Error {
  constructor(
    message: string,
    public readonly tenantId: string,
    public readonly waitTimeMs: number
  ) {
    super(message);
    this.name = 'RateLimitExceededError';
  }
}

/**
 * 기본 Rate Limiter 인스턴스
 *
 * 테넌트당 100 req/s, 버스트 150
 */
export const rateLimiter = new RateLimiter();

/**
 * Rate Limiter 인스턴스 생성 함수
 */
export function createRateLimiter(config?: Partial<RateLimiterConfig>): RateLimiter {
  return new RateLimiter(config);
}
