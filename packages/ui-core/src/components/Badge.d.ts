/**
 * Badge Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import React from 'react';
import { ColorToken, SizeToken } from '@design-system/core';
export interface BadgeProps {
    children: React.ReactNode;
    color?: ColorToken | 'blue' | 'gray' | 'green';
    size?: SizeToken;
    variant?: 'solid' | 'outline' | 'soft';
    className?: string;
    style?: React.CSSProperties;
}
/**
 * Badge 컴포넌트
 *
 * 태그, 상태 표시 등에 사용
 */
export declare const Badge: React.FC<BadgeProps>;
//# sourceMappingURL=Badge.d.ts.map