/**
 * DateInput Component (Hybrid Direct Input + Calendar Picker)
 *
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 * [불변 규칙] 날짜 입력은 @lib/normalization의 parseBirthDate, formatDateInput 사용
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { SizeToken } from '@design-system/core';
import { DatePicker } from './DatePicker';
import { parseBirthDate, formatDateInput } from '@lib/normalization';

export interface DateInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  error?: string;
  fullWidth?: boolean;
  size?: SizeToken;
}

/**
 * DateInput 컴포넌트
 * - 직접 텍스트 입력 지원 (070826, 20070826, 07-08-26, 07.08.26 등)
 * - 캘린더 선택 지원
 * - 자동 포맷팅 (하이픈 자동 삽입)
 */
export function DateInput({
  value = '',
  onChange,
  onBlur,
  placeholder = '생년월일을 입력하세요 (예: 070826)',
  disabled = false,
  className = '',
  label,
  error,
  fullWidth = false,
  size = 'sm',
}: DateInputProps) {
  // Size를 CSS Variables로 매핑 (Button, Select와 동일한 높이 보장)
  const sizeStyles: Record<SizeToken, React.CSSProperties> = {
    xs: { height: 'var(--height-control-xs)' },
    sm: { height: 'var(--height-control-sm)' },
    md: { height: 'var(--height-control-md)' },
    lg: { height: 'var(--height-control-lg)' },
    xl: { height: 'var(--height-control-xl)' },
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  // value prop이 변경되면 inputValue 동기화
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // 텍스트 입력 시 자동 포맷팅
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatDateInput(rawValue);
    setInputValue(formatted);
  }, []);

  // 입력 완료 시 파싱하여 정규화된 값 전달
  const handleInputBlur = useCallback(() => {
    const parsed = parseBirthDate(inputValue);
    if (parsed) {
      onChange?.(parsed);
      setInputValue(parsed); // 정규화된 형식으로 표시
    } else if (inputValue.trim()) {
      // 유효하지 않은 입력이지만 값이 있으면 그대로 유지 (사용자가 수정할 수 있도록)
      // onChange는 호출하지 않음 (유효한 값만 전달)
    } else {
      // 빈 값이면 초기화
      setInputValue('');
      onChange?.('');
    }
    onBlur?.();
  }, [inputValue, onChange, onBlur]);

  // 캘린더 버튼 클릭
  const handleCalendarClick = useCallback(() => {
    if (disabled) return;
    setShowPicker(true);
  }, [disabled]);

  // 캘린더에서 날짜 선택
  const handleDatePickerChange = useCallback((date: string) => {
    const parsed = parseBirthDate(date);
    if (parsed) {
      setInputValue(parsed);
      onChange?.(parsed);
    }
    setShowPicker(false);
  }, [onChange]);

  // 캘린더 닫기
  const handleDatePickerBlur = useCallback(() => {
    setShowPicker(false);
  }, []);

  const borderColor = error
    ? 'var(--color-form-error)'
    : 'var(--color-gray-200)';

  const focusBorderColor = error
    ? 'var(--color-form-error)'
    : 'var(--color-primary)';

  if (showPicker) {
    return (
      <DatePicker
        label={label}
        value={value}
        onChange={handleDatePickerChange}
        onBlur={handleDatePickerBlur}
        disabled={disabled}
        error={error}
        fullWidth={fullWidth}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-xs)',
          width: '100%',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          style={{
            flex: 1,
            minWidth: 0, // flex item이 축소될 수 있도록 함
            ...sizeStyles[size],
            paddingLeft: 'var(--spacing-form-horizontal-left)',
            paddingRight: 'var(--spacing-form-horizontal-right)',
            border: `var(--border-width-thin) solid ${borderColor}`,
            borderRadius: 'var(--border-radius-xs)',
            backgroundColor: disabled ? 'var(--color-form-disabled-bg)' : 'var(--color-white)',
            color: disabled ? 'var(--color-form-disabled-text)' : 'var(--color-text)',
            outline: 'none',
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-normal)',
            // [불변 규칙] lineHeight: 1로 설정하여 height 기반 정렬 (Button, Select와 동일)
            lineHeight: 1,
            transition: 'var(--transition-all)',
            cursor: disabled ? 'not-allowed' : 'text',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = focusBorderColor;
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = borderColor;
          }}
        />
        <button
          type="button"
          onClick={handleCalendarClick}
          disabled={disabled}
          aria-label="달력 열기"
          style={{
            height: sizeStyles[size].height, // input과 동일한 높이 토큰 사용
            padding: 'var(--spacing-sm)',
            border: 'var(--border-width-thin) solid var(--color-primary)',
            borderRadius: 'var(--border-radius-xs)',
            backgroundColor: disabled ? 'var(--color-form-disabled-bg)' : 'var(--color-white)',
            color: disabled ? 'var(--color-form-disabled-text)' : 'var(--color-primary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'var(--transition-all)',
            outline: 'none',
            boxSizing: 'border-box',
            aspectRatio: 'var(--aspect-ratio-square)', // 정사각형
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)';
              e.currentTarget.style.color = 'var(--color-white)';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = 'var(--color-white)';
              e.currentTarget.style.color = 'var(--color-primary)';
            }
          }}
        >
          <Calendar size={16} />
        </button>
      </div>
      {error && (
        <span
          style={{
            color: 'var(--color-form-error)',
            marginTop: 'var(--spacing-xs)',
            fontSize: 'var(--font-size-xxs)',
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
