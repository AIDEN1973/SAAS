/**
 * ActionHeader Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';

export interface ActionHeaderProps {
  title?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * ActionHeader 컴포넌트
 *
 * 액션 버튼이 있는 헤더
 */
export const ActionHeader: React.FC<ActionHeaderProps> = ({
  title,
  actions,
  className,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--spacing-md)',
        borderBottom: '1px solid var(--color-gray-200)',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        gap: 'var(--spacing-sm)',
      }}
    >
      {title && (
        <h2
          style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text)',
            margin: 0,
          }}
        >
          {title}
        </h2>
      )}
      {actions && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            flexWrap: 'wrap',
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
};

