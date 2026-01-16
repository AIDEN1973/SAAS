/**
 * 수업 관리 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 수업 리스트 + 캘린더 뷰 생성 (Calendar-like) 제공
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorBoundary, useModal, useResponsiveMode , Container, Card, Button, Modal, Drawer, PageHeader, isMobile, isTablet, DataTable, NotificationCardLayout, SubSidebar } from '@ui-core/react';
// [SSOT] Barrel export를 통한 통합 import
import { CLASSES_SUB_MENU_ITEMS, DEFAULT_CLASSES_SUB_MENU, getSubMenuFromUrl, setSubMenuToUrl } from '../constants';
import type { ClassesSubMenuId } from '../constants';
import { BookOpen, Users, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { SchemaForm } from '@schema-engine';
import { apiClient } from '@api-sdk/core';
import { useSchema } from '@hooks/use-schema';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { toKST } from '@lib/date-utils';
import {
  useClasses,
  useClass,
  useCreateClass,
  useUpdateClass,
  useDeleteClass,
  // useClassStatistics, // TODO: 통계 기능 구현 시 사용
  useTeachers,
  useCheckScheduleConflicts,
  useClassTeachers,
} from '@hooks/use-class';
import type { Class, CreateClassInput, UpdateClassInput, ClassFilter, ClassStatus, DayOfWeek, Teacher } from '@services/class-service';
import { createClassFormSchema } from '../schemas/class.schema';
import type { FormSchema } from '@schema-engine/types';
import { CardGridLayout } from '../components/CardGridLayout';

const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: '월요일' },
  { value: 'tuesday', label: '화요일' },
  { value: 'wednesday', label: '수요일' },
  { value: 'thursday', label: '목요일' },
  { value: 'friday', label: '금요일' },
  { value: 'saturday', label: '토요일' },
  { value: 'sunday', label: '일요일' },
];

/**
 * 통계 카드 컴포넌트
 */
function StatisticsCards() {
  const terms = useIndustryTerms();
  const { data: allClasses, isLoading } = useClasses({});

  // 통계 계산
  const statistics = useMemo(() => {
    if (!allClasses) return { total: 0, active: 0, inactive: 0, totalStudents: 0 };

    return {
      total: allClasses.length,
      active: allClasses.filter(c => c.status === 'active').length,
      inactive: allClasses.filter(c => c.status !== 'active').length,
      totalStudents: allClasses.reduce((sum, c) => sum + (c.current_count || 0), 0),
    };
  }, [allClasses]);

  return (
    <div style={{ marginBottom: 'var(--spacing-xl)', pointerEvents: isLoading ? 'none' : 'auto', opacity: isLoading ? 'var(--opacity-loading)' : 'var(--opacity-full)' }}>
      <CardGridLayout
        cards={[
          <NotificationCardLayout
            key="total"
            icon={<BookOpen />}
            title={`전체 ${terms.GROUP_LABEL_PLURAL}`}
            value={statistics.total}
            unit="개"
            layoutMode="stats"
            iconBackgroundColor="var(--color-gray-100)"
          />,
          <NotificationCardLayout
            key="active"
            icon={<CheckCircle />}
            title={`활성 ${terms.GROUP_LABEL}`}
            value={statistics.active}
            unit="개"
            layoutMode="stats"
            iconBackgroundColor="var(--color-success-50)"
          />,
          <NotificationCardLayout
            key="inactive"
            icon={<XCircle />}
            title={`비활성 ${terms.GROUP_LABEL}`}
            value={statistics.inactive}
            unit="개"
            layoutMode="stats"
            iconBackgroundColor="var(--color-gray-100)"
          />,
          <NotificationCardLayout
            key="students"
            icon={<Users />}
            title={`전체 ${terms.PERSON_LABEL_PRIMARY} 수`}
            value={statistics.totalStudents}
            unit="명"
            layoutMode="stats"
            iconBackgroundColor="var(--color-primary-50)"
          />,
        ]}
        desktopColumns={4}
        tabletColumns={2}
        mobileColumns={2}
      />
    </div>
  );
}

