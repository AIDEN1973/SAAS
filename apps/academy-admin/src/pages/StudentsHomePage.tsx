/**
 * 학생 관리 홈 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * 학생 관리 전용 대시보드 (통계, 빠른 액션, 최근 활동)
 * 아키텍처 문서 3.1.1 섹션 참조
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
// [SSOT] Barrel export를 통한 통합 import
import { ROUTES, STUDENTS_SUB_MENU_ITEMS, DEFAULT_STUDENTS_SUB_MENU, getSubMenuFromUrl, setSubMenuToUrl } from '../constants';
import type { StudentsSubMenuId } from '../constants';
import { ErrorBoundary, Container, Button, PageHeader, SubSidebar, useResponsiveMode, isMobile } from '@ui-core/react';
import { createSafeNavigate } from '../utils';
import { StudentStatsCard } from '../components/dashboard-cards/StudentStatsCard';
import { AttendanceStatsCard } from '../components/dashboard-cards/AttendanceStatsCard';
import { StudentAlertsCard } from '../components/dashboard-cards/StudentAlertsCard';
import { ConsultationStatsCard } from '../components/dashboard-cards/ConsultationStatsCard';
import { QuickActionCard } from '../components/dashboard-cards/QuickActionCard';
import { RecentActivityCard } from '../components/dashboard-cards/RecentActivityCard';
import { useStudentStats, useAttendanceStats, useStudentAlerts, useConsultationStats, useRecentActivity } from '@hooks/use-student';
import { CardGridLayout } from '../components/CardGridLayout';

export function StudentsHomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = useResponsiveMode();
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);

  // [P0-2 수정] SSOT: 네비게이션 보안 유틸리티 사용
  const safeNavigate = useMemo(
    () => createSafeNavigate(navigate),
    [navigate]
  );

  // 서브 메뉴 상태
  const validIds = STUDENTS_SUB_MENU_ITEMS.map(item => item.id) as readonly StudentsSubMenuId[];
  const [selectedSubMenu, setSelectedSubMenu] = useState<StudentsSubMenuId>(() =>
    getSubMenuFromUrl(searchParams, validIds, DEFAULT_STUDENTS_SUB_MENU)
  );

  const handleSubMenuChange = (id: StudentsSubMenuId) => {
    setSelectedSubMenu(id);
    const newUrl = setSubMenuToUrl(id, DEFAULT_STUDENTS_SUB_MENU);
    window.history.replaceState(null, '', newUrl);
  };

  // 통계 Hook 사용 (학생 관리 전용 기능)
  const { data: studentStats, isLoading: isLoadingStats } = useStudentStats();
  const { data: attendanceStats, isLoading: isLoadingAttendance } = useAttendanceStats(new Date());
  const { data: studentAlerts, isLoading: isLoadingAlerts } = useStudentAlerts();
  const { data: consultationStats, isLoading: isLoadingConsultation } = useConsultationStats();
  const { data: recentActivity, isLoading: isLoadingActivity } = useRecentActivity();

  const handleViewAllStudents = () => {
    safeNavigate(ROUTES.STUDENTS_LIST);
  };

  const handleStatsClick = () => {
    safeNavigate(ROUTES.STUDENTS_LIST);
  };

  const handleAlertsClick = (type: 'risk' | 'absent' | 'consultation') => {
    // [SSOT] ROUTES 상수 사용
    switch (type) {
      case 'risk':
        safeNavigate(ROUTES.STUDENTS_RISK);
        break;
      case 'absent':
        safeNavigate(ROUTES.STUDENTS_ABSENT);
        break;
      case 'consultation':
        safeNavigate(ROUTES.STUDENTS_CONSULTATION);
        break;
    }
  };

  const handleQuickAction = (action: 'register' | 'bulk' | 'list' | 'consultation' | 'attendance') => {
    switch (action) {
      case 'register':
        safeNavigate(ROUTES.STUDENTS_LIST, { state: { showCreateForm: true } });
        break;
      case 'bulk':
        safeNavigate(ROUTES.STUDENTS_LIST, { state: { showBulkUpload: true } });
        break;
      case 'list':
        safeNavigate(ROUTES.STUDENTS_LIST);
        break;
      case 'consultation':
        safeNavigate(ROUTES.STUDENTS_LIST);
        break;
      case 'attendance':
        safeNavigate(ROUTES.ATTENDANCE);
        break;
    }
  };

  const handleActivityClick = (type: 'student' | 'consultation' | 'attendance' | 'tag', id?: string) => {
    switch (type) {
      case 'student':
        if (id) safeNavigate(ROUTES.STUDENT_DETAIL(id, 'info'));
        break;
      case 'consultation':
        if (id) safeNavigate(ROUTES.STUDENT_DETAIL(id, 'consultations'));
        break;
      case 'attendance':
        safeNavigate(ROUTES.ATTENDANCE);
        break;
      case 'tag':
        safeNavigate(ROUTES.STUDENTS_LIST);
        break;
    }
  };

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', height: 'var(--height-full)' }}>
        {/* 서브 사이드바 (모바일에서는 숨김) */}
        {!isMobileMode && (
          <SubSidebar
            title="학생관리"
            items={STUDENTS_SUB_MENU_ITEMS}
            selectedId={selectedSubMenu}
            onSelect={handleSubMenuChange}
            testId="students-sub-sidebar"
          />
        )}

        {/* 메인 콘텐츠 */}
        <Container maxWidth="xl" padding="lg" style={{ flex: 1, overflow: 'auto' }}>
          {/* 헤더 섹션 */}
          <PageHeader
            title="학생 관리"
            actions={
              <Button
                variant="solid"
                onClick={handleViewAllStudents}
              >
                전체 학생 보기
              </Button>
            }
          />

        {/* 통계 카드 그룹 */}
        <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
          <CardGridLayout
            cards={[
              <StudentStatsCard
                key="student-stats"
                stats={studentStats}
                isLoading={isLoadingStats}
                onAction={handleStatsClick}
              />,
              <AttendanceStatsCard
                key="attendance-stats"
                stats={attendanceStats}
                isLoading={isLoadingAttendance}
                onAction={handleStatsClick}
              />,
              <StudentAlertsCard
                key="student-alerts"
                alerts={studentAlerts}
                isLoading={isLoadingAlerts}
                onAction={handleAlertsClick}
              />,
              <ConsultationStatsCard
                key="consultation-stats"
                stats={consultationStats}
                isLoading={isLoadingConsultation}
                onAction={handleStatsClick}
              />,
            ]}
            desktopColumns={3}
            tabletColumns={2}
            mobileColumns={1}
          />
        </div>

        {/* 빠른 작업 섹션 */}
        <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <h2 style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text)',
              marginBottom: 'var(--spacing-xs)',
            }}>
              빠른 작업
            </h2>
          </div>
          <QuickActionCard onAction={handleQuickAction} />
        </div>

        {/* 최근 활동 섹션 */}
        <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <h2 style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text)',
              marginBottom: 'var(--spacing-xs)',
            }}>
              최근 활동
            </h2>
          </div>
          <RecentActivityCard
            activity={recentActivity}
            isLoading={isLoadingActivity}
            onAction={handleActivityClick}
          />
          </div>
        </Container>
      </div>
    </ErrorBoundary>
  );
}
