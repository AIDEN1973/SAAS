// LAYER: UI_CORE_COMPONENT
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
  const [, setSidebarCollapsed] = useState(isTablet); // 태블릿 모드에서는 자동으로 축소

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
        />
      )}

      {/* 에이전트 모드 전용 라우트(/agent)이거나 에이전트가 열린 경우 children 그대로 렌더링 */}
      {/* /agent 라우트는 AgentPage에서 AgentModeContainer를 직접 렌더링 */}
      {sidebar?.currentPath === '/agent' ? (
        // 에이전트 전용 라우트: children(AgentPage)을 그대로 렌더링
        <div
          style={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      ) : (
        // 일반 모드 (기존 레이아웃)
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
            />
          )}

          {/* Content */}
          <main
            style={{
              flex: 1,
              overflowY: 'scroll', // 스크롤바 항상 표시하여 페이지별 콘텐츠 너비 일관성 보장
              overflowX: 'hidden',
              backgroundColor: 'var(--color-background)',
              // padding은 각 페이지의 Container 컴포넌트에서 처리 (이중 padding 방지)
              padding: 0,
              transition: 'var(--transition-all)',
            }}
          >
            {children}
          </main>
        </div>
      )}
    </div>
  );
};

