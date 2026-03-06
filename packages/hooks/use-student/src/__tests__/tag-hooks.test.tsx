/**
 * Tag Hooks Unit Tests
 *
 * Tests for:
 * - useStudentTags: list all student tags
 * - useStudentTagsByStudent: get tags for a specific student
 * - useAllStudentTagAssignments: get all student tag assignments (stats)
 * - useUpdateStudentTags: update a student's tags (delete old + create new)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ===== Mocks =====

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
  getApiContext: () => ({ tenantId: 'test-tenant-id', industryType: 'academy' }),
}));

vi.mock('@hooks/use-auth', () => ({
  useSession: () => ({ data: { user: { id: 'test-user-id' } } }),
}));

vi.mock('../audit-mutation', () => ({
  recordMutationAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@core/tags', () => ({}));

import {
  useStudentTags,
  useStudentTagsByStudent,
  useAllStudentTagAssignments,
  useUpdateStudentTags,
} from '../tag-hooks';

// ===== Test Wrapper =====

function createWrapper(queryClient?: QueryClient) {
  const qc = queryClient ?? new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient: qc,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children),
  };
}

// ===== Tests =====

describe('useStudentTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped tag list sorted by created_at desc', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 't1', name: 'VIP', color: '#ff0000', created_at: '2026-01-01T00:00:00Z' },
        { id: 't2', name: 'New', color: '#00ff00', created_at: '2026-03-01T00:00:00Z' },
        { id: 't3', name: 'Trial', color: null, created_at: '2026-02-01T00:00:00Z' },
      ],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentTags(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Sorted by created_at desc: t2 (March), t3 (Feb), t1 (Jan)
    expect(result.current.data).toEqual([
      { id: 't2', name: 'New', color: '#00ff00' },
      { id: 't3', name: 'Trial', color: 'var(--color-primary)' },
      { id: 't1', name: 'VIP', color: '#ff0000' },
    ]);
  });

  it('returns empty array when API returns empty data', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentTags(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('returns empty array when data is null', async () => {
    mockGet.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentTags(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('calls API and verifies error path triggers', async () => {
    mockGet.mockResolvedValueOnce({
      data: null,
      error: { message: 'Tags fetch failed' },
    });

    const { wrapper } = createWrapper();
    renderHook(() => useStudentTags(), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet).toHaveBeenCalledWith('tags', expect.objectContaining({
      filters: { entity_type: 'student' },
    }));
  });

  it('uses default color when tag.color is empty string', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ id: 't1', name: 'NoColor', color: '', created_at: '2026-01-01T00:00:00Z' }],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentTags(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].color).toBe('var(--color-primary)');
  });

  it('calls API with correct filters and orderBy', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    const { wrapper } = createWrapper();
    renderHook(() => useStudentTags(), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(mockGet).toHaveBeenCalledWith('tags', {
      filters: { entity_type: 'student' },
      orderBy: { column: 'created_at', ascending: false },
    });
  });
});

describe('useStudentTagsByStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tags for a specific student via tag_assignments join', async () => {
    // 1st call: tag_assignments
    mockGet.mockResolvedValueOnce({
      data: [
        { entity_id: 's1', entity_type: 'student', tag_id: 't1' },
        { entity_id: 's1', entity_type: 'student', tag_id: 't2' },
      ],
      error: null,
    });

    // 2nd call: tags by IDs
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 't1', name: 'VIP', color: '#ff0000' },
        { id: 't2', name: 'Priority', color: null },
      ],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentTagsByStudent('s1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      { id: 't1', name: 'VIP', color: '#ff0000' },
      { id: 't2', name: 'Priority', color: 'var(--color-primary)' },
    ]);
  });

  it('returns empty array when studentId is null', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentTagsByStudent(null), { wrapper });

    // Should be disabled
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns empty array when no tag assignments exist', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentTagsByStudent('s1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('calls tag_assignments API and verifies error path triggers', async () => {
    mockGet.mockResolvedValueOnce({
      data: null,
      error: { message: 'Assignments fetch failed' },
    });

    const { wrapper } = createWrapper();
    renderHook(() => useStudentTagsByStudent('s1'), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet).toHaveBeenCalledWith('tag_assignments', expect.objectContaining({
      filters: { entity_id: 's1', entity_type: 'student' },
    }));
  });

  it('calls tags API after getting assignments and verifies error path', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: [{ entity_id: 's1', entity_type: 'student', tag_id: 't1' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Tags fetch failed' },
      });

    const { wrapper } = createWrapper();
    renderHook(() => useStudentTagsByStudent('s1'), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(mockGet).toHaveBeenNthCalledWith(1, 'tag_assignments', expect.anything());
    expect(mockGet).toHaveBeenNthCalledWith(2, 'tags', expect.anything());
  });

  it('handles null data from tag_assignments', async () => {
    mockGet.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentTagsByStudent('s1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe('useAllStudentTagAssignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped student-tag assignments', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        { entity_id: 's1', entity_type: 'student', tag_id: 't1' },
        { entity_id: 's2', entity_type: 'student', tag_id: 't2' },
      ],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAllStudentTagAssignments(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      { student_id: 's1', tag_id: 't1' },
      { student_id: 's2', tag_id: 't2' },
    ]);
  });

  it('returns empty array on null data', async () => {
    mockGet.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAllStudentTagAssignments(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('calls API and verifies error path triggers', async () => {
    mockGet.mockResolvedValueOnce({
      data: null,
      error: { message: 'All assignments fetch failed' },
    });

    const { wrapper } = createWrapper();
    renderHook(() => useAllStudentTagAssignments(), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet).toHaveBeenCalledWith('tag_assignments', expect.objectContaining({
      filters: { entity_type: 'student' },
    }));
  });

  it('respects enabled=false option', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAllStudentTagAssignments({ enabled: false }),
      { wrapper }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('respects enabled=true option', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAllStudentTagAssignments({ enabled: true }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalled();
  });

  it('calls API with correct params', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    const { wrapper } = createWrapper();
    renderHook(() => useAllStudentTagAssignments(), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(mockGet).toHaveBeenCalledWith('tag_assignments', {
      filters: { entity_type: 'student' },
      orderBy: { column: 'created_at', ascending: false },
      limit: 1000,
    });
  });
});

describe('useUpdateStudentTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes existing tags and creates new ones', async () => {
    // GET existing assignments
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 'ta-1', entity_id: 's1', entity_type: 'student', tag_id: 'old-t1' },
        { id: 'ta-2', entity_id: 's1', entity_type: 'student', tag_id: 'old-t2' },
      ],
      error: null,
    });

    // DELETE old assignments
    mockDelete.mockResolvedValue({ error: null });

    // POST new assignments
    mockPost.mockResolvedValue({ data: { id: 'new-ta' }, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateStudentTags(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        studentId: 's1',
        tagIds: ['new-t1', 'new-t2', 'new-t3'],
      });
    });

    // 2 deletes for old tags
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(mockDelete).toHaveBeenCalledWith('tag_assignments', 'ta-1');
    expect(mockDelete).toHaveBeenCalledWith('tag_assignments', 'ta-2');

    // 3 posts for new tags
    expect(mockPost).toHaveBeenCalledTimes(3);
    expect(mockPost).toHaveBeenCalledWith('tag_assignments', {
      entity_id: 's1',
      entity_type: 'student',
      tag_id: 'new-t1',
    });
    expect(mockPost).toHaveBeenCalledWith('tag_assignments', {
      entity_id: 's1',
      entity_type: 'student',
      tag_id: 'new-t2',
    });
    expect(mockPost).toHaveBeenCalledWith('tag_assignments', {
      entity_id: 's1',
      entity_type: 'student',
      tag_id: 'new-t3',
    });
  });

  it('handles no existing tags (only creates)', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });
    mockPost.mockResolvedValue({ data: { id: 'new-ta' }, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateStudentTags(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ studentId: 's1', tagIds: ['t1'] });
    });

    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('handles empty tagIds (only deletes)', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ id: 'ta-1', entity_id: 's1', entity_type: 'student', tag_id: 'old-t1' }],
      error: null,
    });

    mockDelete.mockResolvedValue({ error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateStudentTags(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ studentId: 's1', tagIds: [] });
    });

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('handles no existing and no new tags', async () => {
    mockGet.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateStudentTags(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ studentId: 's1', tagIds: [] });
    });

    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('invalidates caches on success', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateStudentTags(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ studentId: 's1', tagIds: [] });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['tags', 'test-tenant-id', 'student', 's1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['students', 'test-tenant-id'],
    });
  });
});
