/**
 * Condition Evaluator Tests
 *
 * evaluateConditionRule: 단일 조건 평가
 * evaluateMultiConditionRule: 복수 조건(AND/OR) 평가
 * getConditionalActions: 필드 스키마 기반 조건부 상태(hidden/disabled/required) 집계
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateConditionRule,
  evaluateMultiConditionRule,
  getConditionalActions,
} from '../core/conditionEvaluator';
import type { ConditionRule, MultiConditionRule, FormFieldSchema } from '../types';

// ---------------------------------------------------------------------------
// evaluateConditionRule
// ---------------------------------------------------------------------------
describe('evaluateConditionRule', () => {
  // -- equality operators --
  describe('== / eq operator', () => {
    it.each([
      { op: '==' as const, fieldValue: 'hello', value: 'hello', expected: true },
      { op: '==' as const, fieldValue: 'hello', value: 'world', expected: false },
      { op: 'eq' as const, fieldValue: 42, value: 42, expected: true },
      { op: 'eq' as const, fieldValue: 42, value: 99, expected: false },
      { op: '==' as const, fieldValue: true, value: true, expected: true },
      { op: '==' as const, fieldValue: true, value: false, expected: false },
    ])('$op: fieldValue=$fieldValue vs value=$value => $expected', ({ op, fieldValue, value, expected }) => {
      const rule: ConditionRule = { field: 'f', op, value };
      expect(evaluateConditionRule(rule, fieldValue)).toBe(expected);
    });

    it('returns false when expected value is undefined', () => {
      const rule: ConditionRule = { field: 'f', op: '==', value: undefined };
      expect(evaluateConditionRule(rule, 'anything')).toBe(false);
    });
  });

  describe('!= / ne operator', () => {
    it.each([
      { op: '!=' as const, fieldValue: 'a', value: 'b', expected: true },
      { op: '!=' as const, fieldValue: 'a', value: 'a', expected: false },
      { op: 'ne' as const, fieldValue: 1, value: 2, expected: true },
    ])('$op: fieldValue=$fieldValue vs value=$value => $expected', ({ op, fieldValue, value, expected }) => {
      const rule: ConditionRule = { field: 'f', op, value };
      expect(evaluateConditionRule(rule, fieldValue)).toBe(expected);
    });
  });

  // -- exists / not_exists --
  describe('exists / not_exists operators', () => {
    it.each([
      { op: 'exists' as const, fieldValue: 'value', expected: true },
      { op: 'exists' as const, fieldValue: 0, expected: true },
      { op: 'exists' as const, fieldValue: false, expected: true },
      { op: 'exists' as const, fieldValue: null, expected: false },
      { op: 'exists' as const, fieldValue: undefined, expected: false },
      { op: 'exists' as const, fieldValue: '', expected: false },
      { op: 'exists' as const, fieldValue: [], expected: false },
      { op: 'exists' as const, fieldValue: ['a'], expected: true },
      { op: 'not_exists' as const, fieldValue: null, expected: true },
      { op: 'not_exists' as const, fieldValue: '', expected: true },
      { op: 'not_exists' as const, fieldValue: [], expected: true },
      { op: 'not_exists' as const, fieldValue: 'value', expected: false },
      { op: 'not_exists' as const, fieldValue: ['a'], expected: false },
    ])('$op: fieldValue=$fieldValue => $expected', ({ op, fieldValue, expected }) => {
      const rule: ConditionRule = { field: 'f', op };
      expect(evaluateConditionRule(rule, fieldValue)).toBe(expected);
    });
  });

  // -- in / not_in --
  describe('in operator', () => {
    it('scalar fieldValue in expected array', () => {
      const rule: ConditionRule = { field: 'f', op: 'in', value: ['a', 'b', 'c'] };
      expect(evaluateConditionRule(rule, 'b')).toBe(true);
    });

    it('scalar fieldValue NOT in expected array', () => {
      const rule: ConditionRule = { field: 'f', op: 'in', value: ['a', 'b'] };
      expect(evaluateConditionRule(rule, 'z')).toBe(false);
    });

    it('array fieldValue has intersection with expected array', () => {
      const rule: ConditionRule = { field: 'f', op: 'in', value: ['a', 'b'] };
      expect(evaluateConditionRule(rule, ['b', 'c'])).toBe(true);
    });

    it('array fieldValue has NO intersection with expected array', () => {
      const rule: ConditionRule = { field: 'f', op: 'in', value: ['a', 'b'] };
      expect(evaluateConditionRule(rule, ['x', 'y'])).toBe(false);
    });

    it('array fieldValue contains scalar expected', () => {
      const rule: ConditionRule = { field: 'f', op: 'in', value: 'a' };
      expect(evaluateConditionRule(rule, ['a', 'b'])).toBe(true);
    });

    it('array fieldValue does NOT contain scalar expected', () => {
      const rule: ConditionRule = { field: 'f', op: 'in', value: 'z' };
      expect(evaluateConditionRule(rule, ['a', 'b'])).toBe(false);
    });

    it('both scalars - equal', () => {
      const rule: ConditionRule = { field: 'f', op: 'in', value: 'x' };
      expect(evaluateConditionRule(rule, 'x')).toBe(true);
    });

    it('both scalars - not equal', () => {
      const rule: ConditionRule = { field: 'f', op: 'in', value: 'x' };
      expect(evaluateConditionRule(rule, 'y')).toBe(false);
    });
  });

  describe('not_in operator', () => {
    it('scalar fieldValue not in expected array', () => {
      const rule: ConditionRule = { field: 'f', op: 'not_in', value: ['a', 'b'] };
      expect(evaluateConditionRule(rule, 'z')).toBe(true);
    });

    it('scalar fieldValue IS in expected array', () => {
      const rule: ConditionRule = { field: 'f', op: 'not_in', value: ['a', 'b'] };
      expect(evaluateConditionRule(rule, 'a')).toBe(false);
    });

    it('array fieldValue has NO intersection with expected array', () => {
      const rule: ConditionRule = { field: 'f', op: 'not_in', value: ['a', 'b'] };
      expect(evaluateConditionRule(rule, ['x', 'y'])).toBe(true);
    });

    it('array fieldValue HAS intersection with expected array', () => {
      const rule: ConditionRule = { field: 'f', op: 'not_in', value: ['a', 'b'] };
      expect(evaluateConditionRule(rule, ['b', 'c'])).toBe(false);
    });
  });

  // -- numeric comparison --
  describe('numeric comparison operators', () => {
    it.each([
      { op: '>' as const, fieldValue: 10, value: 5, expected: true },
      { op: '>' as const, fieldValue: 5, value: 10, expected: false },
      { op: 'gt' as const, fieldValue: 10, value: 5, expected: true },
      { op: '>=' as const, fieldValue: 5, value: 5, expected: true },
      { op: '>=' as const, fieldValue: 4, value: 5, expected: false },
      { op: 'gte' as const, fieldValue: 5, value: 5, expected: true },
      { op: '<' as const, fieldValue: 3, value: 5, expected: true },
      { op: '<' as const, fieldValue: 5, value: 3, expected: false },
      { op: 'lt' as const, fieldValue: 3, value: 5, expected: true },
      { op: '<=' as const, fieldValue: 5, value: 5, expected: true },
      { op: '<=' as const, fieldValue: 6, value: 5, expected: false },
      { op: 'lte' as const, fieldValue: 5, value: 5, expected: true },
    ])('$op: fieldValue=$fieldValue vs value=$value => $expected', ({ op, fieldValue, value, expected }) => {
      const rule: ConditionRule = { field: 'f', op, value };
      expect(evaluateConditionRule(rule, fieldValue)).toBe(expected);
    });

    it('returns false when fieldValue is not a number', () => {
      const rule: ConditionRule = { field: 'f', op: '>', value: 5 };
      expect(evaluateConditionRule(rule, 'notANumber')).toBe(false);
    });

    it('returns false when expected is not a number', () => {
      const rule: ConditionRule = { field: 'f', op: '<', value: 'notANumber' };
      expect(evaluateConditionRule(rule, 10)).toBe(false);
    });
  });

  // -- unknown operator --
  it('returns false for unknown operator', () => {
    const rule = { field: 'f', op: 'unknown_op' as ConditionRule['op'], value: 'x' };
    expect(evaluateConditionRule(rule, 'x')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateMultiConditionRule
// ---------------------------------------------------------------------------
describe('evaluateMultiConditionRule', () => {
  it('returns false for empty conditions array', () => {
    const multiRule: MultiConditionRule = { conditions: [], logic: 'and' };
    expect(evaluateMultiConditionRule(multiRule, {})).toBe(false);
  });

  it('AND logic: all conditions must pass', () => {
    const multiRule: MultiConditionRule = {
      conditions: [
        { field: 'age', op: '>=', value: 18 },
        { field: 'status', op: '==', value: 'active' },
      ],
      logic: 'and',
    };
    expect(evaluateMultiConditionRule(multiRule, { age: 20, status: 'active' })).toBe(true);
    expect(evaluateMultiConditionRule(multiRule, { age: 20, status: 'inactive' })).toBe(false);
    expect(evaluateMultiConditionRule(multiRule, { age: 15, status: 'active' })).toBe(false);
  });

  it('OR logic: at least one condition must pass', () => {
    const multiRule: MultiConditionRule = {
      conditions: [
        { field: 'role', op: '==', value: 'admin' },
        { field: 'role', op: '==', value: 'manager' },
      ],
      logic: 'or',
    };
    expect(evaluateMultiConditionRule(multiRule, { role: 'admin' })).toBe(true);
    expect(evaluateMultiConditionRule(multiRule, { role: 'manager' })).toBe(true);
    expect(evaluateMultiConditionRule(multiRule, { role: 'viewer' })).toBe(false);
  });

  it('uses watchedValues to resolve field references', () => {
    const multiRule: MultiConditionRule = {
      conditions: [
        { field: 'country', op: '==', value: 'KR' },
        { field: 'verified', op: '==', value: true },
      ],
      logic: 'and',
    };
    expect(evaluateMultiConditionRule(multiRule, { country: 'KR', verified: true })).toBe(true);
    expect(evaluateMultiConditionRule(multiRule, { country: 'US', verified: true })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getConditionalActions
// ---------------------------------------------------------------------------
describe('getConditionalActions', () => {
  const baseField: FormFieldSchema = {
    name: 'testField',
    kind: 'text',
  };

  it('returns all false when no condition is defined', () => {
    const result = getConditionalActions(baseField, {});
    expect(result).toEqual({
      isHidden: false,
      isDisabled: false,
      isRequired: false,
      actions: undefined,
    });
  });

  // -- single condition (legacy action) --
  describe('single condition with legacy action', () => {
    it('action=hide hides when condition met', () => {
      const field: FormFieldSchema = {
        ...baseField,
        condition: { field: 'type', op: '==', value: 'hidden', action: 'hide' },
      };
      const result = getConditionalActions(field, { type: 'hidden' });
      expect(result.isHidden).toBe(true);
    });

    it('action=hide does not hide when condition NOT met', () => {
      const field: FormFieldSchema = {
        ...baseField,
        condition: { field: 'type', op: '==', value: 'hidden', action: 'hide' },
      };
      const result = getConditionalActions(field, { type: 'visible' });
      expect(result.isHidden).toBe(false);
    });

    it('action=show hides when condition NOT met', () => {
      const field: FormFieldSchema = {
        ...baseField,
        condition: { field: 'type', op: '==', value: 'shown', action: 'show' },
      };
      const result = getConditionalActions(field, { type: 'other' });
      expect(result.isHidden).toBe(true);
    });

    it('action=disable disables when condition met', () => {
      const field: FormFieldSchema = {
        ...baseField,
        condition: { field: 'locked', op: '==', value: true, action: 'disable' },
      };
      const result = getConditionalActions(field, { locked: true });
      expect(result.isDisabled).toBe(true);
    });

    it('action=enable disables when condition NOT met', () => {
      const field: FormFieldSchema = {
        ...baseField,
        condition: { field: 'active', op: '==', value: true, action: 'enable' },
      };
      const result = getConditionalActions(field, { active: false });
      expect(result.isDisabled).toBe(true);
    });

    it('action=require requires when condition met', () => {
      const field: FormFieldSchema = {
        ...baseField,
        condition: { field: 'type', op: '==', value: 'special', action: 'require' },
      };
      const result = getConditionalActions(field, { type: 'special' });
      expect(result.isRequired).toBe(true);
    });
  });

  // -- single condition with then/else (SDUI v1.1) --
  describe('single condition with then/else', () => {
    it('applies then actions when condition met', () => {
      const field: FormFieldSchema = {
        ...baseField,
        condition: {
          field: 'paymentMethod',
          op: '==',
          value: 'credit_card',
          then: { require: true, switchComponent: { to: 'CreditCardInput' } },
          else: { disable: true },
        },
      };
      const result = getConditionalActions(field, { paymentMethod: 'credit_card' });
      expect(result.isRequired).toBe(true);
      expect(result.isDisabled).toBe(false);
      expect(result.actions?.switchComponent).toEqual({ to: 'CreditCardInput' });
    });

    it('applies else actions when condition NOT met', () => {
      const field: FormFieldSchema = {
        ...baseField,
        condition: {
          field: 'paymentMethod',
          op: '==',
          value: 'credit_card',
          then: { require: true },
          else: { disable: true, setValue: '' },
        },
      };
      const result = getConditionalActions(field, { paymentMethod: 'bank_transfer' });
      expect(result.isRequired).toBe(false);
      expect(result.isDisabled).toBe(true);
      expect(result.actions?.setValue).toBe('');
    });

    it('then/else actions include setOptions', () => {
      const staticOptions = {
        type: 'static' as const,
        options: [{ value: 'a', label: 'A' }],
      };
      const field: FormFieldSchema = {
        ...baseField,
        condition: {
          field: 'category',
          op: '==',
          value: 'premium',
          then: { setOptions: staticOptions },
        },
      };
      const result = getConditionalActions(field, { category: 'premium' });
      expect(result.actions?.setOptions).toEqual(staticOptions);
    });
  });

  // -- multi-condition (conditions field) --
  describe('multi-condition with legacy action', () => {
    it('conditions override single condition', () => {
      const field: FormFieldSchema = {
        ...baseField,
        condition: { field: 'ignored', op: '==', value: true, action: 'hide' },
        conditions: {
          conditions: [{ field: 'role', op: '==', value: 'admin' }],
          logic: 'and',
          action: 'show',
        },
      };
      // conditions is evaluated, single condition is ignored
      // action=show, condition NOT met => isHidden = true
      const result = getConditionalActions(field, { role: 'viewer' });
      expect(result.isHidden).toBe(true);
    });

    it('multi-condition AND with action=hide', () => {
      const field: FormFieldSchema = {
        ...baseField,
        conditions: {
          conditions: [
            { field: 'a', op: '==', value: 1 },
            { field: 'b', op: '==', value: 2 },
          ],
          logic: 'and',
          action: 'hide',
        },
      };
      expect(getConditionalActions(field, { a: 1, b: 2 }).isHidden).toBe(true);
      expect(getConditionalActions(field, { a: 1, b: 9 }).isHidden).toBe(false);
    });
  });

  describe('multi-condition with then/else', () => {
    it('applies then when multi-condition is met', () => {
      const field: FormFieldSchema = {
        ...baseField,
        conditions: {
          conditions: [
            { field: 'plan', op: '==', value: 'enterprise' },
            { field: 'verified', op: '==', value: true },
          ],
          logic: 'and',
          then: { require: true, hide: false },
          else: { hide: true },
        },
      };
      const result = getConditionalActions(field, { plan: 'enterprise', verified: true });
      expect(result.isRequired).toBe(true);
      expect(result.isHidden).toBe(false);
    });

    it('applies else when multi-condition is NOT met', () => {
      const field: FormFieldSchema = {
        ...baseField,
        conditions: {
          conditions: [
            { field: 'plan', op: '==', value: 'enterprise' },
            { field: 'verified', op: '==', value: true },
          ],
          logic: 'and',
          then: { require: true },
          else: { hide: true, disable: true },
        },
      };
      const result = getConditionalActions(field, { plan: 'free', verified: true });
      expect(result.isHidden).toBe(true);
      expect(result.isDisabled).toBe(true);
      expect(result.isRequired).toBe(false);
    });
  });
});
