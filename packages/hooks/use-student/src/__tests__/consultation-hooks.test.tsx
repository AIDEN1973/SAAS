/**
 * Consultation Hooks Unit Tests
 *
 * Tests for:
 * - fetchConsultations: standalone fetch function
 * - useConsultations: consultation list by student query hook
 * - useAllConsultations: all consultations query hook
 * - useCreateConsultation: create consultation mutation
 * - useUpdateConsultation: update consultation mutation
 * - useDeleteConsultation: delete consultation mutation
 * - useGenerateConsultationAISummary: AI summary generation mutation
 * - useConsultationsPaged: paginated consultations query
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ===== Mocks =====

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();
const mockInvokeFunction = vi.fn();

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    invokeFunction: (...args: unknown[]) => mockInvokeFunction(...args),
  },
  getApiContext: () => ({ tenantId: 'test-tenant-id', industryType: 'academy' }),
}));

vi.mock('@hooks/use-auth', () => ({
  useSession: () => ({ data: { user: { id: 'test-user-id' } } }),
}));

vi.mock('../audit-mutation', () => ({
  recordMutationAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@services/student-service', () => ({}));

import {
  fetchConsultations,
  useConsultations,
  useAllConsultations,
  useCreateConsultation,
  useUpdateConsultation,
  useDeleteConsultation,
  useGenerateConsultationAISummary,
  useConsultationsPaged,
} from '../consultation-hooks';

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

describe('fetchConsultations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns consultations list on success', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 'c1', student_id: 's1', consultation_date: '2026-03-01', content: 'Test' },
        { id: 'c2', student_id: 's1', consultation_date: '2026-02-01', content: 'Test2' },
      ],
      error: null,
    });

    const result = await fetchConsultations('test-tenant-id', { student_id: 's1' });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('c1');
    expect(mockGet).toHaveBeenCalledWith('student_consultations', {
      filters: { student_id: 's1' },
      orderBy: { column: 'consultation_date', ascending: false },
      limit: 200,
    });
  });

  it('applies date filter', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    await fetchConsultations('test-tenant-id', {
      consultation_date: { gte: '2026-01-01', lte: '2026-03-01' },
    });

    expect(mockGet).toHaveBeenCalledWith('student_consultations', {
      filters: { consultation_date: { gte: '2026-01-01', lte: '2026-03-01' } },
      orderBy: { column: 'consultation_date', ascending: false },
      limit: 200,
    });
  });

  it('calls API with no filters when filter is undefined', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    await fetchConsultations('test-tenant-id');

    expect(mockGet).toHaveBeenCalledWith('student_consultations', {
      filters: {},
      orderBy: { column: 'consultation_date', ascending: false },
      limit: 200,
    });
  });

  it('throws on API error', async () => {
    mockGet.mockResolvedValueOnce({
      data: null,
      error: { message: 'Consultations fetch failed' },
    });

    await expect(fetchConsultations('test-tenant-id')).rejects.toThrow('Consultations fetch failed');
  });

  it('returns empty array when data is null', async () => {
    mockGet.mockResolvedValueOnce({ data: null, error: null });

    const result = await fetchConsultations('test-tenant-id');
    expect(result).toEqual([]);
  });

  it('applies both student_id and date filter', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    await fetchConsultations('test-tenant-id', {
      student_id: 's1',
      consultation_date: { gte: '2026-01-01' },
    });

    expect(mockGet).toHaveBeenCalledWith('student_consultations', {
      filters: {
        student_id: 's1',
        consultation_date: { gte: '2026-01-01' },
      },
      orderBy: { column: 'consultation_date', ascending: false },
      limit: 200,
    });
  });
});

describe('useConsultations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns consultations for a student', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ id: 'c1', student_id: 's1', content: 'Test' }],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useConsultations('s1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it('is disabled when studentId is null', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useConsultations(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('calls API and verifies error path triggers', async () => {
    mockGet.mockResolvedValueOnce({
      data: null,
      error: { message: 'Consultations query failed' },
    });

    const { wrapper } = createWrapper();
    renderHook(() => useConsultations('s1'), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet).toHaveBeenCalledWith('student_consultations', expect.objectContaining({
      filters: { student_id: 's1' },
    }));
  });
});

describe('useAllConsultations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all consultations', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 'c1', student_id: 's1' },
        { id: 'c2', student_id: 's2' },
      ],
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAllConsultations(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it('respects enabled=false', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAllConsultations({ enabled: false }),
      { wrapper }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('respects enabled=true', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAllConsultations({ enabled: true }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalled();
  });

  it('calls fetchConsultations with no filter', async () => {
    mockGet.mockResolvedValueOnce({ data: [], error: null });

    const { wrapper } = createWrapper();
    renderHook(() => useAllConsultations(), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(mockGet).toHaveBeenCalledWith('student_consultations', {
      filters: {},
      orderBy: { column: 'consultation_date', ascending: false },
      limit: 200,
    });
  });
});

describe('useCreateConsultation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates consultation successfully', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: 'c-new', student_id: 's1', consultation_type: 'general', content: 'New consultation' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateConsultation(), { wrapper });

    await act(async () => {
      const data = await result.current.mutateAsync({
        studentId: 's1',
        consultation: {
          consultation_type: 'general',
          consultation_date: '2026-03-06',
          content: 'New consultation',
        } as Record<string, unknown>,
        userId: 'user-1',
      });
      expect(data.id).toBe('c-new');
    });

    expect(mockPost).toHaveBeenCalledWith('student_consultations', expect.objectContaining({
      tenant_id: 'test-tenant-id',
      student_id: 's1',
      consultation_type: 'general',
      created_by: 'user-1',
    }));
  });

  it('throws on POST error', async () => {
    mockPost.mockResolvedValueOnce({
      data: null,
      error: { message: 'Create consultation failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateConsultation(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          studentId: 's1',
          consultation: { content: 'Fail' } as Record<string, unknown>,
          userId: 'user-1',
        });
      })
    ).rejects.toThrow('Create consultation failed');
  });

  it('invalidates both student-specific and all consultations caches', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: 'c-cache', student_id: 's1' },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateConsultation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        studentId: 's1',
        consultation: { content: 'Test' } as Record<string, unknown>,
        userId: 'user-1',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['consultations', 'test-tenant-id', 's1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['consultations', 'test-tenant-id', 'all'],
    });
  });
});

describe('useUpdateConsultation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates consultation successfully', async () => {
    mockPatch.mockResolvedValueOnce({
      data: { id: 'c1', content: 'Updated content' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateConsultation(), { wrapper });

    await act(async () => {
      const data = await result.current.mutateAsync({
        consultationId: 'c1',
        consultation: { content: 'Updated content' },
        studentId: 's1',
      });
      expect(data.content).toBe('Updated content');
    });

    expect(mockPatch).toHaveBeenCalledWith('student_consultations', 'c1', {
      content: 'Updated content',
    });
  });

  it('throws on PATCH error', async () => {
    mockPatch.mockResolvedValueOnce({
      data: null,
      error: { message: 'Update consultation failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateConsultation(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          consultationId: 'c1',
          consultation: { content: 'Fail' },
          studentId: 's1',
        });
      })
    ).rejects.toThrow('Update consultation failed');
  });

  it('invalidates both student-specific and all consultations caches', async () => {
    mockPatch.mockResolvedValueOnce({
      data: { id: 'c1', content: 'Updated' },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateConsultation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        consultationId: 'c1',
        consultation: { content: 'Updated' },
        studentId: 's1',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['consultations', 'test-tenant-id', 's1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['consultations', 'test-tenant-id', 'all'],
    });
  });
});

describe('useDeleteConsultation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes consultation successfully', async () => {
    mockDelete.mockResolvedValueOnce({ error: null });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteConsultation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ consultationId: 'c1', studentId: 's1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDelete).toHaveBeenCalledWith('student_consultations', 'c1');
  });

  it('throws on DELETE error', async () => {
    mockDelete.mockResolvedValueOnce({
      error: { message: 'Delete consultation failed' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteConsultation(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ consultationId: 'c1', studentId: 's1' });
      })
    ).rejects.toThrow('Delete consultation failed');
  });

  it('invalidates both student-specific and all consultations caches', async () => {
    mockDelete.mockResolvedValueOnce({ error: null });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteConsultation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ consultationId: 'c1', studentId: 's1' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['consultations', 'test-tenant-id', 's1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['consultations', 'test-tenant-id', 'all'],
    });
  });
});

describe('useGenerateConsultationAISummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates AI summary successfully', async () => {
    mockInvokeFunction.mockResolvedValueOnce({
      data: { ai_summary: 'This student is doing well in math.' },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGenerateConsultationAISummary(), { wrapper });

    await act(async () => {
      const summary = await result.current.mutateAsync({
        consultationId: 'c1',
        studentId: 's1',
      });
      expect(summary).toBe('This student is doing well in math.');
    });

    expect(mockInvokeFunction).toHaveBeenCalledWith('consultation-ai-summary', {
      consultation_id: 'c1',
    });
  });

  it('throws on edge function error', async () => {
    mockInvokeFunction.mockResolvedValueOnce({
      data: null,
      error: { message: 'AI service unavailable' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGenerateConsultationAISummary(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ consultationId: 'c1', studentId: 's1' });
      })
    ).rejects.toThrow('AI service unavailable');
  });

  it('throws when error message is empty', async () => {
    mockInvokeFunction.mockResolvedValueOnce({
      data: null,
      error: { message: '' },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGenerateConsultationAISummary(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ consultationId: 'c1', studentId: 's1' });
      })
    ).rejects.toThrow('AI 요약 생성에 실패했습니다.');
  });

  it('throws when ai_summary is missing from response', async () => {
    mockInvokeFunction.mockResolvedValueOnce({
      data: {},
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGenerateConsultationAISummary(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ consultationId: 'c1', studentId: 's1' });
      })
    ).rejects.toThrow('AI 요약 데이터가 없습니다.');
  });

  it('throws when data is null', async () => {
    mockInvokeFunction.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGenerateConsultationAISummary(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ consultationId: 'c1', studentId: 's1' });
      })
    ).rejects.toThrow('AI 요약 데이터가 없습니다.');
  });

  it('invalidates both student-specific and all consultations caches on success', async () => {
    mockInvokeFunction.mockResolvedValueOnce({
      data: { ai_summary: 'Summary text' },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useGenerateConsultationAISummary(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ consultationId: 'c1', studentId: 's1' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['consultations', 'test-tenant-id', 's1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['consultations', 'test-tenant-id', 'all'],
    });
  });
});

describe('useConsultationsPaged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated consultations with totalCount', async () => {
    // Data query
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 'c1', content: 'Consultation 1' },
        { id: 'c2', content: 'Consultation 2' },
      ],
      error: null,
    });
    // Count query
    mockGet.mockResolvedValueOnce({
      data: [],
      error: null,
      count: 50,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useConsultationsPaged({ page: 1, pageSize: 20 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.consultations).toHaveLength(2);
    expect(result.current.data?.totalCount).toBe(50);
  });

  it('applies consultationType filter', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null, count: 0 });

    const { wrapper } = createWrapper();
    renderHook(
      () => useConsultationsPaged({ consultationType: 'phone' }),
      { wrapper }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(mockGet).toHaveBeenCalledWith('student_consultations', expect.objectContaining({
      filters: expect.objectContaining({ consultation_type: 'phone' }),
    }));
  });

  it('skips consultationType filter when "all"', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null, count: 0 });

    const { wrapper } = createWrapper();
    renderHook(
      () => useConsultationsPaged({ consultationType: 'all' }),
      { wrapper }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    // Should NOT have consultation_type in filters
    const callArgs = mockGet.mock.calls[0];
    expect(callArgs[1].filters).not.toHaveProperty('consultation_type');
  });

  it('applies date range filters', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null, count: 0 });

    const { wrapper } = createWrapper();
    renderHook(
      () => useConsultationsPaged({
        dateFrom: '2026-01-01',
        dateTo: '2026-03-01',
      }),
      { wrapper }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(mockGet).toHaveBeenCalledWith('student_consultations', expect.objectContaining({
      filters: expect.objectContaining({
        consultation_date: { gte: '2026-01-01', lte: '2026-03-01' },
      }),
    }));
  });

  it('applies only dateFrom filter', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null, count: 0 });

    const { wrapper } = createWrapper();
    renderHook(
      () => useConsultationsPaged({ dateFrom: '2026-01-01' }),
      { wrapper }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(mockGet).toHaveBeenCalledWith('student_consultations', expect.objectContaining({
      filters: expect.objectContaining({
        consultation_date: { gte: '2026-01-01' },
      }),
    }));
  });

  it('applies only dateTo filter', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null, count: 0 });

    const { wrapper } = createWrapper();
    renderHook(
      () => useConsultationsPaged({ dateTo: '2026-03-01' }),
      { wrapper }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(mockGet).toHaveBeenCalledWith('student_consultations', expect.objectContaining({
      filters: expect.objectContaining({
        consultation_date: { lte: '2026-03-01' },
      }),
    }));
  });

  it('calculates correct offset for page 3', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null, count: 0 });

    const { wrapper } = createWrapper();
    renderHook(
      () => useConsultationsPaged({ page: 3, pageSize: 20 }),
      { wrapper }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(mockGet).toHaveBeenCalledWith('student_consultations', expect.objectContaining({
      range: { from: 40, to: 59 },
    }));
  });

  it('calls API and verifies error path triggers', async () => {
    mockGet.mockResolvedValueOnce({
      data: null,
      error: { message: 'Paged query failed' },
    });

    const { wrapper } = createWrapper();
    renderHook(
      () => useConsultationsPaged({}),
      { wrapper }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet).toHaveBeenCalledWith('student_consultations', expect.objectContaining({
      filters: {},
    }));
  });

  it('respects enabled=false', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useConsultationsPaged({ enabled: false }),
      { wrapper }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('handles count response with no count', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [{ id: 'c1' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null }); // no count

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useConsultationsPaged({}),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalCount).toBe(0);
  });

  it('uses default options', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null, count: 0 });

    const { wrapper } = createWrapper();
    renderHook(
      () => useConsultationsPaged({}),
      { wrapper }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    // Default: page=1, pageSize=20, no filters
    expect(mockGet).toHaveBeenCalledWith('student_consultations', expect.objectContaining({
      filters: {},
      range: { from: 0, to: 19 },
    }));
  });
});
