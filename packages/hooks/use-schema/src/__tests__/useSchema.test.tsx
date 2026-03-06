/**
 * useSchema Hook Unit Tests
 *
 * Test scope:
 * - useSchema: React Query hook for fetching schemas from Schema Registry
 * - isVersionGte: semver comparison helper
 * - Fallback behavior in dev/test environment
 * - Query key structure with tenantId and industryType
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import type { FormSchema } from '@schema-engine';

// ============================================================================
// Mocks
// ============================================================================

const mockGet = vi.fn();

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
    clientVersion: '1.0.0',
  })),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { useSchema } from '../useSchema';

// ============================================================================
// Test Helpers
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
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

const mockFormSchema: FormSchema = {
  type: 'form',
  version: '1.0.0',
  entity: 'student',
  form: {
    fields: [
      { key: 'name', type: 'text' },
    ],
  },
} as FormSchema;

const fallbackSchema: FormSchema = {
  type: 'form',
  version: '0.1.0',
  entity: 'student',
  form: {
    fields: [
      { key: 'fallback_name', type: 'text' },
    ],
  },
} as FormSchema;

// ============================================================================
// Tests
// ============================================================================

describe('useSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns schema data from registry on success', async () => {
    mockGet.mockResolvedValue({
      data: [{
        id: 'schema-1',
        entity: 'student',
        industry_type: 'academy',
        version: '1.0.0',
        min_supported_client: '1.0.0',
        schema_json: mockFormSchema,
        status: 'active',
      }],
      error: null,
    });

    const { result } = renderHook(
      () => useSchema('student', fallbackSchema),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockFormSchema);
  });

  it('returns fallback schema when API returns empty array', async () => {
    mockGet.mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(
      () => useSchema('student', fallbackSchema),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(fallbackSchema);
  });

  it('returns fallback schema when API returns error', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });

    const { result } = renderHook(
      () => useSchema('student', fallbackSchema),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(fallbackSchema);
  });

  it('returns null when no fallback provided and API fails', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });

    const { result } = renderHook(
      () => useSchema('student'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('filters schemas by type from schema_json', async () => {
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'schema-table',
          entity: 'student',
          industry_type: 'academy',
          version: '1.0.0',
          min_supported_client: '1.0.0',
          schema_json: { type: 'table', version: '1.0.0', entity: 'student' },
          status: 'active',
        },
        {
          id: 'schema-form',
          entity: 'student',
          industry_type: 'academy',
          version: '1.0.0',
          min_supported_client: '1.0.0',
          schema_json: mockFormSchema,
          status: 'active',
        },
      ],
      error: null,
    });

    const { result } = renderHook(
      () => useSchema('student', fallbackSchema, 'form'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockFormSchema);
  });

  it('returns fallback when no schemas match the requested type', async () => {
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'schema-table',
          entity: 'student',
          industry_type: 'academy',
          version: '1.0.0',
          min_supported_client: '1.0.0',
          schema_json: { type: 'table', version: '1.0.0', entity: 'student' },
          status: 'active',
        },
      ],
      error: null,
    });

    const { result } = renderHook(
      () => useSchema('student', fallbackSchema, 'form'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(fallbackSchema);
  });

  it('passes correct filters to apiClient.get', async () => {
    mockGet.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(
      () => useSchema('student', fallbackSchema),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('schema_registry', {
      filters: {
        entity: 'student',
        industry_type: 'academy',
        status: 'active',
      },
    });
  });

  it('returns fallback when API throws network error', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(
      () => useSchema('student', fallbackSchema),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(fallbackSchema);
  });

  it('is disabled when tenantId is empty', async () => {
    const { getApiContext } = await import('@api-sdk/core');
    vi.mocked(getApiContext).mockReturnValueOnce({
      tenantId: '',
      industryType: 'academy',
      clientVersion: '1.0.0',
    } as ReturnType<typeof getApiContext>);

    const { result } = renderHook(
      () => useSchema('student', fallbackSchema),
      { wrapper: createWrapper() },
    );

    // Query should not fire since enabled = !!context.tenantId is false
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });
});
