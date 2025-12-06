/**
 * Layout Components
 * 
 * 반응형 레이아웃 컴포넌트
 * Mobile: Card-first
 * Tablet: 2-column + Drawer Overlay
 * Desktop: Multi-panel + Persistent Sidebar
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
}

export const Container: React.FC<ContainerProps> = ({
  children,
  maxWidth = 'xl',
  padding = 'md',
  className,
}) => {
  const maxWidthClasses = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    full: 'max-w-full',
  };

  const paddingClasses = {
    xs: 'px-1',
    sm: 'px-2',
    md: 'px-4',
    lg: 'px-6',
    xl: 'px-8',
    '2xl': 'px-12',
    '3xl': 'px-16',
  };

  return (
    <div
      className={clsx(
        'mx-auto w-full',
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        className
      )}
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
}

export const Grid: React.FC<GridProps> = ({
  children,
  columns = 1,
  gap = 'md',
  className,
}) => {
  const mode = useResponsiveMode();
  
  // 반응형 컬럼 수 조정
  const responsiveColumns = mode === 'mobile' ? 1 : mode === 'tablet' ? 2 : columns;
  
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  const gapClasses = {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
    '2xl': 'gap-12',
    '3xl': 'gap-16',
  };

  return (
    <div
      className={clsx(
        'grid',
        columnClasses[responsiveColumns as keyof typeof columnClasses],
        gapClasses[gap],
        className
      )}
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
  const isMobile = mode === 'mobile';

  if (isMobile) {
    // Mobile: Sidebar는 Drawer로 처리 (별도 컴포넌트 필요)
    return (
      <div className={clsx('flex flex-col', className)}>
        <main className="flex-1">{main}</main>
      </div>
    );
  }

  return (
    <div className={clsx('flex', className)}>
      <aside
        className="hidden md:block border-r border-gray-200"
        style={{ width: sidebarWidth, minWidth: sidebarWidth }}
      >
        {sidebar}
      </aside>
      <main className="flex-1 overflow-auto">{main}</main>
    </div>
  );
};

