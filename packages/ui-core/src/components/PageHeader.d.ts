/**
 * PageHeader Component
 *
 * 페이지 타이틀과 액션 버튼을 한 줄로 배치하는 공통 컴포넌트
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import React from 'react';
export interface PageHeaderProps {
    /** 페이지 타이틀 */
    title: string;
    /** 타이틀 옆에 표시할 액션 버튼들 */
    actions?: React.ReactNode;
    /** 타이틀 폰트 크기 (기본값: '3xl') */
    titleSize?: 'xl' | '2xl' | '3xl';
    /** 타이틀 폰트 두께 (기본값: 'extrabold') */
    titleWeight?: 'bold' | 'extrabold';
    /** 추가 클래스명 */
    className?: string;
    /** 추가 스타일 */
    style?: React.CSSProperties;
}
/**
 * PageHeader 컴포넌트
 *
 * 페이지 타이틀과 액션 버튼을 한 줄로 배치
 */
export declare const PageHeader: React.FC<PageHeaderProps>;
//# sourceMappingURL=PageHeader.d.ts.map