/**
 * Skeleton Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import React from 'react';
export interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    variant?: 'text' | 'circular' | 'rectangular';
    className?: string;
    style?: React.CSSProperties;
}
/**
 * Skeleton 컴포넌트
 *
 * 로딩 스켈레톤
 */
export declare const Skeleton: React.FC<SkeletonProps>;
//# sourceMappingURL=Skeleton.d.ts.map