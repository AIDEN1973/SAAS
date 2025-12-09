/**
 * Sidebar Component
 *
 * 좌측 사이드바 메뉴
 * [불변 규칙] 반응형 Mobile에서 Drawer로 변환, Desktop에서 Persistent Sidebar
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
    const paddingLeft = level * 20 + 16;

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
                  borderRadius: 'var(--border-radius-md)',
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

