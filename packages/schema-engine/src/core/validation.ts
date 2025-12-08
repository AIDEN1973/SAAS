/**
 * Validation Rules Builder
 * 
 * [불�? 규칙] React Hook Form??validation rules�??�키마에???�성?�니??
 * [불�? 규칙] ?�적 required???�적 required보다 ?�선?�니??
 * 
 * 기술문서: docu/?�키마엔�?txt 8. Renderer ?�합
 */

import type { FormFieldSchema } from '../types';
import type { RegisterOptions } from 'react-hook-form';

/**
 * FormFieldSchema?�서 React Hook Form validation rules ?�성
 * 
 * @param field - FormFieldSchema
 * @returns React Hook Form RegisterOptions
 */
export function buildValidationRules(
  field: FormFieldSchema
): RegisterOptions {
  const rules: RegisterOptions = {};

  // 동적 required 처리
  // SDUI v1.1: messageKey 지원
  if (field.validation?.required) {
    if (typeof field.validation.required === 'string') {
      rules.required = field.validation.required;
    } else if (typeof field.validation.required === 'object' && field.validation.required !== null) {
      // { messageKey?: string; message?: string } ?�태
      rules.required = field.validation.required.message || field.validation.required.messageKey || '?�수 ?�력 ??��?�니??';
    } else if (field.validation.required === true) {
      rules.required = '?�수 ?�력 ??��?�니??';
    }
  }

  // min/max (number ?�??
  if (field.kind === 'number') {
    if (field.validation?.min !== undefined) {
      rules.min = {
        value: field.validation.min,
        message: `최소값�? ${field.validation.min}?�니??`,
      };
    }
    if (field.validation?.max !== undefined) {
      rules.max = {
        value: field.validation.max,
        message: `최�?값�? ${field.validation.max}?�니??`,
      };
    }
  }

  // minLength/maxLength (text ?�??
  if (['text', 'email', 'phone', 'password', 'textarea'].includes(field.kind)) {
    if (field.validation?.minLength !== undefined) {
      rules.minLength = {
        value: field.validation.minLength,
        message: `최소 ${field.validation.minLength}???�상 ?�력?�주?�요.`,
      };
    }
    if (field.validation?.maxLength !== undefined) {
      rules.maxLength = {
        value: field.validation.maxLength,
        message: `최�? ${field.validation.maxLength}?�까지 ?�력 가?�합?�다.`,
      };
    }
  }

  // pattern (?�규??
  // ?�️ 중요: ?�키마에?�는 JSON serializable 문자?�로 ?�?�되지�?
  // 중요: 스키마에는 JSON serializable 문자열로 저장되지 않음
  // React Hook Form의 RegExp로 변환 필요
  // SDUI v1.1: messageKey 지원
  // SDUI v1.1: messageKey 지원
  if (field.validation?.pattern) {
    rules.pattern = {
      value: new RegExp(field.validation.pattern.value),
      message: field.validation.pattern.message || field.validation.pattern.messageKey || '올바른 형식이 아닙니다.',
    };
  }
  // Registry 기반 ?�키마에?�는 ??�� undefined?�니??
  // validate ?�수??fallbackSchema(로컬 TypeScript ?�일)?�서�??�용 가?�합?�다.
  if (field.validation?.validate) {
    // Registry 기반 ?�키마에??validate가 존재?�면 경고 (?�론?�으�?불�??�하지�?방어 코드)
    if (typeof field.validation.validate === 'function') {
      // fallbackSchema?�서�??�행??      rules.validate = field.validation.validate;
    } else {
      console.warn(
        `[Schema Engine] Field "${field.name}": validate ?�수??Registry 기반 ?�키마에?�는 ?�용?????�습?�다. ` +
        `fallbackSchema(로컬 TypeScript ?�일)?�서�??�용 가?�합?�다.`
      );
    }
  }

  return rules;
}


