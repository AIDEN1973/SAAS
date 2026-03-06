/**
 * useMonthEndAdaptation Hook Unit Tests
 *
 * Test scope:
 * - isMonthEnd: detects month-end based on Policy threshold
 * - shouldPrioritizeBilling: billing card priority adjustment
 * - daysUntilMonthEnd: calculates remaining days
 * - Policy fallback: Fail-Closed when no policy exists
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

const mockUseConfig = vi.fn();

vi.mock('@hooks/use-config', () => ({
  useConfig: () => mockUseConfig(),
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

// ============================================================================
// Import (after mocks)
// ============================================================================

import { useMonthEndAdaptation } from '../useMonthEndAdaptation';

// ============================================================================
// Test Helpers
// ============================================================================

function setupDateMock(date: number, daysInMonth: number) {
  mockToKST.mockReturnValue({
    date: () => date,
    daysInMonth: () => daysInMonth,
    format: (fmt: string) => `2026-03-${String(date).padStart(2, '0')}`,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('useMonthEndAdaptation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: March 15th (mid-month), 31 days in month
    setupDateMock(15, 31);
    mockUseConfig.mockReturnValue({ data: { billing: { month_end_threshold_day: 25 } } });
  });

  it('returns isMonthEnd=false when date is before threshold', () => {
    setupDateMock(15, 31);
    mockUseConfig.mockReturnValue({ data: { billing: { month_end_threshold_day: 25 } } });

    const { result } = renderHook(() => useMonthEndAdaptation());

    expect(result.current.isMonthEnd).toBe(false);
    expect(result.current.shouldPrioritizeBilling).toBe(false);
  });

  it('returns isMonthEnd=true when date equals threshold', () => {
    setupDateMock(25, 31);
    mockUseConfig.mockReturnValue({ data: { billing: { month_end_threshold_day: 25 } } });

    const { result } = renderHook(() => useMonthEndAdaptation());

    expect(result.current.isMonthEnd).toBe(true);
    expect(result.current.shouldPrioritizeBilling).toBe(true);
  });

  it('returns isMonthEnd=true when date is after threshold', () => {
    setupDateMock(28, 31);
    mockUseConfig.mockReturnValue({ data: { billing: { month_end_threshold_day: 25 } } });

    const { result } = renderHook(() => useMonthEndAdaptation());

    expect(result.current.isMonthEnd).toBe(true);
    expect(result.current.shouldPrioritizeBilling).toBe(true);
  });

  it('calculates daysUntilMonthEnd correctly', () => {
    setupDateMock(28, 31);

    const { result } = renderHook(() => useMonthEndAdaptation());

    expect(result.current.daysUntilMonthEnd).toBe(3); // 31 - 28
  });

  it('returns daysUntilMonthEnd=0 on last day of month', () => {
    setupDateMock(31, 31);

    const { result } = renderHook(() => useMonthEndAdaptation());

    expect(result.current.daysUntilMonthEnd).toBe(0);
  });

  it('returns isMonthEnd=false when config has no billing section (Fail Closed)', () => {
    setupDateMock(28, 31);
    mockUseConfig.mockReturnValue({ data: {} });

    const { result } = renderHook(() => useMonthEndAdaptation());

    expect(result.current.isMonthEnd).toBe(false);
    expect(result.current.shouldPrioritizeBilling).toBe(false);
  });

  it('returns isMonthEnd=false when config is null (Fail Closed)', () => {
    setupDateMock(28, 31);
    mockUseConfig.mockReturnValue({ data: null });

    const { result } = renderHook(() => useMonthEndAdaptation());

    expect(result.current.isMonthEnd).toBe(false);
    expect(result.current.shouldPrioritizeBilling).toBe(false);
  });

  it('returns isMonthEnd=false when threshold is not a number (Fail Closed)', () => {
    setupDateMock(28, 31);
    mockUseConfig.mockReturnValue({ data: { billing: { month_end_threshold_day: 'invalid' } } });

    const { result } = renderHook(() => useMonthEndAdaptation());

    expect(result.current.isMonthEnd).toBe(false);
  });

  it('handles February (28 days) correctly', () => {
    setupDateMock(25, 28);
    mockUseConfig.mockReturnValue({ data: { billing: { month_end_threshold_day: 25 } } });

    const { result } = renderHook(() => useMonthEndAdaptation());

    expect(result.current.isMonthEnd).toBe(true);
    expect(result.current.daysUntilMonthEnd).toBe(3); // 28 - 25
  });

  it('shouldPrioritizeBilling mirrors isMonthEnd', () => {
    // When isMonthEnd is true
    setupDateMock(26, 31);
    mockUseConfig.mockReturnValue({ data: { billing: { month_end_threshold_day: 25 } } });

    const { result: resultTrue } = renderHook(() => useMonthEndAdaptation());
    expect(resultTrue.current.shouldPrioritizeBilling).toBe(resultTrue.current.isMonthEnd);

    // When isMonthEnd is false
    setupDateMock(10, 31);
    const { result: resultFalse } = renderHook(() => useMonthEndAdaptation());
    expect(resultFalse.current.shouldPrioritizeBilling).toBe(resultFalse.current.isMonthEnd);
  });
});
