// LAYER: UI_CORE_COMPONENT
/**
 * AILayerMenu Component
 *
 * 전역 AI 우측 레이어 메뉴 (ChatOps 전용)
 * [SSOT 준수] 챗봇.md 문서 기준 엄격히 준수
 * [불변 규칙] 학생관리 페이지와 동일한 크기와 로직으로 구현
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다
 * [업종 중립] 모든 업종(Academy/Salon/Nail 등)에서 공통으로 사용 가능합니다 (AI_자동화_기능_정리.md 145-158줄 참조)
 * [업종 중립] 업종별 차이는 prop을 통한 확장 포인트(`onChatOpsViewTaskCard` 등)로 처리됩니다
 *
 * [변경사항] 액티비티 탭 제거됨 - 액티비티 타임라인은 TimelineModal로 이동
 *
 * 참고 문서:
 * - SSOT: docu/챗봇.md (AI 대화형 기능 제어 시스템 기술문서)
 * - SSOT: docu/AI_자동화_기능_정리.md (Automation & AI Industry-Neutral Rule)
 */

import React from 'react';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { RightLayerMenu } from './RightLayerMenu';
import { ChatOpsPanel, ChatOpsMessage, ChatOpsIndustryTerms } from './ChatOpsPanel';
import { ExecutionAuditRun, ExecutionAuditStep, ExecutionAuditFilters } from './ExecutionAuditPanel';

export type AILayerMenuTab = 'chatops';

export interface AILayerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  width?: string;
  className?: string;
  style?: React.CSSProperties;

  // ChatOps Props
  chatOpsMessages?: ChatOpsMessage[];
  chatOpsLoading?: boolean;
  chatOpsIndustryTerms?: ChatOpsIndustryTerms; // 업종별 용어 (선택사항, 기본값: Academy 용어)
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
 * ChatOps (AI 챗봇) 전용 패널
 *
 * [변경사항] 액티비티 탭 제거 - 액티비티 타임라인은 별도 모달(TimelineModal)로 제공됩니다
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
  chatOpsIndustryTerms,
  onChatOpsSendMessage,
  onChatOpsSelectCandidate,
  onChatOpsApprovePlan,
  onChatOpsRequestApproval,
  onChatOpsViewActivity,
  onChatOpsViewTaskCard,
  onChatOpsReset,

  // Execution Audit Props (하위 호환성을 위해 유지, 미사용)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  executionAuditRuns = [],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  executionAuditLoading = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  executionAuditHasMore = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  executionAuditNextCursor,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  executionAuditStepsByRunId = {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  executionAuditStepsLoading = {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onExecutionAuditLoadMore,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onExecutionAuditLoadSteps,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onExecutionAuditViewRun,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onExecutionAuditRowClick,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onExecutionAuditFilterChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  executionAuditInitialFilters,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  executionAuditAvailableOperationTypes = [],
}) => {
  const mode = useResponsiveMode();
  const isTablet = mode === 'md';

  // 기본 너비 (학생관리와 동일)
  const defaultWidth = isTablet ? 'var(--width-layer-menu-tablet)' : 'var(--width-layer-menu)';

  return (
    <RightLayerMenu
      isOpen={isOpen}
      onClose={onClose}
      title="AI 챗봇"
      width={width || defaultWidth}
      className={className}
      style={style}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--height-full)' }}>
        {/* AI 챗봇 패널 (탭 제거) */}
        <div className="ui-core-hiddenScrollbar" style={{ flex: 1, overflowY: 'auto' }}>
          <ChatOpsPanel
            messages={chatOpsMessages}
            isLoading={chatOpsLoading}
            industryTerms={chatOpsIndustryTerms}
            onSendMessage={onChatOpsSendMessage || (async () => {})}
            onSelectCandidate={onChatOpsSelectCandidate}
            onApprovePlan={onChatOpsApprovePlan}
            onRequestApproval={onChatOpsRequestApproval}
            onViewActivity={onChatOpsViewActivity}
            onViewTaskCard={onChatOpsViewTaskCard}
            onReset={onChatOpsReset}
          />
        </div>
      </div>
    </RightLayerMenu>
  );
};

