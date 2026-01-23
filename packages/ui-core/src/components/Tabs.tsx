/**
 * Tabs Component
 *
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React, { useState } from 'react';

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
  style?: React.CSSProperties;
  variant?: 'default' | 'pills';
  /** [P2-3 접근성] tablist의 aria-label */
  ariaLabel?: string;
}

/**
 * Tabs 컴포넌트
 *
 * 커스텀 구현된 Tabs 컴포넌트입니다.
 */
export const Tabs: React.FC<TabsProps> = ({
  items,
  defaultActiveKey,
  activeKey: controlledActiveKey,
  onChange,
  className,
  style,
  variant = 'default',
  ariaLabel,
}) => {
  // [P2-3 접근성] 고유 ID 생성
  const tabsId = React.useId();
  const [internalActiveKey, setInternalActiveKey] = useState(defaultActiveKey || items[0]?.key || '');
  const activeKey = controlledActiveKey !== undefined ? controlledActiveKey : internalActiveKey;

  const handleTabChange = (index: number) => {
    const selectedItem = items[index];
    if (selectedItem && !selectedItem.disabled) {
      if (controlledActiveKey === undefined) {
        setInternalActiveKey(selectedItem.key);
      }
      onChange?.(selectedItem.key);
    }
  };

  const activeIndex = items.findIndex((item) => item.key === activeKey);
  const isPills = variant === 'pills';

  return (
    <div className={className} style={style}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        style={{
          display: 'flex',
          gap: isPills ? 'var(--spacing-xs)' : 0,
          borderBottom: isPills ? 'none' : 'var(--border-width-base) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
        }}
      >
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const tabId = `${tabsId}-tab-${item.key}`;
          const panelId = `${tabsId}-panel-${item.key}`;
          return (
            <button
              key={item.key}
              id={tabId}
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              onClick={() => !item.disabled && handleTabChange(index)}
              disabled={item.disabled}
              style={{
                padding: 'var(--spacing-md) var(--spacing-lg)',
                minHeight: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
                border: 'none',
                backgroundColor: isPills
                  ? isActive
                    ? 'var(--color-primary)'
                    : 'var(--color-gray-100)'
                  : 'transparent',
                color: isPills
                  ? isActive
                    ? 'var(--color-white)'
                    : 'var(--color-text-secondary)'
                  : isActive
                  ? 'var(--color-primary)'
                  : 'var(--color-text-secondary)',
                borderBottom: isPills
                  ? 'none'
                  : isActive
                  ? 'var(--border-width-base) solid var(--color-primary)' // styles.css 준수: border-width 토큰 사용
                  : 'var(--border-width-base) solid transparent', // styles.css 준수: border-width 토큰 사용
                borderRadius: isPills ? 'var(--border-radius-sm)' : 0,
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
                whiteSpace: 'nowrap',
                transition: 'var(--transition-all)', // styles.css 준수: transition 토큰 사용
                opacity: item.disabled ? 'var(--opacity-disabled)' : 'var(--opacity-full)', // styles.css 준수: opacity 토큰 사용
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item, index) => {
        const isActive = index === activeIndex;
        const tabId = `${tabsId}-tab-${item.key}`;
        const panelId = `${tabsId}-panel-${item.key}`;
        return isActive && (
          <div
            key={item.key}
            id={panelId}
            role="tabpanel"
            aria-labelledby={tabId}
            tabIndex={0}
            style={{ padding: 'var(--spacing-lg)' }}
          >
            {item.content}
          </div>
        );
      })}
    </div>
  );
};
