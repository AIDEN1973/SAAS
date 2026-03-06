/**
 * useExecutionAudit Hook Unit Tests
 *
 * Test scope:
 * - useExecutionAuditRuns: query hook for fetching audit runs
 * - useExecutionAuditRun: query hook for fetching a single audit run
 * - useExecutionAuditSteps: query hook for fetching steps of a run
 * - fetchExecutionAuditSteps: exported standalone function
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
    invokeFunction: vi.fn(),
  },
  getApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
}));

vi.mock('@ui-core/react', () => ({
  // Type-only imports; no runtime values needed
}));

// ============================================================================
// Imports (after mocks due to hoisting)
// ============================================================================

import {
  useExecutionAuditRuns,
  useExecutionAuditRun,
  useExecutionAuditSteps,
  fetchExecutionAuditSteps,
} from '../useExecutionAudit';

// ============================================================================
// Test Helpers
// ============================================================================

const TENANT_ID = 'test-tenant-id';

const mockApiClient = apiSdk.apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  invokeFunction: ReturnType<typeof vi.fn>;
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

function createMockRun(overrides?: Record<string, unknown>) {
  return {
    id: 'run-1',
    tenant_id: TENANT_ID,
    occurred_at: '2026-03-01T09:00:00Z',
    created_at: '2026-03-01T09:00:00Z',
    operation_type: 'attendance.bulk_check_in',
    status: 'success' as const,
    source: 'manual' as const,
    actor_type: 'user' as const,
    actor_id: 'user-1',
    summary: 'Bulk attendance check-in completed',
    details: {},
    reference: { request_id: 'req-1' },
    counts: { success: 10, failed: 0 },
    duration_ms: 1200,
    ...overrides,
  };
}

function createMockStep(overrides?: Record<string, unknown>) {
  return {
    id: 'step-1',
    tenant_id: TENANT_ID,
    run_id: 'run-1',
    occurred_at: '2026-03-01T09:00:01Z',
    created_at: '2026-03-01T09:00:01Z',
    status: 'success' as const,
    target_type: 'student',
    target_id: 'student-1',
    summary: 'Checked in student-1',
    details: {},
    ...overrides,
  };
}

// ============================================================================
// Tests: useExecutionAuditRuns (Query Hook)
// ============================================================================

describe('useExecutionAuditRuns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns audit runs on success', async () => {
    const mockRuns = [createMockRun(), createMockRun({ id: 'run-2' })];

    mockApiClient.invokeFunction.mockResolvedValue({
      data: { items: mockRuns, has_more: false },
      error: null,
    });

    const { result } = renderHook(() => useExecutionAuditRuns(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.has_more).toBe(false);
    // Date strings should be converted to Date objects
    expect(result.current.data?.items[0].occurred_at).toBeInstanceOf(Date);
  });

  it('passes filters to the edge function', async () => {
    mockApiClient.invokeFunction.mockResolvedValue({
      data: { items: [], has_more: false },
      error: null,
    });

    const filters = {
      status: 'failed' as const,
      source: 'ai' as const,
      operation_type: 'attendance.bulk_check_in',
      searchQuery: 'check-in',
    };

    const { result } = renderHook(() => useExecutionAuditRuns(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.invokeFunction).toHaveBeenCalledWith(
      'execution-audit-runs',
      expect.objectContaining({
        status: 'failed',
        source: 'ai',
        operation_type: 'attendance.bulk_check_in',
        q: 'check-in',
        limit: '20',
      }),
    );
  });

  it('does not pass "all" filter values', async () => {
    mockApiClient.invokeFunction.mockResolvedValue({
      data: { items: [], has_more: false },
      error: null,
    });

    const filters = {
      status: 'all' as const,
      source: 'all' as const,
      operation_type: 'all',
    };

    const { result } = renderHook(() => useExecutionAuditRuns(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const callArgs = mockApiClient.invokeFunction.mock.calls[0][1];
    expect(callArgs.status).toBeUndefined();
    expect(callArgs.source).toBeUndefined();
    expect(callArgs.operation_type).toBeUndefined();
  });

  it('is disabled when tenantId is empty', async () => {
    vi.mocked(apiSdk.getApiContext).mockReturnValueOnce({
      tenantId: '',
      industryType: 'academy',
    } as ReturnType<typeof apiSdk.getApiContext>);

    const { result } = renderHook(() => useExecutionAuditRuns(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiClient.invokeFunction).not.toHaveBeenCalled();
  });

  it('throws on API error', async () => {
    mockApiClient.invokeFunction.mockResolvedValue({
      data: null,
      error: { message: 'Edge function error' },
    });

    const { result } = renderHook(() => useExecutionAuditRuns(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Edge function error');
  });
});

// ============================================================================
// Tests: useExecutionAuditRun (Single Run Query)
// ============================================================================

describe('useExecutionAuditRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a single run on success', async () => {
    const mockRun = createMockRun();

    mockApiClient.invokeFunction.mockResolvedValue({
      data: mockRun,
      error: null,
    });

    const { result } = renderHook(() => useExecutionAuditRun('run-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.id).toBe('run-1');
    expect(result.current.data?.occurred_at).toBeInstanceOf(Date);
  });

  it('is disabled when runId is null', async () => {
    const { result } = renderHook(() => useExecutionAuditRun(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiClient.invokeFunction).not.toHaveBeenCalled();
  });

  it('is disabled when tenantId is empty', async () => {
    vi.mocked(apiSdk.getApiContext).mockReturnValueOnce({
      tenantId: '',
      industryType: 'academy',
    } as ReturnType<typeof apiSdk.getApiContext>);

    const { result } = renderHook(() => useExecutionAuditRun('run-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiClient.invokeFunction).not.toHaveBeenCalled();
  });

  it('throws when run is not found', async () => {
    mockApiClient.invokeFunction.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => useExecutionAuditRun('missing-run'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Run not found');
  });
});

// ============================================================================
// Tests: useExecutionAuditSteps (Query Hook)
// ============================================================================

describe('useExecutionAuditSteps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns steps for a run on success', async () => {
    const mockSteps = [createMockStep(), createMockStep({ id: 'step-2', target_id: 'student-2' })];

    mockApiClient.invokeFunction.mockResolvedValue({
      data: { items: mockSteps, has_more: true, next_cursor: 'cursor-abc' },
      error: null,
    });

    const { result } = renderHook(() => useExecutionAuditSteps('run-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.has_more).toBe(true);
    expect(result.current.data?.next_cursor).toBe('cursor-abc');
    expect(result.current.data?.items[0].occurred_at).toBeInstanceOf(Date);
  });

  it('is disabled when runId is null', async () => {
    const { result } = renderHook(() => useExecutionAuditSteps(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiClient.invokeFunction).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Tests: fetchExecutionAuditSteps (Standalone Function)
// ============================================================================

describe('fetchExecutionAuditSteps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns steps on success', async () => {
    const mockSteps = [createMockStep()];

    mockApiClient.invokeFunction.mockResolvedValue({
      data: { items: mockSteps, has_more: false },
      error: null,
    });

    const result = await fetchExecutionAuditSteps(TENANT_ID, 'run-1');

    expect(result.items).toHaveLength(1);
    expect(result.has_more).toBe(false);
    expect(result.items[0].occurred_at).toBeInstanceOf(Date);
  });

  it('returns empty result when tenantId is empty', async () => {
    const result = await fetchExecutionAuditSteps('', 'run-1');

    expect(result).toEqual({ items: [], has_more: false });
    expect(mockApiClient.invokeFunction).not.toHaveBeenCalled();
  });

  it('returns empty result when runId is empty', async () => {
    const result = await fetchExecutionAuditSteps(TENANT_ID, '');

    expect(result).toEqual({ items: [], has_more: false });
    expect(mockApiClient.invokeFunction).not.toHaveBeenCalled();
  });

  it('passes cursor for pagination', async () => {
    mockApiClient.invokeFunction.mockResolvedValue({
      data: { items: [], has_more: false },
      error: null,
    });

    await fetchExecutionAuditSteps(TENANT_ID, 'run-1', 'cursor-abc');

    expect(mockApiClient.invokeFunction).toHaveBeenCalledWith(
      'execution-audit-runs',
      expect.objectContaining({
        run_id: 'run-1',
        cursor: 'cursor-abc',
        limit: '20',
      }),
    );
  });

  it('throws on API error', async () => {
    mockApiClient.invokeFunction.mockResolvedValue({
      data: null,
      error: { message: 'Steps fetch failed' },
    });

    await expect(fetchExecutionAuditSteps(TENANT_ID, 'run-1')).rejects.toThrow('Steps fetch failed');
  });
});
