/**
 * Tabs Component
 *
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용한다.
 */

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';

export interface TabItem {
  key: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  defaultActiveKey?: string;
  activeKey?: string;
  onChange?: (key: string) => void;
  className?: string;
  variant?: 'default' | 'pills';
}

/**
 * Tabs 컴포넌트
 *
 * 탭 네비게이션 컴포넌트
 */
export const Tabs: React.FC<TabsProps> = ({
  items,
  defaultActiveKey,
  activeKey: controlledActiveKey,
  onChange,
  className,
  variant = 'default',
}) => {
  const [internalActiveKey, setInternalActiveKey] = useState(defaultActiveKey || items[0]?.key || '');
  const activeKey = controlledActiveKey !== undefined ? controlledActiveKey : internalActiveKey;
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  const handleTabClick = (key: string) => {
    if (controlledActiveKey === undefined) {
      setInternalActiveKey(key);
    }
    onChange?.(key);
  };

  const activeTab = items.find((item) => item.key === activeKey);

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }}
    >
      {/* Tab Headers */}
      <div
        style={{
          display: 'flex',
          gap: variant === 'pills' ? 'var(--spacing-xs)' : 0,
          borderBottom: variant === 'default' ? '2px solid var(--color-gray-200)' : 'none',
          overflowX: isMobile ? 'auto' : 'visible',
        }}
      >
        {items.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <button
              key={item.key}
              onClick={() => !item.disabled && handleTabClick(item.key)}
              disabled={item.disabled}
              style={{
                padding: 'var(--spacing-md) var(--spacing-lg)',
                minHeight: '44px',
                border: 'none',
                backgroundColor: variant === 'pills' && isActive
                  ? 'var(--color-primary)'
                  : variant === 'pills'
                  ? 'var(--color-gray-100)'
                  : 'transparent',
                color: variant === 'pills' && isActive
                  ? 'var(--color-white)'
                  : isActive
                  ? 'var(--color-primary)'
                  : 'var(--color-text-secondary)',
                borderBottom: variant === 'default' && isActive
                  ? '2px solid var(--color-primary)'
                  : '2px solid transparent',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                opacity: item.disabled ? 0.5 : 1,
                borderRadius: variant === 'pills' ? 'var(--border-radius-md)' : 0,
              }}
              onMouseEnter={(e) => {
                if (!item.disabled && !isActive && variant !== 'pills') {
                  e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                }
              }}
              onMouseLeave={(e) => {
                if (!item.disabled && !isActive && variant !== 'pills') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab && (
        <div
          style={{
            padding: 'var(--spacing-lg)',
            minHeight: '200px',
          }}
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
};
