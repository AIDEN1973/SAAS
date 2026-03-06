/**
 * 수업 관리 페이지 데이터 훅
 *
 * [LAYER: UI_PAGE]
 * ClassesPage의 모든 상태, 데이터 페칭, 핸들러를 캡슐화
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useModal, useResponsiveMode, isMobile, isTablet } from '@ui-core/react';
import { CLASSES_SUB_MENU_ITEMS, DEFAULT_CLASSES_SUB_MENU, CLASSES_MENU_LABEL_MAPPING, getSubMenuFromUrl, setSubMenuToUrl, applyDynamicLabels } from '../../../constants';
import type { ClassesSubMenuId } from '../../../constants';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useQuery } from '@tanstack/react-query';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { toKST } from '@lib/date-utils';
import {
  useClasses,
  useCreateClass,
  useUpdateClass,
  useDeleteClass,
  useTeachersWithStats,
  useCheckScheduleConflicts,
  useClassTeachers,
} from '@hooks/use-class';
import type { ClassFilter, DayOfWeek, ClassTeacher, CreateClassInput, UpdateClassInput } from '@services/class-service';
import { createClassFormSchema } from '../../../schemas/class.schema';
import { p } from '../../../utils';

const DAY_OF_WEEK_MAP: Record<number, DayOfWeek> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export function useClassesPageData() {
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
    const todayDayOfWeek = DAY_OF_WEEK_MAP[dayOfWeek];

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

  const createClassMutation = useCreateClass();
  const updateClassMutation = useUpdateClass();
  const deleteClassMutation = useDeleteClass();

  // 선택된 수업 데이터 (레이어 메뉴용)
  const selectedClass = useMemo(() => {
    if (!selectedClassId || !classes) return null;
    return classes.find((c) => c.id === selectedClassId) || null;
  }, [selectedClassId, classes]);
  const selectedClassLoading = isLoading;

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
  const effectiveFormSchema = useMemo(() => {
    return createClassFormSchema(teachers || [], terms);
  }, [teachers, terms]);

  // 뷰 모드 토글 핸들러 (localStorage 지속성)
  const handleToggleViewMode = useCallback((newMode: 'list' | 'calendar') => {
    setViewMode(newMode);
    try {
      localStorage.setItem('classes-page-view-mode', newMode);
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

  const checkConflicts = useCheckScheduleConflicts();

  const handleCreateClass = useCallback(async (input: CreateClassInput) => {
    try {
      // 시간 범위 검증
      if (input.start_time && input.end_time && input.start_time >= input.end_time) {
        showAlert('시작 시간은 종료 시간보다 빨라야 합니다.', '입력 오류', 'error');
        return;
      }

      // 일정 충돌 감지
      try {
        const conflictResult = await checkConflicts.mutateAsync({
          dayOfWeek: input.day_of_week || [],
          startTime: input.start_time || '',
          endTime: input.end_time || '',
          teacherIds: input.teacher_ids,
        });

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
        if (import.meta.env?.DEV) {
          console.warn('일정 충돌 감지 실패:', conflictError);
        }
      }

      await createClassMutation.mutateAsync(input);
      setShowCreateForm(false);
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : `${terms.GROUP_LABEL} 생성에 실패했습니다.`,
        '오류',
        'error'
      );
    }
  }, [checkConflicts, createClassMutation, showAlert, showConfirm, terms]);

  const handleUpdateClass = useCallback(async (classId: string, input: UpdateClassInput) => {
    try {
      // 시간 범위 검증
      if (input.start_time && input.end_time && input.start_time >= input.end_time) {
        showAlert('시작 시간은 종료 시간보다 빨라야 합니다.', '입력 오류', 'error');
        return;
      }

      // 일정 변경이 있으면 충돌 감지
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
            if (import.meta.env?.DEV) {
              console.warn('일정 충돌 감지 실패:', conflictError);
            }
          }
        }
      }

      await updateClassMutation.mutateAsync({ classId, input });
      setIsEditingInLayer(false);
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : `${terms.GROUP_LABEL} 수정에 실패했습니다.`,
        '오류',
        'error'
      );
    }
  }, [checkConflicts, classes, showAlert, showConfirm, terms, updateClassMutation]);

  const handleDeleteClass = useCallback(async () => {
    if (!selectedClass) return;
    const confirmed = await showConfirm(
      `정말 이 ${terms.GROUP_LABEL}${p.을를(terms.GROUP_LABEL)} 삭제하시겠습니까?`,
      `${terms.GROUP_LABEL} 삭제`
    );
    if (confirmed) {
      try {
        await deleteClassMutation.mutateAsync(selectedClass.id);
        handleCloseLayerMenu();
      } catch (err) {
        showAlert(
          err instanceof Error ? err.message : `${terms.GROUP_LABEL} 삭제에 실패했습니다.`,
          '오류',
          'error'
        );
      }
    }
  }, [deleteClassMutation, handleCloseLayerMenu, selectedClass, showAlert, showConfirm, terms]);

  return {
    // 반응형
    isMobileMode,
    sidebarCollapsed,
    setSidebarCollapsed,

    // 서브 메뉴
    selectedSubMenu,
    handleSubMenuChange,
    subMenuItemsWithDynamicLabels,

    // 뷰 모드
    viewMode,
    handleToggleViewMode,
    showAllClasses,
    handleToggleShowAll,

    // 필터
    filter,
    setFilter,
    timeSlotFilter,
    setTimeSlotFilter,

    // 데이터
    classes,
    filteredClasses,
    isLoading,
    error,
    teachers,
    classTeachersMap,

    // 수업 생성
    showCreateForm,
    setShowCreateForm,
    effectiveFormSchema,
    handleCreateClass,

    // 레이어 메뉴 (수업 상세)
    selectedClassId,
    selectedClass,
    selectedClassLoading,
    selectedClassTeachers,
    selectedClassTeachersLoading,
    layerMenuTab,
    isEditingInLayer,
    setIsEditingInLayer,
    handleClassSelect,
    handleTabChange,
    handleCloseLayerMenu,
    handleUpdateClass,
    handleDeleteClass,

    // 업종 용어
    terms,
  };
}
