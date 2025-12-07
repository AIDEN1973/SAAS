/**
 * Textarea Component
 * 
 * [Î∂àÎ? Í∑úÏπô] ?§ÌÇ§ÎßàÏóê??Tailwind ?¥Îûò?§Î? ÏßÅÏ†ë ?¨Ïö©?òÏ? ?äÎäî??
 * [Î∂àÎ? Í∑úÏπô] Î™®Îì† ?§Ì??ºÏ? design-system ?†ÌÅ∞???¨Ïö©?úÎã§.
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

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  helperText,
  size = 'md',
  fullWidth = false,
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

  const textareaStyle: React.CSSProperties = {
    ...sizeStyles[size],
    border: `1px solid ${error ? 'var(--color-red-500)' : 'var(--color-gray-300)'}`,
    borderRadius: 'var(--border-radius-lg)',
    backgroundColor: 'var(--color-white)',
    color: 'var(--color-text)',
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    resize: 'vertical',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    fontFamily: 'var(--font-family)',
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
      <textarea
        className={clsx(className)}
        style={textareaStyle}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error ? 'var(--color-red-500)' : 'var(--color-primary)';
          e.currentTarget.style.boxShadow = `0 0 0 2px ${error ? 'var(--color-red-50)' : 'var(--color-primary-50)'}`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? 'var(--color-red-500)' : 'var(--color-gray-300)';
          e.currentTarget.style.boxShadow = 'none';
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
