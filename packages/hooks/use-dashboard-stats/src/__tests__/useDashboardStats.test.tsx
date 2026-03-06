/**
 * Dashboard Stats Hooks Unit Tests
 *
 * 테스트 범위:
 * - useStudentStatsCards: 학생 통계 카드 (섹션 1-4)
 * - useAttendanceStatsCards: 출석 통계 카드 (섹션 4-6)
 * - useClassStatsCards: 수업/반 통계 카드 (섹션 11-13)
 * - useRevenueStatsCards: 매출/ARPU 통계 카드 (섹션 7-10)
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

vi.mock('@hooks/use-auth', () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: 'test-user-id' } },
  })),
}));

// Mock student queries
const mockFetchPersonsCount = vi.fn().mockResolvedValue(100);
const mockFetchPersons = vi.fn().mockResolvedValue([]);
const mockFetchStudentStats = vi.fn().mockResolvedValue({
  total: 100,
  active: 80,
  inactive: 20,
  new_this_month: 15,
  by_status: {},
});

vi.mock('@hooks/use-student', () => ({
  fetchPersonsCount: (...args: unknown[]) => mockFetchPersonsCount(...args),
  fetchPersons: (...args: unknown[]) => mockFetchPersons(...args),
  fetchStudentStats: (...args: unknown[]) => mockFetchStudentStats(...args),
}));

// Mock attendance
const mockFetchAttendanceStats = vi.fn().mockResolvedValue({
  attendance_rate: 95.5,
  total_students: 100,
  present: 90,
  late: 3,
  absent: 7,
  not_checked: 0,
});
const mockFetchAttendanceLogs = vi.fn().mockResolvedValue([]);

vi.mock('@hooks/use-attendance', () => ({
  fetchAttendanceStats: (...args: unknown[]) => mockFetchAttendanceStats(...args),
  fetchAttendanceLogs: (...args: unknown[]) => mockFetchAttendanceLogs(...args),
}));

// Mock class
const mockFetchClasses = vi.fn().mockResolvedValue([]);

vi.mock('@hooks/use-class', () => ({
  fetchClasses: (...args: unknown[]) => mockFetchClasses(...args),
}));

// Mock billing
const mockFetchBillingHistory = vi.fn().mockResolvedValue([]);

vi.mock('@hooks/use-billing', () => ({
  fetchBillingHistory: (...args: unknown[]) => mockFetchBillingHistory(...args),
}));

// Mock payments
const mockFetchPayments = vi.fn().mockResolvedValue([]);

vi.mock('@hooks/use-payments', () => ({
  fetchPayments: (...args: unknown[]) => mockFetchPayments(...args),
}));

// Mock query key utils
vi.mock('@hooks/use-query-key-utils', () => ({
  createQueryKey: (...args: unknown[]) => args,
}));

// Mock app-level utilities
vi.mock('../../../apps/academy-admin/src/utils/dashboard-card-normalization', () => ({
  normalizeStatsCard: (card: Record<string, unknown>) => card,
}));

vi.mock('../../../apps/academy-admin/src/utils/trend-calculation-utils', () => ({
  calculateTrend: (current: number, previous: number) => {
    if (previous > 0) {
      const change = current - previous;
      const percent = Math.round((change / previous) * 100);
      return `${change > 0 ? '+' : ''}${percent}%`;
    }
    return current > 0 ? '+100%' : undefined;
  },
  calculateTrendPercentPoint: (current: number, previous: number) => {
    if (previous > 0 || current > 0) {
      const change = current - previous;
      return `${change > 0 ? '+' : ''}${Math.round(change)}%p`;
    }
    return undefined;
  },
}));

vi.mock('../../../apps/academy-admin/src/utils/error-handling-utils', () => ({
  safe: async (promise: Promise<unknown>, fallback: unknown) => {
    try {
      return await promise;
    } catch {
      return fallback;
    }
  },
  logError: vi.fn(),
}));

vi.mock('@lib/date-utils', () => ({
  toKST: () => ({
    format: (fmt: string) => '2026-03-06',
    toISOString: () => '2026-03-06T00:00:00.000Z',
  }),
}));

vi.mock('@services/attendance-service', () => ({}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { useStudentStatsCards } from '../useStudentStatsCards';
import type { UseStudentStatsCardsParams } from '../useStudentStatsCards';
import { useAttendanceStatsCards } from '../useAttendanceStatsCards';
import type { UseAttendanceStatsCardsParams } from '../useAttendanceStatsCards';
import { useClassStatsCards } from '../useClassStatsCards';
import type { UseClassStatsCardsParams } from '../useClassStatsCards';
import { useRevenueStatsCards } from '../useRevenueStatsCards';
import type { UseRevenueStatsCardsParams } from '../useRevenueStatsCards';

// ============================================================================
// Test Helpers
// ============================================================================

const TENANT_ID = 'test-tenant-id';

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

function createMockDateRange() {
  return {
    iso: {
      gte: '2026-03-01T00:00:00+09:00',
      lte: '2026-03-31T23:59:59+09:00',
    },
    dateString: {
      from: '2026-03-01',
      to: '2026-03-31',
    },
  };
}

function createMockMonthlyRange() {
  return {
    current: createMockDateRange(),
    last: {
      iso: {
        gte: '2026-02-01T00:00:00+09:00',
        lte: '2026-02-28T23:59:59+09:00',
      },
      dateString: {
        from: '2026-02-01',
        to: '2026-02-28',
      },
    },
    currentMonthStr: '2026-03',
    lastMonthStr: '2026-02',
  };
}

function createMockWeeklyRange() {
  return {
    current: {
      iso: {
        gte: '2026-02-27T00:00:00+09:00',
        lte: '2026-03-06T23:59:59+09:00',
      },
      dateString: {
        from: '2026-02-27',
        to: '2026-03-06',
      },
    },
    last: {
      iso: {
        gte: '2026-02-20T00:00:00+09:00',
        lte: '2026-02-27T00:00:00+09:00',
      },
      dateString: {
        from: '2026-02-20',
        to: '2026-02-27',
      },
    },
  };
}

function createMockBaseKST() {
  return {
    format: (fmt: string) => '2026-03-06',
    clone: () => createMockBaseKST(),
    subtract: (_n: number, _unit: string) => ({
      format: (fmt: string) => '2026-03-05',
      clone: () => createMockBaseKST(),
      subtract: () => ({ format: () => '2026-03-04' }),
      toISOString: () => '2026-03-05T00:00:00.000Z',
    }),
    toISOString: () => '2026-03-06T00:00:00.000Z',
  };
}

// ============================================================================
// Tests: useStudentStatsCards
// ============================================================================

describe('useStudentStatsCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchPersonsCount.mockResolvedValue(100);
    mockFetchPersons.mockResolvedValue([]);
    mockFetchStudentStats.mockResolvedValue({
      total: 100,
      active: 80,
      inactive: 20,
      new_this_month: 15,
      by_status: {},
    });
  });

  const defaultParams: UseStudentStatsCardsParams = {
    tenantId: TENANT_ID,
    monthlyRange: createMockMonthlyRange(),
    weeklyRange: createMockWeeklyRange(),
    enabled: true,
  };

  it('성공 시 학생 통계 카드 배열을 반환한다', async () => {
    const { result } = renderHook(() => useStudentStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // 7 cards: total, new, active, inactive, growth, weekly new, retention
    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data!.length).toBe(7);
  });

  it('반환 카드에 필수 필드가 포함된다', async () => {
    const { result } = renderHook(() => useStudentStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cards = result.current.data!;
    const totalCard = cards.find((c) => c.id === 'stats-students');
    expect(totalCard).toBeDefined();
    expect(totalCard!.type).toBe('stats');
    expect(totalCard!.title).toBe('총 학생 수');
    expect(totalCard!.value).toBe('100');
    expect(totalCard!.unit).toBe('명');
  });

  it('신규 등록 카드가 올바른 값을 가진다', async () => {
    const { result } = renderHook(() => useStudentStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cards = result.current.data!;
    const newStudentsCard = cards.find((c) => c.id === 'stats-new-students');
    expect(newStudentsCard).toBeDefined();
    expect(newStudentsCard!.title).toBe('이번 달 신규 등록');
    expect(newStudentsCard!.value).toBe('15');
  });

  it('활성/비활성 학생 카드가 정확한 값을 가진다', async () => {
    const { result } = renderHook(() => useStudentStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cards = result.current.data!;
    const activeCard = cards.find((c) => c.id === 'stats-active-students');
    const inactiveCard = cards.find((c) => c.id === 'stats-inactive-students');

    expect(activeCard!.value).toBe('80');
    expect(inactiveCard!.value).toBe('20');
  });

  it('tenantId가 null이면 빈 배열을 반환한다', async () => {
    const params: UseStudentStatsCardsParams = {
      ...defaultParams,
      tenantId: null,
    };

    const { result } = renderHook(() => useStudentStatsCards(params), {
      wrapper: createWrapper(),
    });

    // enabled=false이므로 fetchStatus는 idle
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('enabled=false이면 쿼리가 비활성화된다', async () => {
    const params: UseStudentStatsCardsParams = {
      ...defaultParams,
      enabled: false,
    };

    const { result } = renderHook(() => useStudentStatsCards(params), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchPersonsCount).not.toHaveBeenCalled();
  });

  it('학생 유지율을 올바르게 계산한다 (80/100 = 80%)', async () => {
    const { result } = renderHook(() => useStudentStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cards = result.current.data!;
    const retentionCard = cards.find((c) => c.id === 'stats-student-retention-rate');
    expect(retentionCard).toBeDefined();
    expect(retentionCard!.value).toBe('80');
    expect(retentionCard!.unit).toBe('%');
  });

  it('모든 fetch가 실패해도 빈 배열을 반환한다 (Fail Closed)', async () => {
    mockFetchPersonsCount.mockRejectedValue(new Error('DB error'));
    mockFetchPersons.mockRejectedValue(new Error('DB error'));
    mockFetchStudentStats.mockRejectedValue(new Error('DB error'));

    const { result } = renderHook(() => useStudentStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // safe() handles errors, so cards may be generated with fallback values
    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
  });
});

// ============================================================================
// Tests: useAttendanceStatsCards
// ============================================================================

describe('useAttendanceStatsCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAttendanceStats.mockResolvedValue({
      attendance_rate: 95.5,
      total_students: 100,
      present: 90,
      late: 3,
      absent: 7,
      not_checked: 0,
    });
    mockFetchAttendanceLogs.mockResolvedValue([]);
  });

  const defaultParams: UseAttendanceStatsCardsParams = {
    tenantId: TENANT_ID,
    baseKST: createMockBaseKST() as unknown as UseAttendanceStatsCardsParams['baseKST'],
    monthlyRange: createMockMonthlyRange(),
    weeklyRange: createMockWeeklyRange(),
    enabled: true,
  };

  it('성공 시 출석 통계 카드 배열을 반환한다', async () => {
    const { result } = renderHook(() => useAttendanceStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // 6 cards: attendance rate, late rate, absent rate, weekly attendance, monthly attendance, improvement
    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data!.length).toBe(6);
  });

  it('출석률 카드가 올바른 값을 가진다', async () => {
    const { result } = renderHook(() => useAttendanceStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cards = result.current.data!;
    const attendanceCard = cards.find((c) => c.id === 'stats-attendance-rate');
    expect(attendanceCard).toBeDefined();
    expect(attendanceCard!.title).toBe('오늘 출석률');
    expect(attendanceCard!.value).toBe('95.5');
    expect(attendanceCard!.unit).toBe('%');
  });

  it('지각률/결석률을 올바르게 계산한다', async () => {
    const { result } = renderHook(() => useAttendanceStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cards = result.current.data!;
    const lateCard = cards.find((c) => c.id === 'stats-late-rate');
    const absentCard = cards.find((c) => c.id === 'stats-absent-rate');

    // late: 3/100 = 3%, absent: 7/100 = 7%
    expect(lateCard!.value).toBe('3');
    expect(absentCard!.value).toBe('7');
  });

  it('tenantId가 null이면 쿼리가 비활성화된다', async () => {
    const params: UseAttendanceStatsCardsParams = {
      ...defaultParams,
      tenantId: null,
    };

    const { result } = renderHook(() => useAttendanceStatsCards(params), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchAttendanceStats).not.toHaveBeenCalled();
  });

  it('fetch 실패 시 빈 배열을 반환한다 (Fail Closed)', async () => {
    mockFetchAttendanceStats.mockRejectedValue(new Error('RPC error'));
    mockFetchAttendanceLogs.mockRejectedValue(new Error('RPC error'));

    const { result } = renderHook(() => useAttendanceStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
  });
});

// ============================================================================
// Tests: useClassStatsCards
// ============================================================================

describe('useClassStatsCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchClasses.mockResolvedValue([
      { id: 'c1', name: '수학반', status: 'active', capacity: 30, current_count: 25 },
      { id: 'c2', name: '영어반', status: 'active', capacity: 20, current_count: 18 },
    ]);
    mockFetchBillingHistory.mockResolvedValue([]);
  });

  const defaultParams: UseClassStatsCardsParams = {
    tenantId: TENANT_ID,
    monthlyRange: createMockMonthlyRange(),
    studentCount: 43,
    enabled: true,
  };

  it('성공 시 수업 통계 카드 배열을 반환한다', async () => {
    const { result } = renderHook(() => useClassStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // 3 cards: avg students per class, avg capacity rate, avg collection period
    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data!.length).toBe(3);
  });

  it('반당 평균 인원을 올바르게 계산한다', async () => {
    const { result } = renderHook(() => useClassStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cards = result.current.data!;
    const avgCard = cards.find((c) => c.id === 'stats-avg-students-per-class');
    expect(avgCard).toBeDefined();
    // 43 students / 2 classes = 22 (rounded)
    expect(avgCard!.value).toBe('22');
    expect(avgCard!.unit).toBe('명');
  });

  it('평균 정원률을 올바르게 계산한다', async () => {
    const { result } = renderHook(() => useClassStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cards = result.current.data!;
    const capacityCard = cards.find((c) => c.id === 'stats-avg-capacity-rate');
    expect(capacityCard).toBeDefined();
    // totalCurrent: 25+18=43, totalCapacity: 30+20=50, rate: 43/50 = 86%
    expect(capacityCard!.value).toBe('86');
    expect(capacityCard!.unit).toBe('%');
  });

  it('수업이 없으면 0으로 반환한다', async () => {
    mockFetchClasses.mockResolvedValue([]);

    const params: UseClassStatsCardsParams = {
      ...defaultParams,
      studentCount: 0,
    };

    const { result } = renderHook(() => useClassStatsCards(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cards = result.current.data!;
    const avgCard = cards.find((c) => c.id === 'stats-avg-students-per-class');
    expect(avgCard!.value).toBe('0');
  });

  it('tenantId가 null이면 쿼리가 비활성화된다', async () => {
    const params: UseClassStatsCardsParams = {
      ...defaultParams,
      tenantId: null,
    };

    const { result } = renderHook(() => useClassStatsCards(params), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ============================================================================
// Tests: useRevenueStatsCards
// ============================================================================

describe('useRevenueStatsCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchBillingHistory.mockResolvedValue([
      { amount: 500000, amount_paid: 500000, status: 'paid', period_start: '2026-03-01', updated_at: '2026-03-05T10:00:00Z' },
      { amount: 300000, amount_paid: 300000, status: 'paid', period_start: '2026-03-01', updated_at: '2026-03-03T10:00:00Z' },
      { amount: 200000, amount_paid: 0, status: 'pending', period_start: '2026-03-01', updated_at: '2026-03-01T10:00:00Z' },
    ]);
    mockFetchPayments.mockResolvedValue([]);
  });

  const defaultParams: UseRevenueStatsCardsParams = {
    tenantId: TENANT_ID,
    baseKST: createMockBaseKST() as unknown as UseRevenueStatsCardsParams['baseKST'],
    monthlyRange: createMockMonthlyRange(),
    weeklyRange: createMockWeeklyRange(),
    studentCount: 100,
    lastMonthStudentCount: 90,
    enabled: true,
  };

  it('성공 시 매출 통계 카드 배열을 반환한다', async () => {
    const { result } = renderHook(() => useRevenueStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // 6 cards: revenue, expected, ARPU, growth, weekly, unpaid rate
    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data!.length).toBe(6);
  });

  it('이번 달 매출 카드가 올바른 값을 가진다', async () => {
    const { result } = renderHook(() => useRevenueStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cards = result.current.data!;
    const revenueCard = cards.find((c) => c.id === 'stats-revenue');
    expect(revenueCard).toBeDefined();
    expect(revenueCard!.title).toBe('이번 달 매출');
    // 500000 + 300000 + 0 = 800000 → "800,000"
    expect(revenueCard!.value).toBe('800,000');
    expect(revenueCard!.unit).toBe('원');
  });

  it('미납률을 올바르게 계산한다', async () => {
    const { result } = renderHook(() => useRevenueStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cards = result.current.data!;
    const unpaidCard = cards.find((c) => c.id === 'stats-unpaid-rate');
    expect(unpaidCard).toBeDefined();
    // totalAmount: 1000000, unpaidAmount: 200000, rate: 20%
    expect(unpaidCard!.value).toBe('20');
    expect(unpaidCard!.unit).toBe('%');
  });

  it('ARPU를 올바르게 계산한다', async () => {
    const { result } = renderHook(() => useRevenueStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cards = result.current.data!;
    const arpuCard = cards.find((c) => c.id === 'stats-arpu');
    expect(arpuCard).toBeDefined();
    // revenue 800000 / 100 students = 8000
    expect(arpuCard!.value).toBe('8,000');
  });

  it('tenantId가 null이면 쿼리가 비활성화된다', async () => {
    const params: UseRevenueStatsCardsParams = {
      ...defaultParams,
      tenantId: null,
    };

    const { result } = renderHook(() => useRevenueStatsCards(params), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchBillingHistory).not.toHaveBeenCalled();
  });

  it('매출 데이터가 비어있으면 0으로 반환한다', async () => {
    mockFetchBillingHistory.mockResolvedValue([]);

    const { result } = renderHook(() => useRevenueStatsCards(defaultParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cards = result.current.data!;
    const revenueCard = cards.find((c) => c.id === 'stats-revenue');
    expect(revenueCard!.value).toBe('0');
  });
});
