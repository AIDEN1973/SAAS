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
  // 라벨을 플레이스홀더로 사용
  const placeholder = label || '날짜를 선택하세요';

  // 플레이스홀더에서 키워드를 볼드 처리하는 함수
  const renderPlaceholderWithBold = React.useCallback((text: string) => {
    const keywords = ['이름', '학년', '클래스', '재원상태'];
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    keywords.forEach((keyword) => {
      const index = text.indexOf(keyword, lastIndex);
      if (index !== -1) {
        // 키워드 이전 텍스트 추가
        if (index > lastIndex) {
          parts.push(text.substring(lastIndex, index));
        }
        // 키워드를 볼드 처리
        parts.push(
          <strong key={`${keyword}-${index}`} style={{ fontWeight: 'var(--font-weight-extrabold)' }}>
            {keyword}
          </strong>
        );
        lastIndex = index + keyword.length;
      }
    });

    // 남은 텍스트 추가
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  }, []);

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
      paddingTop: 'var(--spacing-xs)',
      paddingBottom: 'var(--spacing-xs)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용 (아이콘 공간 포함)
    },
    sm: {
      paddingTop: 'var(--spacing-xs)',
      paddingBottom: 'var(--spacing-xs)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용 (아이콘 공간 포함)
    },
    md: {
      paddingTop: 'var(--spacing-sm)',
      paddingBottom: 'var(--spacing-sm)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용 (아이콘 공간 포함)
    },
    lg: {
      paddingTop: 'var(--spacing-md)',
      paddingBottom: 'var(--spacing-md)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용 (아이콘 공간 포함)
    },
    xl: {
      paddingTop: 'var(--spacing-lg)',
      paddingBottom: 'var(--spacing-lg)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용 (아이콘 공간 포함)
    },
  };

  const hasValue = !!selectedDate;

  const inputStyle: React.CSSProperties = {
    ...sizeStyles[size],
    border: 'none',
    borderBottom: `var(--border-width-form-bottom) solid transparent`, // styles.css 토큰: 레이아웃 유지를 위해 항상 2px, 색상은 투명
    borderRadius: 0,
    backgroundColor: disabled ? 'var(--color-form-disabled-bg)' : 'var(--color-white)', // styles.css 토큰: 폼 필드 배경색
    color: disabled ? 'var(--color-form-disabled-text)' : 'var(--color-text)', // styles.css 토큰: 폼 필드 텍스트 색상
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    transition: 'var(--transition-all)', // styles.css 토큰: transition
    fontFamily: 'var(--font-family)', // styles.css 토큰: 폰트 패밀리
    fontSize: 'var(--font-size-base)', // styles.css 토큰: 폼 필드 폰트 사이즈
    fontWeight: 'var(--font-weight-normal)', // styles.css 토큰: 폼 필드 폰트 웨이트
    lineHeight: 'var(--line-height)', // styles.css 토큰: 폼 필드 라인 높이
    boxShadow: hasValue
      ? (error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)') // 값이 있으면 2px 테두리
      : (error ? 'var(--shadow-form-bottom-default-error)' : 'var(--shadow-form-bottom-default)'), // 값이 없으면 1px 테두리
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box', // styles.css 토큰: 폼 필드 box-sizing
    // position: relative는 외부 컨테이너에 설정
    // 높이는 fontSize * lineHeight + padding-top + padding-bottom + border로 자동 계산됨
  };

  const handleToggle = useCallback(() => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
    if (!isOpen && selectedDate) {
      setCurrentMonth(new Date(selectedDate));
    }
    // 클릭 시 포커스 스타일 적용 (styles.css 토큰 사용)
    if (anchorRef.current) {
      anchorRef.current.style.borderBottomColor = 'transparent'; // styles.css 토큰: 항상 transparent 유지 (레이아웃 고정)
      anchorRef.current.style.boxShadow = error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)'; // styles.css 토큰: 포커스 시 시각적 2px 테두리
    }
  }, [disabled, isOpen, selectedDate, error]);

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
    e.currentTarget.style.borderBottomColor = 'transparent'; // styles.css 토큰: 항상 transparent 유지 (레이아웃 고정)
    e.currentTarget.style.boxShadow = error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)'; // styles.css 토큰: 포커스 시 항상 시각적 2px 테두리
    onFocus?.(e as unknown as React.FocusEvent<HTMLInputElement>);
  }, [error, onFocus]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderBottomColor = 'transparent'; // styles.css 토큰: 투명으로 변경
    // 값이 있으면 2px 유지, 값이 없으면 1px로 복원
    const currentHasValue = !!selectedDate;
    e.currentTarget.style.boxShadow = currentHasValue
      ? (error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)')
      : (error ? 'var(--shadow-form-bottom-default-error)' : 'var(--shadow-form-bottom-default)');
    onBlur?.(e as unknown as React.FocusEvent<HTMLInputElement>);
  }, [error, onBlur, selectedDate]);

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

  // 값 변경 시 스타일 업데이트 (값이 있으면 2px, 없으면 1px)
  useEffect(() => {
    if (anchorRef.current && !isOpen) {
      const currentHasValue = !!selectedDate;
      anchorRef.current.style.borderBottomColor = 'transparent';
      anchorRef.current.style.boxShadow = currentHasValue
        ? (error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)')
        : (error ? 'var(--shadow-form-bottom-default-error)' : 'var(--shadow-form-bottom-default)');
    }
  }, [selectedDate, error, isOpen]);

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
              color: displayValue ? 'var(--color-text)' : 'var(--color-text-tertiary)',
              fontWeight: 'var(--font-weight-normal)', // styles.css 준수: 폰트 웨이트 토큰 사용
            }}
          >
            {displayValue ? displayValue : renderPlaceholderWithBold(placeholder)}
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
              viewBox="0 0 16 16"
              fill="none"
              style={{
                width: 'var(--size-icon-base)',
                height: 'var(--size-icon-base)',
                color: 'var(--color-text-tertiary)'
              }} // 기본 텍스트 색상 토큰 사용
            >
              <path
                d="M12 2H4C2.89543 2 2 2.89543 2 4V12C2 13.1046 2.89543 14 4 14H12C13.1046 14 14 13.1046 14 12V4C14 2.89543 13.1046 2 12 2Z"
                stroke="currentColor"
                strokeWidth="var(--stroke-width-icon)"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M11 1V3M5 1V3M2 5H14"
                stroke="currentColor"
                strokeWidth="var(--stroke-width-icon)"
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
              style={{
                width: 'var(--width-calendar)', // styles.css 준수: 달력 너비 토큰 사용
                maxWidth: 'calc(100vw - var(--spacing-lg) * 2)', // 화면 경계 고려
              }}
            >
              <div
                style={{
                  padding: 'var(--spacing-md)',
                  width: '100%', // 부모 너비에 맞춤
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
                      width: 'var(--size-checkbox)', // 20px - 적절한 버튼 크기
                      height: 'var(--size-checkbox)', // 20px - 적절한 버튼 크기
                      minWidth: 'var(--size-checkbox)', // 접근성
                      minHeight: 'var(--size-checkbox)', // 접근성
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <svg viewBox="0 0 16 16" fill="none" style={{ width: 'var(--size-icon-sm)', height: 'var(--size-icon-sm)' }}>
                      <path
                        d="M10 12L6 8L10 4"
                        stroke="currentColor"
                        strokeWidth="var(--stroke-width-icon)"
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
                      width: 'var(--size-checkbox)', // 20px - 적절한 버튼 크기
                      height: 'var(--size-checkbox)', // 20px - 적절한 버튼 크기
                      minWidth: 'var(--size-checkbox)', // 접근성
                      minHeight: 'var(--size-checkbox)', // 접근성
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <svg viewBox="0 0 16 16" fill="none" style={{ width: 'var(--size-icon-sm)', height: 'var(--size-icon-sm)' }}>
                      <path
                        d="M6 4L10 8L6 12"
                        stroke="currentColor"
                        strokeWidth="var(--stroke-width-icon)"
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
                          : 'var(--color-text)', // 기본 텍스트 색상 사용
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
            color: 'var(--color-form-error)', // styles.css 토큰: 폼 필드 에러 메시지 색상
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
