/**
 * 수업 카드 그리드 컴포넌트
 * 시간대별 수업 분류 (진행 중/다음/지난)
 *
 * [LAYER: UI_PAGE]
 */

import React from 'react';
import { Card, EmptyState, EntityCard } from '@ui-core/react';
import { Users, Play, CalendarClock, CalendarX } from 'lucide-react';
import {
  calculateClassStats,
  DAY_NAMES,
  TIME_RANGE_CONFIG,
  type StudentAttendanceState,
} from '../../../components/attendance';
import { toKST } from '@lib/date-utils';
import type { Student } from '@services/student-service';
import type { Class } from '@services/class-service';

interface ClassCardGridProps {
  filteredByTimeRange: Class[];
  selectedDate: string;
  studentsByClass: Map<string, Student[]>;
  studentAttendanceStates: Record<string, StudentAttendanceState>;
  classTeachersMap: Map<string, Array<{ name: string; profile_image_url?: string | null }>>;
  timeRangeFilter: string;
  isMobileMode: boolean;
  isTabletMode: boolean;
  onClassClick: (classId: string) => void;
}

// 과목별 배지 색상 매핑
const getBadgeColor = (subject?: string, isEnded?: boolean): 'primary' | 'success' | 'warning' | 'error' | 'secondary' | 'gray' => {
  if (isEnded) return 'gray';
  const subjectLower = (subject || '').toLowerCase();
  if (subjectLower.includes('국어') || subjectLower.includes('korean')) return 'primary';
  if (subjectLower.includes('수학') || subjectLower.includes('math')) return 'error';
  if (subjectLower.includes('과학') || subjectLower.includes('science')) return 'success';
  if (subjectLower.includes('영어') || subjectLower.includes('english')) return 'warning';
  return 'secondary';
};

// 요일 배열 생성 헬퍼
const getDayOfWeekArray = (dayOfWeek: string | string[] | null | undefined): string[] => {
  if (!dayOfWeek) return [];
  const dayMap: Record<string, string> = {
    monday: '월', tuesday: '화', wednesday: '수',
    thursday: '목', friday: '금', saturday: '토', sunday: '일'
  };
  if (Array.isArray(dayOfWeek)) {
    return dayOfWeek.map(d => dayMap[d] || d);
  }
  return [dayMap[dayOfWeek] || dayOfWeek];
};

