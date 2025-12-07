/**
 * Radio Component
 * 
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용한다.
 * [불변 규칙] 터치 타겟 최소 44px 보장
 */

import React from 'react';
import { clsx } from 'clsx';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

/**
 * Radio 컴포넌트
 */
export const Radio: React.FC<RadioProps> = ({
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
          fontSize: 'var(--font-size-base)',
          color: 'var(--color-text)',
        }}
      >
        <input
          type="radio"
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
            fontSize: 'var(--font-size-sm)',
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
            fontSize: 'var(--font-size-sm)',
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

