/**
 * DailyAttendanceSection Component
 *
 * 날짜별 출결 섹션 (날짜 구분선 + 수업 목록)
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 */

import React from 'react';
import { Calendar } from 'lucide-react';
import { ClassDailyCard } from './ClassDailyCard';
import type { DailyAttendanceSectionProps } from './types';
import { LAYOUT_SIZES } from './constants';

export const DailyAttendanceSection: React.FC<DailyAttendanceSectionProps> = ({
  group,
  expandedClassIds,
  onToggleClass,
}) => {
  const { dateLabel, classes } = group;
  const hasClasses = classes.length > 0;

  return (
    <div
      style={{
        marginBottom: 'var(--spacing-xl)',
      }}
    >
      {/* 날짜 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-md)',
          paddingBottom: 'var(--spacing-sm)',
          borderBottom: 'var(--border-width-medium) solid var(--color-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: `${LAYOUT_SIZES.ICON_CONTAINER_SIZE}px`,
            height: `${LAYOUT_SIZES.ICON_CONTAINER_SIZE}px`,
            borderRadius: 'var(--border-radius-md)',
            backgroundColor: 'var(--color-primary-100)',
            color: 'var(--color-primary)',
          }}
        >
          <Calendar size={18} />
        </div>
        <span
          style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
          }}
        >
          {dateLabel}
        </span>
      </div>

      {/* 수업 목록 */}
      <div
        style={{
          paddingLeft: 'var(--spacing-md)',
        }}
      >
        {hasClasses ? (
          classes.map((classAttendance) => (
            <ClassDailyCard
              key={`${group.date}-${classAttendance.classId}`}
              classAttendance={classAttendance}
              isExpanded={expandedClassIds.has(`${group.date}-${classAttendance.classId}`)}
              onToggle={() => onToggleClass(`${group.date}-${classAttendance.classId}`)}
            />
          ))
        ) : (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              textAlign: 'center',
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--font-size-sm)',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: 'var(--border-radius-md)',
            }}
          >
            (수업 없음)
          </div>
        )}
      </div>
    </div>
  );
};
