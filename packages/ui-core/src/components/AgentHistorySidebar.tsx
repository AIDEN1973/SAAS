// LAYER: UI_CORE_COMPONENT
/**
 * AgentHistorySidebar Component
 *
 * 에이전트 모드의 좌측 히스토리 사이드바
 * ChatGPT Desktop 스타일의 대화 히스토리 목록
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Edit3, Trash2, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { getCSSVariableAsNumber } from '../utils/css-variables';
import type { ChatOpsSession } from '../utils/chatops-session';

export interface AgentHistorySidebarProps {
  sessions: ChatOpsSession[];
  currentSessionId: string;
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  sessionsLoading?: boolean;
  className?: string;
}

/**
 * 날짜를 그룹 라벨로 변환
 */
function getDateGroupLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const sessionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (sessionDate.getTime() >= today.getTime()) {
    return '오늘';
  } else if (sessionDate.getTime() >= yesterday.getTime()) {
    return '어제';
  } else if (sessionDate.getTime() >= weekAgo.getTime()) {
    return '이번 주';
  } else if (sessionDate.getTime() >= monthAgo.getTime()) {
    return '이번 달';
  } else {
    return '이전';
  }
}

/**
 * 세션을 날짜별로 그룹화
 */
function groupSessionsByDate(sessions: ChatOpsSession[]): Map<string, ChatOpsSession[]> {
  const groups = new Map<string, ChatOpsSession[]>();
  const order = ['오늘', '어제', '이번 주', '이번 달', '이전'];

  // 그룹 초기화
  order.forEach(label => groups.set(label, []));

  // 세션 분류
  sessions.forEach(session => {
    const label = getDateGroupLabel(session.updatedAt);
    const group = groups.get(label);
    if (group) {
      group.push(session);
    }
  });

  // 빈 그룹 제거
  order.forEach(label => {
    const group = groups.get(label);
    if (!group || group.length === 0) {
      groups.delete(label);
    }
  });

  return groups;
}

/**
 * AgentHistorySidebar 컴포넌트
 *
 * 에이전트 모드의 좌측 히스토리 사이드바
 */
