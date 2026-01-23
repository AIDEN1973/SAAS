/**
 * 로깅 유틸리티 (SSOT)
 *
 * [불변 규칙] 모든 로깅은 이 파일의 함수를 통해서만 수행
 * [P2-QUALITY-2 수정] 공통 로깅 유틸로 통일하여 일관성 및 표준 강제력 확보
 *
 * 사용 방법:
 * - logError: 에러 로깅 (개발: console.error, 프로덕션: Sentry)
 * - logWarn: 경고 로깅 (개발: console.warn, 프로덕션: Sentry)
 * - logInfo: 정보 로깅 (개발: console.info, 프로덕션: Sentry)
 *
 * ✅ 프로덕션 로깅:
 * - Sentry error-tracking 라이브러리 사용
 * - PII 마스킹 자동 적용
 * - 구조화된 컨텍스트 정보 포함
 */

import { getErrorTracker } from '@lib/error-tracking';

/**
 * 에러 로깅
 *
 * 개발 환경에서는 console.error를 사용하고,
 * 프로덕션 환경에서는 Sentry로 전송합니다.
 *
 * @param scope 로깅 범위 (예: 'HomePage:Stats', 'Emergency:PaymentFailed')
 * @param error 에러 객체 또는 컨텍스트 정보
 *
 * @example
 * ```typescript
 * try {
 *   // ...
 * } catch (error) {
 *   logError('Stats:StudentStats', error);
 * }
 *
 * // 컨텍스트 정보 포함
 * logError('API:FetchFailed', {
 *   error: apiError,
 *   endpoint: '/api/students',
 *   statusCode: 500
 * });
 * ```
 */
export function logError(scope: string, error: unknown): void {
  if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
    // 개발 환경: console.error 사용
    console.error(`[${scope}]`, error);
  } else {
    // 프로덕션 환경: Sentry로 전송
    const errorTracker = getErrorTracker();

    // error가 Error 객체인 경우
    if (error instanceof Error) {
      errorTracker.captureException(error, {
        component: scope.split(':')[0],
        operation: scope.split(':')[1],
      });
    } else {
      // error가 객체이거나 다른 타입인 경우
      const errorMessage = typeof error === 'object' && error !== null
        ? JSON.stringify(error)
        : String(error);

      errorTracker.captureMessage(`[${scope}] ${errorMessage}`, 'error', {
        component: scope.split(':')[0],
        operation: scope.split(':')[1],
        details: error,
      });
    }
  }
}

/**
 * 경고 로깅
 *
 * 개발 환경에서는 console.warn을 사용하고,
 * 프로덕션 환경에서는 Sentry로 전송합니다.
 *
 * @param scope 로깅 범위
 * @param message 경고 메시지
 * @param data 추가 데이터 (선택)
 *
 * @example
 * ```typescript
 * logWarn('Policy:InvalidPath', 'Policy path contains invalid characters', { path });
 * ```
 */
export function logWarn(scope: string, message: string, data?: unknown): void {
  if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
    // 개발 환경: console.warn 사용
    console.warn(`[${scope}] ${message}`, data);
  } else {
    // 프로덕션 환경: Sentry로 전송
    const errorTracker = getErrorTracker();

    errorTracker.captureMessage(`[${scope}] ${message}`, 'warning', {
      component: scope.split(':')[0],
      operation: scope.split(':')[1],
      data,
    });
  }
}

/**
 * 정보 로깅
 *
 * 개발 환경에서는 console.info를 사용하고,
 * 프로덕션 환경에서는 Sentry로 전송합니다.
 *
 * ⚠️ 주의: 프로덕션 환경에서는 중요한 정보만 로깅하세요.
 * 과도한 info 로깅은 Sentry 할당량을 빠르게 소진시킬 수 있습니다.
 *
 * @param scope 로깅 범위
 * @param message 정보 메시지
 * @param data 추가 데이터 (선택)
 *
 * @example
 * ```typescript
 * logInfo('Cache:Hit', 'Cache hit for key', { key });
 * logInfo('Auth:Login', 'User logged in successfully', { userId });
 * ```
 */
export function logInfo(scope: string, message: string, data?: unknown): void {
  if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
    // 개발 환경: console.info 사용
    console.info(`[${scope}] ${message}`, data);
  } else {
    // 프로덕션 환경: Sentry로 전송 (중요한 정보만)
    // info 레벨은 필터링하여 중요한 이벤트만 전송
    const importantScopes = ['Auth', 'Payment', 'Security', 'Critical'];
    const scopePrefix = scope.split(':')[0];

    if (importantScopes.includes(scopePrefix)) {
      const errorTracker = getErrorTracker();

      errorTracker.captureMessage(`[${scope}] ${message}`, 'info', {
        component: scope.split(':')[0],
        operation: scope.split(':')[1],
        data,
      });
    }
  }
}

