/**
 * usePayments Hook Unit Tests
 *
 * Test targets:
 * - usePayments: React Query hook for fetching payment history
 * - fetchPayments: standalone query function for payment data retrieval
 *
 * [SSOT] api-sdk mediated data access only
 * [SSOT] tenant isolation via getApiContext
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { ReactNode } from 'react';

// ===== Hoisted mock variables =====
const {
  mockApiGet,
  mockGetApiContext,
} = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockGetApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
}));

// ===== Module mocks =====
vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: mockApiGet,
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    callRPC: vi.fn(),
  },
  getApiContext: mockGetApiContext,
}));

// Import AFTER mocks
import {
  usePayments,
  fetchPayments,
} from '../usePayments';
import type {
  Payment,
  PaymentFilter,
} from '../usePayments';

// ===== Test Wrapper =====
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

// ===== Mock Data =====
const mockPayments: Payment[] = [
  {
    id: 'payment-1',
    invoice_id: 'invoice-1',
    student_id: 'student-1',
    amount: 300000,
    status: 'completed',
    payment_method: 'card',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:05:00Z',
  },
  {
    id: 'payment-2',
    invoice_id: 'invoice-2',
    student_id: 'student-1',
    amount: 150000,
    status: 'pending',
    payment_method: 'account',
    created_at: '2026-03-02T00:00:00Z',
    updated_at: '2026-03-02T00:00:00Z',
  },
  {
    id: 'payment-3',
    invoice_id: 'invoice-3',
    student_id: 'student-2',
    amount: 50000,
    status: 'failed',
    payment_method: 'card',
    created_at: '2026-02-28T00:00:00Z',
    updated_at: '2026-02-28T00:03:00Z',
  },
];

// ============================================================================
// fetchPayments Tests
// ============================================================================

describe('fetchPayments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches all payments without filter', async () => {
    mockApiGet.mockResolvedValue({
      data: mockPayments,
      error: null,
    });

    const result = await fetchPayments('test-tenant-id');

    expect(mockApiGet).toHaveBeenCalledWith('payments', {
      filters: {},
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
    expect(result).toEqual(mockPayments);
  });

  it('returns empty array when tenantId is empty', async () => {
    const result = await fetchPayments('');

    expect(result).toEqual([]);
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('applies status filter', async () => {
    mockApiGet.mockResolvedValue({
      data: [mockPayments[0]],
      error: null,
    });

    const filter: PaymentFilter = { status: 'completed' };
    const result = await fetchPayments('test-tenant-id', filter);

    expect(mockApiGet).toHaveBeenCalledWith('payments', {
      filters: { status: 'completed' },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('completed');
  });

  it('applies student_id filter', async () => {
    mockApiGet.mockResolvedValue({
      data: [mockPayments[0], mockPayments[1]],
      error: null,
    });

    const filter: PaymentFilter = { student_id: 'student-1' };
    const result = await fetchPayments('test-tenant-id', filter);

    expect(mockApiGet).toHaveBeenCalledWith('payments', {
      filters: { student_id: 'student-1' },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
    expect(result).toHaveLength(2);
  });

  it('applies invoice_id filter', async () => {
    mockApiGet.mockResolvedValue({
      data: [mockPayments[0]],
      error: null,
    });

    const filter: PaymentFilter = { invoice_id: 'invoice-1' };
    await fetchPayments('test-tenant-id', filter);

    expect(mockApiGet).toHaveBeenCalledWith('payments', {
      filters: { invoice_id: 'invoice-1' },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
  });

  it('applies created_at date range filter', async () => {
    mockApiGet.mockResolvedValue({
      data: mockPayments,
      error: null,
    });

    const filter: PaymentFilter = {
      created_at: { gte: '2026-03-01', lte: '2026-03-31' },
    };
    await fetchPayments('test-tenant-id', filter);

    expect(mockApiGet).toHaveBeenCalledWith('payments', {
      filters: {
        created_at: { gte: '2026-03-01', lte: '2026-03-31' },
      },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
  });

  it('applies multiple filters simultaneously', async () => {
    mockApiGet.mockResolvedValue({
      data: [mockPayments[0]],
      error: null,
    });

    const filter: PaymentFilter = {
      status: 'completed',
      student_id: 'student-1',
      invoice_id: 'invoice-1',
    };
    await fetchPayments('test-tenant-id', filter);

    expect(mockApiGet).toHaveBeenCalledWith('payments', {
      filters: {
        status: 'completed',
        student_id: 'student-1',
        invoice_id: 'invoice-1',
      },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
  });

  it('throws error on API failure', async () => {
    mockApiGet.mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
    });

    await expect(fetchPayments('test-tenant-id')).rejects.toThrow(
      'Database connection failed'
    );
  });

  it('returns empty array when data is null', async () => {
    mockApiGet.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await fetchPayments('test-tenant-id');
    expect(result).toEqual([]);
  });
});

// ============================================================================
// usePayments Hook Tests
// ============================================================================

describe('usePayments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiContext.mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('fetches payments successfully on mount', async () => {
    mockApiGet.mockResolvedValue({
      data: mockPayments,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePayments(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockPayments);
  });

  it('applies filter parameter to query', async () => {
    mockApiGet.mockResolvedValue({
      data: [mockPayments[1]],
      error: null,
    });

    const { wrapper } = createWrapper();
    const filter: PaymentFilter = { status: 'pending' };
    const { result } = renderHook(() => usePayments(filter), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].status).toBe('pending');
  });

  it('does not execute query when tenantId is missing', async () => {
    mockGetApiContext.mockReturnValue({ tenantId: null, industryType: 'academy' });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePayments(), { wrapper });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockApiGet).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
  });

  it('does not execute query when tenantId is empty string', async () => {
    mockGetApiContext.mockReturnValue({ tenantId: '', industryType: 'academy' });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePayments(), { wrapper });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('handles API error state', async () => {
    mockApiGet.mockResolvedValue({
      data: null,
      error: { message: 'Service unavailable' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePayments(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('Service unavailable');
  });

  it('includes tenantId and filter in query key', async () => {
    mockApiGet.mockResolvedValue({
      data: [],
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const filter: PaymentFilter = { status: 'completed' };
    renderHook(() => usePayments(filter), { wrapper });

    await waitFor(() => {
      // Check that query cache contains the expected key
      const queries = queryClient.getQueryCache().findAll();
      expect(queries.length).toBeGreaterThan(0);
      const queryKey = queries[0].queryKey;
      expect(queryKey).toEqual(['payments', 'test-tenant-id', filter]);
    });
  });

  it('returns loading state initially', () => {
    mockApiGet.mockReturnValue(new Promise(() => {})); // Never resolves

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePayments(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('works across different industry types', async () => {
    const industries = ['academy', 'gym', 'music'] as const;

    for (const industry of industries) {
      mockGetApiContext.mockReturnValue({
        tenantId: `${industry}-tenant-id`,
        industryType: industry,
      });

      mockApiGet.mockResolvedValue({
        data: mockPayments,
        error: null,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => usePayments(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockPayments);
    }
  });

  it('filters by failed status', async () => {
    mockApiGet.mockResolvedValue({
      data: [mockPayments[2]],
      error: null,
    });

    const { wrapper } = createWrapper();
    const filter: PaymentFilter = { status: 'failed' };
    const { result } = renderHook(() => usePayments(filter), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].status).toBe('failed');
  });

  it('returns empty array when no payments match filter', async () => {
    mockApiGet.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();
    const filter: PaymentFilter = { status: 'cancelled' };
    const { result } = renderHook(() => usePayments(filter), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });
});
