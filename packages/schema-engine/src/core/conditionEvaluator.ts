/**
 * Condition Rule Evaluator
 * 
 * [불�? 규칙] Condition Rule ?��? ?�수??schema-engine/core???�치?�니??
 * [불�? 규칙] ?�일 조건 �?복수 조건(AND/OR) 모두 지?? * [불�? 규칙] SDUI v1.1: then/else 구조, ?�로???�산??지?? * 
 * 기술문서: 
 * - docu/?�키마엔�?txt 7.2, 7.3
 * - SDUI 기술문서 v1.1 - 12. Condition Engine
 */

import type { ConditionRule, MultiConditionRule, FormFieldSchema, ConditionActions } from '../types';

/**
 * ?�일 Condition Rule ?��? ?�수
 * 
 * @param rule - ?��???Condition Rule
 * @param fieldValue - 참조 ?�드???�재 �? * @returns 조건 충족 ?��? (boolean)
 */
/**
 * ?�일 Condition Rule ?��? ?�수
 * 
 * SDUI v1.1: ?�로???�산??지??(==, !=, not_exists)
 * 
 * @param rule - ?��???Condition Rule
 * @param fieldValue - 참조 ?�드???�재 �? * @returns 조건 충족 ?��? (boolean)
 */
export function evaluateConditionRule(
  rule: ConditionRule,
  fieldValue: any
): boolean {
  const { op, value } = rule;

  // exists / not_exists ?�산??처리
  if (op === 'exists' || op === 'not_exists') {
    const exists = Array.isArray(fieldValue) 
      ? fieldValue.length > 0
      : fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    return op === 'exists' ? exists : !exists;
  }

  const expected = value;

  switch (op) {
    case '==':
    case 'eq':  // ?�위 ?�환??      // undefined ?�전 처리: value가 undefined??경우 false 반환
      if (expected === undefined) return false;
      return fieldValue === expected;
    case '!=':
    case 'ne':  // ?�위 ?�환??      return fieldValue !== expected;
    case 'in':
      // SDUI v1.1: value???�칼???�는 배열 모두 ?�용
      // 배열??경우: fieldValue?� expected 배열 �?교집???�단
      if (Array.isArray(expected)) {
        // expected가 배열??경우
        if (Array.isArray(fieldValue)) {
          // fieldValue??배열: 교집???�인 (?�나?�도 ?�함?�면 true)
          return expected.some(val => fieldValue.includes(val));
        }
        // fieldValue가 ?�칼?? expected 배열???�함?�는지 ?�인
        return expected.includes(fieldValue);
      }
      // expected가 ?�칼?�인 경우
      if (Array.isArray(fieldValue)) {
        // fieldValue가 배열: 배열??expected가 ?�함?�는지 ?�인
        return fieldValue.includes(expected);
      }
      // ?????�칼?? ?�순 비교
      return fieldValue === expected;
    case 'not_in':
      // SDUI v1.1: value???�칼???�는 배열 모두 ?�용
      // 배열??경우: fieldValue?� expected 배열 �?차집???�단
      if (Array.isArray(expected)) {
        // expected가 배열??경우
        if (Array.isArray(fieldValue)) {
          // fieldValue??배열: 교집?�이 ?�으�?true
          return !expected.some(val => fieldValue.includes(val));
        }
        // fieldValue가 ?�칼?? expected 배열???�함?��? ?�으�?true
        return !expected.includes(fieldValue);
      }
      // expected가 ?�칼?�인 경우
      if (Array.isArray(fieldValue)) {
        // fieldValue가 배열: 배열??expected가 ?�함?��? ?�으�?true
        return !fieldValue.includes(expected);
      }
      // ?????�칼?? ?�순 비교
      return fieldValue !== expected;
    case '>':
    case 'gt':  // ?�위 ?�환??      return typeof fieldValue === 'number' && typeof expected === 'number' && fieldValue > expected;
    case '>=':
    case 'gte':  // ?�위 ?�환??      return typeof fieldValue === 'number' && typeof expected === 'number' && fieldValue >= expected;
    case '<':
    case 'lt':  // ?�위 ?�환??      return typeof fieldValue === 'number' && typeof expected === 'number' && fieldValue < expected;
    case '<=':
    case 'lte':  // ?�위 ?�환??      return typeof fieldValue === 'number' && typeof expected === 'number' && fieldValue <= expected;
    default:
      return false;
  }
}

