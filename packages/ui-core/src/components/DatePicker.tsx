/**
 * DatePicker Component
 *
 * [불변 규칙] Atlaskit DateTimePicker를 래핑하여 사용합니다.
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 Atlaskit 테마를 사용합니다.
 */

import React from 'react';
import { DatePicker as AKDatePicker } from '@atlaskit/datetime-picker';
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
 * Atlaskit DateTimePicker를 래핑하여 사용합니다.
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
  disabled,
  ...props
}) => {
  // value를 Date 객체로 변환
  const dateValue = React.useMemo(() => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    return new Date(value);
  }, [value]);

  const handleChange = (value: string) => {
    if (onChange) {
      onChange(value);
    }
  };

  return (
    <div>
      <div className={className}>
        <AKDatePicker
          label={label}
          isInvalid={!!error}
          isDisabled={disabled}
          value={dateValue?.toISOString()}
          onChange={handleChange}
          dateFormat={dateTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD'}
        />
      </div>
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
};