export function ClassesPage() {
  const { showConfirm, showAlert } = useModal();
  const { id: urlClassId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = useResponsiveMode();
  const terms = useIndustryTerms();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);

  // 서브 메뉴 상태
  const validIds = CLASSES_SUB_MENU_ITEMS.map(item => item.id) as readonly ClassesSubMenuId[];
  const selectedSubMenu = getSubMenuFromUrl(searchParams, validIds, DEFAULT_CLASSES_SUB_MENU);

  const handleSubMenuChange = useCallback((id: ClassesSubMenuId) => {
    const newUrl = setSubMenuToUrl(id, DEFAULT_CLASSES_SUB_MENU);
    navigate(newUrl);
  }, [navigate]);

  // localStorage 기반 상태 초기화 (SSR Safe, AutomationSettingsPage 패턴 적용)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(() => {
    try {
      const stored = localStorage.getItem('classes-page-view-mode');
      return stored === 'calendar' ? 'calendar' : 'list';
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn('ClassesPage: localStorage 접근 실패, 기본값 사용', { error });
      }
      return 'list';
    }
  });

  const [filter, setFilter] = useState<ClassFilter>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  // URL 파라미터로 클래스 ID가 전달되면 자동으로 상세 모달 열기
  useEffect(() => {
    if (urlClassId) {
      setEditingClassId(urlClassId);
    }
  }, [urlClassId]);

  // 상세 모달 닫을 때 URL도 업데이트
  const handleCloseEditModal = useCallback(() => {
    setEditingClassId(null);
    // URL에서 ID가 있었다면 기본 classes 페이지로 이동
    if (urlClassId) {
      navigate('/classes', { replace: true });
    }
  }, [urlClassId, navigate]);

  // Today-First 기준: 기본값은 false (localStorage 기반 지속성)
  const [showAllClasses, setShowAllClasses] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('classes-page-show-all');
      return stored === 'true';
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn('ClassesPage: localStorage 접근 실패, 기본값 사용', { error });
      }
      return false;
    }
  });

  // Today-First 기준: 기본적으로 오늘 수업 있는 반만 필터링
  // 기술문서 5-2: KST 기준 날짜 처리
  // P0-3: search 필터가 있으면 Today-First 우선순위 해제
  const todayFilter: ClassFilter = useMemo(() => {
    if (showAllClasses) {
      return filter; // 전체 수업 보기 모드
    }

    // P0-3: search 필터가 있으면 day_of_week 필터 적용 안 함
    if (filter.search && filter.search.trim().length > 0) {
      return {
        ...filter,
        status: 'active', // 활성 반만
      };
    }

    // 오늘 요일 계산 (월요일=1, 일요일=0) - KST 기준
    const todayKST = toKST();
    const dayOfWeek = todayKST.day(); // 0(일) ~ 6(토)
    const dayOfWeekMap: Record<number, DayOfWeek> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };
    const todayDayOfWeek = dayOfWeekMap[dayOfWeek];

    return {
      ...filter,
      day_of_week: filter.day_of_week || todayDayOfWeek, // 사용자 선택 요일 우선, 없으면 오늘 요일
      status: 'active', // 활성 반만
    };
  }, [filter, showAllClasses]);

  const { data: classes, isLoading, error } = useClasses({
    ...todayFilter,
    search: todayFilter.search?.trim() || undefined, // 빈 문자열이면 undefined로 변환
  });
  const { data: teachers } = useTeachers();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();

  // Schema Registry 연동 (아키텍처 문서 S3 참조)
  const { data: classFormSchemaData } = useSchema('class', createClassFormSchema(teachers || [], terms), 'form');

  // Fallback: Registry에서 조회 실패 시 로컬 스키마 사용
  const effectiveFormSchema = classFormSchemaData || createClassFormSchema(teachers || [], terms);

  // 뷰 모드 토글 핸들러 (localStorage 지속성)
  const handleToggleViewMode = useCallback((mode: 'list' | 'calendar') => {
    setViewMode(mode);
    try {
      localStorage.setItem('classes-page-view-mode', mode);
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn('ClassesPage: localStorage 저장 실패', { error });
      }
    }
  }, []);

  // 전체 보기 토글 핸들러 (localStorage 지속성)
  const handleToggleShowAll = useCallback((checked: boolean) => {
    setShowAllClasses(checked);
    try {
      localStorage.setItem('classes-page-show-all', String(checked));
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn('ClassesPage: localStorage 저장 실패', { error });
      }
    }
  }, []);

  // const handleFilterChange = useCallback((filters: Record<string, unknown>) => {
  //   setFilter({
  //     search: filters.search ? String(filters.search) : undefined,
  //     status: filters.status as ClassStatus | ClassStatus[] | undefined,
  //     day_of_week: filters.day_of_week as DayOfWeek | undefined,
  //   });
  //   // Promise 반환 없음
  // }, []); // TODO: 필터 기능 구현 시 사용

  const checkConflicts = useCheckScheduleConflicts();

  const handleCreateClass = async (input: CreateClassInput) => {
    try {
      // 시간 범위 검증
      if (input.start_time >= input.end_time) {
        showAlert('시작 시간은 종료 시간보다 빨라야 합니다.', '입력 오류', 'error');
        return;
      }

      // 일정 충돌 감지 (디어쌤_아키텍처.md 3.2.2)
      // Note: RPC 함수가 없어도 수업 생성은 계속 진행
      try {
        const conflictResult = await checkConflicts.mutateAsync({
          dayOfWeek: input.day_of_week,
          startTime: input.start_time,
          endTime: input.end_time,
          teacherIds: input.teacher_ids,
          room: input.room,
        });

        // 충돌이 있으면 사용자 확인
        if (conflictResult.has_conflicts) {
          const conflictMessages = conflictResult.conflicts.map((c) => c.message).join('\n');
          const confirmed = await showConfirm(
            `다음 충돌이 발견되었습니다:\n\n${conflictMessages}\n\n그래도 생성하시겠습니까?`,
            '일정 충돌 감지'
          );
          if (!confirmed) {
            return;
          }
        }
      } catch (conflictError) {
        // 충돌 감지 실패 시 경고만 표시하고 계속 진행
        if (import.meta.env?.DEV) {
          console.warn('일정 충돌 감지 실패:', conflictError);
        }
      }

      // P0-2: useCreateClass Hook이 DB RPC로 트랜잭션 처리하므로 직접 호출만 하면 됨
      await createClass.mutateAsync(input);
      setShowCreateForm(false);
    } catch (error) {
      // 에러는 showAlert로 사용자에게 표시 (아키텍처 문서 6-3 참조)
      showAlert(
        error instanceof Error ? error.message : `${terms.GROUP_LABEL} 생성에 실패했습니다.`,
        '오류',
        'error'
      );
    }
  };

  const handleUpdateClass = async (classId: string, input: UpdateClassInput) => {
    try {
      // 시간 범위 검증
      if (input.start_time && input.end_time && input.start_time >= input.end_time) {
        showAlert('시작 시간은 종료 시간보다 빨라야 합니다.', '입력 오류', 'error');
        return;
      }

      // 일정 변경이 있으면 충돌 감지
      // Note: RPC 함수가 없어도 수업 수정은 계속 진행
      if (input.day_of_week || input.start_time || input.end_time || input.teacher_ids || input.room) {
        const classData = classes?.find((c) => c.id === classId);
        if (classData) {
          try {
            const conflictResult = await checkConflicts.mutateAsync({
              classId,
              dayOfWeek: input.day_of_week || classData.day_of_week,
              startTime: input.start_time || classData.start_time,
              endTime: input.end_time || classData.end_time,
              teacherIds: input.teacher_ids,
              room: input.room || classData.room,
            });

            if (conflictResult.has_conflicts) {
              const conflictMessages = conflictResult.conflicts.map((c) => c.message).join('\n');
              const confirmed = await showConfirm(
                `다음 충돌이 발견되었습니다:\n\n${conflictMessages}\n\n그래도 수정하시겠습니까?`,
                '일정 충돌 감지'
              );
              if (!confirmed) {
                return;
              }
            }
          } catch (conflictError) {
            // 충돌 감지 실패 시 경고만 표시하고 계속 진행
            if (import.meta.env?.DEV) {
              console.warn('일정 충돌 감지 실패:', conflictError);
            }
          }
        }
      }

      await updateClass.mutateAsync({ classId, input });
      handleCloseEditModal();
    } catch (error) {
      // 에러는 showAlert로 사용자에게 표시 (아키텍처 문서 6-3 참조)
      showAlert(
        error instanceof Error ? error.message : `${terms.GROUP_LABEL} 수정에 실패했습니다.`,
        '오류',
        'error'
      );
    }
  };

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', height: 'var(--height-full)' }}>
        {/* 서브 사이드바 (모바일에서는 숨김) */}
        {!isMobileMode && (
          <SubSidebar
            title={`${terms.GROUP_LABEL}관리`}
            items={CLASSES_SUB_MENU_ITEMS}
            selectedId={selectedSubMenu}
            onSelect={handleSubMenuChange}
            testId="classes-sub-sidebar"
          />
        )}

        {/* 메인 콘텐츠 */}
        <Container maxWidth="xl" padding="lg" style={{ flex: 1 }}>
          <PageHeader
            title={CLASSES_SUB_MENU_ITEMS.find(item => item.id === selectedSubMenu)?.label || `${terms.GROUP_LABEL}관리`}
            actions={
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <Button
                  variant={showAllClasses ? 'outline' : 'solid'}
                  size="sm"
                  onClick={() => handleToggleShowAll(!showAllClasses)}
                >
                  {showAllClasses ? `오늘 ${terms.GROUP_LABEL}만` : `전체 ${terms.GROUP_LABEL_PLURAL} 보기`}
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleToggleViewMode('list')}
                >
                  리스트
                </Button>
                <Button
                  variant={viewMode === 'calendar' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleToggleViewMode('calendar')}
                >
                  캘린더
                </Button>
                <Button
                  variant="solid"
                  size="sm"
                  onClick={() => setShowCreateForm(!showCreateForm)}
                >
                  {terms.GROUP_LABEL} 생성
                </Button>
              </div>
            }
          />

          {/* 수업 목록 탭 (기본) */}
          {selectedSubMenu === 'list' && (
            <>
              {/* 통계 카드 */}
              <StatisticsCards />

              {/* 수업 생성 폼 - 반응형: 모바일/태블릿은 드로어, 데스크톱은 인라인 */}
          {showCreateForm && (
            <>
              {isMobileMode || isTabletMode ? (
                // 모바일/태블릿: Drawer 사용 (아키텍처 문서 6-1 참조)
                <Drawer
                  isOpen={showCreateForm}
                  onClose={() => setShowCreateForm(false)}
                  title={`${terms.GROUP_LABEL} 생성`}
                  position={isMobileMode ? 'bottom' : 'right'}
                  width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
                >
                  <CreateClassForm
                    effectiveFormSchema={effectiveFormSchema}
                    onSubmit={handleCreateClass}
                    onCancel={() => setShowCreateForm(false)}
                  />
                </Drawer>
              ) : (
                // 데스크톱: 인라인 폼 (기존 방식)
                <CreateClassForm
                  effectiveFormSchema={effectiveFormSchema}
                  onSubmit={(input) => {
                    void handleCreateClass(input);
                  }}
                  onCancel={() => setShowCreateForm(false)}
                />
              )}
            </>
          )}

          {/* 수업 목록 또는 캘린더 뷰 */}
          {isLoading ? (
            <Card padding="lg">
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                로딩 중...
              </div>
            </Card>
          ) : error ? (
            <Card padding="md">
              <div style={{ color: 'var(--color-error)', padding: 'var(--spacing-md)' }}>
                오류: {error.message}
              </div>
            </Card>
          ) : (
            <DataTable
              data={classes || []}
              filters={[
                {
                  type: 'text',
                  columnKey: 'search',
                  label: '검색',
                  placeholder: `${terms.GROUP_LABEL} 이름 검색`,
                },
                {
                  type: 'select',
                  columnKey: 'status',
                  label: '상태',
                  options: [
                    { value: '', label: '전체 상태' },
                    { value: 'active', label: '활성' },
                    { value: 'inactive', label: '비활성' },
                    { value: 'completed', label: '완료' },
                  ],
                },
                {
                  type: 'select',
                  columnKey: 'day_of_week',
                  label: '요일',
                  options: [
                    { value: '', label: '전체 요일' },
                    ...DAYS_OF_WEEK.map(d => ({ value: d.value, label: d.label })),
                  ],
                },
              ]}
              initialFilterState={{
                search: { text: filter.search || '' },
                status: { selected: typeof filter.status === 'string' ? filter.status : '' },
                day_of_week: { selected: filter.day_of_week || '' },
              }}
              onFilterChange={(filterState) => {
                if (filterState.search?.text !== undefined) {
                  setFilter(prev => ({ ...prev, search: filterState.search.text }));
                }
                if (filterState.status?.selected !== undefined) {
                  setFilter(prev => ({ ...prev, status: filterState.status.selected as ClassStatus | undefined }));
                }
                if (filterState.day_of_week?.selected !== undefined) {
                  setFilter(prev => ({ ...prev, day_of_week: filterState.day_of_week.selected as DayOfWeek | undefined }));
                }
              }}
              enableClientSideFiltering={false}
              columns={[
                {
                  key: 'name',
                  label: `${terms.GROUP_LABEL} 이름`,
                  width: '20%',
                  render: (_, classItem) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                      <div
                        style={{
                          width: 'var(--spacing-sm)',
                          height: '100%',
                          backgroundColor: classItem.color,
                          borderRadius: 'var(--border-radius-sm)',
                          minHeight: 'var(--spacing-lg)',
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{classItem.name}</div>
                        {classItem.subject && (
                          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                            {classItem.subject}
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'schedule',
                  label: '일정',
                  width: '20%',
                  render: (_, classItem) => {
                    const dayLabel = DAYS_OF_WEEK.find((d) => d.value === classItem.day_of_week)?.label || classItem.day_of_week;
                    return (
                      <div>
                        <div>{dayLabel}</div>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                          {classItem.start_time} ~ {classItem.end_time}
                        </div>
                      </div>
                    );
                  },
                },
                {
                  key: 'capacity',
                  label: `${terms.CAPACITY_LABEL}`,
                  width: '15%',
                  align: 'center',
                  render: (_, classItem) => (
                    <div>
                      <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                        {classItem.current_count} / {classItem.capacity}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        {((classItem.current_count / classItem.capacity) * 100).toFixed(0)}%
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'room',
                  label: '강의실',
                  width: '15%',
                  align: 'center',
                  render: (value) => (value ? String(value) : '-'),
                },
                {
                  key: 'status',
                  label: '상태',
                  width: '10%',
                  align: 'center',
                  render: (_, classItem) => (
                    <span
                      style={{
                        padding: 'var(--spacing-2xs) var(--spacing-xs)',
                        borderRadius: 'var(--border-radius-sm)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 'var(--font-weight-medium)',
                        backgroundColor: classItem.status === 'active' ? 'var(--color-success-50)' : 'var(--color-gray-100)',
                        color: classItem.status === 'active' ? 'var(--color-success-700)' : 'var(--color-text-secondary)',
                      }}
                    >
                      {classItem.status === 'active' ? '활성' : classItem.status === 'inactive' ? '비활성' : '완료'}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  label: '작업',
                  width: '20%',
                  align: 'right',
                  render: (_, classItem) => (
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', justifyContent: 'flex-end' }}>
                      <Button size="xs" variant="outline" onClick={() => setEditingClassId(classItem.id)}>
                        수정
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={async () => {
                          const confirmed = await showConfirm(
                            `정말 이 ${terms.GROUP_LABEL}을(를) 삭제하시겠습니까?`,
                            `${terms.GROUP_LABEL} 삭제`
                          );
                          if (confirmed) {
                            try {
                              await deleteClass.mutateAsync(classItem.id);
                            } catch (error) {
                              showAlert(
                                error instanceof Error ? error.message : `${terms.GROUP_LABEL} 삭제에 실패했습니다.`,
                                '오류',
                                'error'
                              );
                            }
                          }
                        }}
                      >
                        삭제
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          )}
            </>
          )}

          {/* 수업 편성표(캘린더) 탭 */}
          {selectedSubMenu === 'calendar' && (
            <>
              {isLoading ? (
                <Card padding="lg">
                  <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                    로딩 중...
                  </div>
                </Card>
              ) : (
                <ClassCalendarView classes={classes || []} />
              )}
            </>
          )}

          {/* 수업 통계 탭 */}
          {selectedSubMenu === 'statistics' && (
            <>
              <ClassStatisticsTab />
            </>
          )}

          {/* 일정 충돌 탭 */}
          {selectedSubMenu === 'schedule-conflicts' && (
            <>
              <ScheduleConflictsTab />
            </>
          )}

          {/* 수업 수정 모달 */}
          {editingClassId && (
            <EditClassModal
              classId={editingClassId}
              teachers={teachers || []}
              onSave={handleUpdateClass}
              onClose={handleCloseEditModal}
            />
          )}
        </Container>
      </div>
    </ErrorBoundary>
  );
}

/**
 * 수업 생성 폼
 */
function CreateClassForm({
  effectiveFormSchema,
  onSubmit,
  onCancel,
}: {
  effectiveFormSchema: FormSchema;
  onSubmit: (input: CreateClassInput) => void;
  onCancel: () => void;
}) {
  const mode = useResponsiveMode();
  const terms = useIndustryTerms();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);
  const showHeader = !isMobileMode && !isTabletMode;

  const handleSubmit = (data: Record<string, unknown>) => {
    // 스키마에서 받은 데이터를 CreateClassInput 형식으로 변환
    const input: CreateClassInput = {
      name: String(data.name ?? ''),
      subject: data.subject ? String(data.subject) : undefined,
      grade: data.grade ? String(data.grade) : undefined,
      day_of_week: (data.day_of_week || 'monday') as DayOfWeek,
      start_time: String(data.start_time ?? '14:00'),
      end_time: String(data.end_time ?? '15:30'),
      capacity: Number(data.capacity ?? 20),
      color: data.color ? String(data.color) : undefined,
      room: data.room ? String(data.room) : undefined,
      notes: data.notes ? String(data.notes) : undefined,
      status: (data.status || 'active') as ClassStatus,
      teacher_ids: data.teacher_ids && Array.isArray(data.teacher_ids) && data.teacher_ids.length > 0
        ? data.teacher_ids
        : undefined,
    };
    onSubmit(input);
  };

  return (
    <div style={showHeader ? { marginBottom: 'var(--spacing-md)' } : {}}>
      {showHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>{terms.GROUP_LABEL} 생성</h3>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            취소
          </Button>
        </div>
      )}
      <SchemaForm
        schema={effectiveFormSchema}
        onSubmit={handleSubmit}
        defaultValues={{
          day_of_week: 'monday',
          start_time: '14:00',
          end_time: '15:30',
          capacity: 20,
          status: 'active',
        }}
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
        }}
      />
    </div>
  );
}

/**
 * 수업 수정 모달
 */
function EditClassModal({
  classId,
  teachers,
  onSave,
  onClose,
}: {
  classId: string;
  teachers: Teacher[];
  onSave: (classId: string, input: UpdateClassInput) => Promise<void>;
  onClose: () => void;
}) {
  const { showAlert } = useModal();
  const mode = useResponsiveMode();
  const terms = useIndustryTerms();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);
  const { data: classData, isLoading } = useClass(classId);
  const { data: classTeachers } = useClassTeachers(classId);

  // Schema Registry 연동 (아키텍처 문서 S3 참조)
  const { data: classFormSchemaData } = useSchema('class', createClassFormSchema(teachers || [], terms), 'form');
  const classFormSchema = useMemo(() => classFormSchemaData || createClassFormSchema(teachers || [], terms), [classFormSchemaData, teachers, terms]);

  // 현재 배정된 강사 ID 목록
  const currentTeacherIds = useMemo(
    () => classTeachers?.map((ct) => ct.teacher_id) || [],
    [classTeachers]
  );

  const handleSubmit = (data: Record<string, unknown>) => {
    const input: UpdateClassInput = {
      name: data.name ? String(data.name) : undefined,
      subject: data.subject ? String(data.subject) : undefined,
      grade: data.grade ? String(data.grade) : undefined,
      day_of_week: data.day_of_week as DayOfWeek | undefined,
      start_time: data.start_time ? String(data.start_time) : undefined,
      end_time: data.end_time ? String(data.end_time) : undefined,
      capacity: data.capacity ? Number(data.capacity) : undefined,
      color: data.color ? String(data.color) : undefined,
      room: data.room ? String(data.room) : undefined,
      notes: data.notes ? String(data.notes) : undefined,
      status: data.status as ClassStatus | undefined,
      teacher_ids: data.teacher_ids && Array.isArray(data.teacher_ids) && data.teacher_ids.length > 0
        ? data.teacher_ids
        : undefined,
    };
    void onSave(classId, input);
  };

  // 반응형 처리: 모바일/태블릿은 Drawer, 데스크톱은 Modal (아키텍처 문서 6-1 참조)
  if (isLoading) {
    if (isMobileMode || isTabletMode) {
      return (
        <Drawer
          isOpen={true}
          onClose={onClose}
          title={`${terms.GROUP_LABEL} 수정`}
          position={isMobileMode ? 'bottom' : 'right'}
          width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
        >
          <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>
        </Drawer>
      );
    }
    return (
      <Modal isOpen={true} onClose={onClose} title={`${terms.GROUP_LABEL} 수정`} size="lg">
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>
      </Modal>
    );
  }

  if (!classData) {
    if (isMobileMode || isTabletMode) {
      return (
        <Drawer
          isOpen={true}
          onClose={onClose}
          title={`${terms.GROUP_LABEL} 수정`}
          position={isMobileMode ? 'bottom' : 'right'}
          width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
        >
          <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>{terms.GROUP_LABEL}을(를) 찾을 수 없습니다.</div>
        </Drawer>
      );
    }
    return (
      <Modal isOpen={true} onClose={onClose} title={`${terms.GROUP_LABEL} 수정`} size="lg">
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>{terms.GROUP_LABEL}을(를) 찾을 수 없습니다.</div>
      </Modal>
    );
  }

  const formContent = (
      <SchemaForm
        schema={classFormSchema}
        onSubmit={handleSubmit}
        defaultValues={{
          name: classData.name,
          subject: classData.subject || '',
          grade: classData.grade || '',
          day_of_week: classData.day_of_week,
          start_time: classData.start_time,
          end_time: classData.end_time,
          capacity: classData.capacity,
          color: classData.color || 'var(--color-primary)',
          room: classData.room || '',
          teacher_ids: currentTeacherIds,
          notes: classData.notes || '',
          status: classData.status,
        }}
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
            showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
          },
        }}
      />
  );

  // 모바일/태블릿: Drawer 사용 (아키텍처 문서 6-1 참조)
  if (isMobileMode || isTabletMode) {
    return (
      <Drawer
        isOpen={true}
        onClose={onClose}
        title={`${terms.GROUP_LABEL} 수정`}
        position={isMobileMode ? 'bottom' : 'right'}
        width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
      >
        {formContent}
      </Drawer>
    );
  }

  // 데스크톱: Modal 사용
  return (
    <Modal isOpen={true} onClose={onClose} title={`${terms.GROUP_LABEL} 수정`} size="lg">
      {formContent}
    </Modal>
  );
}

