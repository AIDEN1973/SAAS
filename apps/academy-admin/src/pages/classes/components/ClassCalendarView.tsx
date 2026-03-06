/**
 * 수업 캘린더 뷰 (월 바둑판 달력)
 *
 * [LAYER: UI_PAGE]
 * [요구사항] 수업 편성표 - 월별 달력 형태로 해당 날짜에 수업 목록 표시
 */

import { useState, useMemo, useCallback } from 'react';
import { Card } from '@ui-core/react';
import { toKST } from '@lib/date-utils';
import { DAY_OF_WEEK_MAP, DAY_NAMES } from '../constants';
import type { Class } from '@services/class-service';

export function ClassCalendarView({ classes, onClassSelect }: { classes: Class[]; onClassSelect?: (classId: string) => void }) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => toKST().toDate());

  // 월 이동 핸들러
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

  // 달력 그리드 데이터 생성 (6주 × 7일 = 42일)
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    const currentDate = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      days.push({
        date: new Date(currentDate),
        isCurrentMonth: currentDate.getMonth() === month,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return days;
  }, [currentMonth]);

  // 날짜별 수업 필터링 (day_of_week 배열 지원)
  const getClassesForDate = useCallback(
    (date: Date): Class[] => {
      const dayIndex = date.getDay(); // 0(일) ~ 6(토)
      const dayOfWeekKey = DAY_OF_WEEK_MAP[dayIndex];

      return classes.filter((classItem) => {
        const dayOfWeek = classItem.day_of_week;
        if (Array.isArray(dayOfWeek)) {
          return dayOfWeek.includes(dayOfWeekKey);
        }
        return dayOfWeek === dayOfWeekKey;
      });
    },
    [classes]
  );

  // 오늘 날짜 확인
  const isToday = useCallback((date: Date): boolean => {
    const today = toKST().toDate();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }, []);

  // 현재 월 표시 라벨
  const currentMonthLabel = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    return `${year}년 ${month}월`;
  }, [currentMonth]);

  // 시간 포맷 (HH:mm:ss -> HH:mm)
  const formatTime = (time: string): string => {
    return time.slice(0, 5);
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <Card padding="lg">
        {/* 월 헤더 (네비게이션) */}
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
              padding: 'var(--spacing-sm)',
              border: 'var(--border-width-thin) solid var(--color-gray-200)',
              backgroundColor: 'var(--color-white)',
              cursor: 'pointer',
              borderRadius: 'var(--border-radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text)',
              transition: 'background-color var(--transition-base)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-white)';
            }}
          >
            <svg viewBox="0 0 16 16" fill="none" style={{ width: 'var(--size-icon-sm)', height: 'var(--size-icon-sm)' }}>
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h2
            style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-bold)',
              margin: 0,
            }}
          >
            {currentMonthLabel}
          </h2>
          <button
            type="button"
            onClick={handleNextMonth}
            style={{
              padding: 'var(--spacing-sm)',
              border: 'var(--border-width-thin) solid var(--color-gray-200)',
              backgroundColor: 'var(--color-white)',
              cursor: 'pointer',
              borderRadius: 'var(--border-radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text)',
              transition: 'background-color var(--transition-base)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-white)';
            }}
          >
            <svg viewBox="0 0 16 16" fill="none" style={{ width: 'var(--size-icon-sm)', height: 'var(--size-icon-sm)' }}>
              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
          {DAY_NAMES.map((day, index) => (
            <div
              key={day}
              style={{
                textAlign: 'center',
                fontWeight: 'var(--font-weight-semibold)',
                color:
                  index === 0
                    ? 'var(--color-primary)'
                    : index === 6
                      ? 'var(--color-secondary)'
                      : 'var(--color-text)',
                fontSize: 'var(--font-size-sm)',
                padding: 'var(--spacing-sm)',
                backgroundColor: 'var(--color-background-secondary)',
                borderRadius: 'var(--border-radius-sm)',
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 달력 그리드 (7열 × 6행) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 'var(--spacing-xs)',
          }}
        >
          {calendarDays.map(({ date, isCurrentMonth }, index) => {
            const classesForDate = getClassesForDate(date);
            const isTodayDate = isToday(date);
            const dayIndex = date.getDay();

            return (
              <div
                key={index}
                style={{
                  minHeight: '120px',
                  padding: 'var(--spacing-sm)',
                  backgroundColor: isCurrentMonth ? 'var(--color-white)' : 'var(--color-gray-50)',
                  borderRadius: 'var(--border-radius-sm)',
                  border: isTodayDate
                    ? 'var(--border-width-base) solid var(--color-primary)'
                    : 'var(--border-width-thin) solid var(--color-gray-200)',
                  opacity: isCurrentMonth ? 1 : 0.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-xs)',
                  overflow: 'hidden',
                }}
              >
                {/* 날짜 숫자 */}
                <div
                  style={{
                    fontWeight: isTodayDate ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
                    fontSize: 'var(--font-size-sm)',
                    color: isTodayDate
                      ? 'var(--color-primary)'
                      : dayIndex === 0
                        ? 'var(--color-primary)'
                        : dayIndex === 6
                          ? 'var(--color-secondary)'
                          : 'var(--color-text)',
                    marginBottom: 'var(--spacing-2xs)',
                  }}
                >
                  {date.getDate()}
                </div>

                {/* 수업 목록 */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2xs)' }}>
                  {classesForDate.slice(0, 3).map((classItem) => (
                    <div
                      key={classItem.id}
                      onClick={() => onClassSelect?.(classItem.id)}
                      style={{
                        padding: 'var(--spacing-2xs) var(--spacing-xs)',
                        backgroundColor: classItem.color ? `${classItem.color}20` : 'var(--color-gray-100)',
                        borderLeft: `var(--border-width-thick) solid ${classItem.color || 'var(--color-primary)'}`,
                        borderRadius: 'var(--border-radius-xs)',
                        fontSize: 'var(--font-size-xs)',
                        cursor: 'pointer',
                        transition: 'background-color var(--transition-fast)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = classItem.color ? `${classItem.color}40` : 'var(--color-gray-200)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = classItem.color ? `${classItem.color}20` : 'var(--color-gray-100)';
                      }}
                    >
                      <div style={{ fontWeight: 'var(--font-weight-medium)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {classItem.name}
                      </div>
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-2xs)' }}>
                        {formatTime(classItem.start_time)}~{formatTime(classItem.end_time)}
                      </div>
                    </div>
                  ))}
                  {classesForDate.length > 3 && (
                    <div
                      style={{
                        fontSize: 'var(--font-size-2xs)',
                        color: 'var(--color-text-secondary)',
                        textAlign: 'center',
                        padding: 'var(--spacing-2xs)',
                      }}
                    >
                      +{classesForDate.length - 3}개 더보기
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 범례 */}
        {classes.length > 0 && (
          <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
            {classes.map((classItem) => (
              <div
                key={classItem.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                <div
                  style={{
                    width: 'var(--font-size-sm)',
                    height: 'var(--font-size-sm)',
                    backgroundColor: classItem.color,
                    borderRadius: 'var(--border-radius-sm)',
                  }}
                />
                <span>{classItem.name}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
