/**
 * Radio Component
 *
 * [불변 규칙] Atlaskit Radio를 래핑하여 사용합니다.
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 Atlaskit 테마를 사용합니다.
 * [불변 규칙] 터치 영역 최소 44px 보장
 */

import React from 'react';
import { Radio as AKRadio } from '@atlaskit/radio';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

/**
 * Radio 컴포넌트
 *
 * Atlaskit Radio를 래핑하여 사용합니다.
 */
export const Radio: React.FC<RadioProps> = ({
  label,
  error,
  helperText,
  fullWidth = false,
  className,
  checked,
  value,
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
      <AKRadio
        label={label}
        value={String(value || '')}
        isChecked={checked}
        onChange={onChange}
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

