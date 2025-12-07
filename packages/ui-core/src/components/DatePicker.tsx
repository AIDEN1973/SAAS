/**
 * DatePicker Component
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§ˆì—??Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?˜ì? ?ŠìŠµ?ˆë‹¤.
 * [ë¶ˆë? ê·œì¹™] ëª¨ë“  ?¤í??¼ì? design-system ? í°???¬ìš©?©ë‹ˆ??
 * 
 * Phase 1: ê¸°ë³¸ HTML5 date input ?¬ìš©
 * Phase 2+: ê³ ê¸‰ DatePicker ?¼ì´ë¸ŒëŸ¬ë¦??µí•© ê°€??
 */

import React from 'react';
import { clsx } from 'clsx';
import { SizeToken } from '@design-system/core';

export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'value' | 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: SizeToken;
  fullWidth?: boolean;
  value?: string | Date;
  onChange?: (value: string) => void;
  dateTime?: boolean; // datetime-local ì§€??
}

/**
 * DatePicker ì»´í¬?ŒíŠ¸
 * 
 * Phase 1?ì„œ??HTML5 date input???¬ìš©?©ë‹ˆ??
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
  ...props
}) => {
  const sizeStyles: Record<SizeToken, React.CSSProperties> = {
    xs: {
      padding: 'var(--spacing-xs) var(--spacing-sm)',
      fontSize: 'var(--font-size-xs)',
    },
    sm: {
      padding: 'var(--spacing-xs) var(--spacing-sm)',
      fontSize: 'var(--font-size-sm)',
    },
    md: {
      padding: 'var(--spacing-sm) var(--spacing-md)',
      fontSize: 'var(--font-size-base)',
    },
    lg: {
      padding: 'var(--spacing-md) var(--spacing-lg)',
      fontSize: 'var(--font-size-lg)',
    },
    xl: {
      padding: 'var(--spacing-lg) var(--spacing-xl)',
      fontSize: 'var(--font-size-xl)',
    },
  };

  // valueë¥?string?¼ë¡œ ë³€??(Date ê°ì²´??ê²½ìš°)
  const stringValue = value instanceof Date 
    ? (dateTime ? value.toISOString().slice(0, 16) : value.toISOString().split('T')[0])
    : value || '';

  const inputStyle: React.CSSProperties = {
    ...sizeStyles[size],
    border: `1px solid ${error ? 'var(--color-red-500)' : 'var(--color-gray-200)'}`,
    borderRadius: 'var(--border-radius-lg)',
    backgroundColor: 'var(--color-white)',
    color: 'var(--color-text)',
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    transition: 'all 0.2s ease',
    fontFamily: 'var(--font-family)',
    boxShadow: 'var(--shadow-sm)',
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
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
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text)',
            marginBottom: 'var(--spacing-xs)',
          }}
        >
          {label}
        </label>
      )}
      <input
        type={dateTime ? 'datetime-local' : 'date'}
        className={clsx(className)}
        style={inputStyle}
        value={stringValue}
        onChange={handleChange}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error ? 'var(--color-red-500)' : 'var(--color-primary)';
          e.currentTarget.style.boxShadow = `0 0 0 3px ${error ? 'var(--color-red-50)' : 'var(--color-primary-50)'}`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? 'var(--color-red-500)' : 'var(--color-gray-200)';
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        }}
        {...props}
      />
      {error && (
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
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
            fontSize: 'var(--font-size-sm)',
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

