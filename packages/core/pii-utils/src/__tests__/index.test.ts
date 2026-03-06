import { describe, it, expect } from 'vitest';
import { maskPhone, maskEmail, maskName, maskPII } from '../index';

describe('maskPhone', () => {
  it.each([
    ['01012345678', '010****5678'],
    ['010-1234-5678', '010-1234-5678'], // hyphens break consecutive digit match - returned as-is
    ['010-12-5678', '010-12-5678'], // short phone - regex does not match
  ])('masks phone "%s" → "%s"', (input, expected) => {
    expect(maskPhone(input)).toBe(expected);
  });

  it.each([
    [null, ''],
    [undefined, ''],
  ])('returns empty string for %s', (input, expected) => {
    expect(maskPhone(input)).toBe(expected);
  });
});

describe('maskEmail', () => {
  it.each([
    ['user@example.com', 'u***@example.com'],
    ['a@b.com', 'a***@b.com'],
    ['longuser@domain.org', 'l***@domain.org'],
  ])('masks email "%s" → "%s"', (input, expected) => {
    expect(maskEmail(input)).toBe(expected);
  });

  it.each([
    [null, ''],
    [undefined, ''],
  ])('returns empty string for %s', (input, expected) => {
    expect(maskEmail(input)).toBe(expected);
  });

  it('returns as-is for string without @', () => {
    expect(maskEmail('no-at-sign')).toBe('no-at-sign');
  });
});

describe('maskName', () => {
  it.each([
    ['홍길동', '홍*동'],
    ['김철수', '김*수'],
    ['제갈공명', '제**명'],
  ])('masks 3+ char name "%s" → "%s"', (input, expected) => {
    expect(maskName(input)).toBe(expected);
  });

  it.each([
    ['홍길', '홍*'],
    ['AB', 'A*'],
  ])('masks 2-char name "%s" → "%s"', (input, expected) => {
    expect(maskName(input)).toBe(expected);
  });

  it('masks 1-char name by appending *', () => {
    // 1-char: length <= 2 branch → charAt(0) + '*'
    expect(maskName('홍')).toBe('홍*');
  });

  it.each([
    [null, ''],
    [undefined, ''],
  ])('returns empty string for %s', (input, expected) => {
    expect(maskName(input)).toBe(expected);
  });
});

describe('maskPII', () => {
  it('masks flat object with email, phone, name fields', () => {
    const input = {
      email: 'user@example.com',
      phone: '01012345678',
      name: '홍길동',
    };
    const result = maskPII(input);
    expect(result).toEqual({
      email: 'u***@example.com',
      phone: '010****5678',
      name: '홍*동',
    });
  });

  it('masks nested object recursively', () => {
    const input = {
      user: {
        email: 'test@mail.com',
        phone: '01099998888',
        name: '김철수',
      },
      id: 123,
    };
    const result = maskPII(input) as Record<string, unknown>;
    const user = result.user as Record<string, unknown>;
    expect(user.email).toBe('t***@mail.com');
    expect(user.phone).toBe('010****8888');
    expect(user.name).toBe('김*수');
    expect(result.id).toBe(123);
  });

  it('masks arrays of objects', () => {
    const input = [
      { name: '홍길동', email: 'hong@test.com' },
      { name: '김영희', email: 'kim@test.com' },
    ];
    const result = maskPII(input) as Array<Record<string, unknown>>;
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('홍*동');
    expect(result[0].email).toBe('h***@test.com');
    expect(result[1].name).toBe('김*희');
    expect(result[1].email).toBe('k***@test.com');
  });

  it.each([
    [null, null],
    [undefined, undefined],
  ])('passes through %s as-is', (input, expected) => {
    expect(maskPII(input)).toBe(expected);
  });

  it('leaves non-PII fields unchanged', () => {
    const input = {
      id: 42,
      status: 'active',
      count: 100,
      tags: ['vip', 'new'],
    };
    const result = maskPII(input) as Record<string, unknown>;
    expect(result.id).toBe(42);
    expect(result.status).toBe('active');
    expect(result.count).toBe(100);
    expect(result.tags).toEqual(['vip', 'new']);
  });

  it('masks user_email, user_phone, owner_name fields', () => {
    const input = {
      user_email: 'admin@corp.com',
      user_phone: '01011112222',
      owner_name: '박대표',
    };
    const result = maskPII(input) as Record<string, unknown>;
    expect(result.user_email).toBe('a***@corp.com');
    expect(result.user_phone).toBe('010****2222');
    expect(result.owner_name).toBe('박*표');
  });

  it('returns primitive non-PII string as-is', () => {
    expect(maskPII('hello world')).toBe('hello world');
  });

  it('masks string that looks like email', () => {
    expect(maskPII('user@test.com')).toBe('u***@test.com');
  });

  it('masks string that looks like phone number', () => {
    expect(maskPII('01012345678')).toBe('010****5678');
  });

  it('returns number as-is', () => {
    expect(maskPII(42)).toBe(42);
  });

  it('returns boolean as-is', () => {
    expect(maskPII(true)).toBe(true);
  });
});
