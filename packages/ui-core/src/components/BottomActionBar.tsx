/**
 * Bottom Action Bar
 * 
 * Mobile ?œì?: Bottom Action Bar
 * [ë¶ˆë? ê·œì¹™] Mobile?ì„œ??Bottom Action Barë¥??œì??¼ë¡œ ?¬ìš©
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§ˆì—??Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?˜ì? ?ŠëŠ”??
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
 * Mobile?ì„œë§??œì‹œ, Desktop?ì„œ???ë‹¨?¼ë¡œ ?´ë™
 */
export const BottomActionBar: React.FC<BottomActionBarProps> = ({
  children,
  className,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  if (!isMobile) {
    // Desktop: ?ë‹¨ ?¡ì…˜ ë°”ë¡œ ë³€??
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
