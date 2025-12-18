/**
 * FormField Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import React from 'react';
export interface FormFieldProps {
    label?: string;
    error?: string;
    helperText?: string;
    required?: boolean;
    children: React.ReactNode;
    className?: string;
}
/**
 * FormField 컴포넌트
 *
 * 입력 필드를 감싸는 헬퍼 컴포넌트
 */
export declare const FormField: React.FC<FormFieldProps>;
//# sourceMappingURL=FormField.d.ts.map