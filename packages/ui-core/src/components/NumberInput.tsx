/**
 * NumberInput Component
 *
 * [불변 규칙] 숫자 입력 전용 컴포넌트
 * [불변 규칙] 브라우저 기본 증감 화살표 제거
 * [불변 규칙] 단위 표시 지원 (예: "명", "개" 등)
 */

import React from 'react';
import { clsx } from 'clsx';
import { SizeToken } from '@design-system/core';

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: SizeToken;
  fullWidth?: boolean;
  unit?: string; // 단위 표시 (예: "명", "개")
  showInlineLabelWhenHasValue?: boolean;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(({
  label,
  error,
  helperText,
  size = 'md',
  fullWidth = false,
  className,
  onFocus,
  onBlur,
  placeholder,
  value: valueProp,
  onChange,
  unit,
  showInlineLabelWhenHasValue = true,
  ...props
}, ref) => {
  const inputPlaceholder = placeholder || label;
  const [isFocused, setIsFocused] = React.useState<boolean>(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const isControlled = valueProp !== undefined;

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

  const value = valueProp ?? '';
  const isEmpty = value === undefined || value === null || value === '';

  // [불변 규칙] 명시적 height 사용으로 Button/Select와 높이 일관성 유지 (SSOT)
  const sizeStyles: Record<SizeToken, React.CSSProperties> = {
    xs: {
      height: 'var(--height-control-xs)',
      paddingLeft: 'var(--spacing-form-horizontal-left)',
      paddingRight: unit ? 'var(--spacing-xl)' : 'var(--spacing-form-horizontal-right)',
    },
    sm: {
      height: 'var(--height-control-sm)',
      paddingLeft: 'var(--spacing-form-horizontal-left)',
      paddingRight: unit ? 'var(--spacing-xl)' : 'var(--spacing-form-horizontal-right)',
    },
    md: {
      height: 'var(--height-control-md)',
      paddingLeft: 'var(--spacing-form-horizontal-left)',
      paddingRight: unit ? 'var(--spacing-xl)' : 'var(--spacing-form-horizontal-right)',
    },
    lg: {
      height: 'var(--height-control-lg)',
      paddingLeft: 'var(--spacing-form-horizontal-left)',
      paddingRight: unit ? 'var(--spacing-xl)' : 'var(--spacing-form-horizontal-right)',
    },
    xl: {
      height: 'var(--height-control-xl)',
      paddingLeft: 'var(--spacing-form-horizontal-left)',
      paddingRight: unit ? 'var(--spacing-xl)' : 'var(--spacing-form-horizontal-right)',
    },
  };

  const inputStyle: React.CSSProperties = {
    height: '100%', // wrapper의 height를 채움
    paddingLeft: sizeStyles[size].paddingLeft,
    paddingRight: sizeStyles[size].paddingRight,
    border: 'none',
    borderRadius: 'var(--border-radius-xs)',
    backgroundColor: props.disabled ? 'var(--color-gray-100)' : 'var(--color-white)',
    color: props.disabled ? 'var(--color-text-disabled)' : 'var(--color-text)',
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    transition: 'var(--transition-all)',
    fontFamily: 'var(--font-family)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 'var(--font-weight-normal)',
    // [불변 규칙] lineHeight: 1로 설정하여 height 기반 정렬 (Button, Select와 동일)
    lineHeight: 1,
    boxSizing: 'border-box',
    cursor: props.disabled ? 'not-allowed' : 'text',
  };

  // [불변 규칙] wrapper에 height 적용 + boxSizing: border-box로 border 포함 높이 계산
  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: fullWidth ? '100%' : 'auto',
    height: sizeStyles[size].height, // wrapper에 height 적용
    backgroundColor: props.disabled ? 'var(--color-gray-100)' : 'var(--color-white)',
    border: props.disabled
      ? 'var(--border-width-thin) solid var(--color-gray-200)'
      : isFocused
      ? (error ? 'var(--border-width-thin) solid var(--color-form-error)' : 'var(--border-width-thin) solid var(--color-primary)')
      : (error ? 'var(--border-width-thin) solid var(--color-form-error)' : 'var(--border-width-thin) solid var(--color-gray-200)'),
    borderRadius: 'var(--border-radius-xs)',
    boxSizing: 'border-box',
    transition: 'var(--transition-all)',
    opacity: props.disabled ? 0.6 : 1,
  };

  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  const handleFocus = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (wrapperRef.current) {
      wrapperRef.current.style.borderColor = error ? 'var(--color-form-error)' : 'var(--color-primary)';
    }
    onFocus?.(e);
  }, [error, onFocus]);

  const handleBlur = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (wrapperRef.current) {
      wrapperRef.current.style.borderColor = error ? 'var(--color-form-error)' : 'var(--color-gray-200)';
    }
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
      <div ref={wrapperRef} style={wrapperStyle}>
        <input
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
            }
          }}
          type="number"
          className={clsx(className)}
          style={{
            ...inputStyle,
            // 브라우저 기본 숫자 증감 화살표 제거
            MozAppearance: 'textfield',
            WebkitAppearance: 'none',
          }}
          placeholder=""
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {/* 숫자 증감 화살표 제거를 위한 CSS */}
        <style>
          {`
            input[type="number"]::-webkit-inner-spin-button,
            input[type="number"]::-webkit-outer-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
          `}
        </style>
        {/* 단위 표시 */}
        {unit && !isEmpty && (
          <div
            style={{
              position: 'absolute',
              right: 'var(--spacing-sm)',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: 'var(--color-text)',
              fontSize: 'var(--font-size-base)',
              fontFamily: 'var(--font-family)',
              fontWeight: 'var(--font-weight-normal)',
              lineHeight: 'var(--line-height)',
            }}
          >
            {unit}
          </div>
        )}
        {/* Placeholder */}
        {isEmpty && !isFocused && inputPlaceholder && (
          <div
            style={{
              position: 'absolute',
              left: sizeStyles[size].paddingLeft as string,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--font-size-base)',
              fontFamily: 'var(--font-family)',
              fontWeight: 'var(--font-weight-normal)',
              lineHeight: 'var(--line-height)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {inputPlaceholder}
          </div>
        )}
      </div>
      {helperText && !error && (
        <div
          style={{
            marginTop: 'var(--spacing-xs)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {helperText}
        </div>
      )}
      {error && (
        <div
          style={{
            marginTop: 'var(--spacing-xs)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-form-error)',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
});

NumberInput.displayName = 'NumberInput';
