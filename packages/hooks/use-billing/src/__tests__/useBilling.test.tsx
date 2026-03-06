/**
 * useBilling Hook Unit Tests
 *
 * Test targets:
 * - useBillingHistory: React Query hook for billing history
 * - useInvoice: React Query hook for single invoice
 * - useProcessPayment: Mutation hook for payment processing
 * - fetchBillingHistory: standalone query function
 *
 * [SSOT] api-sdk mediated data access only
 * [SSOT] Execution Audit integration for payment processing
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
  mockApiPost,
  mockGetApiContext,
  mockUseSession,
  mockCreateExecutionAuditRecord,
} = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockGetApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
  mockUseSession: vi.fn(() => ({
    data: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
      },
    },
  })),
  mockCreateExecutionAuditRecord: vi.fn().mockResolvedValue(undefined),
}));

// ===== Module mocks =====
vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: mockApiGet,
    post: mockApiPost,
    patch: vi.fn(),
    delete: vi.fn(),
    callRPC: vi.fn(),
  },
  getApiContext: mockGetApiContext,
}));

vi.mock('@hooks/use-auth', () => ({
  useSession: mockUseSession,
}));

vi.mock('@hooks/use-student/src/execution-audit-utils', () => ({
  createExecutionAuditRecord: mockCreateExecutionAuditRecord,
}));

// Import AFTER mocks
import {
  useBillingHistory,
  useInvoice,
  useProcessPayment,
  fetchBillingHistory,
} from '../useBilling';
import type {
  BillingHistoryItem,
  PaymentInput,
} from '../useBilling';

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
const mockInvoices: BillingHistoryItem[] = [
  {
    id: 'invoice-1',
    student_id: 'student-1',
    student_name: 'Student 1',
    title: '2024-01 tuition',
    amount: 300000,
    amount_paid: 300000,
    amount_due: 0,
    status: 'paid',
    period_start: '2024-01-01',
    period_end: '2024-01-31',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-05T00:00:00Z',
  },
  {
    id: 'invoice-2',
    student_id: 'student-1',
    student_name: 'Student 1',
    title: '2024-02 tuition',
    amount: 300000,
    amount_paid: 0,
    amount_due: 300000,
    status: 'pending',
    period_start: '2024-02-01',
    period_end: '2024-02-29',
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-02-01T00:00:00Z',
  },
];

// ============================================================================
// fetchBillingHistory Tests
// ============================================================================

describe('fetchBillingHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches billing history without filter', async () => {
    mockApiGet.mockResolvedValue({
      data: mockInvoices,
      error: null,
    });

    const result = await fetchBillingHistory('test-tenant-id');

    expect(mockApiGet).toHaveBeenCalledWith('invoices', {
      filters: {},
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
    expect(result).toEqual(mockInvoices);
  });

  it('applies student_id filter', async () => {
    mockApiGet.mockResolvedValue({
      data: [mockInvoices[0]],
      error: null,
    });

    const filter = { student_id: 'student-1' };
    const result = await fetchBillingHistory('test-tenant-id', filter);

    expect(mockApiGet).toHaveBeenCalledWith('invoices', {
      filters: { student_id: 'student-1' },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
    expect(result).toHaveLength(1);
  });

  it('applies status filter', async () => {
    mockApiGet.mockResolvedValue({
      data: [mockInvoices[0]],
      error: null,
    });

    const filter = { status: 'paid' as const };
    const result = await fetchBillingHistory('test-tenant-id', filter);

    expect(mockApiGet).toHaveBeenCalledWith('invoices', {
      filters: { status: 'paid' },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
    expect(result[0].status).toBe('paid');
  });

  it('applies period_start date range filter', async () => {
    mockApiGet.mockResolvedValue({
      data: mockInvoices,
      error: null,
    });

    const filter = {
      period_start: { gte: '2024-01-01', lte: '2024-12-31' },
    };
    await fetchBillingHistory('test-tenant-id', filter);

    expect(mockApiGet).toHaveBeenCalledWith('invoices', {
      filters: {
        period_start: { gte: '2024-01-01', lte: '2024-12-31' },
      },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
  });

  it('applies multiple filters simultaneously', async () => {
    mockApiGet.mockResolvedValue({
      data: [mockInvoices[0]],
      error: null,
    });

    const filter = {
      student_id: 'student-1',
      status: 'paid' as const,
    };
    await fetchBillingHistory('test-tenant-id', filter);

    expect(mockApiGet).toHaveBeenCalledWith('invoices', {
      filters: {
        student_id: 'student-1',
        status: 'paid',
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

    await expect(fetchBillingHistory('test-tenant-id')).rejects.toThrow(
      'Database connection failed'
    );
  });

  it('returns empty array when data is null', async () => {
    mockApiGet.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await fetchBillingHistory('test-tenant-id');
    expect(result).toEqual([]);
  });
});

// ============================================================================
// useBillingHistory Hook Tests
// ============================================================================

describe('useBillingHistory', () => {
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

  it('fetches billing history successfully', async () => {
    mockApiGet.mockResolvedValue({
      data: mockInvoices,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBillingHistory(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockInvoices);
  });

  it('applies filter parameter', async () => {
    mockApiGet.mockResolvedValue({
      data: [mockInvoices[1]],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useBillingHistory({ status: 'pending' }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].status).toBe('pending');
  });

  it('does not execute query when tenantId is missing', async () => {
    mockGetApiContext.mockReturnValue({ tenantId: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBillingHistory(), { wrapper });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockApiGet).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
  });

  it('handles API error state', async () => {
    mockApiGet.mockResolvedValue({
      data: null,
      error: { message: 'Service unavailable' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBillingHistory(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Service unavailable');
  });
});

// ============================================================================
// useInvoice Hook Tests
// ============================================================================

describe('useInvoice', () => {
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

  it('fetches a specific invoice successfully', async () => {
    mockApiGet.mockResolvedValue({
      data: [mockInvoices[0]],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvoice('invoice-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledWith('invoices/invoice-1');
    expect(result.current.data).toEqual([mockInvoices[0]]);
  });

  it('does not execute when invoiceId is undefined', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvoice(), { wrapper });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockApiGet).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
  });

  it('does not execute when tenantId is missing', async () => {
    mockGetApiContext.mockReturnValue({ tenantId: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvoice('invoice-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('handles API error', async () => {
    mockApiGet.mockResolvedValue({
      data: null,
      error: { message: 'Invoice not found' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvoice('invoice-999'), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Invoice not found');
  });

  it('returns empty array when data is null', async () => {
    mockApiGet.mockResolvedValue({
      data: null,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvoice('invoice-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });
});

// ============================================================================
// useProcessPayment Hook Tests
// ============================================================================

describe('useProcessPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiContext.mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('processes payment successfully', async () => {
    const mockPaymentResult = {
      success: true,
      paymentId: 'payment-123',
      receiptUrl: 'https://example.com/receipt/123',
    };

    mockApiPost.mockResolvedValue({
      data: mockPaymentResult,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProcessPayment(), { wrapper });

    const paymentInput: PaymentInput = {
      invoiceId: 'invoice-1',
      paymentMethod: 'card',
      amount: 300000,
      cardInfo: {
        number: '1234-5678-9012-3456',
        expiry: '12/25',
        cvc: '123',
        password: '12',
      },
    };

    await result.current.mutateAsync(paymentInput);

    expect(mockApiPost).toHaveBeenCalledWith(
      'functions/v1/fns-payment-process',
      paymentInput
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockPaymentResult);
  });

  it('handles payment failure response', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        success: false,
        error: 'Card declined',
      },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProcessPayment(), { wrapper });

    const paymentInput: PaymentInput = {
      invoiceId: 'invoice-1',
      paymentMethod: 'card',
      amount: 300000,
    };

    await result.current.mutateAsync(paymentInput);

    await waitFor(() => {
      expect(result.current.data?.success).toBe(false);
    });

    expect(result.current.data?.error).toBe('Card declined');
  });

  it('returns error result on API error', async () => {
    mockApiPost.mockResolvedValue({
      data: null,
      error: { message: 'Gateway timeout' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProcessPayment(), { wrapper });

    const paymentInput: PaymentInput = {
      invoiceId: 'invoice-1',
      paymentMethod: 'simple',
      amount: 100000,
    };

    await result.current.mutateAsync(paymentInput);

    await waitFor(() => {
      expect(result.current.data?.success).toBe(false);
    });

    expect(result.current.data?.error).toBe('Gateway timeout');
  });

  it('creates Execution Audit record on successful payment', async () => {
    mockApiPost.mockResolvedValue({
      data: { success: true, paymentId: 'payment-123' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProcessPayment(), { wrapper });

    const paymentInput: PaymentInput = {
      invoiceId: 'invoice-1',
      paymentMethod: 'simple',
      amount: 300000,
    };

    await result.current.mutateAsync(paymentInput);

    expect(mockCreateExecutionAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        operation_type: 'payment.process',
        status: 'success',
        details: expect.objectContaining({
          invoice_id: 'invoice-1',
          payment_method: 'simple',
          amount: 300000,
        }),
        reference: {
          entity_type: 'invoice',
          entity_id: 'invoice-1',
        },
      }),
      'test-user-id'
    );
  });

  it('creates Execution Audit record on failed payment', async () => {
    mockApiPost.mockResolvedValue({
      data: null,
      error: { message: 'Payment rejected' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProcessPayment(), { wrapper });

    const paymentInput: PaymentInput = {
      invoiceId: 'invoice-2',
      paymentMethod: 'card',
      amount: 200000,
    };

    await result.current.mutateAsync(paymentInput);

    expect(mockCreateExecutionAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        operation_type: 'payment.process',
        status: 'failed',
        error_code: 'PAYMENT_FAILED',
        error_summary: 'Payment rejected',
      }),
      'test-user-id'
    );
  });

  it('includes duration_ms in audit record', async () => {
    mockApiPost.mockResolvedValue({
      data: { success: true, paymentId: 'payment-123' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProcessPayment(), { wrapper });

    await result.current.mutateAsync({
      invoiceId: 'invoice-1',
      paymentMethod: 'card',
      amount: 100000,
    });

    expect(mockCreateExecutionAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        duration_ms: expect.any(Number),
      }),
      'test-user-id'
    );
  });

  it('skips audit record when user session is missing', async () => {
    mockUseSession.mockReturnValue({ data: null });

    mockApiPost.mockResolvedValue({
      data: { success: true, paymentId: 'payment-123' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProcessPayment(), { wrapper });

    await result.current.mutateAsync({
      invoiceId: 'invoice-1',
      paymentMethod: 'card',
      amount: 100000,
    });

    expect(mockCreateExecutionAuditRecord).not.toHaveBeenCalled();
  });

  it('returns unknown error when data and error are both null', async () => {
    mockApiPost.mockResolvedValue({
      data: null,
      error: null,
    });

    // No user session so no audit record
    mockUseSession.mockReturnValue({ data: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProcessPayment(), { wrapper });

    await result.current.mutateAsync({
      invoiceId: 'invoice-1',
      paymentMethod: 'card',
      amount: 100000,
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ success: false, error: '알 수 없는 오류' });
    });
  });
});

// ============================================================================
// Industry Neutrality Tests
// ============================================================================

describe('Industry neutrality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('works identically across different industry types', async () => {
    const industries = ['academy', 'gym', 'music', 'art', 'dance'] as const;

    for (const industry of industries) {
      mockGetApiContext.mockReturnValue({
        tenantId: `${industry}-tenant-id`,
        industryType: industry,
      });

      mockApiGet.mockResolvedValue({
        data: mockInvoices,
        error: null,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useBillingHistory(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockInvoices);
    }
  });
});
