/**
 * RightLayerMenuLayout Component
 *
 * 우측 레이어 메뉴와 함께 사용하는 레이아웃 래퍼
 * [불변 규칙] 레이어 메뉴 너비만큼 바디 너비가 줄어듭니다 (push 방식).
 * [불변 규칙] 바디 너비가 태블릿 브레이크포인트 이하로 내려가면 오버레이 모드로 전환됩니다.
 */
import React from 'react';
import { RightLayerMenuProps } from './RightLayerMenu';
export interface RightLayerMenuLayoutProps {
    children: React.ReactNode;
    layerMenu: Omit<RightLayerMenuProps, 'isOpen' | 'onClose'> & {
        isOpen: boolean;
        onClose: () => void;
    };
    className?: string;
}
/**
 * RightLayerMenuLayout 컴포넌트
 *
 * 우측 레이어 메뉴와 함께 사용하는 레이아웃 래퍼
 * 레이어 메뉴가 열리면 바디 너비가 자동으로 줄어듭니다.
 * 바디 너비가 태블릿 브레이크포인트(768px) 이하로 내려가면 오버레이 모드로 전환됩니다.
 */
export declare const RightLayerMenuLayout: React.FC<RightLayerMenuLayoutProps>;
//# sourceMappingURL=RightLayerMenuLayout.d.ts.map