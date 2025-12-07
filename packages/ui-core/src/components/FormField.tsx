/**
 * FormField Component
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§ˆì—??Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?˜ì? ?ŠëŠ”??
 * [ë¶ˆë? ê·œì¹™] ëª¨ë“  ?¤í??¼ì? design-system ? í°???¬ìš©?œë‹¤.
 */

import React from 'react';
import { clsx } from 'clsx';

export interface FormFieldProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * FormField ì»´í¬?ŒíŠ¸
 * 
 * ???„ë“œë¥?ê°ì‹¸???˜í¼ ì»´í¬?ŒíŠ¸
 */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  helperText,
  required = false,
  children,
  className,
}) => {
  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xs)',
        width: '100%',
      }}
    >
      {label && (
        <label
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text)',
          }}
        >
          {label}
          {required && (
            <span
              style={{
                color: 'var(--color-error)',
                marginLeft: 'var(--spacing-xs)',
              }}
            >
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error && (
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-error)',
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
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
};

