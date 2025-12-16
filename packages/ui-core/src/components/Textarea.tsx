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
  ...props
}, ref) => {
  // 라벨을 플레이스홀더로 사용
  const textareaPlaceholder = placeholder || label;
  const isEmpty = value === undefined || value === null || value === '';
  const hasValue = !isEmpty;
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
    borderBottom: `var(--border-width-form-bottom) solid transparent`, // styles.css 토큰: 레이아웃 유지를 위해 항상 2px, 색상은 투명
    borderRadius: 0,
    backgroundColor: 'var(--color-white)', // styles.css 토큰: 폼 필드 배경색
    color: 'var(--color-text)', // styles.css 토큰: 폼 필드 텍스트 색상
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    resize: 'vertical',
    transition: 'border-color var(--transition-base), box-shadow var(--transition-base)', // styles.css 토큰: transition
    fontFamily: 'var(--font-family)', // styles.css 토큰: 폰트 패밀리
    fontSize: 'var(--font-size-base)', // styles.css 토큰: 폼 필드 폰트 사이즈
    fontWeight: 'var(--font-weight-normal)', // styles.css 토큰: 폼 필드 폰트 웨이트
    lineHeight: 'var(--line-height)', // styles.css 토큰: 폼 필드 라인 높이
    boxShadow: hasValue
      ? (error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)') // 값이 있으면 2px 테두리
      : (error ? 'var(--shadow-form-bottom-default-error)' : 'var(--shadow-form-bottom-default)'), // 값이 없으면 1px 테두리
  };

  // React Hook Form의 onBlur와 컴포넌트의 포커스 스타일 관리 병합 (styles.css 토큰 사용)
  const handleFocus = React.useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.currentTarget.style.borderBottomColor = 'transparent'; // styles.css 토큰: 항상 transparent 유지 (레이아웃 고정)
    e.currentTarget.style.boxShadow = error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)'; // styles.css 토큰: 포커스 시 항상 시각적 2px 테두리
    onFocus?.(e);
  }, [error, onFocus]);

  const handleBlur = React.useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.currentTarget.style.borderBottomColor = 'transparent'; // styles.css 토큰: 투명으로 변경
    // 값이 있으면 2px 유지, 값이 없으면 1px로 복원
    e.currentTarget.style.boxShadow = hasValue
      ? (error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)')
      : (error ? 'var(--shadow-form-bottom-default-error)' : 'var(--shadow-form-bottom-default)');
    onBlur?.(e);
  }, [error, onBlur, hasValue]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      <textarea
        ref={ref}
        className={clsx(className)}
        style={textareaStyle}
        placeholder={textareaPlaceholder}
        value={value}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
      {error && (
        <span
          style={{
            color: 'var(--color-form-error)', // styles.css 토큰: 폼 필드 에러 메시지 색상
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

Textarea.displayName = 'Textarea';
