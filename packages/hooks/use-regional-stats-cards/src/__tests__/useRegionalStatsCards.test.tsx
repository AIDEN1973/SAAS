/**
 * useRegionalStatsCards Hook Unit Tests
 *
 * Tests:
 * - Returns 3 cards (students, revenue, attendance)
 * - Correct card shape and fields
 * - Query disabled when tenantId missing
 * - Student count calculated from fetchPersons
 * - Revenue calculated from billing (amount_paid sum)
 * - Attendance rate calculated from logs
 * - Default comparisonGroup is 'insufficient'
 * - Error handling (empty data fallback)
 * - topPercentLabel generation
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockGetApiContext = vi.fn(() => ({
  tenantId: 'test-tenant-id',
  industryType: 'academy',
  region: 'Gangnam-gu',
}));

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    callRPC: vi.fn(),
  },
  getApiContext: (...args: unknown[]) => mockGetApiContext(...args),
}));

// Mock student fetch
const mockFetchPersons = vi.fn();

vi.mock('@hooks/use-student', () => ({
  fetchPersons: (...args: unknown[]) => mockFetchPersons(...args),
}));

// Mock billing fetch
const mockFetchBillingHistory = vi.fn();

vi.mock('@hooks/use-billing', () => ({
  fetchBillingHistory: (...args: unknown[]) => mockFetchBillingHistory(...args),
}));

// Mock attendance fetch
const mockFetchAttendanceLogs = vi.fn();

vi.mock('@hooks/use-attendance', () => ({
  fetchAttendanceLogs: (...args: unknown[]) => mockFetchAttendanceLogs(...args),
}));

// Mock region metrics fetch
const mockFetchDailyRegionMetrics = vi.fn();

vi.mock('@hooks/use-daily-region-metrics', () => ({
  fetchDailyRegionMetrics: (...args: unknown[]) => mockFetchDailyRegionMetrics(...args),
}));

// Mock date-utils
vi.mock('@lib/date-utils', () => ({
  toKST: () => ({
    format: (fmt: string) => {
      if (fmt === 'YYYY-MM') return '2026-03';
      if (fmt === 'YYYY-MM-DD') return '2026-03-06';
      return '2026-03-06';
    },
  }),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { useRegionalStatsCards } from '../useRegionalStatsCards';

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
// Tests
// ============================================================================

describe('useRegionalStatsCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiContext.mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
      region: 'Gangnam-gu',
    });

    // Default: 10 students
    mockFetchPersons.mockResolvedValue([
      { id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }, { id: 's5' },
      { id: 's6' }, { id: 's7' }, { id: 's8' }, { id: 's9' }, { id: 's10' },
    ]);

    // Default: 2 billing records totaling 800,000
    mockFetchBillingHistory.mockResolvedValue([
      { amount: 500000, amount_paid: 500000, status: 'paid' },
      { amount: 300000, amount_paid: 300000, status: 'paid' },
    ]);

    // Default: 8 present out of 10 logs => 80% attendance
    mockFetchAttendanceLogs.mockResolvedValue([
      { id: 'a1', status: 'present' },
      { id: 'a2', status: 'present' },
      { id: 'a3', status: 'present' },
      { id: 'a4', status: 'present' },
      { id: 'a5', status: 'present' },
      { id: 'a6', status: 'present' },
      { id: 'a7', status: 'present' },
      { id: 'a8', status: 'present' },
      { id: 'a9', status: 'absent' },
      { id: 'a10', status: 'late' },
    ]);

    mockFetchDailyRegionMetrics.mockResolvedValue([]);
  });

  it('returns 3 cards on success', async () => {
    const { result } = renderHook(() => useRegionalStatsCards(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data).toHaveLength(3);
  });

  it('returns students card with correct count', async () => {
    const { result } = renderHook(() => useRegionalStatsCards(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const studentCard = result.current.data!.find(c => c.metric === 'students');
    expect(studentCard).toBeDefined();
    expect(studentCard!.value).toBe(10);
    expect(studentCard!.label).toBe('학생 수');
    expect(studentCard!.region).toBe('Gangnam-gu');
  });

  it('returns revenue card with correct sum of amount_paid', async () => {
    const { result } = renderHook(() => useRegionalStatsCards(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const revenueCard = result.current.data!.find(c => c.metric === 'revenue');
    expect(revenueCard).toBeDefined();
    expect(revenueCard!.value).toBe(800000);
    expect(revenueCard!.unit).toBe('원');
  });

  it('returns attendance card with correct rate', async () => {
    const { result } = renderHook(() => useRegionalStatsCards(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const attendanceCard = result.current.data!.find(c => c.metric === 'attendance');
    expect(attendanceCard).toBeDefined();
    // 8 present out of 10 = 80%
    expect(attendanceCard!.value).toBe(80);
    expect(attendanceCard!.unit).toBe('%');
  });

  it('all cards have comparisonGroup "insufficient" by default', async () => {
    const { result } = renderHook(() => useRegionalStatsCards(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    result.current.data!.forEach(card => {
      expect(card.comparisonGroup).toBe('insufficient');
      expect(card.comparisonGroupLabel).toBe('데이터 부족');
    });
  });

  it('query is disabled when tenantId is missing', () => {
    mockGetApiContext.mockReturnValue({
      tenantId: '',
      industryType: 'academy',
      region: '',
    });

    const { result } = renderHook(() => useRegionalStatsCards(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchPersons).not.toHaveBeenCalled();
  });

  it('returns 0 attendance rate when no logs exist', async () => {
    mockFetchAttendanceLogs.mockResolvedValue([]);

    const { result } = renderHook(() => useRegionalStatsCards(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const attendanceCard = result.current.data!.find(c => c.metric === 'attendance');
    expect(attendanceCard!.value).toBe(0);
  });

  it('returns 0 student count when no students exist', async () => {
    mockFetchPersons.mockResolvedValue([]);

    const { result } = renderHook(() => useRegionalStatsCards(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const studentCard = result.current.data!.find(c => c.metric === 'students');
    expect(studentCard!.value).toBe(0);
  });

  it('returns 0 revenue when no billing records exist', async () => {
    mockFetchBillingHistory.mockResolvedValue([]);

    const { result } = renderHook(() => useRegionalStatsCards(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const revenueCard = result.current.data!.find(c => c.metric === 'revenue');
    expect(revenueCard!.value).toBe(0);
  });

  it('calls fetchPersons with correct tenantId and person_type filter', async () => {
    const { result } = renderHook(() => useRegionalStatsCards(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetchPersons).toHaveBeenCalledWith('test-tenant-id', { person_type: 'student' });
  });

  it('calls fetchBillingHistory with correct date filter', async () => {
    const { result } = renderHook(() => useRegionalStatsCards(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetchBillingHistory).toHaveBeenCalledWith('test-tenant-id', {
      period_start: { gte: '2026-03-01' },
    });
  });

  it('uses empty string for region when context.region is not set', async () => {
    mockGetApiContext.mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });

    const { result } = renderHook(() => useRegionalStatsCards(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    result.current.data!.forEach(card => {
      expect(card.region).toBe('');
    });
  });
});
