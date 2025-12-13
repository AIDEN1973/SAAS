/**
 * Select Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { SizeToken } from '@design-system/core';

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: SizeToken;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  helperText,
  size = 'md',
  fullWidth = false,
  className,
  children,
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

  const selectStyle: React.CSSProperties = {
    ...sizeStyles[size],
    border: `1px solid ${error ? 'var(--color-red-500)' : 'var(--color-gray-200)'}`,
    borderRadius: 'var(--border-radius-sm)',
    backgroundColor: 'var(--color-white)',
    color: 'var(--color-text)',
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    appearance: 'none',
    transition: 'all 0.2s ease',
    fontFamily: 'var(--font-family)',
    boxShadow: 'var(--shadow-sm)',
    paddingRight: '2.5rem', // 화살표 공간 확보
    cursor: 'pointer',
    // 브라우저 호환성을 위한 vendor prefix
    ...({
      WebkitAppearance: 'none',
      MozAppearance: 'none',
    } as React.CSSProperties),
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
      <div
        style={{
          position: 'relative',
          width: fullWidth ? '100%' : 'auto',
        }}
      >
      <select
        className={clsx(className)}
        style={selectStyle}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error ? 'var(--color-red-500)' : 'var(--color-primary)';
          e.currentTarget.style.boxShadow = `0 0 0 3px ${error ? 'var(--color-red-50)' : 'var(--color-primary-50)'}`;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? 'var(--color-red-500)' : 'var(--color-gray-200)';
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
        {...props}
      >
        {children}
      </select>
        {/* 커스텀 드롭다운 화살표 */}
        <div
          style={{
            position: 'absolute',
            right: 'var(--spacing-sm)',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            width: 0,
            height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: `6px solid ${error ? 'var(--color-red-500)' : 'var(--color-gray-500)'}`,
            transition: 'border-top-color 0.2s ease',
          }}
        />
      </div>
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
