/**
 * Skeleton Component
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§ˆì—??Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?˜ì? ?ŠëŠ”??
 * [ë¶ˆë? ê·œì¹™] ëª¨ë“  ?¤í??¼ì? design-system ? í°???¬ìš©?œë‹¤.
 */

import React from 'react';
import { clsx } from 'clsx';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Skeleton ì»´í¬?ŒíŠ¸
 * 
 * ë¡œë”© ?¤ì¼ˆ?ˆí†¤
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  variant = 'rectangular',
  className,
  style,
}) => {
  const baseStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-gray-200)',
    borderRadius: variant === 'circular' ? '50%' : variant === 'text' ? '4px' : 'var(--border-radius-md)',
    animation: 'pulse 1.5s ease-in-out infinite',
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height }),
    ...style,
  };

  if (variant === 'text') {
    return (
      <div
        className={clsx(className)}
        style={{
          ...baseStyle,
          height: height || '1em',
          width: width || '100%',
        }}
      />
    );
  }

  return (
    <div
      className={clsx(className)}
      style={baseStyle}
    />
  );
};

