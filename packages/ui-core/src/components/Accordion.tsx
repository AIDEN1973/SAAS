/**
 * Accordion Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { Card } from './Card';

export interface AccordionItem {
  key: string;
  title: string;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface AccordionProps {
  items: AccordionItem[];
  defaultOpenKeys?: string[];
  allowMultiple?: boolean;
  className?: string;
}

/**
 * Accordion 컴포넌트
 *
 * 아코디언 컴포넌트
 */
export const Accordion: React.FC<AccordionProps> = ({
  items,
  defaultOpenKeys = [],
  allowMultiple = false,
  className,
}) => {
  const [openKeys, setOpenKeys] = useState<string[]>(defaultOpenKeys);

  const handleToggle = (key: string) => {
    setOpenKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      } else {
        return allowMultiple ? [...prev, key] : [key];
      }
    });
  };

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-sm)',
      }}
    >
      {items.map((item) => {
        const isOpen = openKeys.includes(item.key);
        return (
        <Card
          key={item.key}
          variant="default"
          style={{
            overflow: 'hidden',
            padding: 0,
          }}
        >
            <button
              onClick={() => !item.disabled && handleToggle(item.key)}
              disabled={item.disabled}
              style={{
                width: '100%',
                padding: 'var(--spacing-md)',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text)',
                textAlign: 'left',
                transition: 'background-color 0.2s ease',
                opacity: item.disabled ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!item.disabled) {
                  e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span>{item.title}</span>
              <span
                style={{
                  transition: 'transform 0.2s ease',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                ▼
              </span>
            </button>
            {isOpen && (
              <div
                style={{
                  padding: 'var(--spacing-md)',
                  borderTop: '1px solid var(--color-gray-200)',
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                {item.content}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

