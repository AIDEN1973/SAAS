/**
 * useDailyStoreMetrics Hook Unit Tests
 *
 * Tests:
 * - Successful data fetch with useQuery
 * - Query disabled when tenantId is missing
 * - Filter parameters passed correctly (date_kst)
 * - Empty array returned on API error (fallback)
 * - fetchDailyStoreMetrics standalone function
 * - tenant_id included in filter for API call
 * - Correct ordering (date_kst ascending)
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
  useDailyStoreMetrics,
  fetchDailyStoreMetrics,
} from '../useDailyStoreMetrics';
import type { DailyStoreMetric, DailyStoreMetricFilter } from '../useDailyStoreMetrics';

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

function createMockMetric(overrides?: Partial<DailyStoreMetric>): DailyStoreMetric {
  return {
    id: 'store-metric-1',
    tenant_id: 'test-tenant-id',
    store_id: 'store-1',
    student_count: 50,
    revenue: 5000000,
    attendance_rate: 92.3,
    new_enrollments: 5,
    late_rate: 3.2,
    absent_rate: 4.5,
    active_student_count: 45,
    inactive_student_count: 5,
    avg_students_per_class: 12,
    avg_capacity_rate: 85.0,
    arpu: 100000,
    date_kst: '2026-03-06',
    created_at: '2026-03-06T00:00:00Z',
    updated_at: '2026-03-06T00:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// Tests: useDailyStoreMetrics (Hook)
// ============================================================================

describe('useDailyStoreMetrics', () => {
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

  it('returns store metrics data on successful fetch', async () => {
    const { result } = renderHook(() => useDailyStoreMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].student_count).toBe(50);
    expect(result.current.data![0].revenue).toBe(5000000);
  });

  it('query is disabled when tenantId is missing', () => {
    mockGetApiContext.mockReturnValue({
      tenantId: '',
      industryType: 'academy',
    });

    const { result } = renderHook(() => useDailyStoreMetrics(), {
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

    const { result } = renderHook(() => useDailyStoreMetrics(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('includes tenant_id in API filters', async () => {
    const { result } = renderHook(() => useDailyStoreMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiGet).toHaveBeenCalledWith('daily_store_metrics', {
      filters: {
        tenant_id: 'test-tenant-id',
      },
      orderBy: { column: 'date_kst', ascending: true },
      limit: 100,
    });
  });

  it('passes date_kst filter correctly', async () => {
    const filter: DailyStoreMetricFilter = {
      date_kst: { gte: '2026-03-01', lte: '2026-03-06' },
    };

    const { result } = renderHook(() => useDailyStoreMetrics(filter), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiGet).toHaveBeenCalledWith('daily_store_metrics', {
      filters: {
        tenant_id: 'test-tenant-id',
        date_kst: { gte: '2026-03-01', lte: '2026-03-06' },
      },
      orderBy: { column: 'date_kst', ascending: true },
      limit: 100,
    });
  });

  it('returns empty array when API returns error', async () => {
    mockApiGet.mockResolvedValue({
      data: null,
      error: { message: 'Table not found' },
    });

    const { result } = renderHook(() => useDailyStoreMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('returns empty array when API throws exception', async () => {
    mockApiGet.mockRejectedValue(new Error('Network timeout'));

    const { result } = renderHook(() => useDailyStoreMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('returns multiple store metrics', async () => {
    mockApiGet.mockResolvedValue({
      data: [
        createMockMetric({ id: 'm1', date_kst: '2026-03-04' }),
        createMockMetric({ id: 'm2', date_kst: '2026-03-05' }),
        createMockMetric({ id: 'm3', date_kst: '2026-03-06' }),
      ],
      error: null,
    });

    const { result } = renderHook(() => useDailyStoreMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
  });

  it('returns empty array when API data is null', async () => {
    mockApiGet.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => useDailyStoreMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });
});

// ============================================================================
// Tests: fetchDailyStoreMetrics (standalone function)
// ============================================================================

describe('fetchDailyStoreMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({
      data: [createMockMetric()],
      error: null,
    });
  });

  it('returns metrics for valid tenantId', async () => {
    const result = await fetchDailyStoreMetrics('test-tenant-id');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('store-metric-1');
  });

  it('returns empty array for empty tenantId', async () => {
    const result = await fetchDailyStoreMetrics('');
    expect(result).toEqual([]);
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('returns empty array on API error response', async () => {
    mockApiGet.mockResolvedValue({
      data: null,
      error: { message: 'Permission denied' },
    });

    const result = await fetchDailyStoreMetrics('test-tenant-id');
    expect(result).toEqual([]);
  });

  it('returns empty array when API throws exception', async () => {
    mockApiGet.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await fetchDailyStoreMetrics('test-tenant-id');
    expect(result).toEqual([]);
  });
});
