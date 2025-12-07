/**
 * ActionHeader Component
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§ˆì—??Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?˜ì? ?ŠëŠ”??
 * [ë¶ˆë? ê·œì¹™] ëª¨ë“  ?¤í??¼ì? design-system ? í°???¬ìš©?œë‹¤.
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
 * ActionHeader ì»´í¬?ŒíŠ¸
 * 
 * ?¡ì…˜ ë²„íŠ¼???ˆëŠ” ?¤ë”
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

