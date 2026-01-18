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

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ExternalLink } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { getCSSVariableAsNumber } from '../utils/css-variables';

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
  /** 외부 링크 경로 (optional) - 제공 시 외부 페이지로 이동 */
  href?: string;
  /** 모달 또는 새창으로 열림 여부 (optional) - true일 경우 ExternalLink 아이콘 표시 */
  opensInModalOrNewWindow?: boolean;
}

/** 관련 메뉴 섹션 */
export interface RelatedMenuSection {
  /** 섹션 제목 */
  title: string;
  /** 관련 메뉴 아이템 목록 */
  items: SubSidebarMenuItem[];
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
  /** 관련 메뉴 섹션 (optional) */
  relatedMenus?: RelatedMenuSection;
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
  relatedMenus,
  style,
  testId,
}: SubSidebarProps<T>) {
  // 내부 축소 상태 (uncontrolled 모드용)
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  // 관련 메뉴 확장/축소 상태
  const [relatedMenuExpanded, setRelatedMenuExpanded] = useState(true);
  // 관련 메뉴 내부 콘텐츠 높이 (애니메이션용)
  const relatedMenuInnerRef = useRef<HTMLDivElement>(null);
  // 측정된 콘텐츠 높이 저장
  const [measuredHeight, setMeasuredHeight] = useState(0);
  // 사이드바 확대 애니메이션 진행 중인지 추적
  const [isSidebarExpanding, setIsSidebarExpanding] = useState(false);
  // 페이드인 준비 상태 (transition 먼저 적용)
  const [fadeInReady, setFadeInReady] = useState(false);
  // 콘텐츠 페이드인 실행 상태 (opacity 변경)
  const [contentVisible, setContentVisible] = useState(true);

  // controlled vs uncontrolled 모드 지원
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  // 이전 isCollapsed 값 추적
  const prevIsCollapsed = useRef(isCollapsed);

  // 렌더링 시점에서 collapsed → expanded 감지 (useEffect보다 먼저 실행)
  // 이렇게 하면 첫 렌더링에서도 콘텐츠가 숨겨짐
  const isExpandingNow = prevIsCollapsed.current === true && isCollapsed === false;

  // ★ 핵심: 텍스트 콘텐츠 렌더링 여부
  // 축소 시: isCollapsed=true → 텍스트 즉시 DOM에서 제거 (CSS transition으로 너비 축소)
  // 확대 시: isCollapsed=false이지만, 애니메이션 완료 전까지 텍스트 렌더링하지 않음
  // 이렇게 해야 확대 시 너비가 먼저 확장되고, 그 후 텍스트가 페이드인됨
  //
  // isExpandingNow: 렌더링 시점에서 collapsed→expanded 감지 (useEffect 전, 첫 렌더링 포함)
  // isSidebarExpanding: useEffect에서 설정 (첫 렌더링 이후)
  // 둘 중 하나라도 true면 텍스트 렌더링하지 않음
  const shouldRenderTextContent = !isCollapsed && !isSidebarExpanding && !isExpandingNow;

  // 사이드바 확장 시 관련 메뉴도 확장 상태로 초기화
  useEffect(() => {
    // 실제로 collapsed → expanded 변경이 일어났을 때만 애니메이션 실행
    if (prevIsCollapsed.current === true && isCollapsed === false) {
      setIsSidebarExpanding(true);
      setFadeInReady(false);
      setContentVisible(false);
      setRelatedMenuExpanded(true);

      // [SSOT] CSS 변수에서 애니메이션 시간 읽기 (사이드바 확장 애니메이션 시간)
      const slowDuration = getCSSVariableAsNumber('--duration-slow', 300);

      const timer = setTimeout(() => {
        setIsSidebarExpanding(false);

        requestAnimationFrame(() => {
          setFadeInReady(true);

          requestAnimationFrame(() => {
            setContentVisible(true);

            // 높이 재측정 (텍스트가 렌더링된 후)
            const innerElement = relatedMenuInnerRef.current;
            if (innerElement) {
              setMeasuredHeight(innerElement.scrollHeight);
            }
          });
        });
      }, slowDuration);

      prevIsCollapsed.current = isCollapsed;
      return () => clearTimeout(timer);
    }

    prevIsCollapsed.current = isCollapsed;
  }, [isCollapsed]);

  // 관련 메뉴 내부 콘텐츠 높이 측정 (ResizeObserver 사용)
  useEffect(() => {
    const innerElement = relatedMenuInnerRef.current;
    if (!innerElement) return;

    // 초기 높이 측정
    setMeasuredHeight(innerElement.scrollHeight);

    // ResizeObserver로 콘텐츠 변경 감지
    const resizeObserver = new ResizeObserver(() => {
      setMeasuredHeight(innerElement.scrollHeight);
    });
    resizeObserver.observe(innerElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [relatedMenus?.items]);

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
      if (!item.disabled) {
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
        position: 'sticky',
        top: 0,
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
        {/* 타이틀 (축소 시 숨김, 확대 애니메이션 완료 후 페이드인) */}
        {shouldRenderTextContent && (
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
              // 페이드인 애니메이션
              opacity: contentVisible ? 1 : 0,
              visibility: contentVisible ? 'visible' : 'hidden',
              transition: fadeInReady ? 'opacity var(--transition-base)' : 'none',
            }}
          >
            {title}
          </span>
        )}

        {/* 축소/확장 버튼 - 항상 표시 */}
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
            color: 'var(--color-text-secondary)',
            flexShrink: 0,
            transition: 'color var(--transition-fast), background-color var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text)';
            e.currentTarget.style.backgroundColor = 'var(--color-primary-40)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)';
            e.currentTarget.style.backgroundColor = 'transparent';
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
              color: 'var(--color-text-secondary)',
              transition: 'color var(--transition-fast), background-color var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text)';
              e.currentTarget.style.backgroundColor = 'var(--color-primary-40)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
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
                  // 축소 상태이거나 확대 애니메이션 중에는 좁은 형태
                  width: !shouldRenderTextContent ? 'auto' : 'calc(100% - var(--spacing-sm))', // 좌우 여백만큼 줄임
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: !shouldRenderTextContent ? 'center' : 'flex-start',
                  gap: 'var(--spacing-sm)',
                  padding: !shouldRenderTextContent ? 'var(--spacing-sm)' : 'var(--spacing-sm) var(--spacing-md)',
                  minHeight: 'var(--touch-target-min)',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  // 확대 애니메이션 중에는 배경색 제거
                  backgroundColor: (isExpandingNow || isSidebarExpanding)
                    ? 'transparent'
                    : (isSelected ? 'var(--color-primary-40)' : 'transparent'),
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
                {/* 아이콘 (항상 표시, 확대 애니메이션 중 숨김, 완료 후 페이드인) */}
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
                      // 확대 애니메이션 시작 시(isExpandingNow 또는 isSidebarExpanding) 즉시 숨김
                      // 축소 상태(!isCollapsed)에서는 표시
                      // 확대 완료 후(shouldRenderTextContent && contentVisible) 페이드인
                      opacity: (isExpandingNow || isSidebarExpanding) ? 0 : (shouldRenderTextContent ? (contentVisible ? 1 : 0) : 1),
                      visibility: (isExpandingNow || isSidebarExpanding) ? 'hidden' : (shouldRenderTextContent ? (contentVisible ? 'visible' : 'hidden') : 'visible'),
                      transition: shouldRenderTextContent && fadeInReady ? 'opacity var(--transition-base)' : 'none',
                    }}
                  >
                    {item.icon}
                  </span>
                )}

                {/* 라벨 (축소 시 숨김, 확대 애니메이션 완료 후 페이드인) */}
                {shouldRenderTextContent && (
                  <span
                    style={{
                      flex: 1,
                      opacity: contentVisible ? 1 : 0,
                      visibility: contentVisible ? 'visible' : 'hidden',
                      transition: fadeInReady ? 'opacity var(--transition-base)' : 'none',
                    }}
                  >
                    {item.label}
                  </span>
                )}

                {/* ExternalLink 아이콘 (모달/새창 열림 표시, 축소 시 숨김, 확대 애니메이션 완료 후 페이드인) */}
                {shouldRenderTextContent && item.opensInModalOrNewWindow && (
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      opacity: contentVisible ? 1 : 0,
                      visibility: contentVisible ? 'visible' : 'hidden',
                      transition: fadeInReady ? 'opacity var(--transition-base)' : 'none',
                    }}
                  >
                    <ExternalLink size={14} />
                  </span>
                )}

                {/* 배지 (축소 시 숨김, 확대 애니메이션 완료 후 페이드인) */}
                {shouldRenderTextContent && item.badge !== undefined && (
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
                      opacity: contentVisible ? 1 : 0,
                      visibility: contentVisible ? 'visible' : 'hidden',
                      transition: fadeInReady ? 'opacity var(--transition-base)' : 'none',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
          );

          return (
            <div key={item.id} role="none" style={{ display: 'flex', justifyContent: 'center' }}>
              {/* 축소 상태일 때는 툴팁과 함께, 확대 상태일 때는 메뉴 버튼만 표시 */}
              {!shouldRenderTextContent ? (
                <Tooltip content={item.label} position="right" offset={8}>
                  {menuButton}
                </Tooltip>
              ) : (
                menuButton
              )}

              {/* 구분선 (마지막 아이템 제외, showDividers가 true일 때만, 텍스트 콘텐츠와 함께 표시) */}
              {showDividers && !isLastItem && shouldRenderTextContent && (
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

        {/* 관련 메뉴 섹션 (축소 시 숨김, 확대 애니메이션 완료 후 표시) */}
        {relatedMenus && shouldRenderTextContent && (
          <div
            style={{
              marginTop: 'var(--spacing-lg)',
            }}
          >
            {/* 구분선 - 메뉴 아이템 너비와 동일하게 */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                role="separator"
                aria-hidden="true"
                style={{
                  width: 'calc(100% - var(--spacing-sm))',
                  height: 'var(--border-width-thin)',
                  backgroundColor: 'var(--color-gray-200)',
                  marginBottom: 'var(--spacing-md)',
                }}
              />
            </div>
            {/* 관련 메뉴 헤더 - nav padding 보정 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingLeft: 'calc(var(--spacing-lg) - var(--spacing-sm))',
                paddingRight: 0,
                minHeight: 'var(--touch-target-min)',
                opacity: contentVisible ? 1 : 0,
                visibility: contentVisible ? 'visible' : 'hidden',
                transition: fadeInReady ? 'opacity var(--transition-base)' : 'none',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-text)',
                }}
              >
                {relatedMenus.title}
              </span>
              <button
                onClick={() => {
                  setRelatedMenuExpanded(!relatedMenuExpanded);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--spacing-xs)',
                  marginRight: 0,
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--border-radius-sm)',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  flexShrink: 0,
                  transition: 'color var(--transition-fast), background-color var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text)';
                  e.currentTarget.style.backgroundColor = 'var(--color-primary-40)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                aria-expanded={relatedMenuExpanded}
                aria-label={`${relatedMenus.title} ${relatedMenuExpanded ? '접기' : '펼치기'}`}
              >
                {relatedMenuExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
            </div>

            {/* 관련 메뉴 아이템 목록 - 애니메이션 컨테이너 */}
            {/*
              [접근성 예외] prefers-reduced-motion 사용자에게도 부드러운 전환 제공
              - 이 애니메이션은 필수 UI 기능이며, 급격한 변화가 오히려 불편함을 줄 수 있음
              - 시간은 0.3s로 충분히 짧아 모션 민감 사용자에게도 적합
            */}
            <div
              className="sub-sidebar-related-menu-animation"
              data-expanded={relatedMenuExpanded}
              style={{
                maxHeight: contentVisible
                  ? (relatedMenuExpanded ? (measuredHeight > 0 ? `${measuredHeight}px` : '1000px') : '0px')
                  : '0px',
                overflow: 'hidden',
                opacity: contentVisible ? (relatedMenuExpanded ? 1 : 0) : 0,
                visibility: contentVisible ? 'visible' : 'hidden',
                transition: fadeInReady
                  ? (relatedMenuExpanded
                    ? 'opacity var(--transition-base), max-height var(--transition-base), visibility 0s'
                    : 'opacity var(--transition-fast), max-height var(--transition-fast) 80ms, visibility 0s 160ms')
                  : 'none',
              }}
            >
              {/* 내부 콘텐츠 (높이 측정용) */}
              <div ref={relatedMenuInnerRef}>
              {relatedMenus.items.map((relatedItem) => {
                const handleRelatedItemClick = () => {
                  if (relatedItem.href) {
                    // 외부 링크로 이동
                    window.location.href = relatedItem.href;
                  }
                };

                return (
                  <div key={relatedItem.id} role="none" style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={handleRelatedItemClick}
                      disabled={relatedItem.disabled}
                      style={{
                        width: 'calc(100% - var(--spacing-sm))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 'var(--spacing-sm)',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        minHeight: 'var(--touch-target-min)',
                        cursor: relatedItem.disabled ? 'not-allowed' : 'pointer',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: 'var(--border-radius-sm)',
                        color: relatedItem.disabled
                          ? 'var(--color-text-tertiary)'
                          : 'var(--color-text)',
                        fontSize: 'var(--font-size-base)',
                        fontWeight: 'var(--font-weight-normal)',
                        textAlign: 'left',
                        opacity: relatedItem.disabled ? 0.5 : 1,
                        transition: 'var(--transition-base)',
                      }}
                      onMouseEnter={(e) => {
                        if (!relatedItem.disabled) {
                          e.currentTarget.style.backgroundColor = 'var(--color-primary-40)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!relatedItem.disabled) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                      onFocus={(e) => {
                        if (!relatedItem.disabled) {
                          e.currentTarget.style.backgroundColor = 'var(--color-primary-40)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!relatedItem.disabled) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                      aria-label={relatedItem.ariaLabel || relatedItem.label}
                    >
                      {/* 아이콘 */}
                      {relatedItem.icon && (
                        <span
                          className="sub-sidebar-menu-icon"
                          aria-hidden="true"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            width: 'var(--size-icon-base)',
                            height: 'var(--size-icon-base)',
                          }}
                        >
                          {relatedItem.icon}
                        </span>
                      )}
                      {/* 라벨 */}
                      <span style={{ flex: 1 }}>{relatedItem.label}</span>
                    </button>
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
