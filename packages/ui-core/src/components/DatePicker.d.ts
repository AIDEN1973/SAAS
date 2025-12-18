/**
 * DatePicker Component (Custom Calendar)
 *
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import React from 'react';
type SizeToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'value' | 'onChange'> {
    label?: string;
    error?: string;
    helperText?: string;
    size?: SizeToken;
    fullWidth?: boolean;
    value?: string | Date;
    onChange?: (value: string) => void;
    dateTime?: boolean;
    /**
     * 값이 있을 때 좌측에 인라인 라벨(항목명)을 표시할지 여부
     * - 수정폼(편집 모드): true
     * - 필터/검색 UI: false
     */
    showInlineLabelWhenHasValue?: boolean;
}
/**
 * DatePicker 컴포넌트 (커스텀 달력)
 */
export declare const DatePicker: React.FC<DatePickerProps>;
export {};
//# sourceMappingURL=DatePicker.d.ts.map