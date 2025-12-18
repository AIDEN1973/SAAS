/**
 * Card Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import React from 'react';
import { SpacingToken } from '@design-system/core';
export interface CardProps {
    children: React.ReactNode;
    padding?: SpacingToken;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
    variant?: 'default' | 'elevated' | 'outlined';
    onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
    /** 카드 내부 타이틀 (타이틀 하단에 구분선 자동 추가) */
    title?: React.ReactNode;
    /** 타이틀 위치 (기본값: 'top-left') */
    titlePosition?: 'top-left' | 'top-right' | 'top-center';
    /** 타이틀 왼쪽에 표시할 아이콘 (루시드 아이콘) */
    titleIcon?: React.ReactNode;
    /** 타이틀 영역 우측에 표시할 컨텐츠 */
    titleRightContent?: React.ReactNode;
}
export declare const Card: React.FC<CardProps>;
//# sourceMappingURL=Card.d.ts.map