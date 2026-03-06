/**
 * useIndustryTerms Hook Unit Tests
 *
 * Test coverage:
 * - useIndustryTerms: main hook (context-driven industry type resolution)
 * - useIndustryTermsWithType: direct industry type hook (test/storybook usage)
 * - Re-exported utilities: getIndustryTerms, isValidIndustryType, SUPPORTED_INDUSTRY_TYPES
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

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

const mockSupabaseFrom = vi.fn();
const mockSupabaseSelect = vi.fn();
const mockSupabaseEq = vi.fn();
const mockSupabaseSingle = vi.fn();

vi.mock('@lib/supabase-client', () => ({
  createClient: vi.fn(() => ({
    from: mockSupabaseFrom,
  })),
}));

// Chain: from('tenants').select('industry_type').eq('id', tenantId).single()
mockSupabaseFrom.mockReturnValue({ select: mockSupabaseSelect });
mockSupabaseSelect.mockReturnValue({ eq: mockSupabaseEq });
mockSupabaseEq.mockReturnValue({ single: mockSupabaseSingle });

// ============================================================================
// Imports (after mocks due to hoisting)
// ============================================================================

import * as apiSdk from '@api-sdk/core';
import {
  useIndustryTerms,
  useIndustryTermsWithType,
  getIndustryTerms,
  isValidIndustryType,
  SUPPORTED_INDUSTRY_TYPES,
} from '../index';

// ============================================================================
// Test Helpers
// ============================================================================

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

// ============================================================================
// Tests: useIndustryTerms (React Query Hook)
// ============================================================================

describe('useIndustryTerms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the supabase chain mocks
    mockSupabaseFrom.mockReturnValue({ select: mockSupabaseSelect });
    mockSupabaseSelect.mockReturnValue({ eq: mockSupabaseEq });
    mockSupabaseEq.mockReturnValue({ single: mockSupabaseSingle });
  });

  it('returns academy terms when tenant industry_type is academy', async () => {
    mockSupabaseSingle.mockResolvedValue({
      data: { industry_type: 'academy' },
      error: null,
    });

    const { result } = renderHook(() => useIndustryTerms(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.PERSON_LABEL_PRIMARY).toBe('학생');
    });

    expect(result.current.PERSON_TYPE_PRIMARY).toBe('student');
    expect(result.current.GROUP_LABEL).toBe('수업');
  });

  it('returns gym terms when tenant industry_type is gym', async () => {
    mockSupabaseSingle.mockResolvedValue({
      data: { industry_type: 'gym' },
      error: null,
    });

    const { result } = renderHook(() => useIndustryTerms(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.PERSON_LABEL_PRIMARY).toBe('회원');
    });

    expect(result.current.PERSON_TYPE_PRIMARY).toBe('member');
    expect(result.current.PERSON_LABEL_SECONDARY).toBe('트레이너');
  });

  it('returns DEFAULT_TERMS when industry_type fetch fails', async () => {
    mockSupabaseSingle.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    const { result } = renderHook(() => useIndustryTerms(), {
      wrapper: createWrapper(),
    });

    // Should fall back to default (academy) terms
    expect(result.current.PERSON_LABEL_PRIMARY).toBe('학생');
  });

  it('returns DEFAULT_TERMS when tenantId is not available', async () => {
    vi.mocked(apiSdk.getApiContext).mockReturnValueOnce({
      tenantId: '',
      industryType: 'academy',
    } as ReturnType<typeof apiSdk.getApiContext>);

    const { result } = renderHook(() => useIndustryTerms(), {
      wrapper: createWrapper(),
    });

    // Should return default terms without making a query
    expect(result.current.PERSON_LABEL_PRIMARY).toBe('학생');
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });

  it('returns DEFAULT_TERMS when getApiContext throws', async () => {
    vi.mocked(apiSdk.getApiContext).mockImplementationOnce(() => {
      throw new Error('No context available');
    });

    const { result } = renderHook(() => useIndustryTerms(), {
      wrapper: createWrapper(),
    });

    // Should fall back to default terms
    expect(result.current.PERSON_LABEL_PRIMARY).toBe('학생');
  });

  it('returns salon terms with appointments visible', async () => {
    mockSupabaseSingle.mockResolvedValue({
      data: { industry_type: 'salon' },
      error: null,
    });

    const { result } = renderHook(() => useIndustryTerms(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.PERSON_LABEL_PRIMARY).toBe('고객');
    });

    expect(result.current.VISIBLE_PAGES.attendance).toBe(false);
    expect(result.current.VISIBLE_PAGES.appointments).toBe(true);
  });

  it('returns DEFAULT_TERMS when industry_type is null', async () => {
    mockSupabaseSingle.mockResolvedValue({
      data: { industry_type: null },
      error: null,
    });

    const { result } = renderHook(() => useIndustryTerms(), {
      wrapper: createWrapper(),
    });

    // null industry_type -> DEFAULT_TERMS
    expect(result.current.PERSON_LABEL_PRIMARY).toBe('학생');
  });
});

// ============================================================================
// Tests: useIndustryTermsWithType (direct type lookup)
// ============================================================================

describe('useIndustryTermsWithType', () => {
  it('returns academy terms for academy type', () => {
    const { result } = renderHook(() => useIndustryTermsWithType('academy'), {
      wrapper: createWrapper(),
    });

    expect(result.current.PERSON_LABEL_PRIMARY).toBe('학생');
    expect(result.current.PERSON_TYPE_PRIMARY).toBe('student');
  });

  it('returns gym terms for gym type', () => {
    const { result } = renderHook(() => useIndustryTermsWithType('gym'), {
      wrapper: createWrapper(),
    });

    expect(result.current.PERSON_LABEL_PRIMARY).toBe('회원');
    expect(result.current.PERSON_TYPE_PRIMARY).toBe('member');
  });

  it('returns salon terms for salon type', () => {
    const { result } = renderHook(() => useIndustryTermsWithType('salon'), {
      wrapper: createWrapper(),
    });

    expect(result.current.PERSON_LABEL_PRIMARY).toBe('고객');
    expect(result.current.PERSON_TYPE_SECONDARY).toBe('stylist');
  });

  it('falls back to academy terms for unknown type', () => {
    const { result } = renderHook(() => useIndustryTermsWithType('unknown'), {
      wrapper: createWrapper(),
    });

    // Unknown types fall back to academy
    expect(result.current.PERSON_LABEL_PRIMARY).toBe('학생');
  });
});

// ============================================================================
// Tests: Re-exported utilities
// ============================================================================

describe('getIndustryTerms', () => {
  it('returns correct terms for each supported industry', () => {
    expect(getIndustryTerms('academy').PERSON_LABEL_PRIMARY).toBe('학생');
    expect(getIndustryTerms('gym').PERSON_LABEL_PRIMARY).toBe('회원');
    expect(getIndustryTerms('salon').PERSON_LABEL_PRIMARY).toBe('고객');
  });

  it('falls back to academy for unsupported type', () => {
    const terms = getIndustryTerms('nonexistent');
    expect(terms.PERSON_LABEL_PRIMARY).toBe('학생');
  });
});

describe('isValidIndustryType', () => {
  it('returns true for supported types', () => {
    expect(isValidIndustryType('academy')).toBe(true);
    expect(isValidIndustryType('gym')).toBe(true);
    expect(isValidIndustryType('salon')).toBe(true);
  });

  it('returns false for unsupported types', () => {
    expect(isValidIndustryType('unknown')).toBe(false);
    expect(isValidIndustryType('')).toBe(false);
  });
});

describe('SUPPORTED_INDUSTRY_TYPES', () => {
  it('contains expected industry types', () => {
    expect(SUPPORTED_INDUSTRY_TYPES).toContain('academy');
    expect(SUPPORTED_INDUSTRY_TYPES).toContain('gym');
    expect(SUPPORTED_INDUSTRY_TYPES).toContain('salon');
  });

  it('is a non-empty array', () => {
    expect(Array.isArray(SUPPORTED_INDUSTRY_TYPES)).toBe(true);
    expect(SUPPORTED_INDUSTRY_TYPES.length).toBeGreaterThan(0);
  });
});