export const AgentHistorySidebar: React.FC<AgentHistorySidebarProps> = ({
  sessions,
  currentSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  sessionsLoading = false,
  className,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);

  // 세션을 날짜별로 그룹화
  const groupedSessions = useMemo(() => groupSessionsByDate(sessions), [sessions]);

  // 모바일에서는 기본 접힘
  const effectiveCollapsed = isMobile ? true : isCollapsed;

  // ============================================================================
  // 확대/축소 애니메이션 로직 (SubSidebar와 동일)
  // ============================================================================

  // 사이드바 확대 애니메이션 진행 중인지 추적
  const [isSidebarExpanding, setIsSidebarExpanding] = useState(false);
  // 페이드인 준비 상태 (transition 먼저 적용)
  const [fadeInReady, setFadeInReady] = useState(false);
  // 콘텐츠 페이드인 실행 상태 (opacity 변경)
  const [contentVisible, setContentVisible] = useState(true);

  // 이전 isCollapsed 값 추적
  const prevIsCollapsed = useRef(isCollapsed);

  // 렌더링 시점에서 collapsed → expanded 감지 (useEffect보다 먼저 실행)
  const isExpandingNow = prevIsCollapsed.current === true && isCollapsed === false;

  // ★ 핵심: 텍스트 콘텐츠 렌더링 여부
  // 축소 시: isCollapsed=true → 텍스트 즉시 DOM에서 제거 (CSS transition으로 너비 축소)
  // 확대 시: isCollapsed=false이지만, 애니메이션 완료 전까지 텍스트 렌더링하지 않음
  const shouldRenderTextContent = !isCollapsed && !isSidebarExpanding && !isExpandingNow;

  // 사이드바 확장 시 애니메이션 실행
  useEffect(() => {
    if (prevIsCollapsed.current === true && isCollapsed === false) {
      setIsSidebarExpanding(true);
      setFadeInReady(false);
      setContentVisible(false);

      // [SSOT] CSS 변수에서 애니메이션 시간 읽기
      const slowDuration = getCSSVariableAsNumber('--duration-slow', 300);

      const timer = setTimeout(() => {
        setIsSidebarExpanding(false);

        requestAnimationFrame(() => {
          setFadeInReady(true);

          requestAnimationFrame(() => {
            setContentVisible(true);
          });
        });
      }, slowDuration);

      prevIsCollapsed.current = isCollapsed;
      return () => clearTimeout(timer);
    }

    prevIsCollapsed.current = isCollapsed;
  }, [isCollapsed]);

  // 모바일에서는 표시하지 않음
  if (isMobile) {
    return null;
  }

  return (
    <div
      className={clsx('agent-history-sidebar', className)}
      style={{
        width: effectiveCollapsed ? 'var(--spacing-3xl)' : 'var(--width-agent-history-sidebar)',
        minWidth: effectiveCollapsed ? 'var(--spacing-3xl)' : 'var(--width-agent-history-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: effectiveCollapsed ? 'center' : 'stretch',
        padding: effectiveCollapsed ? 'var(--spacing-md) var(--spacing-xs)' : '0',
        backgroundColor: 'var(--color-gray-50)',
        borderRight: 'var(--border-width-thin) solid var(--color-gray-200)',
        overflow: 'hidden',
        gap: effectiveCollapsed ? 'var(--spacing-sm)' : '0',
      }}
    >
      {/* 축소 상태: 아이콘 버튼들만 표시 */}
      {effectiveCollapsed && (
        <>
          {/* 새 대화 버튼 (아이콘만) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onNewSession}
            style={{
              width: 'var(--spacing-2xl)',
              height: 'var(--spacing-2xl)',
              padding: 'var(--spacing-xs)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="새 대화"
          >
            <Edit3 size={18} />
          </Button>

          {/* 사이드바 확대 버튼 (아이콘만) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(false)}
            style={{
              width: 'var(--spacing-2xl)',
              height: 'var(--spacing-2xl)',
              padding: 'var(--spacing-xs)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="사이드바 확대"
          >
            <ChevronRight size={18} />
          </Button>
        </>
      )}

      {/* 확대 상태: 헤더 + 히스토리 목록 */}
      {!effectiveCollapsed && (
        <>
          {/* 헤더 영역 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--spacing-md) var(--spacing-lg)',
              borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
            }}
          >
            {/* 새 대화 버튼 (좌측, 텍스트 스타일) */}
            {shouldRenderTextContent ? (
              <button
                onClick={onNewSession}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  padding: 'var(--spacing-xs)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 'var(--font-weight-medium)',
                  opacity: contentVisible ? 1 : 0,
                  visibility: contentVisible ? 'visible' : 'hidden',
                  transition: fadeInReady ? 'opacity var(--transition-base)' : 'none',
                }}
                aria-label="새 대화"
              >
                <Edit3 size={18} />
                새 대화
              </button>
            ) : (
              <div style={{ flex: 1 }} />
            )}

            {/* 사이드바 축소 버튼 (우측) - 항상 표시 */}
            <button
              onClick={() => setIsCollapsed(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--spacing-xs)',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 'var(--border-radius-sm)',
                cursor: 'pointer',
                color: 'var(--color-text-tertiary)',
                transition: 'var(--transition-colors)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label="사이드바 축소"
            >
              <ChevronLeft size={18} />
            </button>
          </div>

          {/* 히스토리 목록 */}
          {shouldRenderTextContent && (
            <div
              className="ui-core-hiddenScrollbar"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 'var(--spacing-sm)',
                opacity: contentVisible ? 1 : 0,
                visibility: contentVisible ? 'visible' : 'hidden',
                transition: fadeInReady ? 'opacity var(--transition-base)' : 'none',
              }}
            >
              {sessionsLoading ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--spacing-xl)',
                    color: 'var(--color-text-tertiary)',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      border: '2px solid var(--color-gray-200)',
                      borderTopColor: 'var(--color-primary-500)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      marginBottom: 'var(--spacing-sm)',
                    }}
                  />
                  <div style={{ fontSize: 'var(--font-size-sm)' }}>
                    대화 목록을 불러오는 중...
                  </div>
                </div>
              ) : sessions.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--spacing-xl)',
                    color: 'var(--color-text-tertiary)',
                    textAlign: 'center',
                  }}
                >
                  <MessageSquare size={32} style={{ marginBottom: 'var(--spacing-sm)', opacity: 0.5 }} />
                  <div style={{ fontSize: 'var(--font-size-sm)' }}>
                    대화 기록이 없습니다
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-xs)' }}>
                    새 대화를 시작해보세요
                  </div>
                </div>
              ) : (
                Array.from(groupedSessions.entries()).map(([groupLabel, groupSessions]) => (
                  <div key={groupLabel} style={{ marginBottom: 'var(--spacing-md)' }}>
                    {/* 그룹 라벨 */}
                    <div
                      style={{
                        fontSize: 'var(--font-size-base)',
                        fontWeight: 'var(--font-weight-semibold)',
                        color: 'var(--color-text-tertiary)',
                        padding: 'var(--spacing-xs) var(--spacing-md)',
                      }}
                    >
                      {groupLabel}
                    </div>

                    {/* 세션 목록 */}
                    {groupSessions.map(session => (
                      <div
                        key={session.id}
                        onMouseEnter={() => setHoveredSessionId(session.id)}
                        onMouseLeave={() => setHoveredSessionId(null)}
                        onClick={() => onSelectSession(session.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--spacing-xs) var(--spacing-md)',
                          borderRadius: 'var(--border-radius-md)',
                          cursor: 'pointer',
                          backgroundColor:
                            session.id === currentSessionId
                              ? 'var(--color-primary-50)'
                              : hoveredSessionId === session.id
                              ? 'var(--color-gray-100)'
                              : 'transparent',
                          transition: 'var(--transition-colors)',
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 'var(--font-size-base)',
                            color:
                              session.id === currentSessionId
                                ? 'var(--color-primary-700)'
                                : 'var(--color-text)',
                            fontWeight:
                              session.id === currentSessionId
                                ? 'var(--font-weight-medium)'
                                : 'var(--font-weight-normal)',
                          }}
                        >
                          {session.title}
                        </div>

                        {/* 삭제 버튼 (호버 시 표시) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(session.id);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 'var(--spacing-xs)',
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderRadius: 'var(--border-radius-sm)',
                            cursor: 'pointer',
                            color: 'var(--color-text-tertiary)',
                            transition: 'var(--transition-colors)',
                            opacity: hoveredSessionId === session.id ? 1 : 0,
                            visibility: hoveredSessionId === session.id ? 'visible' : 'hidden',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-error)';
                            e.currentTarget.style.backgroundColor = 'var(--color-error-50)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-tertiary)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          aria-label="대화 삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
