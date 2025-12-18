/**
 * Select Component (Custom Dropdown)
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import React from 'react';
type SizeToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export interface SelectOption {
    value: string | number;
    label: string;
    disabled?: boolean;
}
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'children' | 'onChange'> {
    label?: string;
    error?: string;
    helperText?: string;
    size?: SizeToken;
    fullWidth?: boolean;
    children?: React.ReactNode;
    options?: SelectOption[];
    multiple?: boolean;
    onChange?: (value: string | string[]) => void;
    /**
     * 값이 있을 때 좌측에 인라인 라벨(항목명)을 표시할지 여부
     * - 수정폼(편집 모드): true
     * - 필터/검색 UI: false
     */
    showInlineLabelWhenHasValue?: boolean;
}
/**
 * Select 컴포넌트 (커스텀 드롭다운)
 */
export declare const Select: React.FC<SelectProps>;
export {};
//# sourceMappingURL=Select.d.ts.map