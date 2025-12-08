/**
 * App Layout Component
 *
 * 전체 앱 레이아웃 (Header + Sidebar + Content)
 * [불변 규칙] 반응형 Mobile에서 Drawer, Desktop에서 Persistent Sidebar
 */

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { Header, HeaderProps } from './Header';
import { Sidebar, SidebarItem } from './Sidebar';

export interface AppLayoutProps {
  header?: HeaderProps;
  sidebar?: {
    items: SidebarItem[];
    currentPath?: string;
    onItemClick?: (item: SidebarItem) => void;
  };
  children: React.ReactNode;
  className?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  header,
  sidebar,
  children,
  className,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      {header && (
        <Header
          {...header}
          onMenuClick={isMobile && sidebar ? () => setSidebarOpen(true) : undefined}
        />
      )}

      {/* Main Content Area */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Sidebar */}
        {sidebar && (
          <Sidebar
            items={sidebar.items}
            currentPath={sidebar.currentPath}
            onItemClick={sidebar.onItemClick}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}

        {/* Content */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            backgroundColor: 'var(--color-gray-50, #f9fafb)',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

