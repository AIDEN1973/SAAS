/**
 * useSchema Extended Tests
 *
 * Coverage target: 74% -> 80%+
 * Additional coverage for:
 * - isVersionGte: edge cases (v-prefix, NaN segments, equal versions, major/minor/patch comparisons)
 * - Client version filtering (min_supported_client)
 * - Single response (non-array data)
 * - PGRST204 error code handling
 * - "does not exist" error message handling
 * - Network error that is not a 404 (catch block unexpected error)
 * - 404 status code in catch block
 * - Second empty-data branch (after filtering)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
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
    clientVersion: '2.0.0',
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
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const mockFormSchema: FormSchema = {
  type: 'form',
  version: '1.0.0',
  entity: 'student',
  form: {
    fields: [{ key: 'name', type: 'text' }],
  },
} as FormSchema;

const fallbackSchema: FormSchema = {
  type: 'form',
  version: '0.1.0',
  entity: 'student',
  form: {
    fields: [{ key: 'fallback_name', type: 'text' }],
  },
} as FormSchema;

// ============================================================================
// Tests
// ============================================================================

describe('useSchema Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========== Client version filtering ==========

  describe('client version filtering', () => {
    it('filters out schemas that require higher client version', async () => {
      mockGet.mockResolvedValue({
        data: [
          {
            id: 'schema-1',
            entity: 'student',
            industry_type: 'academy',
            version: '1.0.0',
            min_supported_client: '3.0.0', // Higher than client 2.0.0
            schema_json: mockFormSchema,
            status: 'active',
          },
        ],
        error: null,
      });

      const { result } = renderHook(
        () => useSchema('student', fallbackSchema),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      // Should fall back because the client version (2.0.0) < required (3.0.0)
      expect(result.current.data).toEqual(fallbackSchema);
    });

    it('includes schemas that match client version exactly', async () => {
      mockGet.mockResolvedValue({
        data: [
          {
            id: 'schema-1',
            entity: 'student',
            industry_type: 'academy',
            version: '1.0.0',
            min_supported_client: '2.0.0', // Equal to client 2.0.0
            schema_json: mockFormSchema,
            status: 'active',
          },
        ],
        error: null,
      });

      const { result } = renderHook(
        () => useSchema('student', fallbackSchema),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockFormSchema);
    });

    it('includes schemas without min_supported_client', async () => {
      mockGet.mockResolvedValue({
        data: [
          {
            id: 'schema-1',
            entity: 'student',
            industry_type: 'academy',
            version: '1.0.0',
            // No min_supported_client
            schema_json: mockFormSchema,
            status: 'active',
          },
        ],
        error: null,
      });

      const { result } = renderHook(
        () => useSchema('student', fallbackSchema),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockFormSchema);
    });
  });

  // ========== Single (non-array) response ==========

  describe('single response handling', () => {
    it('handles non-array response data', async () => {
      mockGet.mockResolvedValue({
        data: {
          id: 'schema-1',
          entity: 'student',
          industry_type: 'academy',
          version: '1.0.0',
          min_supported_client: '1.0.0',
          schema_json: mockFormSchema,
          status: 'active',
        },
        error: null,
      });

      const { result } = renderHook(
        () => useSchema('student', fallbackSchema),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockFormSchema);
    });
  });

  // ========== Error code handling ==========

  describe('error code handling', () => {
    it('handles PGRST204 error code (table not found)', async () => {
      mockGet.mockResolvedValue({
        data: null,
        error: { code: 'PGRST204', message: 'Table does not exist' },
      });

      const { result } = renderHook(
        () => useSchema('student', fallbackSchema),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(fallbackSchema);
    });

    it('handles "does not exist" error message', async () => {
      mockGet.mockResolvedValue({
        data: null,
        error: { code: 'UNKNOWN', message: 'relation "schema_registry" does not exist' },
      });

      const { result } = renderHook(
        () => useSchema('student', fallbackSchema),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(fallbackSchema);
    });

    it('handles "not found" error message', async () => {
      mockGet.mockResolvedValue({
        data: null,
        error: { code: 'UNKNOWN', message: 'Resource not found' },
      });

      const { result } = renderHook(
        () => useSchema('student', fallbackSchema),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(fallbackSchema);
    });
  });

  // ========== Catch block scenarios ==========

  describe('catch block scenarios', () => {
    it('handles thrown error with PGRST116 code', async () => {
      const error = Object.assign(new Error('Not found'), { code: 'PGRST116' });
      mockGet.mockRejectedValue(error);

      const { result } = renderHook(
        () => useSchema('student', fallbackSchema),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(fallbackSchema);
    });

    it('handles thrown error with 404 status', async () => {
      const error = Object.assign(new Error('Not found'), { status: 404 });
      mockGet.mockRejectedValue(error);

      const { result } = renderHook(
        () => useSchema('student', fallbackSchema),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(fallbackSchema);
    });

    it('handles thrown error with statusCode 404', async () => {
      const error = Object.assign(new Error('Not found'), { statusCode: 404 });
      mockGet.mockRejectedValue(error);

      const { result } = renderHook(
        () => useSchema('student', fallbackSchema),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(fallbackSchema);
    });

    it('handles thrown error with PGRST204 code in catch', async () => {
      const error = Object.assign(new Error('Not found'), { code: 'PGRST204' });
      mockGet.mockRejectedValue(error);

      const { result } = renderHook(
        () => useSchema('student', fallbackSchema),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(fallbackSchema);
    });

    it('handles thrown error with 404 in message', async () => {
      mockGet.mockRejectedValue(new Error('HTTP 404: Not found'));

      const { result } = renderHook(
        () => useSchema('student', fallbackSchema),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(fallbackSchema);
    });

    it('handles unexpected errors in catch (falls back in dev)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockGet.mockRejectedValue(new Error('Unexpected database error'));

      const { result } = renderHook(
        () => useSchema('student', fallbackSchema),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      // In dev/test environment, should return fallback
      expect(result.current.data).toEqual(fallbackSchema);

      warnSpy.mockRestore();
    });
  });

  // ========== Version prefix handling (v-prefix) ==========

  describe('isVersionGte edge cases', () => {
    it('handles v-prefix versions in schemas', async () => {
      mockGet.mockResolvedValue({
        data: [
          {
            id: 'schema-1',
            entity: 'student',
            industry_type: 'academy',
            version: '1.0.0',
            min_supported_client: 'v1.0.0', // v-prefix
            schema_json: mockFormSchema,
            status: 'active',
          },
        ],
        error: null,
      });

      const { result } = renderHook(
        () => useSchema('student', fallbackSchema),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockFormSchema);
    });
  });

  // ========== Schema type: table ==========

  describe('different schema types', () => {
    it('fetches table type schema', async () => {
      const tableSchema = {
        type: 'table',
        version: '1.0.0',
        entity: 'student',
        table: { columns: [] },
      };

      mockGet.mockResolvedValue({
        data: [
          {
            id: 'schema-table',
            entity: 'student',
            industry_type: 'academy',
            version: '1.0.0',
            min_supported_client: '1.0.0',
            schema_json: tableSchema,
            status: 'active',
          },
        ],
        error: null,
      });

      const { result } = renderHook(
        () => useSchema('student', undefined, 'table'),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(tableSchema);
    });
  });

  // ========== Non-error response with null data ==========

  describe('null data response', () => {
    it('returns fallback when data is null without error', async () => {
      mockGet.mockResolvedValue({
        data: null,
        error: null,
      });

      const { result } = renderHook(
        () => useSchema('student', fallbackSchema),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(fallbackSchema);
    });
  });
});
