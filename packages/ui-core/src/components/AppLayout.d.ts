/**
 * App Layout Component
 *
 * 전체 앱 레이아웃 (Header + Sidebar + Content)
 * [불변 규칙] 반응형 Mobile에서 Drawer, Desktop에서 Persistent Sidebar
 */
import React from 'react';
import { HeaderProps } from './Header';
import { SidebarItem } from './Sidebar';
export interface AppLayoutProps {
    header?: HeaderProps;
    sidebar?: {
        items: SidebarItem[];
        currentPath?: string;
        onItemClick?: (item: SidebarItem) => void;
    };
    children: React.ReactNode;
    className?: string;
}
export declare const AppLayout: React.FC<AppLayoutProps>;
//# sourceMappingURL=AppLayout.d.ts.map