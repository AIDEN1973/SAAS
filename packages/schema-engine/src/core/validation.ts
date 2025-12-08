/**
 * Validation Rules Builder
 * 
 * [불변 규칙] React Hook Form의 validation rules를 스키마에서 생성합니다.
 * [불변 규칙] 동적 required는 정적 required보다 우선합니다.
 * 
 * 기술문서: docu/스키마엔진.txt 8. Renderer 통합
 */

import type { FormFieldSchema } from '../types';
import type { RegisterOptions } from 'react-hook-form';

/**
 * FormFieldSchema에서 React Hook Form validation rules 생성
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
      // { messageKey?: string; message?: string } 형태
      rules.required = field.validation.required.message || field.validation.required.messageKey || '필수 입력 항목입니다.';
    } else if (field.validation.required === true) {
      rules.required = '필수 입력 항목입니다.';
    }
  }

  // min/max (number 필드)
  if (field.kind === 'number') {
    if (field.validation?.min !== undefined) {
      rules.min = {
        value: field.validation.min,
        message: `최소값은 ${field.validation.min}입니다.`,
      };
    }
    if (field.validation?.max !== undefined) {
      rules.max = {
        value: field.validation.max,
        message: `최대값은 ${field.validation.max}입니다.`,
      };
    }
  }

  // minLength/maxLength (text 필드)
  if (['text', 'email', 'phone', 'password', 'textarea'].includes(field.kind)) {
    if (field.validation?.minLength !== undefined) {
      rules.minLength = {
        value: field.validation.minLength,
        message: `최소 ${field.validation.minLength}자 이상 입력해주세요.`,
      };
    }
    if (field.validation?.maxLength !== undefined) {
      rules.maxLength = {
        value: field.validation.maxLength,
        message: `최대 ${field.validation.maxLength}자까지 입력 가능합니다.`,
      };
    }
  }

  // pattern (정규식)
  // ⚠️ 중요: 스키마에는 JSON serializable 문자열로 저장되지 않음
  // React Hook Form의 RegExp로 변환 필요
  // SDUI v1.1: messageKey 지원
  if (field.validation?.pattern) {
    rules.pattern = {
      value: new RegExp(field.validation.pattern.value),
      message: field.validation.pattern.message || field.validation.pattern.messageKey || '올바른 형식이 아닙니다.',
    };
  }

  // Registry 기반 스키마에는 함수는 undefined입니다.
  // validate 함수는 fallbackSchema(로컬 TypeScript 파일)에서만 사용 가능합니다.
  if (field.validation?.validate) {
    // Registry 기반 스키마에 validate가 존재하면 경고 (이론적으로는 불가능하지만 방어 코드)
    if (typeof field.validation.validate === 'function') {
      // fallbackSchema에서만 실행됨
      rules.validate = field.validation.validate;
    } else {
      console.warn(
        `[Schema Engine] Field "${field.name}": validate 함수는 Registry 기반 스키마에는 사용할 수 없습니다. ` +
        `fallbackSchema(로컬 TypeScript 파일)에서만 사용 가능합니다.`
      );
    }
  }

  return rules;
}
