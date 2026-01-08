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
import { useAILayerMenu } from '../hooks/useAILayerMenu';
import { Header, HeaderProps } from './Header';
import { Sidebar, SidebarItem } from './Sidebar';
import { AILayerMenu } from './AILayerMenu';
import type { ExecutionAuditRun } from './ExecutionAuditPanel';
import type { ChatOpsIndustryTerms } from './ChatOpsPanel';
import { maskPII } from '@core/pii-utils';

export interface AppLayoutProps {
  header?: HeaderProps;
  sidebar?: {
    items: SidebarItem[];
    currentPath?: string;
    onItemClick?: (item: SidebarItem) => void;
  };
  children: React.ReactNode;
  className?: string;
  chatOpsIndustryTerms?: ChatOpsIndustryTerms; // 업종별 용어 (선택사항)
  onChatOpsSendMessage?: (message: string) => void | Promise<void>;
  onChatOpsReset?: () => void;
  onExecutionAuditRowClick?: (run: ExecutionAuditRun) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  header,
  sidebar,
  children,
  className,
  chatOpsIndustryTerms,
  onChatOpsSendMessage,
  onChatOpsReset,
  onExecutionAuditRowClick,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const isDesktop = mode === 'lg' || mode === 'xl';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, setSidebarCollapsed] = useState(isTablet); // 태블릿 모드에서는 자동으로 축소

  // AI 레이어 메뉴 상태 (전역)
  const aiLayerMenu = useAILayerMenu();

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

      {/* AI 레이어 메뉴 (전역, 모든 페이지에서 사용 가능) */}
      {/* ⚠️ 중요: 학생관리 페이지에서는 기존 레이어 메뉴와 공존하도록 z-index 조정 필요 */}
      <AILayerMenu
        isOpen={aiLayerMenu.isOpen}
        onClose={aiLayerMenu.close}
        width={isTablet ? 'var(--width-layer-menu-tablet)' : 'var(--width-layer-menu)'}
        style={{
          // 학생관리 페이지의 레이어 메뉴보다 낮은 z-index (항상 열려있음)
          zIndex: 'var(--z-sticky)',
        }}
        chatOpsMessages={aiLayerMenu.chatOpsMessages}
        chatOpsLoading={aiLayerMenu.chatOpsLoading}
        chatOpsIndustryTerms={chatOpsIndustryTerms}
        onChatOpsSendMessage={onChatOpsSendMessage || ((message) => {
          // ChatOps API 호출 (챗봇.md 참조)
          // 상위 컴포넌트(App.tsx)에서 useChatOps Hook을 사용하여 처리
          // AppLayout은 prop으로 받은 핸들러를 호출
          // ⚠️ 참고: 실제 API 호출은 App.tsx의 handleChatOpsSendMessage에서 처리됨
          // P0: PII 마스킹 필수 (체크리스트.md 4. PII 마스킹)
          const maskedMessage = maskPII(message);
          console.warn('[AppLayout] onChatOpsSendMessage handler not provided:', maskedMessage);
        })}
        onChatOpsViewTaskCard={(taskId: string) => {
          // 업종별 라우팅 처리 (학원: /students/tasks, 다른 업종: 업종별 경로)
          // TODO: 업종별 라우팅 로직 구현 (industryAdapter 사용 권장)
          // P0: 네비게이션 보안 - window.location.href 직접 사용 시 최소한의 경로 검증 수행
          const targetPath = `/students/tasks?task_id=${taskId}`;
          // 최소한의 경로 검증: 내부 경로만 허용 (오픈 리다이렉트 방지)
          if (targetPath.startsWith('/') && !targetPath.includes('://') && !targetPath.includes('javascript:') && !targetPath.includes('data:')) {
            window.location.href = targetPath;
          }
          // 외부 URL 또는 잘못된 형식은 무시 (Fail Closed)
        }}
        onChatOpsReset={onChatOpsReset}
        executionAuditRuns={aiLayerMenu.executionAuditRuns}
        executionAuditLoading={aiLayerMenu.executionAuditLoading}
        executionAuditHasMore={aiLayerMenu.executionAuditHasMore}
        executionAuditNextCursor={aiLayerMenu.executionAuditNextCursor}
        executionAuditStepsByRunId={aiLayerMenu.executionAuditStepsByRunId}
        executionAuditStepsLoading={aiLayerMenu.executionAuditStepsLoading}
        onExecutionAuditLoadMore={(cursor) => {
          // Execution Audit 추가 로드 (액티비티.md 10.1 참조)
          // cursor를 설정하면 상위 컴포넌트(App.tsx)의 useExecutionAuditRuns Hook이 자동으로 추가 데이터 로드
          aiLayerMenu.setExecutionAuditNextCursor(cursor);
        }}
        onExecutionAuditLoadSteps={(runId) => {
          // Execution Audit Steps 로드 (액티비티.md 10.2 참조)
          // 로딩 상태 설정: App.tsx의 useEffect에서 이 상태 변경을 감지하여 실제 API 호출 수행
          if (!aiLayerMenu.executionAuditStepsByRunId[runId] || aiLayerMenu.executionAuditStepsByRunId[runId].length === 0) {
            // Steps가 아직 로드되지 않은 경우에만 로딩 상태 설정
            aiLayerMenu.setExecutionAuditStepsLoading(runId, true);
          }
        }}
        onExecutionAuditViewRun={(runId) => {
          // Execution Audit Run 상세 조회 (액티비티.md 10.2 참조)
          // 상위 컴포넌트(App.tsx)에서 handleExecutionAuditViewRun을 구현하여 처리
          // P0: PII 마스킹 필수 (체크리스트.md 4. PII 마스킹)
          // runId는 UUID이므로 PII 아님, 하지만 일관성을 위해 maskPII 적용
          const maskedRunId = maskPII(runId);
          console.log('[AppLayout] Execution Audit view run requested:', maskedRunId);
          // ⚠️ 참고: 실제 Run 상세 조회는 App.tsx의 handleExecutionAuditViewRun에서 처리됨
        }}
        onExecutionAuditRowClick={onExecutionAuditRowClick}
        onExecutionAuditFilterChange={(filters) => {
          // Execution Audit 필터 변경 (액티비티.md 10.1 참조)
          // 필터 변경 시 cursor 초기화하여 첫 페이지부터 다시 로드
          aiLayerMenu.setExecutionAuditFilters(filters);
          aiLayerMenu.setExecutionAuditNextCursor(undefined);
          aiLayerMenu.setExecutionAuditRuns([]);
          // useExecutionAuditRuns Hook이 filters 변경을 감지하여 자동으로 데이터 로드
        }}
        executionAuditInitialFilters={aiLayerMenu.executionAuditFilters}
        executionAuditAvailableOperationTypes={aiLayerMenu.executionAuditAvailableOperationTypes}
      />
    </div>
  );
};

