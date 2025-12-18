/**
 * Button Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import React from 'react';
import { ColorToken, SizeToken } from '@design-system/core';
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'solid' | 'outline' | 'ghost';
    color?: ColorToken;
    size?: SizeToken;
    fullWidth?: boolean;
    selected?: boolean;
    children: React.ReactNode;
}
/**
 * Button 컴포넌트
 *
 * 스키마에서의 사용 예:
 * {
 *   "type": "button",
 *   "variant": "solid",
 *   "color": "primary",
 *   "size": "md"
 * }
 */
export declare const Button: React.FC<ButtonProps>;
//# sourceMappingURL=Button.d.ts.map