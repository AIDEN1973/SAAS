/**
 * ActionButtonGroup Component
 *
 * [불변 규칙] Tailwind 클래스 사용 금지
 * [불변 규칙] 모든 스타일은 design-system CSS 변수 토큰만 사용
 *
 * 목적:
 * - 페이지/폼의 하단 액션(삭제/취소/저장, 삭제/수정 등)을 일관된 레이아웃으로 재사용
 */
import React from 'react';
import type { ColorToken, SizeToken } from '@design-system/core';
export interface ActionButtonItem {
    key: string;
    label: string;
    /**
     * 루시드 아이콘 요소를 전달하세요. (예: icon: <Trash2 />)
     * ActionButtonGroup이 IconButtonGroup과 동일한 기준(CSS 변수)으로 size/strokeWidth를 적용합니다.
     */
    icon?: React.ReactNode;
    onClick?: () => void | Promise<void>;
    type?: 'button' | 'submit';
    variant?: 'solid' | 'outline' | 'ghost';
    color?: ColorToken;
    size?: SizeToken;
    disabled?: boolean;
}
export interface ActionButtonGroupProps {
    items: ActionButtonItem[];
    /** 기본값: sm (SchemaForm/StudentsPage 일관) */
    gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    /** 기본값: md (SchemaForm 버튼 영역과 정합) */
    marginTop?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'none';
}
export declare const ActionButtonGroup: React.FC<ActionButtonGroupProps>;
//# sourceMappingURL=ActionButtonGroup.d.ts.map