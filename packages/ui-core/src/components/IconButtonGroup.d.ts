/**
 * IconButtonGroup Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ColorToken } from '@design-system/core';
export interface IconButtonItem {
    icon: LucideIcon;
    tooltip: string;
    onClick: () => void;
    variant?: 'solid' | 'outline' | 'ghost';
    color?: ColorToken;
    disabled?: boolean;
}
export interface IconButtonGroupProps {
    items: IconButtonItem[];
    className?: string;
    align?: 'left' | 'center' | 'right';
}
/**
 * IconButtonGroup 컴포넌트
 *
 * 아이콘 버튼 그룹을 표시하는 공통 컴포넌트
 */
export declare const IconButtonGroup: React.FC<IconButtonGroupProps>;
//# sourceMappingURL=IconButtonGroup.d.ts.map