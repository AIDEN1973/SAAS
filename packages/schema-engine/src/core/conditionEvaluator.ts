/**
 * Condition Rule Evaluator
 * 
 * [불변 규칙] Condition Rule 평가 함수는 schema-engine/core에 위치합니다.
 * [불변 규칙] 단일 조건 및 복수 조건(AND/OR) 모두 지원
 * [불변 규칙] SDUI v1.1: then/else 구조, 새로운 연산자 지원
 * 
 * 기술문서: 
 * - docu/스키마엔진.txt 7.2, 7.3
 * - SDUI 기술문서 v1.1 - 12. Condition Engine
 */

import type { ConditionRule, MultiConditionRule, FormFieldSchema, ConditionActions } from '../types';

/**
 * 단일 Condition Rule 평가 함수
 * 
 * @param rule - 평가할 Condition Rule
 * @param fieldValue - 참조 필드의 현재 값
 * @returns 조건 충족 여부 (boolean)
 */
/**
 * 단일 Condition Rule 평가 함수
 * 
 * SDUI v1.1: 새로운 연산자 지원 (==, !=, not_exists)
 * 
 * @param rule - 평가할 Condition Rule
 * @param fieldValue - 참조 필드의 현재 값
 * @returns 조건 충족 여부 (boolean)
 */
export function evaluateConditionRule(
  rule: ConditionRule,
  fieldValue: any
): boolean {
  const { op, value } = rule;

  // exists / not_exists 연산자 처리
  if (op === 'exists' || op === 'not_exists') {
    const exists = Array.isArray(fieldValue) 
      ? fieldValue.length > 0
      : fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    return op === 'exists' ? exists : !exists;
  }

  const expected = value;

  switch (op) {
    case '==':
    case 'eq':  // 하위 호환성
      // undefined 안전 처리: value가 undefined인 경우 false 반환
      if (expected === undefined) return false;
      return fieldValue === expected;
    case '!=':
    case 'ne':  // 하위 호환성
      return fieldValue !== expected;
    case 'in':
      // SDUI v1.1: value는 스칼라 또는 배열 모두 허용
      // 배열인 경우: fieldValue와 expected 배열 간 교집합 판단
      if (Array.isArray(expected)) {
        // expected가 배열인 경우
        if (Array.isArray(fieldValue)) {
          // fieldValue도 배열: 교집합 확인 (하나라도 포함되면 true)
          return expected.some(val => fieldValue.includes(val));
        }
        // fieldValue가 스칼라: expected 배열에 포함되는지 확인
        return expected.includes(fieldValue);
      }
      // expected가 스칼라인 경우
      if (Array.isArray(fieldValue)) {
        // fieldValue가 배열: 배열에 expected가 포함되는지 확인
        return fieldValue.includes(expected);
      }
      // 둘 다 스칼라: 단순 비교
      return fieldValue === expected;
    case 'not_in':
      // SDUI v1.1: value는 스칼라 또는 배열 모두 허용
      // 배열인 경우: fieldValue와 expected 배열 간 차집합 판단
      if (Array.isArray(expected)) {
        // expected가 배열인 경우
        if (Array.isArray(fieldValue)) {
          // fieldValue도 배열: 교집합이 없으면 true
          return !expected.some(val => fieldValue.includes(val));
        }
        // fieldValue가 스칼라: expected 배열에 포함되지 않으면 true
        return !expected.includes(fieldValue);
      }
      // expected가 스칼라인 경우
      if (Array.isArray(fieldValue)) {
        // fieldValue가 배열: 배열에 expected가 포함되지 않으면 true
        return !fieldValue.includes(expected);
      }
      // 둘 다 스칼라: 단순 비교
      return fieldValue !== expected;
    case '>':
    case 'gt':  // 하위 호환성
      return typeof fieldValue === 'number' && typeof expected === 'number' && fieldValue > expected;
    case '>=':
    case 'gte':  // 하위 호환성
      return typeof fieldValue === 'number' && typeof expected === 'number' && fieldValue >= expected;
    case '<':
    case 'lt':  // 하위 호환성
      return typeof fieldValue === 'number' && typeof expected === 'number' && fieldValue < expected;
    case '<=':
    case 'lte':  // 하위 호환성
      return typeof fieldValue === 'number' && typeof expected === 'number' && fieldValue <= expected;
    default:
      return false;
  }
}

/**
 * 복수 Condition Rule 평가 함수
 * 
 * 여러 조건을 AND/OR로 결합하여 평가합니다.
 * 
 * @param multiRule - MultiConditionRule
 * @param watchedValues - useWatch로 관찰한 필드 값들
 * @returns 조건 충족 여부 (boolean)
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
 * Condition Actions 적용
 * 
 * SDUI v1.1: then/else 구조의 ConditionActions를 적용합니다.
 * 
 * @param actions - 적용할 ConditionActions
 * @param currentState - 현재 상태
 * @returns 업데이트된 상태
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

  // setValue, setOptions, switchComponent는 SchemaField에서 별도 처리
  // (이 함수는 상태만 반환)

  return newState;
}

/**
 * Condition Rule 집계 함수
 * 
 * 필드의 Condition Rule(단일 또는 복수)을 평가하여 hidden/disabled/required 상태를 결정합니다.
 * SDUI v1.1: then/else 구조 지원, 동적 액션(setValue, setOptions, switchComponent) 반환
 * 
 * @param field - FormFieldSchema
 * @param watchedValues - useWatch로 관찰한 필드 값들 (Record<string, any>)
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

  // 복수 조건 우선 처리 (conditions가 있으면 condition보다 우선)
  if (field.conditions) {
    const conditionMet = evaluateMultiConditionRule(field.conditions, watchedValues);
    
    // SDUI v1.1: then/else 구조 우선 처리 (action보다 우선)
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
      // 하위 호환성: 기존 action 필드 처리 (then/else가 없을 때만)
      const { action } = field.conditions;
      if (action === 'hide' && conditionMet) isHidden = true;
      else if (action === 'show' && !conditionMet) isHidden = true;
      if (action === 'disable' && conditionMet) isDisabled = true;
      else if (action === 'enable' && !conditionMet) isDisabled = true;
      if (action === 'require' && conditionMet) isRequired = true;
    }
    
    return { isHidden, isDisabled, isRequired, actions: dynamicActions };
  }

  // 단일 조건 처리 (하위 호환성)
  const rule = field.condition;
  if (!rule) return { isHidden, isDisabled, isRequired, actions: dynamicActions };

  const refValue = watchedValues[rule.field];
  const conditionMet = evaluateConditionRule(rule, refValue);

  // SDUI v1.1: then/else 구조 우선 처리 (action보다 우선)
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
    // 하위 호환성: 기존 action 필드 처리 (then/else가 없을 때만)
    if (rule.action === 'hide' && conditionMet) isHidden = true;
    else if (rule.action === 'show' && !conditionMet) isHidden = true;
    if (rule.action === 'disable' && conditionMet) isDisabled = true;
    else if (rule.action === 'enable' && !conditionMet) isDisabled = true;
    if (rule.action === 'require' && conditionMet) isRequired = true;
  }

  return { isHidden, isDisabled, isRequired, actions: dynamicActions };
}

