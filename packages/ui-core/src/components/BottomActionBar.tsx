/**
 * Bottom Action Bar
 * 
 * Mobile 표준: Bottom Action Bar
 * [불변 규칙] Mobile에서는 Bottom Action Bar를 표준으로 사용
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';

export interface BottomActionBarProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Bottom Action Bar
 * Mobile에서만 표시, Desktop에서는 상단으로 이동
 */
export const BottomActionBar: React.FC<BottomActionBarProps> = ({
  children,
  className,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  if (!isMobile) {
    // Desktop: 상단 액션 바로 변환
    return (
      <div
        className={clsx(className)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-md)',
          borderBottom: '1px solid var(--color-gray-200)',
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={clsx(className)}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--color-white)',
        borderTop: '1px solid var(--color-gray-200)',
        padding: 'var(--spacing-md)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--spacing-sm)',
        zIndex: 50,
      }}
    >
      {children}
    </div>
  );
};
