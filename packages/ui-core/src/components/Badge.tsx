/**
 * Badge Component
 *
 * [불변 규칙] Atlaskit Badge를 래핑하여 사용합니다.
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 Atlaskit 테마를 사용합니다.
 */

import React from 'react';
import AKBadge from '@atlaskit/badge';
import { ColorToken, SizeToken } from '@design-system/core';

export interface BadgeProps {
  children: React.ReactNode;
  color?: ColorToken;
  size?: SizeToken;
  variant?: 'solid' | 'outline' | 'soft';
  className?: string;
}

/**
 * Badge 컴포넌트
 *
 * 태그, 상태 표시 등에 사용
 * Atlaskit Badge를 래핑하여 사용합니다.
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  color = 'primary',
}) => {
  // Atlaskit Badge appearance 매핑
  const appearanceMap: Record<ColorToken, 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'grey'> = {
    primary: 'blue',
    secondary: 'purple',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
  };

  return (
    <AKBadge
      appearance={appearanceMap[color] as any}
    >
      {children}
    </AKBadge>
  );
};

