/**
 * Error Tracking Utility
 *
 * 에러 추적 시스템 - Sentry 연동 지원
 *
 * [설정 방법]
 * 1. .env 파일에 VITE_SENTRY_DSN 설정
 * 2. main.tsx에서 initErrorTracking() 호출
 *
 * @example
 * // main.tsx
 * import { initErrorTracking } from '@lib/error-tracking';
 *
 * initErrorTracking({
 *   service: 'sentry',
 *   dsn: import.meta.env.VITE_SENTRY_DSN,
 *   environment: import.meta.env.MODE,
 *   release: import.meta.env.VITE_APP_VERSION,
 * });
 */

// Sentry 동적 import를 위한 변수
let Sentry: typeof import('@sentry/react') | null = null;

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

export interface ErrorTrackingConfig {
  service?: 'console' | 'sentry';
  dsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  tracesSampleRate?: number;
  debug?: boolean;
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

/**
 * Sentry Error Tracker
 */
class SentryErrorTracker implements ErrorTrackingService {
  constructor(private sentryModule: typeof import('@sentry/react')) {}

  captureException(error: Error, context?: ErrorContext): void {
    this.sentryModule.captureException(error, {
      extra: context,
      tags: {
        component: context?.component,
        operation: context?.operation,
      },
    });
  }

  captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    context?: ErrorContext
  ): void {
    const sentryLevel = level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info';
    this.sentryModule.captureMessage(message, {
      level: sentryLevel,
      extra: context,
      tags: {
        component: context?.component,
        operation: context?.operation,
      },
    });
  }

  setUser(user: { id: string; email?: string; username?: string }): void {
    this.sentryModule.setUser(user);
  }

  setContext(key: string, value: Record<string, unknown>): void {
    this.sentryModule.setContext(key, value);
  }
}

// Singleton instance
let errorTracker: ErrorTrackingService = new ConsoleErrorTracker();
let isInitialized = false;

/**
 * 에러 추적 서비스 초기화
 *
 * @example
 * // Sentry 연동 (production)
 * await initErrorTracking({
 *   service: 'sentry',
 *   dsn: import.meta.env.VITE_SENTRY_DSN,
 *   environment: import.meta.env.MODE,
 *   release: '1.0.0',
 *   sampleRate: 1.0,
 *   tracesSampleRate: 0.2,
 * });
 *
 * // Console fallback (development)
 * initErrorTracking({ service: 'console' });
 */
export async function initErrorTracking(config?: ErrorTrackingConfig): Promise<void> {
  if (isInitialized) {
    console.warn('[ErrorTracking] Already initialized. Skipping.');
    return;
  }

  if (!config || config.service === 'console' || !config.dsn) {
    errorTracker = new ConsoleErrorTracker();
    isInitialized = true;
    console.log('[ErrorTracking] Initialized with Console tracker');
    return;
  }

  if (config.service === 'sentry' && config.dsn) {
    try {
      // Sentry 동적 import
      Sentry = await import('@sentry/react');

      // Sentry 초기화
      Sentry.init({
        dsn: config.dsn,
        environment: config.environment || 'development',
        release: config.release,
        sampleRate: config.sampleRate ?? 1.0,
        tracesSampleRate: config.tracesSampleRate ?? 0.2,
        debug: config.debug ?? false,
        // 에러 필터링
        beforeSend(event, hint) {
          const error = hint.originalException as Error;
          // 네트워크 에러 중 무시할 것들
          if (error?.message?.includes('Failed to fetch')) {
            return null;
          }
          // 개발 환경에서는 Rate Limit 에러 무시
          if (
            config.environment === 'development' &&
            error?.message?.includes('Rate limit')
          ) {
            return null;
          }
          return event;
        },
        // 민감 정보 마스킹
        beforeBreadcrumb(breadcrumb) {
          if (breadcrumb.data?.url?.includes('password')) {
            return null;
          }
          return breadcrumb;
        },
      });

      errorTracker = new SentryErrorTracker(Sentry);
      isInitialized = true;
      console.log('[ErrorTracking] Initialized with Sentry');
    } catch (error) {
      console.error('[ErrorTracking] Failed to initialize Sentry:', error);
      // Fallback to console
      errorTracker = new ConsoleErrorTracker();
      isInitialized = true;
    }
  }
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
