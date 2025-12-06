/**
 * Bottom Action Bar
 * 
 * Mobile 표준: Bottom Action Bar
 * [불변 규칙] Mobile에서는 Bottom Action Bar를 표준으로 사용
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
  const isMobile = mode === 'mobile';

  if (!isMobile) {
    // Desktop: 상단 액션 바로 변환
    return (
      <div className={clsx('flex items-center gap-2 p-4 border-b', className)}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'fixed bottom-0 left-0 right-0',
        'bg-white border-t border-gray-200',
        'p-4 shadow-lg',
        'flex items-center justify-between gap-2',
        'z-50',
        className
      )}
    >
      {children}
    </div>
  );
};

