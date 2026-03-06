/**
 * useAdaptiveNavigation Extended Tests
 *
 * Coverage target: 66% -> 80%+
 * Additional coverage for:
 * - Upcoming class detection (class within 10 minutes)
 * - Finished class detection (class ended within 30 minutes)
 * - Recommendation with upcoming class
 * - Recommendation with finished class
 * - dismissRecommendation hides recommendation
 * - goToRecommendation when recommendation exists
 * - Classes without start_time
 * - Day of week mapping for all days
 * - Month-end with config threshold (boundary)
 * - Device mode: tablet, mobile
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

const mockToKST = vi.fn();

vi.mock('@lib/date-utils', () => ({
  toKST: (...args: unknown[]) => mockToKST(...args),
}));

const mockUseClasses = vi.fn();

vi.mock('@hooks/use-class', () => ({
  useClasses: (...args: unknown[]) => mockUseClasses(...args),
}));

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
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function createMockDayjs(options: {
  hour: number;
  minute: number;
  day: number;
  date: number;
}) {
  const createObj = (opts: typeof options): Record<string, unknown> => {
    const obj: Record<string, unknown> = {
      _opts: opts,
      day: () => opts.day,
      date: () => opts.date,
      format: () => '2026-03-06',
      _diffMinutes: 0,
    };

    // hour() can be getter or setter
    obj.hour = (h?: number) => {
      if (h !== undefined) {
        return createObj({ ...opts, hour: h });
      }
      return opts.hour;
    };

    // minute() can be getter or setter
    obj.minute = (m?: number) => {
      if (m !== undefined) {
        return createObj({ ...opts, minute: m });
      }
      return opts.minute;
    };

    obj.second = () => obj;
    obj.millisecond = () => obj;

    obj.diff = (other: Record<string, unknown>, unit: string) => {
      if (unit === 'minute') {
        const otherOpts = other._opts as typeof opts;
        const selfMinutes = opts.hour * 60 + opts.minute;
        const otherMinutes = otherOpts.hour * 60 + otherOpts.minute;
        return selfMinutes - otherMinutes;
      }
      return 0;
    };

    obj.add = (n: number, unit: string) => {
      if (unit === 'minute') {
        const totalMin = opts.hour * 60 + opts.minute + n;
        return createObj({
          ...opts,
          hour: Math.floor(totalMin / 60),
          minute: totalMin % 60,
        });
      }
      return obj;
    };

    return obj;
  };

  return createObj(options);
}

// ============================================================================
// Tests
// ============================================================================

describe('useAdaptiveNavigation Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Default: Friday 14:50, date=6
    mockToKST.mockReturnValue(
      createMockDayjs({ hour: 14, minute: 50, day: 5, date: 6 }),
    );

    mockUseClasses.mockReturnValue({
      data: [],
      isLoading: false,
    });

    mockUseConfig.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ========== Upcoming class detection ==========

  describe('upcoming class detection', () => {
    it('detects upcoming class within 10 minutes', () => {
      // Current time: 14:50, class starts at 15:00 => 10 minutes away
      mockToKST.mockReturnValue(
        createMockDayjs({ hour: 14, minute: 50, day: 5, date: 6 }),
      );

      mockUseClasses.mockReturnValue({
        data: [
          { id: 'c1', name: 'Math', start_time: '15:00', status: 'active' },
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => useAdaptiveNavigation(), {
        wrapper: createWrapper(),
      });

      expect(result.current.contextSignals.has_upcoming_class).toBe(true);
      expect(result.current.currentRecommendation).not.toBeNull();
      expect(result.current.currentRecommendation?.action.type).toBe('show_banner');
      expect(result.current.currentRecommendation?.action.target).toContain('attendance');
    });

    it('does not detect class more than 10 minutes away', () => {
      // Current time: 14:30, class starts at 15:00 => 30 minutes away
      mockToKST.mockReturnValue(
        createMockDayjs({ hour: 14, minute: 30, day: 5, date: 6 }),
      );

      mockUseClasses.mockReturnValue({
        data: [
          { id: 'c1', name: 'Math', start_time: '15:00', status: 'active' },
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => useAdaptiveNavigation(), {
        wrapper: createWrapper(),
      });

      expect(result.current.contextSignals.has_upcoming_class).toBe(false);
    });

    it('does not detect class that already started', () => {
      // Current time: 15:10, class starts at 15:00 => diff is negative
      mockToKST.mockReturnValue(
        createMockDayjs({ hour: 15, minute: 10, day: 5, date: 6 }),
      );

      mockUseClasses.mockReturnValue({
        data: [
          { id: 'c1', name: 'Math', start_time: '15:00', status: 'active' },
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => useAdaptiveNavigation(), {
        wrapper: createWrapper(),
      });

      expect(result.current.contextSignals.has_upcoming_class).toBe(false);
    });

    it('skips classes without start_time', () => {
      mockUseClasses.mockReturnValue({
        data: [
          { id: 'c1', name: 'No Time Class', start_time: null, status: 'active' },
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => useAdaptiveNavigation(), {
        wrapper: createWrapper(),
      });

      expect(result.current.contextSignals.has_upcoming_class).toBe(false);
    });
  });

  // ========== Finished class detection ==========

  describe('finished class detection', () => {
    it('detects finished class within 30 minutes of ending', () => {
      // Current time: 16:10, class started at 15:00, duration 60 min => ended 16:00
      // diff = 16:10 - 16:00 = 10 minutes (within 30)
      mockToKST.mockReturnValue(
        createMockDayjs({ hour: 16, minute: 10, day: 5, date: 6 }),
      );

      mockUseClasses.mockReturnValue({
        data: [
          { id: 'c1', name: 'Math', start_time: '15:00', duration_minutes: 60, status: 'active' },
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => useAdaptiveNavigation(), {
        wrapper: createWrapper(),
      });

      expect(result.current.contextSignals.has_finished_class).toBe(true);
      expect(result.current.currentRecommendation).not.toBeNull();
      expect(result.current.currentRecommendation?.action.target).toContain('consultations');
    });

    it('uses default 60-minute duration when not specified', () => {
      // Current time: 16:20, class started at 15:00, default 60 min => ended 16:00
      // diff = 16:20 - 16:00 = 20 minutes (within 30)
      mockToKST.mockReturnValue(
        createMockDayjs({ hour: 16, minute: 20, day: 5, date: 6 }),
      );

      mockUseClasses.mockReturnValue({
        data: [
          { id: 'c1', name: 'Math', start_time: '15:00', status: 'active' },
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => useAdaptiveNavigation(), {
        wrapper: createWrapper(),
      });

      expect(result.current.contextSignals.has_finished_class).toBe(true);
    });

    it('does not detect class finished more than 30 minutes ago', () => {
      // Current time: 17:00, class started at 15:00, duration 60 min => ended 16:00
      // diff = 17:00 - 16:00 = 60 minutes (> 30)
      mockToKST.mockReturnValue(
        createMockDayjs({ hour: 17, minute: 0, day: 5, date: 6 }),
      );

      mockUseClasses.mockReturnValue({
        data: [
          { id: 'c1', name: 'Math', start_time: '15:00', duration_minutes: 60, status: 'active' },
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => useAdaptiveNavigation(), {
        wrapper: createWrapper(),
      });

      expect(result.current.contextSignals.has_finished_class).toBe(false);
    });
  });

  // ========== Dismiss recommendation ==========

  describe('dismiss recommendation', () => {
    it('hides recommendation after dismiss and re-enables after timeout', () => {
      mockToKST.mockReturnValue(
        createMockDayjs({ hour: 14, minute: 55, day: 5, date: 6 }),
      );

      mockUseClasses.mockReturnValue({
        data: [
          { id: 'c1', name: 'Math', start_time: '15:00', status: 'active' },
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => useAdaptiveNavigation(), {
        wrapper: createWrapper(),
      });

      expect(result.current.currentRecommendation).not.toBeNull();

      act(() => {
        result.current.dismissRecommendation();
      });

      expect(result.current.isDismissed).toBe(true);
      expect(result.current.currentRecommendation).toBeNull();

      // After 1 hour, it should re-enable
      act(() => {
        vi.advanceTimersByTime(60 * 60 * 1000);
      });

      expect(result.current.isDismissed).toBe(false);
    });
  });

  // ========== Day of week mapping ==========

  describe('day of week mapping', () => {
    const dayMapping = [
      { day: 0, expected: 'sunday' },
      { day: 1, expected: 'monday' },
      { day: 2, expected: 'tuesday' },
      { day: 3, expected: 'wednesday' },
      { day: 4, expected: 'thursday' },
      { day: 5, expected: 'friday' },
      { day: 6, expected: 'saturday' },
    ];

    dayMapping.forEach(({ day, expected }) => {
      it(`maps day ${day} to ${expected}`, () => {
        mockToKST.mockReturnValue(
          createMockDayjs({ hour: 14, minute: 0, day, date: 6 }),
        );

        const { result } = renderHook(() => useAdaptiveNavigation(), {
          wrapper: createWrapper(),
        });

        // The hook calls useClasses with the correct day_of_week
        expect(mockUseClasses).toHaveBeenCalledWith(
          expect.objectContaining({ day_of_week: expected }),
        );
      });
    });
  });

  // ========== Device mode ==========

  describe('device mode', () => {
    it('returns tablet when width is between 768 and 1023', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });

      const { result } = renderHook(() => useAdaptiveNavigation(), {
        wrapper: createWrapper(),
      });

      expect(result.current.contextSignals.device_mode).toBe('tablet');

      // Reset
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    });

    it('returns mobile when width is less than 768', () => {
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });

      const { result } = renderHook(() => useAdaptiveNavigation(), {
        wrapper: createWrapper(),
      });

      expect(result.current.contextSignals.device_mode).toBe('mobile');

      // Reset
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    });
  });

  // ========== Month-end boundary ==========

  describe('month-end boundary', () => {
    it('returns is_month_end=true when date equals threshold exactly', () => {
      mockToKST.mockReturnValue(
        createMockDayjs({ hour: 14, minute: 0, day: 5, date: 25 }),
      );
      mockUseConfig.mockReturnValue({
        data: { billing: { month_end_threshold_day: 25 } },
      });

      const { result } = renderHook(() => useAdaptiveNavigation(), {
        wrapper: createWrapper(),
      });

      expect(result.current.contextSignals.is_month_end).toBe(true);
    });

    it('returns is_month_end=false when billing threshold is non-number', () => {
      mockToKST.mockReturnValue(
        createMockDayjs({ hour: 14, minute: 0, day: 5, date: 28 }),
      );
      mockUseConfig.mockReturnValue({
        data: { billing: { month_end_threshold_day: 'invalid' } },
      });

      const { result } = renderHook(() => useAdaptiveNavigation(), {
        wrapper: createWrapper(),
      });

      expect(result.current.contextSignals.is_month_end).toBe(false);
    });
  });

  // ========== goToRecommendation ==========

  describe('goToRecommendation', () => {
    it('is callable when recommendation exists (no-op in hook)', () => {
      mockToKST.mockReturnValue(
        createMockDayjs({ hour: 14, minute: 55, day: 5, date: 6 }),
      );

      mockUseClasses.mockReturnValue({
        data: [
          { id: 'c1', name: 'Math', start_time: '15:00', status: 'active' },
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => useAdaptiveNavigation(), {
        wrapper: createWrapper(),
      });

      expect(result.current.currentRecommendation).not.toBeNull();
      // goToRecommendation should be callable without throwing
      expect(() => result.current.goToRecommendation()).not.toThrow();
    });
  });

  // ========== Upcoming takes priority over finished ==========

  describe('priority: upcoming over finished', () => {
    it('shows upcoming class recommendation when both are present', () => {
      // Time: 14:55, upcoming class at 15:00, finished class ended at 14:40
      mockToKST.mockReturnValue(
        createMockDayjs({ hour: 14, minute: 55, day: 5, date: 6 }),
      );

      mockUseClasses.mockReturnValue({
        data: [
          { id: 'c1', name: 'Upcoming', start_time: '15:00', status: 'active' },
          { id: 'c2', name: 'Finished', start_time: '13:00', duration_minutes: 60, status: 'active' },
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => useAdaptiveNavigation(), {
        wrapper: createWrapper(),
      });

      // Upcoming class takes priority
      expect(result.current.currentRecommendation?.id).toContain('class-start');
    });
  });
});
