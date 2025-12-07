/**
 * Sidebar Component
 * 
 * 좌측 사이드바 메뉴
 * [불변 규칙] 반응형: Mobile에서는 Drawer로 전환, Desktop에서는 Persistent Sidebar
 */

import React from 'react';
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

  const handleItemClick = (item: SidebarItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (onItemClick) {
      onItemClick(item);
    }
    if (isMobile && onClose) {
      onClose();
    }
  };

  const renderItem = (item: SidebarItem, level: number = 0) => {
    const isActive = currentPath === item.path;
    const paddingLeft = level * 16 + 16;

    return (
      <div key={item.id}>
        <button
          onClick={() => handleItemClick(item)}
          style={{
            width: '100%',
            textAlign: 'left',
            borderRadius: 'var(--border-radius-lg)',
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
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
              e.currentTarget.style.transform = 'translateX(4px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.transform = 'translateX(0)';
            }
          }}
        >
          {item.icon && (
            <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {item.icon}
            </span>
          )}
          <span>{item.label}</span>
        </button>
        {item.children && item.children.length > 0 && (
          <div style={{ marginLeft: 'var(--spacing-md)', marginTop: 'var(--spacing-xs)' }}>
            {item.children.map((child) => renderItem(child, level + 1))}
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
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 40,
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
            zIndex: 50,
            width: '16rem',
            backgroundColor: 'var(--color-white)',
            borderRight: '1px solid var(--color-gray-200)',
            boxShadow: 'var(--shadow-lg)',
            transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'var(--transition-transform)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--spacing-md)',
              borderBottom: '1px solid var(--color-gray-200)',
            }}
          >
            <h2
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                margin: 0,
                color: 'var(--color-text)',
              }}
            >
              메뉴
            </h2>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <svg
                  style={{ width: 'var(--spacing-lg)', height: 'var(--spacing-lg)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
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
        backgroundColor: 'var(--color-white)',
        borderRight: '1px solid var(--color-gray-200)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {sidebarContent}
    </aside>
  );
};

