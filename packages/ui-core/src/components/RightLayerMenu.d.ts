/**
 * RightLayerMenu Component
 *
 * 우측 레이어 메뉴 (슬라이딩 패널)
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 * [불변 규칙] 레이어 메뉴 너비만큼 바디 너비가 줄어듭니다 (push 방식).
 */
import React from 'react';
export interface RightLayerMenuProps {
    isOpen: boolean;
    onClose: () => void;
    title: string | React.ReactNode;
    children: React.ReactNode;
    width?: string;
    headerActions?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}
/**
 * RightLayerMenu 컴포넌트
 *
 * 우측에서 슬라이딩으로 나타나는 레이어 메뉴
 * 레이어 메뉴가 열리면 바디 너비가 자동으로 줄어듭니다.
 */
export declare const RightLayerMenu: React.FC<RightLayerMenuProps>;
//# sourceMappingURL=RightLayerMenu.d.ts.map