/**
 * useInvoiceItems Hook Unit Tests
 *
 * Test coverage:
 * - fetchInvoiceItems: standalone async function (success/error/empty/filter cases)
 * - useInvoiceItems: React Query hook (enabled/disabled, data flow)
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
    callRPC: vi.fn(),
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
  useInvoiceItems,
  fetchInvoiceItems,
} from '../useInvoiceItems';
import type { InvoiceItem, InvoiceItemFilter } from '../useInvoiceItems';

// ============================================================================
// Test Helpers
// ============================================================================

const TENANT_ID = 'test-tenant-id';

const mockApiClient = apiSdk.apiClient as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  callRPC: ReturnType<typeof vi.fn>;
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

function createMockInvoiceItem(overrides?: Partial<InvoiceItem>): InvoiceItem {
  return {
    id: 'item-1',
    invoice_id: 'invoice-1',
    product_id: 'product-1',
    product_name: 'Monthly Tuition',
    quantity: 1,
    unit_price: 300000,
    total_price: 300000,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// Tests: fetchInvoiceItems (standalone function)
// ============================================================================

describe('fetchInvoiceItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns invoice items on success', async () => {
    const mockItems = [
      createMockInvoiceItem(),
      createMockInvoiceItem({ id: 'item-2', product_name: 'Extra Fee' }),
    ];

    mockApiClient.get.mockResolvedValue({
      data: mockItems,
      error: null,
    });

    const result = await fetchInvoiceItems(TENANT_ID);

    expect(result).toEqual(mockItems);
    expect(mockApiClient.get).toHaveBeenCalledWith('invoice_items', {
      filters: {},
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
  });

  it('returns empty array when tenantId is empty', async () => {
    const result = await fetchInvoiceItems('');

    expect(result).toEqual([]);
    expect(mockApiClient.get).not.toHaveBeenCalled();
  });

  it('applies invoice_id filter', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    await fetchInvoiceItems(TENANT_ID, { invoice_id: 'inv-123' });

    expect(mockApiClient.get).toHaveBeenCalledWith('invoice_items', {
      filters: { invoice_id: 'inv-123' },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
  });

  it('applies product_id filter', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    await fetchInvoiceItems(TENANT_ID, { product_id: 'prod-456' });

    expect(mockApiClient.get).toHaveBeenCalledWith('invoice_items', {
      filters: { product_id: 'prod-456' },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
  });

  it('applies created_at date range filter', async () => {
    const dateFilter: InvoiceItemFilter = {
      created_at: { gte: '2026-01-01', lte: '2026-01-31' },
    };

    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    await fetchInvoiceItems(TENANT_ID, dateFilter);

    expect(mockApiClient.get).toHaveBeenCalledWith('invoice_items', {
      filters: { created_at: { gte: '2026-01-01', lte: '2026-01-31' } },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
  });

  it('applies multiple filters simultaneously', async () => {
    const filter: InvoiceItemFilter = {
      invoice_id: 'inv-123',
      product_id: 'prod-456',
      created_at: { gte: '2026-01-01' },
    };

    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    await fetchInvoiceItems(TENANT_ID, filter);

    expect(mockApiClient.get).toHaveBeenCalledWith('invoice_items', {
      filters: {
        invoice_id: 'inv-123',
        product_id: 'prod-456',
        created_at: { gte: '2026-01-01' },
      },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
  });

  it('returns empty array when table does not exist (graceful)', async () => {
    mockApiClient.get.mockResolvedValue({
      data: null,
      error: { message: 'relation "invoice_items" does not exist' },
    });

    const result = await fetchInvoiceItems(TENANT_ID);

    expect(result).toEqual([]);
  });

  it('throws error for non-table-missing errors', async () => {
    mockApiClient.get.mockResolvedValue({
      data: null,
      error: { message: 'Permission denied' },
    });

    await expect(fetchInvoiceItems(TENANT_ID)).rejects.toThrow('Permission denied');
  });

  it('returns empty array when data is null but no error', async () => {
    mockApiClient.get.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await fetchInvoiceItems(TENANT_ID);

    expect(result).toEqual([]);
  });
});

// ============================================================================
// Tests: useInvoiceItems (React Query Hook)
// ============================================================================

describe('useInvoiceItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns invoice items on success', async () => {
    const mockItems = [createMockInvoiceItem()];

    mockApiClient.get.mockResolvedValue({
      data: mockItems,
      error: null,
    });

    const { result } = renderHook(() => useInvoiceItems(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockItems);
  });

  it('returns empty array when no items exist', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useInvoiceItems(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('is enabled when tenantId exists in context', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useInvoiceItems(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.get).toHaveBeenCalled();
  });

  it('is disabled when tenantId is empty', async () => {
    vi.mocked(apiSdk.getApiContext).mockReturnValueOnce({
      tenantId: '',
      industryType: 'academy',
    } as ReturnType<typeof apiSdk.getApiContext>);

    const { result } = renderHook(() => useInvoiceItems(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiClient.get).not.toHaveBeenCalled();
  });

  it('passes filter to the query function', async () => {
    const filter: InvoiceItemFilter = { invoice_id: 'inv-abc' };

    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useInvoiceItems(filter), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.get).toHaveBeenCalledWith('invoice_items', {
      filters: { invoice_id: 'inv-abc' },
      orderBy: { column: 'created_at', ascending: false },
      limit: 100,
    });
  });
});
