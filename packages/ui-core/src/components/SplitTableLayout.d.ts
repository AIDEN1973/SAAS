/**
 * SplitTableLayout Component
 *
 * [불변 규칙] 태블릿 환경에서 사용하는 좌측 목록 + 우측 상세 패널 레이아웃
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 태블릿(md)에서 사용
 * [불변 규칙] 우측 상세 패널 최소 너비 360px
 */
import React from 'react';
export interface SplitTableLayoutProps {
    list: React.ReactNode;
    detail: React.ReactNode;
    listWidth?: string;
    detailMinWidth?: string;
    className?: string;
    onDetailClose?: () => void;
}
/**
 * SplitTableLayout 컴포넌트
 *
 * 태블릿 환경에서 좌측 목록과 우측 상세 패널을 동시에 표시
 */
export declare const SplitTableLayout: React.FC<SplitTableLayoutProps>;
//# sourceMappingURL=SplitTableLayout.d.ts.map