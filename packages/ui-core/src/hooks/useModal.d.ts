/**
 * useModal Hook
 *
 * 전역 모달 컨텍스트 기반 Alert/Confirm 모달 관리 Hook
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용한다.
 */
import { ReactNode } from 'react';
interface ModalContextType {
    showAlert: (message: string, title?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    showConfirm: (message: string, title?: string) => Promise<boolean>;
}
/**
 * Modal Provider 컴포넌트
 *
 * 앱 최상위에 배치하여 전역 모달 관리
 */
export declare function ModalProvider({ children }: {
    children: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
/**
 * useModal Hook
 *
 * 전역 모달 컨텍스트에서 showAlert, showConfirm 함수를 가져옴
 */
export declare function useModal(): ModalContextType;
export {};
//# sourceMappingURL=useModal.d.ts.map