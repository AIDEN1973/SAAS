/**
 * Checkbox Component
 *
 * [불변 규칙] Atlaskit Checkbox를 래핑하여 사용합니다.
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 Atlaskit 테마를 사용합니다.
 * [불변 규칙] 터치 영역 최소 44px 보장
 */

import React from 'react';
import AKCheckbox from '@atlaskit/checkbox';

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
  checked,
  onChange,
  disabled,
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
      <AKCheckbox
        label={label}
        isChecked={checked}
        onChange={(e) => {
          if (onChange) {
            onChange(e as any);
          }
        }}
        isDisabled={disabled}
      />
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

