/**
 * Button Component
 *
 * [불변 규칙] Atlaskit Button을 래핑하여 사용합니다.
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 Atlaskit 테마를 사용합니다.
 */

import React from 'react';
import AKButton, { ButtonProps as AKButtonProps } from '@atlaskit/button';
import { ColorToken, SizeToken } from '@design-system/core';

export interface ButtonProps {
  variant?: 'solid' | 'outline' | 'ghost';
  color?: ColorToken;
  size?: SizeToken;
  fullWidth?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: any;
}

/**
 * Button 컴포넌트
 *
 * Atlaskit Button을 래핑하여 사용합니다.
 * 스키마에서의 사용 예:
 * {
 *   "type": "button",
 *   "variant": "solid",
 *   "color": "primary",
 *   "size": "md"
 * }
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'solid',
  color = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  children,
  onClick,
  ...props
}) => {
  // Atlaskit appearance 매핑
  const appearanceMap: Record<'solid' | 'outline' | 'ghost', AKButtonProps['appearance']> = {
    solid: color === 'primary' ? 'primary' : 'default',
    outline: 'subtle',
    ghost: 'subtle-link',
  };

  // Atlaskit spacing 매핑
  const spacingMap: Record<SizeToken, AKButtonProps['spacing']> = {
    xs: 'compact',
    sm: 'compact',
    md: 'default',
    lg: 'default',
    xl: 'default',
  };

  return (
    <AKButton
      appearance={appearanceMap[variant]}
      spacing={spacingMap[size]}
      isDisabled={props.disabled}
      shouldFitContainer={fullWidth}
      className={className}
      onClick={onClick as any}
      {...props}
    >
      {children}
    </AKButton>
  );
};
