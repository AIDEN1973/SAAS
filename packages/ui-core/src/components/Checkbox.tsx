/**
 * Checkbox Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 * [불변 규칙] 터치 영역 최소 44px 보장
 */

import React from 'react';
import { clsx } from 'clsx';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

/**
 * Checkbox 컴포넌트
 */
export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  error,
  helperText,
  fullWidth = false,
  className,
  ...props
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xs)',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          cursor: 'pointer',
          color: 'var(--color-text)',
        }}
      >
        <input
          type="checkbox"
          className={clsx(className)}
          style={{
            width: '20px',
            height: '20px',
            minWidth: '20px',
            minHeight: '20px',
            cursor: 'pointer',
            accentColor: 'var(--color-primary)',
          }}
          {...props}
        />
        {label && (
          <span
            style={{
              userSelect: 'none',
            }}
          >
            {label}
          </span>
        )}
      </label>
      {error && (
        <span
          style={{
            color: 'var(--color-error)',
            marginLeft: '28px',
          }}
        >
          {error}
        </span>
      )}
      {helperText && !error && (
        <span
          style={{
            color: 'var(--color-text-secondary)',
            marginLeft: '28px',
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
};

