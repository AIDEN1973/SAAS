/**
 * SubSidebar 컴포넌트
 *
 * 페이지 내부에서 사용하는 서브 네비게이션 사이드바입니다.
 * 메인 사이드바 우측에 표시되며, 해당 페이지의 서브 메뉴를 제공합니다.
 *
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 * [SSOT] 공용 컴포넌트로 다른 페이지에서도 재사용 가능합니다.
 *
 * @example
 * ```tsx
 * <SubSidebar
 *   title="출결관리"
 *   items={ATTENDANCE_SUB_MENU_ITEMS}
 *   selectedId={selectedSubMenu}
 *   onSelect={(id) => setSelectedSubMenu(id)}
 * />
 * ```
 */

import React, { useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip } from './Tooltip';

/** 서브 사이드바 메뉴 아이템 */
export interface SubSidebarMenuItem<T extends string = string> {
  /** 고유 ID */
  id: T;
  /** 표시 라벨 */
  label: string;
  /** 아이콘 (optional) - lucide-react 아이콘 권장 */
  icon?: React.ReactNode;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 배지 텍스트 (optional) */
  badge?: string | number;
  /** 접근성 설명 (optional) */
  ariaLabel?: string;
}

export interface SubSidebarProps<T extends string = string> {
  /** 사이드바 제목 */
  title: string;
  /** 메뉴 아이템 목록 */
  items: SubSidebarMenuItem<T>[];
  /** 현재 선택된 아이템 ID */
  selectedId?: T | null;
  /** 아이템 선택 핸들러 */
  onSelect: (id: T) => void;
  /** 닫기 핸들러 (optional - 제공 시 닫기 버튼 표시) */
  onClose?: () => void;
  /** 너비 (CSS 변수 또는 값) - 기본값: var(--width-agent-history-sidebar) */
  width?: string;
  /** 축소 시 너비 - 기본값: var(--width-sidebar-collapsed) */
  collapsedWidth?: string;
  /** 축소 상태 (controlled) */
  collapsed?: boolean;
  /** 축소 상태 변경 핸들러 */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** 구분선 표시 여부 - 기본값: true */
  showDividers?: boolean;
  /** 추가 스타일 */
  style?: React.CSSProperties;
  /** 테스트 ID */
  testId?: string;
}

