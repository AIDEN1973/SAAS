/**
 * Edge Function Retry Utility
 *
 * [Phase 3] 지수 백오프(exponential backoff) + 지터(jitter) 기반 재시도 유틸리티
 * [불변 규칙] 재시도 가능 에러와 불가 에러를 엄격히 구분
 */

export interface RetryOptions {
  /** 최대 재시도 횟수 (기본값: 3) */
  maxRetries?: number;
  /** 기본 대기 시간 ms (기본값: 1000) */
  baseDelay?: number;
  /** 최대 대기 시간 ms (기본값: 10000) */
  maxDelay?: number;
  /** 재시도 가능한 에러 코드 목록 */
  retryableErrors?: string[];
  /** 재시도 시 호출되는 콜백 (로깅용) */
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

export interface RetryResult<T> {
  data: T;
  attempts: number;
}

/** 기본 재시도 가능 에러 코드 */
const DEFAULT_RETRYABLE_ERRORS = [
  // PostgreSQL
  'PGRST301',   // 연결 타임아웃
  '40001',      // serialization failure
  '40P01',      // deadlock
  '53300',      // too many connections
  '57014',      // query cancelled (statement timeout)
  '08006',      // connection failure
  '08001',      // unable to connect
  // Supabase / Network
  'FetchError',
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
];

/** 절대 재시도하지 않는 에러 코드 (4xx 클라이언트 에러) */
const NON_RETRYABLE_ERRORS = [
  '23505',  // unique violation (멱등성 문제)
  '23503',  // foreign key violation
  '23502',  // not null violation
  '42P01',  // table not found
  '42703',  // column not found
  'PGRST116', // not found (single row expected)
  '22P02',  // invalid text representation
];

/**
 * 에러가 재시도 가능한지 판별
 */
function isRetryableError(error: unknown, retryableErrors: string[]): boolean {
  // 절대 재시도 불가 에러 먼저 체크
  const errorCode = extractErrorCode(error);
  if (errorCode && NON_RETRYABLE_ERRORS.includes(errorCode)) {
    return false;
  }

  // 명시적 재시도 가능 에러 코드 매칭
  if (errorCode && retryableErrors.includes(errorCode)) {
    return true;
  }

  // 에러 메시지 기반 판별 (네트워크 에러)
  const errorMessage = extractErrorMessage(error);
  if (
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('ECONNRESET') ||
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('connection')
  ) {
    return true;
  }

  // HTTP 5xx 에러
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    if (status >= 500 && status < 600) {
      return true;
    }
  }

  return false;
}

/**
 * 에러에서 코드를 추출
 */
function extractErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as Record<string, unknown>;
  if (typeof e.code === 'string') return e.code;
  if (typeof e.error_code === 'string') return e.error_code;
  // Supabase PostgrestError
  if (e.details && typeof e.details === 'object') {
    const details = e.details as Record<string, unknown>;
    if (typeof details.code === 'string') return details.code;
  }
  return null;
}

/**
 * 에러에서 메시지를 추출
 */
function extractErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e.message === 'string') return e.message;
    if (typeof e.error_message === 'string') return e.error_message;
  }
  return String(error);
}

/**
 * 지수 백오프 + 지터 대기 시간 계산
 *
 * delay = min(maxDelay, baseDelay * 2^attempt) * (0.5 + random * 0.5)
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponentialDelay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
  // Full jitter: 0.5x ~ 1.0x 범위
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.floor(exponentialDelay * jitter);
}

/**
 * 주어진 밀리초만큼 대기
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 재시도 래퍼 함수
 *
 * 지수 백오프 + 지터를 적용하여 재시도 가능한 에러에 대해 자동 재시도합니다.
 * 재시도 불가능한 에러(4xx, 유니크 위반 등)는 즉시 throw합니다.
 *
 * @example
 * const result = await withRetry(
 *   () => supabase.from('invoices').insert(invoice).select().single(),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 */
export async function withRetry<T>(
  fn: () => T | Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    retryableErrors = DEFAULT_RETRYABLE_ERRORS,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();

      // Supabase 응답 패턴: { data, error } 형식인 경우 error를 체크
      if (result && typeof result === 'object' && 'error' in result) {
        const supaResult = result as { data: unknown; error: unknown };
        if (supaResult.error) {
          // 재시도 가능한 에러인지 판별
          if (attempt < maxRetries && isRetryableError(supaResult.error, retryableErrors)) {
            lastError = supaResult.error;
            const delay = calculateDelay(attempt, baseDelay, maxDelay);
            onRetry?.(attempt + 1, supaResult.error, delay);
            console.warn(`[withRetry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms:`, extractErrorMessage(supaResult.error));
            await sleep(delay);
            continue;
          }
          // 재시도 불가능하거나 재시도 소진 → 에러 전파
          throw supaResult.error;
        }
      }

      return { data: result, attempts: attempt + 1 };
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries && isRetryableError(error, retryableErrors)) {
        const delay = calculateDelay(attempt, baseDelay, maxDelay);
        onRetry?.(attempt + 1, error, delay);
        console.warn(`[withRetry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms:`, extractErrorMessage(error));
        await sleep(delay);
        continue;
      }

      // 재시도 불가능하거나 재시도 소진
      throw error;
    }
  }

  // 모든 재시도 소진 (이론적으로 도달 불가)
  throw lastError;
}
