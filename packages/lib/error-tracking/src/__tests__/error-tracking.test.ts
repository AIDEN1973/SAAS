/**
 * Error Tracking Library Unit Tests
 *
 * Test scope:
 * - initErrorTracking: initialization with console/sentry config
 * - ConsoleErrorTracker: captureException, captureMessage, setUser, setContext
 * - getErrorTracker: singleton retrieval
 * - Helper functions: captureException, captureMessage, setUser, setContext, trackError
 * - Double initialization guard
 *
 * Pure function tests (no JSX)
 * Note: Sentry integration is NOT tested here (requires @sentry/react dynamic import)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Module Reset
// ============================================================================

// We need to re-import the module for each test to reset the singleton state
// Using dynamic import + vi.resetModules() pattern

// ============================================================================
// Tests
// ============================================================================

describe('error-tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('exports all expected functions', async () => {
    const mod = await import('../index');
    expect(typeof mod.initErrorTracking).toBe('function');
    expect(typeof mod.getErrorTracker).toBe('function');
    expect(typeof mod.captureException).toBe('function');
    expect(typeof mod.captureMessage).toBe('function');
    expect(typeof mod.setUser).toBe('function');
    expect(typeof mod.setContext).toBe('function');
    expect(typeof mod.trackError).toBe('function');
  });

  it('getErrorTracker returns a ConsoleErrorTracker by default', async () => {
    const mod = await import('../index');
    const tracker = mod.getErrorTracker();
    expect(tracker).toBeDefined();
    expect(typeof tracker.captureException).toBe('function');
    expect(typeof tracker.captureMessage).toBe('function');
    expect(typeof tracker.setUser).toBe('function');
    expect(typeof tracker.setContext).toBe('function');
  });

  it('initErrorTracking with console config initializes successfully', async () => {
    const mod = await import('../index');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await mod.initErrorTracking({ service: 'console' });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ErrorTracking] Initialized with Console tracker'),
    );
    consoleSpy.mockRestore();
  });

  it('initErrorTracking with no config defaults to console', async () => {
    const mod = await import('../index');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await mod.initErrorTracking();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ErrorTracking] Initialized with Console tracker'),
    );
    consoleSpy.mockRestore();
  });

  it('initErrorTracking prevents double initialization', async () => {
    const mod = await import('../index');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await mod.initErrorTracking({ service: 'console' });
    await mod.initErrorTracking({ service: 'console' }); // second call

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ErrorTracking] Already initialized'),
    );
    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('captureException logs error to console', async () => {
    const mod = await import('../index');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const testError = new Error('Test error');
    mod.captureException(testError, { component: 'TestComponent', operation: 'test-op' });

    expect(errorSpy).toHaveBeenCalledWith(
      '[ErrorTracking] Exception:',
      expect.objectContaining({
        message: 'Test error',
        context: expect.objectContaining({ component: 'TestComponent', operation: 'test-op' }),
      }),
    );
    errorSpy.mockRestore();
  });

  it('captureMessage logs info message to console', async () => {
    const mod = await import('../index');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mod.captureMessage('Test info message', 'info');

    expect(logSpy).toHaveBeenCalledWith(
      '[ErrorTracking] Message:',
      expect.objectContaining({
        message: 'Test info message',
        level: 'info',
      }),
    );
    logSpy.mockRestore();
  });

  it('captureMessage logs warning message to console', async () => {
    const mod = await import('../index');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mod.captureMessage('Test warning', 'warning');

    expect(warnSpy).toHaveBeenCalledWith(
      '[ErrorTracking] Message:',
      expect.objectContaining({
        message: 'Test warning',
        level: 'warning',
      }),
    );
    warnSpy.mockRestore();
  });

  it('captureMessage logs error message to console', async () => {
    const mod = await import('../index');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mod.captureMessage('Test error message', 'error');

    expect(errorSpy).toHaveBeenCalledWith(
      '[ErrorTracking] Message:',
      expect.objectContaining({
        message: 'Test error message',
        level: 'error',
      }),
    );
    errorSpy.mockRestore();
  });

  it('setUser stores user info for subsequent captures', async () => {
    const mod = await import('../index');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mod.setUser({ id: 'user-1', email: 'test@example.com' });
    mod.captureException(new Error('After setUser'));

    expect(errorSpy).toHaveBeenCalledWith(
      '[ErrorTracking] Exception:',
      expect.objectContaining({
        user: { id: 'user-1', email: 'test@example.com' },
      }),
    );
    errorSpy.mockRestore();
  });

  it('setContext stores context for subsequent captures', async () => {
    const mod = await import('../index');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mod.setContext('tenant', { tenantId: 'tenant-123', plan: 'pro' });
    mod.captureException(new Error('After setContext'));

    expect(errorSpy).toHaveBeenCalledWith(
      '[ErrorTracking] Exception:',
      expect.objectContaining({
        additionalContexts: expect.objectContaining({
          tenant: { tenantId: 'tenant-123', plan: 'pro' },
        }),
      }),
    );
    errorSpy.mockRestore();
  });

  it('trackError handles Error instances', async () => {
    const mod = await import('../index');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mod.trackError(new Error('Tracked error'));

    expect(errorSpy).toHaveBeenCalledWith(
      '[ErrorTracking] Exception:',
      expect.objectContaining({ message: 'Tracked error' }),
    );
    errorSpy.mockRestore();
  });

  it('trackError handles non-Error values (string)', async () => {
    const mod = await import('../index');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mod.trackError('string error');

    expect(errorSpy).toHaveBeenCalledWith(
      '[ErrorTracking] Message:',
      expect.objectContaining({
        message: 'string error',
        level: 'error',
      }),
    );
    errorSpy.mockRestore();
  });
});
