/**
 * Error Tracking Utility
 *
 * 에러 추적 시스템 기본 구조
 * [향후 확장] Sentry, DataDog 등과 연동 가능
 */

export interface ErrorContext {
  component?: string;
  operation?: string;
  userId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

export interface ErrorTrackingService {
  captureException(error: Error, context?: ErrorContext): void;
  captureMessage(message: string, level?: 'info' | 'warning' | 'error', context?: ErrorContext): void;
  setUser(user: { id: string; email?: string; username?: string }): void;
  setContext(key: string, value: Record<string, unknown>): void;
}

class ConsoleErrorTracker implements ErrorTrackingService {
  private user: { id: string; email?: string; username?: string } | null = null;
  private contexts: Map<string, Record<string, unknown>> = new Map();

  captureException(error: Error, context?: ErrorContext): void {
    console.error('[ErrorTracking] Exception:', {
      message: error.message,
      stack: error.stack,
      user: this.user,
      context,
      additionalContexts: Object.fromEntries(this.contexts),
      timestamp: new Date().toISOString(),
    });
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
    const logMethod = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
    logMethod('[ErrorTracking] Message:', {
      message,
      level,
      user: this.user,
      context,
      additionalContexts: Object.fromEntries(this.contexts),
      timestamp: new Date().toISOString(),
    });
  }

  setUser(user: { id: string; email?: string; username?: string }): void {
    this.user = user;
  }

  setContext(key: string, value: Record<string, unknown>): void {
    this.contexts.set(key, value);
  }
}

// Singleton instance
let errorTracker: ErrorTrackingService = new ConsoleErrorTracker();

/**
 * 에러 추적 서비스 초기화
 *
 * @example
 * // Sentry 연동 예시 (향후 확장)
 * initErrorTracking({
 *   service: 'sentry',
 *   dsn: process.env.SENTRY_DSN,
 *   environment: process.env.NODE_ENV,
 * });
 */
export function initErrorTracking(config?: {
  service?: 'console' | 'sentry';
  dsn?: string;
  environment?: string;
}): void {
  if (!config || config.service === 'console') {
    errorTracker = new ConsoleErrorTracker();
    return;
  }

  // 향후 Sentry 등 다른 서비스 연동 시 추가
  // if (config.service === 'sentry') {
  //   errorTracker = new SentryErrorTracker(config);
  // }
}

/**
 * 에러 추적 서비스 인스턴스 반환
 */
export function getErrorTracker(): ErrorTrackingService {
  return errorTracker;
}

/**
 * 에러 캡처 헬퍼 함수
 */
export function captureException(error: Error, context?: ErrorContext): void {
  errorTracker.captureException(error, context);
}

/**
 * 메시지 캡처 헬퍼 함수
 */
export function captureMessage(message: string, level?: 'info' | 'warning' | 'error', context?: ErrorContext): void {
  errorTracker.captureMessage(message, level, context);
}

/**
 * 사용자 정보 설정
 */
export function setUser(user: { id: string; email?: string; username?: string }): void {
  errorTracker.setUser(user);
}

/**
 * 컨텍스트 정보 설정
 */
export function setContext(key: string, value: Record<string, unknown>): void {
  errorTracker.setContext(key, value);
}
