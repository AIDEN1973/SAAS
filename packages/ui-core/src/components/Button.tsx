/**
 * Button Component
 * 
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용한다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { ColorToken, SizeToken } from '@design-system/core';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'ghost';
  color?: ColorToken;
  size?: SizeToken;
  fullWidth?: boolean;
  children: React.ReactNode;
}

/**
 * Button 컴포넌트
 * 
 * 스키마에서 사용 예:
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
  ...props
}) => {
  // 토큰 기반 클래스 생성 (Tailwind는 내부적으로만 사용)
  const baseClasses = 'font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    solid: `bg-${color}-500 text-white hover:bg-${color}-600 focus:ring-${color}-500`,
    outline: `border-2 border-${color}-500 text-${color}-500 hover:bg-${color}-50 focus:ring-${color}-500`,
    ghost: `text-${color}-500 hover:bg-${color}-50 focus:ring-${color}-500`,
  };
  
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl',
  };
  
  return (
    <button
      className={clsx(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

