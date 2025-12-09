/**
 * Tabs Component
 *
 * [불변 규칙] Atlaskit Tabs를 래핑하여 사용합니다.
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 * [불변 규칙] 모든 스타일은 Atlaskit 테마를 사용합니다.
 */

import React, { useState } from 'react';
import { Box } from '@atlaskit/primitives';

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
 * Atlaskit Tabs를 래핑하여 사용합니다.
 */
export const Tabs: React.FC<TabsProps> = ({
  items,
  defaultActiveKey,
  activeKey: controlledActiveKey,
  onChange,
  className,
}) => {
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

  return (
    <div className={className}>
      <Box
        as="div"
        style={{
          display: 'flex',
          borderBottom: '2px solid var(--color-gray-200)',
        }}
      >
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={item.key}
              onClick={() => !item.disabled && handleTabChange(index)}
              disabled={item.disabled}
              style={{
                padding: 'var(--spacing-md) var(--spacing-lg)',
                minHeight: '44px',
                border: 'none',
                backgroundColor: 'transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                opacity: item.disabled ? 0.5 : 1,
              }}
            >
              {item.label}
            </button>
          );
        })}
      </Box>
      {items.map((item, index) => (
        index === activeIndex && (
          <Box key={item.key} as="div" style={{ padding: 'var(--spacing-lg)' }}>
            {item.content}
          </Box>
        )
      ))}
    </div>
  );
};
