/**
 * TimeInput Component
 *
 * [불변 규칙] 시간 입력 전용 컴포넌트
 * [불변 규칙] 12시간제 (오전/오후) 직접 입력 방식
 * [불변 규칙] HH:mm 형식 지원 (내부적으로 24시간제 저장)
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';
import { SizeToken } from '@design-system/core';

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
  const [dropdownPosition, setDropdownPosition] = React.useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const hiddenInputRef = React.useRef<HTMLInputElement | null>(null);
  const hourInputRef = React.useRef<HTMLInputElement | null>(null);
  const minuteInputRef = React.useRef<HTMLInputElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);

  // 입력 버퍼 (연속 입력 추적용)
  const hourBufferRef = React.useRef<string>('');
  const minuteBufferRef = React.useRef<string>('');
  const hourTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const minuteTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useImperativeHandle(ref, () => hiddenInputRef.current as HTMLInputElement, []);

  const value = valueProp ?? '';
  const isEmpty = value === undefined || value === null || value === '';

  // [불변 규칙] 명시적 height 사용으로 Button/Select와 높이 일관성 유지 (SSOT)
  const sizeStyles: Record<SizeToken, React.CSSProperties> = {
    xs: { height: 'var(--height-control-xs)' },
    sm: { height: 'var(--height-control-sm)' },
    md: { height: 'var(--height-control-md)' },
    lg: { height: 'var(--height-control-lg)' },
    xl: { height: 'var(--height-control-xl)' },
  };

  // 현재 시간 가져오기
  const getCurrentTime = React.useCallback(() => {
    const now = new Date();
    return { hour: now.getHours(), minute: now.getMinutes() };
  }, []);

  // HH:mm 형식을 24시간제 시, 분으로 파싱
  const parseTime = React.useCallback((timeStr: string) => {
    if (!timeStr || typeof timeStr !== 'string') {
      return getCurrentTime();
    }

    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      return getCurrentTime();
    }

    const hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);

    return { hour, minute };
  }, [getCurrentTime]);

  // 시, 분을 HH:mm 형식으로 변환
  const formatTime = React.useCallback((hour: number, minute: number) => {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }, []);

  const currentTime = parseTime(String(value));
  const [hour24, setHour24] = React.useState(currentTime.hour);
  const [minute, setMinute] = React.useState(currentTime.minute);
  const [period, setPeriod] = React.useState<'오전' | '오후'>(currentTime.hour < 12 ? '오전' : '오후');

  // value가 변경되면 내부 상태 업데이트
  React.useEffect(() => {
    const parsed = parseTime(String(value));
    setHour24(parsed.hour);
    setMinute(parsed.minute);
    setPeriod(parsed.hour < 12 ? '오전' : '오후');
  }, [value, parseTime]);

  // 24시간제 시간을 12시간제로 변환
  const to12Hour = (hour24: number): number => {
    if (hour24 === 0 || hour24 === 12) return 12;
    return hour24 > 12 ? hour24 - 12 : hour24;
  };

  // 12시간제 시간을 24시간제로 변환
  const to24Hour = (hour12: number, isPm: boolean): number => {
    if (hour12 === 12) {
      return isPm ? 12 : 0;
    }
    return isPm ? hour12 + 12 : hour12;
  };

  // 표시용 12시간제 시간
  const displayHour = to12Hour(hour24);

  // 드롭다운 위치 계산 및 표시
  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (props.disabled) return;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
    setShowDropdown(prev => !prev);
  };

  // 드롭다운 외부 클릭 시 닫기
  React.useEffect(() => {
    if (!showDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        setShowDropdown(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    };

    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showDropdown]);

  // 드롭다운에서 오전/오후 선택
  const handleDropdownPeriodSelect = (newPeriod: '오전' | '오후') => {
    setPeriod(newPeriod);
    const newHour24 = to24Hour(displayHour, newPeriod === '오후');
    setHour24(newHour24);
    handleTimeChange(newHour24, minute);
  };

  // 드롭다운에서 시간 선택
  const handleDropdownHourSelect = (hour12: number) => {
    const newHour24 = to24Hour(hour12, period === '오후');
    setHour24(newHour24);
    handleTimeChange(newHour24, minute);
  };

  // 드롭다운에서 분 선택
  const handleDropdownMinuteSelect = (newMinute: number) => {
    setMinute(newMinute);
    handleTimeChange(hour24, newMinute);
    setShowDropdown(false);
  };

  // 시간 변경 핸들러
  const handleTimeChange = React.useCallback((newHour24: number, newMinute: number) => {
    const formattedTime = formatTime(newHour24, newMinute);

    if (onChange && hiddenInputRef.current) {
      // hidden input의 value를 먼저 업데이트
      hiddenInputRef.current.value = formattedTime;

      // 실제 이벤트 객체 생성
      const nativeEvent = new Event('change', { bubbles: true });
      const syntheticEvent = {
        target: hiddenInputRef.current,
        currentTarget: hiddenInputRef.current,
        nativeEvent,
        bubbles: true,
        cancelable: false,
        defaultPrevented: false,
        eventPhase: 0,
        isTrusted: false,
        preventDefault: () => {},
        isDefaultPrevented: () => false,
        stopPropagation: () => {},
        isPropagationStopped: () => false,
        persist: () => {},
        timeStamp: Date.now(),
        type: 'change',
      } as React.ChangeEvent<HTMLInputElement>;

      onChange(syntheticEvent);
    }
  }, [onChange, formatTime]);

  // 오전/오후 토글
  const handlePeriodClick = () => {
    if (props.disabled) return;
    const newPeriod = period === '오전' ? '오후' : '오전';
    setPeriod(newPeriod);
    const newHour24 = to24Hour(displayHour, newPeriod === '오후');
    setHour24(newHour24);
    handleTimeChange(newHour24, minute);
  };


  // 시 입력 핸들러 (키 입력 기반)
  const handleHourKeyPress = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // 숫자 키만 처리
    if (!/^[0-9]$/.test(e.key)) return;

    e.preventDefault(); // 기본 입력 방지

    const digit = e.key;

    // 이전 타이머 취소
    if (hourTimeoutRef.current) {
      clearTimeout(hourTimeoutRef.current);
    }

    // 버퍼에 새 숫자 추가
    hourBufferRef.current += digit;

    let newHour12: number;

    // 버퍼가 2자리인 경우
    if (hourBufferRef.current.length >= 2) {
      const twoDigit = parseInt(hourBufferRef.current.slice(-2), 10);
      if (twoDigit >= 1 && twoDigit <= 12) {
        newHour12 = twoDigit;
      } else {
        // 유효하지 않은 2자리면 마지막 숫자만 사용
        newHour12 = parseInt(digit, 10);
        if (newHour12 === 0) newHour12 = 10;
      }

      // 2자리 입력 완료 → 분 필드로 이동
      const newHour24 = to24Hour(newHour12, period === '오후');
      setHour24(newHour24);
      handleTimeChange(newHour24, minute);
      hourBufferRef.current = '';

      setTimeout(() => {
        minuteInputRef.current?.focus();
        minuteInputRef.current?.select();
      }, 0);
      return;
    }

    // 단일 숫자 입력
    newHour12 = parseInt(digit, 10);
    if (newHour12 === 0) newHour12 = 10;

    const newHour24 = to24Hour(newHour12, period === '오후');
    setHour24(newHour24);
    handleTimeChange(newHour24, minute);

    // 2-9 입력 시 즉시 분 필드로 이동 (두 번째 숫자가 올 수 없음)
    // 1은 10, 11, 12가 가능하므로 대기
    if (parseInt(digit, 10) >= 2) {
      hourBufferRef.current = '';
      setTimeout(() => {
        minuteInputRef.current?.focus();
        minuteInputRef.current?.select();
      }, 0);
      return;
    }

    // 1초 후 버퍼 초기화 및 분 필드로 이동 (연속 입력 타임아웃)
    hourTimeoutRef.current = setTimeout(() => {
      hourBufferRef.current = '';
      minuteInputRef.current?.focus();
      minuteInputRef.current?.select();
    }, 1000);
  }, [period, minute, handleTimeChange]);

  // 시 입력 핸들러 (onChange - 백업용)
  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // onKeyPress에서 처리하므로 여기서는 아무것도 하지 않음
    // 단, 모바일 등에서 onKeyPress가 안 먹힐 경우를 대비
    const inputValue = e.target.value.replace(/[^0-9]/g, '');
    if (inputValue.length === 0) return;
  };

  // 분 입력 핸들러 (키 입력 기반)
  const handleMinuteKeyPress = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // 숫자 키만 처리
    if (!/^[0-9]$/.test(e.key)) return;

    e.preventDefault(); // 기본 입력 방지

    const digit = e.key;

    // 이전 타이머 취소
    if (minuteTimeoutRef.current) {
      clearTimeout(minuteTimeoutRef.current);
    }

    // 버퍼에 새 숫자 추가
    minuteBufferRef.current += digit;

    let newMinute: number;

    // 버퍼가 2자리인 경우
    if (minuteBufferRef.current.length >= 2) {
      const twoDigit = parseInt(minuteBufferRef.current.slice(-2), 10);
      if (twoDigit >= 0 && twoDigit <= 59) {
        newMinute = twoDigit;
      } else {
        newMinute = parseInt(digit, 10);
      }

      setMinute(newMinute);
      handleTimeChange(hour24, newMinute);
      minuteBufferRef.current = '';
      return;
    }

    // 단일 숫자 입력
    newMinute = parseInt(digit, 10);
    setMinute(newMinute);
    handleTimeChange(hour24, newMinute);

    // 1초 후 버퍼 초기화
    minuteTimeoutRef.current = setTimeout(() => {
      minuteBufferRef.current = '';
    }, 1000);
  }, [hour24, handleTimeChange]);

  // 분 입력 핸들러 (onChange - 백업용)
  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // onKeyPress에서 처리하므로 여기서는 아무것도 하지 않음
    const inputValue = e.target.value.replace(/[^0-9]/g, '');
    if (inputValue.length === 0) return;
  };

  // 키보드 이벤트 핸들러 (시)
  const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      let newHour12 = displayHour + 1;
      if (newHour12 > 12) newHour12 = 1;
      const newHour24 = to24Hour(newHour12, period === '오후');
      setHour24(newHour24);
      handleTimeChange(newHour24, minute);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      let newHour12 = displayHour - 1;
      if (newHour12 < 1) newHour12 = 12;
      const newHour24 = to24Hour(newHour12, period === '오후');
      setHour24(newHour24);
      handleTimeChange(newHour24, minute);
    } else if (e.key === 'Tab' && !e.shiftKey) {
      // Tab 기본 동작 유지
    } else if (e.key === ':' || e.key === 'ArrowRight') {
      e.preventDefault();
      minuteInputRef.current?.focus();
      minuteInputRef.current?.select();
    }
  };

  // 키보드 이벤트 핸들러 (분)
  const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      let newMinute = minute + 1;
      if (newMinute > 59) newMinute = 0;
      setMinute(newMinute);
      handleTimeChange(hour24, newMinute);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      let newMinute = minute - 1;
      if (newMinute < 0) newMinute = 59;
      setMinute(newMinute);
      handleTimeChange(hour24, newMinute);
    } else if (e.key === 'ArrowLeft' || (e.key === 'Backspace' && e.currentTarget.selectionStart === 0)) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        hourInputRef.current?.focus();
        hourInputRef.current?.select();
      }
    }
  };

  // 포커스 핸들러
  const handleFieldFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    e.target.select();
    onFocus?.(e);
  };

  const handleFieldBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // 다른 필드로 이동 중인지 확인
    setTimeout(() => {
      if (
        document.activeElement !== hourInputRef.current &&
        document.activeElement !== minuteInputRef.current
      ) {
        setIsFocused(false);
        onBlur?.(e);
      }
    }, 0);
  };

  // 컨테이너 클릭 시 시 필드에 포커스
  const handleContainerClick = () => {
    if (!props.disabled) {
      hourInputRef.current?.focus();
      hourInputRef.current?.select();
    }
  };

  const inputStyle: React.CSSProperties = {
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontFamily: 'var(--font-family)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 'var(--font-weight-normal)',
    lineHeight: 'var(--line-height)',
    color: props.disabled ? 'var(--color-text-disabled)' : 'var(--color-text)',
    textAlign: 'center',
    padding: 0,
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      {/* Hidden input for form submission */}
      <input
        ref={hiddenInputRef}
        type="hidden"
        value={formatTime(hour24, minute)}
        {...props}
      />

      {/* [불변 규칙] wrapper에 height 적용 + boxSizing: border-box로 border 포함 높이 계산 */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          width: fullWidth ? '100%' : 'auto',
          height: sizeStyles[size].height,
          backgroundColor: props.disabled ? 'var(--color-gray-100)' : 'var(--color-white)',
          border: props.disabled
            ? 'var(--border-width-thin) solid var(--color-gray-200)'
            : isFocused
            ? (error ? 'var(--border-width-thin) solid var(--color-form-error)' : 'var(--border-width-thin) solid var(--color-primary)')
            : (error ? 'var(--border-width-thin) solid var(--color-form-error)' : 'var(--border-width-thin) solid var(--color-gray-200)'),
          borderRadius: 'var(--border-radius-xs)',
          boxSizing: 'border-box',
          transition: 'var(--transition-all)',
          opacity: props.disabled ? 0.6 : 1,
          paddingLeft: 'var(--spacing-md)',
          paddingRight: 'var(--spacing-md)',
          cursor: props.disabled ? 'not-allowed' : 'text',
        }}
      >
        {/* 오전/오후 */}
        <span
          onClick={(e) => {
            e.stopPropagation();
            handlePeriodClick();
          }}
          style={{
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--font-size-base)',
            cursor: props.disabled ? 'not-allowed' : 'pointer',
            color: props.disabled ? 'var(--color-text-disabled)' : 'var(--color-primary)',
            fontWeight: 'var(--font-weight-medium)',
            userSelect: 'none',
            lineHeight: 'var(--line-height)',
          }}
        >
          {period}
        </span>

        {/* 시 입력 */}
        <input
          ref={hourInputRef}
          type="text"
          inputMode="numeric"
          value={String(displayHour)}
          onChange={handleHourChange}
          onKeyDown={handleHourKeyDown}
          onKeyPress={handleHourKeyPress}
          onFocus={handleFieldFocus}
          onBlur={handleFieldBlur}
          disabled={props.disabled}
          style={{
            ...inputStyle,
            width: 'var(--spacing-lg)',
          }}
          maxLength={2}
        />

        {/* 구분자 */}
        <span style={{
          color: 'var(--color-text-secondary)',
          lineHeight: 'var(--line-height)',
          fontSize: 'var(--font-size-base)',
        }}>:</span>

        {/* 분 입력 */}
        <input
          ref={minuteInputRef}
          type="text"
          inputMode="numeric"
          value={String(minute).padStart(2, '0')}
          onChange={handleMinuteChange}
          onKeyDown={handleMinuteKeyDown}
          onKeyPress={handleMinuteKeyPress}
          onFocus={handleFieldFocus}
          onBlur={handleFieldBlur}
          disabled={props.disabled}
          style={{
            ...inputStyle,
            width: 'var(--spacing-lg)',
          }}
          maxLength={2}
        />

        {/* 시계 아이콘 */}
        <div
          onClick={handleIconClick}
          style={{
            marginLeft: 'auto',
            flexShrink: 0,
            cursor: props.disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-xs)',
            borderRadius: 'var(--border-radius-xs)',
            transition: 'background-color var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            if (!props.disabled) {
              e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Clock
            size={16}
            strokeWidth={1.5}
            style={{
              color: props.disabled ? 'var(--color-text-disabled)' : 'var(--color-text-secondary)',
            }}
          />
        </div>
      </div>

      {/* 시간 선택 드롭다운 */}
      {showDropdown && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            zIndex: 'var(--z-popover)',
            backgroundColor: 'var(--color-white)',
            borderRadius: 'var(--border-radius-xs)',
            boxShadow: 'var(--shadow-lg)',
            border: 'var(--border-width-thin) solid var(--color-gray-200)',
            padding: 'var(--spacing-sm)',
            display: 'flex',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          {/* 오전/오후 선택 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-xxs)',
              borderRight: 'var(--border-width-thin) solid var(--color-gray-200)',
              paddingRight: 'var(--spacing-sm)',
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--spacing-xxs)',
                textAlign: 'center',
              }}
            >
              구분
            </div>
            {(['오전', '오후'] as const).map((p) => (
              <div
                key={p}
                onClick={() => handleDropdownPeriodSelect(p)}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  borderRadius: 'var(--border-radius-xs)',
                  cursor: 'pointer',
                  backgroundColor: period === p ? 'var(--color-primary)' : 'transparent',
                  color: period === p ? 'var(--color-white)' : 'var(--color-text)',
                  fontSize: 'var(--font-size-sm)',
                  textAlign: 'center',
                  minWidth: 'var(--spacing-xl)',
                  transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  if (period !== p) {
                    e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (period !== p) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {p}
              </div>
            ))}
          </div>

          {/* 시 선택 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-xxs)',
              borderRight: 'var(--border-width-thin) solid var(--color-gray-200)',
              paddingRight: 'var(--spacing-sm)',
              maxHeight: '200px',
              overflowY: 'auto',
              flex: 1,
            }}
            className="ui-core-hiddenScrollbar"
          >
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--spacing-xxs)',
                textAlign: 'center',
                position: 'sticky',
                top: 0,
                backgroundColor: 'var(--color-white)',
              }}
            >
              시
            </div>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <div
                key={h}
                onClick={() => handleDropdownHourSelect(h)}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  borderRadius: 'var(--border-radius-xs)',
                  cursor: 'pointer',
                  backgroundColor: displayHour === h ? 'var(--color-primary)' : 'transparent',
                  color: displayHour === h ? 'var(--color-white)' : 'var(--color-text)',
                  fontSize: 'var(--font-size-sm)',
                  textAlign: 'center',
                  minWidth: 'var(--spacing-xl)',
                  transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  if (displayHour !== h) {
                    e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (displayHour !== h) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* 분 선택 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-xxs)',
              maxHeight: '200px',
              overflowY: 'auto',
              flex: 1,
            }}
            className="ui-core-hiddenScrollbar"
          >
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--spacing-xxs)',
                textAlign: 'center',
                position: 'sticky',
                top: 0,
                backgroundColor: 'var(--color-white)',
              }}
            >
              분
            </div>
            {Array.from({ length: 60 }, (_, i) => i).map((m) => (
              <div
                key={m}
                onClick={() => handleDropdownMinuteSelect(m)}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  borderRadius: 'var(--border-radius-xs)',
                  cursor: 'pointer',
                  backgroundColor: minute === m ? 'var(--color-primary)' : 'transparent',
                  color: minute === m ? 'var(--color-white)' : 'var(--color-text)',
                  fontSize: 'var(--font-size-sm)',
                  textAlign: 'center',
                  minWidth: 'var(--spacing-xl)',
                  transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  if (minute !== m) {
                    e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
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
        </div>,
        document.body
      )}

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
    </div>
  );
});

TimeInput.displayName = 'TimeInput';
