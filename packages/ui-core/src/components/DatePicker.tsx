/**
 * DatePicker Component
 *
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 *
 * Phase 1: 기본 HTML5 date input 사용
 * Phase 2+: 고급 DatePicker 라이브러리 통합 가능
 */

import React from 'react';
import { clsx } from 'clsx';
import { SizeToken } from '@design-system/core';

export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'value' | 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: SizeToken;
  fullWidth?: boolean;
  value?: string | Date;
  onChange?: (value: string) => void;
  dateTime?: boolean; // datetime-local 지원
}

/**
 * DatePicker 컴포넌트
 *
 * Phase 1에서는 HTML5 date input을 사용합니다.
 */
export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  error,
  helperText,
  size = 'md',
  fullWidth = false,
  value,
  onChange,
  dateTime = false,
  className,
  ...props
}) => {
  const sizeStyles: Record<SizeToken, React.CSSProperties> = {
    xs: {
      padding: 'var(--spacing-xs) var(--spacing-sm)',
    },
    sm: {
      padding: 'var(--spacing-xs) var(--spacing-sm)',
    },
    md: {
      padding: 'var(--spacing-sm) var(--spacing-md)',
    },
    lg: {
      padding: 'var(--spacing-md) var(--spacing-lg)',
    },
    xl: {
      padding: 'var(--spacing-lg) var(--spacing-xl)',
    },
  };

  // value를 string으로 변환 (Date 객체인 경우)
  const stringValue = value instanceof Date
    ? (dateTime ? value.toISOString().slice(0, 16) : value.toISOString().split('T')[0])
    : value || '';

  const inputStyle: React.CSSProperties = {
    ...sizeStyles[size],
    border: `1px solid ${error ? 'var(--color-red-500)' : 'var(--color-gray-200)'}`,
    borderRadius: 'var(--border-radius-lg)',
    backgroundColor: 'var(--color-white)',
    color: 'var(--color-text)',
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    transition: 'all 0.2s ease',
    fontFamily: 'var(--font-family)',
    boxShadow: 'var(--shadow-sm)',
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      {label && (
        <label
          style={{
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text)',
            marginBottom: 'var(--spacing-xs)',
          }}
        >
          {label}
        </label>
      )}
      <input
        type={dateTime ? 'datetime-local' : 'date'}
        className={clsx(className)}
        style={inputStyle}
        value={stringValue}
        onChange={handleChange}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error ? 'var(--color-red-500)' : 'var(--color-primary)';
          e.currentTarget.style.boxShadow = `0 0 0 3px ${error ? 'var(--color-red-50)' : 'var(--color-primary-50)'}`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? 'var(--color-red-500)' : 'var(--color-gray-200)';
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        }}
        {...props}
      />
      {error && (
        <span
          style={{
            color: 'var(--color-red-500)',
            marginTop: 'var(--spacing-xs)',
          }}
        >
          {error}
        </span>
      )}
      {helperText && !error && (
        <span
          style={{
            color: 'var(--color-text-secondary)',
            marginTop: 'var(--spacing-xs)',
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
};

