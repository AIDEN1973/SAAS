// LAYER: UI_CORE_UTILITY
/**
 * ChatOps Session 유틸리티
 *
 * session_id 생성 및 localStorage 관리
 * [SSOT 준수] 챗봇.md 문서 기준 엄격히 준수
 * [불변 규칙] session_id는 crypto.randomUUID()로 생성
 * [불변 규칙] localStorage 키는 sessionId 기반으로만 구성 (tenantId/userId는 Zero-Trust 원칙상 프론트에서 직접 사용하지 않음)
 */

import type { ChatOpsMessage } from '../components/ChatOpsPanel';

/**
 * ChatOps 세션 정보 인터페이스
 */
export interface ChatOpsSession {
  id: string;
  title: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  messageCount: number;
}

const CHATOPS_SESSION_ID_KEY = 'chatops:session_id';
const CHATOPS_MESSAGES_KEY_PREFIX = 'chatops:messages:';
const CHATOPS_SESSIONS_LIST_KEY = 'chatops:sessions';

/**
 * 대화 보존 정책: 30일
 * [SSOT] 서버(141_chatops_retention_policy_30days.sql)와 동일한 정책
 */
const CHATOPS_RETENTION_DAYS = 30;

/**
 * session_id 생성 또는 기존 값 반환
 */
export function getOrCreateChatOpsSessionId(): string {
  if (typeof window === 'undefined') {
    // SSR 환경에서는 임시 UUID 생성 (실제로는 사용되지 않음)
    return crypto.randomUUID();
  }

  try {
    const existing = localStorage.getItem(CHATOPS_SESSION_ID_KEY);
    if (existing) {
      return existing;
    }

    // 새 session_id 생성
    const newSessionId = crypto.randomUUID();
    localStorage.setItem(CHATOPS_SESSION_ID_KEY, newSessionId);
    return newSessionId;
  } catch (error) {
    // localStorage 접근 실패 시 새 UUID 반환 (세션 유지 불가)
    console.error('[chatops-session] Failed to access localStorage:', error);
    return crypto.randomUUID();
  }
}

/**
 * session_id 초기화 (새 대화 시작)
 * ⚠️ 주의: 히스토리 기능이 있으므로 현재 세션의 메시지만 삭제하고, 다른 세션의 메시지는 보존
 */
export function resetChatOpsSessionId(): string {
  if (typeof window === 'undefined') {
    return crypto.randomUUID();
  }

  try {
    // 현재 세션 ID 가져오기
    const currentSessionId = localStorage.getItem(CHATOPS_SESSION_ID_KEY);

    // 현재 세션의 메시지만 삭제 (다른 세션의 히스토리는 보존)
    if (currentSessionId) {
      const currentMessagesKey = getMessagesStorageKey(currentSessionId);
      localStorage.removeItem(currentMessagesKey);
    }

    // 새 세션 ID 생성 및 저장
    const newSessionId = crypto.randomUUID();
    localStorage.setItem(CHATOPS_SESSION_ID_KEY, newSessionId);

    return newSessionId;
  } catch (error) {
    console.error('[chatops-session] Failed to reset session:', error);
    return crypto.randomUUID();
  }
}

/**
 * localStorage 키 생성 (sessionId 기반)
 * ⚠️ 주의: tenantId/userId는 Zero-Trust 원칙상 프론트에서 직접 사용하지 않음
 * 충돌 리스크: 같은 브라우저에서 여러 테넌트를 사용하는 경우 sessionId만으로는 구분 불가
 * 하지만 실제 사용 시나리오에서는 브라우저당 하나의 세션만 활성화되므로 충돌 가능성은 낮음
 */
function getMessagesStorageKey(sessionId: string): string {
  return `${CHATOPS_MESSAGES_KEY_PREFIX}${sessionId}`;
}

/**
 * ChatOps 메시지 캐시 저장
 */
export function saveChatOpsMessagesToCache(
  sessionId: string,
  messages: Array<{ id: string; type: string; content: string | unknown; timestamp: Date; metadata?: unknown }>
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const key = getMessagesStorageKey(sessionId);
    const serialized = JSON.stringify(messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp.toISOString(),
    })));
    localStorage.setItem(key, serialized);
  } catch (error) {
    console.error('[chatops-session] Failed to save messages to cache:', error);
  }
}

/**
 * ChatOps 메시지 캐시 로드
 */
export function loadChatOpsMessagesFromCache(sessionId: string): ChatOpsMessage[] | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const key = getMessagesStorageKey(sessionId);
    const cached = localStorage.getItem(key);
    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached);
    return parsed.map((msg: { timestamp: string; type: string }) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
      // type은 이미 ChatOpsMessageType이어야 하므로 그대로 사용
    })) as ChatOpsMessage[];
  } catch (error) {
    console.error('[chatops-session] Failed to load messages from cache:', error);
    return null;
  }
}

// ============================================
// 다중 세션 관리 함수들 (히스토리 기능)
// ============================================

/**
 * 모든 ChatOps 세션 목록 조회
 */
export function getChatOpsSessions(): ChatOpsSession[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const cached = localStorage.getItem(CHATOPS_SESSIONS_LIST_KEY);
    if (!cached) {
      return [];
    }

    return JSON.parse(cached) as ChatOpsSession[];
  } catch (error) {
    console.error('[chatops-session] Failed to load sessions list:', error);
    return [];
  }
}

/**
 * 세션 목록 저장
 */
function saveChatOpsSessions(sessions: ChatOpsSession[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(CHATOPS_SESSIONS_LIST_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('[chatops-session] Failed to save sessions list:', error);
  }
}

/**
 * 세션 저장 또는 업데이트
 */
export function saveChatOpsSession(session: ChatOpsSession): void {
  const sessions = getChatOpsSessions();
  const existingIndex = sessions.findIndex(s => s.id === session.id);

  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    // 새 세션은 맨 앞에 추가
    sessions.unshift(session);
  }

  saveChatOpsSessions(sessions);
}

