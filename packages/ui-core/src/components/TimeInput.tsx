/**
 * TimeInput Component
 *
 * [불변 규칙] 시간 입력 전용 컴포넌트
 * [불변 규칙] 24시간제, 시, 분으로 나눠서 입력
 * [불변 규칙] HH:mm 형식 지원
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { clsx } from 'clsx';
import { SizeToken } from '@design-system/core';
import { Clock, ChevronDown } from 'lucide-react';

export interface TimeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: SizeToken;
  fullWidth?: boolean;
  showInlineLabelWhenHasValue?: boolean;
}

export const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(({
  label,
  error,
  helperText,
  size = 'md',
  fullWidth = false,
  className,
  onFocus,
  onBlur,
  placeholder,
  value: valueProp,
  onChange,
  showInlineLabelWhenHasValue = true,
  ...props
}, ref) => {
  const inputPlaceholder = placeholder || label;
  const [isFocused, setIsFocused] = React.useState<boolean>(false);
  const [showDropdown, setShowDropdown] = React.useState<boolean>(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = React.useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  const isControlled = valueProp !== undefined;

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

  const value = valueProp ?? '';
  const isEmpty = value === undefined || value === null || value === '';

  // HH:mm 형식을 24시간제 시, 분으로 파싱
  const parseTime = React.useCallback((timeStr: string) => {
    if (!timeStr || typeof timeStr !== 'string') return { hour: 14, minute: 0 };

    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return { hour: 14, minute: 0 };

    const hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);

    return { hour, minute };
  }, []);

  // 시, 분을 HH:mm 형식으로 변환
  const formatTime = React.useCallback((hour: number, minute: number) => {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }, []);

  const currentTime = parseTime(String(value));
  const [hour, setHour] = React.useState(currentTime.hour);
  const [minute, setMinute] = React.useState(currentTime.minute);

  // value가 변경되면 내부 상태 업데이트
  React.useEffect(() => {
    const parsed = parseTime(String(value));
    setHour(parsed.hour);
    setMinute(parsed.minute);
  }, [value, parseTime]);

  // 시간 옵션 생성 (0~23시)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  // 드롭다운 외부 클릭 감지
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown]);

  const handleTimeChange = React.useCallback((newHour: number, newMinute: number) => {
    const formattedTime = formatTime(newHour, newMinute);

    if (onChange && inputRef.current) {
      const event = {
        target: { ...inputRef.current, value: formattedTime },
        currentTarget: { ...inputRef.current, value: formattedTime },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(event);
    }
  }, [onChange, formatTime]);

  const handleHourChange = (newHour: number) => {
    setHour(newHour);
    handleTimeChange(newHour, minute);
  };

  const handleMinuteChange = (newMinute: number) => {
    setMinute(newMinute);
    handleTimeChange(hour, newMinute);
  };

  const handleIconClick = React.useCallback(() => {
    if (!props.disabled) {
      if (!showDropdown && wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
      setShowDropdown(!showDropdown);
    }
  }, [props.disabled, showDropdown]);

  const displayValue = isEmpty ? '' : `${String(hour).padStart(2, '0')}시 ${String(minute).padStart(2, '0')}분`;

  const dropdownContent = showDropdown && (
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        backgroundColor: 'var(--color-white)',
        border: 'var(--border-width-thin) solid var(--color-gray-200)',
        borderRadius: 'var(--border-radius-md)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 9999,
        padding: 'var(--spacing-md)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)' }}>
        <style>
          {`
            .time-scroll-container::-webkit-scrollbar {
              display: none;
            }
          `}
        </style>
        {/* 시 */}
        <div style={{ borderRight: 'var(--border-width-thin) solid var(--color-gray-200)', paddingRight: 'var(--spacing-sm)' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
            시
          </div>
          <div
            className="time-scroll-container"
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {hours.map((h) => (
              <div
                key={h}
                onClick={() => handleHourChange(h)}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  cursor: 'pointer',
                  borderRadius: 'var(--border-radius-xs)',
                  transition: 'var(--transition-all)',
                  backgroundColor: hour === h ? 'var(--color-primary-50)' : 'transparent',
                  color: hour === h ? 'var(--color-primary)' : 'var(--color-text)',
                  fontWeight: hour === h ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
                  textAlign: 'center',
                }}
                onMouseEnter={(e) => {
                  if (hour !== h) {
                    e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (hour !== h) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {String(h).padStart(2, '0')}
              </div>
            ))}
          </div>
        </div>

        {/* 분 */}
        <div style={{ paddingLeft: 'var(--spacing-sm)' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
            분
          </div>
          <div
            className="time-scroll-container"
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {minutes.map((m) => (
              <div
                key={m}
                onClick={() => handleMinuteChange(m)}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  cursor: 'pointer',
                  borderRadius: 'var(--border-radius-xs)',
                  transition: 'var(--transition-all)',
                  backgroundColor: minute === m ? 'var(--color-primary-50)' : 'transparent',
                  color: minute === m ? 'var(--color-primary)' : 'var(--color-text)',
                  fontWeight: minute === m ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
                  textAlign: 'center',
                }}
                onMouseEnter={(e) => {
                  if (minute !== m) {
                    e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (minute !== m) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {String(m).padStart(2, '0')}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      <div
        ref={wrapperRef}
        style={{
          position: 'relative',
          width: fullWidth ? '100%' : 'auto',
          backgroundColor: props.disabled ? 'var(--color-gray-100)' : 'var(--color-white)',
          border: props.disabled
            ? 'var(--border-width-thin) solid var(--color-gray-200)'
            : isFocused || showDropdown
            ? (error ? 'var(--border-width-thin) solid var(--color-form-error)' : 'var(--border-width-thin) solid var(--color-primary)')
            : (error ? 'var(--border-width-thin) solid var(--color-form-error)' : 'var(--border-width-thin) solid var(--color-gray-200)'),
          borderRadius: 'var(--border-radius-xs)',
          boxSizing: 'border-box',
          transition: 'var(--transition-all)',
          opacity: props.disabled ? 0.6 : 1,
        }}
      >
        {/* Text input for direct time entry */}
        <input
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
            }
          }}
          type="text"
          placeholder={inputPlaceholder}
          value={value}
          onChange={onChange}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          disabled={props.disabled}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-form-horizontal-left)',
            paddingRight: 'calc(var(--spacing-sm) + 24px)',
            border: 'none',
            outline: 'none',
            width: '100%',
            backgroundColor: 'transparent',
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-normal)',
            lineHeight: 'var(--line-height)',
            color: props.disabled ? 'var(--color-text-disabled)' : 'var(--color-text)',
            cursor: props.disabled ? 'not-allowed' : 'text',
            boxSizing: 'border-box',
          }}
          {...props}
        />

        {/* 시계 아이콘 */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleIconClick();
          }}
          style={{
            position: 'absolute',
            right: 'var(--spacing-sm)',
            top: '50%',
            transform: 'translateY(-50%)',
            cursor: props.disabled ? 'not-allowed' : 'pointer',
            color: props.disabled ? 'var(--color-text-disabled)' : 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Clock size={16} />
        </div>
      </div>
      {helperText && !error && (
        <div
          style={{
            marginTop: 'var(--spacing-xs)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {helperText}
        </div>
      )}
      {error && (
        <div
          style={{
            marginTop: 'var(--spacing-xs)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-form-error)',
          }}
        >
          {error}
        </div>
      )}
      {/* Portal로 드롭다운을 document.body에 렌더링 */}
      {typeof document !== 'undefined' && dropdownContent && ReactDOM.createPortal(
        dropdownContent,
        document.body
      )}
    </div>
  );
});

TimeInput.displayName = 'TimeInput';
