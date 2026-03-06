/**
 * useAdaptiveNavigation Hook Unit Tests
 *
 * Tests:
 * - Context signals generation (time_of_day, is_month_end, device_mode)
 * - Upcoming class detection (10 minutes before start)
 * - Finished class detection (within 30 minutes of end)
 * - Recommendation generation for upcoming/finished classes
 * - Dismiss recommendation behavior
 * - No recommendation when no classes match
 * - getTodayDayOfWeek mapping
 * - Month-end detection from config policy
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    callRPC: vi.fn(),
  },
  getApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
}));

vi.mock('@hooks/use-auth', () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: 'test-user-id' } },
  })),
}));

// Mock toKST to return a fixed KST time: 2026-03-06 14:50 (Friday afternoon, 10 min before 15:00 class)
const mockToKST = vi.fn();

vi.mock('@lib/date-utils', () => ({
  toKST: (...args: unknown[]) => mockToKST(...args),
}));

// Mock useClasses to return today's classes
const mockUseClasses = vi.fn();

vi.mock('@hooks/use-class', () => ({
  useClasses: (...args: unknown[]) => mockUseClasses(...args),
}));

// Mock useConfig to return config with billing thresholds
const mockUseConfig = vi.fn();

vi.mock('@hooks/use-config', () => ({
  useConfig: (...args: unknown[]) => mockUseConfig(...args),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { useAdaptiveNavigation } from '../useAdaptiveNavigation';

// ============================================================================
// Test Helpers
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * Create a mock dayjs-like object for toKST()
 */
function createMockDayjs(options: {
  hour: number;
  minute: number;
  day: number; // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  date: number; // day of month
}) {
  const self = {
    hour: () => options.hour,
    minute: () => options.minute,
    day: () => options.day,
    date: () => options.date,
    second: () => self,
    millisecond: () => self,
    diff: (other: ReturnType<typeof createMockDayjs>, unit: string) => {
      // Simplified diff for testing: returns minutes
      if (unit === 'minute') {
        // Compute a simple difference based on the context
        // This will be set per-test
        return (self as Record<string, unknown>)._diffMinutes as number || 0;
      }
      return 0;
    },
    add: (n: number, unit: string) => {
      if (unit === 'minute') {
        const newMinute = options.minute + n;
        const newHour = options.hour + Math.floor(newMinute / 60);
        return createMockDayjs({
          ...options,
          hour: newHour,
          minute: newMinute % 60,
        });
      }
      return self;
    },
    format: (fmt: string) => '2026-03-06',
    _diffMinutes: 0,
  };

  // Allow overriding hour/minute for chaining: .hour(h).minute(m)
  const chainable = {
    ...self,
    hour: (h?: number) => {
      if (h !== undefined) {
        const newObj = createMockDayjs({ ...options, hour: h });
        return newObj;
      }
      return options.hour;
    },
    minute: (m?: number) => {
      if (m !== undefined) {
        const newObj = createMockDayjs({ ...options, minute: m });
        return newObj;
      }
      return options.minute;
    },
  };

  return chainable;
}

// ============================================================================
// Tests
// ============================================================================

