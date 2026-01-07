/**
 * Textarea Component
 *
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않음
 * [불변 규칙] 모든 스타일은 design-system 토큰만 사용한다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { SizeToken } from '@design-system/core';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: SizeToken;
  fullWidth?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  helperText,
  size = 'md',
  fullWidth = false,
  className,
  onFocus,
  onBlur,
  placeholder,
  value,
  onChange,
  ...props
}, ref) => {
  // 라벨을 플레이스홀더로 사용
  const textareaPlaceholder = placeholder || label;
  const isEmpty = value === undefined || value === null || value === '';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const hasValue = !isEmpty;
  const [isFocused, setIsFocused] = React.useState(false);
  const isComposingRef = React.useRef(false);
  const sizeStyles: Record<SizeToken, React.CSSProperties> = {
    xs: {
      paddingTop: 'var(--spacing-xs)',
      paddingBottom: 'var(--spacing-xs)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용
    },
    sm: {
      paddingTop: 'var(--spacing-xs)',
      paddingBottom: 'var(--spacing-xs)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용
    },
    md: {
      paddingTop: 'var(--spacing-sm)',
      paddingBottom: 'var(--spacing-sm)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용
    },
    lg: {
      paddingTop: 'var(--spacing-md)',
      paddingBottom: 'var(--spacing-md)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용
    },
    xl: {
      paddingTop: 'var(--spacing-lg)',
      paddingBottom: 'var(--spacing-lg)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용
    },
  };

  const textareaStyle: React.CSSProperties = {
    ...sizeStyles[size],
    border: 'none',
    borderRadius: 'var(--border-radius-xs)',
    backgroundColor: 'var(--color-white)',
    color: 'var(--color-text)',
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    resize: 'vertical',
    transition: 'var(--transition-all)',
    fontFamily: 'var(--font-family)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 'var(--font-weight-normal)',
    lineHeight: 'var(--line-height)',
    boxSizing: 'border-box',
  };

  // 래퍼 스타일: textarea를 감싸고 사방 테두리 적용 (카드 스타일과 동일)
  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: fullWidth ? '100%' : 'auto',
    backgroundColor: 'var(--color-white)',
    border: isFocused
      ? (error ? 'var(--border-width-thin) solid var(--color-form-error)' : 'var(--border-width-thin) solid var(--color-primary)')
      : (error ? 'var(--border-width-thin) solid var(--color-form-error)' : 'var(--border-width-thin) solid var(--color-gray-200)'),
    borderRadius: 'var(--border-radius-xs)',
    boxSizing: 'border-box',
    transition: 'var(--transition-all)',
  };

  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  // React Hook Form의 onBlur와 컴포넌트의 포커스 스타일 관리 병합
  const handleFocus = React.useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(true);
    if (wrapperRef.current) {
      wrapperRef.current.style.borderColor = error ? 'var(--color-form-error)' : 'var(--color-primary)';
    }
    onFocus?.(e);
  }, [error, onFocus]);

  const handleBlur = React.useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
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
        <textarea
          ref={ref}
          className={clsx(className)}
          style={textareaStyle}
          placeholder={textareaPlaceholder}
          value={value}
        onCompositionStart={(e) => {
          isComposingRef.current = true;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          if ((import.meta as any).env?.DEV) {
            console.log('[IME][Textarea] compositionstart', {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
              name: (props as any)?.name,
              value,
              data: (e as unknown as CompositionEvent).data,
            });
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          (props as any).onCompositionStart?.(e);
        }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          if ((import.meta as any).env?.DEV) {
            console.log('[IME][Textarea] compositionend', {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
              name: (props as any)?.name,
              value,
              data: (e as unknown as CompositionEvent).data,
            });
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          (props as any).onCompositionEnd?.(e);
        }}
        onChange={(e) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          if ((import.meta as any).env?.DEV) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const nativeIsComposing = (e.nativeEvent as any)?.isComposing;
            console.log('[IME][Textarea] change', {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
              name: (props as any)?.name,
              isComposingRef: isComposingRef.current,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              nativeIsComposing,
              newValue: e.target.value,
              prevValue: value,
            });
          }
          onChange?.(e);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          (props as any).onChange?.(e);
        }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
      </div>
      {error && (
        <span
          style={{
            color: 'var(--color-form-error)', // styles.css 토큰: 폼 필드 에러 메시지 색상
            marginTop: 'var(--spacing-xs)',
            fontSize: 'var(--font-size-xxs)', // 11px - 에러 메시지
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

Textarea.displayName = 'Textarea';
