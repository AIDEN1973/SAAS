/**
 * Layout Components
 * 
 * 반응형 레이아웃 컴포넌트
 * Mobile: Card-first
 * Tablet: 2-column + Drawer Overlay
 * Desktop: Multi-panel + Persistent Sidebar
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { SpacingToken } from '@design-system/core';

export interface ContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: SpacingToken;
  className?: string;
  style?: React.CSSProperties;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  maxWidth = 'xl',
  padding = 'md',
  className,
  style,
}) => {
  const maxWidthMap: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', string> = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    full: '100%',
  };

  const paddingMap: Record<SpacingToken, string> = {
    xs: 'var(--spacing-xs)',
    sm: 'var(--spacing-sm)',
    md: 'var(--spacing-md)',
    lg: 'var(--spacing-lg)',
    xl: 'var(--spacing-xl)',
    '2xl': 'var(--spacing-2xl)',
    '3xl': 'var(--spacing-3xl)',
  };

  return (
    <div
      className={clsx(className)}
      style={{
        margin: '0 auto',
        width: '100%',
        maxWidth: maxWidthMap[maxWidth],
        paddingLeft: paddingMap[padding],
        paddingRight: paddingMap[padding],
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export interface GridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: SpacingToken;
  className?: string;
  style?: React.CSSProperties;
}

export const Grid: React.FC<GridProps> = ({
  children,
  columns = 1,
  gap = 'md',
  className,
  style,
}) => {
  const mode = useResponsiveMode();
  
  // 반응형 컬럼 수 조정
  const responsiveColumns = (mode === 'xs' || mode === 'sm') ? 1 : mode === 'md' ? 2 : columns;

  const gapMap: Record<SpacingToken, string> = {
    xs: 'var(--spacing-xs)',
    sm: 'var(--spacing-sm)',
    md: 'var(--spacing-md)',
    lg: 'var(--spacing-lg)',
    xl: 'var(--spacing-xl)',
    '2xl': 'var(--spacing-2xl)',
    '3xl': 'var(--spacing-3xl)',
  };

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${responsiveColumns}, 1fr)`,
        gap: gapMap[gap],
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export interface SidebarLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  sidebarWidth?: string;
  className?: string;
}

/**
 * Sidebar Layout
 * Mobile: Sidebar 숨김 (Drawer로 전환)
 * Desktop: Persistent Sidebar
 */
export const SidebarLayout: React.FC<SidebarLayoutProps> = ({
  sidebar,
  main,
  sidebarWidth = '256px',
  className,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  if (isMobile) {
    // Mobile: Sidebar는 Drawer로 처리 (별도 컴포넌트 필요)
    return (
      <div
        className={clsx(className)}
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <main style={{ flex: 1 }}>{main}</main>
      </div>
    );
  }

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
      }}
    >
      <aside
        style={{
          display: 'block',
          width: sidebarWidth,
          minWidth: sidebarWidth,
          borderRight: '1px solid var(--color-gray-200)',
        }}
      >
        {sidebar}
      </aside>
      <main
        style={{
          flex: 1,
          overflow: 'auto',
        }}
      >
        {main}
      </main>
    </div>
  );
};
