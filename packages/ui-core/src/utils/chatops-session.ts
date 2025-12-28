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

const CHATOPS_SESSION_ID_KEY = 'chatops:session_id';
const CHATOPS_MESSAGES_KEY_PREFIX = 'chatops:messages:';

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
 */
export function resetChatOpsSessionId(): string {
  if (typeof window === 'undefined') {
    return crypto.randomUUID();
  }

  try {
    const newSessionId = crypto.randomUUID();
    localStorage.setItem(CHATOPS_SESSION_ID_KEY, newSessionId);

    // 기존 메시지 캐시도 삭제
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(CHATOPS_MESSAGES_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }

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

