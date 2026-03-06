/**
 * useDailyRegionMetrics Hook Unit Tests
 *
 * Tests:
 * - Successful data fetch with useQuery
 * - Query disabled when tenantId is missing
 * - Filter parameters passed correctly
 * - Empty array returned on API error (fallback)
 * - fetchDailyRegionMetrics standalone function
 * - Query key includes tenantId and filter
 * - Correct apiClient.get parameters
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockApiGet = vi.fn();
const mockGetApiContext = vi.fn(() => ({
  tenantId: 'test-tenant-id',
  industryType: 'academy',
}));

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockApiGet(...args),
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

import {
  useDailyRegionMetrics,
  fetchDailyRegionMetrics,
} from '../useDailyRegionMetrics';
import type { DailyRegionMetric, DailyRegionMetricFilter } from '../useDailyRegionMetrics';

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

function createMockMetric(overrides?: Partial<DailyRegionMetric>): DailyRegionMetric {
  return {
    id: 'metric-1',
    industry_type: 'academy',
    region_level: 'dong',
    region_code: '1168010100',
    date_kst: '2026-03-06',
    store_count: 15,
    active_members_avg: 42,
    active_members_median: 38,
    avg_attendance_rate: 92.5,
    created_at: '2026-03-06T00:00:00Z',
    updated_at: '2026-03-06T00:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// Tests: useDailyRegionMetrics (Hook)
// ============================================================================

describe('useDailyRegionMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiContext.mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
    mockApiGet.mockResolvedValue({
      data: [createMockMetric()],
      error: null,
    });
  });

  it('returns metrics data on successful fetch', async () => {
    const { result } = renderHook(() => useDailyRegionMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].region_level).toBe('dong');
  });

  it('query is disabled when tenantId is missing', () => {
    mockGetApiContext.mockReturnValue({
      tenantId: '',
      industryType: 'academy',
    });

    const { result } = renderHook(() => useDailyRegionMetrics(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('query is disabled when tenantId is undefined', () => {
    mockGetApiContext.mockReturnValue({
      tenantId: undefined,
      industryType: 'academy',
    });

    const { result } = renderHook(() => useDailyRegionMetrics(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('passes filter to queryFn correctly', async () => {
    const filter: DailyRegionMetricFilter = {
      industry_type: 'academy',
      region_level: 'gu_gun',
      region_code: '11680',
    };

    const { result } = renderHook(() => useDailyRegionMetrics(filter), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiGet).toHaveBeenCalledWith('daily_region_metrics', {
      filters: {
        industry_type: 'academy',
        region_level: 'gu_gun',
        region_code: '11680',
      },
      orderBy: { column: 'date_kst', ascending: false },
      limit: 100,
    });
  });

  it('passes date_kst filter correctly', async () => {
    const filter: DailyRegionMetricFilter = {
      date_kst: { gte: '2026-03-01', lte: '2026-03-06' },
    };

    const { result } = renderHook(() => useDailyRegionMetrics(filter), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiGet).toHaveBeenCalledWith('daily_region_metrics', {
      filters: {
        date_kst: { gte: '2026-03-01', lte: '2026-03-06' },
      },
      orderBy: { column: 'date_kst', ascending: false },
      limit: 100,
    });
  });

  it('returns empty array when API returns error', async () => {
    mockApiGet.mockResolvedValue({
      data: null,
      error: { message: 'Internal server error' },
    });

    const { result } = renderHook(() => useDailyRegionMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('returns empty array when API throws an exception', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDailyRegionMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('returns multiple metrics', async () => {
    mockApiGet.mockResolvedValue({
      data: [
        createMockMetric({ id: 'm1', region_code: '1168010100' }),
        createMockMetric({ id: 'm2', region_code: '1168010200' }),
        createMockMetric({ id: 'm3', region_code: '1168010300' }),
      ],
      error: null,
    });

    const { result } = renderHook(() => useDailyRegionMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
  });
});

// ============================================================================
// Tests: fetchDailyRegionMetrics (standalone function)
// ============================================================================

describe('fetchDailyRegionMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({
      data: [createMockMetric()],
      error: null,
    });
  });

  it('returns metrics for valid tenantId', async () => {
    const result = await fetchDailyRegionMetrics('test-tenant-id');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('metric-1');
  });

  it('returns empty array for empty tenantId', async () => {
    const result = await fetchDailyRegionMetrics('');
    expect(result).toEqual([]);
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('returns empty array on API error response', async () => {
    mockApiGet.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    const result = await fetchDailyRegionMetrics('test-tenant-id');
    expect(result).toEqual([]);
  });

  it('returns empty array when API throws exception', async () => {
    mockApiGet.mockRejectedValue(new Error('Connection refused'));

    const result = await fetchDailyRegionMetrics('test-tenant-id');
    expect(result).toEqual([]);
  });
});
