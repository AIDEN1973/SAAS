// LAYER: SHARED_HOOK
/**
 * useAILayerMenu Hook
 *
 * 전역 AI 레이어 메뉴 상태 관리 Hook
 * [SSOT 준수] 챗봇.md, 액티비티.md 문서 기준 엄격히 준수
 * [불변 규칙] 모든 페이지에서 사용 가능한 전역 상태
 * [서버 우선] 세션은 서버(chatops_sessions)에서 로드, localStorage는 폴백
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
  getChatOpsSessions as getLocalSessions,
  deleteChatOpsSession as deleteLocalSession,
  switchChatOpsSession as switchLocalSession,
  createNewChatOpsSession as createLocalSession,
  updateCurrentSessionInHistory,
  cleanupExpiredSessions,
} from '../utils/chatops-session';
import type { ChatOpsSession } from '../utils/chatops-session';

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

  // 세션 히스토리 상태
  sessions: ChatOpsSession[];
  sessionsLoading: boolean;
  currentSessionId: string;
  switchSession: (sessionId: string) => void;
  createNewSession: () => void;
  deleteSession: (sessionId: string) => void;
  refreshSessions: () => void;

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

// 서버 API 함수들 (동적 import로 순환 참조 방지)
async function fetchServerSessions(): Promise<ChatOpsSession[]> {
  try {
    const { fetchChatOpsSessions } = await import('@hooks/use-chatops');
    const serverSessions = await fetchChatOpsSessions(50);

    // [DEBUG] 서버에서 받은 원본 세션 데이터 로깅
    console.log('[useAILayerMenu] 서버 세션 원본 데이터:', {
      count: serverSessions.length,
      sessions: serverSessions.map(s => ({
        id: s.id,
        summary: s.summary,
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
    });

    // 서버 세션을 ChatOpsSession 형식으로 변환
    // ID 기준으로 중복 제거 (Set 사용)
    const seenIds = new Set<string>();
    const uniqueSessions: ChatOpsSession[] = [];

    for (const s of serverSessions) {
      if (!seenIds.has(s.id)) {
        seenIds.add(s.id);
        uniqueSessions.push({
          id: s.id,
          title: s.summary || '새 대화',
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          messageCount: 0, // 서버에서는 메시지 수를 별도로 조회해야 함
        });
      } else {
        // [DEBUG] 중복 세션 발견 시 로깅
        console.warn('[useAILayerMenu] 중복 세션 ID 발견:', s.id);
      }
    }

    // [DEBUG] 변환 후 세션 데이터 로깅
    console.log('[useAILayerMenu] 변환된 세션 데이터:', {
      count: uniqueSessions.length,
      sessions: uniqueSessions.map(s => ({
        id: s.id,
        title: s.title,
      })),
    });

    return uniqueSessions;
  } catch (error) {
    console.warn('[useAILayerMenu] Failed to fetch server sessions, using local:', error);
    return [];
  }
}

async function fetchServerMessages(sessionId: string): Promise<ChatOpsMessage[]> {
  try {
    const { fetchChatOpsMessages } = await import('@hooks/use-chatops');
    const serverMessages = await fetchChatOpsMessages(sessionId, 100);

    // 서버 메시지를 ChatOpsMessage 형식으로 변환
    // null → undefined 변환 (ChatOpsMessage 타입 호환)
    return serverMessages.map(m => ({
      id: `server-${m.id}`,
      type: m.role === 'user' ? 'user_message' as const : 'assistant_message' as const,
      content: m.content,
      timestamp: new Date(m.created_at),
      metadata: {
        intent_key: m.intent_key ?? undefined,
        automation_level: m.automation_level ?? undefined,
        execution_class: m.execution_class ?? undefined,
      },
    }));
  } catch (error) {
    console.warn('[useAILayerMenu] Failed to fetch server messages:', error);
    return [];
  }
}

async function deleteServerSession(sessionId: string): Promise<boolean> {
  try {
    const { deleteChatOpsServerSession } = await import('@hooks/use-chatops');
    await deleteChatOpsServerSession(sessionId);
    return true;
  } catch (error) {
    console.warn('[useAILayerMenu] Failed to delete server session:', error);
    return false;
  }
}

// tenantId 조회 함수
async function getTenantId(): Promise<string | undefined> {
  try {
    const { getApiContext } = await import('@api-sdk/core');
    return getApiContext()?.tenantId;
  } catch {
    return undefined;
  }
}

/**
 * AILayerMenu Provider 컴포넌트
 *
 * 앱 최상위에 배치하여 전역 AI 레이어 메뉴 상태 관리
 * 서버 우선 + localStorage 폴백 방식
 */
