/**
 * Textarea Component
 *
 * [불변 규칙] Atlaskit TextArea를 래핑하여 사용합니다.
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않음
 * [불변 규칙] 모든 스타일은 Atlaskit 테마를 사용합니다.
 */

import React from 'react';
import TextArea from '@atlaskit/textarea';
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
  value,
  onChange,
  disabled,
  placeholder,
  rows,
  ...restProps
}, ref) => {
  return (
    <div>
      {label && <label>{label}</label>}
      <TextArea
        ref={ref}
        isInvalid={!!error}
        className={className}
        value={value as string}
        onChange={onChange as any}
        isDisabled={disabled}
        placeholder={placeholder}
        minimumRows={rows}
      />
      {error && (
        <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-xs)' }}>
          {error}
        </div>
      )}
      {helperText && !error && (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-xs)' }}>
          {helperText}
        </div>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';