export function SubSidebar<T extends string = string>({
  title,
  items,
  selectedId,
  onSelect,
  onClose,
  width = 'var(--width-agent-history-sidebar)',
  collapsedWidth = 'var(--width-sidebar-collapsed)',
  collapsed: controlledCollapsed,
  onCollapsedChange,
  showDividers = false,
  style,
  testId,
}: SubSidebarProps<T>) {
  // 내부 축소 상태 (uncontrolled 모드용)
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  // controlled vs uncontrolled 모드 지원
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  // 축소/확장 토글 핸들러
  const handleToggleCollapse = useCallback(() => {
    const newCollapsed = !isCollapsed;
    if (onCollapsedChange) {
      onCollapsedChange(newCollapsed);
    } else {
      setInternalCollapsed(newCollapsed);
    }
  }, [isCollapsed, onCollapsedChange]);

  // 메뉴 아이템 클릭 핸들러 (메모이제이션)
  const handleItemClick = useCallback(
    (item: SubSidebarMenuItem<T>) => {
      console.log('[SubSidebar] handleItemClick called:', item.id, 'disabled:', item.disabled);
      if (!item.disabled) {
        console.log('[SubSidebar] calling onSelect with:', item.id);
        onSelect(item.id);
      }
    },
    [onSelect]
  );

  // 키보드 네비게이션 핸들러
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, item: SubSidebarMenuItem<T>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleItemClick(item);
      }
    },
    [handleItemClick]
  );

  // 현재 너비 계산
  const currentWidth = isCollapsed ? collapsedWidth : width;

  return (
    <aside
      data-testid={testId}
      role="navigation"
      aria-label={`${title} 네비게이션`}
      style={{
        width: currentWidth,
        minWidth: currentWidth,
        height: 'var(--height-viewport)', // 100vh - 뷰포트 전체 높이 사용하여 우측 구분선이 화면 전체 높이에 표시
        borderRight: 'var(--border-width-thin) solid var(--color-gray-200)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        paddingTop: 'var(--spacing-xl)', // Container의 paddingTop과 동일 (32px)
        transition: 'var(--transition-base)',
        position: 'relative',
        boxSizing: 'border-box', // padding을 height에 포함
        ...style,
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          marginBottom: 'var(--spacing-md)',
          gap: 'var(--spacing-md)',
          paddingLeft: isCollapsed ? 0 : 'var(--spacing-lg)', // PageHeader의 기본 여백과 동일
          paddingRight: isCollapsed ? 0 : 'var(--spacing-sm)',
          minHeight: 'var(--touch-target-min)', // PageHeader와 동일한 높이 (2.75rem = 44px)
        }}
      >
        {/* 타이틀 (축소 시 숨김) */}
        {!isCollapsed && (
          <span
            style={{
              fontSize: 'var(--font-size-3xl)',
              fontWeight: 'var(--font-weight-extrabold)',
              margin: 0,
              lineHeight: 'var(--line-height-tight)',
              color: 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </span>
        )}

        {/* 축소/확장 버튼 */}
        <button
          onClick={handleToggleCollapse}
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
            flexShrink: 0,
          }}
          aria-label={isCollapsed ? `${title} 확장` : `${title} 축소`}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        {/* 닫기 버튼 (onClose 제공 시에만 표시, 축소 시 숨김) */}
        {onClose && !isCollapsed && (
          <button
            onClick={onClose}
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
            }}
            aria-label={`${title} 닫기`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* 메뉴 목록 */}
      <nav
        role="menubar"
        aria-orientation="vertical"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--spacing-sm)',
        }}
      >
        {items.map((item, index) => {
          const isSelected = selectedId === item.id;
          const isLastItem = index === items.length - 1;

          // 메뉴 버튼 렌더링
          const menuButton = (
            <button
                role="menuitem"
                aria-current={isSelected ? 'page' : undefined}
                aria-disabled={item.disabled}
                aria-label={item.ariaLabel || item.label}
                tabIndex={item.disabled ? -1 : 0}
                onClick={() => handleItemClick(item)}
                onKeyDown={(e) => handleKeyDown(e, item)}
                disabled={item.disabled}
                style={{
                  width: isCollapsed ? 'auto' : 'calc(100% - var(--spacing-sm))', // 좌우 여백만큼 줄임
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  gap: 'var(--spacing-sm)',
                  padding: isCollapsed ? 'var(--spacing-sm)' : 'var(--spacing-sm) var(--spacing-md)',
                  minHeight: 'var(--touch-target-min)',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  backgroundColor: isSelected
                    ? 'var(--color-primary-40)'
                    : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--border-radius-sm)',
                  color: item.disabled
                    ? 'var(--color-text-tertiary)'
                    : isSelected
                      ? 'var(--color-primary)' // 선택된 상태: 프라이머리 색상
                      : 'var(--color-text)',
                  fontSize: 'var(--font-size-base)',
                  fontWeight: isSelected
                    ? 'var(--font-weight-semibold)'
                    : 'var(--font-weight-normal)',
                  textAlign: 'left',
                  opacity: item.disabled ? 0.5 : 1,
                  transition: 'var(--transition-base)',
                }}
                onMouseEnter={(e) => {
                  if (!item.disabled && !isSelected) {
                    e.currentTarget.style.backgroundColor = 'var(--color-primary-40)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!item.disabled && !isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
                onFocus={(e) => {
                  if (!item.disabled && !isSelected) {
                    e.currentTarget.style.backgroundColor = 'var(--color-primary-40)';
                  }
                }}
                onBlur={(e) => {
                  if (!item.disabled && !isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {/* 아이콘 */}
                {item.icon && (
                  <span
                    aria-hidden="true"
                    className={isSelected ? 'sub-sidebar-menu-icon-selected' : 'sub-sidebar-menu-icon'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      width: 'var(--size-icon-base)',
                      height: 'var(--size-icon-base)',
                    }}
                  >
                    {item.icon}
                  </span>
                )}

                {/* 라벨 (축소 시 숨김) */}
                {!isCollapsed && (
                  <span style={{ flex: 1 }}>{item.label}</span>
                )}

                {/* 배지 (축소 시 숨김) */}
                {!isCollapsed && item.badge !== undefined && (
                  <span
                    aria-label={`${item.badge} 항목`}
                    style={{
                      padding: 'var(--spacing-xxs) var(--spacing-xs)',
                      backgroundColor: 'var(--color-primary-100)',
                      color: 'var(--color-primary)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-medium)',
                      borderRadius: 'var(--border-radius-full)',
                      lineHeight: 1,
                      minWidth: 'var(--size-checkbox)',
                      textAlign: 'center',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
          );

          return (
            <div key={item.id} role="none" style={{ display: 'flex', justifyContent: 'center' }}>
              {/* 축소 상태일 때 툴팁 표시 */}
              {isCollapsed ? (
                <Tooltip content={item.label} position="right" offset={8}>
                  {menuButton}
                </Tooltip>
              ) : (
                menuButton
              )}

              {/* 구분선 (마지막 아이템 제외, showDividers가 true일 때만, 축소 시 숨김) */}
              {showDividers && !isLastItem && !isCollapsed && (
                <div
                  role="separator"
                  aria-hidden="true"
                  style={{
                    height: 'var(--border-width-thin)',
                    backgroundColor: 'var(--color-gray-200)',
                    margin: 'var(--spacing-xs) var(--spacing-md)',
                  }}
                />
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