export function AILayerMenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AILayerMenuTab>('chatops');

  // ChatOps session_id 관리
  const sessionIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const isLoadingServerRef = useRef(false);
  const hasLoadedFromServerRef = useRef(false); // 서버에서 로드 완료 여부

  // 세션 히스토리 상태
  const [sessions, setSessions] = useState<ChatOpsSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return getOrCreateChatOpsSessionId();
  });

  // ChatOps 상태
  const [chatOpsMessages, setChatOpsMessages] = useState<ChatOpsMessage[]>([]);
  const [chatOpsLoading, setChatOpsLoading] = useState(false);

  // 서버에서 세션 목록 로드
  // force: true면 이전 로드가 진행 중이어도 무시하고 재로드
  const loadServerSessions = useCallback(async (force: boolean = false) => {
    // [DEBUG] 로드 시작 로깅
    console.log('[useAILayerMenu] loadServerSessions 호출:', {
      force,
      isLoadingServerRef: isLoadingServerRef.current,
      hasLoadedFromServerRef: hasLoadedFromServerRef.current,
    });

    // 이미 로딩 중이면 스킵 (단, force=true면 무시)
    if (isLoadingServerRef.current && !force) {
      console.log('[useAILayerMenu] 이미 로딩 중이므로 스킵');
      return;
    }

    setSessionsLoading(true);
    isLoadingServerRef.current = true;

    // [보존 정책] 먼저 로컬의 30일 지난 세션 정리
    cleanupExpiredSessions();

    try {
      // tenantId가 있는지 확인
      const tenantId = await getTenantId();
      console.log('[useAILayerMenu] tenantId 확인:', tenantId ? '있음' : '없음');

      if (tenantId) {
        // tenantId가 있으면 서버에서 로드
        const serverSessions = await fetchServerSessions();

        // [DEBUG] 서버 세션을 상태에 설정하기 전 로깅
        console.log('[useAILayerMenu] setSessions 호출 전:', {
          serverSessionsCount: serverSessions.length,
          serverSessionIds: serverSessions.map(s => s.id),
        });

        // 서버 세션만 사용 (로컬 세션은 폴백으로만)
        // 서버 세션이 없으면 빈 배열 (새 대화만 가능한 상태)
        setSessions(serverSessions);
        hasLoadedFromServerRef.current = true;
      } else {
        // tenantId가 없으면 로컬만 사용 (로그인 전)
        const localSessions = getLocalSessions();
        console.log('[useAILayerMenu] 로컬 세션 사용:', {
          count: localSessions.length,
          sessions: localSessions.map(s => ({ id: s.id, title: s.title })),
        });
        setSessions(localSessions);
      }
    } catch (error) {
      console.error('[useAILayerMenu] Failed to load sessions:', error);
      // 에러 시 로컬 폴백
      const localSessions = getLocalSessions();
      setSessions(localSessions);
    } finally {
      setSessionsLoading(false);
      isLoadingServerRef.current = false;
    }
  }, []);

  // 세션의 메시지 로드 (서버 우선)
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    try {
      // 서버에서 먼저 시도
      const serverMessages = await fetchServerMessages(sessionId);

      if (serverMessages.length > 0) {
        setChatOpsMessages(serverMessages);
        // 로컬 캐시에도 저장
        saveChatOpsMessagesToCache(sessionId, serverMessages);
      } else {
        // 서버에 없으면 로컬 캐시에서 로드
        const localMessages = loadChatOpsMessagesFromCache(sessionId);
        setChatOpsMessages(localMessages || []);
      }
    } catch (error) {
      console.warn('[useAILayerMenu] Server load failed, using local cache:', error);
      // 에러 시 로컬 캐시 사용
      const localMessages = loadChatOpsMessagesFromCache(sessionId);
      setChatOpsMessages(localMessages || []);
    }
  }, []);

  // 초기화: session_id 설정 및 로컬 캐시에서 메시지 로드
  // 서버 세션 로드는 open() 시점으로 미룸 (tenantId 타이밍 이슈 방지)
  useEffect(() => {
    if (isInitializedRef.current) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const initialize = () => {
      try {
        const sessionId = getOrCreateChatOpsSessionId();
        sessionIdRef.current = sessionId;
        setCurrentSessionId(sessionId);

        // 로컬 캐시에서 빠르게 로드 (서버 로드는 open() 시점에)
        const cached = loadChatOpsMessagesFromCache(sessionId);
        setChatOpsMessages(cached || []);

        // 로컬 세션 목록도 빠르게 로드
        const localSessions = getLocalSessions();
        setSessions(localSessions);

        console.log('[useAILayerMenu] 초기화 완료 (로컬 캐시):', {
          sessionId,
          messageCount: cached?.length || 0,
          sessionCount: localSessions.length,
        });

        isInitializedRef.current = true;
      } catch (error) {
        console.error('[useAILayerMenu] Failed to initialize:', error);

        // 에러 시 로컬 폴백
        const sessionId = getOrCreateChatOpsSessionId();
        sessionIdRef.current = sessionId;
        const cached = loadChatOpsMessagesFromCache(sessionId);
        setChatOpsMessages(cached || []);
        setSessions(getLocalSessions());

        isInitializedRef.current = true;
      }
    };

    initialize();
  }, []); // 마운트 시 1회만 실행

  // 메시지 변경 시 localStorage에 저장 (로컬 캐시 역할)
  // 서버 저장은 chatops Edge Function에서 처리
  useEffect(() => {
    if (!isInitializedRef.current || !sessionIdRef.current) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    try {
      // 로컬 캐시에 저장 (빠른 복원용)
      saveChatOpsMessagesToCache(sessionIdRef.current, chatOpsMessages);

      // 메시지가 있으면 로컬 히스토리에도 업데이트
      if (chatOpsMessages.length > 0) {
        updateCurrentSessionInHistory(chatOpsMessages);
      }
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

  const open = useCallback(async () => {
    console.log('[useAILayerMenu] open() 호출');
    setActiveTab('chatops');
    setIsOpen(true);

    // 항상 서버에서 최신 세션 목록을 다시 로드
    // (tenantId가 초기화 타이밍 이슈로 최초 로드 시 없었을 수 있음)
    const tenantId = await getTenantId();
    console.log('[useAILayerMenu] open() - tenantId:', tenantId ? '있음' : '없음');
    if (tenantId) {
      // force=true로 호출하여 이전 로드가 진행 중이어도 재로드
      await loadServerSessions(true);
      if (sessionIdRef.current) {
        await loadSessionMessages(sessionIdRef.current);
      }
    }
  }, [loadServerSessions, loadSessionMessages]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(async () => {
    const willOpen = !isOpen;
    setIsOpen(willOpen);

    if (willOpen) {
      setActiveTab('chatops');

      // 항상 서버에서 최신 세션 목록을 다시 로드
      // (tenantId가 초기화 타이밍 이슈로 최초 로드 시 없었을 수 있음)
      const tenantId = await getTenantId();
      if (tenantId) {
        // force=true로 호출하여 이전 로드가 진행 중이어도 재로드
        await loadServerSessions(true);
        if (sessionIdRef.current) {
          await loadSessionMessages(sessionIdRef.current);
        }
      }
    }
  }, [isOpen, loadServerSessions, loadSessionMessages]);

  const addChatOpsMessage = useCallback((message: ChatOpsMessage) => {
    console.log('[useAILayerMenu] addChatOpsMessage:', {
      messageId: message.id,
      messageType: message.type,
      contentPreview: typeof message.content === 'string' ? message.content.substring(0, 50) : '[ReactNode]',
    });
    setChatOpsMessages((prev) => [...prev, message]);
  }, []);

  const updateChatOpsMessage = useCallback((messageId: string, updates: Partial<ChatOpsMessage>) => {
    setChatOpsMessages((prev) => {
      const found = prev.find((msg) => msg.id === messageId);
      console.log('[useAILayerMenu] updateChatOpsMessage:', {
        messageId,
        found: !!found,
        totalMessages: prev.length,
        contentPreview: updates.content && typeof updates.content === 'string' ? updates.content.substring(0, 50) : undefined,
      });
      return prev.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg));
    });
  }, []);

  const clearChatOpsMessages = useCallback(() => {
    // 현재 세션의 메시지가 있으면 히스토리에 먼저 저장
    if (typeof window !== 'undefined' && chatOpsMessages.length > 0 && sessionIdRef.current) {
      try {
        updateCurrentSessionInHistory(chatOpsMessages);
      } catch (error) {
        console.error('[useAILayerMenu] Failed to save session to history before clearing:', error);
      }
    }

    // 메시지 초기화
    setChatOpsMessages([]);

    // session_id도 초기화 (새 대화 시작)
    if (typeof window !== 'undefined') {
      try {
        const newSessionId = resetChatOpsSessionId();
        sessionIdRef.current = newSessionId;
        setCurrentSessionId(newSessionId);

        // 세션 목록 새로고침 (서버에서)
        void loadServerSessions();
      } catch (error) {
        console.error('[useAILayerMenu] Failed to reset session:', error);
      }
    }
  }, [chatOpsMessages, loadServerSessions]);

  // 세션 히스토리 관리 함수들
  const refreshSessions = useCallback(() => {
    void loadServerSessions();
  }, [loadServerSessions]);

  const switchSessionHandler = useCallback(async (sessionId: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // 현재 세션의 메시지를 히스토리에 저장
      if (sessionIdRef.current && chatOpsMessages.length > 0) {
        updateCurrentSessionInHistory(chatOpsMessages);
      }

      // 세션 전환 (로컬)
      switchLocalSession(sessionId);
      sessionIdRef.current = sessionId;
      setCurrentSessionId(sessionId);

      // 새 세션의 메시지 로드 (서버 우선)
      await loadSessionMessages(sessionId);

      // 세션 목록 새로고침
      void loadServerSessions();
    } catch (error) {
      console.error('[useAILayerMenu] Failed to switch session:', error);
    }
  }, [chatOpsMessages, loadSessionMessages, loadServerSessions]);

  const createNewSessionHandler = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // 새 세션 생성 (로컬)
      const newSessionId = createLocalSession();
      sessionIdRef.current = newSessionId;
      setCurrentSessionId(newSessionId);

      // 메시지 초기화
      setChatOpsMessages([]);

      // 세션 목록 새로고침
      void loadServerSessions();
    } catch (error) {
      console.error('[useAILayerMenu] Failed to create new session:', error);
    }
  }, [loadServerSessions]);

  const deleteSessionHandler = useCallback(async (sessionId: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // 서버에서 삭제 시도
      await deleteServerSession(sessionId);

      // 로컬에서도 삭제
      deleteLocalSession(sessionId);

      // 삭제된 세션이 현재 세션이면 새 세션으로 전환
      if (sessionIdRef.current === sessionId) {
        const newSessionId = getOrCreateChatOpsSessionId();
        sessionIdRef.current = newSessionId;
        setCurrentSessionId(newSessionId);

        // 새 세션의 메시지 로드
        await loadSessionMessages(newSessionId);
      }

      // 세션 목록 새로고침
      void loadServerSessions();
    } catch (error) {
      console.error('[useAILayerMenu] Failed to delete session:', error);
    }
  }, [loadSessionMessages, loadServerSessions]);

  const addExecutionAuditRun = useCallback((run: ExecutionAuditRun) => {
    setExecutionAuditRuns((prev) => {
      // 중복 ID 체크: 이미 존재하는 run은 추가하지 않음
      if (prev.some(existingRun => existingRun.id === run.id)) {
        return prev;
      }
      return [run, ...prev];
    });
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
        sessions,
        sessionsLoading,
        currentSessionId,
        switchSession: switchSessionHandler,
        createNewSession: createNewSessionHandler,
        deleteSession: deleteSessionHandler,
        refreshSessions,
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
