/**
 * Radio Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 * [불변 규칙] 터치 영역 최소 44px 보장
 */
import React from 'react';
export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
    label?: string;
    error?: string;
    helperText?: string;
    fullWidth?: boolean;
}
/**
 * Radio 컴포넌트
 */
export declare const Radio: React.FC<RadioProps>;
//# sourceMappingURL=Radio.d.ts.map