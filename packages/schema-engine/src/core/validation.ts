/**
 * Validation Rules Builder
 * 
 * [ë¶ˆë? ê·œì¹™] React Hook Form??validation rulesë¥??¤í‚¤ë§ˆì—???ì„±?©ë‹ˆ??
 * [ë¶ˆë? ê·œì¹™] ?™ì  required???•ì  requiredë³´ë‹¤ ?°ì„ ?©ë‹ˆ??
 * 
 * ê¸°ìˆ ë¬¸ì„œ: docu/?¤í‚¤ë§ˆì—”ì§?txt 8. Renderer ?µí•©
 */

import type { FormFieldSchema } from '../types';
import type { RegisterOptions } from 'react-hook-form';

/**
 * FormFieldSchema?ì„œ React Hook Form validation rules ?ì„±
 * 
 * @param field - FormFieldSchema
 * @returns React Hook Form RegisterOptions
 */
export function buildValidationRules(
  field: FormFieldSchema
): RegisterOptions {
  const rules: RegisterOptions = {};

  // ?•ì  required ì²˜ë¦¬
  // SDUI v1.1: messageKey ì§€??  if (field.validation?.required) {
    if (typeof field.validation.required === 'string') {
      rules.required = field.validation.required;
    } else if (typeof field.validation.required === 'object' && field.validation.required !== null) {
      // { messageKey?: string; message?: string } ?•íƒœ
      rules.required = field.validation.required.message || field.validation.required.messageKey || '?„ìˆ˜ ?…ë ¥ ??ª©?…ë‹ˆ??';
    } else if (field.validation.required === true) {
      rules.required = '?„ìˆ˜ ?…ë ¥ ??ª©?…ë‹ˆ??';
    }
  }

  // min/max (number ?€??
  if (field.kind === 'number') {
    if (field.validation?.min !== undefined) {
      rules.min = {
        value: field.validation.min,
        message: `ìµœì†Œê°’ì? ${field.validation.min}?…ë‹ˆ??`,
      };
    }
    if (field.validation?.max !== undefined) {
      rules.max = {
        value: field.validation.max,
        message: `ìµœë?ê°’ì? ${field.validation.max}?…ë‹ˆ??`,
      };
    }
  }

  // minLength/maxLength (text ?€??
  if (['text', 'email', 'phone', 'password', 'textarea'].includes(field.kind)) {
    if (field.validation?.minLength !== undefined) {
      rules.minLength = {
        value: field.validation.minLength,
        message: `ìµœì†Œ ${field.validation.minLength}???´ìƒ ?…ë ¥?´ì£¼?¸ìš”.`,
      };
    }
    if (field.validation?.maxLength !== undefined) {
      rules.maxLength = {
        value: field.validation.maxLength,
        message: `ìµœë? ${field.validation.maxLength}?ê¹Œì§€ ?…ë ¥ ê°€?¥í•©?ˆë‹¤.`,
      };
    }
  }

  // pattern (?•ê·œ??
  // ? ï¸ ì¤‘ìš”: ?¤í‚¤ë§ˆì—?œëŠ” JSON serializable ë¬¸ì?´ë¡œ ?€?¥ë˜ì§€ë§?
  // React Hook Form?€ RegExpë¥??”êµ¬?˜ë?ë¡?ë³€???„ìš”
  // SDUI v1.1: messageKey ì§€??  if (field.validation?.pattern) {
    rules.pattern = {
      value: new RegExp(field.validation.pattern.value),
      message: field.validation.pattern.message || field.validation.pattern.messageKey || '?¬ë°”ë¥??•ì‹???„ë‹™?ˆë‹¤.',
    };
  }

  // custom validate ?¨ìˆ˜
  // ? ï¸ ì¤‘ìš”: validate ?¨ìˆ˜??Schema Registry(JSONB)???€?¥ë  ???†ìœ¼ë¯€ë¡?
  // Registry ê¸°ë°˜ ?¤í‚¤ë§ˆì—?œëŠ” ??ƒ undefined?…ë‹ˆ??
  // validate ?¨ìˆ˜??fallbackSchema(ë¡œì»¬ TypeScript ?Œì¼)?ì„œë§??¬ìš© ê°€?¥í•©?ˆë‹¤.
  if (field.validation?.validate) {
    // Registry ê¸°ë°˜ ?¤í‚¤ë§ˆì—??validateê°€ ì¡´ì¬?˜ë©´ ê²½ê³  (?´ë¡ ?ìœ¼ë¡?ë¶ˆê??¥í•˜ì§€ë§?ë°©ì–´ ì½”ë“œ)
    if (typeof field.validation.validate === 'function') {
      // fallbackSchema?ì„œë§??¤í–‰??      rules.validate = field.validation.validate;
    } else {
      console.warn(
        `[Schema Engine] Field "${field.name}": validate ?¨ìˆ˜??Registry ê¸°ë°˜ ?¤í‚¤ë§ˆì—?œëŠ” ?¬ìš©?????†ìŠµ?ˆë‹¤. ` +
        `fallbackSchema(ë¡œì»¬ TypeScript ?Œì¼)?ì„œë§??¬ìš© ê°€?¥í•©?ˆë‹¤.`
      );
    }
  }

  return rules;
}