/**
 * 복수 Condition Rule ?��? ?�수
 * 
 * ?�러 조건??AND/OR�?결합?�여 ?��??�니??
 * 
 * @param multiRule - MultiConditionRule
 * @param watchedValues - useWatch�?관찰한 ?�드 값들
 * @returns 조건 충족 ?��? (boolean)
 */
export function evaluateMultiConditionRule(
  multiRule: MultiConditionRule,
  watchedValues: Record<string, any>
): boolean {
  const { conditions, logic } = multiRule;
  
  if (conditions.length === 0) return false;
  
  const results = conditions.map((rule) => {
    const refValue = watchedValues[rule.field];
    return evaluateConditionRule(rule, refValue);
  });
  
  if (logic === 'and') {
    return results.every((result) => result === true);
  } else {
    // logic === 'or'
    return results.some((result) => result === true);
  }
}

/**
 * Condition Actions ?�용
 * 
 * SDUI v1.1: then/else 구조??ConditionActions�??�용?�니??
 * 
 * @param actions - ?�용??ConditionActions
 * @param currentState - ?�재 ?�태
 * @returns ?�데?�트???�태
 */
function applyConditionActions(
  actions: ConditionActions | undefined,
  currentState: { isHidden: boolean; isDisabled: boolean; isRequired: boolean }
): { isHidden: boolean; isDisabled: boolean; isRequired: boolean } {
  if (!actions) return currentState;

  const newState = { ...currentState };

  if (actions.hide !== undefined) {
    newState.isHidden = actions.hide;
  }
  if (actions.disable !== undefined) {
    newState.isDisabled = actions.disable;
  }
  if (actions.require !== undefined) {
    newState.isRequired = actions.require;
  }

  // setValue, setOptions, switchComponent??SchemaField?�서 별도 처리
  // (???�수???�태�?반환)

  return newState;
}

/**
 * Condition Rule 집계 ?�수
 * 
 * ?�드??Condition Rule(?�일 ?�는 복수)???��??�여 hidden/disabled/required ?�태�?결정?�니??
 * SDUI v1.1: then/else 구조 지?? ?�적 ?�션(setValue, setOptions, switchComponent) 반환
 * 
 * @param field - FormFieldSchema
 * @param watchedValues - useWatch�?관찰한 ?�드 값들 (Record<string, any>)
 * @returns { isHidden, isDisabled, isRequired, actions }
 */
