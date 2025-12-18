/**
 * Tabs Component
 *
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import React from 'react';
export interface TabItem {
    key: string;
    label: string;
    content: React.ReactNode;
    disabled?: boolean;
}
export interface TabsProps {
    items: TabItem[];
    defaultActiveKey?: string;
    activeKey?: string;
    onChange?: (key: string) => void;
    className?: string;
    style?: React.CSSProperties;
    variant?: 'default' | 'pills';
}
/**
 * Tabs 컴포넌트
 *
 * 커스텀 구현된 Tabs 컴포넌트입니다.
 */
export declare const Tabs: React.FC<TabsProps>;
//# sourceMappingURL=Tabs.d.ts.map