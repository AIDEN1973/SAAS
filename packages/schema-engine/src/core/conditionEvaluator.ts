/**
 * Condition Rule Evaluator
 * 
 * [ë¶ˆë? ê·œì¹™] Condition Rule ?‰ê? ?¨ìˆ˜??schema-engine/core???„ì¹˜?©ë‹ˆ??
 * [ë¶ˆë? ê·œì¹™] ?¨ì¼ ì¡°ê±´ ë°?ë³µìˆ˜ ì¡°ê±´(AND/OR) ëª¨ë‘ ì§€?? * [ë¶ˆë? ê·œì¹™] SDUI v1.1: then/else êµ¬ì¡°, ?ˆë¡œ???°ì‚°??ì§€?? * 
 * ê¸°ìˆ ë¬¸ì„œ: 
 * - docu/?¤í‚¤ë§ˆì—”ì§?txt 7.2, 7.3
 * - SDUI ê¸°ìˆ ë¬¸ì„œ v1.1 - 12. Condition Engine
 */

import type { ConditionRule, MultiConditionRule, FormFieldSchema, ConditionActions } from '../types';

/**
 * ?¨ì¼ Condition Rule ?‰ê? ?¨ìˆ˜
 * 
 * @param rule - ?‰ê???Condition Rule
 * @param fieldValue - ì°¸ì¡° ?„ë“œ???„ì¬ ê°? * @returns ì¡°ê±´ ì¶©ì¡± ?¬ë? (boolean)
 */
/**
 * ?¨ì¼ Condition Rule ?‰ê? ?¨ìˆ˜
 * 
 * SDUI v1.1: ?ˆë¡œ???°ì‚°??ì§€??(==, !=, not_exists)
 * 
 * @param rule - ?‰ê???Condition Rule
 * @param fieldValue - ì°¸ì¡° ?„ë“œ???„ì¬ ê°? * @returns ì¡°ê±´ ì¶©ì¡± ?¬ë? (boolean)
 */
export function evaluateConditionRule(
  rule: ConditionRule,
  fieldValue: any
): boolean {
  const { op, value } = rule;

  // exists / not_exists ?°ì‚°??ì²˜ë¦¬
  if (op === 'exists' || op === 'not_exists') {
    const exists = Array.isArray(fieldValue) 
      ? fieldValue.length > 0
      : fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    return op === 'exists' ? exists : !exists;
  }

  const expected = value;

  switch (op) {
    case '==':
    case 'eq':  // ?˜ìœ„ ?¸í™˜??      // undefined ?ˆì „ ì²˜ë¦¬: valueê°€ undefined??ê²½ìš° false ë°˜í™˜
      if (expected === undefined) return false;
      return fieldValue === expected;
    case '!=':
    case 'ne':  // ?˜ìœ„ ?¸í™˜??      return fieldValue !== expected;
    case 'in':
      // SDUI v1.1: value???¤ì¹¼???ëŠ” ë°°ì—´ ëª¨ë‘ ?ˆìš©
      // ë°°ì—´??ê²½ìš°: fieldValue?€ expected ë°°ì—´ ê°?êµì§‘???ë‹¨
      if (Array.isArray(expected)) {
        // expectedê°€ ë°°ì—´??ê²½ìš°
        if (Array.isArray(fieldValue)) {
          // fieldValue??ë°°ì—´: êµì§‘???•ì¸ (?˜ë‚˜?¼ë„ ?¬í•¨?˜ë©´ true)
          return expected.some(val => fieldValue.includes(val));
        }
        // fieldValueê°€ ?¤ì¹¼?? expected ë°°ì—´???¬í•¨?˜ëŠ”ì§€ ?•ì¸
        return expected.includes(fieldValue);
      }
      // expectedê°€ ?¤ì¹¼?¼ì¸ ê²½ìš°
      if (Array.isArray(fieldValue)) {
        // fieldValueê°€ ë°°ì—´: ë°°ì—´??expectedê°€ ?¬í•¨?˜ëŠ”ì§€ ?•ì¸
        return fieldValue.includes(expected);
      }
      // ?????¤ì¹¼?? ?¨ìˆœ ë¹„êµ
      return fieldValue === expected;
    case 'not_in':
      // SDUI v1.1: value???¤ì¹¼???ëŠ” ë°°ì—´ ëª¨ë‘ ?ˆìš©
      // ë°°ì—´??ê²½ìš°: fieldValue?€ expected ë°°ì—´ ê°?ì°¨ì§‘???ë‹¨
      if (Array.isArray(expected)) {
        // expectedê°€ ë°°ì—´??ê²½ìš°
        if (Array.isArray(fieldValue)) {
          // fieldValue??ë°°ì—´: êµì§‘?©ì´ ?†ìœ¼ë©?true
          return !expected.some(val => fieldValue.includes(val));
        }
        // fieldValueê°€ ?¤ì¹¼?? expected ë°°ì—´???¬í•¨?˜ì? ?Šìœ¼ë©?true
        return !expected.includes(fieldValue);
      }
      // expectedê°€ ?¤ì¹¼?¼ì¸ ê²½ìš°
      if (Array.isArray(fieldValue)) {
        // fieldValueê°€ ë°°ì—´: ë°°ì—´??expectedê°€ ?¬í•¨?˜ì? ?Šìœ¼ë©?true
        return !fieldValue.includes(expected);
      }
      // ?????¤ì¹¼?? ?¨ìˆœ ë¹„êµ
      return fieldValue !== expected;
    case '>':
    case 'gt':  // ?˜ìœ„ ?¸í™˜??      return typeof fieldValue === 'number' && typeof expected === 'number' && fieldValue > expected;
    case '>=':
    case 'gte':  // ?˜ìœ„ ?¸í™˜??      return typeof fieldValue === 'number' && typeof expected === 'number' && fieldValue >= expected;
    case '<':
    case 'lt':  // ?˜ìœ„ ?¸í™˜??      return typeof fieldValue === 'number' && typeof expected === 'number' && fieldValue < expected;
    case '<=':
    case 'lte':  // ?˜ìœ„ ?¸í™˜??      return typeof fieldValue === 'number' && typeof expected === 'number' && fieldValue <= expected;
    default:
      return false;
  }
}

