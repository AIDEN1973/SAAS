/**
 * Header Component
 * 
 * ?ë‹¨ ?¤ë” ë©”ë‰´
 * [ë¶ˆë? ê·œì¹™] ë°˜ì‘?? Mobile?ì„œ???„ë²„ê±?ë©”ë‰´, Desktop?ì„œ???„ì²´ ë©”ë‰´ ?œì‹œ
 */

import React from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { Button } from './Button';

export interface HeaderProps {
  title?: string;
  logo?: React.ReactNode;
  onMenuClick?: () => void;
  rightContent?: React.ReactNode;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = '?”ì–´??,
  logo,
  onMenuClick,
  rightContent,
  className,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  return (
    <header
      className={clsx(className)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'var(--color-white)',
        borderBottom: '1px solid var(--color-gray-200)',
        padding: 'var(--spacing-md) var(--spacing-lg)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
        {isMobile && onMenuClick && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            style={{ padding: 'var(--spacing-sm)' }}
          >
            <svg
              style={{ width: 'var(--spacing-lg)', height: 'var(--spacing-lg)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </Button>
        )}
        {logo && <div style={{ display: 'flex', alignItems: 'center' }}>{logo}</div>}
        <h1
          style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text)',
            margin: 0,
          }}
        >
          {title}
        </h1>
      </div>
      {rightContent && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          {rightContent}
        </div>
      )}
    </header>
  );
};

