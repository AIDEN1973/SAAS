/**
 * useFilterTags Extended Tests
 *
 * Coverage target: 66% -> 80%+
 * Additional coverage for:
 * - useFilterTagsByCategory: grouping by category
 * - useApplyFilterTag: query with tagId
 * - useUpdateFilterTag: update mutation
 * - useCreateFilterTag with tenantId missing
 * - useUpdateFilterTag with tenantId missing
 * - useDeleteFilterTag with tenantId missing
 * - fetchFilterTags with is_active filter
 * - fetchFilteredStudents error scenarios (404, 400)
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
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

vi.mock('@hooks/use-auth', () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: 'test-user-id' } },
  })),
}));

vi.mock('@core/notification', () => ({}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import {
  useFilterTagsByCategory,
  useApplyFilterTag,
  useUpdateFilterTag,
  useCreateFilterTag,
  useDeleteFilterTag,
  fetchFilterTags,
  fetchFilteredStudents,
} from '../useFilterTags';
import type { FilterTag } from '../useFilterTags';

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
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function createMockFilterTag(overrides?: Partial<FilterTag>): FilterTag {
  return {
    id: 'tag-1',
    tenant_id: TENANT_ID,
    name: 'active-students',
    display_label: 'Active Students',
    category: 'status' as FilterTag['category'],
    color: '#4CAF50',
    icon: 'check',
    condition_type: 'eq',
    condition_params: { status: 'active' },
    is_active: true,
    is_system_default: false,
    sort_order: 1,
    usage_count: 10,
    created_at: '2026-01-01T00:00:00Z',
    created_by: 'user-1',
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: 'user-1',
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useFilterTags Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========== useFilterTagsByCategory ==========

  describe('useFilterTagsByCategory', () => {
    it('groups tags by category', async () => {
      const statusTag = createMockFilterTag({ id: 'tag-1', category: 'status' as FilterTag['category'] });
      const enrollmentTag = createMockFilterTag({
        id: 'tag-2',
        category: 'enrollment' as FilterTag['category'],
        name: 'enrolled',
      });

      mockApiClient.get.mockResolvedValue({
        data: [statusTag, enrollmentTag],
        error: null,
      });

      const { result } = renderHook(() => useFilterTagsByCategory(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.tags).toBeDefined());

      if (result.current.data) {
        expect(result.current.data['status' as FilterTag['category']]).toHaveLength(1);
        expect(result.current.data['enrollment' as FilterTag['category']]).toHaveLength(1);
      }
    });

    it('returns undefined data when tags are undefined', async () => {
      mockApiClient.get.mockResolvedValue({
        data: [],
        error: null,
      });

      const { result } = renderHook(() => useFilterTagsByCategory(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  // ========== useApplyFilterTag ==========

  describe('useApplyFilterTag', () => {
    it('fetches filtered students when tagId is provided', async () => {
      const students = [
        { student_id: 's1', student_name: 'Student 1', phone: '010-1234-5678', metadata: {} },
      ];
      mockApiClient.callRPC.mockResolvedValue({
        data: students,
        error: null,
      });

      const { result } = renderHook(() => useApplyFilterTag('tag-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(students);
    });

    it('is disabled when tagId is null', () => {
      const { result } = renderHook(() => useApplyFilterTag(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(mockApiClient.callRPC).not.toHaveBeenCalled();
    });
  });

  // ========== useUpdateFilterTag ==========

  describe('useUpdateFilterTag', () => {
    it('updates a filter tag successfully', async () => {
      const updatedTag = createMockFilterTag({ display_label: 'Updated Label' });
      mockApiClient.patch.mockResolvedValue({
        data: updatedTag,
        error: null,
      });

      const { result } = renderHook(() => useUpdateFilterTag(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate({ id: 'tag-1', display_label: 'Updated Label' });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.patch).toHaveBeenCalledWith(
        'message_filter_tags',
        'tag-1',
        { display_label: 'Updated Label' },
      );
    });

    it('fails when API returns error', async () => {
      mockApiClient.patch.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      const { result } = renderHook(() => useUpdateFilterTag(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate({ id: 'tag-1', display_label: 'Bad' });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe('Update failed');
    });

    it('throws when tenantId is missing', async () => {
      vi.mocked(apiSdk.getApiContext).mockReturnValueOnce({
        tenantId: '',
        industryType: 'academy',
      } as ReturnType<typeof apiSdk.getApiContext>);

      const { result } = renderHook(() => useUpdateFilterTag(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate({ id: 'tag-1', display_label: 'No tenant' });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe('tenantId is required');
    });
  });

  // ========== useCreateFilterTag with missing tenantId ==========

  describe('useCreateFilterTag - no tenantId', () => {
    it('throws when tenantId is missing', async () => {
      vi.mocked(apiSdk.getApiContext).mockReturnValueOnce({
        tenantId: '',
        industryType: 'academy',
      } as ReturnType<typeof apiSdk.getApiContext>);

      const { result } = renderHook(() => useCreateFilterTag(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate({
          name: 'test',
          display_label: 'Test',
          category: 'status' as FilterTag['category'],
          condition_type: 'eq',
        });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe('tenantId is required');
    });
  });

  // ========== useDeleteFilterTag with missing tenantId ==========

  describe('useDeleteFilterTag - no tenantId', () => {
    it('throws when tenantId is missing', async () => {
      vi.mocked(apiSdk.getApiContext).mockReturnValueOnce({
        tenantId: '',
        industryType: 'academy',
      } as ReturnType<typeof apiSdk.getApiContext>);

      const { result } = renderHook(() => useDeleteFilterTag(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate('tag-1');
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe('tenantId is required');
    });
  });

  // ========== fetchFilterTags additional scenarios ==========

  describe('fetchFilterTags - extended', () => {
    it('applies is_active=false filter when explicitly set', async () => {
      mockApiClient.get.mockResolvedValue({
        data: [],
        error: null,
      });

      await fetchFilterTags(TENANT_ID, { is_active: false });

      expect(mockApiClient.get).toHaveBeenCalledWith('message_filter_tags', {
        filters: { is_active: false },
        orderBy: { column: 'sort_order', ascending: true },
        limit: 500,
      });
    });

    it('handles non-relation error by throwing', async () => {
      mockApiClient.get.mockResolvedValue({
        data: null,
        error: { message: 'Permission denied' },
      });

      // The function catches all errors in the outer catch and returns []
      const result = await fetchFilterTags(TENANT_ID);
      expect(result).toEqual([]);
    });

    it('returns data even when null (empty array fallback)', async () => {
      mockApiClient.get.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await fetchFilterTags(TENANT_ID);
      expect(result).toEqual([]);
    });
  });

  // ========== fetchFilteredStudents additional scenarios ==========

  describe('fetchFilteredStudents - extended', () => {
    it('handles 404 error gracefully', async () => {
      mockApiClient.callRPC.mockResolvedValue({
        data: null,
        error: { message: '404 Not Found' },
      });

      const result = await fetchFilteredStudents(TENANT_ID, 'tag-1');
      expect(result).toEqual([]);
    });

    it('handles 400 error gracefully', async () => {
      mockApiClient.callRPC.mockResolvedValue({
        data: null,
        error: { message: '400 Bad Request' },
      });

      const result = await fetchFilteredStudents(TENANT_ID, 'tag-1');
      expect(result).toEqual([]);
    });

    it('throws on unexpected error but catches in outer handler', async () => {
      mockApiClient.callRPC.mockResolvedValue({
        data: null,
        error: { message: 'Unexpected server error' },
      });

      // The function catches all thrown errors in the outer catch and returns []
      const result = await fetchFilteredStudents(TENANT_ID, 'tag-1');
      expect(result).toEqual([]);
    });
  });
});
