// LAYER: SHARED_HOOK
/**
 * useAILayerMenu Hook
 *
 * 전역 AI 레이어 메뉴 상태 관리 Hook
 * [SSOT 준수] 챗봇.md, 액티비티.md 문서 기준 엄격히 준수
 * [불변 규칙] 모든 페이지에서 사용 가능한 전역 상태
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { ChatOpsMessage } from '../components/ChatOpsPanel';
import { ExecutionAuditRun, ExecutionAuditStep, ExecutionAuditFilters } from '../components/ExecutionAuditPanel';
import type { AILayerMenuTab } from '../components/AILayerMenu';
import {
  getOrCreateChatOpsSessionId,
  saveChatOpsMessagesToCache,
  loadChatOpsMessagesFromCache,
  resetChatOpsSessionId,
} from '../utils/chatops-session';

interface AILayerMenuContextType {
  isOpen: boolean;
  activeTab: AILayerMenuTab;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setActiveTab: (tab: AILayerMenuTab) => void;

  // ChatOps 상태
  chatOpsMessages: ChatOpsMessage[];
  addChatOpsMessage: (message: ChatOpsMessage) => void;
  updateChatOpsMessage: (messageId: string, updates: Partial<ChatOpsMessage>) => void;
  clearChatOpsMessages: () => void;
  chatOpsLoading: boolean;
  setChatOpsLoading: (loading: boolean) => void;

  // Execution Audit 상태
  executionAuditRuns: ExecutionAuditRun[];
  setExecutionAuditRuns: (runs: ExecutionAuditRun[]) => void;
  addExecutionAuditRun: (run: ExecutionAuditRun) => void;
  executionAuditLoading: boolean;
  setExecutionAuditLoading: (loading: boolean) => void;
  executionAuditHasMore: boolean;
  setExecutionAuditHasMore: (hasMore: boolean) => void;
  executionAuditNextCursor: string | undefined;
  setExecutionAuditNextCursor: (cursor: string | undefined) => void;
  executionAuditStepsByRunId: Record<string, ExecutionAuditStep[]>;
  setExecutionAuditSteps: (runId: string, steps: ExecutionAuditStep[]) => void;
  executionAuditStepsLoading: Record<string, boolean>;
  setExecutionAuditStepsLoading: (runId: string, loading: boolean) => void;
  executionAuditFilters: ExecutionAuditFilters;
  setExecutionAuditFilters: (filters: ExecutionAuditFilters) => void;
  executionAuditAvailableOperationTypes: string[];
  setExecutionAuditAvailableOperationTypes: (types: string[]) => void;
}

const AILayerMenuContext = createContext<AILayerMenuContextType | undefined>(undefined);

/**
 * AILayerMenu Provider 컴포넌트
 *
 * 앱 최상위에 배치하여 전역 AI 레이어 메뉴 상태 관리
 */
