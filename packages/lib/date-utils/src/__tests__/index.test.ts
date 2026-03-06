import { describe, it, expect } from 'vitest';
import { toKST, getTodayKST, getDateRangeKST } from '../index';

describe('toKST', () => {
  it('returns a dayjs object with .format() method', () => {
    const result = toKST();
    expect(result).toBeDefined();
    expect(typeof result.format).toBe('function');
  });

  it('converts UTC midnight to KST (+9 hours)', () => {
    // 2025-01-15 00:00 UTC → 2025-01-15 09:00 KST
    const result = toKST('2025-01-15T00:00:00Z');
    expect(result.format('YYYY-MM-DD')).toBe('2025-01-15');
    expect(result.format('HH')).toBe('09');
  });

  it('handles date crossing midnight boundary in KST', () => {
    // 2025-01-15 20:00 UTC → 2025-01-16 05:00 KST (next day)
    const result = toKST('2025-01-15T20:00:00Z');
    expect(result.format('YYYY-MM-DD')).toBe('2025-01-16');
    expect(result.format('HH')).toBe('05');
  });

  it('returns current time when called without arguments', () => {
    const before = Date.now();
    const result = toKST();
    const after = Date.now();
    const resultMs = result.valueOf();
    // The underlying timestamp should be between before and after
    expect(resultMs).toBeGreaterThanOrEqual(before);
    expect(resultMs).toBeLessThanOrEqual(after + 1);
  });

  it('accepts Date object as input', () => {
    const date = new Date('2025-06-01T12:00:00Z');
    const result = toKST(date);
    expect(result.format('YYYY-MM-DD')).toBe('2025-06-01');
    expect(result.format('HH')).toBe('21'); // 12:00 UTC → 21:00 KST
  });

  it('accepts epoch number as input', () => {
    // 2025-01-01T00:00:00Z in milliseconds
    const epoch = new Date('2025-01-01T00:00:00Z').getTime();
    const result = toKST(epoch);
    expect(result.format('YYYY-MM-DD')).toBe('2025-01-01');
    expect(result.format('HH')).toBe('09');
  });
});

describe('getTodayKST', () => {
  it('returns a string in YYYY-MM-DD format', () => {
    const result = getTodayKST();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches toKST().format("YYYY-MM-DD")', () => {
    const today = getTodayKST();
    const fromToKST = toKST().format('YYYY-MM-DD');
    expect(today).toBe(fromToKST);
  });
});

describe('getDateRangeKST', () => {
  it('returns { start, end } with string values', () => {
    const result = getDateRangeKST();
    expect(result).toHaveProperty('start');
    expect(result).toHaveProperty('end');
    expect(typeof result.start).toBe('string');
    expect(typeof result.end).toBe('string');
  });

  it('returns start === end === today when days=0', () => {
    const result = getDateRangeKST(0);
    const today = getTodayKST();
    expect(result.start).toBe(today);
    expect(result.end).toBe(today);
  });

  it('returns start 7 days before end when days=7', () => {
    const result = getDateRangeKST(7);
    const today = getTodayKST();
    expect(result.end).toBe(today);

    // Parse start and end, verify 7-day difference
    const startDate = new Date(result.start + 'T00:00:00');
    const endDate = new Date(result.end + 'T00:00:00');
    const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(7);
  });

  it('defaults to days=0 when no argument provided', () => {
    const defaultResult = getDateRangeKST();
    const zeroResult = getDateRangeKST(0);
    expect(defaultResult.start).toBe(zeroResult.start);
    expect(defaultResult.end).toBe(zeroResult.end);
  });

  it('returns start and end in YYYY-MM-DD format', () => {
    const result = getDateRangeKST(30);
    expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
