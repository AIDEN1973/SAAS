/**
 * useContextSignals Extended Tests
 *
 * Coverage target: 0% -> 80%+
 * The module is a single re-export of useAdaptiveNavigation.
 * These tests ensure the re-export is correctly wired and the hook
 * can be fully exercised through the canonical name.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

// ============================================================================
// Mocks (same as useAdaptiveNavigation)
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

import { useContextSignals } from '../index';

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

function createMockDayjs(hour: number, minute: number, day: number, date: number) {
  const createObj = (h: number, m: number): Record<string, unknown> => {
    const obj: Record<string, unknown> = {
      _opts: { hour: h, minute: m, day, date },
      day: () => day,
      date: () => date,
      format: () => '2026-03-06',
    };
    obj.hour = (hVal?: number) => {
      if (hVal !== undefined) return createObj(hVal, m);
      return h;
    };
    obj.minute = (mVal?: number) => {
      if (mVal !== undefined) return createObj(h, mVal);
      return m;
    };
    obj.second = () => obj;
    obj.millisecond = () => obj;
    obj.diff = (other: Record<string, unknown>, unit: string) => {
      if (unit === 'minute') {
        const otherOpts = other._opts as { hour: number; minute: number };
        return (h * 60 + m) - (otherOpts.hour * 60 + otherOpts.minute);
      }
      return 0;
    };
    obj.add = (n: number, unit: string) => {
      if (unit === 'minute') {
        const totalMin = h * 60 + m + n;
        return createObj(Math.floor(totalMin / 60), totalMin % 60);
      }
      return obj;
    };
    return obj;
  };
  return createObj(hour, minute);
}

// ============================================================================
// Tests
// ============================================================================

describe('useContextSignals Extended (re-export verification)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToKST.mockReturnValue(createMockDayjs(10, 30, 3, 15));
    mockUseClasses.mockReturnValue({ data: [], isLoading: false });
    mockUseConfig.mockReturnValue({ data: undefined, isLoading: false });
  });

  it('exports useContextSignals as a function', () => {
    expect(typeof useContextSignals).toBe('function');
  });

  it('returns all expected properties', () => {
    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('currentRecommendation');
    expect(result.current).toHaveProperty('contextSignals');
    expect(result.current).toHaveProperty('goToRecommendation');
    expect(result.current).toHaveProperty('dismissRecommendation');
    expect(result.current).toHaveProperty('isDismissed');
  });

  it('contextSignals correctly reflects morning time', () => {
    mockToKST.mockReturnValue(createMockDayjs(9, 0, 3, 15));

    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextSignals.time_of_day).toBe('morning');
  });

  it('contextSignals correctly reflects afternoon time', () => {
    mockToKST.mockReturnValue(createMockDayjs(14, 0, 3, 15));

    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextSignals.time_of_day).toBe('afternoon');
  });

  it('contextSignals correctly reflects evening time', () => {
    mockToKST.mockReturnValue(createMockDayjs(20, 0, 3, 15));

    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextSignals.time_of_day).toBe('evening');
  });

  it('detects upcoming class within 10 minutes', () => {
    mockToKST.mockReturnValue(createMockDayjs(14, 52, 3, 15));
    mockUseClasses.mockReturnValue({
      data: [{ id: 'c1', name: 'Test', start_time: '15:00', status: 'active' }],
      isLoading: false,
    });

    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextSignals.has_upcoming_class).toBe(true);
    expect(result.current.currentRecommendation).not.toBeNull();
  });

  it('detects finished class within 30 minutes', () => {
    mockToKST.mockReturnValue(createMockDayjs(16, 15, 3, 15));
    mockUseClasses.mockReturnValue({
      data: [{ id: 'c1', name: 'Test', start_time: '15:00', duration_minutes: 60, status: 'active' }],
      isLoading: false,
    });

    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextSignals.has_finished_class).toBe(true);
  });

  it('dismiss works through the canonical name', () => {
    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isDismissed).toBe(false);

    act(() => {
      result.current.dismissRecommendation();
    });

    expect(result.current.isDismissed).toBe(true);
  });

  it('goToRecommendation is callable', () => {
    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(() => result.current.goToRecommendation()).not.toThrow();
  });
});
