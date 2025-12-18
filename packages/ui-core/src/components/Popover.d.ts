/**
 * Popover Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 *
 * 드롭다운, 달력 등 포털 기반 UI를 위한 공통 컴포넌트
 */
import React from 'react';
export interface PopoverProps {
    isOpen: boolean;
    onClose: () => void;
    anchorEl: HTMLElement | null;
    children: React.ReactNode;
    placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
    offset?: number;
    className?: string;
    style?: React.CSSProperties;
}
/**
 * Popover 컴포넌트
 *
 * 앵커 요소 기준으로 위치를 계산하여 포털로 렌더링합니다.
 */
export declare const Popover: React.FC<PopoverProps>;
//# sourceMappingURL=Popover.d.ts.map