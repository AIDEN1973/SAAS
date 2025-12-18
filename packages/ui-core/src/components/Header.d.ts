/**
 * Header Component
 *
 * 상단 헤더 메뉴
 * [불변 규칙] 반응형: Mobile에서는 햄버거 메뉴, Desktop에서는 전체 메뉴 표시
 */
import React from 'react';
export interface HeaderProps {
    title?: string;
    logo?: React.ReactNode;
    onMenuClick?: () => void;
    rightContent?: React.ReactNode;
    className?: string;
    sidebarCollapsed?: boolean;
    onSidebarToggle?: () => void;
    showSidebarToggle?: boolean;
}
export declare const Header: React.FC<HeaderProps>;
//# sourceMappingURL=Header.d.ts.map