export function ClassCardGrid({
  filteredByTimeRange,
  selectedDate,
  studentsByClass,
  studentAttendanceStates,
  classTeachersMap,
  timeRangeFilter,
  isMobileMode,
  isTabletMode,
  onClassClick,
}: ClassCardGridProps) {
  const now = toKST();
  const today = now.format('YYYY-MM-DD');
  const currentTime = now.format('HH:mm');

  // 수업 분류
  const pastClasses: typeof filteredByTimeRange = [];
  const currentClasses: typeof filteredByTimeRange = [];
  const upcomingClasses: typeof filteredByTimeRange = [];

  filteredByTimeRange.forEach((cls) => {
    const startTime = cls.start_time.substring(0, 5);
    const endTime = cls.end_time.substring(0, 5);

    if (selectedDate !== today) {
      if (selectedDate < today) {
        pastClasses.push(cls);
      } else {
        upcomingClasses.push(cls);
      }
    } else {
      if (currentTime >= endTime) {
        pastClasses.push(cls);
      } else if (currentTime >= startTime && currentTime < endTime) {
        currentClasses.push(cls);
      } else {
        upcomingClasses.push(cls);
      }
    }
  });

  const sectionTitleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-extrabold)',
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--spacing-md)',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobileMode ? '1fr' : isTabletMode ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
    gap: 'var(--spacing-md)',
  };

  // 수업 카드 렌더링 함수
  const renderClassCard = (classInfo: typeof filteredByTimeRange[0], type: 'past' | 'current' | 'upcoming') => {
    const classStudents = studentsByClass.get(classInfo.id) || [];
    const stats = calculateClassStats(classStudents, studentAttendanceStates);
    const isEnded = type === 'past';
    const isCurrent = type === 'current';

    const hasIssues = isCurrent && (stats.late > 0 || stats.absent > 0);

    const cardStyle: React.CSSProperties = isEnded
      ? { opacity: 0.75, filter: 'grayscale(100%)' }
      : hasIssues
      ? { border: '2px solid var(--color-error)', animation: 'pulse-border 2s ease-in-out infinite' }
      : {};

    const teacherInfo = classTeachersMap.get(classInfo.id);
    const teacherProfiles = teacherInfo
      ? teacherInfo.map(t => ({ imageUrl: t.profile_image_url, name: t.name }))
      : undefined;

    const subjectAndTeacher = teacherInfo && teacherInfo.length > 0
      ? `${classInfo.subject || '수업'} / ${teacherInfo.map(t => t.name).join(', ')}`
      : classInfo.subject || '수업';

    const dayOfWeekArray = getDayOfWeekArray(classInfo.day_of_week);
    const studentCount = classStudents.length;

    return (
      <React.Fragment key={classInfo.id}>
        {hasIssues && (
          <style>
            {`
              @keyframes pulse-border {
                0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-error) 40%, transparent); }
                50% { box-shadow: 0 0 0 8px color-mix(in srgb, var(--color-error) 0%, transparent); }
              }
            `}
          </style>
        )}
        <EntityCard
          badge={{
            label: subjectAndTeacher,
            color: getBadgeColor(classInfo.subject, isEnded),
          }}
          title={classInfo.name}
          mainValue={studentCount}
          subValue={` / ${classInfo.capacity || 0}`}
          dayOfWeek={dayOfWeekArray.length > 0 ? dayOfWeekArray : undefined}
          description={`${classInfo.start_time.substring(0, 5)}~${classInfo.end_time.substring(0, 5)}`}
          onClick={() => onClassClick(classInfo.id)}
          disabled={isEnded}
          style={cardStyle}
          valueAtBottom={true}
          profiles={teacherProfiles}
        />
      </React.Fragment>
    );
  };

  return (
    <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
      {/* 진행 중 수업 */}
      {currentClasses.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
          <div style={sectionTitleStyle}>
            <Play size={22} strokeWidth={1.5} style={{ color: 'var(--color-text-primary)' }} />
            진행 중 수업 ({currentClasses.length}개)
          </div>
          <div style={gridStyle}>
            {currentClasses.map((cls) => renderClassCard(cls, 'current'))}
          </div>
        </div>
      )}

      {/* 다음 수업 */}
      {upcomingClasses.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
          <div style={sectionTitleStyle}>
            <CalendarClock size={22} strokeWidth={1.5} style={{ color: 'var(--color-text-primary)' }} />
            다음 수업 ({upcomingClasses.length}개)
          </div>
          <div style={gridStyle}>
            {upcomingClasses.map((cls) => renderClassCard(cls, 'upcoming'))}
          </div>
        </div>
      )}

      {/* 지난 수업 */}
      {pastClasses.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
          <div style={sectionTitleStyle}>
            <CalendarX size={22} strokeWidth={1.5} style={{ color: 'var(--color-text-primary)' }} />
            지난 수업 ({pastClasses.length}개)
          </div>
          <div style={gridStyle}>
            {pastClasses.map((cls) => renderClassCard(cls, 'past'))}
          </div>
        </div>
      )}

      {/* 수업이 없는 경우 */}
      {filteredByTimeRange.length === 0 && (
        <Card padding="xl">
          <EmptyState
            icon={Users}
            message={
              timeRangeFilter === 'all'
                ? `${selectedDate} (${DAY_NAMES[toKST(selectedDate).day()]})에 예정된 수업이 없습니다.`
                : `${selectedDate} (${DAY_NAMES[toKST(selectedDate).day()]}) ${TIME_RANGE_CONFIG[timeRangeFilter.toUpperCase() as keyof typeof TIME_RANGE_CONFIG].LABEL}에 예정된 수업이 없습니다.`
            }
          />
        </Card>
      )}
    </div>
  );
}
