/**
 * Spinner Component
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§ˆì—??Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?˜ì? ?ŠëŠ”??
 * [ë¶ˆë? ê·œì¹™] ëª¨ë“  ?¤í??¼ì? design-system ? í°???¬ìš©?œë‹¤.
 */

import React from 'react';
import { clsx } from 'clsx';
import { ColorToken, SizeToken } from '@design-system/core';

export interface SpinnerProps {
  size?: SizeToken;
  color?: ColorToken;
  className?: string;
}

/**
 * Spinner ì»´í¬?ŒíŠ¸
 * 
 * ë¡œë”© ?¤í”¼??
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className,
}) => {
  const sizeMap: Record<SizeToken, string> = {
    xs: '16px',
    sm: '20px',
    md: '24px',
    lg: '32px',
    xl: '40px',
  };

  const colorMap: Record<ColorToken, string> = {
    primary: 'var(--color-primary)',
    secondary: 'var(--color-secondary)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
    info: 'var(--color-info)',
  };

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'inline-block',
        width: sizeMap[size],
        height: sizeMap[size],
        border: `3px solid ${colorMap[color]}20`,
        borderTopColor: colorMap[color],
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
      role="status"
      aria-label="Loading"
    />
  );
};

