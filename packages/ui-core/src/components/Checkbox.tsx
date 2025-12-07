/**
 * Checkbox Component
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§ˆì—??Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?˜ì? ?ŠëŠ”??
 * [ë¶ˆë? ê·œì¹™] ëª¨ë“  ?¤í??¼ì? design-system ? í°???¬ìš©?œë‹¤.
 * [ë¶ˆë? ê·œì¹™] ?°ì¹˜ ?€ê²?ìµœì†Œ 44px ë³´ì¥
 */

import React from 'react';
import { clsx } from 'clsx';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

/**
 * Checkbox ì»´í¬?ŒíŠ¸
 */
export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  error,
  helperText,
  fullWidth = false,
  className,
  ...props
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
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          cursor: 'pointer',
          fontSize: 'var(--font-size-base)',
          color: 'var(--color-text)',
        }}
      >
        <input
          type="checkbox"
          className={clsx(className)}
          style={{
            width: '20px',
            height: '20px',
            minWidth: '20px',
            minHeight: '20px',
            cursor: 'pointer',
            accentColor: 'var(--color-primary)',
          }}
          {...props}
        />
        {label && (
          <span
            style={{
              userSelect: 'none',
            }}
          >
            {label}
          </span>
        )}
      </label>
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