/**
 * ë³µìˆ˜ Condition Rule ?‰ê? ?¨ìˆ˜
 * 
 * ?¬ëŸ¬ ì¡°ê±´??AND/ORë¡?ê²°í•©?˜ì—¬ ?‰ê??©ë‹ˆ??
 * 
 * @param multiRule - MultiConditionRule
 * @param watchedValues - useWatchë¡?ê´€ì°°í•œ ?„ë“œ ê°’ë“¤
 * @returns ì¡°ê±´ ì¶©ì¡± ?¬ë? (boolean)
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
 * Condition Actions ?ìš©
 * 
 * SDUI v1.1: then/else êµ¬ì¡°??ConditionActionsë¥??ìš©?©ë‹ˆ??
 * 
 * @param actions - ?ìš©??ConditionActions
 * @param currentState - ?„ì¬ ?íƒœ
 * @returns ?…ë°?´íŠ¸???íƒœ
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

  // setValue, setOptions, switchComponent??SchemaField?ì„œ ë³„ë„ ì²˜ë¦¬
  // (???¨ìˆ˜???íƒœë§?ë°˜í™˜)

  return newState;
}

/**
 * Condition Rule ì§‘ê³„ ?¨ìˆ˜
 * 
 * ?„ë“œ??Condition Rule(?¨ì¼ ?ëŠ” ë³µìˆ˜)???‰ê??˜ì—¬ hidden/disabled/required ?íƒœë¥?ê²°ì •?©ë‹ˆ??
 * SDUI v1.1: then/else êµ¬ì¡° ì§€?? ?™ì  ?¡ì…˜(setValue, setOptions, switchComponent) ë°˜í™˜
 * 
 * @param field - FormFieldSchema
 * @param watchedValues - useWatchë¡?ê´€ì°°í•œ ?„ë“œ ê°’ë“¤ (Record<string, any>)
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

  // ë³µìˆ˜ ì¡°ê±´ ?°ì„  ì²˜ë¦¬ (conditionsê°€ ?ˆìœ¼ë©?conditionë³´ë‹¤ ?°ì„ )
  if (field.conditions) {
    const conditionMet = evaluateMultiConditionRule(field.conditions, watchedValues);
    
    // SDUI v1.1: then/else êµ¬ì¡° ?°ì„  ì²˜ë¦¬ (actionë³´ë‹¤ ?°ì„ )
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
      // ?˜ìœ„ ?¸í™˜?? ê¸°ì¡´ action ?„ë“œ ì²˜ë¦¬ (then/elseê°€ ?†ì„ ?Œë§Œ)
      const { action } = field.conditions;
      if (action === 'hide' && conditionMet) isHidden = true;
      else if (action === 'show' && !conditionMet) isHidden = true;
      if (action === 'disable' && conditionMet) isDisabled = true;
      else if (action === 'enable' && !conditionMet) isDisabled = true;
      if (action === 'require' && conditionMet) isRequired = true;
    }
    
    return { isHidden, isDisabled, isRequired, actions: dynamicActions };
  }

  // ?¨ì¼ ì¡°ê±´ ì²˜ë¦¬ (?˜ìœ„ ?¸í™˜??
  const rule = field.condition;
  if (!rule) return { isHidden, isDisabled, isRequired, actions: dynamicActions };

  const refValue = watchedValues[rule.field];
  const conditionMet = evaluateConditionRule(rule, refValue);

  // SDUI v1.1: then/else êµ¬ì¡° ?°ì„  ì²˜ë¦¬ (actionë³´ë‹¤ ?°ì„ )
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
    // ?˜ìœ„ ?¸í™˜?? ê¸°ì¡´ action ?„ë“œ ì²˜ë¦¬ (then/elseê°€ ?†ì„ ?Œë§Œ)
    if (rule.action === 'hide' && conditionMet) isHidden = true;
    else if (rule.action === 'show' && !conditionMet) isHidden = true;
    if (rule.action === 'disable' && conditionMet) isDisabled = true;
    else if (rule.action === 'enable' && !conditionMet) isDisabled = true;
    if (rule.action === 'require' && conditionMet) isRequired = true;
  }

  return { isHidden, isDisabled, isRequired, actions: dynamicActions };
}