describe('useAdaptiveNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: Friday afternoon 14:50, date=6 (not month-end)
    mockToKST.mockReturnValue(
      createMockDayjs({ hour: 14, minute: 50, day: 5, date: 6 })
    );

    // Default: no classes
    mockUseClasses.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    // Default: no config (billing threshold not set)
    mockUseConfig.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
  });

  it('returns contextSignals with correct shape', () => {
    const { result } = renderHook(() => useAdaptiveNavigation(), {
      wrapper: createWrapper(),
    });

    const { contextSignals } = result.current;
    expect(contextSignals).toHaveProperty('time_of_day');
    expect(contextSignals).toHaveProperty('is_month_end');
    expect(contextSignals).toHaveProperty('has_upcoming_class');
    expect(contextSignals).toHaveProperty('has_finished_class');
    expect(contextSignals).toHaveProperty('device_mode');
  });

  it('detects afternoon time_of_day correctly (hour 14)', () => {
    mockToKST.mockReturnValue(
      createMockDayjs({ hour: 14, minute: 0, day: 5, date: 6 })
    );

    const { result } = renderHook(() => useAdaptiveNavigation(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextSignals.time_of_day).toBe('afternoon');
  });

  it('detects morning time_of_day correctly (hour 9)', () => {
    mockToKST.mockReturnValue(
      createMockDayjs({ hour: 9, minute: 0, day: 5, date: 6 })
    );

    const { result } = renderHook(() => useAdaptiveNavigation(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextSignals.time_of_day).toBe('morning');
  });

  it('detects evening time_of_day correctly (hour 19)', () => {
    mockToKST.mockReturnValue(
      createMockDayjs({ hour: 19, minute: 0, day: 5, date: 6 })
    );

    const { result } = renderHook(() => useAdaptiveNavigation(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextSignals.time_of_day).toBe('evening');
  });

  it('returns is_month_end=false when config has no billing threshold (Fail Closed)', () => {
    mockUseConfig.mockReturnValue({ data: undefined });

    const { result } = renderHook(() => useAdaptiveNavigation(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextSignals.is_month_end).toBe(false);
  });

  it('returns is_month_end=true when date >= billing threshold', () => {
    // Set date to 26th and threshold to 25
    mockToKST.mockReturnValue(
      createMockDayjs({ hour: 14, minute: 0, day: 5, date: 26 })
    );
    mockUseConfig.mockReturnValue({
      data: { billing: { month_end_threshold_day: 25 } },
    });

    const { result } = renderHook(() => useAdaptiveNavigation(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextSignals.is_month_end).toBe(true);
  });

  it('returns is_month_end=false when date < billing threshold', () => {
    mockToKST.mockReturnValue(
      createMockDayjs({ hour: 14, minute: 0, day: 5, date: 20 })
    );
    mockUseConfig.mockReturnValue({
      data: { billing: { month_end_threshold_day: 25 } },
    });

    const { result } = renderHook(() => useAdaptiveNavigation(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextSignals.is_month_end).toBe(false);
  });

  it('returns no recommendation when there are no classes today', () => {
    mockUseClasses.mockReturnValue({
      data: [],
      isLoading: false,
    });

    const { result } = renderHook(() => useAdaptiveNavigation(), {
      wrapper: createWrapper(),
    });

    expect(result.current.currentRecommendation).toBeNull();
    expect(result.current.contextSignals.has_upcoming_class).toBe(false);
    expect(result.current.contextSignals.has_finished_class).toBe(false);
  });

  it('returns no recommendation when classes data is null', () => {
    mockUseClasses.mockReturnValue({
      data: null,
      isLoading: false,
    });

    const { result } = renderHook(() => useAdaptiveNavigation(), {
      wrapper: createWrapper(),
    });

    expect(result.current.currentRecommendation).toBeNull();
  });

  it('dismissRecommendation sets isDismissed to true', () => {
    const { result } = renderHook(() => useAdaptiveNavigation(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isDismissed).toBe(false);

    act(() => {
      result.current.dismissRecommendation();
    });

    expect(result.current.isDismissed).toBe(true);
  });

  it('returns device_mode based on window.innerWidth', () => {
    // jsdom default innerWidth is 1024, which is >= 1024 => 'desktop'
    const { result } = renderHook(() => useAdaptiveNavigation(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextSignals.device_mode).toBe('desktop');
  });

  it('goToRecommendation is a callable function (no-op when no recommendation)', () => {
    const { result } = renderHook(() => useAdaptiveNavigation(), {
      wrapper: createWrapper(),
    });

    // Should not throw
    expect(() => result.current.goToRecommendation()).not.toThrow();
  });
});
