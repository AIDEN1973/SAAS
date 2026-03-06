/**
 * Error Tracking Extended Tests
 *
 * Coverage target: 51% -> 80%+
 * Additional coverage for:
 * - SentryErrorTracker: captureException, captureMessage, setUser, setContext
 * - initErrorTracking with sentry config (mocked dynamic import)
 * - initErrorTracking sentry import failure (fallback to console)
 * - beforeSend filtering (Failed to fetch, Rate limit in dev)
 * - beforeBreadcrumb filtering (password URL)
 * - ConsoleErrorTracker with setUser+setContext accumulated state
 * - captureMessage with default level
 * - trackError with number/object/null
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Tests
// ============================================================================

describe('error-tracking extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // ========== SentryErrorTracker via mocked Sentry ==========

  describe('SentryErrorTracker via initErrorTracking', () => {
    it('initializes with Sentry when config.service=sentry and dsn is provided', async () => {
      // Mock @sentry/react dynamic import
      const mockSentryInit = vi.fn();
      const mockSentryCaptureException = vi.fn();
      const mockSentryCaptureMessage = vi.fn();
      const mockSentrySetUser = vi.fn();
      const mockSentrySetContext = vi.fn();

      vi.doMock('@sentry/react', () => ({
        init: mockSentryInit,
        captureException: mockSentryCaptureException,
        captureMessage: mockSentryCaptureMessage,
        setUser: mockSentrySetUser,
        setContext: mockSentrySetContext,
      }));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mod = await import('../index');

      await mod.initErrorTracking({
        service: 'sentry',
        dsn: 'https://test@sentry.io/123',
        environment: 'production',
        release: '1.0.0',
        sampleRate: 1.0,
        tracesSampleRate: 0.5,
        debug: true,
      });

      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/123',
          environment: 'production',
          release: '1.0.0',
          sampleRate: 1.0,
          tracesSampleRate: 0.5,
          debug: true,
        }),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ErrorTracking] Initialized with Sentry'),
      );

      // Test SentryErrorTracker methods via the tracker
      const tracker = mod.getErrorTracker();

      // captureException
      const err = new Error('Test sentry error');
      tracker.captureException(err, { component: 'MyComp', operation: 'test' });
      expect(mockSentryCaptureException).toHaveBeenCalledWith(err, {
        extra: { component: 'MyComp', operation: 'test' },
        tags: { component: 'MyComp', operation: 'test' },
      });

      // captureMessage (info)
      tracker.captureMessage('Test info', 'info', { component: 'X' });
      expect(mockSentryCaptureMessage).toHaveBeenCalledWith('Test info', {
        level: 'info',
        extra: { component: 'X' },
        tags: { component: 'X', operation: undefined },
      });

      // captureMessage (warning)
      tracker.captureMessage('Test warn', 'warning');
      expect(mockSentryCaptureMessage).toHaveBeenCalledWith('Test warn', {
        level: 'warning',
        extra: undefined,
        tags: { component: undefined, operation: undefined },
      });

      // captureMessage (error)
      tracker.captureMessage('Test err', 'error');
      expect(mockSentryCaptureMessage).toHaveBeenCalledWith('Test err', {
        level: 'error',
        extra: undefined,
        tags: { component: undefined, operation: undefined },
      });

      // setUser
      tracker.setUser({ id: 'u1', email: 'x@x.com' });
      expect(mockSentrySetUser).toHaveBeenCalledWith({ id: 'u1', email: 'x@x.com' });

      // setContext
      tracker.setContext('tenant', { tenantId: 't1' });
      expect(mockSentrySetContext).toHaveBeenCalledWith('tenant', { tenantId: 't1' });

      consoleSpy.mockRestore();
    });

    it('falls back to ConsoleErrorTracker when Sentry import fails', async () => {
      vi.doMock('@sentry/react', () => {
        throw new Error('Module not found: @sentry/react');
      });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mod = await import('../index');

      await mod.initErrorTracking({
        service: 'sentry',
        dsn: 'https://test@sentry.io/123',
      });

      // Should have logged the import failure
      expect(errorSpy).toHaveBeenCalledWith(
        '[ErrorTracking] Failed to initialize Sentry:',
        expect.any(Error),
      );

      // Should still work (using console fallback)
      const captureErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mod.captureException(new Error('After sentry fail'));
      expect(captureErrorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
      captureErrorSpy.mockRestore();
    });
  });

  // ========== Sentry beforeSend/beforeBreadcrumb ==========

  describe('Sentry beforeSend and beforeBreadcrumb', () => {
    it('beforeSend filters out "Failed to fetch" errors', async () => {
      let capturedBeforeSend: ((event: Record<string, unknown>, hint: Record<string, unknown>) => unknown) | undefined;

      vi.doMock('@sentry/react', () => ({
        init: (config: Record<string, unknown>) => {
          capturedBeforeSend = config.beforeSend as typeof capturedBeforeSend;
        },
        captureException: vi.fn(),
        captureMessage: vi.fn(),
        setUser: vi.fn(),
        setContext: vi.fn(),
      }));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mod = await import('../index');

      await mod.initErrorTracking({
        service: 'sentry',
        dsn: 'https://test@sentry.io/123',
        environment: 'production',
      });

      expect(capturedBeforeSend).toBeDefined();

      // "Failed to fetch" should be filtered out
      const filteredResult = capturedBeforeSend!(
        { event_id: '1' },
        { originalException: new Error('Failed to fetch some resource') },
      );
      expect(filteredResult).toBeNull();

      // Normal error should pass through
      const normalResult = capturedBeforeSend!(
        { event_id: '2' },
        { originalException: new Error('Normal error') },
      );
      expect(normalResult).toEqual({ event_id: '2' });

      consoleSpy.mockRestore();
    });

    it('beforeSend filters out Rate limit errors in development', async () => {
      let capturedBeforeSend: ((event: Record<string, unknown>, hint: Record<string, unknown>) => unknown) | undefined;

      vi.doMock('@sentry/react', () => ({
        init: (config: Record<string, unknown>) => {
          capturedBeforeSend = config.beforeSend as typeof capturedBeforeSend;
        },
        captureException: vi.fn(),
        captureMessage: vi.fn(),
        setUser: vi.fn(),
        setContext: vi.fn(),
      }));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mod = await import('../index');

      await mod.initErrorTracking({
        service: 'sentry',
        dsn: 'https://test@sentry.io/123',
        environment: 'development',
      });

      expect(capturedBeforeSend).toBeDefined();

      // Rate limit in development should be filtered
      const result = capturedBeforeSend!(
        { event_id: '1' },
        { originalException: new Error('Rate limit exceeded') },
      );
      expect(result).toBeNull();

      consoleSpy.mockRestore();
    });

    it('beforeBreadcrumb filters out breadcrumbs with password URLs', async () => {
      let capturedBeforeBreadcrumb: ((breadcrumb: Record<string, unknown>) => unknown) | undefined;

      vi.doMock('@sentry/react', () => ({
        init: (config: Record<string, unknown>) => {
          capturedBeforeBreadcrumb = config.beforeBreadcrumb as typeof capturedBeforeBreadcrumb;
        },
        captureException: vi.fn(),
        captureMessage: vi.fn(),
        setUser: vi.fn(),
        setContext: vi.fn(),
      }));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mod = await import('../index');

      await mod.initErrorTracking({
        service: 'sentry',
        dsn: 'https://test@sentry.io/123',
      });

      expect(capturedBeforeBreadcrumb).toBeDefined();

      // Password URL should be filtered
      const filtered = capturedBeforeBreadcrumb!({
        data: { url: '/api/auth/password/reset' },
      });
      expect(filtered).toBeNull();

      // Normal URL should pass
      const normal = capturedBeforeBreadcrumb!({
        data: { url: '/api/students' },
      });
      expect(normal).toEqual({ data: { url: '/api/students' } });

      consoleSpy.mockRestore();
    });
  });

  // ========== ConsoleErrorTracker with accumulated state ==========

  describe('ConsoleErrorTracker accumulated state', () => {
    it('setContext accumulates multiple contexts', async () => {
      const mod = await import('../index');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mod.setContext('tenant', { tenantId: 't1' });
      mod.setContext('billing', { plan: 'pro' });
      mod.captureException(new Error('multi-context test'));

      expect(errorSpy).toHaveBeenCalledWith(
        '[ErrorTracking] Exception:',
        expect.objectContaining({
          additionalContexts: expect.objectContaining({
            tenant: { tenantId: 't1' },
            billing: { plan: 'pro' },
          }),
        }),
      );

      errorSpy.mockRestore();
    });

    it('captureMessage with context includes user and context', async () => {
      const mod = await import('../index');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      mod.setUser({ id: 'u1', email: 'a@b.com', username: 'test' });
      mod.setContext('nav', { page: '/home' });
      mod.captureMessage('test msg', 'info', { component: 'Header' });

      expect(logSpy).toHaveBeenCalledWith(
        '[ErrorTracking] Message:',
        expect.objectContaining({
          message: 'test msg',
          user: { id: 'u1', email: 'a@b.com', username: 'test' },
          context: { component: 'Header' },
        }),
      );

      logSpy.mockRestore();
    });

    it('captureMessage defaults to info level when no level provided', async () => {
      const mod = await import('../index');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      mod.captureMessage('no-level message');

      expect(logSpy).toHaveBeenCalledWith(
        '[ErrorTracking] Message:',
        expect.objectContaining({
          level: 'info',
        }),
      );

      logSpy.mockRestore();
    });
  });

  // ========== trackError with various types ==========

  describe('trackError with various types', () => {
    it('handles number value', async () => {
      const mod = await import('../index');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mod.trackError(42);

      expect(errorSpy).toHaveBeenCalledWith(
        '[ErrorTracking] Message:',
        expect.objectContaining({ message: '42', level: 'error' }),
      );

      errorSpy.mockRestore();
    });

    it('handles null value', async () => {
      const mod = await import('../index');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mod.trackError(null);

      expect(errorSpy).toHaveBeenCalledWith(
        '[ErrorTracking] Message:',
        expect.objectContaining({ message: 'null', level: 'error' }),
      );

      errorSpy.mockRestore();
    });

    it('handles undefined value', async () => {
      const mod = await import('../index');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mod.trackError(undefined);

      expect(errorSpy).toHaveBeenCalledWith(
        '[ErrorTracking] Message:',
        expect.objectContaining({ message: 'undefined', level: 'error' }),
      );

      errorSpy.mockRestore();
    });
  });

  // ========== initErrorTracking with no DSN ==========

  describe('initErrorTracking edge cases', () => {
    it('defaults to console when service=sentry but no DSN provided', async () => {
      const mod = await import('../index');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await mod.initErrorTracking({ service: 'sentry' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ErrorTracking] Initialized with Console tracker'),
      );

      consoleSpy.mockRestore();
    });

    it('initErrorTracking with sentry default options (no sampleRate, etc)', async () => {
      let capturedConfig: Record<string, unknown> | undefined;

      vi.doMock('@sentry/react', () => ({
        init: (config: Record<string, unknown>) => {
          capturedConfig = config;
        },
        captureException: vi.fn(),
        captureMessage: vi.fn(),
        setUser: vi.fn(),
        setContext: vi.fn(),
      }));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mod = await import('../index');

      await mod.initErrorTracking({
        service: 'sentry',
        dsn: 'https://test@sentry.io/123',
        // No environment, no sampleRate, no tracesSampleRate, no debug
      });

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig!.environment).toBe('development');
      expect(capturedConfig!.sampleRate).toBe(1.0);
      expect(capturedConfig!.tracesSampleRate).toBe(0.2);
      expect(capturedConfig!.debug).toBe(false);

      consoleSpy.mockRestore();
    });
  });
});
