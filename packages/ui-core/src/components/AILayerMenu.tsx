// LAYER: UI_CORE_COMPONENT
/**
 * AILayerMenu Component
 *
 * 전역 AI 우측 레이어 메뉴 (ChatOps + Execution Audit)
 * [SSOT 준수] 챗봇.md, 액티비티.md 문서 기준 엄격히 준수
 * [불변 규칙] 학생관리 페이지와 동일한 크기와 로직으로 구현
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다
 * [업종 중립] 모든 업종(Academy/Salon/Nail 등)에서 공통으로 사용 가능합니다 (AI_자동화_기능_정리.md 145-158줄 참조)
 * [업종 중립] 업종별 차이는 prop을 통한 확장 포인트(`onChatOpsViewTaskCard` 등)로 처리됩니다
 *
 * 참고 문서:
 * - SSOT: docu/챗봇.md (AI 대화형 기능 제어 시스템 기술문서)
 * - SSOT: docu/액티비티.md (Execution Audit 시스템)
 * - SSOT: docu/AI_자동화_기능_정리.md (Automation & AI Industry-Neutral Rule)
 */

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { RightLayerMenu, RightLayerMenuProps } from './RightLayerMenu';
import { Button } from './Button';
import { ChatOpsPanel, ChatOpsMessage } from './ChatOpsPanel';
import { ExecutionAuditPanel, ExecutionAuditRun, ExecutionAuditStep, ExecutionAuditFilters } from './ExecutionAuditPanel';

export type AILayerMenuTab = 'activity' | 'chatops';

export interface AILayerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  width?: string;
  className?: string;
  style?: React.CSSProperties;

  // ChatOps Props
  chatOpsMessages?: ChatOpsMessage[];
  chatOpsLoading?: boolean;
  onChatOpsSendMessage?: (message: string) => void | Promise<void>;
  onChatOpsSelectCandidate?: (candidateId: string, tokenId?: string) => void;
  onChatOpsApprovePlan?: (taskId: string) => void;
  onChatOpsRequestApproval?: (taskId: string) => void;
  onChatOpsViewActivity?: (runId?: string, requestId?: string) => void;
  onChatOpsViewTaskCard?: (taskId: string) => void; // 업종 중립: TaskCard 라우팅
  onChatOpsReset?: () => void; // 대화 초기화 콜백

  // Execution Audit Props
  executionAuditRuns?: ExecutionAuditRun[];
  executionAuditLoading?: boolean;
  executionAuditHasMore?: boolean;
  executionAuditNextCursor?: string;
  executionAuditStepsByRunId?: Record<string, ExecutionAuditStep[]>;
  executionAuditStepsLoading?: Record<string, boolean>;
  onExecutionAuditLoadMore?: (cursor?: string) => void;
  onExecutionAuditLoadSteps?: (runId: string, cursor?: string) => void;
  onExecutionAuditViewRun?: (runId: string) => void;
  onExecutionAuditRowClick?: (run: ExecutionAuditRun) => void; // 행 클릭 핸들러
  onExecutionAuditFilterChange?: (filters: ExecutionAuditFilters) => void;
  executionAuditInitialFilters?: ExecutionAuditFilters;
  executionAuditAvailableOperationTypes?: string[];
}

/**
 * AILayerMenu 컴포넌트
 *
 * 전역 AI 우측 레이어 메뉴
 * 상단: Execution Audit (액티비티)
 * 하단: ChatOps (AI 챗봇)
 */
export const AILayerMenu: React.FC<AILayerMenuProps> = ({
  isOpen,
  onClose,
  width,
  className,
  style,

  // ChatOps Props
  chatOpsMessages = [],
  chatOpsLoading = false,
  onChatOpsSendMessage,
  onChatOpsSelectCandidate,
  onChatOpsApprovePlan,
  onChatOpsRequestApproval,
  onChatOpsViewActivity,
  onChatOpsViewTaskCard,
  onChatOpsReset,

  // Execution Audit Props
  executionAuditRuns = [],
  executionAuditLoading = false,
  executionAuditHasMore = false,
  executionAuditNextCursor,
  executionAuditStepsByRunId = {},
  executionAuditStepsLoading = {},
  onExecutionAuditLoadMore,
  onExecutionAuditLoadSteps,
  onExecutionAuditViewRun,
  onExecutionAuditRowClick,
  onExecutionAuditFilterChange,
  executionAuditInitialFilters,
  executionAuditAvailableOperationTypes = [],
}) => {
  const mode = useResponsiveMode();
  const isTablet = mode === 'md';
  const [activeTab, setActiveTab] = useState<AILayerMenuTab>('activity');

  // 기본 너비 (학생관리와 동일)
  const defaultWidth = isTablet ? 'var(--width-layer-menu-tablet)' : 'var(--width-layer-menu)';

  return (
    <RightLayerMenu
      isOpen={isOpen}
      onClose={onClose}
      title="AI 대화창"
      width={width || defaultWidth}
      className={className}
      style={style}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--height-full)' }}>
        {/* 탭 버튼 (학생관리와 동일한 스타일) */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--spacing-sm)',
            marginBottom: 'var(--spacing-lg)',
            flexWrap: 'wrap',
            borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
            paddingBottom: 'var(--spacing-lg)',
          }}
        >
          <Button
            variant={activeTab === 'activity' ? 'solid' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('activity')}
          >
            액티비티
          </Button>
          <Button
            variant={activeTab === 'chatops' ? 'solid' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('chatops')}
          >
            AI 챗봇
          </Button>
        </div>

        {/* 탭 내용 */}
        <div className="ui-core-hiddenScrollbar" style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'activity' && (
            <ExecutionAuditPanel
              runs={executionAuditRuns}
              isLoading={executionAuditLoading}
              hasMore={executionAuditHasMore}
              nextCursor={executionAuditNextCursor}
              stepsByRunId={executionAuditStepsByRunId}
              stepsLoading={executionAuditStepsLoading}
              onLoadMore={onExecutionAuditLoadMore}
              onLoadSteps={onExecutionAuditLoadSteps}
              onViewRun={onExecutionAuditViewRun}
              onRowClick={onExecutionAuditRowClick}
              onFilterChange={onExecutionAuditFilterChange}
              initialFilters={executionAuditInitialFilters}
              availableOperationTypes={executionAuditAvailableOperationTypes}
            />
          )}

          {activeTab === 'chatops' && (
            <ChatOpsPanel
              messages={chatOpsMessages}
              isLoading={chatOpsLoading}
              onSendMessage={onChatOpsSendMessage || (async () => {})}
              onSelectCandidate={onChatOpsSelectCandidate}
              onApprovePlan={onChatOpsApprovePlan}
              onRequestApproval={onChatOpsRequestApproval}
              onViewActivity={onChatOpsViewActivity}
              onViewTaskCard={onChatOpsViewTaskCard}
              onReset={onChatOpsReset}
            />
          )}
        </div>
      </div>
    </RightLayerMenu>
  );
};

