// LAYER: UI_CORE_COMPONENT
/**
 * AgentTimelineSidebar Component
 *
 * 에이전트 모드의 우측 타임라인 사이드바
 * 현재 대화의 실행 타임라인 표시
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다
 * [SSOT 준수] ExecutionAuditRun 데이터 구조 사용 (TimelineModal과 동일)
 */

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { ExecutionAuditRun } from './ExecutionAuditPanel';
import { toKST } from '@lib/date-utils';

export interface AgentTimelineSidebarProps {
  items: ExecutionAuditRun[];
  className?: string;
}

/**
 * AgentTimelineSidebar 컴포넌트
 *
 * 에이전트 실행 타임라인을 표시하는 우측 사이드바
 */
export const AgentTimelineSidebar: React.FC<AgentTimelineSidebarProps> = ({
  items,
  className,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 모바일에서는 기본 접힘
  const effectiveCollapsed = isMobile ? true : isCollapsed;

  // 상태 아이콘 렌더링 (ExecutionAuditRunStatus 기반)
  const renderStatusIcon = (status: ExecutionAuditRun['status']) => {
    const iconStyle = { width: 'var(--size-icon-base)', height: 'var(--size-icon-base)' };

    switch (status) {
      case 'success':
        return <CheckCircle style={{ ...iconStyle, color: 'var(--color-success)' }} />;
      case 'partial':
        return <AlertCircle style={{ ...iconStyle, color: 'var(--color-warning)' }} />;
      case 'failed':
        return <XCircle style={{ ...iconStyle, color: 'var(--color-error)' }} />;
      default:
        return <Clock style={{ ...iconStyle, color: 'var(--color-gray-400)' }} />;
    }
  };

  if (effectiveCollapsed && !isMobile) {
    // 축소된 상태 (아이콘만 표시)
    return (
      <div
        className={clsx(className)}
        style={{
          width: 'var(--spacing-3xl)',
          minWidth: 'var(--spacing-3xl)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 'var(--spacing-md) var(--spacing-xs)',
          backgroundColor: 'var(--color-white)',
          borderLeft: 'var(--border-width-thin) solid var(--color-gray-200)',
          gap: 'var(--spacing-sm)',
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(false)}
          style={{ padding: 'var(--spacing-sm)' }}
          aria-label="타임라인 확장"
        >
          <ChevronLeft style={{ width: 'var(--size-icon-sidebar-close)', height: 'var(--size-icon-sidebar-close)' }} />
        </Button>
      </div>
    );
  }

  // 모바일에서는 표시하지 않음
  if (isMobile) {
    return null;
  }

  return (
    <div
      className={clsx(className)}
      style={{
        width: 'var(--width-agent-timeline-sidebar)',
        minWidth: 'var(--width-agent-timeline-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-white)',
        borderLeft: 'var(--border-width-thin) solid var(--color-gray-200)',
        overflow: 'hidden',
      }}
    >
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
        {/* 타이틀 (좌측) - 아이콘과 리스트 아이콘 정렬 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            color: 'var(--color-text)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-medium)',
          }}
        >
          <Clock style={{ width: 'var(--size-icon-sidebar)', height: 'var(--size-icon-sidebar)' }} />
          타임라인
        </div>

        {/* 사이드바 축소 버튼 (우측) */}
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
          aria-label="타임라인 축소"
        >
          <ChevronRight style={{ width: 'var(--size-icon-sidebar)', height: 'var(--size-icon-sidebar)' }} />
        </button>
      </div>

      {/* 타임라인 목록 */}
      <div
        className="ui-core-hiddenScrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--spacing-sm)',
        }}
      >
        {items.length === 0 ? (
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
            <Clock style={{ width: 'var(--size-avatar-sm)', height: 'var(--size-avatar-sm)', marginBottom: 'var(--spacing-sm)', opacity: 'var(--opacity-secondary)' }} />
            <div style={{ fontSize: 'var(--font-size-sm)' }}>
              타임라인이 없습니다
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-xs)' }}>
              업무를 시작하면 표시됩니다
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', padding: 'var(--spacing-md)' }}>
            {/* 세로 연결선 */}
            <div
              style={{
                position: 'absolute',
                left: 'calc(var(--spacing-md) + calc(var(--size-icon-base) / 2))',
                top: 'var(--spacing-none)',
                bottom: 'var(--spacing-none)',
                width: 'var(--border-width-thin)',
                backgroundColor: 'var(--color-gray-400)',
              }}
            />

            {/* 타임라인 아이템들 */}
            {items.map((item, index) => (
              <div
                key={item.id}
                style={{
                  position: 'relative',
                  paddingLeft: 'calc(var(--size-icon-base) + var(--spacing-xxs) + var(--spacing-xs))',
                  paddingBottom: index === items.length - 1 ? 'var(--spacing-none)' : 'var(--spacing-lg)',
                }}
              >
                {/* 상태 아이콘 */}
                <div
                  style={{
                    position: 'absolute',
                    left: 'var(--spacing-none)',
                    top: 'var(--spacing-xxs)',
                    width: 'var(--size-icon-base)',
                    height: 'var(--size-icon-base)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--color-white)',
                    zIndex: 'var(--z-base)',
                  }}
                >
                  {renderStatusIcon(item.status)}
                </div>

                {/* 아이템 내용 */}
                <div>
                  <div
                    style={{
                      fontSize: 'var(--font-size-base)',
                      color: 'var(--color-text-tertiary)',
                      marginBottom: 'var(--spacing-xs)',
                    }}
                  >
                    {toKST(item.occurred_at).format('MM-DD HH:mm')}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--font-size-base)',
                      color: 'var(--color-text)',
                      lineHeight: 'var(--line-height)',
                      wordBreak: 'break-word',
                    }}
                  >
                    {item.summary}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
