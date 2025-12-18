/**
 * ActionHeader Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import React from 'react';
export interface ActionHeaderProps {
    title?: string;
    actions?: React.ReactNode;
    className?: string;
}
/**
 * ActionHeader 컴포넌트
 *
 * 액션 버튼이 있는 헤더
 */
export declare const ActionHeader: React.FC<ActionHeaderProps>;
//# sourceMappingURL=ActionHeader.d.ts.map