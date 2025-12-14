/**
 * Input Component
 *
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용한다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { SizeToken } from '@design-system/core';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: SizeToken;
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  size = 'md',
  fullWidth = false,
  className,
  onFocus,
  onBlur,
  ...props
}, ref) => {
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

  const inputStyle: React.CSSProperties = {
    ...sizeStyles[size],
    border: `var(--border-width-thin) solid ${error ? 'var(--color-red-500)' : 'var(--color-gray-200)'}`, // styles.css 준수: border-width 토큰 사용
    borderRadius: 'var(--border-radius-sm)',
    backgroundColor: 'var(--color-white)',
    color: 'var(--color-text)',
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    transition: 'var(--transition-all)', // styles.css 준수: transition 토큰 사용
    fontFamily: 'var(--font-family)',
    fontSize: 'var(--font-size-base)', // Select/DatePicker와 동일한 폰트 사이즈 (일관성)
    lineHeight: 'var(--line-height)', // Select/DatePicker와 동일한 line-height (일관성)
    boxSizing: 'border-box', // Select/DatePicker와 동일한 box-sizing (일관성)
    boxShadow: 'var(--shadow-sm)',
  };

  // React Hook Form의 onBlur와 컴포넌트의 포커스 스타일 관리 병합
  const handleFocus = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = error ? 'var(--color-red-500)' : 'var(--color-primary)';
    // styles.css 준수: focus-ring-width 토큰 사용 (2px)
    e.currentTarget.style.boxShadow = `0 0 0 var(--focus-ring-width) ${error ? 'var(--color-red-50)' : 'var(--color-primary-50)'}`;
    // transform 제거: 포커스 시 위로 올라가는 효과 제거 (유아이 문서 준수)
    onFocus?.(e);
  }, [error, onFocus]);

  const handleBlur = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = error ? 'var(--color-red-500)' : 'var(--color-gray-200)';
    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
    // transform 제거: 포커스 해제 시 transform 효과 제거 (유아이 문서 준수)
    onBlur?.(e);
  }, [error, onBlur]);

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
        ref={ref}
        className={clsx(className)}
        style={inputStyle}
        onFocus={handleFocus}
        onBlur={handleBlur}
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
});
