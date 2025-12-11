/**
 * Sidebar Component
 *
 * 좌측 사이드바 메뉴
 * [불변 규칙] 반응형 Mobile에서 Drawer로 변환, Desktop에서 Persistent Sidebar
 */

import React, { useState } from 'react';
import { clsx } from 'clsx';
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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

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
    const paddingLeft = level * 20 + 16;
    const isExpanded = expandedItems.has(item.id);
    const hasChildren = item.children && item.children.length > 0;
    const isAdvanced = item.isAdvanced;

    return (
      <div key={item.id}>
        <button
          onClick={() => handleItemClick(item)}
          style={{
            width: '100%',
            textAlign: 'left',
            borderRadius: 'var(--border-radius-sm)',
            padding: `var(--spacing-sm) var(--spacing-md)`,
            paddingLeft: `${paddingLeft}px`,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            backgroundColor: isActive ? 'var(--color-primary-50)' : 'transparent',
            color: isActive
              ? 'var(--color-primary)'
              : 'var(--color-text-secondary)',
            fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
            fontSize: 'var(--font-size-sm)',
            border: 'none',
            cursor: 'pointer',
            transition: 'var(--transition-all)',
            position: 'relative',
            minHeight: '44px',
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
              e.currentTarget.style.color = 'var(--color-text)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }
          }}
        >
          {isActive && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: '3px',
                height: '60%',
                backgroundColor: 'var(--color-primary)',
                borderRadius: '0 2px 2px 0',
              }}
            />
          )}
          {/* 펼치기/접기 아이콘 (Advanced 메뉴 또는 children이 있는 경우) */}
          {(isAdvanced || hasChildren) && (
            <span
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '16px',
                height: '16px',
                transition: 'var(--transition-transform)',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            >
              <svg
                style={{ width: '12px', height: '12px' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </span>
          )}
          {item.icon && (
            <span
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
              }}
            >
              {item.icon}
            </span>
          )}
          <span style={{ flex: 1 }}>{item.label}</span>
        </button>
        {/* 하위 메뉴 렌더링 (펼쳐진 경우만) */}
        {hasChildren && isExpanded && (
          <div style={{ marginLeft: 'var(--spacing-md)', marginTop: 'var(--spacing-xs)' }}>
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
        padding: 'var(--spacing-md)',
        paddingTop: 'var(--spacing-lg)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-xs)',
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
            width: '280px',
            maxWidth: '85vw',
            backgroundColor: 'var(--color-white)',
            borderRight: '1px solid var(--color-gray-200)',
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
              padding: 'var(--spacing-lg)',
              borderBottom: '1px solid var(--color-gray-200)',
              backgroundColor: 'var(--color-gray-50)',
            }}
          >
            <h2
              style={{
                fontWeight: 'var(--font-weight-bold)',
                fontSize: 'var(--font-size-lg)',
                margin: 0,
                color: 'var(--color-text)',
                letterSpacing: '-0.02em',
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
                  minWidth: '44px',
                  minHeight: '44px',
                }}
              >
                <svg
                  style={{ width: '20px', height: '20px' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
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
        width: '280px',
        minWidth: '280px',
        backgroundColor: 'var(--color-white)',
        borderRight: '1px solid var(--color-gray-200)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'var(--transition-all)',
      }}
    >
      {sidebarContent}
    </aside>
  );
};

