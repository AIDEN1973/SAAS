/**
 * Layout Components
 *
 * 반응형 레이아웃 컴포넌트
 * Mobile: Card-first
 * Tablet: 2-column + Drawer Overlay
 * Desktop: Multi-panel + Persistent Sidebar
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 */
import React from 'react';
type SpacingToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export interface ContainerProps {
    children: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    padding?: SpacingToken;
    /** 상단 여백 (기본값: 'xl') */
    paddingTop?: SpacingToken | 'none';
    className?: string;
    style?: React.CSSProperties;
}
export declare const Container: React.FC<ContainerProps>;
export interface GridProps {
    children: React.ReactNode;
    columns?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 'auto-fit' | 'auto-fill' | {
        xs?: number;
        sm?: number;
        md?: number;
        lg?: number;
        xl?: number;
    };
    columnTemplate?: string;
    minColumnWidth?: string;
    gap?: SpacingToken;
    className?: string;
    style?: React.CSSProperties;
}
export declare const Grid: React.FC<GridProps>;
export interface SidebarLayoutProps {
    sidebar: React.ReactNode;
    main: React.ReactNode;
    sidebarWidth?: string;
    className?: string;
}
/**
 * Sidebar Layout
 * Mobile: Sidebar 숨김 (Drawer로 변환)
 * Desktop: Persistent Sidebar
 */
export declare const SidebarLayout: React.FC<SidebarLayoutProps>;
export {};
//# sourceMappingURL=Layout.d.ts.map