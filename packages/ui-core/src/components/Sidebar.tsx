/**
 * Sidebar Component
 *
 * 좌측 사이드바 메뉴
 * [불변 규칙] 반응형 Mobile에서 Drawer로 변환, Desktop에서 Persistent Sidebar
 */

import React, { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { CaretRight, X } from 'phosphor-react';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { Button } from './Button';
import { PageHeader } from './PageHeader';
import { Tooltip } from './Tooltip';

export interface SidebarItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  path?: string;
  onClick?: () => void;
  children?: SidebarItem[];
  isAdvanced?: boolean; // Advanced 메뉴 여부 (펼치기/접기 가능)
}

export interface SidebarProps {
  items: SidebarItem[];
  currentPath?: string;
  onItemClick?: (item: SidebarItem) => void;
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  pageHeaderTitle?: string; // 사이드바 상단에 표시할 페이지 헤더 제목
  pageHeaderActions?: React.ReactNode; // 사이드바 페이지 헤더 액션 버튼
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  currentPath,
  onItemClick,
  className,
  isOpen = true,
  onClose,
  collapsed = false,
  pageHeaderTitle,
  pageHeaderActions,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // CSS 변수에서 strokeWidth 읽기 (하드코딩 제거) - 기본 선 굵기 사용
  const strokeWidth = useMemo(() => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--stroke-width-icon')
        .trim();
      // 기본 선 굵기 사용 (1.5)
      return value ? Number(value) : 1.5;
    }
    return 1.5;
  }, []);

  // CSS 변수에서 strokeWidth bold 읽기 (롤오버/선택 시 사용)
  const strokeWidthBold = useMemo(() => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--stroke-width-icon-bold-sidebar')
        .trim();
      // 굵은 선 굵기 사용 (2 - 기본값과 동일)
      return value ? Number(value) : 2;
    }
    return 2;
  }, []);

  // CSS 변수에서 icon size 읽기 (사이드바 아이콘 크기)
  const iconSize = useMemo(() => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--size-icon-sidebar')
        .trim();
      if (value.endsWith('rem')) {
        const remValue = parseFloat(value);
        return remValue * 16; // rem을 px로 변환
      } else if (value.endsWith('px')) {
        return parseFloat(value);
      } else if (value) {
        return Number(value);
      }
    }
    return 16; // 기본값: 16px (--size-icon-sidebar 기본값)
  }, []);

  // CSS 변수에서 닫기 버튼 아이콘 크기 읽기
  const closeIconSize = useMemo(() => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--size-icon-sidebar-close')
        .trim();
      if (value.endsWith('rem')) {
        const remValue = parseFloat(value);
        return remValue * 16; // rem을 px로 변환
      } else if (value.endsWith('px')) {
        return parseFloat(value);
      } else if (value) {
        return Number(value);
      }
    }
    return 20; // 기본값: 20px (--size-icon-sidebar-close 기본값)
  }, []);

  const handleItemClick = (item: SidebarItem) => {
    // Advanced 메뉴이고 children이 있으면 펼치기/접기 토글
    if (item.isAdvanced && item.children && item.children.length > 0) {
      setExpandedItems((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
        return next;
      });
      return;
    }

    // 일반 메뉴 클릭 처리
    if (item.onClick) {
      item.onClick();
    } else if (onItemClick) {
      onItemClick(item);
    }
    if (isMobile && onClose) {
      onClose();
    }
  };

  /**
   * 사이드바 아이템 활성 상태 판단
   *
   * 활성화 규칙:
   * 1. 정확한 경로 일치
   * 2. 하위 경로 매칭 (예: /students/home → /students/:id, /students/list 등)
   * 3. 특수 경로 처리:
   *    - /home: / 또는 /home 활성화
   *    - /students/home: /students/* 모든 하위 경로 활성화
   *    - /billing/home: /billing/* 모든 하위 경로 활성화
   */
  const isItemActive = (itemPath: string | undefined, currentPath: string | undefined): boolean => {
    if (!currentPath || !itemPath) return false;

    // 정확한 경로 일치
    if (currentPath === itemPath) return true;

    // 루트 경로 처리: /home → / 또는 /home 또는 /home/* 모든 하위 경로
    if (itemPath === '/home' && (currentPath === '/' || currentPath === '/home' || currentPath.startsWith('/home/'))) {
      return true;
    }

    // students 경로 처리: /students/home → /students/* 모든 하위 경로
    if (itemPath === '/students/home' && currentPath.startsWith('/students')) {
      return true;
    }

    // billing 경로 처리: /billing/home → /billing/* 모든 하위 경로
    if (itemPath === '/billing/home' && currentPath.startsWith('/billing')) {
      return true;
    }

    // 일반 하위 경로 매칭: /classes → /classes, /classes/123 등
    // 단, /classes와 /classes-other 같은 경로는 구분해야 함
    if (currentPath.startsWith(itemPath + '/') ||
        (itemPath !== '/' && currentPath === itemPath)) {
      return true;
    }

    return false;
  };

  const renderItem = (item: SidebarItem, level: number = 0) => {
    const isActive = isItemActive(item.path, currentPath);
    const isDesktop = mode === 'lg' || mode === 'xl';
    // 들여쓰기 계산: 레벨당 spacing-md (기본 paddingLeft 제거하여 헤더 로고와 좌측 여백 일치)
    // 헤더 로고 좌측 여백 = 헤더 paddingLeft (모바일: var(--spacing-lg), 태블릿 이상: var(--spacing-xl))
    // 사이드바 메뉴 좌측 여백 = nav paddingLeft + 메뉴 아이템 paddingLeft
    // 따라서 메뉴 아이템 paddingLeft는 0으로 설정하여 nav paddingLeft만 사용 (헤더 로고와 동일한 좌측 여백)
    const isExpanded = expandedItems.has(item.id);
    const hasChildren = item.children && item.children.length > 0;
    const isAdvanced = item.isAdvanced;
    const isHovered = hoveredItemId === item.id;
    // Advanced 메뉴의 하위 메뉴는 들여쓰기 제거
    const paddingLeft = collapsed
      ? 0 // 축소 시 paddingLeft 제거
      : (isAdvanced && level > 0) ? 0 : (level > 0 ? `calc(${level} * var(--spacing-md))` : 0); // 레벨별 들여쓰기만 적용 (기본 paddingLeft 제거하여 헤더 로고와 좌측 여백 일치), Advanced 메뉴 하위는 들여쓰기 제거

    return (
      <div key={item.id}>
        <button
          onClick={() => handleItemClick(item)}
          onMouseEnter={() => setHoveredItemId(item.id)}
          onMouseLeave={() => setHoveredItemId(null)}
          style={{
            width: '100%',
            textAlign: 'left',
            borderRadius: 'var(--border-radius-sm)',
            padding: `var(--spacing-xxs) var(--spacing-md)`, // 상하 패딩 줄이기 (2px)
            paddingLeft: paddingLeft,
            display: 'flex',
            alignItems: 'center',
            gap: collapsed
              ? 'var(--spacing-xs)'
              : 'var(--spacing-sm)', // 아이콘과 메뉴명 사이 간격 줄이기 (8px)
            backgroundColor: 'transparent', // 배경 효과 제거
            color: 'var(--color-text)', // 기본 텍스트 색상 사용
            fontWeight: (isActive || (isAdvanced && isExpanded)) ? 'var(--font-weight-extrabold)' : 'var(--font-weight-medium)', // 선택된 메뉴 또는 Advanced 메뉴 펼침 시: 엑스트라 볼드
            fontSize: 'var(--font-size-base)',
            border: 'none',
            cursor: 'pointer',
            transition: 'var(--transition-all)',
            position: 'relative',
            minHeight: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
          }}
        >
          {/* 펼치기/접기 아이콘 (children이 있는 경우만 표시, Advanced 메뉴는 제외, 축소 시 숨김) */}
          {!collapsed && !isAdvanced && hasChildren && (
            <span
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 'var(--spacing-md)', // styles.css 준수: spacing 토큰 사용 (16px)
                height: 'var(--spacing-md)', // styles.css 준수: spacing 토큰 사용 (16px)
                transition: 'var(--transition-transform)',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            >
              <CaretRight
                size={iconSize}
                strokeWidth={strokeWidth}
                style={{
                  color: 'currentColor',
                }}
              />
            </span>
          )}
          {item.icon && React.isValidElement(item.icon) && (
            <span
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {(() => {
                const currentStrokeWidth = (isActive || isHovered || (isAdvanced && isExpanded)) ? strokeWidthBold : strokeWidth;
                const currentStroke = (isActive || isHovered || (isAdvanced && isExpanded))
                  ? 'var(--color-primary)' // 롤오버/선택 시 또는 Advanced 메뉴 펼침 시 인더스트리 테마 primary 색상
                  : 'var(--color-text)'; // 기본 상태: 기본 텍스트 색상

                // SVG 요소 복제 (strokeWidth는 SVG 자체에는 적용되지 않으므로 제거)
                const iconElement = React.cloneElement(item.icon as React.ReactElement<any>, {
                  ...(item.icon.props || {}),
                  // SVG 자체에는 strokeWidth를 전달하지 않음 (자식 요소에만 적용)
                  strokeLinecap: 'round', // 선 끝 모양 통일 (SVG 전체에 적용)
                  strokeLinejoin: 'round', // 선 연결 모양 통일 (SVG 전체에 적용)
                  stroke: currentStroke, // stroke 색상 (SVG 전체에 적용, 자식 요소에 상속)
                  style: {
                    ...(item.icon.props?.style || {}),
                    width: 'var(--size-icon-sidebar)',
                    height: 'var(--size-icon-sidebar)',
                    transition: 'var(--transition-all)',
                  },
                  children: React.Children.map(item.icon.props?.children || [], (child) => {
                    // React.isValidElement로 유효한 React 요소인지 확인
                    if (!React.isValidElement(child)) {
                      return child;
                    }

                    // SVG 자식 요소 타입 확인 (string 타입인 경우만 처리)
                    // React에서 SVG 요소는 type이 문자열로 전달됨 (예: 'path', 'circle')
                    const childType = typeof child.type === 'string' ? child.type.toLowerCase() : null;

                    // path, circle, line 등 모든 SVG 자식 요소에 strokeWidth 적용
                    if (childType && ['path', 'circle', 'line', 'rect', 'polygon', 'polyline', 'ellipse'].includes(childType)) {
                      // 기존 props와 병합하여 strokeWidth, strokeLinecap, strokeLinejoin, stroke 적용
                      const existingProps = child.props || {};
                      return React.cloneElement(child as React.ReactElement<any>, {
                        ...existingProps,
                        strokeWidth: String(currentStrokeWidth), // SVG 자식 요소에 strokeWidth 명시적으로 적용 (문자열로 전달)
                        strokeLinecap: 'round', // 자식 요소에도 명시적으로 적용
                        strokeLinejoin: 'round', // 자식 요소에도 명시적으로 적용
                        stroke: currentStroke, // stroke 색상도 자식 요소에 명시적으로 적용
                      });
                    }

                    // SVG 자식 요소가 아닌 경우 그대로 반환
                    return child;
                  }),
                });

                // 축소 모드일 때만 툴팁 표시
                if (collapsed) {
                  return (
                    <Tooltip content={item.label} position="right">
                      {iconElement}
                    </Tooltip>
                  );
                }

                return iconElement;
              })()}
            </span>
          )}
          {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
        </button>
        {/* 하위 메뉴 렌더링 (펼쳐진 경우만, Advanced 메뉴는 축소 상태에서도 표시) */}
        {hasChildren && isExpanded && (!collapsed || isAdvanced) && (
          <div style={{ marginLeft: isAdvanced ? 0 : 'var(--spacing-md)', marginTop: 'var(--spacing-xs)' }}>
            {item.children!.map((child) => renderItem(child, isAdvanced ? level : level + 1))}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <nav
      style={{
        height: '100%',
        overflowY: 'auto',
        // 모바일(xs, sm): padding 제거 (Container에서 처리), 태블릿 이상(md+): 바디와 동일한 여백 (유아이 문서 6-1 준수)
        // 바디 구조: main(padding: var(--spacing-xl)) > Container(paddingTop: var(--spacing-xl) 기본값)
        // 사이드바 구조: nav(paddingTop: var(--spacing-content-top)) > PageHeader
        // 바디의 실제 상단 여백 = main의 paddingTop(32px) + Container의 paddingTop(32px) = 64px
        // 사이드바도 바디와 동일하게 상단 여백을 맞추기 위해 CSS 변수 사용
        // 좌측 여백: 글로벌 헤더와 동일하게 설정 (모바일: var(--spacing-lg), 태블릿 이상: var(--spacing-xl))
        paddingLeft: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-xl)', // 모바일: 24px (헤더와 동일), 태블릿 이상: 32px (헤더와 동일)
        paddingRight: isMobile ? 0 : 'var(--spacing-xl)', // 태블릿 이상: 우측 여백 (32px, main의 paddingRight와 동일)
        paddingTop: isMobile ? 0 : 'var(--spacing-content-top)', // 태블릿 이상: 상단 여백 (바디와 동일, CSS 변수 사용)
        paddingBottom: isMobile ? 0 : 'var(--spacing-xl)', // 태블릿 이상: 하단 여백 (32px, main의 paddingBottom과 동일)
        transition: 'var(--transition-all)',
      }}
    >
      {!collapsed && pageHeaderTitle && (
        <PageHeader
          title={pageHeaderTitle}
          actions={pageHeaderActions}
          style={{
            marginTop: 0, // nav의 paddingTop이 상단 여백을 제공하므로 marginTop 제거
            marginBottom: 'var(--spacing-lg)', // PageHeader의 기본 marginBottom 유지
          }}
        />
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'calc(var(--spacing-sm) + var(--spacing-negative-xxs))', // 메뉴명 행간 간격 (8px - 2px = 6px)
          // 메뉴 리스트 첫 번째 메뉴 상단 여백: PageHeader가 없을 때도 동일한 여백 유지 (모바일만)
          paddingTop: (isMobile && !pageHeaderTitle) ? 'var(--spacing-lg)' : 0,
        }}
      >
        {items.map((item) => renderItem(item))}
      </div>
    </nav>
  );

  if (isMobile) {
    return (
      <>
        {/* Mobile: Drawer Overlay */}
        {isOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'var(--overlay-background)',
              zIndex: 'var(--z-modal-backdrop)',
            }}
            onClick={onClose}
          />
        )}
        {/* Mobile: Drawer */}
        <aside
          className={clsx(className)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            height: '100%',
            zIndex: 'var(--z-modal)',
            width: 'var(--width-sidebar)', // styles.css 준수: 사이드바 너비 토큰 사용
            maxWidth: 'var(--width-drawer)', // styles.css 준수: Drawer 최대 너비 토큰 사용
            backgroundColor: 'var(--color-white)',
            borderRight: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
            boxShadow: 'var(--shadow-xl)',
            transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'var(--transition-transform)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              // 글로벌 헤더와 동일한 패딩: 모바일(xs, sm): 상하 var(--padding-header-vertical), 좌우 var(--spacing-lg)
              padding: 'var(--padding-header-vertical) var(--spacing-lg)', // 모바일: 상하 패딩 CSS 변수 사용, 좌우 CSS 변수 사용
              borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
              backgroundColor: 'var(--color-gray-50)',
              minHeight: 'var(--height-header)', // 글로벌 헤더 높이와 동일하게 설정
            }}
          >
            <h2
              style={{
                fontWeight: 'var(--font-weight-bold)',
                fontSize: 'var(--font-size-lg)',
                margin: 0,
                color: 'var(--color-text)',
                letterSpacing: 'var(--letter-spacing-title)', // styles.css 준수: 타이틀 글자 간격 토큰 사용
              }}
            >
              메뉴
            </h2>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                style={{
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--border-radius-sm)',
                  minWidth: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
                  minHeight: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
                }}
              >
                <X
                  size={closeIconSize}
                  style={{
                    color: 'currentColor',
                  }}
                />
              </Button>
            )}
          </div>
          {sidebarContent}
        </aside>
      </>
    );
  }

  // Desktop: Persistent Sidebar
  return (
    <aside
      className={clsx(className)}
      style={{
        height: '100%',
        width: collapsed ? 'var(--width-sidebar-collapsed)' : 'var(--width-sidebar)', // styles.css 준수: 사이드바 너비 토큰 사용
        minWidth: collapsed ? 'var(--width-sidebar-collapsed)' : 'var(--width-sidebar)', // styles.css 준수: 사이드바 너비 토큰 사용
        backgroundColor: 'var(--color-white)',
        borderRight: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
        boxShadow: 'var(--shadow-sm)',
        transition: 'var(--transition-all)',
      }}
    >
      {sidebarContent}
    </aside>
  );
};

