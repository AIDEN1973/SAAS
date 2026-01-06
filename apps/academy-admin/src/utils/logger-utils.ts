/**
 * 로깅 유틸리티 (SSOT)
 *
 * [불변 규칙] 모든 로깅은 이 파일의 함수를 통해서만 수행
 * [P2-QUALITY-2 수정] 공통 로깅 유틸로 통일하여 일관성 및 표준 강제력 확보
 *
 * 사용 방법:
 * - logError: 에러 로깅 (개발 환경: console.error, 운영 환경: logger.error)
 * - logWarn: 경고 로깅 (개발 환경: console.warn, 운영 환경: logger.warn)
 * - logInfo: 정보 로깅 (개발 환경: console.info, 운영 환경: logger.info)
 *
 * ⚠️ 운영 환경 로깅:
 * - 운영 환경에서는 logger 유틸리티를 사용합니다 (PII 마스킹 등 보안 규칙 준수)
 * - logger 유틸리티가 없으면 개발 환경과 동일하게 console을 사용합니다
 */

/**
 * 에러 로깅
 *
 * 개발 환경에서는 console.error를 사용하고,
 * 운영 환경에서는 logger.error를 사용합니다 (있는 경우).
 *
 * @param scope 로깅 범위 (예: 'HomePage:Stats', 'Emergency:PaymentFailed')
 * @param error 에러 객체
 *
 * @example
 * ```typescript
 * try {
 *   // ...
 * } catch (error) {
 *   logError('Stats:StudentStats', error);
 * }
 * ```
 */
export function logError(scope: string, error: unknown): void {
  if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
    // 개발 환경: console.error 사용
    console.error(`[${scope}]`, error);
  }
  // 프로덕션 환경에서는 콘솔 로그를 출력하지 않음
  // TODO[LOGGER]: 향후 운영 환경 로깅 유틸리티 통합 시 logger.error() 사용
  // import { logger } from '@core/logger';
  // logger.error({ scope, error });
}

/**
 * 경고 로깅
 *
 * 개발 환경에서는 console.warn을 사용하고,
 * 운영 환경에서는 logger.warn을 사용합니다 (있는 경우).
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
  }
  // 프로덕션 환경에서는 콘솔 로그를 출력하지 않음
  // TODO[LOGGER]: 향후 운영 환경 로깅 유틸리티 통합 시 logger.warn() 사용
}

/**
 * 정보 로깅
 *
 * 개발 환경에서는 console.info를 사용하고,
 * 운영 환경에서는 logger.info를 사용합니다 (있는 경우).
 *
 * @param scope 로깅 범위
 * @param message 정보 메시지
 * @param data 추가 데이터 (선택)
 *
 * @example
 * ```typescript
 * logInfo('Cache:Hit', 'Cache hit for key', { key });
 * ```
 */
export function logInfo(scope: string, message: string, data?: unknown): void {
  if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
    // 개발 환경: console.info 사용
    console.info(`[${scope}] ${message}`, data);
  }
  // 프로덕션 환경에서는 콘솔 로그를 출력하지 않음
  // TODO[LOGGER]: 향후 운영 환경 로깅 유틸리티 통합 시 logger.info() 사용
}