export function getConditionalActions(
  field: FormFieldSchema,
  watchedValues: Record<string, any>
): {
  isHidden: boolean;
  isDisabled: boolean;
  isRequired: boolean;
  actions?: {
    setValue?: any;
    setOptions?: {
      type: 'static' | 'api';
      options?: Array<{ value: string; labelKey?: string; label?: string }>;
      endpoint?: string;
    };
    switchComponent?: {
      to: string;
    };
  };
} {
  let isHidden = false;
  let isDisabled = false;
  let isRequired = false;
  let dynamicActions: {
    setValue?: any;
    setOptions?: { type: 'static' | 'api'; options?: any[]; endpoint?: string };
    switchComponent?: { to: string };
  } | undefined;

  // 복수 조건 ?�선 처리 (conditions가 ?�으�?condition보다 ?�선)
  if (field.conditions) {
    const conditionMet = evaluateMultiConditionRule(field.conditions, watchedValues);
    
    // SDUI v1.1: then/else 구조 ?�선 처리 (action보다 ?�선)
    if (conditionMet && field.conditions.then) {
      const thenActions = field.conditions.then;
      if (thenActions.hide !== undefined) isHidden = thenActions.hide;
      if (thenActions.disable !== undefined) isDisabled = thenActions.disable;
      if (thenActions.require !== undefined) isRequired = thenActions.require;
      if (thenActions.setValue !== undefined) dynamicActions = { ...dynamicActions, setValue: thenActions.setValue };
      if (thenActions.setOptions) dynamicActions = { ...dynamicActions, setOptions: thenActions.setOptions };
      if (thenActions.switchComponent) dynamicActions = { ...dynamicActions, switchComponent: thenActions.switchComponent };
    } else if (!conditionMet && field.conditions.else) {
      const elseActions = field.conditions.else;
      if (elseActions.hide !== undefined) isHidden = elseActions.hide;
      if (elseActions.disable !== undefined) isDisabled = elseActions.disable;
      if (elseActions.require !== undefined) isRequired = elseActions.require;
      if (elseActions.setValue !== undefined) dynamicActions = { ...dynamicActions, setValue: elseActions.setValue };
      if (elseActions.setOptions) dynamicActions = { ...dynamicActions, setOptions: elseActions.setOptions };
      if (elseActions.switchComponent) dynamicActions = { ...dynamicActions, switchComponent: elseActions.switchComponent };
    } else {
      // ?�위 ?�환?? 기존 action ?�드 처리 (then/else가 ?�을 ?�만)
      const { action } = field.conditions;
      if (action === 'hide' && conditionMet) isHidden = true;
      else if (action === 'show' && !conditionMet) isHidden = true;
      if (action === 'disable' && conditionMet) isDisabled = true;
      else if (action === 'enable' && !conditionMet) isDisabled = true;
      if (action === 'require' && conditionMet) isRequired = true;
    }
    
    return { isHidden, isDisabled, isRequired, actions: dynamicActions };
  }

  // ?�일 조건 처리 (?�위 ?�환??
  const rule = field.condition;
  if (!rule) return { isHidden, isDisabled, isRequired, actions: dynamicActions };

  const refValue = watchedValues[rule.field];
  const conditionMet = evaluateConditionRule(rule, refValue);

  // SDUI v1.1: then/else 구조 ?�선 처리 (action보다 ?�선)
  if (conditionMet && rule.then) {
    const thenActions = rule.then;
    if (thenActions.hide !== undefined) isHidden = thenActions.hide;
    if (thenActions.disable !== undefined) isDisabled = thenActions.disable;
    if (thenActions.require !== undefined) isRequired = thenActions.require;
    if (thenActions.setValue !== undefined) dynamicActions = { ...dynamicActions, setValue: thenActions.setValue };
    if (thenActions.setOptions) dynamicActions = { ...dynamicActions, setOptions: thenActions.setOptions };
    if (thenActions.switchComponent) dynamicActions = { ...dynamicActions, switchComponent: thenActions.switchComponent };
  } else if (!conditionMet && rule.else) {
    const elseActions = rule.else;
    if (elseActions.hide !== undefined) isHidden = elseActions.hide;
    if (elseActions.disable !== undefined) isDisabled = elseActions.disable;
    if (elseActions.require !== undefined) isRequired = elseActions.require;
    if (elseActions.setValue !== undefined) dynamicActions = { ...dynamicActions, setValue: elseActions.setValue };
    if (elseActions.setOptions) dynamicActions = { ...dynamicActions, setOptions: elseActions.setOptions };
    if (elseActions.switchComponent) dynamicActions = { ...dynamicActions, switchComponent: elseActions.switchComponent };
  } else {
    // ?�위 ?�환?? 기존 action ?�드 처리 (then/else가 ?�을 ?�만)
    if (rule.action === 'hide' && conditionMet) isHidden = true;
    else if (rule.action === 'show' && !conditionMet) isHidden = true;
    if (rule.action === 'disable' && conditionMet) isDisabled = true;
    else if (rule.action === 'enable' && !conditionMet) isDisabled = true;
    if (rule.action === 'require' && conditionMet) isRequired = true;
  }

  return { isHidden, isDisabled, isRequired, actions: dynamicActions };
}

