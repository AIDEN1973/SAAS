/**
 * useWeatherSignals Extended Tests
 *
 * Coverage target: 50% -> 80%+
 * Additional coverage for:
 * - Heavy rain detection (rain + heavy intensity)
 * - Heavy snow detection (snow + heavy intensity)
 * - Storm detection
 * - Normal weather (rain + light/moderate)
 * - Snow with light/moderate intensity
 * - useMemo branches with weather data
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

// We need to intercept useQuery to provide weather data
// The internal queryFn always returns null, so we mock useQuery to inject weather data
const mockUseQuery = vi.fn();

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

// We need to test the useMemo branches that process weather data.
// Since the queryFn always returns null, we mock @tanstack/react-query to control the data.
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: (options: Record<string, unknown>) => {
      // Call the real mockUseQuery to get test-controlled data
      const override = mockUseQuery(options);
      if (override !== undefined) {
        return override;
      }
      // Default behavior: call the real useQuery
      return actual.useQuery(options as Parameters<typeof actual.useQuery>[0]);
    },
  };
});

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { useWeatherSignals } from '../useWeatherSignals';

// ============================================================================
// Test Helpers
// ============================================================================

function createWrapper() {
  const { QueryClient: QC, QueryClientProvider: QCP } = require('@tanstack/react-query');
  const queryClient = new QC({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QCP, { client: queryClient }, children);
}

// ============================================================================
// Tests
// ============================================================================

describe('useWeatherSignals Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiContext.mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
  });

  describe('weather condition detection', () => {
    it('detects heavy rain and returns appropriate banner hint', () => {
      mockUseQuery.mockReturnValue({
        data: { condition: 'rain', intensity: 'heavy' },
        isLoading: false,
        isError: false,
      });

      const { result } = renderHook(() => useWeatherSignals(), {
        wrapper: createWrapper(),
      });

      expect(result.current.weatherSignals.condition).toBe('heavy_rain');
      expect(result.current.weatherSignals.intensity).toBe('heavy');
      expect(result.current.weatherSignals.bannerHint).toContain('비가 많이');
    });

    it('detects heavy snow and returns appropriate banner hint', () => {
      mockUseQuery.mockReturnValue({
        data: { condition: 'snow', intensity: 'heavy' },
        isLoading: false,
        isError: false,
      });

      const { result } = renderHook(() => useWeatherSignals(), {
        wrapper: createWrapper(),
      });

      expect(result.current.weatherSignals.condition).toBe('heavy_snow');
      expect(result.current.weatherSignals.intensity).toBe('heavy');
      expect(result.current.weatherSignals.bannerHint).toContain('눈이 많이');
    });

    it('detects storm and returns appropriate banner hint', () => {
      mockUseQuery.mockReturnValue({
        data: { condition: 'storm', intensity: 'heavy' },
        isLoading: false,
        isError: false,
      });

      const { result } = renderHook(() => useWeatherSignals(), {
        wrapper: createWrapper(),
      });

      expect(result.current.weatherSignals.condition).toBe('storm');
      expect(result.current.weatherSignals.intensity).toBe('heavy');
      expect(result.current.weatherSignals.bannerHint).toContain('폭풍');
    });

    it('returns null signals for normal weather (rain + light)', () => {
      mockUseQuery.mockReturnValue({
        data: { condition: 'rain', intensity: 'light' },
        isLoading: false,
        isError: false,
      });

      const { result } = renderHook(() => useWeatherSignals(), {
        wrapper: createWrapper(),
      });

      expect(result.current.weatherSignals.condition).toBeNull();
      expect(result.current.weatherSignals.intensity).toBeNull();
      expect(result.current.weatherSignals.bannerHint).toBeNull();
    });

    it('returns null signals for normal weather (rain + moderate)', () => {
      mockUseQuery.mockReturnValue({
        data: { condition: 'rain', intensity: 'moderate' },
        isLoading: false,
        isError: false,
      });

      const { result } = renderHook(() => useWeatherSignals(), {
        wrapper: createWrapper(),
      });

      expect(result.current.weatherSignals.condition).toBeNull();
    });

    it('returns null signals for normal weather (snow + light)', () => {
      mockUseQuery.mockReturnValue({
        data: { condition: 'snow', intensity: 'light' },
        isLoading: false,
        isError: false,
      });

      const { result } = renderHook(() => useWeatherSignals(), {
        wrapper: createWrapper(),
      });

      expect(result.current.weatherSignals.condition).toBeNull();
    });

    it('returns null signals for normal weather (snow + moderate)', () => {
      mockUseQuery.mockReturnValue({
        data: { condition: 'snow', intensity: 'moderate' },
        isLoading: false,
        isError: false,
      });

      const { result } = renderHook(() => useWeatherSignals(), {
        wrapper: createWrapper(),
      });

      expect(result.current.weatherSignals.condition).toBeNull();
    });

    it('returns null signals for normal weather condition', () => {
      mockUseQuery.mockReturnValue({
        data: { condition: 'normal', intensity: 'light' },
        isLoading: false,
        isError: false,
      });

      const { result } = renderHook(() => useWeatherSignals(), {
        wrapper: createWrapper(),
      });

      expect(result.current.weatherSignals.condition).toBeNull();
      expect(result.current.weatherSignals.bannerHint).toBeNull();
    });

    it('returns null signals when weather data is null', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
      });

      const { result } = renderHook(() => useWeatherSignals(), {
        wrapper: createWrapper(),
      });

      expect(result.current.weatherSignals).toEqual({
        condition: null,
        intensity: null,
        bannerHint: null,
      });
    });

    it('detects storm regardless of intensity', () => {
      mockUseQuery.mockReturnValue({
        data: { condition: 'storm', intensity: 'moderate' },
        isLoading: false,
        isError: false,
      });

      const { result } = renderHook(() => useWeatherSignals(), {
        wrapper: createWrapper(),
      });

      expect(result.current.weatherSignals.condition).toBe('storm');
      // Storm always returns heavy intensity
      expect(result.current.weatherSignals.intensity).toBe('heavy');
    });
  });
});
