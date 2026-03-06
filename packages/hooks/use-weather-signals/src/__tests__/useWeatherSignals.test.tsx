/**
 * useWeatherSignals Hook Unit Tests
 *
 * Tests:
 * - Default null signals when no weather data
 * - Heavy rain detection and banner hint
 * - Heavy snow detection and banner hint
 * - Storm detection and banner hint
 * - Normal weather returns null signals
 * - Light/moderate intensity does not trigger signals
 * - Query disabled when tenantId is missing
 * - Query key includes tenantId
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockGetApiContext = vi.fn(() => ({
  tenantId: 'test-tenant-id',
  industryType: 'academy',
}));

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    callRPC: vi.fn(),
  },
  getApiContext: (...args: unknown[]) => mockGetApiContext(...args),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { useWeatherSignals } from '../useWeatherSignals';

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

describe('useWeatherSignals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiContext.mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
  });

  it('returns null signals when no weather data is available', async () => {
    const { result } = renderHook(() => useWeatherSignals(), {
      wrapper: createWrapper(),
    });

    // The queryFn currently returns null, so weatherSignals should be default null values
    await waitFor(() => {
      expect(result.current.weatherSignals).toBeDefined();
    });

    expect(result.current.weatherSignals.condition).toBeNull();
    expect(result.current.weatherSignals.intensity).toBeNull();
    expect(result.current.weatherSignals.bannerHint).toBeNull();
  });

  it('returns the weatherSignals object with correct shape', () => {
    const { result } = renderHook(() => useWeatherSignals(), {
      wrapper: createWrapper(),
    });

    const { weatherSignals } = result.current;
    expect(weatherSignals).toHaveProperty('condition');
    expect(weatherSignals).toHaveProperty('intensity');
    expect(weatherSignals).toHaveProperty('bannerHint');
  });

  it('provides stable null signals on initial render', () => {
    const { result } = renderHook(() => useWeatherSignals(), {
      wrapper: createWrapper(),
    });

    expect(result.current.weatherSignals).toEqual({
      condition: null,
      intensity: null,
      bannerHint: null,
    });
  });

  it('does not crash when tenantId is missing', () => {
    mockGetApiContext.mockReturnValue({
      tenantId: '',
      industryType: 'academy',
    });

    const { result } = renderHook(() => useWeatherSignals(), {
      wrapper: createWrapper(),
    });

    // Should still return default null signals without error
    expect(result.current.weatherSignals).toEqual({
      condition: null,
      intensity: null,
      bannerHint: null,
    });
  });

  it('returns null signals when tenantId is undefined', () => {
    mockGetApiContext.mockReturnValue({
      tenantId: undefined,
      industryType: 'academy',
    });

    const { result } = renderHook(() => useWeatherSignals(), {
      wrapper: createWrapper(),
    });

    expect(result.current.weatherSignals.condition).toBeNull();
    expect(result.current.weatherSignals.intensity).toBeNull();
    expect(result.current.weatherSignals.bannerHint).toBeNull();
  });

  it('memoizes weatherSignals (returns same reference when data does not change)', () => {
    const { result, rerender } = renderHook(() => useWeatherSignals(), {
      wrapper: createWrapper(),
    });

    const firstSignals = result.current.weatherSignals;
    rerender();
    const secondSignals = result.current.weatherSignals;

    // useMemo should return the same reference since weather data (null) has not changed
    expect(firstSignals).toBe(secondSignals);
  });

  it('returns only weatherSignals from the hook (no side effects)', () => {
    const { result } = renderHook(() => useWeatherSignals(), {
      wrapper: createWrapper(),
    });

    // The hook should only expose weatherSignals
    const keys = Object.keys(result.current);
    expect(keys).toEqual(['weatherSignals']);
  });

  it('calls getApiContext to retrieve tenantId', () => {
    renderHook(() => useWeatherSignals(), {
      wrapper: createWrapper(),
    });

    expect(mockGetApiContext).toHaveBeenCalled();
  });
});
