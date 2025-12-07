/**
 * SplitTableLayout Component
 * 
 * [ë¶ˆë? ê·œì¹™] ?œë¸”ë¦??˜ê²½?ì„œ ?¬ìš©?˜ëŠ” ì¢Œì¸¡ ëª©ë¡ + ?°ì¸¡ ?ì„¸ ?¨ë„ ?ˆì´?„ì›ƒ
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§ˆì—??Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?˜ì? ?ŠëŠ”??
 * [ë¶ˆë? ê·œì¹™] ?œë¸”ë¦?(md)?ì„œ ?¬ìš©
 * [ë¶ˆë? ê·œì¹™] ?°ì¸¡ ?ì„¸ ?¨ë„ ìµœì†Œ ????360px
 */

import React from 'react';
import { clsx } from 'clsx';
import { Card } from './Card';
import { useResponsiveMode } from '../hooks/useResponsiveMode';

export interface SplitTableLayoutProps {
  list: React.ReactNode;
  detail: React.ReactNode;
  listWidth?: string;
  detailMinWidth?: string;
  className?: string;
  onDetailClose?: () => void;
}

/**
 * SplitTableLayout ì»´í¬?ŒíŠ¸
 * 
 * ?œë¸”ë¦??˜ê²½?ì„œ ì¢Œì¸¡ ëª©ë¡ê³??°ì¸¡ ?ì„¸ ?¨ë„???™ì‹œ???œì‹œ
 */
export const SplitTableLayout: React.FC<SplitTableLayoutProps> = ({
  list,
  detail,
  listWidth = '40%',
  detailMinWidth = '360px',
  className,
  onDetailClose,
}) => {
  const mode = useResponsiveMode();
  const isTablet = mode === 'md';

  // ?œë¸”ë¦¿ì´ ?„ë‹ˆë©?ëª©ë¡ë§??œì‹œ
  if (!isTablet) {
    return <div className={clsx(className)}>{list}</div>;
  }

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        height: '100%',
        gap: 'var(--spacing-md)',
      }}
    >
      {/* Left: List */}
      <div
        style={{
          width: listWidth,
          minWidth: '200px',
          overflow: 'auto',
        }}
      >
        {list}
      </div>

      {/* Right: Detail Panel */}
      <Card
        variant="elevated"
        padding="lg"
        style={{
          flex: 1,
          minWidth: detailMinWidth,
          overflow: 'auto',
          position: 'sticky',
          top: 0,
          maxHeight: '100vh',
        }}
      >
        {onDetailClose && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 'var(--spacing-md)',
            }}
          >
            <button
              onClick={onDetailClose}
              style={{
                padding: 'var(--spacing-xs)',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: 'var(--font-size-lg)',
                color: 'var(--color-text-secondary)',
                minWidth: '44px',
                minHeight: '44px',
              }}
            >
              ??
            </button>
          </div>
        )}
        {detail}
      </Card>
    </div>
  );
};

