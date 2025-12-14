/**
 * DatePicker Component (Custom Calendar)
 *
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { createPortal } from 'react-dom';
import { Popover } from './Popover';

type SizeToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'value' | 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: SizeToken;
  fullWidth?: boolean;
  value?: string | Date;
  onChange?: (value: string) => void;
  dateTime?: boolean; // datetime-local 지원
}

/**
 * DatePicker 컴포넌트 (커스텀 달력)
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
  onFocus,
  onBlur,
  disabled,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const anchorRef = useRef<HTMLDivElement>(null);

  // value를 Date 객체로 변환
  const selectedDate = useMemo(() => {
    if (!value) return null;
    if (value instanceof Date) return value;
    const dateStr = dateTime ? value.slice(0, 16) : value.slice(0, 10);
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }, [value, dateTime]);

  // 표시할 날짜 문자열
  const displayValue = useMemo(() => {
    if (!selectedDate) return '';
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    if (dateTime) {
      const hours = String(selectedDate.getHours()).padStart(2, '0');
      const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
    return `${year}-${month}-${day}`;
  }, [selectedDate, dateTime]);

  const sizeStyles: Record<SizeToken, React.CSSProperties> = {
    xs: {
      padding: 'var(--spacing-xs) var(--spacing-sm)',
    },
    sm: {
      padding: 'var(--spacing-xs) var(--spacing-sm)',
    },
    md: {
      padding: 'var(--spacing-sm) var(--spacing-md)',
    },
    lg: {
      padding: 'var(--spacing-md) var(--spacing-lg)',
    },
    xl: {
      padding: 'var(--spacing-lg) var(--spacing-xl)',
    },
  };

  const inputStyle: React.CSSProperties = {
    ...sizeStyles[size],
    border: `var(--border-width-thin) solid ${error ? 'var(--color-red-500)' : 'var(--color-gray-200)'}`, // styles.css 준수: border-width 토큰 사용
    borderRadius: 'var(--border-radius-sm)',
    backgroundColor: disabled ? 'var(--color-gray-100)' : 'var(--color-white)',
    color: disabled ? 'var(--color-text-tertiary)' : 'var(--color-text)',
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    transition: 'var(--transition-all)', // styles.css 준수: transition 토큰 사용
    fontFamily: 'var(--font-family)',
    fontSize: 'var(--font-size-base)', // Input과 동일한 폰트 사이즈 (일관성)
    lineHeight: 'var(--line-height)', // Input과 동일한 line-height (일관성)
    boxShadow: isOpen ? 'var(--shadow-md)' : 'var(--shadow-sm)',
    paddingRight: 'var(--spacing-xl)', // 아이콘 공간 확보 (Select와 동일)
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box', // Input과 동일한 box-sizing (일관성)
    // position: relative는 외부 컨테이너에 설정 (Select와 동일한 구조)
    // 높이는 fontSize * lineHeight + padding-top + padding-bottom + border로 자동 계산됨 (Input과 동일)
  };

  const handleToggle = useCallback(() => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
    if (!isOpen && selectedDate) {
      setCurrentMonth(new Date(selectedDate));
    }
  }, [disabled, isOpen, selectedDate]);

  const handleDateSelect = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    if (dateTime) {
      const selected = selectedDate || new Date();
      const hours = String(selected.getHours()).padStart(2, '0');
      const minutes = String(selected.getMinutes()).padStart(2, '0');
      onChange?.(`${dateStr}T${hours}:${minutes}`);
    } else {
      onChange?.(dateStr);
    }
    setIsOpen(false);
  }, [dateTime, selectedDate, onChange]);

  const handleTimeChange = useCallback((hours: number, minutes: number) => {
    if (!selectedDate) return;
    const date = new Date(selectedDate);
    date.setHours(hours);
    date.setMinutes(minutes);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    onChange?.(`${year}-${month}-${day}T${hoursStr}:${minutesStr}`);
  }, [selectedDate, onChange]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = error ? 'var(--color-red-500)' : 'var(--color-primary)';
    // styles.css 준수: focus-ring-width 토큰 사용 (2px)
    e.currentTarget.style.boxShadow = `0 0 0 var(--focus-ring-width) ${error ? 'var(--color-red-50)' : 'var(--color-primary-50)'}`;
    onFocus?.(e as unknown as React.FocusEvent<HTMLInputElement>);
  }, [error, onFocus]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = error ? 'var(--color-red-500)' : 'var(--color-gray-200)';
    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
    onBlur?.(e as unknown as React.FocusEvent<HTMLInputElement>);
  }, [error, onBlur]);

  // 달력 그리드 생성
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: (Date | null)[] = [];
    const currentDate = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      if (currentDate.getMonth() === month) {
        days.push(new Date(currentDate));
      } else {
        days.push(null);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  }, [currentMonth]);

  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const handlePrevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  }, []);

  const isToday = useCallback((date: Date) => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }, []);

  const isSelected = useCallback((date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate()
    );
  }, [selectedDate]);

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
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text)',
            marginBottom: 'var(--spacing-xs)',
          }}
        >
          {label}
        </label>
      )}
      <div
        style={{
          position: 'relative', // 아이콘 absolute positioning을 위한 relative (Select와 동일)
          width: fullWidth ? '100%' : 'auto',
        }}
      >
        <div
          ref={anchorRef}
          role="textbox"
          aria-expanded={isOpen}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          className={clsx(className)}
          style={inputStyle}
          onClick={handleToggle}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        >
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayValue || '날짜를 선택하세요'}
          </span>
          <div
            style={{
              position: 'absolute', // Select와 동일하게 absolute positioning (높이에 영향 없음)
              right: 'var(--spacing-sm)',
              top: '50%',
              transform: 'translateY(-50%)', // 수직 중앙 정렬
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              width: 'var(--spacing-md)', // 아이콘 크기에 맞춤 (16px)
              height: 'var(--spacing-md)', // 아이콘 크기에 맞춤 (16px)
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style={{ color: 'var(--color-gray-500)' }}
            >
              <path
                d="M12 2H4C2.89543 2 2 2.89543 2 4V12C2 13.1046 2.89543 14 4 14H12C13.1046 14 14 13.1046 14 12V4C14 2.89543 13.1046 2 12 2Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M11 1V3M5 1V3M2 5H14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {isOpen &&
          anchorRef.current &&
          createPortal(
            <Popover
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              anchorEl={anchorRef.current}
              placement="bottom-start"
            >
              <div
                style={{
                  padding: 'var(--spacing-md)',
                  minWidth: 'var(--width-card-min)', // styles.css 준수: 카드 최소 너비
                }}
              >
                {/* 달력 헤더 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--spacing-md)',
                  }}
                >
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    style={{
                      padding: 'var(--spacing-xs)',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      borderRadius: 'var(--border-radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-text)',
                      transition: 'background-color var(--transition-base)', // styles.css 준수: transition 토큰 사용
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M10 12L6 8L10 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <div
                    style={{
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-text)',
                      fontSize: 'var(--font-size-base)', // styles.css 준수: 기본 폰트 사이즈
                    }}
                  >
                    {currentMonth.getFullYear()}년 {monthNames[currentMonth.getMonth()]}
                  </div>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    style={{
                      padding: 'var(--spacing-xs)',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      borderRadius: 'var(--border-radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-text)',
                      transition: 'background-color var(--transition-base)', // styles.css 준수: transition 토큰 사용
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M6 4L10 8L6 12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

                {/* 요일 헤더 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 'var(--spacing-xs)',
                    marginBottom: 'var(--spacing-sm)',
                  }}
                >
                  {dayNames.map((day) => (
                    <div
                      key={day}
                      style={{
                        textAlign: 'center',
                        fontWeight: 'var(--font-weight-medium)',
                        // 일요일/토요일은 테마의 primary/secondary 색상 사용 (인더스트리 테마 정합성)
                        color: day === '일'
                          ? 'var(--color-primary)'
                          : day === '토'
                          ? 'var(--color-secondary)'
                          : 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-sm)',
                        padding: 'var(--spacing-xs)',
                      }}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* 달력 그리드 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 'var(--spacing-xs)',
                  }}
                >
                  {calendarDays.map((date, index) => {
                    if (!date) {
                      return <div key={index} />;
                    }

                    const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                    const isSelectedDate = isSelected(date);
                    const isTodayDate = isToday(date);

                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleDateSelect(date)}
                        style={{
                          aspectRatio: 'var(--aspect-ratio-square)', // styles.css 준수: 정사각형 비율
                          border: 'none',
                          borderRadius: 'var(--border-radius-sm)',
                          backgroundColor: isSelectedDate
                            ? 'var(--color-primary)'
                            : isTodayDate
                            ? 'var(--color-primary-50)'
                            : 'transparent',
                          color: isSelectedDate
                            ? 'var(--color-white)'
                            : !isCurrentMonth
                            ? 'var(--color-text-tertiary)'
                            : isTodayDate
                            ? 'var(--color-primary)'
                            : 'var(--color-text)',
                          fontWeight: isSelectedDate || isTodayDate ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)', // styles.css 준수: transition 토큰 사용
                          fontSize: 'var(--font-size-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelectedDate) {
                            e.currentTarget.style.backgroundColor = 'var(--color-primary-50)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelectedDate) {
                            e.currentTarget.style.backgroundColor = isTodayDate ? 'var(--color-primary-50)' : 'transparent';
                          }
                        }}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>

                {/* 시간 선택 (datetime 모드) */}
                {dateTime && selectedDate && (
                  <div
                    style={{
                      marginTop: 'var(--spacing-md)',
                      paddingTop: 'var(--spacing-md)',
                      borderTop: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 'var(--spacing-md)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                      <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>시</label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={selectedDate.getHours()}
                        onChange={(e) => {
                          const hours = parseInt(e.target.value) || 0;
                          handleTimeChange(Math.max(0, Math.min(23, hours)), selectedDate.getMinutes());
                        }}
                        style={{
                          width: 'var(--width-grid-column)', // styles.css 준수: 그리드 컬럼 너비
                          padding: 'var(--spacing-xs)',
                          border: 'var(--border-width-thin) solid var(--color-gray-200)',
                          borderRadius: 'var(--border-radius-sm)',
                          textAlign: 'center',
                          fontFamily: 'var(--font-family)',
                          fontSize: 'var(--font-size-base)', // styles.css 준수: 기본 폰트 사이즈
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                      <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>분</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={selectedDate.getMinutes()}
                        onChange={(e) => {
                          const minutes = parseInt(e.target.value) || 0;
                          handleTimeChange(selectedDate.getHours(), Math.max(0, Math.min(59, minutes)));
                        }}
                        style={{
                          width: 'var(--width-grid-column)', // styles.css 준수: 그리드 컬럼 너비
                          padding: 'var(--spacing-xs)',
                          border: 'var(--border-width-thin) solid var(--color-gray-200)',
                          borderRadius: 'var(--border-radius-sm)',
                          textAlign: 'center',
                          fontFamily: 'var(--font-family)',
                          fontSize: 'var(--font-size-base)', // styles.css 준수: 기본 폰트 사이즈
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Popover>,
            document.body
          )}
      </div>
      {error && (
        <span
          style={{
            color: 'var(--color-red-500)',
            marginTop: 'var(--spacing-xs)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {error}
        </span>
      )}
      {helperText && !error && (
        <span
          style={{
            color: 'var(--color-text-secondary)',
            marginTop: 'var(--spacing-xs)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
};
