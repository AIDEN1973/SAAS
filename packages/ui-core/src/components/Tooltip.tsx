/**
 * Tooltip Component
 *
 * [불변 규칙] Atlaskit Tooltip을 래핑하여 사용합니다.
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 * [불변 규칙] 모든 스타일은 Atlaskit 테마를 사용합니다.
 */

import React from 'react';
import AKTooltip from '@atlaskit/tooltip';

export interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

/**
 * Tooltip 컴포넌트
 *
 * Atlaskit Tooltip을 래핑하여 사용합니다.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  delay = 200,
  className,
}) => {
  const positionMap: Record<'top' | 'bottom' | 'left' | 'right', 'top' | 'bottom' | 'left' | 'right'> = {
    top: 'top',
    bottom: 'bottom',
    left: 'left',
    right: 'right',
  };

  return (
    <AKTooltip
      content={content}
      position={positionMap[position]}
      delay={delay}
    >
      <div className={className}>
        {children}
      </div>
    </AKTooltip>
  );
};
