/**
 * 출결 관리 페이지 (Thin Orchestrator)
 *
 * [LAYER: UI_PAGE]
 *
 * [요구사항]
 * - PC/태블릿/모바일 출결
 * - QR 출결(선택)
 * - 출결 알림 발송(카카오톡/SMS)
 * - 지각 기준, 결석 처리 규칙 설정
 * - 시간대별 출결 기록
 * - 자동 출결 메시지
 * - 출석부 출력
 * - 출결 히스토리 조회
 */

import React, { Suspense } from 'react';
import { ErrorBoundary, SubSidebar, Container, EmptyState } from '@ui-core/react';
import { useAttendancePageData } from './attendance/hooks/useAttendancePageData';
import { TodayAttendanceTab, HistoryTab, StatisticsTab, SettingsTab } from './attendance/tabs';

export function AttendancePage() {
  const data = useAttendancePageData();

  const selectedSubMenuLabel = data.subMenuItemsWithIcons.find(
    item => item.id === data.selectedSubMenu
  )?.label || data.templates.management(data.terms.ATTENDANCE_LABEL);

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', minHeight: 'var(--height-full)' }}>
        {/* 서브 사이드바 (모바일에서는 숨김, 태블릿에서는 축소) */}
        {!data.isMobileMode && (
          <SubSidebar
            title={data.templates.management(data.terms.ATTENDANCE_LABEL)}
            items={data.subMenuItemsWithIcons}
            selectedId={data.selectedSubMenu}
            onSelect={data.handleSubMenuChange}
            collapsed={data.sidebarCollapsed}
            onCollapsedChange={data.setSidebarCollapsed}
            testId="attendance-sub-sidebar"
          />
        )}

        {/* 메인 콘텐츠 */}
        <div style={{ flex: 1 }}>
          <Suspense fallback={<div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>{data.terms.MESSAGES.LOADING}</div>}>
            {/* 수업별 출결 탭 */}
            {data.selectedSubMenu === 'today' && (
              <TodayAttendanceTab
                selectedSubMenuLabel={selectedSubMenuLabel}
                selectedClassIdForLayer={data.selectedClassIdForLayer}
                selectedClassForLayer={data.selectedClassForLayer}
                studentsInSelectedClass={data.studentsInSelectedClass}
                onClassClick={data.handleClassClick}
                onLayerClose={data.handleLayerClose}
                onLayerAttendanceChange={data.handleLayerAttendanceChange}
                onLayerBulkCheckIn={data.handleLayerBulkCheckIn}
                onSaveStudent={data.handleSaveStudent}
                isSaving={data.isSaving}
                timeRangeFilter={data.timeRangeFilter}
                onTimeRangeFilterChange={data.setTimeRangeFilter}
                attendanceSummary={data.attendanceSummary}
                attendanceChartData={data.attendanceChartData}
                isLoading={data.isLoading}
                filteredByTimeRange={data.filteredByTimeRange}
                selectedDate={data.selectedDate}
                studentsByClass={data.studentsByClass}
                studentAttendanceStates={data.studentAttendanceStates}
                classTeachersMap={data.classTeachersMap}
                attendanceCheckInLogsMap={data.attendanceLogsMap.checkInMap}
                isMobileMode={data.isMobileMode}
                isTabletMode={data.isTabletMode}
              />
            )}

            {/* 학생별 출결 탭 */}
            {data.selectedSubMenu === 'by-student' && (
              <Container>
                <EmptyState
                  message={`${data.terms.PERSON_LABEL_PRIMARY}별 ${data.terms.ATTENDANCE_LABEL}`}
                  description="준비 중인 기능입니다."
                />
              </Container>
            )}

            {/* 출결기록 탭 */}
            {data.selectedSubMenu === 'history' && (
              <HistoryTab
                attendanceLogs={data.attendanceLogs}
                isLoadingLogs={data.isLoadingLogs}
                classes={data.classes}
                students={data.students}
                filter={data.filter}
                onFilterChange={data.setFilter}
              />
            )}

            {/* 출결통계 탭 */}
            {data.selectedSubMenu === 'statistics' && (
              <StatisticsTab attendanceLogs={data.attendanceLogs} />
            )}

            {/* 출결설정 탭 */}
            {data.selectedSubMenu === 'settings' && (
              <SettingsTab config={data.config} />
            )}
          </Suspense>
        </div>
      </div>
    </ErrorBoundary>
  );
}
