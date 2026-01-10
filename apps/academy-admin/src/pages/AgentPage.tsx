// LAYER: PAGE
/**
 * AgentPage Component
 *
 * 에이전트 모드 전용 페이지
 * /agent 라우트로 접근 가능
 * 새로고침해도 에이전트 모드가 유지됨
 */

import React, { useEffect } from 'react';
import { useAILayerMenu, AgentModeContainer } from '@ui-core/react';
import type { ChatOpsIndustryTerms } from '@ui-core/react';
import { maskPII } from '@core/pii-utils';

interface AgentPageProps {
  chatOpsIndustryTerms?: ChatOpsIndustryTerms;
  onChatOpsSendMessage?: (message: string) => void | Promise<void>;
  onChatOpsReset?: () => void;
  userName?: string;
  userEmail?: string;
}

export const AgentPage: React.FC<AgentPageProps> = ({
  chatOpsIndustryTerms,
  onChatOpsSendMessage,
  onChatOpsReset,
  userName,
  userEmail,
}) => {
  const aiLayerMenu = useAILayerMenu();

  // /agent 페이지 진입 시 에이전트 모드 활성화
  // App.tsx에서 이미 URL 기반으로 동기화하므로 여기서는 초기 렌더링 시에만 확인
  const isOpen = aiLayerMenu.isOpen;
  const open = aiLayerMenu.open;
  useEffect(() => {
    if (!isOpen) {
      open();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 마운트 시 1회만 실행 (App.tsx에서 isAgentPath 변경 시 처리)

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        backgroundColor: 'var(--color-background)',
      }}
    >
      <AgentModeContainer
        chatOpsMessages={aiLayerMenu.chatOpsMessages}
        chatOpsLoading={aiLayerMenu.chatOpsLoading}
        chatOpsIndustryTerms={chatOpsIndustryTerms}
        onChatOpsSendMessage={onChatOpsSendMessage || ((message) => {
          const maskedMessage = maskPII(message);
          console.warn('[AgentPage] onChatOpsSendMessage handler not provided:', maskedMessage);
        })}
        onChatOpsViewTaskCard={(taskId: string) => {
          const targetPath = `/students/tasks?task_id=${taskId}`;
          if (targetPath.startsWith('/') && !targetPath.includes('://') && !targetPath.includes('javascript:') && !targetPath.includes('data:')) {
            window.location.href = targetPath;
          }
        }}
        onChatOpsReset={onChatOpsReset}
        userName={userName}
        userEmail={userEmail}
        timelineItems={aiLayerMenu.executionAuditRuns}
      />
    </div>
  );
};
