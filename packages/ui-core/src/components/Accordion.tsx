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
                minHeight: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text)',
                textAlign: 'left',
                transition: 'background-color var(--transition-base)', // styles.css 준수: transition 토큰 사용
                opacity: item.disabled ? 'var(--opacity-disabled)' : 'var(--opacity-full)', // styles.css 준수: opacity 토큰 사용
              }}
              onMouseEnter={(e) => {
                if (!item.disabled) {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span>{item.title}</span>
              <span
                style={{
                  transition: 'transform var(--transition-base)', // styles.css 준수: transition 토큰 사용
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
                  borderTop: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
                  animation: `fadeIn var(--transition-base)`, // styles.css 준수: transition 토큰 사용
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

