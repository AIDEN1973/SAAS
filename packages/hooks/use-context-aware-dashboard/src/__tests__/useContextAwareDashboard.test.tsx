/**
 * useContextAwareDashboard Hook Unit Tests
 *
 * Test scope:
 * - timeOfDay: morning/afternoon/evening/night classification
 * - dayOfWeek: KST-based day of week detection
 * - isMonthEnd: Policy-driven month-end detection (Fail Closed)
 * - isWeekend: weekend detection
 * - hasUpcomingClasses / hasFinishedClasses: class schedule awareness
 * - recommendedActions: context-based action recommendations
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

const mockToKST = vi.fn();

vi.mock('@lib/date-utils', () => ({
  toKST: (...args: unknown[]) => mockToKST(...args),
}));

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
}));

const mockUseTenantSettingByPath = vi.fn();
vi.mock('@hooks/use-config', () => ({
  useTenantSettingByPath: (path: string) => mockUseTenantSettingByPath(path),
}));

const mockUseClasses = vi.fn();
vi.mock('@hooks/use-class', () => ({
  useClasses: (filter: unknown) => mockUseClasses(filter),
}));

// ============================================================================
// Import (after mocks)
// ============================================================================

import { useContextAwareDashboard } from '../index';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a dayjs-like mock object for toKST
 */
function createDayjsMock(hour: number, day: number, date: number) {
  const self = {
    hour: (h?: number) => {
      if (h !== undefined) {
        return createDayjsMock(h, day, date);
      }
      return hour;
    },
    day: () => day,
    date: () => date,
    minute: (m?: number) => {
      if (m !== undefined) {
        return { ...self, second: () => ({ millisecond: () => self }), isAfter: () => false, diff: () => 0, add: () => self, valueOf: () => 0 };
      }
      return 0;
    },
    second: () => self,
    millisecond: () => self,
    isAfter: () => false,
    diff: () => 0,
    add: () => self,
    valueOf: () => 0,
    format: () => '2026-03-06',
  };
  return self;
}

// ============================================================================
// Tests
// ============================================================================

describe('useContextAwareDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Tuesday (2), March 10, 10:00 AM
    mockToKST.mockReturnValue(createDayjsMock(10, 2, 10));
    mockUseTenantSettingByPath.mockReturnValue({ data: undefined });
    mockUseClasses.mockReturnValue({ data: [] });
  });

  // ---- timeOfDay ----

  it('returns timeOfDay=morning for hour 6-11', () => {
    mockToKST.mockReturnValue(createDayjsMock(8, 2, 10));

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.timeOfDay).toBe('morning');
  });

  it('returns timeOfDay=afternoon for hour 12-17', () => {
    mockToKST.mockReturnValue(createDayjsMock(14, 2, 10));

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.timeOfDay).toBe('afternoon');
  });

  it('returns timeOfDay=evening for hour 18-21', () => {
    mockToKST.mockReturnValue(createDayjsMock(20, 2, 10));

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.timeOfDay).toBe('evening');
  });

  it('returns timeOfDay=night for hour 22-5', () => {
    mockToKST.mockReturnValue(createDayjsMock(23, 2, 10));

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.timeOfDay).toBe('night');
  });

  it('returns timeOfDay=night for hour 3 (early morning)', () => {
    mockToKST.mockReturnValue(createDayjsMock(3, 2, 10));

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.timeOfDay).toBe('night');
  });

  // ---- isWeekend ----

  it('returns isWeekend=true for Sunday (day=0)', () => {
    mockToKST.mockReturnValue(createDayjsMock(10, 0, 10));

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.isWeekend).toBe(true);
  });

  it('returns isWeekend=true for Saturday (day=6)', () => {
    mockToKST.mockReturnValue(createDayjsMock(10, 6, 10));

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.isWeekend).toBe(true);
  });

  it('returns isWeekend=false for weekdays', () => {
    mockToKST.mockReturnValue(createDayjsMock(10, 3, 10)); // Wednesday

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.isWeekend).toBe(false);
  });

  // ---- isMonthEnd (Fail Closed) ----

  it('returns isMonthEnd=false when no policy exists (Fail Closed)', () => {
    mockToKST.mockReturnValue(createDayjsMock(10, 2, 28));
    mockUseTenantSettingByPath.mockReturnValue({ data: undefined });

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.isMonthEnd).toBe(false);
  });

  it('returns isMonthEnd=true when date >= policy threshold', () => {
    mockToKST.mockReturnValue(createDayjsMock(10, 2, 26));
    mockUseTenantSettingByPath.mockReturnValue({ data: 25 });

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.isMonthEnd).toBe(true);
  });

  it('returns isMonthEnd=false when date < policy threshold', () => {
    mockToKST.mockReturnValue(createDayjsMock(10, 2, 20));
    mockUseTenantSettingByPath.mockReturnValue({ data: 25 });

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.isMonthEnd).toBe(false);
  });

  // ---- dayOfWeek ----

  it('returns correct dayOfWeek for Monday (day=1)', () => {
    mockToKST.mockReturnValue(createDayjsMock(10, 1, 10));

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.dayOfWeek).toBe('monday');
  });

  it('returns correct dayOfWeek for Friday (day=5)', () => {
    mockToKST.mockReturnValue(createDayjsMock(10, 5, 10));

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.dayOfWeek).toBe('friday');
  });

  // ---- recommendedActions ----

  it('recommends billing action when isMonthEnd is true', () => {
    mockToKST.mockReturnValue(createDayjsMock(10, 2, 26));
    mockUseTenantSettingByPath.mockReturnValue({ data: 25 });

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.recommendedActions).toContain('이번 달 청구서 확인');
  });

  it('returns empty actions when no context triggers apply', () => {
    mockToKST.mockReturnValue(createDayjsMock(14, 2, 10)); // afternoon, mid-month
    mockUseTenantSettingByPath.mockReturnValue({ data: undefined });
    mockUseClasses.mockReturnValue({ data: [] });

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.recommendedActions).toEqual([]);
  });

  // ---- hasUpcomingClasses / hasFinishedClasses default ----

  it('returns hasUpcomingClasses=false when no classes exist', () => {
    mockUseClasses.mockReturnValue({ data: [] });

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.hasUpcomingClasses).toBe(false);
  });

  it('returns hasFinishedClasses=false when no classes exist', () => {
    mockUseClasses.mockReturnValue({ data: [] });

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.hasFinishedClasses).toBe(false);
  });

  it('returns hasUpcomingClasses=false when data is null', () => {
    mockUseClasses.mockReturnValue({ data: null });

    const { result } = renderHook(() => useContextAwareDashboard());
    expect(result.current.hasUpcomingClasses).toBe(false);
  });
});