/**
 * 수업 캘린더 뷰
 * [요구사항] 수업 편성표(Calendar-like) 제공
 * 시간대별 그리드 형태로 개선
 */
function ClassCalendarView({ classes }: { classes: Class[] }) {
  const terms = useIndustryTerms();
  // 시간대 생성 (08:00 ~ 22:00, 30분 단위)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 8; hour < 22; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  // 요일별로 수업 그룹화
  const classesByDay = DAYS_OF_WEEK.map((day) => ({
    day,
    classes: classes.filter((c) => c.day_of_week === day.value),
  }));

  // P1-5: 시간대에 해당하는 모든 수업 조회 (겹침 표시)
  const getClassesAtTime = (dayClasses: Class[], timeSlot: string): Class[] => {
    return dayClasses.filter((c) => {
      const start = c.start_time;
      const end = c.end_time;
      return timeSlot >= start && timeSlot < end;
    });
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <Card padding="lg">
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          {terms.GROUP_LABEL} 편성표
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'var(--width-grid-column) repeat(7, 1fr)', gap: 'var(--spacing-xs)', minWidth: 'var(--width-grid-min)' }}>
          {/* 헤더 */}
          <div style={{ padding: 'var(--spacing-sm)', fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)' }}>
            시간
          </div>
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day.value}
              style={{
                padding: 'var(--spacing-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                fontSize: 'var(--font-size-sm)',
                textAlign: 'center',
                backgroundColor: 'var(--color-background-secondary)',
                borderRadius: 'var(--border-radius-sm)',
              }}
            >
            {day.label}
            </div>
          ))}

          {/* 시간대별 행 */}
          {timeSlots.map((timeSlot) => (
            <React.Fragment key={timeSlot}>
              <div
                style={{
                  padding: 'var(--spacing-xs)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  textAlign: 'right',
                }}
              >
                {timeSlot}
              </div>
              {DAYS_OF_WEEK.map((day) => {
                const dayClasses = classesByDay.find((d) => d.day.value === day.value)?.classes || [];
                const classesAtTime = getClassesAtTime(dayClasses, timeSlot);
                const hasClasses = classesAtTime.length > 0;
                const firstClass = classesAtTime[0];
                const isStartTime = firstClass?.start_time === timeSlot;
                const hasOverlap = classesAtTime.length > 1;

                return (
                  <div
                    key={`${day.value}-${timeSlot}`}
                    style={{
                      minHeight: 'var(--height-row-min)',
                      // HARD-CODE-EXCEPTION: padding 0은 레이아웃용 특수 값
                      padding: isStartTime ? 'var(--spacing-xs)' : '0',
                      backgroundColor: hasClasses
                        ? `${firstClass.color}20`
                        : 'transparent',
                      borderLeft: isStartTime ? `var(--border-width-thick) solid ${firstClass.color}` : 'none',
                      // HARD-CODE-EXCEPTION: borderRadius 0은 레이아웃용 특수 값
                      borderRadius: isStartTime ? 'var(--border-radius-sm)' : '0',
                      // P1-5: 겹침 표시 (점선 테두리)
                      border: hasOverlap && isStartTime ? 'var(--border-width-base) dashed var(--color-warning)' : undefined,
                      position: 'relative',
                    }}
                  >
                    {isStartTime && firstClass && (
                      <>
                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)' }}>
                          {firstClass.name}
                        </div>
                        {/* P1-5: 겹침 개수 표시 */}
                        {hasOverlap && (
                          <div
                            style={{
                              fontSize: 'var(--font-size-2xs)',
                              color: 'var(--color-warning)',
                              fontWeight: 'var(--font-weight-bold)',
                              marginTop: 'var(--spacing-2xs)',
                            }}
                          >
                            +{classesAtTime.length - 1} 겹침
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
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

/**
 * 수업 통계 탭 컴포넌트
 * 수업별 상세 통계를 표시
 */
function ClassStatisticsTab() {
  const terms = useIndustryTerms();
  const { data: allClasses, isLoading } = useClasses({});

  // 상세 통계 계산
  const statistics = useMemo(() => {
    if (!allClasses) return null;

    // 요일별 수업 수
    const byDayOfWeek = DAYS_OF_WEEK.reduce((acc, day) => {
      acc[day.value] = allClasses.filter(c => c.day_of_week === day.value).length;
      return acc;
    }, {} as Record<DayOfWeek, number>);

    // 상태별 수업 수
    const byStatus = {
      active: allClasses.filter(c => c.status === 'active').length,
      inactive: allClasses.filter(c => c.status === 'inactive').length,
      archived: allClasses.filter(c => c.status === 'archived').length,
    };

    // 정원 대비 현재 인원 비율
    const capacityStats = allClasses.reduce((acc, c) => {
      const ratio = c.current_count / c.capacity;
      if (ratio >= 0.9) acc.full++;
      else if (ratio >= 0.5) acc.medium++;
      else acc.low++;
      return acc;
    }, { full: 0, medium: 0, low: 0 });

    // 전체 통계
    const totalStudents = allClasses.reduce((sum, c) => sum + (c.current_count || 0), 0);
    const totalCapacity = allClasses.reduce((sum, c) => sum + c.capacity, 0);
    const avgCapacityRatio = totalCapacity > 0 ? (totalStudents / totalCapacity * 100) : 0;

    return {
      total: allClasses.length,
      byDayOfWeek,
      byStatus,
      capacityStats,
      totalStudents,
      totalCapacity,
      avgCapacityRatio,
    };
  }, [allClasses]);

  if (isLoading) {
    return (
      <Card padding="lg">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
          로딩 중...
        </div>
      </Card>
    );
  }

  if (!statistics) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* 기본 통계 카드 */}
      <StatisticsCards />

      {/* 요일별 수업 분포 */}
      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          요일별 {terms.GROUP_LABEL} 분포
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--spacing-sm)' }}>
          {DAYS_OF_WEEK.map(day => (
            <div
              key={day.value}
              style={{
                textAlign: 'center',
                padding: 'var(--spacing-md)',
                backgroundColor: statistics.byDayOfWeek[day.value] > 0 ? 'var(--color-primary-50)' : 'var(--color-gray-50)',
                borderRadius: 'var(--border-radius-md)',
              }}
            >
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                {day.label}
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
                {statistics.byDayOfWeek[day.value]}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>개</div>
            </div>
          ))}
        </div>
      </Card>

      {/* 정원 충족률 분포 */}
      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          정원 충족률 분포
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-md)' }}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-success-50)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
              {statistics.capacityStats.full}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>90% 이상</div>
          </div>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-warning-50)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning)' }}>
              {statistics.capacityStats.medium}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>50~90%</div>
          </div>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-secondary)' }}>
              {statistics.capacityStats.low}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>50% 미만</div>
          </div>
        </div>
        <div style={{ marginTop: 'var(--spacing-md)', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>전체 평균 충족률</span>
            <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
              {statistics.avgCapacityRatio.toFixed(1)}%
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--spacing-sm)' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>총 {terms.PERSON_LABEL_PRIMARY} / 총 정원</span>
            <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>
              {statistics.totalStudents}명 / {statistics.totalCapacity}명
            </span>
          </div>
        </div>
      </Card>

      {/* 상태별 분포 */}
      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          상태별 분포
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-md)' }}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-success-50)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
              {statistics.byStatus.active}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>활성</div>
          </div>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-secondary)' }}>
              {statistics.byStatus.inactive}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>비활성</div>
          </div>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-primary-50)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
              {statistics.byStatus.archived}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>보관됨</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * 일정 충돌 탭 컴포넌트
 * 강사/강의실 중복 일정을 탐지하고 표시
 */
function ScheduleConflictsTab() {
  const terms = useIndustryTerms();
  const { data: allClasses, isLoading } = useClasses({});
  const { data: teachers } = useTeachers();
  void teachers; // TODO: 강사별 충돌 탐지 기능 구현 시 사용

  // 충돌 탐지
  const conflicts = useMemo(() => {
    if (!allClasses || allClasses.length === 0) return [];

    const detectedConflicts: Array<{
      id: string;
      type: 'room' | 'teacher' | 'time';
      message: string;
      classes: Class[];
      severity: 'warning' | 'error';
    }> = [];

    // 각 요일별로 분석
    DAYS_OF_WEEK.forEach(day => {
      const dayClasses = allClasses.filter(c => c.day_of_week === day.value && c.status === 'active');

      // 모든 수업 쌍 비교
      for (let i = 0; i < dayClasses.length; i++) {
        for (let j = i + 1; j < dayClasses.length; j++) {
          const class1 = dayClasses[i];
          const class2 = dayClasses[j];

          // 시간 겹침 확인
          const timeOverlap = class1.start_time < class2.end_time && class2.start_time < class1.end_time;

          if (timeOverlap) {
            // 강의실 충돌
            if (class1.room && class2.room && class1.room === class2.room) {
              detectedConflicts.push({
                id: `room-${class1.id}-${class2.id}`,
                type: 'room',
                message: `${day.label} ${class1.start_time}~${class1.end_time}: "${class1.name}"과 "${class2.name}"이 같은 강의실(${class1.room})에서 중복됩니다.`,
                classes: [class1, class2],
                severity: 'error',
              });
            }

            // 시간대 겹침 경고 (같은 시간에 여러 수업)
            const conflictId = `time-${day.value}-${class1.id}-${class2.id}`;
            if (!detectedConflicts.some(c => c.id === conflictId)) {
              detectedConflicts.push({
                id: conflictId,
                type: 'time',
                message: `${day.label} ${class1.start_time}~${class1.end_time}: "${class1.name}"과 "${class2.name}"의 시간이 겹칩니다.`,
                classes: [class1, class2],
                severity: 'warning',
              });
            }
          }
        }
      }
    });

    return detectedConflicts;
  }, [allClasses]);

  if (isLoading) {
    return (
      <Card padding="lg">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
          로딩 중...
        </div>
      </Card>
    );
  }

  const errorConflicts = conflicts.filter(c => c.severity === 'error');
  const warningConflicts = conflicts.filter(c => c.severity === 'warning');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* 요약 카드 */}
      <CardGridLayout
        cards={[
          <NotificationCardLayout
            key="total"
            icon={<AlertTriangle />}
            title="전체 충돌"
            value={conflicts.length}
            unit="건"
            layoutMode="stats"
            iconBackgroundColor={conflicts.length > 0 ? 'var(--color-warning-50)' : 'var(--color-success-50)'}
          />,
          <NotificationCardLayout
            key="error"
            icon={<XCircle />}
            title="심각한 충돌"
            value={errorConflicts.length}
            unit="건"
            layoutMode="stats"
            iconBackgroundColor={errorConflicts.length > 0 ? 'var(--color-error-50)' : 'var(--color-gray-100)'}
          />,
          <NotificationCardLayout
            key="warning"
            icon={<AlertTriangle />}
            title="경고"
            value={warningConflicts.length}
            unit="건"
            layoutMode="stats"
            iconBackgroundColor={warningConflicts.length > 0 ? 'var(--color-warning-50)' : 'var(--color-gray-100)'}
          />,
          <NotificationCardLayout
            key="classes"
            icon={<BookOpen />}
            title={`활성 ${terms.GROUP_LABEL}`}
            value={allClasses?.filter(c => c.status === 'active').length || 0}
            unit="개"
            layoutMode="stats"
            iconBackgroundColor="var(--color-primary-50)"
          />,
        ]}
        desktopColumns={4}
        tabletColumns={2}
        mobileColumns={2}
      />

      {/* 충돌 목록 */}
      {conflicts.length === 0 ? (
        <Card padding="lg">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <CheckCircle style={{ width: '48px', height: '48px', color: 'var(--color-success)', marginBottom: 'var(--spacing-md)' }} />
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
              충돌 없음
            </h3>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              현재 활성화된 {terms.GROUP_LABEL} 일정에 충돌이 없습니다.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* 심각한 충돌 (강의실 중복) */}
          {errorConflicts.length > 0 && (
            <Card padding="lg">
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)', color: 'var(--color-error)' }}>
                심각한 충돌 ({errorConflicts.length}건)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {errorConflicts.map(conflict => (
                  <div
                    key={conflict.id}
                    style={{
                      padding: 'var(--spacing-md)',
                      backgroundColor: 'var(--color-error-50)',
                      borderLeft: 'var(--border-width-thick) solid var(--color-error)',
                      borderRadius: 'var(--border-radius-md)',
                    }}
                  >
                    <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                      {conflict.type === 'room' ? '강의실 충돌' : conflict.type === 'teacher' ? '강사 충돌' : '시간 충돌'}
                    </div>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                      {conflict.message}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)' }}>
                      {conflict.classes.map(c => (
                        <span
                          key={c.id}
                          style={{
                            padding: 'var(--spacing-2xs) var(--spacing-xs)',
                            backgroundColor: c.color || 'var(--color-gray-200)',
                            borderRadius: 'var(--border-radius-sm)',
                            fontSize: 'var(--font-size-xs)',
                          }}
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 경고 (시간 겹침) */}
          {warningConflicts.length > 0 && (
            <Card padding="lg">
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)', color: 'var(--color-warning)' }}>
                시간 중복 경고 ({warningConflicts.length}건)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {warningConflicts.map(conflict => (
                  <div
                    key={conflict.id}
                    style={{
                      padding: 'var(--spacing-md)',
                      backgroundColor: 'var(--color-warning-50)',
                      borderLeft: 'var(--border-width-thick) solid var(--color-warning)',
                      borderRadius: 'var(--border-radius-md)',
                    }}
                  >
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                      {conflict.message}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)' }}>
                      {conflict.classes.map(c => (
                        <span
                          key={c.id}
                          style={{
                            padding: 'var(--spacing-2xs) var(--spacing-xs)',
                            backgroundColor: c.color || 'var(--color-gray-200)',
                            borderRadius: 'var(--border-radius-sm)',
                            fontSize: 'var(--font-size-xs)',
                          }}
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
