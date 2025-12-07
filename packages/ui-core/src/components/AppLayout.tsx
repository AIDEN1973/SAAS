/**
 * App Layout Component
 * 
 * ?„ì²´ ???ˆì´?„ì›ƒ (Header + Sidebar + Content)
 * [ë¶ˆë? ê·œì¹™] ë°˜ì‘?? Mobile?ì„œ??Drawer, Desktop?ì„œ??Persistent Sidebar
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

