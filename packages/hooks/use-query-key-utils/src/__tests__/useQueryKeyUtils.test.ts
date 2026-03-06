/**
 * useQueryKeyUtils Unit Tests (Pure Functions)
 *
 * Test coverage:
 * - serializeFilter: object serialization with key sorting
 * - createQueryKey: queryKey construction with tenant/filter/additional keys
 * - isQueryKeyEqual: array equality comparison
 * - extractFilterFromQueryKey: filter extraction and JSON parsing
 */

import { describe, it, expect } from 'vitest';
import {
  serializeFilter,
  createQueryKey,
  isQueryKeyEqual,
  extractFilterFromQueryKey,
} from '../index';

// ============================================================================
// Tests: serializeFilter
// ============================================================================

describe('serializeFilter', () => {
  it('returns empty string for null', () => {
    expect(serializeFilter(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(serializeFilter(undefined)).toBe('');
  });

  it('converts primitives to string', () => {
    expect(serializeFilter('hello')).toBe('hello');
    expect(serializeFilter(42)).toBe('42');
    expect(serializeFilter(true)).toBe('true');
  });

  it('serializes arrays as JSON', () => {
    expect(serializeFilter([1, 2, 3])).toBe('[1,2,3]');
    expect(serializeFilter(['a', 'b'])).toBe('["a","b"]');
  });

  it('serializes objects with sorted keys for consistency', () => {
    const obj1 = { b: 2, a: 1 };
    const obj2 = { a: 1, b: 2 };

    expect(serializeFilter(obj1)).toBe(serializeFilter(obj2));
    expect(serializeFilter(obj1)).toBe('{"a":1,"b":2}');
  });

  it('serializes empty object as {}', () => {
    expect(serializeFilter({})).toBe('{}');
  });

  it('serializes nested objects with sorted keys', () => {
    const obj = { z: { b: 2, a: 1 }, a: 'first' };
    const result = serializeFilter(obj);

    expect(result).toBe('{"a":"first","z":{"b":2,"a":1}}');
  });

  it('handles objects with string and number values', () => {
    const obj = { status: 'active', page: 1 };
    const result = serializeFilter(obj);

    expect(result).toBe('{"page":1,"status":"active"}');
  });
});

// ============================================================================
// Tests: createQueryKey
// ============================================================================

describe('createQueryKey', () => {
  it('creates key with baseKey only', () => {
    const key = createQueryKey('students', null);

    expect(key).toEqual(['students']);
  });

  it('creates key with baseKey and tenantId', () => {
    const key = createQueryKey('students', 'tenant-123');

    expect(key).toEqual(['students', 'tenant-123']);
  });

  it('creates key with filter as serialized string', () => {
    const filter = { status: 'active' };
    const key = createQueryKey('students', 'tenant-123', filter);

    expect(key).toEqual(['students', 'tenant-123', '{"status":"active"}']);
  });

  it('skips tenantId when null', () => {
    const key = createQueryKey('students', null, { status: 'active' });

    expect(key).toEqual(['students', '{"status":"active"}']);
  });

  it('skips tenantId when undefined', () => {
    const key = createQueryKey('students', undefined, { status: 'active' });

    expect(key).toEqual(['students', '{"status":"active"}']);
  });

  it('skips tenantId when empty string', () => {
    const key = createQueryKey('students', '', { status: 'active' });

    expect(key).toEqual(['students', '{"status":"active"}']);
  });

  it('includes additional keys', () => {
    const key = createQueryKey('students', 'tenant-123', null, 'page-1', 'sort-name');

    expect(key).toEqual(['students', 'tenant-123', 'page-1', 'sort-name']);
  });

  it('serializes object additional keys', () => {
    const key = createQueryKey('students', 'tenant-123', null, { page: 1 });

    expect(key).toEqual(['students', 'tenant-123', '{"page":1}']);
  });

  it('skips filter when null', () => {
    const key = createQueryKey('students', 'tenant-123', null);

    expect(key).toEqual(['students', 'tenant-123']);
  });

  it('skips filter when undefined', () => {
    const key = createQueryKey('students', 'tenant-123', undefined);

    expect(key).toEqual(['students', 'tenant-123']);
  });

  it('produces stable keys regardless of filter property order', () => {
    const key1 = createQueryKey('students', 'tenant-123', { b: 2, a: 1 });
    const key2 = createQueryKey('students', 'tenant-123', { a: 1, b: 2 });

    expect(key1).toEqual(key2);
  });
});

// ============================================================================
// Tests: isQueryKeyEqual
// ============================================================================

describe('isQueryKeyEqual', () => {
  it('returns true for identical arrays', () => {
    expect(isQueryKeyEqual(['students', 'tenant-1'], ['students', 'tenant-1'])).toBe(true);
  });

  it('returns false for arrays with different lengths', () => {
    expect(isQueryKeyEqual(['students'], ['students', 'tenant-1'])).toBe(false);
  });

  it('returns false for arrays with different values', () => {
    expect(isQueryKeyEqual(['students', 'tenant-1'], ['students', 'tenant-2'])).toBe(false);
  });

  it('returns true for empty arrays', () => {
    expect(isQueryKeyEqual([], [])).toBe(true);
  });

  it('compares by strict equality (reference)', () => {
    const obj = { a: 1 };
    expect(isQueryKeyEqual([obj], [obj])).toBe(true);
    expect(isQueryKeyEqual([{ a: 1 }], [{ a: 1 }])).toBe(false); // different references
  });

  it('handles single-element arrays', () => {
    expect(isQueryKeyEqual(['a'], ['a'])).toBe(true);
    expect(isQueryKeyEqual(['a'], ['b'])).toBe(false);
  });
});

// ============================================================================
// Tests: extractFilterFromQueryKey
// ============================================================================

describe('extractFilterFromQueryKey', () => {
  it('extracts filter from default index (2)', () => {
    const queryKey = ['students', 'tenant-123', '{"status":"active"}'];
    const filter = extractFilterFromQueryKey(queryKey);

    expect(filter).toEqual({ status: 'active' });
  });

  it('extracts filter from custom index', () => {
    const queryKey = ['students', '{"page":1}'];
    const filter = extractFilterFromQueryKey(queryKey, 1);

    expect(filter).toEqual({ page: 1 });
  });

  it('returns null when index is out of bounds', () => {
    const queryKey = ['students'];
    const filter = extractFilterFromQueryKey(queryKey);

    expect(filter).toBeNull();
  });

  it('returns null when value is not a string', () => {
    const queryKey = ['students', 'tenant-123', 42];
    const filter = extractFilterFromQueryKey(queryKey);

    expect(filter).toBeNull();
  });

  it('returns null when value is an empty string', () => {
    const queryKey = ['students', 'tenant-123', ''];
    const filter = extractFilterFromQueryKey(queryKey);

    expect(filter).toBeNull();
  });

  it('returns null when value is invalid JSON', () => {
    const queryKey = ['students', 'tenant-123', 'not-json'];
    const filter = extractFilterFromQueryKey(queryKey);

    expect(filter).toBeNull();
  });

  it('handles complex nested filter objects', () => {
    const complexFilter = { status: 'active', date: { gte: '2026-01-01', lte: '2026-01-31' } };
    const queryKey = ['attendance', 'tenant-123', JSON.stringify(complexFilter)];
    const filter = extractFilterFromQueryKey(queryKey);

    expect(filter).toEqual(complexFilter);
  });
});
