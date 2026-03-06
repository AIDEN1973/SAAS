/**
 * 오늘 출결 탭 컴포넌트
 *
 * [LAYER: UI_PAGE]
 */

import React from 'react';
import { Container, PageHeader, RightLayerMenuLayout } from '@ui-core/react';
import {
  ClassAttendanceLayer,
  type ClassInfo,
  type StudentAttendanceState,
} from '../../../components/attendance';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { TimeRangeFilterBadges } from '../components/TimeRangeFilterBadges';
import { AttendanceSummaryStats } from '../components/AttendanceSummaryStats';
import { ClassCardGrid } from '../components/ClassCardGrid';
import type { TimeRangeFilter } from '../components/TimeRangeFilterBadges';
import type { AttendanceLog } from '@services/attendance-service';
import type { Student } from '@services/student-service';
import type { Class } from '@services/class-service';

interface TodayAttendanceTabProps {
  // 서브 메뉴 UI
  selectedSubMenuLabel: string;
  // 레이어 메뉴
  selectedClassIdForLayer: string | null;
  selectedClassForLayer: ClassInfo | null;
  studentsInSelectedClass: Student[];
  onClassClick: (classId: string) => void;
  onLayerClose: () => void;
  onLayerAttendanceChange: (studentId: string, changes: Partial<StudentAttendanceState>) => void;
  onLayerBulkCheckIn: () => void;
  onSaveStudent: (studentId: string, stateOverride: Partial<StudentAttendanceState>) => Promise<void>;
  isSaving: boolean;
  // 시간대 필터
  timeRangeFilter: TimeRangeFilter;
  onTimeRangeFilterChange: (filter: TimeRangeFilter) => void;
  // 통계
  attendanceSummary: { total: number; present: number; late: number; absent: number };
  attendanceChartData: Array<{ name: string; value: number; color: string }>;
  isLoading: boolean;
  // 수업 카드
  filteredByTimeRange: Class[];
  selectedDate: string;
  studentsByClass: Map<string, Student[]>;
  studentAttendanceStates: Record<string, StudentAttendanceState>;
  classTeachersMap: Map<string, Array<{ name: string; profile_image_url?: string | null }>>;
  attendanceCheckInLogsMap: Map<string, AttendanceLog>;
  isMobileMode: boolean;
  isTabletMode: boolean;
}

export function TodayAttendanceTab({
  selectedSubMenuLabel,
  selectedClassIdForLayer,
  selectedClassForLayer,
  studentsInSelectedClass,
  onClassClick,
  onLayerClose,
  onLayerAttendanceChange,
  onLayerBulkCheckIn,
  onSaveStudent,
  isSaving,
  timeRangeFilter,
  onTimeRangeFilterChange,
  attendanceSummary,
  attendanceChartData,
  isLoading,
  filteredByTimeRange,
  selectedDate,
  studentsByClass,
  studentAttendanceStates,
  classTeachersMap,
  attendanceCheckInLogsMap,
  isMobileMode,
  isTabletMode,
}: TodayAttendanceTabProps) {
  const terms = useIndustryTerms();

  return (
    <RightLayerMenuLayout
      layerMenu={{
        isOpen: !!selectedClassIdForLayer,
        onClose: onLayerClose,
        title: selectedClassForLayer ? (
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 'var(--spacing-sm)', minWidth: 0 }}>
            <span
              style={{
                fontSize: 'var(--font-size-3xl)',
                fontWeight: 'var(--font-weight-extrabold)',
                lineHeight: 'var(--line-height-tight)',
                color: 'var(--color-text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {selectedClassForLayer.name}
            </span>
            <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
              {terms.ATTENDANCE_LABEL} {selectedClassForLayer.start_time.substring(0, 5)} ~ {selectedClassForLayer.end_time.substring(0, 5)}
            </span>
          </span>
        ) : terms.ATTENDANCE_LABEL,
        contentKey: selectedClassIdForLayer || undefined,
        children: selectedClassForLayer && (
          <ClassAttendanceLayer
            classInfo={selectedClassForLayer}
            students={studentsInSelectedClass}
            attendanceStates={studentAttendanceStates}
            checkInLogsMap={attendanceCheckInLogsMap}
            onAttendanceChange={onLayerAttendanceChange}
            onBulkCheckIn={onLayerBulkCheckIn}
            onSaveStudent={onSaveStudent}
            isSaving={isSaving}
          />
        ),
      }}
    >
      <Container maxWidth="xl" padding="lg">
        <PageHeader
          title={selectedSubMenuLabel}
          style={{ marginBottom: 'var(--spacing-xl)' }}
        />

        {/* 시간대 필터 배지 */}
        <TimeRangeFilterBadges
          timeRangeFilter={timeRangeFilter}
          onFilterChange={onTimeRangeFilterChange}
        />

        {/* 통계 카드 */}
        <AttendanceSummaryStats
          summary={attendanceSummary}
          chartData={attendanceChartData}
          isLoading={isLoading}
        />

        {/* 수업 카드 목록 */}
        <ClassCardGrid
          filteredByTimeRange={filteredByTimeRange}
          selectedDate={selectedDate}
          studentsByClass={studentsByClass}
          studentAttendanceStates={studentAttendanceStates}
          classTeachersMap={classTeachersMap}
          timeRangeFilter={timeRangeFilter}
          isMobileMode={isMobileMode}
          isTabletMode={isTabletMode}
          onClassClick={onClassClick}
        />
      </Container>
    </RightLayerMenuLayout>
  );
}
