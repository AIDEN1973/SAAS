/**
 * Modal Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import React from 'react';
export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    closeOnOverlayClick?: boolean;
    closeOnEscape?: boolean;
    className?: string;
}
/**
 * Modal 컴포넌트
 *
 * 오버레이 위에 표시되는 모달 레이아웃
 */
export declare const Modal: React.FC<ModalProps>;
//# sourceMappingURL=Modal.d.ts.map