/**
 * Accordion Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import React from 'react';
export interface AccordionItem {
    key: string;
    title: string;
    content: React.ReactNode;
    disabled?: boolean;
}
export interface AccordionProps {
    items: AccordionItem[];
    defaultOpenKeys?: string[];
    allowMultiple?: boolean;
    className?: string;
}
/**
 * Accordion 컴포넌트
 *
 * 아코디언 컴포넌트
 */
export declare const Accordion: React.FC<AccordionProps>;
//# sourceMappingURL=Accordion.d.ts.map