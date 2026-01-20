/**
 * AttendanceCheckbox Component
 *
 * 출석 체크박스 컴포넌트 - 체크 시 현재 시각 자동 입력
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 */

import React, { useCallback } from 'react';
import { Check, Smartphone } from 'lucide-react';
import { toKST } from '@lib/date-utils';
import { LAYOUT_SIZES } from './constants';
import type { AttendanceCheckboxProps } from './types';

export const AttendanceCheckbox: React.FC<AttendanceCheckboxProps> = ({
  checked,
  time,
  onChange,
  disabled = false,
  isKiosk = false,
  label,
}) => {
  // 체크박스 클릭 핸들러
  const handleCheckboxClick = useCallback(() => {
    if (disabled) return;

    if (checked) {
      // 체크 해제 시 시간도 제거
      onChange(false, undefined);
    } else {
      // 체크 시 현재 시각 자동 입력
      const currentTime = toKST().format('HH:mm');
      onChange(true, currentTime);
    }
  }, [checked, disabled, onChange]);

  // 시간 변경 핸들러
  const handleTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTime = e.target.value;
      if (!newTime) {
        // 시간 삭제 시 체크도 해제
        onChange(false, undefined);
      } else {
        // 시간 변경 시 체크 유지
        onChange(true, newTime);
      }
    },
    [onChange]
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs)',
      }}
    >
      {/* 체크박스 */}
      <button
        type="button"
        onClick={handleCheckboxClick}
        disabled={disabled}
        aria-checked={checked}
        aria-label={label || '출석 체크'}
        style={{
          width: 'var(--size-checkbox)',
          height: 'var(--size-checkbox)',
          minWidth: 'var(--size-checkbox)',
          minHeight: 'var(--size-checkbox)',
          borderRadius: 'var(--border-radius-sm)',
          border: `var(--border-width-thin) solid ${
            checked
              ? isKiosk
                ? 'var(--color-success)'
                : 'var(--color-primary)'
              : 'var(--color-border)'
          }`,
          backgroundColor: checked
            ? isKiosk
              ? 'var(--color-success)'
              : 'var(--color-primary)'
            : 'var(--color-bg-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 'var(--opacity-disabled)' : 'var(--opacity-full)',
          transition: 'all var(--transition-fast)',
          padding: 0,
        }}
      >
        {checked && (
          <Check
            size={14}
            style={{
              color: 'var(--color-white)',
              strokeWidth: 3,
            }}
          />
        )}
      </button>

      {/* 시간 입력 */}
      <input
        type="time"
        value={time || ''}
        onChange={handleTimeChange}
        disabled={disabled}
        style={{
          padding: 'var(--spacing-2xs) var(--spacing-xs)',
          border: `var(--border-width-thin) solid ${
            isKiosk ? 'var(--color-success-light)' : 'var(--color-border)'
          }`,
          borderRadius: 'var(--border-radius-sm)',
          fontSize: 'var(--font-size-sm)',
          backgroundColor: isKiosk
            ? 'var(--color-success-50)'
            : 'var(--color-bg-primary)',
          color: 'var(--color-text-primary)',
          width: `${LAYOUT_SIZES.TIME_INPUT_WIDTH}px`,
          cursor: disabled ? 'not-allowed' : 'text',
          opacity: disabled ? 'var(--opacity-disabled)' : 'var(--opacity-full)',
        }}
      />

      {/* 키오스크 아이콘 */}
      {isKiosk && (
        <Smartphone
          size={14}
          style={{
            color: 'var(--color-success)',
            flexShrink: 0,
          }}
        />
      )}
    </div>
  );
};
