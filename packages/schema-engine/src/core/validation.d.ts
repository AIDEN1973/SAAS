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
export declare function buildValidationRules(field: FormFieldSchema): RegisterOptions;
//# sourceMappingURL=validation.d.ts.map