/**
 * Header Component
 *
 * 상단 헤더 메뉴
 * [불변 규칙] 반응형: Mobile에서는 햄버거 메뉴, Desktop에서는 전체 메뉴 표시
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
  title = '디어쌤',
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
        zIndex: 'var(--z-sticky)',
        backgroundColor: 'var(--glass-background)',
        backdropFilter: 'var(--backdrop-blur)',
        WebkitBackdropFilter: 'var(--backdrop-blur)',
        borderBottom: '1px solid var(--color-gray-200)',
        padding: 'var(--spacing-md) var(--spacing-xl)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'var(--transition-all)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
        {isMobile && onMenuClick && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            style={{
              padding: 'var(--spacing-sm)',
              borderRadius: 'var(--border-radius-md)',
              minWidth: '44px',
              minHeight: '44px',
            }}
          >
            <svg
              style={{ width: '20px', height: '20px' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </Button>
        )}
        {logo && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              borderRadius: 'var(--border-radius-md)',
            }}
          >
            {logo}
          </div>
        )}
        <h1
          style={{
            fontWeight: 'var(--font-weight-bold)',
            fontSize: 'var(--font-size-xl)',
            color: 'var(--color-text)',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h1>
      </div>
      {rightContent && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
          }}
        >
          {rightContent}
        </div>
      )}
    </header>
  );
};
