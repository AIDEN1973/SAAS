/**
 * Input Component
 *
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용한다.
 */
import React from 'react';
import { SizeToken } from '@design-system/core';
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string;
    error?: string;
    helperText?: string;
    size?: SizeToken;
    fullWidth?: boolean;
    /**
     * 값이 있을 때 좌측에 인라인 라벨(항목명)을 표시할지 여부
     * - 수정폼(편집 모드): true
     * - 필터/검색 UI: false (값이 들어가면 placeholder가 사라져야 함)
     */
    showInlineLabelWhenHasValue?: boolean;
}
export declare const Input: React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>>;
//# sourceMappingURL=Input.d.ts.map