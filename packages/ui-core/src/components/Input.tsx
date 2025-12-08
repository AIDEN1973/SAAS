/**
 * Input Component
 *
 * [불변 규칙] Atlaskit TextField를 래핑하여 사용합니다.
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 * [불변 규칙] 모든 스타일은 Atlaskit 테마를 사용합니다.
 */

import React from 'react';
import TextField from '@atlaskit/textfield';
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
  type,
  ...props
}, ref) => {
  return (
    <div>
      <TextField
        ref={ref}
        label={label}
        isInvalid={!!error}
        type={type}
        className={className}
        {...props}
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