export function AILayerMenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AILayerMenuTab>('activity');

  // ChatOps session_id 관리
  const sessionIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);

  // ChatOps 상태
  // 초기값은 localStorage에서 로드 (새로고침 시 복원)
  const [chatOpsMessages, setChatOpsMessages] = useState<ChatOpsMessage[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const sessionId = getOrCreateChatOpsSessionId();
      sessionIdRef.current = sessionId;
      const cached = loadChatOpsMessagesFromCache(sessionId);
      return cached || [];
    } catch (error) {
      console.error('[useAILayerMenu] Failed to load cached messages:', error);
      return [];
    }
  });
  const [chatOpsLoading, setChatOpsLoading] = useState(false);

  // 초기화: session_id 설정 및 캐시 복원
  useEffect(() => {
    if (isInitializedRef.current) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    try {
      const sessionId = getOrCreateChatOpsSessionId();
      sessionIdRef.current = sessionId;

      // 캐시에서 메시지 복원
      const cached = loadChatOpsMessagesFromCache(sessionId);
      if (cached && cached.length > 0) {
        setChatOpsMessages(cached);
      }

      isInitializedRef.current = true;
    } catch (error) {
      console.error('[useAILayerMenu] Failed to initialize session:', error);
      isInitializedRef.current = true;
    }
  }, []);

  // 메시지 변경 시 localStorage에 저장
  useEffect(() => {
    if (!isInitializedRef.current || !sessionIdRef.current) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    try {
      saveChatOpsMessagesToCache(sessionIdRef.current, chatOpsMessages);
    } catch (error) {
      console.error('[useAILayerMenu] Failed to save messages to cache:', error);
    }
  }, [chatOpsMessages]);

  // Execution Audit 상태
  const [executionAuditRuns, setExecutionAuditRuns] = useState<ExecutionAuditRun[]>([]);
  const [executionAuditLoading, setExecutionAuditLoading] = useState(false);
  const [executionAuditHasMore, setExecutionAuditHasMore] = useState(false);
  const [executionAuditNextCursor, setExecutionAuditNextCursor] = useState<string | undefined>(undefined);
  const [executionAuditStepsByRunId, setExecutionAuditStepsByRunId] = useState<Record<string, ExecutionAuditStep[]>>({});
  const [executionAuditStepsLoading, setExecutionAuditStepsLoading] = useState<Record<string, boolean>>({});
  const [executionAuditFilters, setExecutionAuditFilters] = useState<ExecutionAuditFilters>({});
  const [executionAuditAvailableOperationTypes, setExecutionAuditAvailableOperationTypes] = useState<string[]>([]);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const addChatOpsMessage = useCallback((message: ChatOpsMessage) => {
    setChatOpsMessages((prev) => [...prev, message]);
  }, []);

  const updateChatOpsMessage = useCallback((messageId: string, updates: Partial<ChatOpsMessage>) => {
    setChatOpsMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg))
    );
  }, []);

  const clearChatOpsMessages = useCallback(() => {
    setChatOpsMessages([]);
    // session_id도 초기화 (새 대화 시작)
    if (typeof window !== 'undefined') {
      try {
        const newSessionId = resetChatOpsSessionId();
        sessionIdRef.current = newSessionId;
      } catch (error) {
        console.error('[useAILayerMenu] Failed to reset session:', error);
      }
    }
  }, []);

  const addExecutionAuditRun = useCallback((run: ExecutionAuditRun) => {
    setExecutionAuditRuns((prev) => [run, ...prev]);
  }, []);

  const setExecutionAuditSteps = useCallback((runId: string, steps: ExecutionAuditStep[]) => {
    setExecutionAuditStepsByRunId((prev) => ({
      ...prev,
      [runId]: steps,
    }));
  }, []);

  const setExecutionAuditStepsLoadingState = useCallback((runId: string, loading: boolean) => {
    setExecutionAuditStepsLoading((prev) => ({
      ...prev,
      [runId]: loading,
    }));
  }, []);

  return (
    <AILayerMenuContext.Provider
      value={{
        isOpen,
        activeTab,
        open,
        close,
        toggle,
        setActiveTab,
        chatOpsMessages,
        addChatOpsMessage,
        updateChatOpsMessage,
        clearChatOpsMessages,
        chatOpsLoading,
        setChatOpsLoading,
        executionAuditRuns,
        setExecutionAuditRuns,
        addExecutionAuditRun,
        executionAuditLoading,
        setExecutionAuditLoading,
        executionAuditHasMore,
        setExecutionAuditHasMore,
        executionAuditNextCursor,
        setExecutionAuditNextCursor,
        executionAuditStepsByRunId,
        setExecutionAuditSteps,
        executionAuditStepsLoading,
        setExecutionAuditStepsLoading: setExecutionAuditStepsLoadingState,
        executionAuditFilters,
        setExecutionAuditFilters,
        executionAuditAvailableOperationTypes,
        setExecutionAuditAvailableOperationTypes,
      }}
    >
      {children}
    </AILayerMenuContext.Provider>
  );
}

/**
 * useAILayerMenu Hook
 *
 * 전역 AI 레이어 메뉴 상태를 사용하는 Hook
 */
export function useAILayerMenu(): AILayerMenuContextType {
  const context = useContext(AILayerMenuContext);
  if (!context) {
    throw new Error('useAILayerMenu must be used within AILayerMenuProvider');
  }
  return context;
}

