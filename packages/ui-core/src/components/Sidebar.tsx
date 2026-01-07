/**
 * Sidebar Component
 *
 * 좌측 사이드바 메뉴
 * [불변 규칙] 반응형 Mobile에서 Drawer로 변환, Desktop에서 Persistent Sidebar
 */

import React, { useState, useRef } from 'react';
import { clsx } from 'clsx';
import { X, DotsThree } from 'phosphor-react';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { Button } from './Button';

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
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  currentPath,
  onItemClick,
  className,
  isOpen = true,
  onClose,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const [expandedItems] = useState<Set<string>>(new Set());
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [advancedMenuOpen, setAdvancedMenuOpen] = useState(false);
  const [advancedMenuItems, setAdvancedMenuItems] = useState<SidebarItem[] | null>(null);
  const advancedButtonRef = useRef<HTMLButtonElement>(null);

  const handleItemClick = (item: SidebarItem) => {
    // Advanced 메뉴이고 children이 있으면 레이어 메뉴 열기
    if (item.isAdvanced && item.children && item.children.length > 0) {
      setAdvancedMenuItems(item.children);
      setAdvancedMenuOpen(true);
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
    const isExpanded = expandedItems.has(item.id);
    const hasChildren = item.children && item.children.length > 0;
    const isHovered = hoveredItemId === item.id;

    // Advanced 메뉴는 ... 아이콘만 표시
    if (item.isAdvanced) {
      return (
        <div key={item.id}>
          <button
            ref={advancedButtonRef}
            onClick={() => handleItemClick(item)}
            onMouseEnter={() => setHoveredItemId(item.id)}
            onMouseLeave={() => setHoveredItemId(null)}
            style={{
              width: '100%',
              textAlign: 'center',
              borderRadius: 'var(--border-radius-xl)',
              padding: 'var(--spacing-sm) var(--spacing-xs)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isHovered ? 'var(--color-primary-40)' : 'transparent',
              color: 'var(--color-text)',
              border: 'none',
              cursor: 'pointer',
              transition: 'var(--transition-all)',
              minHeight: 'var(--touch-target-min)',
            }}
          >
            <span
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--spacing-sm)',
                borderRadius: 'var(--border-radius-lg)',
              }}
            >
              <DotsThree
                weight="bold"
                style={{
                  width: 'var(--size-icon-sidebar-lg)',
                  height: 'var(--size-icon-sidebar-lg)',
                  color: 'var(--color-text)',
                }}
              />
            </span>
          </button>
        </div>
      );
    }

    return (
      <div key={item.id}>
        <button
          onClick={() => handleItemClick(item)}
          onMouseEnter={() => setHoveredItemId(item.id)}
          onMouseLeave={() => setHoveredItemId(null)}
          style={{
            width: '100%',
            textAlign: 'center',
            borderRadius: 'var(--border-radius-xl)',
            padding: 'var(--spacing-sm) var(--spacing-xs)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--spacing-xs)',
            backgroundColor: isHovered ? 'var(--color-primary-40)' : 'transparent', // 롤오버 시 인더스트리 타입 색상
            color: 'var(--color-text)', // 항상 기본 텍스트 색상
            fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
            border: 'none',
            cursor: 'pointer',
            transition: 'var(--transition-all)',
            position: 'relative',
            minHeight: 'var(--touch-target-min)',
          }}
        >
          {item.icon && React.isValidElement(item.icon) && (
            <span
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--spacing-sm)', // 배경 크기 (선택 여부와 무관하게 동일)
                borderRadius: 'var(--border-radius-lg)', // 더 둥글게
                backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
              }}
            >
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */}
              {React.cloneElement(item.icon as React.ReactElement<any>, {
                ...(item.icon.props || {}),
                stroke: isActive ? 'var(--color-white)' : 'var(--color-text)',
                strokeWidth: 2, // 살짝 굵게
                style: {
                  /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */
                  ...(item.icon.props?.style || {}),
                  width: 'var(--size-icon-sidebar-lg)',
                  height: 'var(--size-icon-sidebar-lg)',
                },
              })}
            </span>
          )}
          <span style={{
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            fontSize: 'var(--font-size-sm)',
          }}>
            {item.label}
          </span>
        </button>
        {/* 하위 메뉴 렌더링 (펼쳐진 경우만) */}
        {hasChildren && isExpanded && (
          <div style={{ marginTop: 'var(--spacing-xs)' }}>
            {item.children!.map((child) => renderItem(child, level + 1))}
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
        padding: isMobile ? 'var(--spacing-sm)' : 'var(--spacing-md) var(--spacing-md)',
        transition: 'var(--transition-all)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1px', // 메뉴 항목 간 간격
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
                  size={20}
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

  // 레이어 메뉴 아이템 클릭 핸들러
  const handleAdvancedMenuItemClick = (item: SidebarItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (onItemClick) {
      onItemClick(item);
    }
    setAdvancedMenuOpen(false);
    setAdvancedMenuItems(null);
  };

  // Desktop: Persistent Sidebar
  return (
    <>
      <aside
        className={clsx(className)}
        style={{
          height: '100%',
          width: 'var(--width-sidebar)',
          minWidth: 'var(--width-sidebar)',
          backgroundColor: 'var(--color-white)',
          borderRight: 'var(--border-width-thin) solid var(--color-gray-200)',
          boxShadow: 'var(--shadow-sm)',
          transition: 'var(--transition-all)',
        }}
      >
        {sidebarContent}
      </aside>
      {/* 더보기 레이어 메뉴 */}
      {advancedMenuOpen && advancedMenuItems && (
        <>
          {/* 오버레이 */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 'var(--z-max)',
            }}
            onClick={() => {
              setAdvancedMenuOpen(false);
              setAdvancedMenuItems(null);
            }}
          />
          {/* 레이어 메뉴 */}
          <div
            style={{
              position: 'fixed',
              left: 'calc(var(--width-sidebar) - var(--spacing-sm))',
              top: 'calc(var(--height-header) + var(--spacing-lg))',
              zIndex: 'calc(var(--z-max) + 1)',
              backgroundColor: 'var(--color-white)',
              borderRadius: 'var(--border-radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              border: 'var(--border-width-thin) solid var(--color-gray-200)',
              padding: 'var(--spacing-sm)',
              minWidth: '160px',
            }}
          >
            {advancedMenuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleAdvancedMenuItemClick(item)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderRadius: 'var(--border-radius-sm)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  transition: 'var(--transition-all)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary-40)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {item.icon && React.isValidElement(item.icon) && (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */}
                    {React.cloneElement(item.icon as React.ReactElement<any>, {
                      ...(item.icon.props || {}),
                      style: {
                        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */
                        ...(item.icon.props?.style || {}),
                        width: 'var(--size-icon-base)',
                        height: 'var(--size-icon-base)',
                      },
                    })}
                  </span>
                )}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
};

