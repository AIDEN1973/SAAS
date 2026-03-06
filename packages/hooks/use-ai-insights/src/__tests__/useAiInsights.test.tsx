/**
 * useAIInsights Hook Unit Tests
 *
 * Test scope:
 * - useAIInsights: query hook for fetching AI insights
 * - fetchAIInsights: exported standalone function
 * - useDismissAIInsight: mutation hook for dismissing an insight
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import * as apiSdk from '@api-sdk/core';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
}));

// ============================================================================
// Imports (after mocks due to hoisting)
// ============================================================================

import {
  useAIInsights,
  fetchAIInsights,
  useDismissAIInsight,
} from '../useAIInsights';
import type { AIInsight, AIInsightFilter } from '../useAIInsights';

// ============================================================================
// Test Helpers
// ============================================================================

const TENANT_ID = 'test-tenant-id';

const mockApiClient = apiSdk.apiClient as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

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

function createMockInsight(overrides?: Partial<AIInsight>): AIInsight {
  return {
    id: 'insight-1',
    tenant_id: TENANT_ID,
    insight_type: 'weekly_briefing',
    title: 'Weekly Attendance Briefing',
    summary: 'Attendance rate is 95% this week.',
    insights: ['High attendance this week', 'Two new enrollments'],
    details: { attendance_rate: 0.95 },
    metadata: {},
    status: 'active',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// Tests: fetchAIInsights (Standalone Function)
// ============================================================================

describe('fetchAIInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns insights on success', async () => {
    const mockInsights = [createMockInsight(), createMockInsight({ id: 'insight-2' })];

    mockApiClient.get.mockResolvedValue({
      data: mockInsights,
      error: null,
    });

    const result = await fetchAIInsights(TENANT_ID);

    expect(result).toEqual(mockInsights);
    expect(mockApiClient.get).toHaveBeenCalledWith('ai_insights', {
      filters: {},
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
  });

  it('returns empty array when tenantId is empty', async () => {
    const result = await fetchAIInsights('');

    expect(result).toEqual([]);
    expect(mockApiClient.get).not.toHaveBeenCalled();
  });

  it('applies insight_type filter', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    await fetchAIInsights(TENANT_ID, { insight_type: 'attendance_anomaly' });

    expect(mockApiClient.get).toHaveBeenCalledWith('ai_insights', {
      filters: { insight_type: 'attendance_anomaly' },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
  });

  it('applies status filter', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    await fetchAIInsights(TENANT_ID, { status: 'dismissed' });

    expect(mockApiClient.get).toHaveBeenCalledWith('ai_insights', {
      filters: { status: 'dismissed' },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
  });

  it('applies student_id filter', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    await fetchAIInsights(TENANT_ID, { student_id: 'student-1' });

    expect(mockApiClient.get).toHaveBeenCalledWith('ai_insights', {
      filters: { student_id: 'student-1' },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
  });

  it('applies created_at date range filter', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    const filter: AIInsightFilter = {
      created_at: { gte: '2026-03-01', lte: '2026-03-31' },
    };

    await fetchAIInsights(TENANT_ID, filter);

    expect(mockApiClient.get).toHaveBeenCalledWith('ai_insights', {
      filters: { created_at: { gte: '2026-03-01', lte: '2026-03-31' } },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
  });

  it('returns empty array on null data', async () => {
    mockApiClient.get.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await fetchAIInsights(TENANT_ID);

    expect(result).toEqual([]);
  });

  it('throws on API error', async () => {
    mockApiClient.get.mockResolvedValue({
      data: null,
      error: { message: 'Permission denied' },
    });

    await expect(fetchAIInsights(TENANT_ID)).rejects.toThrow('Permission denied');
  });
});

// ============================================================================
// Tests: useAIInsights (Query Hook)
// ============================================================================

describe('useAIInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns insight data on success', async () => {
    const mockInsights = [createMockInsight()];

    mockApiClient.get.mockResolvedValue({
      data: mockInsights,
      error: null,
    });

    const { result } = renderHook(() => useAIInsights(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockInsights);
  });

  it('passes filter to fetchAIInsights', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    const filter: AIInsightFilter = { insight_type: 'risk_analysis', status: 'active' };

    const { result } = renderHook(() => useAIInsights(filter), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.get).toHaveBeenCalledWith('ai_insights', {
      filters: { insight_type: 'risk_analysis', status: 'active' },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
  });

  it('is disabled when tenantId is empty', async () => {
    vi.mocked(apiSdk.getApiContext).mockReturnValueOnce({
      tenantId: '',
      industryType: 'academy',
    } as ReturnType<typeof apiSdk.getApiContext>);

    const { result } = renderHook(() => useAIInsights(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiClient.get).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Tests: useDismissAIInsight (Mutation Hook)
// ============================================================================

describe('useDismissAIInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dismisses an insight on success', async () => {
    const dismissedInsight = createMockInsight({ status: 'dismissed' });

    mockApiClient.patch.mockResolvedValue({
      data: dismissedInsight,
      error: null,
    });

    const { result } = renderHook(() => useDismissAIInsight(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('insight-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(dismissedInsight);
    expect(mockApiClient.patch).toHaveBeenCalledWith(
      'ai_insights',
      'insight-1',
      expect.objectContaining({ status: 'dismissed', updated_at: expect.any(String) }),
    );
  });

  it('fails on API error', async () => {
    mockApiClient.patch.mockResolvedValue({
      data: null,
      error: { message: 'Insight not found' },
    });

    const { result } = renderHook(() => useDismissAIInsight(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('nonexistent');

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Insight not found');
  });

  it('throws when tenantId is missing', async () => {
    vi.mocked(apiSdk.getApiContext).mockReturnValue({
      tenantId: '',
      industryType: 'academy',
    } as ReturnType<typeof apiSdk.getApiContext>);

    const { result } = renderHook(() => useDismissAIInsight(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('insight-1');

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Tenant ID is required');
  });
});
