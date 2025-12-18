/**
 * Sidebar Component
 *
 * 좌측 사이드바 메뉴
 * [불변 규칙] 반응형 Mobile에서 Drawer로 변환, Desktop에서 Persistent Sidebar
 */
import React from 'react';
export interface SidebarItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
    path?: string;
    onClick?: () => void;
    children?: SidebarItem[];
    isAdvanced?: boolean;
}
export interface SidebarProps {
    items: SidebarItem[];
    currentPath?: string;
    onItemClick?: (item: SidebarItem) => void;
    className?: string;
    isOpen?: boolean;
    onClose?: () => void;
    collapsed?: boolean;
    pageHeaderTitle?: string;
    pageHeaderActions?: React.ReactNode;
}
export declare const Sidebar: React.FC<SidebarProps>;
//# sourceMappingURL=Sidebar.d.ts.map