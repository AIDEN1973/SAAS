/**
 * Normalization Library Unit Tests
 *
 * Test scope:
 * - normalizePhoneNumber: Korean phone number normalization
 * - parseBirthDate: Various date format parsing to YYYY-MM-DD
 * - formatDateInput: Auto-hyphen insertion for date input
 *
 * Pure function tests - no JSX, no React hooks
 */

import { describe, it, expect } from 'vitest';
import { normalizePhoneNumber, parseBirthDate, formatDateInput } from '../index';

// ============================================================================
// Tests: normalizePhoneNumber
// ============================================================================

describe('normalizePhoneNumber', () => {
  // ---- null/empty handling ----

  it('returns null for null input', () => {
    expect(normalizePhoneNumber(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizePhoneNumber(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizePhoneNumber('')).toBeNull();
  });

  it('returns null for non-digit string', () => {
    expect(normalizePhoneNumber('abc')).toBeNull();
  });

  // ---- Mobile numbers (010) ----

  it('normalizes 11-digit mobile number without hyphens', () => {
    expect(normalizePhoneNumber('01029484417')).toBe('010-2948-4417');
  });

  it('preserves already formatted mobile number', () => {
    expect(normalizePhoneNumber('010-2948-4417')).toBe('010-2948-4417');
  });

  it('normalizes mobile number with spaces', () => {
    expect(normalizePhoneNumber('010 2948 4417')).toBe('010-2948-4417');
  });

  // ---- Old-style mobile numbers (016, 011, etc.) ----

  it('normalizes 10-digit old mobile number (016)', () => {
    expect(normalizePhoneNumber('0161234567')).toBe('016-123-4567');
  });

  it('normalizes 10-digit old mobile number (011)', () => {
    expect(normalizePhoneNumber('0111234567')).toBe('011-123-4567');
  });

  // ---- Seoul (02) ----

  it('normalizes 9-digit Seoul number', () => {
    expect(normalizePhoneNumber('021234567')).toBe('02-123-4567');
  });

  it('normalizes 10-digit Seoul number', () => {
    expect(normalizePhoneNumber('0212345678')).toBe('02-1234-5678');
  });

  it('preserves already formatted Seoul number', () => {
    expect(normalizePhoneNumber('02-1234-5678')).toBe('02-1234-5678');
  });

  // ---- Regional numbers (031, 051, etc.) ----

  it('normalizes 10-digit regional number (031)', () => {
    expect(normalizePhoneNumber('0311234567')).toBe('031-123-4567');
  });

  it('normalizes 11-digit regional number (031)', () => {
    expect(normalizePhoneNumber('03112345678')).toBe('031-1234-5678');
  });

  it('normalizes Busan regional number (051)', () => {
    expect(normalizePhoneNumber('0511234567')).toBe('051-123-4567');
  });

  it('normalizes Jeju regional number (064)', () => {
    expect(normalizePhoneNumber('0641234567')).toBe('064-123-4567');
  });

  // ---- Unknown format ----

  it('returns digits only for unknown format', () => {
    expect(normalizePhoneNumber('12345')).toBe('12345');
  });
});

// ============================================================================
// Tests: parseBirthDate
// ============================================================================

describe('parseBirthDate', () => {
  // ---- null/empty handling ----

  it('returns null for null input', () => {
    expect(parseBirthDate(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseBirthDate(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseBirthDate('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseBirthDate('   ')).toBeNull();
  });

  // ---- Already formatted ----

  it('returns YYYY-MM-DD as-is', () => {
    expect(parseBirthDate('2007-08-26')).toBe('2007-08-26');
  });

  // ---- 6-digit (YYMMDD) ----

  it('parses 6-digit YYMMDD format', () => {
    expect(parseBirthDate('070826')).toBe('2007-08-26');
  });

  it('parses 6-digit with leading zero year', () => {
    expect(parseBirthDate('000101')).toBe('2000-01-01');
  });

  // ---- 8-digit (YYYYMMDD) ----

  it('parses 8-digit YYYYMMDD format', () => {
    expect(parseBirthDate('20070826')).toBe('2007-08-26');
  });

  it('parses 8-digit with 1900s year', () => {
    expect(parseBirthDate('19951225')).toBe('1995-12-25');
  });

  // ---- Delimiter formats ----

  it('parses YY-MM-DD with hyphens', () => {
    expect(parseBirthDate('07-08-26')).toBe('2007-08-26');
  });

  it('parses YY.MM.DD with dots', () => {
    expect(parseBirthDate('07.08.26')).toBe('2007-08-26');
  });

  it('parses YYYY-MM-DD with hyphens', () => {
    expect(parseBirthDate('2007-08-26')).toBe('2007-08-26');
  });

  it('parses YYYY.MM.DD with dots', () => {
    expect(parseBirthDate('2007.08.26')).toBe('2007-08-26');
  });

  it('parses single-digit month/day with hyphens (pads with zero)', () => {
    expect(parseBirthDate('2007-8-6')).toBe('2007-08-06');
  });

  it('parses date with slash delimiter', () => {
    expect(parseBirthDate('2007/08/26')).toBe('2007-08-26');
  });

  // ---- Invalid dates ----

  it('returns null for invalid month (13)', () => {
    expect(parseBirthDate('20071326')).toBeNull();
  });

  it('returns null for invalid day (32)', () => {
    expect(parseBirthDate('20070832')).toBeNull();
  });

  it('returns null for February 30', () => {
    expect(parseBirthDate('20070230')).toBeNull();
  });

  it('returns null for completely invalid input', () => {
    expect(parseBirthDate('abcdefgh')).toBeNull();
  });
});

// ============================================================================
// Tests: formatDateInput
// ============================================================================

describe('formatDateInput', () => {
  it('returns empty string for empty input', () => {
    expect(formatDateInput('')).toBe('');
  });

  it('returns digits only for 1-2 characters', () => {
    expect(formatDateInput('20')).toBe('20');
  });

  it('inserts hyphen after 2 digits for 3-4 characters', () => {
    expect(formatDateInput('2007')).toBe('20-07');
  });

  it('formats 6-digit as YY-MM-DD', () => {
    expect(formatDateInput('070826')).toBe('07-08-26');
  });

  it('formats 8-digit as YYYY-MM-DD', () => {
    expect(formatDateInput('20070826')).toBe('2007-08-26');
  });

  it('strips non-digit characters before formatting', () => {
    expect(formatDateInput('20-07-08-26')).toBe('2007-08-26');
  });

  it('handles partial 5-digit input (YYYY-M format)', () => {
    expect(formatDateInput('20070')).toBe('2007-0');
  });

  it('returns empty for non-digit-only input', () => {
    expect(formatDateInput('abc')).toBe('');
  });

  it('formats 7-digit input as YYYY-MM-D', () => {
    expect(formatDateInput('2007082')).toBe('2007-08-2');
  });
});
