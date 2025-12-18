/**
 * Toast Component
 *
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용한다.
 */
import React from 'react';
export interface ToastProps {
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
    onClose?: () => void;
    className?: string;
}
/**
 * Toast 컴포넌트
 *
 * 알림 메시지를 표시하는 토스트
 */
export declare const Toast: React.FC<ToastProps>;
//# sourceMappingURL=Toast.d.ts.map