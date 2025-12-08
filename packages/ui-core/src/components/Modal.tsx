/**
 * Modal Component
 *
 * [불변 규칙] Atlaskit ModalDialog를 래핑하여 사용합니다.
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 Atlaskit 테마를 사용합니다.
 */

import React from 'react';
import ModalDialog, { ModalTransition } from '@atlaskit/modal-dialog';
import { Button } from './Button';

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
 * Atlaskit ModalDialog를 래핑하여 사용합니다.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className,
}) => {
  const sizeMap: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', 'small' | 'medium' | 'large' | 'x-large'> = {
    sm: 'small',
    md: 'medium',
    lg: 'large',
    xl: 'x-large',
    full: 'x-large',
  };

  return (
    <ModalTransition>
      {isOpen && (
        <ModalDialog
          onClose={onClose}
          width={size === 'full' ? '100%' : sizeMap[size]}
          shouldCloseOnOverlayClick={closeOnOverlayClick}
          shouldCloseOnEscapePress={closeOnEscape}
        >
          {title && <h2>{title}</h2>}
          {children}
          {footer && <div>{footer}</div>}
        </ModalDialog>
      )}
    </ModalTransition>
  );
};

