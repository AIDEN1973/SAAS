/**
 * App Layout Component
 *
 * 전체 앱 레이아웃 (Header + Sidebar + Content)
 * [불변 규칙] 반응형 Mobile에서 Drawer, Desktop에서 Persistent Sidebar
 */

import React, { useState, useEffect } from 'react';
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
  const isTablet = mode === 'md';
  const isDesktop = mode === 'lg' || mode === 'xl';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isTablet); // 태블릿 모드에서는 자동으로 축소

  // 반응형 모드 변경 시 사이드바 상태 자동 조정
  useEffect(() => {
    if (isTablet) {
      // 태블릿 모드: 자동 축소
      setSidebarCollapsed(true);
    } else if (isDesktop) {
      // 데스크톱 모드: 자동 확장
      setSidebarCollapsed(false);
    }
  }, [isTablet, isDesktop]);

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--color-background)',
      }}
    >
      {/* Header */}
      {header && (
        <Header
          {...header}
          onMenuClick={isMobile && sidebar ? () => setSidebarOpen(true) : undefined}
          sidebarCollapsed={!isMobile ? sidebarCollapsed : undefined}
          onSidebarToggle={!isMobile ? () => setSidebarCollapsed((prev) => !prev) : undefined}
          showSidebarToggle={isDesktop} // 데스크톱에서만 토글 버튼 표시
        />
      )}

      {/* Main Content Area */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
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
            collapsed={!isMobile ? sidebarCollapsed : false}
          />
        )}

        {/* Content */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            backgroundColor: 'var(--color-background)',
            // 모바일(xs, sm): padding 제거 (Container에서 처리), 태블릿 이상(md+): 넓은 여백 (유아이 문서 6-1 준수)
            padding: isMobile
              ? 0 // 모바일: padding 제거 (Container에서만 padding 처리)
              : 'var(--spacing-xl)', // 태블릿 이상: 32px
            transition: 'var(--transition-all)',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

