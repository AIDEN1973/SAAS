/**
 * Korean Phone Number Formatter Tests
 *
 * formatKoreanPhoneNumber: raw input -> hyphenated Korean phone number
 */
import { describe, it, expect } from 'vitest';
import { formatKoreanPhoneNumber } from '../core/formatKoreanPhoneNumber';

describe('formatKoreanPhoneNumber', () => {
  // -- mobile numbers (010, 011, 016, 017, 018, 019) --
  describe('mobile numbers (3-digit prefix)', () => {
    it.each([
      { input: '01029484417', expected: '010-2948-4417' },
      { input: '01012345678', expected: '010-1234-5678' },
      { input: '0111234567', expected: '011-123-4567' },
      { input: '01612345678', expected: '016-1234-5678' },
    ])('formats $input as $expected', ({ input, expected }) => {
      expect(formatKoreanPhoneNumber(input)).toBe(expected);
    });
  });

  // -- Seoul landline (02) --
  describe('Seoul landline (2-digit prefix: 02)', () => {
    it.each([
      { input: '0212345678', expected: '02-1234-5678' },
      { input: '021234567', expected: '02-123-4567' },
    ])('formats $input as $expected', ({ input, expected }) => {
      expect(formatKoreanPhoneNumber(input)).toBe(expected);
    });
  });

  // -- regional landlines (3-digit prefix: 031, 032, ...) --
  describe('regional landlines (3-digit prefix)', () => {
    it.each([
      { input: '0311234567', expected: '031-123-4567' },
      { input: '03112345678', expected: '031-1234-5678' },
      { input: '0511234567', expected: '051-123-4567' },
    ])('formats $input as $expected', ({ input, expected }) => {
      expect(formatKoreanPhoneNumber(input)).toBe(expected);
    });
  });

  // -- internet phone (070) --
  describe('internet phone (070)', () => {
    it.each([
      { input: '07012345678', expected: '070-1234-5678' },
      { input: '0701234567', expected: '070-123-4567' },
    ])('formats $input as $expected', ({ input, expected }) => {
      expect(formatKoreanPhoneNumber(input)).toBe(expected);
    });
  });

  // -- 050x safe numbers (4-digit prefix) --
  describe('050x safe numbers (4-digit prefix)', () => {
    it.each([
      { input: '050612345678', expected: '0506-1234-5678' },
      { input: '05061234567', expected: '0506-123-4567' },
    ])('formats $input as $expected', ({ input, expected }) => {
      expect(formatKoreanPhoneNumber(input)).toBe(expected);
    });
  });

  // -- partial input (progressive formatting) --
  describe('partial / progressive input', () => {
    it('returns digits only when length <= prefix length', () => {
      expect(formatKoreanPhoneNumber('010')).toBe('010');
      expect(formatKoreanPhoneNumber('02')).toBe('02');
    });

    it('formats prefix-rest when rest is <= 4 digits', () => {
      expect(formatKoreanPhoneNumber('0101')).toBe('010-1');
      expect(formatKoreanPhoneNumber('01012')).toBe('010-12');
      expect(formatKoreanPhoneNumber('010123')).toBe('010-123');
      expect(formatKoreanPhoneNumber('0101234')).toBe('010-1234');
    });

    it('splits into three parts when rest exceeds 4 digits', () => {
      expect(formatKoreanPhoneNumber('01012345')).toBe('010-1-2345');
      expect(formatKoreanPhoneNumber('0101234567')).toBe('010-123-4567');
      expect(formatKoreanPhoneNumber('01012345678')).toBe('010-1234-5678');
    });

    it('formats partial Seoul number', () => {
      expect(formatKoreanPhoneNumber('021')).toBe('02-1');
      expect(formatKoreanPhoneNumber('0212')).toBe('02-12');
      expect(formatKoreanPhoneNumber('02123')).toBe('02-123');
      expect(formatKoreanPhoneNumber('021234')).toBe('02-1234');
      expect(formatKoreanPhoneNumber('0212345')).toBe('02-1-2345');
    });
  });

  // -- input with non-digit characters --
  describe('non-digit character stripping', () => {
    it('strips hyphens', () => {
      expect(formatKoreanPhoneNumber('010-2948-4417')).toBe('010-2948-4417');
    });

    it('strips spaces', () => {
      expect(formatKoreanPhoneNumber('010 2948 4417')).toBe('010-2948-4417');
    });

    it('strips parentheses and mixed characters', () => {
      expect(formatKoreanPhoneNumber('(02) 1234-5678')).toBe('02-1234-5678');
    });

    it('strips dots', () => {
      expect(formatKoreanPhoneNumber('010.1234.5678')).toBe('010-1234-5678');
    });
  });

  // -- edge cases --
  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(formatKoreanPhoneNumber('')).toBe('');
    });

    it('returns empty string for null-like input', () => {
      // The function guards with (input || '') so null/undefined would be handled
      // TypeScript would prevent this, but at runtime it could happen
      expect(formatKoreanPhoneNumber(null as unknown as string)).toBe('');
      expect(formatKoreanPhoneNumber(undefined as unknown as string)).toBe('');
    });

    it('returns empty string for input with no digits', () => {
      expect(formatKoreanPhoneNumber('abc-def')).toBe('');
    });

    it('returns digits as-is for non-0-prefixed numbers (e.g. country code without +)', () => {
      // Not starting with 0 -- falls through to "return digits"
      expect(formatKoreanPhoneNumber('821029484417')).toBe('821029484417');
    });

    it('returns single digit for single non-zero digit', () => {
      expect(formatKoreanPhoneNumber('5')).toBe('5');
    });

    it('returns digits for single zero', () => {
      expect(formatKoreanPhoneNumber('0')).toBe('0');
    });

    it('handles 050 with only 3 digits (too short for 050x prefix detection)', () => {
      // digits.startsWith('050') && digits.length >= 4 => false since length is 3
      // falls to next: digits.startsWith('0') && digits.length >= 3 => true, prefixLen = 3
      expect(formatKoreanPhoneNumber('050')).toBe('050');
    });

    it('handles 0501 as 4-digit prefix (050x)', () => {
      expect(formatKoreanPhoneNumber('0501')).toBe('0501');
    });

    it('handles 05011 as 4-digit prefix with 1 rest digit', () => {
      expect(formatKoreanPhoneNumber('05011')).toBe('0501-1');
    });
  });
});
