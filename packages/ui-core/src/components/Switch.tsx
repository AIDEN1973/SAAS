/**
 * Switch Component
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§ˆì—??Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?˜ì? ?ŠëŠ”??
 * [ë¶ˆë? ê·œì¹™] ëª¨ë“  ?¤í??¼ì? design-system ? í°???¬ìš©?œë‹¤.
 * [ë¶ˆë? ê·œì¹™] ?°ì¹˜ ?€ê²?ìµœì†Œ 44px ë³´ì¥
 */

import React from 'react';
import { clsx } from 'clsx';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

/**
 * Switch ì»´í¬?ŒíŠ¸
 */
export const Switch: React.FC<SwitchProps> = ({
  label,
  error,
  helperText,
  fullWidth = false,
  className,
  checked,
  onChange,
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
        <div
          style={{
            position: 'relative',
            width: '44px',
            height: '24px',
            minWidth: '44px',
            minHeight: '24px',
          }}
        >
          <input
            type="checkbox"
            role="switch"
            className={clsx(className)}
            checked={checked}
            onChange={onChange}
            style={{
              position: 'absolute',
              opacity: 0,
              width: '100%',
              height: '100%',
              margin: 0,
              cursor: 'pointer',
            }}
            {...props}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-gray-300)',
              borderRadius: '12px',
              transition: 'background-color 0.2s ease',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '2px',
              left: checked ? '22px' : '2px',
              width: '20px',
              height: '20px',
              backgroundColor: 'var(--color-white)',
              borderRadius: '50%',
              transition: 'left 0.2s ease',
              boxShadow: 'var(--shadow-sm)',
              pointerEvents: 'none',
            }}
          />
        </div>
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
            marginLeft: '52px',
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
            marginLeft: '52px',
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
};