/**
 * 세션 삭제
 */
export function deleteChatOpsSession(sessionId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // 세션 목록에서 제거
    const sessions = getChatOpsSessions();
    const filteredSessions = sessions.filter(s => s.id !== sessionId);
    saveChatOpsSessions(filteredSessions);

    // 해당 세션의 메시지 캐시도 삭제
    const messagesKey = getMessagesStorageKey(sessionId);
    localStorage.removeItem(messagesKey);

    // 현재 활성 세션이 삭제된 경우 처리
    const currentSessionId = localStorage.getItem(CHATOPS_SESSION_ID_KEY);
    if (currentSessionId === sessionId) {
      // 남은 세션이 있으면 첫 번째 세션으로 전환, 없으면 새 세션 생성
      if (filteredSessions.length > 0) {
        localStorage.setItem(CHATOPS_SESSION_ID_KEY, filteredSessions[0].id);
      } else {
        resetChatOpsSessionId();
      }
    }
  } catch (error) {
    console.error('[chatops-session] Failed to delete session:', error);
  }
}

/**
 * 세션 전환
 */
export function switchChatOpsSession(sessionId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(CHATOPS_SESSION_ID_KEY, sessionId);
  } catch (error) {
    console.error('[chatops-session] Failed to switch session:', error);
  }
}

/**
 * 새 세션 생성 (히스토리에 추가)
 * 현재 세션의 메시지가 있으면 히스토리에 저장하고 새 세션 시작
 */
export function createNewChatOpsSession(): string {
  if (typeof window === 'undefined') {
    return crypto.randomUUID();
  }

  try {
    // 현재 세션 정보 저장 (메시지가 있는 경우)
    const currentSessionId = localStorage.getItem(CHATOPS_SESSION_ID_KEY);
    if (currentSessionId) {
      const messages = loadChatOpsMessagesFromCache(currentSessionId);
      if (messages && messages.length > 0) {
        // 첫 번째 사용자 메시지를 제목으로 사용
        const firstUserMessage = messages.find(m => m.type === 'user_message');
        const title = firstUserMessage && typeof firstUserMessage.content === 'string'
          ? firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
          : '새 대화';

        const session: ChatOpsSession = {
          id: currentSessionId,
          title,
          createdAt: messages[0].timestamp.toISOString(),
          updatedAt: messages[messages.length - 1].timestamp.toISOString(),
          messageCount: messages.length,
        };
        saveChatOpsSession(session);
      }
    }

    // 새 세션 생성
    const newSessionId = crypto.randomUUID();
    localStorage.setItem(CHATOPS_SESSION_ID_KEY, newSessionId);

    return newSessionId;
  } catch (error) {
    console.error('[chatops-session] Failed to create new session:', error);
    return crypto.randomUUID();
  }
}

/**
 * 현재 세션을 히스토리에 업데이트
 */
export function updateCurrentSessionInHistory(messages: ChatOpsMessage[]): void {
  if (typeof window === 'undefined' || messages.length === 0) {
    return;
  }

  try {
    const currentSessionId = localStorage.getItem(CHATOPS_SESSION_ID_KEY);
    if (!currentSessionId) {
      return;
    }

    // 첫 번째 사용자 메시지를 제목으로 사용
    const firstUserMessage = messages.find(m => m.type === 'user_message');
    const title = firstUserMessage && typeof firstUserMessage.content === 'string'
      ? firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
      : '새 대화';

    const session: ChatOpsSession = {
      id: currentSessionId,
      title,
      createdAt: messages[0].timestamp.toISOString(),
      updatedAt: messages[messages.length - 1].timestamp.toISOString(),
      messageCount: messages.length,
    };
    saveChatOpsSession(session);
  } catch (error) {
    console.error('[chatops-session] Failed to update session in history:', error);
  }
}

/**
 * 30일이 지난 세션을 localStorage에서 자동 삭제
 * [SSOT] 서버의 보존 정책(30일)과 동기화
 *
 * 호출 시점: 세션 목록 로드 시 자동 실행
 * @returns 삭제된 세션 수
 */
export function cleanupExpiredSessions(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  try {
    const sessions = getChatOpsSessions();
    const now = new Date();
    const retentionMs = CHATOPS_RETENTION_DAYS * 24 * 60 * 60 * 1000; // 30일을 밀리초로

    // 만료된 세션 필터링
    const expiredSessions = sessions.filter(s => {
      const updatedAt = new Date(s.updatedAt);
      return (now.getTime() - updatedAt.getTime()) > retentionMs;
    });

    if (expiredSessions.length === 0) {
      return 0;
    }

    // 만료된 세션의 메시지 캐시 삭제
    for (const session of expiredSessions) {
      const messagesKey = `${CHATOPS_MESSAGES_KEY_PREFIX}${session.id}`;
      localStorage.removeItem(messagesKey);
    }

    // 유효한 세션만 유지
    const validSessions = sessions.filter(s => {
      const updatedAt = new Date(s.updatedAt);
      return (now.getTime() - updatedAt.getTime()) <= retentionMs;
    });

    // 세션 목록 업데이트
    localStorage.setItem(CHATOPS_SESSIONS_LIST_KEY, JSON.stringify(validSessions));

    console.log(`[chatops-session] Cleaned up ${expiredSessions.length} expired sessions (older than ${CHATOPS_RETENTION_DAYS} days)`);
    return expiredSessions.length;
  } catch (error) {
    console.error('[chatops-session] Failed to cleanup expired sessions:', error);
    return 0;
  }
}

