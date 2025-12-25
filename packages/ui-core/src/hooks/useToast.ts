/**
 * useToast Hook
 *
 * useModal의 showAlert를 래핑하여 일관된 toast 인터페이스 제공
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용한다.
 */

import { useCallback } from 'react';
import { useModal } from './useModal';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface UseToastReturn {
  toast: (message: string, variant?: ToastVariant, title?: string) => void;
}

/**
 * useToast Hook
 *
 * useModal의 showAlert를 래핑하여 (message, variant, title?) 순서로 통일된 인터페이스 제공
 * variant에 따라 기본 제목을 자동 설정
 *
 * @returns toast 함수
 *
 * @example
 * ```tsx
 * const { toast } = useToast();
 * toast('저장되었습니다.', 'success');
 * toast('오류가 발생했습니다.', 'error', '에러');
 * ```
 */
export function useToast(): UseToastReturn {
  const { showAlert } = useModal();

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info', title?: string) => {
      const defaultTitle =
        variant === 'success' ? '성공' :
        variant === 'error' ? '오류' :
        variant === 'warning' ? '알림' : '알림';
      showAlert(message, title ?? defaultTitle, variant);
    },
    [showAlert]
  );

  return { toast };
}

