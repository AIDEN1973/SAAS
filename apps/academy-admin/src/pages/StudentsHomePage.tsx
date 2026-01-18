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

import React, { useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
// [SSOT] Barrel export를 통한 통합 import
import { ROUTES, STUDENTS_SUB_MENU_ITEMS, DEFAULT_STUDENTS_SUB_MENU, STUDENTS_MENU_LABEL_MAPPING, getSubMenuFromUrl, setSubMenuToUrl, applyDynamicLabels } from '../constants';
import type { StudentsSubMenuId } from '../constants';
import { ErrorBoundary, Container, Button, PageHeader, SubSidebar, useResponsiveMode, isMobile, Card, useModal, EmptyState, NotificationCardLayout } from '@ui-core/react';
import { createSafeNavigate, templates, p } from '../utils';
import { StudentStatsCard } from '../components/dashboard-cards/StudentStatsCard';
import { AttendanceStatsCard } from '../components/dashboard-cards/AttendanceStatsCard';
import { StudentAlertsCard } from '../components/dashboard-cards/StudentAlertsCard';
import { ConsultationStatsCard } from '../components/dashboard-cards/ConsultationStatsCard';
import { QuickActionCard } from '../components/dashboard-cards/QuickActionCard';
import { RecentActivityCard } from '../components/dashboard-cards/RecentActivityCard';
import { useStudentStats, useAttendanceStats, useStudentAlerts, useConsultationStats, useRecentActivity, useStudents } from '@hooks/use-student';
import { CardGridLayout } from '../components/CardGridLayout';
import { List, UserPlus, Tags, TrendingUp, Users, UserCheck, UserX, Clock, BarChart3, PieChart, GraduationCap } from 'lucide-react';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { SchemaForm } from '@schema-engine';
import { studentFormSchema } from '../schemas/student.schema';
import { useSchema } from '@hooks/use-schema';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import type { Student, StudentStatus } from '@services/student-service';

export function StudentsHomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = useResponsiveMode();
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const { showAlert } = useModal();
  const terms = useIndustryTerms();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const queryClient = useQueryClient();

  // [P0-2 수정] SSOT: 네비게이션 보안 유틸리티 사용
  const safeNavigate = useMemo(
    () => createSafeNavigate(navigate),
    [navigate]
  );

  // 학생 등록 폼 상태
  const { data: schemaData } = useSchema('student', studentFormSchema, 'form');
  const schema = schemaData || studentFormSchema;

  // TODO: 태그 관리 기능은 태그 관련 hooks가 구현되면 활성화
  // const [newTagName, setNewTagName] = useState('');
  // const [newTagColor, setNewTagColor] = useState('#3B82F6');

  // 서브 메뉴 상태 (URL에서 직접 읽음 - AttendancePage 패턴)
  const validIds = STUDENTS_SUB_MENU_ITEMS.map(item => item.id) as readonly StudentsSubMenuId[];
  const selectedSubMenu = getSubMenuFromUrl(searchParams, validIds, DEFAULT_STUDENTS_SUB_MENU);

  const handleSubMenuChange = useCallback((id: StudentsSubMenuId) => {
    const newUrl = setSubMenuToUrl(id, DEFAULT_STUDENTS_SUB_MENU);
    navigate(newUrl);
  }, [navigate]);

  // [업종중립] 동적 라벨 + 아이콘이 적용된 서브 메뉴 아이템
  const subMenuItemsWithIcons = useMemo(() => {
    const iconMap: Record<StudentsSubMenuId, React.ReactNode> = {
      list: <List size={16} />,
      add: <UserPlus size={16} />,
      tags: <Tags size={16} />,
      statistics: <TrendingUp size={16} />,
      consultations: <TrendingUp size={16} />,
      'class-assignment': <GraduationCap size={16} />,
    };

    // 먼저 동적 라벨 적용
    const itemsWithDynamicLabels = applyDynamicLabels(STUDENTS_SUB_MENU_ITEMS, STUDENTS_MENU_LABEL_MAPPING, terms);

    // 그 다음 아이콘 추가
    return itemsWithDynamicLabels.map(item => ({
      ...item,
      icon: iconMap[item.id],
    }));
  }, [terms]);

  // 통계 Hook 사용 (학생 관리 전용 기능)
  const { data: studentStats, isLoading: isLoadingStats } = useStudentStats();
  const { data: attendanceStats, isLoading: isLoadingAttendance } = useAttendanceStats(new Date());
  const { data: studentAlerts, isLoading: isLoadingAlerts } = useStudentAlerts();
  const { data: consultationStats, isLoading: isLoadingConsultation } = useConsultationStats();
  const { data: recentActivity, isLoading: isLoadingActivity } = useRecentActivity();

  // 학생 목록 데이터
  const { data: students, isLoading: isLoadingStudents } = useStudents();

  // 학생 생성
  const createStudent = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await apiClient.post<Student>('persons', {
        ...data,
        person_type: 'student',
      });
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
      showAlert(`${terms.PERSON_LABEL_PRIMARY}${p.이가(terms.PERSON_LABEL_PRIMARY)} 등록되었습니다.`, terms.MESSAGES.SUCCESS);
    },
    onError: (error: Error) => {
      showAlert(error.message, terms.MESSAGES.ERROR);
    },
  });

  // TODO: 태그 관리 핸들러는 태그 관련 hooks가 구현되면 활성화
  // const handleCreateTag = useCallback(async () => {
  //   if (!newTagName.trim()) {
  //     showAlert('태그 이름을 입력해주세요.', terms.MESSAGES.ERROR);
  //     return;
  //   }
  //   try {
  //     await createTag.mutateAsync({
  //       name: newTagName.trim(),
  //       color: newTagColor,
  //       category: 'general',
  //     });
  //     setNewTagName('');
  //     showAlert('태그가 생성되었습니다.', terms.MESSAGES.SUCCESS);
  //   } catch (error) {
  //     showAlert(error instanceof Error ? error.message : '태그 생성에 실패했습니다.', terms.MESSAGES.ERROR);
  //   }
  // }, [newTagName, newTagColor, createTag, showAlert, terms]);

  // const handleDeleteTag = useCallback(async (tagId: string) => {
  //   try {
  //     await deleteTag.mutateAsync(tagId);
  //     showAlert('태그가 삭제되었습니다.', terms.MESSAGES.SUCCESS);
  //   } catch (error) {
  //     showAlert(error instanceof Error ? error.message : '태그 삭제에 실패했습니다.', terms.MESSAGES.ERROR);
  //   }
  // }, [deleteTag, showAlert, terms]);

  // 학생 통계 계산
  const studentStatistics = useMemo(() => {
    if (!students) return null;

    const total = students.length;
    const active = students.filter(s => (s as Student & { status?: StudentStatus }).status === 'active').length;
    const onLeave = students.filter(s => (s as Student & { status?: StudentStatus }).status === 'on_leave').length;
    const graduated = students.filter(s => (s as Student & { status?: StudentStatus }).status === 'graduated').length;
    const withdrawn = students.filter(s => (s as Student & { status?: StudentStatus }).status === 'withdrawn').length;

    // 학년별 분포
    const gradeDistribution: Record<string, number> = {};
    students.forEach(s => {
      const grade = s.grade || '미지정';
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    });

    // 성별 분포
    const genderDistribution = {
      male: students.filter(s => (s as Student & { gender?: string }).gender === 'male').length,
      female: students.filter(s => (s as Student & { gender?: string }).gender === 'female').length,
      other: students.filter(s => {
        const gender = (s as Student & { gender?: string }).gender;
        return !gender || (gender !== 'male' && gender !== 'female');
      }).length,
    };

    return {
      total,
      active,
      onLeave,
      graduated,
      withdrawn,
      gradeDistribution,
      genderDistribution,
    };
  }, [students]);

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
      <div style={{ display: 'flex', minHeight: 'var(--height-full)' }}>
        {/* 서브 사이드바 (모바일에서는 숨김) */}
        {!isMobileMode && (
          <SubSidebar
            title={templates.management(terms.PERSON_LABEL_PRIMARY)}
            items={subMenuItemsWithIcons}
            selectedId={selectedSubMenu}
            onSelect={handleSubMenuChange}
            testId="students-sub-sidebar"
          />
        )}

        {/* 메인 콘텐츠 */}
        <Container key={selectedSubMenu} maxWidth="xl" padding="lg" style={{ flex: 1 }}>
          {/* 헤더 섹션 */}
          <PageHeader
            title={subMenuItemsWithIcons.find(item => item.id === selectedSubMenu)?.label || templates.management(terms.PERSON_LABEL_PRIMARY)}
            actions={
              selectedSubMenu === 'list' ? (
                <Button
                  variant="solid"
                  onClick={handleViewAllStudents}
                >
                  전체 {terms.PERSON_LABEL_PRIMARY} 보기
                </Button>
              ) : selectedSubMenu === 'add' ? (
                <Button
                  variant="solid"
                  onClick={() => {
                    // Navigate to add student page or open create form
                  }}
                >
                  {terms.PERSON_LABEL_PRIMARY} 등록
                </Button>
              ) : undefined
            }
          />

          {/* 학생 목록 탭 */}
          {selectedSubMenu === 'list' && (
            <>
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
            </>
          )}

          {/* 학생 등록 탭 */}
          {selectedSubMenu === 'add' && (
            <Card padding="lg">
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  marginBottom: 'var(--spacing-xs)',
                }}>
                  새 {terms.PERSON_LABEL_PRIMARY} 등록
                </h3>
                <p style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-sm)',
                }}>
                  {terms.PERSON_LABEL_PRIMARY} 정보를 입력하여 등록합니다.
                </p>
              </div>
              {schema && (
                <SchemaForm
                  schema={schema}
                  onSubmit={(data: Record<string, unknown>) => {
                    void createStudent.mutateAsync(data);
                  }}
                  defaultValues={{}}
                  actionContext={{
                    apiCall: async (endpoint: string, method: string, body?: unknown) => {
                      if (method === 'POST') {
                        const response = await apiClient.post(endpoint, body as Record<string, unknown>);
                        if (response.error) {
                          throw new Error(response.error.message);
                        }
                        return response.data;
                      }
                      const response = await apiClient.get(endpoint);
                      if (response.error) {
                        throw new Error(response.error.message);
                      }
                      return response.data;
                    },
                    showToast: (message: string, variant?: string) => {
                      showAlert(message, variant === 'success' ? terms.MESSAGES.SUCCESS : variant === 'error' ? terms.MESSAGES.ERROR : terms.MESSAGES.ALERT);
                    },
                  }}
                />
              )}
            </Card>
          )}

          {/* 태그 관리 탭 */}
          {selectedSubMenu === 'tags' && (
            <Card padding="lg">
              <EmptyState
                icon={Tags}
                message="태그 관리 기능은 준비 중입니다."
                description="태그 관련 API hooks가 구현되면 활성화됩니다."
              />
            </Card>
          )}

          {/* 학생 통계 탭 */}
          {selectedSubMenu === 'statistics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
              {/* 요약 통계 */}
              <CardGridLayout
                cards={[
                  <NotificationCardLayout
                    key="total"
                    icon={<Users />}
                    title={`전체 ${terms.PERSON_LABEL_PRIMARY}`}
                    value={studentStatistics?.total || 0}
                    unit="명"
                    layoutMode="stats"
                    iconBackgroundColor="var(--color-primary-50)"
                  />,
                  <NotificationCardLayout
                    key="active"
                    icon={<UserCheck />}
                    title="활성"
                    value={studentStatistics?.active || 0}
                    unit="명"
                    layoutMode="stats"
                    iconBackgroundColor="var(--color-success-50)"
                  />,
                  <NotificationCardLayout
                    key="onLeave"
                    icon={<Clock />}
                    title="휴학"
                    value={studentStatistics?.onLeave || 0}
                    unit="명"
                    layoutMode="stats"
                    iconBackgroundColor="var(--color-warning-50)"
                  />,
                  <NotificationCardLayout
                    key="graduated"
                    icon={<UserCheck />}
                    title="졸업"
                    value={studentStatistics?.graduated || 0}
                    unit="명"
                    layoutMode="stats"
                    iconBackgroundColor="var(--color-success-50)"
                  />,
                  <NotificationCardLayout
                    key="withdrawn"
                    icon={<UserX />}
                    title="퇴학"
                    value={studentStatistics?.withdrawn || 0}
                    unit="명"
                    layoutMode="stats"
                    iconBackgroundColor="var(--color-error-50)"
                  />,
                ]}
                desktopColumns={4}
                tabletColumns={2}
                mobileColumns={2}
              />

              {/* 학년별 분포 */}
              <Card padding="lg">
                <h3 style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  marginBottom: 'var(--spacing-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                }}>
                  <BarChart3 size={20} />
                  {terms.GRADE_LABEL}별 분포
                </h3>
                {isLoadingStudents ? (
                  <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                    {terms.MESSAGES.LOADING}
                  </div>
                ) : studentStatistics?.gradeDistribution ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                    {Object.entries(studentStatistics.gradeDistribution)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([grade, count]) => {
                        const percentage = studentStatistics.total > 0 ? (count / studentStatistics.total) * 100 : 0;
                        return (
                          <div key={grade} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                            <div style={{ width: '80px', fontWeight: 'var(--font-weight-medium)' }}>
                              {grade}{grade !== '미지정' && terms.GRADE_LABEL}
                            </div>
                            <div style={{
                              flex: 1,
                              height: '24px',
                              backgroundColor: 'var(--color-gray-100)',
                              borderRadius: 'var(--border-radius-sm)',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                width: `${percentage}%`,
                                height: '100%',
                                backgroundColor: 'var(--color-primary)',
                                borderRadius: 'var(--border-radius-sm)',
                                transition: 'width 0.3s ease',
                              }} />
                            </div>
                            <div style={{ width: '80px', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                              {count}명 ({percentage.toFixed(1)}%)
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <EmptyState icon={BarChart3} message="통계 데이터가 없습니다." />
                )}
              </Card>

              {/* 성별 분포 */}
              <Card padding="lg">
                <h3 style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  marginBottom: 'var(--spacing-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                }}>
                  <PieChart size={20} />
                  성별 분포
                </h3>
                {isLoadingStudents ? (
                  <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                    {terms.MESSAGES.LOADING}
                  </div>
                ) : studentStatistics?.genderDistribution ? (
                  <div style={{ display: 'flex', gap: 'var(--spacing-xl)', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: 'var(--border-radius-full)',
                        backgroundColor: 'var(--color-blue-100)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--spacing-sm)',
                        fontSize: 'var(--font-size-xl)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--color-blue-600)',
                      }}>
                        {studentStatistics.genderDistribution.male}
                      </div>
                      <div style={{ fontWeight: 'var(--font-weight-medium)' }}>남</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: 'var(--border-radius-full)',
                        backgroundColor: 'var(--color-pink-100)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--spacing-sm)',
                        fontSize: 'var(--font-size-xl)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--color-pink-600)',
                      }}>
                        {studentStatistics.genderDistribution.female}
                      </div>
                      <div style={{ fontWeight: 'var(--font-weight-medium)' }}>여</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: 'var(--border-radius-full)',
                        backgroundColor: 'var(--color-gray-100)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--spacing-sm)',
                        fontSize: 'var(--font-size-xl)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--color-gray-600)',
                      }}>
                        {studentStatistics.genderDistribution.other}
                      </div>
                      <div style={{ fontWeight: 'var(--font-weight-medium)' }}>기타/미지정</div>
                    </div>
                  </div>
                ) : (
                  <EmptyState icon={PieChart} message="통계 데이터가 없습니다." />
                )}
              </Card>
            </div>
          )}
        </Container>
      </div>
    </ErrorBoundary>
  );
}
