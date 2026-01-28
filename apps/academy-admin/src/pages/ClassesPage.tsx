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
import { ErrorBoundary, useModal, useResponsiveMode , Container, Card, Button, Modal, PageHeader, isMobile, isTablet, DataTable, NotificationCardLayout, SubSidebar, RightLayerMenuLayout, Badge, IconButtonGroup } from '@ui-core/react';
// [SSOT] Barrel export를 통한 통합 import
import { CLASSES_SUB_MENU_ITEMS, DEFAULT_CLASSES_SUB_MENU, CLASSES_MENU_LABEL_MAPPING, getSubMenuFromUrl, setSubMenuToUrl, applyDynamicLabels } from '../constants';
import { templates, p } from '../utils';
import type { ClassesSubMenuId } from '../constants';
import { BookOpen, Users, CheckCircle, XCircle, AlertTriangle, Trash2, Pencil } from 'lucide-react';
import { SchemaForm } from '@schema-engine';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useQuery } from '@tanstack/react-query';
import { CreateClassForm } from './classes/components/CreateClassForm';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { toKST } from '@lib/date-utils';
import {
  useClasses,
  useCreateClass,
  useUpdateClass,
  useDeleteClass,
  // useClassStatistics, // TODO: 통계 기능 구현 시 사용
  useTeachers,
  useTeachersWithStats,
  useCheckScheduleConflicts,
  useClassTeachers,
} from '@hooks/use-class';
import type { Class, CreateClassInput, UpdateClassInput, ClassFilter, ClassStatus, DayOfWeek, Teacher, ClassTeacher } from '@services/class-service';
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
  const context = getApiContext();
  const tenantId = context.tenantId;
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);
  // 서브사이드바 축소 상태 (태블릿 모드 기본값, 사용자 토글 가능)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isTabletMode);
  // 태블릿 모드 변경 시 축소 상태 동기화
  useEffect(() => {
    setSidebarCollapsed(isTabletMode);
  }, [isTabletMode]);

  // 서브 메뉴 상태
  const validIds = CLASSES_SUB_MENU_ITEMS.map(item => item.id) as readonly ClassesSubMenuId[];
  const selectedSubMenu = getSubMenuFromUrl(searchParams, validIds, DEFAULT_CLASSES_SUB_MENU);

  const handleSubMenuChange = useCallback((id: ClassesSubMenuId) => {
    const newUrl = setSubMenuToUrl(id, DEFAULT_CLASSES_SUB_MENU);
    navigate(newUrl);
  }, [navigate]);

  // [업종중립] 동적 라벨이 적용된 서브 메뉴 아이템
  const subMenuItemsWithDynamicLabels = useMemo(() => {
    return applyDynamicLabels(CLASSES_SUB_MENU_ITEMS, CLASSES_MENU_LABEL_MAPPING, terms);
  }, [terms]);

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
  const [timeSlotFilter, setTimeSlotFilter] = useState<string>(''); // 시간대 필터 (클라이언트 사이드)
  const [showCreateForm, setShowCreateForm] = useState(false);

  // 수업 상세 레이어 메뉴 상태
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [layerMenuTab, setLayerMenuTab] = useState<'info' | 'students' | 'teachers'>('info');
  const [isEditingInLayer, setIsEditingInLayer] = useState(false);

  // URL 파라미터로 클래스 ID가 전달되면 자동으로 레이어 메뉴 열기
  useEffect(() => {
    if (urlClassId) {
      setSelectedClassId(urlClassId);
    }
  }, [urlClassId]);

  // 레이어 메뉴 닫을 때 URL도 업데이트
  const handleCloseLayerMenu = useCallback(() => {
    setSelectedClassId(null);
    setIsEditingInLayer(false);
    setLayerMenuTab('info');
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

  // 시간대 필터링 (클라이언트 사이드)
  const filteredClasses = useMemo(() => {
    if (!classes) return [];
    if (!timeSlotFilter) return classes;

    return classes.filter((classItem) => {
      if (!classItem.start_time) return false;
      const hour = parseInt(classItem.start_time.split(':')[0], 10);

      switch (timeSlotFilter) {
        case 'morning':
          return hour >= 6 && hour < 12;
        case 'afternoon':
          return hour >= 12 && hour < 18;
        case 'evening':
          return hour >= 18 && hour < 24;
        default:
          return true;
      }
    });
  }, [classes, timeSlotFilter]);

  // [수정 2026-01-27] useTeachersWithStats 사용
  // class_teachers.teacher_id는 academy_teachers.id를 참조 (FK 제약 조건 수정됨)
  const { data: teachers } = useTeachersWithStats();

  // 모든 활성 class_teachers 가져오기 (테이블 표시용)
  const { data: allClassTeachers } = useQuery({
    queryKey: ['all-class-teachers', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const response = await apiClient.get<ClassTeacher>('class_teachers', {
        filters: { is_active: true },
      });
      if (response.error) throw new Error(response.error.message);
      return response.data || [];
    },
    enabled: !!tenantId,
  });

  // 클래스별 teacher 매핑 (테이블 표시용)
  const classTeachersMap = useMemo(() => {
    if (!allClassTeachers || !teachers) return new Map();

    const map = new Map<string, Array<{ name: string }>>();
    allClassTeachers.forEach(ct => {
      // [수정 2026-01-27] ct.teacher_id는 academy_teachers.id를 참조
      const teacher = teachers.find(t => t.id === ct.teacher_id);
      if (teacher) {
        if (!map.has(ct.class_id)) {
          map.set(ct.class_id, []);
        }
        map.get(ct.class_id)!.push({ name: teacher.name });
      }
    });
    return map;
  }, [allClassTeachers, teachers]);

  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();

  // 선택된 수업 데이터 (레이어 메뉴용) - 이미 로드된 classes 배열에서 찾아서 즉시 표시 (API 호출 없음)
  const selectedClass = useMemo(() => {
    if (!selectedClassId || !classes) return null;
    return classes.find((c) => c.id === selectedClassId) || null;
  }, [selectedClassId, classes]);
  const selectedClassLoading = isLoading; // classes 로딩 상태와 동기화

  // 강사 목록은 별도 API 호출 필요 (class_teachers 테이블 조회)
  const { data: selectedClassTeachers, isLoading: selectedClassTeachersLoading } = useClassTeachers(selectedClassId || '');

  // 수업 선택 핸들러
  const handleClassSelect = useCallback((classId: string | null) => {
    setSelectedClassId(classId);
    setIsEditingInLayer(false);
    if (classId) {
      setLayerMenuTab('info'); // 새 수업 선택 시 기본 탭으로 리셋
    }
  }, []);

  // 탭 변경 핸들러
  const handleTabChange = useCallback((tab: 'info' | 'students' | 'teachers') => {
    setLayerMenuTab(tab);
  }, []);

  // [수정 2026-01-27] useSchema 제거 - 동적 옵션(teachers)이 손실되는 문제 해결
  // Registry는 정적 스키마 전용이므로, 동적 데이터가 포함된 스키마는 직접 생성
  const effectiveFormSchema = useMemo(() => {
    return createClassFormSchema(teachers || [], terms);
  }, [teachers, terms]);

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
      if (input.start_time && input.end_time && input.start_time >= input.end_time) {
        showAlert('시작 시간은 종료 시간보다 빨라야 합니다.', '입력 오류', 'error');
        return;
      }

      // 일정 충돌 감지 (디어쌤_아키텍처.md 3.2.2)
      // Note: RPC 함수가 없어도 수업 생성은 계속 진행
      try {
        const conflictResult = await checkConflicts.mutateAsync({
          dayOfWeek: input.day_of_week || [],
          startTime: input.start_time || '',
          endTime: input.end_time || '',
          teacherIds: input.teacher_ids,
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
      // Note: 161_fix_student_classes_status_column.sql migration 적용 완료
      if (input.day_of_week || input.start_time || input.end_time || input.teacher_ids) {
        const classData = classes?.find((c) => c.id === classId);
        if (classData) {
          try {
            const conflictResult = await checkConflicts.mutateAsync({
              classId,
              dayOfWeek: input.day_of_week || classData.day_of_week,
              startTime: input.start_time || classData.start_time,
              endTime: input.end_time || classData.end_time,
              teacherIds: input.teacher_ids,
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
      setIsEditingInLayer(false);
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
      <div style={{ display: 'flex', minHeight: 'var(--height-full)' }}>
        {/* 서브 사이드바 (모바일에서는 숨김, 태블릿에서는 축소) */}
        {!isMobileMode && (
          <SubSidebar
            title={templates.management(terms.GROUP_LABEL)}
            items={subMenuItemsWithDynamicLabels}
            selectedId={selectedSubMenu}
            onSelect={handleSubMenuChange}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            testId="classes-sub-sidebar"
          />
        )}

        {/* 메인 콘텐츠 */}
        <div style={{ flex: 1 }}>
          <RightLayerMenuLayout
            layerMenu={{
              isOpen: !!selectedClassId,
              onClose: handleCloseLayerMenu,
              // 중요: 내용 변경 감지를 위해 selectedClassId를 contentKey로 전달
              contentKey: selectedClassId || undefined,
              // 중요: 수업 상세 레이어 메뉴는 모달 레벨의 z-index를 가져야 함
              style: {
                zIndex: 'var(--z-modal)',
              },
              title: selectedClassLoading ? '로딩 중...' : selectedClass ? (
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
                    {selectedClass.name}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {terms.GROUP_LABEL} 상세정보
                  </span>
                </span>
              ) : `${terms.GROUP_LABEL} 상세`,
              children: selectedClassLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                  로딩 중...
                </div>
              ) : selectedClass ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--height-full)' }}>
                  {/* 탭 버튼 */}
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'calc(var(--spacing-xl) - var(--spacing-lg))', flexWrap: 'wrap' }}>
                    <Button
                      variant={layerMenuTab === 'info' ? 'solid' : 'outline'}
                      size="sm"
                      onClick={() => handleTabChange('info')}
                    >
                      기본정보
                    </Button>
                    <Button
                      variant={layerMenuTab === 'students' ? 'solid' : 'outline'}
                      size="sm"
                      onClick={() => handleTabChange('students')}
                    >
                      {terms.PERSON_LABEL_PRIMARY} ({selectedClass.current_count || 0})
                    </Button>
                    <Button
                      variant={layerMenuTab === 'teachers' ? 'solid' : 'outline'}
                      size="sm"
                      onClick={() => handleTabChange('teachers')}
                    >
                      담당강사 ({selectedClassTeachers?.length || 0})
                    </Button>
                  </div>
                  {/* 구분선 */}
                  <div style={{ borderBottom: 'var(--border-width-thin) solid var(--color-border)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }} />
                  {/* 탭 내용 */}
                  <div className="academyAdmin-hiddenScrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                    {layerMenuTab === 'info' && (
                      <ClassInfoTab
                        classData={selectedClass}
                        classTeachers={selectedClassTeachers || []}
                        teachers={teachers || []}
                        isEditing={isEditingInLayer}
                        effectiveFormSchema={effectiveFormSchema}
                        onEdit={() => setIsEditingInLayer(true)}
                        onCancel={() => setIsEditingInLayer(false)}
                        onSave={handleUpdateClass}
                        onDelete={async () => {
                          const confirmed = await showConfirm(
                            `정말 이 ${terms.GROUP_LABEL}${p.을를(terms.GROUP_LABEL)} 삭제하시겠습니까?`,
                            `${terms.GROUP_LABEL} 삭제`
                          );
                          if (confirmed) {
                            try {
                              await deleteClass.mutateAsync(selectedClass.id);
                              handleCloseLayerMenu();
                            } catch (err) {
                              showAlert(
                                err instanceof Error ? err.message : `${terms.GROUP_LABEL} 삭제에 실패했습니다.`,
                                '오류',
                                'error'
                              );
                            }
                          }
                        }}
                      />
                    )}
                    {layerMenuTab === 'students' && (
                      <ClassStudentsTab classId={selectedClass.id} />
                    )}
                    {layerMenuTab === 'teachers' && (
                      <ClassTeachersTab
                        classTeachers={selectedClassTeachers || []}
                        isLoading={selectedClassTeachersLoading}
                        allTeachers={teachers || []}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                  {terms.GROUP_LABEL} 정보를 불러올 수 없습니다.
                </div>
              ),
            }}
          >
          <Container maxWidth="xl" padding="lg">
          <PageHeader
            title={subMenuItemsWithDynamicLabels.find(item => item.id === selectedSubMenu)?.label || templates.management(terms.GROUP_LABEL)}
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
              data={filteredClasses}
              onRowClick={(classItem) => handleClassSelect(classItem.id)}
              filters={[
                {
                  type: 'text',
                  columnKey: 'search',
                  label: '검색',
                  placeholder: `${terms.GROUP_LABEL}명을 검색하세요.`,
                },
                {
                  type: 'select',
                  columnKey: 'subject',
                  label: terms.SUBJECT_LABEL || '과목',
                  placeholder: '과목을 선택하세요.',
                  options: [
                    { value: '', label: '전체' },
                    { value: '국어', label: '국어' },
                    { value: '영어', label: '영어' },
                    { value: '수학', label: '수학' },
                    { value: '과학', label: '과학' },
                  ],
                },
                {
                  type: 'select',
                  columnKey: 'day_of_week',
                  label: '요일',
                  placeholder: '요일을 선택하세요.',
                  options: [
                    { value: '', label: '전체' },
                    ...DAYS_OF_WEEK.map(d => ({ value: d.value, label: d.label })),
                  ],
                },
                {
                  type: 'select',
                  columnKey: 'time_slot',
                  label: '시간대',
                  placeholder: '시간대를 선택하세요.',
                  options: [
                    { value: '', label: '전체' },
                    { value: 'morning', label: '오전 (06~12시)' },
                    { value: 'afternoon', label: '오후 (12~18시)' },
                    { value: 'evening', label: '저녁 (18~24시)' },
                  ],
                },
                {
                  type: 'select',
                  columnKey: 'status',
                  label: '상태',
                  placeholder: '상태를 선택하세요.',
                  options: [
                    { value: '', label: '전체' },
                    { value: 'active', label: '운영 중' },
                    { value: 'inactive', label: '중단' },
                  ],
                },
              ]}
              initialFilterState={{
                search: { text: filter.search || '' },
                subject: { selected: filter.subject || '' },
                day_of_week: { selected: typeof filter.day_of_week === 'string' ? filter.day_of_week : '' },
                time_slot: { selected: timeSlotFilter },
                status: { selected: typeof filter.status === 'string' ? filter.status : '' },
              }}
              onFilterChange={(filterState) => {
                if (filterState.search?.text !== undefined) {
                  setFilter(prev => ({ ...prev, search: filterState.search.text }));
                }
                if (filterState.subject?.selected !== undefined) {
                  setFilter(prev => ({ ...prev, subject: filterState.subject.selected || undefined }));
                }
                if (filterState.day_of_week?.selected !== undefined) {
                  setFilter(prev => ({ ...prev, day_of_week: filterState.day_of_week.selected as DayOfWeek | undefined }));
                }
                if (filterState.time_slot?.selected !== undefined) {
                  setTimeSlotFilter(filterState.time_slot.selected || '');
                }
                if (filterState.status?.selected !== undefined) {
                  setFilter(prev => ({ ...prev, status: filterState.status.selected as ClassStatus | undefined }));
                }
              }}
              enableClientSideFiltering={false}
              columns={[
                {
                  key: 'subject',
                  label: terms.SUBJECT_LABEL || '과목',
                  width: '12%',
                  render: (_, classItem) => (
                    <span>{classItem.subject || '-'}</span>
                  ),
                },
                {
                  key: 'name',
                  label: `${terms.GROUP_LABEL}명`,
                  width: '18%',
                  render: (_, classItem) => (
                    <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{classItem.name}</span>
                  ),
                },
                {
                  key: 'schedule',
                  label: '일정',
                  width: '18%',
                  render: (_, classItem) => {
                    // day_of_week가 배열인 경우 처리
                    // 멀티 요일: "월, 화, 수, 목, 금요일" 형식 (마지막만 전체 표기)
                    const dayOfWeek = classItem.day_of_week;
                    let dayLabels: string;
                    if (Array.isArray(dayOfWeek) && dayOfWeek.length > 0) {
                      if (dayOfWeek.length === 1) {
                        // 단일 요일: 전체 표기 (예: 월요일)
                        dayLabels = DAYS_OF_WEEK.find((day) => day.value === dayOfWeek[0])?.label || dayOfWeek[0];
                      } else {
                        // 멀티 요일: 마지막만 전체 표기, 나머지는 첫 글자만 (예: 월, 화, 수, 목, 금요일)
                        const abbreviated = dayOfWeek.slice(0, -1).map(d => {
                          const label = DAYS_OF_WEEK.find((day) => day.value === d)?.label || d;
                          return label.charAt(0); // 첫 글자만 (월, 화, 수, 목, 금, 토, 일)
                        });
                        const lastDay = DAYS_OF_WEEK.find((day) => day.value === dayOfWeek[dayOfWeek.length - 1])?.label || dayOfWeek[dayOfWeek.length - 1];
                        dayLabels = [...abbreviated, lastDay].join(', ');
                      }
                    } else if (dayOfWeek) {
                      // 단일 값 (배열이 아닌 경우)
                      dayLabels = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek)?.label || String(dayOfWeek);
                    } else {
                      dayLabels = '-';
                    }
                    return <span>{dayLabels}</span>;
                  },
                },
                {
                  key: 'time',
                  label: '수업시간',
                  width: '18%',
                  render: (_, classItem) => {
                    // HH:mm:ss 형식에서 HH:mm만 추출
                    const formatTime = (time: string | null | undefined) => {
                      if (!time) return null;
                      const match = time.match(/^(\d{2}:\d{2})/);
                      return match ? match[1] : time;
                    };
                    const startTime = formatTime(classItem.start_time);
                    const endTime = formatTime(classItem.end_time);
                    return (
                      <span>
                        {startTime && endTime ? `${startTime} ~ ${endTime}` : '-'}
                      </span>
                    );
                  },
                },
                {
                  key: 'capacity',
                  label: `${terms.CAPACITY_LABEL}`,
                  width: '12%',
                  align: 'center',
                  render: (_, classItem) => (
                    <span>
                      {classItem.capacity ? `${classItem.current_count || 0}/${classItem.capacity}명` : '-'}
                    </span>
                  ),
                },
                {
                  key: 'teacher',
                  label: '담당',
                  width: '12%',
                  render: (_, classItem) => {
                    // classTeachersMap에서 해당 클래스의 teachers 가져오기
                    const teacherNames = classTeachersMap.get(classItem.id) as Array<{ name: string }> | undefined;
                    if (teacherNames && teacherNames.length > 0) {
                      return <span>{teacherNames.map((t) => t.name).join(', ')}</span>;
                    }
                    return <span style={{ color: 'var(--color-text-tertiary)' }}>-</span>;
                  },
                },
                {
                  key: 'status',
                  label: '상태',
                  width: '10%',
                  align: 'center',
                  render: (_, classItem) => {
                    const isActive = classItem.status === 'active';
                    return (
                      <Badge
                        color={isActive ? 'success' : 'gray'}
                        variant="solid"
                        size="sm"
                      >
                        {isActive ? '운영 중' : '중단'}
                      </Badge>
                    );
                  },
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
                <ClassCalendarView classes={classes || []} onClassSelect={handleClassSelect} />
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

          {/* [업종중립] 수업 등록 폼 - 모달로 표시 (학생관리 > 학생등록 모달과 동일한 스타일) */}
          {showCreateForm && (() => {
            let triggerSubmit: (() => void) | null = null;
            return (
              <Modal
                isOpen={showCreateForm}
                onClose={() => setShowCreateForm(false)}
                title={`${terms.GROUP_LABEL}생성`}
                size="lg"
                footer={
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateForm(false)}
                      style={{ flex: 1 }}
                    >
                      취소
                    </Button>
                    <Button
                      variant="solid"
                      color="primary"
                      onClick={() => triggerSubmit?.()}
                      style={{ flex: 1 }}
                    >
                      저장
                    </Button>
                  </>
                }
              >
                <CreateClassForm
                  onClose={() => setShowCreateForm(false)}
                  onSubmit={async (data) => {
                    await handleCreateClass(data);
                  }}
                  effectiveFormSchema={effectiveFormSchema}
                  onSubmitTrigger={(fn) => { triggerSubmit = fn; }}
                />
              </Modal>
            );
          })()}
        </Container>
        </RightLayerMenuLayout>
        </div>
      </div>
    </ErrorBoundary>
  );
}

/**
 * 수업 기본정보 탭 컴포넌트
 */
function ClassInfoTab({
  classData,
  classTeachers,
  teachers,
  isEditing,
  effectiveFormSchema,
  onEdit,
  onDelete,
  onCancel,
  onSave,
}: {
  classData: Class;
  classTeachers: ClassTeacher[];
  teachers: Teacher[];
  isEditing: boolean;
  effectiveFormSchema: FormSchema;
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onSave: (classId: string, input: UpdateClassInput) => Promise<void>;
}) {
  const terms = useIndustryTerms();
  const mode = useResponsiveMode();
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const dayLabel = Array.isArray(classData.day_of_week)
    ? classData.day_of_week.map(d => DAYS_OF_WEEK.find((day) => day.value === d)?.label || d).join(', ')
    : DAYS_OF_WEEK.find((d) => d.value === classData.day_of_week)?.label || classData.day_of_week;

  const gradeLabel = Array.isArray(classData.grade)
    ? classData.grade.join(', ')
    : classData.grade || '-';

  // 담당 선생님 라벨 생성
  const teacherLabel = useMemo(() => {
    if (!classTeachers || classTeachers.length === 0) return '-';

    const teacherNames = classTeachers.map(ct => {
      // [수정 2026-01-27] ct.teacher_id는 academy_teachers.id를 참조
      const teacher = teachers?.find(t => t.id === ct.teacher_id);
      return teacher?.name || '알 수 없음';
    });

    return teacherNames.join(', ');
  }, [classTeachers, teachers]);

  const formDefaultValues = useMemo(() => {
    // subject 값이 기본 옵션에 없으면 직접입력으로 처리
    const predefinedSubjects = ['국어', '영어', '수학', '과학'];
    const isCustomSubject = classData.subject && !predefinedSubjects.includes(classData.subject);

    return {
      name: classData.name || '',
      subject: isCustomSubject ? '__custom__' : (classData.subject || ''),
      subject_custom: isCustomSubject ? classData.subject : '',
      grade: classData.grade || undefined,
      day_of_week: classData.day_of_week || undefined,
      start_time: classData.start_time?.substring(0, 5) || '14:00',
      end_time: classData.end_time?.substring(0, 5) || '15:30',
      capacity: classData.capacity || 20,
      teacher_ids: classTeachers.map((ct) => ct.teacher_id),
      notes: classData.notes || '',
      status: classData.status || 'active',
    };
  }, [classData, classTeachers]);

  const editSchema = useMemo(() => ({
    ...effectiveFormSchema,
    form: {
      ...effectiveFormSchema.form,
      submit: {
        label: '저장',
        variant: 'solid' as const,
        color: 'primary' as const,
        size: 'md' as const,
      },
    },
  }), [effectiveFormSchema]);

  const readOnlyFields = useMemo(() => [
    { label: `${terms.GROUP_LABEL}명`, value: classData.name || '-' },
    { label: '과목', value: classData.subject || '-' },
    { label: '요일', value: dayLabel },
    { label: '시간', value: `${classData.start_time?.substring(0, 5) || ''} ~ ${classData.end_time?.substring(0, 5) || ''}` },
    { label: terms.CAPACITY_LABEL, value: `${classData.current_count} / ${classData.capacity}명 (${((classData.current_count / classData.capacity) * 100).toFixed(0)}%)` },
    { label: '학년', value: gradeLabel },
    { label: `담당 ${terms.PERSON_LABEL_SECONDARY}`, value: teacherLabel },
    { label: '운영 상태', value: classData.status === 'active' ? '운영 중' : '중단' },
    { label: '메모', value: classData.notes || '-', colSpan: 2 },
  ], [classData, dayLabel, gradeLabel, teacherLabel, terms]);

  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    // subject: 직접입력 선택 시 subject_custom 값 사용
    const subjectValue = data.subject === '__custom__'
      ? (data.subject_custom ? String(data.subject_custom) : undefined)
      : (data.subject ? String(data.subject) : undefined);

    const input: UpdateClassInput = {
      name: data.name ? String(data.name) : undefined,
      subject: subjectValue,
      // grade: 배열 또는 단일 값 지원
      grade: data.grade && Array.isArray(data.grade) && data.grade.length > 0
        ? data.grade
        : data.grade
        ? String(data.grade)
        : undefined,
      // day_of_week: 배열 또는 단일 값 지원
      day_of_week: data.day_of_week && Array.isArray(data.day_of_week) && data.day_of_week.length > 0
        ? data.day_of_week as DayOfWeek[]
        : data.day_of_week
        ? data.day_of_week as DayOfWeek
        : undefined,
      start_time: data.start_time ? `${String(data.start_time)}:00` : undefined,
      end_time: data.end_time ? `${String(data.end_time)}:00` : undefined,
      capacity: data.capacity ? Number(data.capacity) : undefined,
      teacher_ids: data.teacher_ids && Array.isArray(data.teacher_ids) ? data.teacher_ids as string[] : undefined,
      notes: data.notes ? String(data.notes) : undefined,
      status: data.status as ClassStatus | undefined,
    };

    await onSave(classData.id, input);
  }, [classData.id, onSave]);

  if (!isEditing) {
    return (
      <div>
        <Card padding="md">
          {/* 수정폼과 동일한 2열 그리드 레이아웃, 텍스트만 출력 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobileMode ? '1fr' : 'repeat(2, minmax(0, 1fr))',
              gap: 'var(--spacing-md)',
            }}
          >
            {readOnlyFields.map((field, idx) => (
              <div
                key={idx}
                style={{
                  gridColumn: field.colSpan === 2 ? (isMobileMode ? 'span 1' : 'span 2') : undefined,
                  display: 'flex',
                  width: '100%',
                  alignItems: field.label === '메모' ? 'flex-start' : 'center',
                  paddingTop: 'var(--spacing-sm)',
                  paddingBottom: 'var(--spacing-sm)',
                  paddingLeft: 'var(--spacing-form-horizontal-left)',
                  paddingRight: 'var(--spacing-form-horizontal-right)',
                  borderBottom: 'var(--border-width-thin) solid var(--color-table-row-border)',
                }}
              >
                <span
                  style={{
                    color: 'var(--color-form-inline-label)',
                    fontSize: 'var(--font-size-base)',
                    fontFamily: 'var(--font-family)',
                    fontWeight: 'var(--font-weight-normal)',
                    lineHeight: 'var(--line-height)',
                    minWidth: 'var(--width-form-inline-label)',
                    flexShrink: 0,
                    marginRight: 'var(--spacing-form-inline-label-gap)',
                  }}
                >
                  {field.label}
                </span>
                <span
                  style={{
                    color: 'var(--color-text)',
                    fontSize: 'var(--font-size-base)',
                    fontFamily: 'var(--font-family)',
                    fontWeight: 'var(--font-weight-normal)',
                    lineHeight: 'var(--line-height)',
                    whiteSpace: field.label === '메모' ? 'pre-wrap' : 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {field.value}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
            <IconButtonGroup
              align="right"
              items={[
                {
                  icon: Trash2,
                  tooltip: '삭제',
                  variant: 'outline' as const,
                  color: 'error' as const,
                  onClick: onDelete,
                },
                {
                  icon: Pencil,
                  tooltip: '수정',
                  variant: 'outline' as const,
                  onClick: onEdit,
                },
              ]}
            />
          </div>
        </Card>
      </div>
    );
  }

  // 수정 모드
  return (
    <div>
      <SchemaForm
        schema={editSchema}
        defaultValues={formDefaultValues}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        disableCardPadding={false}
        cardTitle={undefined}
      />
    </div>
  );
}

/**
 * 수업 수강생 탭 컴포넌트
 */
function ClassStudentsTab({ classId }: { classId: string }) {
  const terms = useIndustryTerms();
  // [예외] classId 기반 student_classes 조회는 아직 hook이 없어 직접 조회
  const { data: studentClasses, isLoading } = useQuery({
    queryKey: ['student_classes', 'by_class', classId],
    queryFn: async () => {
      // eslint-disable-next-line no-restricted-syntax
      const response = await apiClient.get<{ id: string; student_id: string; class_id: string; is_active: boolean; enrolled_at: string | null; left_at: string | null }>('student_classes', {
        filters: { class_id: classId, is_active: true },
        limit: 100,
      });
      if (response.error) throw new Error(response.error.message);
      return response.data || [];
    },
    enabled: !!classId,
  });

  // 학생 정보 조회
  const studentIds = useMemo(() => studentClasses?.map(sc => sc.student_id) || [], [studentClasses]);
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['persons', 'bulk', classId, studentIds.length],
    queryFn: async () => {
      if (studentIds.length === 0) return [];

      // [최적화] 모든 학생 정보를 한 번에 조회
      // Supabase는 in 필터를 배열로 받지 않으므로, 개별 조회를 병렬로 수행
      const studentPromises = studentIds.map(async (studentId) => {
        const response = await apiClient.get<{ id: string; name: string; phone?: string }>('persons', {
          filters: { id: studentId },
          limit: 1,
        });
        if (response.error) {
          // 개별 학생 조회 실패는 무시하고 계속 진행
          console.warn(`Failed to fetch student ${studentId}:`, response.error.message);
          return null;
        }
        return response.data?.[0] || null;
      });

      const results = await Promise.all(studentPromises);
      return results.filter((s): s is { id: string; name: string; phone?: string } => s !== null);
    },
    enabled: studentIds.length > 0,
  });

  if (isLoading || studentsLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
        로딩 중...
      </div>
    );
  }

  if (!studentClasses || studentClasses.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
        배정된 {terms.PERSON_LABEL_PRIMARY}이 없습니다.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      {studentClasses.map((sc) => {
        const student = students?.find(s => s.id === sc.student_id);
        return (
          <Card key={sc.id} padding="sm">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                  {student?.name || '알 수 없음'}
                </div>
                {student?.phone && (
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    {student.phone}
                  </div>
                )}
              </div>
              {sc.enrolled_at && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {toKST(sc.enrolled_at).format('YYYY-MM-DD')} 등록
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * 수업 담당강사 탭 컴포넌트
 */
function ClassTeachersTab({
  classTeachers,
  isLoading,
  allTeachers,
}: {
  classTeachers: Array<{ id: string; teacher_id: string; class_id: string }>;
  isLoading: boolean;
  allTeachers: Teacher[];
}) {
  const terms = useIndustryTerms();

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
        로딩 중...
      </div>
    );
  }

  if (!classTeachers || classTeachers.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
        담당 {terms.PERSON_LABEL_SECONDARY}가 없습니다.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      {classTeachers.map((ct) => {
        // [수정 2026-01-27] ct.teacher_id는 academy_teachers.id를 참조
        const teacher = allTeachers.find(t => t.id === ct.teacher_id);
        return (
          <Card key={ct.id} padding="sm">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                  {teacher?.name || '알 수 없음'}
                </div>
                {teacher?.specialization && (
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    {teacher.specialization}
                  </div>
                )}
              </div>
              {teacher?.phone && (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {teacher.phone}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/** 요일 번호 -> 영문 키 맵 (일요일부터 시작) */
const DAY_OF_WEEK_MAP: Record<number, DayOfWeek> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

/** 요일 이름 (일요일부터 시작) */
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * 수업 캘린더 뷰 (월 바둑판 달력)
 * [요구사항] 수업 편성표 - 월별 달력 형태로 해당 날짜에 수업 목록 표시
 */
function ClassCalendarView({ classes, onClassSelect }: { classes: Class[]; onClassSelect?: (classId: string) => void }) {
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-md)' }}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-success-50)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
              {statistics.byStatus.active}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>운영 중</div>
          </div>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-secondary)' }}>
              {statistics.byStatus.inactive}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>중단</div>
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
