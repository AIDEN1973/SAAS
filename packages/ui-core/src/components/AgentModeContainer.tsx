// LAYER: UI_CORE_COMPONENT
/**
 * AgentModeContainer Component
 *
 * 전체 화면 에이전트 모드 컨테이너
 * 좌측 히스토리 사이드바 + 우측 ChatOpsPanel 레이아웃
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다
 */

import React from 'react';
import { clsx } from 'clsx';
import { AgentHistorySidebar } from './AgentHistorySidebar';
import { AgentTimelineSidebar } from './AgentTimelineSidebar';
import { ChatOpsPanel, ChatOpsMessage, ChatOpsIndustryTerms } from './ChatOpsPanel';
import { ExecutionAuditRun } from './ExecutionAuditPanel';
import { useAILayerMenu } from '../hooks/useAILayerMenu';
import { useResponsiveMode } from '../hooks/useResponsiveMode';

export interface AgentModeContainerProps {
  chatOpsMessages: ChatOpsMessage[];
  chatOpsLoading?: boolean;
  chatOpsIndustryTerms?: ChatOpsIndustryTerms;
  onChatOpsSendMessage?: (message: string) => void | Promise<void>;
  onChatOpsSelectCandidate?: (candidateId: string, tokenId?: string) => void;
  onChatOpsApprovePlan?: (taskId: string) => void;
  onChatOpsRequestApproval?: (taskId: string) => void;
  onChatOpsViewActivity?: (runId?: string, requestId?: string) => void;
  onChatOpsViewTaskCard?: (taskId: string) => void;
  onChatOpsReset?: () => void;
  userName?: string;
  userEmail?: string;
  timelineItems?: ExecutionAuditRun[];
  className?: string;
}

/**
 * AgentModeContainer 컴포넌트
 *
 * 전체 화면 에이전트 모드 레이아웃
 * - 좌측: 히스토리 사이드바 (세션 목록)
 * - 우측: ChatOpsPanel (현재 대화)
 */
export const AgentModeContainer: React.FC<AgentModeContainerProps> = ({
  chatOpsMessages,
  chatOpsLoading = false,
  chatOpsIndustryTerms,
  onChatOpsSendMessage,
  onChatOpsSelectCandidate,
  onChatOpsApprovePlan,
  onChatOpsRequestApproval,
  onChatOpsViewActivity,
  onChatOpsViewTaskCard,
  onChatOpsReset,
  userName,
  userEmail,
  timelineItems = [],
  className,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const aiLayerMenu = useAILayerMenu();

  return (
    <div
      className={clsx(className)}
      style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        backgroundColor: 'var(--color-background)',
      }}
    >
      {/* 좌측 히스토리 사이드바 */}
      <AgentHistorySidebar
        sessions={aiLayerMenu.sessions}
        currentSessionId={aiLayerMenu.currentSessionId}
        onNewSession={aiLayerMenu.createNewSession}
        onSelectSession={aiLayerMenu.switchSession}
        onDeleteSession={aiLayerMenu.deleteSession}
        sessionsLoading={aiLayerMenu.sessionsLoading}
      />

      {/* 중앙 채팅 영역 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--color-body)',
        }}
      >
        {/* ChatOpsPanel을 중앙 정렬하고 최대 너비 제한 */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: 'var(--width-full)',
              maxWidth: 'var(--width-full)', // ChatOpsPanel 내부에서 콘텐츠 너비 제한
              display: 'flex',
              flexDirection: 'column',
            }}
          >
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
              userName={userName}
              userEmail={userEmail}
            />
          </div>
        </div>
      </div>

      {/* 우측 타임라인 사이드바 */}
      <AgentTimelineSidebar items={timelineItems} />
    </div>
  );
};
