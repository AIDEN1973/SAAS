/**
 * Switch Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 * [불변 규칙] 터치 영역 최소 44px 보장
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
 * Switch 컴포넌트
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
          color: 'var(--color-text)',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 'var(--size-switch-width)', // styles.css 준수: 스위치 너비 토큰 사용 (접근성)
            height: 'var(--size-switch-height)', // styles.css 준수: 스위치 높이 토큰 사용
            minWidth: 'var(--size-switch-width)', // styles.css 준수: 스위치 너비 토큰 사용
            minHeight: 'var(--size-switch-height)', // styles.css 준수: 스위치 높이 토큰 사용
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
              borderRadius: 'var(--border-radius-full)', // styles.css 준수: border-radius 토큰 사용
              transition: 'background-color var(--transition-base)', // styles.css 준수: transition 토큰 사용
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 'var(--size-switch-thumb-offset)', // styles.css 준수: 스위치 썸 오프셋 토큰 사용
              left: checked
                ? `calc(var(--size-switch-width) - var(--size-switch-thumb) - var(--size-switch-thumb-offset))` // 오른쪽 끝
                : 'var(--size-switch-thumb-offset)', // 왼쪽 끝
              width: 'var(--size-switch-thumb)', // styles.css 준수: 스위치 썸 크기 토큰 사용
              height: 'var(--size-switch-thumb)', // styles.css 준수: 스위치 썸 크기 토큰 사용
              backgroundColor: 'var(--color-white)',
              borderRadius: 'var(--border-radius-full)', // styles.css 준수: border-radius 토큰 사용
              transition: 'left var(--transition-base)', // styles.css 준수: transition 토큰 사용
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
            color: 'var(--color-error)',
            marginLeft: 'var(--spacing-switch-indent)', // styles.css 준수: 스위치 들여쓰기 토큰 사용
          }}
        >
          {error}
        </span>
      )}
      {helperText && !error && (
        <span
          style={{
            color: 'var(--color-text-secondary)',
            marginLeft: 'var(--spacing-switch-indent)', // styles.css 준수: 스위치 들여쓰기 토큰 사용
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
};

