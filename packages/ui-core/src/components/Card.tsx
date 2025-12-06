/**
 * Card Component
 * 
 * Mobile-first Card 레이아웃
 */

import React from 'react';
import { clsx } from 'clsx';
import { SpacingToken } from '@design-system/core';

export interface CardProps {
  children: React.ReactNode;
  padding?: SpacingToken;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  variant?: 'default' | 'elevated' | 'outlined';
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  className,
  style,
  onClick,
  variant = 'default',
}) => {
  const paddingClasses: Record<SpacingToken, string> = {
    xs: 'p-1',
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
    '2xl': 'p-12',
    '3xl': 'p-16',
  };

  const variantClasses = {
    default: 'bg-white border border-gray-200',
    elevated: 'bg-white shadow-md',
    outlined: 'border-2 border-gray-300',
  };

  return (
    <div
      className={clsx(
        'rounded-lg',
        paddingClasses[padding],
        variantClasses[variant],
        onClick && 'cursor-pointer hover:shadow-lg transition-shadow',
        className
      )}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

