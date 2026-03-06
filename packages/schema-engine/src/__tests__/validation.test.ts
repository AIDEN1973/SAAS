/**
 * Validation Rules Builder Tests
 *
 * buildValidationRules: FormFieldSchema -> React Hook Form RegisterOptions
 */
import { describe, it, expect, vi } from 'vitest';
import { buildValidationRules } from '../core/validation';
import type { FormFieldSchema } from '../types';

// Helper to create a minimal FormFieldSchema
function makeField(overrides: Partial<FormFieldSchema> & { name?: string; kind?: FormFieldSchema['kind'] }): FormFieldSchema {
  return {
    name: overrides.name ?? 'testField',
    kind: overrides.kind ?? 'text',
    ...overrides,
  };
}

describe('buildValidationRules', () => {
  // -- no validation --
  it('returns empty rules when no validation is defined', () => {
    const field = makeField({});
    const rules = buildValidationRules(field);
    expect(rules).toEqual({});
  });

  // -- required --
  describe('required', () => {
    it('sets default message when required is true', () => {
      const field = makeField({ validation: { required: true } });
      const rules = buildValidationRules(field);
      expect(rules.required).toBe('필수 입력 항목입니다.');
    });

    it('uses custom string message', () => {
      const field = makeField({ validation: { required: '이름을 입력하세요' } });
      const rules = buildValidationRules(field);
      expect(rules.required).toBe('이름을 입력하세요');
    });

    it('uses object with message', () => {
      const field = makeField({
        validation: { required: { message: '필수 항목' } },
      });
      const rules = buildValidationRules(field);
      expect(rules.required).toBe('필수 항목');
    });

    it('uses object with messageKey when message is absent', () => {
      const field = makeField({
        validation: { required: { messageKey: 'validation.required' } },
      });
      const rules = buildValidationRules(field);
      expect(rules.required).toBe('validation.required');
    });

    it('falls back to default message when object has neither message nor messageKey', () => {
      const field = makeField({
        validation: { required: {} },
      });
      const rules = buildValidationRules(field);
      expect(rules.required).toBe('필수 입력 항목입니다.');
    });

    it('does not set required when required is false', () => {
      const field = makeField({ validation: { required: false } });
      const rules = buildValidationRules(field);
      expect(rules.required).toBeUndefined();
    });
  });

  // -- min / max (number fields) --
  describe('min / max for number kind', () => {
    it('sets min rule for number field', () => {
      const field = makeField({ kind: 'number', validation: { min: 0 } });
      const rules = buildValidationRules(field);
      expect(rules.min).toEqual({ value: 0, message: '최소값은 0입니다.' });
    });

    it('sets max rule for number field', () => {
      const field = makeField({ kind: 'number', validation: { max: 100 } });
      const rules = buildValidationRules(field);
      expect(rules.max).toEqual({ value: 100, message: '최대값은 100입니다.' });
    });

    it('sets both min and max', () => {
      const field = makeField({ kind: 'number', validation: { min: 1, max: 50 } });
      const rules = buildValidationRules(field);
      expect(rules.min).toBeDefined();
      expect(rules.max).toBeDefined();
    });

    it('does NOT set min/max for text kind', () => {
      const field = makeField({ kind: 'text', validation: { min: 1, max: 10 } });
      const rules = buildValidationRules(field);
      expect(rules.min).toBeUndefined();
      expect(rules.max).toBeUndefined();
    });
  });

  // -- minLength / maxLength (text-like fields) --
  describe('minLength / maxLength for text-like kinds', () => {
    it.each(['text', 'email', 'phone', 'password', 'textarea'] as const)(
      'sets minLength for kind=%s',
      (kind) => {
        const field = makeField({ kind, validation: { minLength: 3 } });
        const rules = buildValidationRules(field);
        expect(rules.minLength).toEqual({ value: 3, message: '최소 3자 이상 입력해주세요.' });
      }
    );

    it.each(['text', 'email', 'phone', 'password', 'textarea'] as const)(
      'sets maxLength for kind=%s',
      (kind) => {
        const field = makeField({ kind, validation: { maxLength: 100 } });
        const rules = buildValidationRules(field);
        expect(rules.maxLength).toEqual({ value: 100, message: '최대 100자까지 입력 가능합니다.' });
      }
    );

    it('does NOT set minLength/maxLength for number kind', () => {
      const field = makeField({ kind: 'number', validation: { minLength: 1, maxLength: 10 } });
      const rules = buildValidationRules(field);
      expect(rules.minLength).toBeUndefined();
      expect(rules.maxLength).toBeUndefined();
    });

    it('does NOT set minLength/maxLength for select kind', () => {
      const field = makeField({ kind: 'select', validation: { minLength: 1, maxLength: 10 } });
      const rules = buildValidationRules(field);
      expect(rules.minLength).toBeUndefined();
      expect(rules.maxLength).toBeUndefined();
    });
  });

  // -- pattern --
  describe('pattern', () => {
    it('converts pattern string to RegExp with message', () => {
      const field = makeField({
        validation: {
          pattern: { value: '^[0-9]+$', message: '숫자만 입력하세요' },
        },
      });
      const rules = buildValidationRules(field);
      expect(rules.pattern).toBeDefined();
      expect((rules.pattern as { value: RegExp }).value).toBeInstanceOf(RegExp);
      expect((rules.pattern as { value: RegExp }).value.source).toBe('^[0-9]+$');
      expect((rules.pattern as { message: string }).message).toBe('숫자만 입력하세요');
    });

    it('uses messageKey when message is absent', () => {
      const field = makeField({
        validation: {
          pattern: { value: '^010', messageKey: 'validation.phone_format' },
        },
      });
      const rules = buildValidationRules(field);
      expect((rules.pattern as { message: string }).message).toBe('validation.phone_format');
    });

    it('falls back to default message when neither message nor messageKey', () => {
      const field = makeField({
        validation: {
          pattern: { value: '.*' },
        },
      });
      const rules = buildValidationRules(field);
      expect((rules.pattern as { message: string }).message).toBe('올바른 형식이 아닙니다.');
    });
  });

  // -- validate function --
  describe('validate function', () => {
    it('passes through validate function (fallback schema)', () => {
      const validateFn = (val: unknown) => typeof val === 'string' || 'Must be string';
      const field = makeField({
        validation: { validate: validateFn },
      });
      const rules = buildValidationRules(field);
      expect(rules.validate).toBe(validateFn);
    });

    it('warns when validate is not a function (registry schema)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const field = makeField({
        validation: { validate: 'not_a_function' as unknown as (value: unknown) => boolean | string },
      });
      buildValidationRules(field);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('validate 함수는 Registry 기반 스키마에는 사용할 수 없습니다')
      );
      warnSpy.mockRestore();
    });
  });

  // -- combined rules --
  it('builds combined rules for a fully-specified text field', () => {
    const field = makeField({
      kind: 'text',
      validation: {
        required: true,
        minLength: 2,
        maxLength: 50,
        pattern: { value: '^[a-zA-Z]+$', message: '영문만 허용' },
      },
    });
    const rules = buildValidationRules(field);
    expect(rules.required).toBe('필수 입력 항목입니다.');
    expect(rules.minLength).toEqual({ value: 2, message: '최소 2자 이상 입력해주세요.' });
    expect(rules.maxLength).toEqual({ value: 50, message: '최대 50자까지 입력 가능합니다.' });
    expect((rules.pattern as { value: RegExp }).value).toBeInstanceOf(RegExp);
  });

  it('builds combined rules for a number field with required + min + max', () => {
    const field = makeField({
      kind: 'number',
      validation: {
        required: '수량을 입력하세요',
        min: 1,
        max: 999,
      },
    });
    const rules = buildValidationRules(field);
    expect(rules.required).toBe('수량을 입력하세요');
    expect(rules.min).toEqual({ value: 1, message: '최소값은 1입니다.' });
    expect(rules.max).toEqual({ value: 999, message: '최대값은 999입니다.' });
  });
});
