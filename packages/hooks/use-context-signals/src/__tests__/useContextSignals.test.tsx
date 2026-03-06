/**
 * useContextSignals Hook Unit Tests
 *
 * useContextSignals is a re-export alias of useAdaptiveNavigation.
 * These tests verify that the re-export works correctly and that
 * the hook can be imported and used under the canonical name.
 *
 * Tests:
 * - Export is a valid function
 * - Returns same shape as useAdaptiveNavigation
 * - contextSignals has all required fields
 * - currentRecommendation, goToRecommendation, dismissRecommendation available
 * - isDismissed defaults to false
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

// ============================================================================
// Mocks (same as useAdaptiveNavigation since it is the same hook)
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

vi.mock('@lib/date-utils', () => ({
  toKST: () => ({
    hour: (h?: number) => {
      if (h !== undefined) {
        return {
          minute: (m?: number) => {
            if (m !== undefined) {
              return {
                second: () => ({
                  millisecond: () => ({
                    diff: () => 0,
                    add: () => ({
                      diff: () => 0,
                    }),
                  }),
                }),
                diff: () => 0,
              };
            }
            return 0;
          },
          second: () => ({
            millisecond: () => ({
              diff: () => 0,
            }),
          }),
        };
      }
      return 10; // morning
    },
    minute: () => 0,
    day: () => 5, // Friday
    date: () => 6, // 6th of month
    format: () => '2026-03-06',
  }),
}));

vi.mock('@hooks/use-class', () => ({
  useClasses: vi.fn(() => ({
    data: [],
    isLoading: false,
  })),
}));

vi.mock('@hooks/use-config', () => ({
  useConfig: vi.fn(() => ({
    data: undefined,
    isLoading: false,
  })),
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
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useContextSignals (re-export of useAdaptiveNavigation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is exported as a function', () => {
    expect(typeof useContextSignals).toBe('function');
  });

  it('returns an object with contextSignals', () => {
    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('contextSignals');
  });

  it('contextSignals has all required fields', () => {
    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    const { contextSignals } = result.current;
    expect(contextSignals).toHaveProperty('time_of_day');
    expect(contextSignals).toHaveProperty('is_month_end');
    expect(contextSignals).toHaveProperty('has_upcoming_class');
    expect(contextSignals).toHaveProperty('has_finished_class');
    expect(contextSignals).toHaveProperty('device_mode');
  });

  it('returns currentRecommendation (null when no classes)', () => {
    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('currentRecommendation');
    expect(result.current.currentRecommendation).toBeNull();
  });

  it('returns goToRecommendation as a callable function', () => {
    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.goToRecommendation).toBe('function');
    expect(() => result.current.goToRecommendation()).not.toThrow();
  });

  it('returns dismissRecommendation as a callable function', () => {
    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.dismissRecommendation).toBe('function');
  });

  it('isDismissed defaults to false', () => {
    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isDismissed).toBe(false);
  });

  it('dismissRecommendation toggles isDismissed to true', () => {
    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isDismissed).toBe(false);

    act(() => {
      result.current.dismissRecommendation();
    });

    expect(result.current.isDismissed).toBe(true);
  });

  it('has_upcoming_class is false when no classes are returned', () => {
    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextSignals.has_upcoming_class).toBe(false);
  });

  it('has_finished_class is false when no classes are returned', () => {
    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextSignals.has_finished_class).toBe(false);
  });

  it('is_month_end is false when no config threshold is set (Fail Closed)', () => {
    const { result } = renderHook(() => useContextSignals(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextSignals.is_month_end).toBe(false);
  });
});
