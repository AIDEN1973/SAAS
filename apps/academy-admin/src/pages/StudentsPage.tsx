/**
 * 학생 관리 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

// [P2] window 타입 선언: 위젯 등록 플래그 타입 안정성
// [P1-2 수정] 키 기반으로 위젯 등록 플래그 관리하여 다른 위젯/번들과 충돌 방지
declare global {
  interface Window {
    __sduiWidgetRegistered?: Record<string, boolean>; // [P1-2 수정] 키 기반으로 위젯 등록 플래그 관리
  }
}

import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorBoundary, useIconSize, useIconStrokeWidth, useToast, Input, Container, Card, Button, PageHeader, RightLayerMenuLayout, EmptyState, SubSidebar, Tooltip, Modal } from '@ui-core/react';
import { DataTableActionButtons } from '../components/DataTableActionButtons';
import { ChevronDown, ChevronUp, Users, UserCheck, UserX, Clock, ArrowUpDown } from 'lucide-react';
import { StatsDashboard } from '../components/stats';
import type { StatsItem, ChartDataItem, PeriodFilter } from '../components/stats';
import { SchemaTable, registerWidget } from '@schema-engine';
import { useStudentPage } from './hooks/useStudentPage';
import { tagFormSchema } from '../schemas/tag.schema';
import { isWidgetRegistered, setWidgetRegistered } from '../utils/widget-registry';
import { useIndustryTerms } from '@hooks/use-industry-terms';
// [SSOT] Barrel export를 통한 통합 import
import { createSafeNavigate, processTagInput } from '../utils';
import { STUDENTS_SUB_MENU_ITEMS, DEFAULT_STUDENTS_SUB_MENU, STUDENTS_RELATED_MENUS, getSubMenuFromUrl, setSubMenuToUrl } from '../constants';
import type { StudentsSubMenuId } from '../constants';
import { StudentInfoTab } from './students/tabs/StudentInfoTab';
import { GuardiansTab } from './students/tabs/GuardiansTab';
import { ConsultationsTab } from './students/tabs/ConsultationsTab';
import { TagsTab } from './students/tabs/TagsTab';
import { ClassesTab } from './students/tabs/ClassesTab';
import { AttendanceTab } from './students/tabs/AttendanceTab';
import { RiskAnalysisTab } from './students/tabs/RiskAnalysisTab';
import { MessageSendTab } from './students/tabs/MessageSendTab';
import { CreateStudentForm } from './students/components/CreateStudentForm';
import type { StudentStatus, StudentConsultation, Guardian } from '@services/student-service';

// [P2-QUALITY-1 해결] processTagInput 함수는 utils/data-normalization-utils.ts에서 SSOT로 관리
// import { processTagInput } from '../utils';

// 태그 이름 입력 필드 커스텀 컴포넌트 (실시간 띄어쓰기 제거)
const TagNameInputWidget: React.FC<{
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  fullWidth?: boolean;
}> = ({ value = '', onChange, onBlur, label, placeholder, error, disabled, fullWidth = true }) => {
  // [성능 최적화] processTagInput을 useCallback으로 메모이제이션
  // [P2-6 주의] 실시간 변형으로 인해 커서 점프 가능성 있음
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const processed = processTagInput(newValue);
    onChange?.(processed);
  }, [onChange]);

  return (
    <Input
      type="text"
      label={label}
      placeholder={placeholder}
      error={error}
      disabled={disabled}
      fullWidth={fullWidth}
      value={value}
      onChange={handleChange}
      onBlur={onBlur}
    />
  );
};

// 위젯 등록
// [P0-2 수정] SSR 안전 + 네임스페이스: 브라우저에서만 등록, 네임스페이스 키 사용
// registerWidget은 덮어쓰기를 지원하지만, SSR 안정성과 HMR 충돌 방지를 위해 브라우저에서만 등록
// [P1-2 수정] 로더 반환 형태: WidgetLoader 타입은 () => Promise<ComponentType>을 기대하므로 컴포넌트 직접 반환이 정석
// loadWidget은 (module as any).default || module로 처리하므로 컴포넌트 직접 반환도 지원
if (typeof window !== 'undefined') {
  // [P1-2 수정] 네임스페이스 키 기반으로 위젯 등록 플래그 관리
  // [P0-1 수정] window.__sduiWidgetRegistered 직접 접근 금지, 전용 util 사용
  const WIDGET_KEY = 'academy-admin/TagNameInput'; // [P1-2 수정] 위젯 키 네임스페이스화
  if (!isWidgetRegistered(WIDGET_KEY)) {
    // [P0-1 수정] WidgetLoader 타입: () => Promise<React.ComponentType<Record<string, unknown>>>
    // TagNameInputWidget은 명시적 props를 받으므로, Record<string, unknown>를 수용하는 래퍼로 감싸야 타입 안전
    registerWidget(WIDGET_KEY, () => {
      const Wrapped: React.FC<Record<string, unknown>> = (props) => (
        <TagNameInputWidget {...(props as Parameters<typeof TagNameInputWidget>[0])} />
      );
      return Promise.resolve(Wrapped);
    });
    setWidgetRegistered(WIDGET_KEY);
  }
}
// SSR 환경에서는 등록하지 않음 (브라우저에서만 필요)

export function StudentsPage() {
  // [P1-7 확인] navigate는 actionContextMemo에서 사용됨 (195줄)
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const iconSize = useIconSize();
  const iconStrokeWidth = useIconStrokeWidth();
  const { toast } = useToast();
  const terms = useIndustryTerms();

  // 서브 메뉴 상태 (URL에서 직접 읽음)
  const validIds = STUDENTS_SUB_MENU_ITEMS.map(item => item.id) as readonly StudentsSubMenuId[];
  const selectedSubMenu = getSubMenuFromUrl(searchParams, validIds, DEFAULT_STUDENTS_SUB_MENU);

  const handleSubMenuChange = useCallback((id: StudentsSubMenuId) => {
    // '학생등록' 메뉴를 클릭하면 모달을 띄움 (페이지 이동하지 않음)
    if (id === 'add') {
      setShowCreateForm(true);
      return;
    }
    const newUrl = setSubMenuToUrl(id, DEFAULT_STUDENTS_SUB_MENU);
    navigate(newUrl, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // [아키텍처] Application Layer와 UI Composition 분리
  // - useStudentPage Hook이 모든 비즈니스 로직, 상태 관리, 데이터 페칭을 담당
  // - 이 컴포넌트는 UI 조립만 담당
  const {
    // 상태
    filter,
    selectedStudentId,
    layerMenuTab,
    isEditing,
    showCreateForm,
    showGuardianForm,
    showConsultationForm,
    editingGuardianId,
    editingConsultationId,
    consultationTypeFilter,
    isTagListExpanded,
    showTagListToggle,
    tagListCollapsedHeight,
    tagListRef,
    fileInputRef,

    // 데이터
    students,
    totalCount,
    isLoading,
    error,
    tags,
    selectedStudent,
    selectedStudentLoading,
    selectedStudentGuardians,
    selectedStudentGuardiansLoading,
    selectedStudentConsultations,
    selectedStudentConsultationsLoading,
    selectedStudentTags,
    selectedStudentTagsLoading,
    selectedStudentClasses,
    selectedStudentClassesLoading,
    allClasses,
    userId,
    userRole,

    // 스키마
    effectiveFormSchema,
    effectiveFilterSchema,
    effectiveTableSchema,
    effectiveGuardianFormSchema,
    effectiveConsultationFormSchema,
    effectiveClassAssignmentFormSchema,

    // 테이블 관련
    tablePage,
    tableFilters,

    // 반응형
    isTablet: isTabletMode,

    // 핸들러
    handleStudentSelect,
    handleTabChange,
    handleFilterChange,
    handleTagFilter,
    handleDownload,
    handleDownloadTemplate,
    handleFileUpload,
    setShowCreateForm,
    setIsEditing,
    setShowGuardianForm,
    setShowConsultationForm,
    setEditingGuardianId,
    setEditingConsultationId,
    setConsultationTypeFilter,
    setIsTagListExpanded,
    setTablePage,

    // Mutations
    createStudent,
    bulkCreateStudents,
    updateStudent,
    deleteStudent,
    createGuardian,
    updateGuardian,
    deleteGuardian,
    createConsultation,
    updateConsultation,
    deleteConsultation,
    generateAISummary,
    updateStudentTags,
    assignStudentToClass,
    unassignStudentFromClass,
    updateStudentClassEnrolledAt,

    // 모달
    showConfirm,
  } = useStudentPage();

  // [P0-2 수정] SSOT: 네비게이션 보안 유틸리티 사용
  const safeNavigate = useMemo(
    () => createSafeNavigate(navigate),
    [navigate]
  );

  // actionContext와 onRowClick 메모이제이션하여 불필요한 리렌더링 방지
  // [P0-2 수정] SSOT: safeNavigate 사용 (외부에서 온 path 보호)
  const actionContextMemo = useMemo(() => ({
    navigate: (path: string) => safeNavigate(path),
  }), [safeNavigate]);

  const handleRowClickMemo = useCallback((row: Record<string, unknown>) => {
    const studentId = row.id as string;
    if (studentId) {
      handleStudentSelect(studentId);
    }
  }, [handleStudentSelect]);

  // 기간 필터 상태 (기본값: 최근 1개월)
  const [statsPeriod, setStatsPeriod] = useState<PeriodFilter>('1month');

  // 섹션 순서 상태 (기본값: 'stats-first' = StatsDashboard가 위, 'table-first' = SchemaTable이 위)
  // localStorage에 저장하여 새로고침 후에도 유지
  const SECTION_ORDER_KEY = 'students-section-order';
  const [sectionOrder, setSectionOrder] = useState<'stats-first' | 'table-first'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SECTION_ORDER_KEY);
      if (saved === 'table-first') return 'table-first';
    }
    return 'stats-first';
  });

  // 애니메이션 상태
  const [isAnimating, setIsAnimating] = useState(false);

  // 섹션 순서 토글 핸들러
  const handleToggleSectionOrder = useCallback(() => {
    // 페이드 아웃 시작
    setIsAnimating(true);

    // 페이드 아웃 완료 후 상태 변경
    setTimeout(() => {
      setSectionOrder((prev) => {
        const next = prev === 'stats-first' ? 'table-first' : 'stats-first';
        if (typeof window !== 'undefined') {
          localStorage.setItem(SECTION_ORDER_KEY, next);
        }
        return next;
      });

      // 페이드 인을 위해 애니메이션 상태 리셋
      setTimeout(() => {
        setIsAnimating(false);
      }, 50);
    }, 200);
  }, []);

  // 선택된 통계 카드 상태 (기본값: 전체 학생)
  const [selectedStatsKey, setSelectedStatsKey] = useState<string>('total');

  // 기간에 맞는 학생 데이터 필터링
  const filteredStudentsByPeriod = useMemo(() => {
    if (!students || students.length === 0) return students;

    const now = new Date();
    let startDate: Date;
    let endDate: Date | null = null;

    switch (statsPeriod) {
      case 'today': {
        // 오늘: 오늘 00:00:00부터
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
      }
      case 'yesterday': {
        // 어제: 어제 00:00:00부터 어제 23:59:59까지
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        break;
      }
      case 'thisWeek': {
        // 이번주: 이번주 월요일 00:00:00부터
        const dayOfWeek = now.getDay(); // 0(일) ~ 6(토)
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 일요일이면 6일 전, 그 외는 (요일-1)일 전
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToMonday, 0, 0, 0);
        break;
      }
      case 'lastWeek': {
        // 지난주: 지난주 월요일 00:00:00부터 일요일 23:59:59까지
        const dayOfWeek = now.getDay();
        const daysToLastMonday = dayOfWeek === 0 ? 13 : dayOfWeek + 6;
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToLastMonday, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dayOfWeek === 0 ? 7 : dayOfWeek), 23, 59, 59);
        break;
      }
      case 'lastMonth': {
        // 지난달: 지난달 1일 00:00:00부터 지난달 마지막날 23:59:59까지
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); // 이번달 0일 = 지난달 마지막날
        break;
      }
      case '1month': {
        // 최근 1개월
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      }
      case '3months': {
        // 최근 3개월
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      }
      case '6months': {
        // 최근 6개월
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      }
      case '1year': {
        // 최근 1년
        startDate = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
        break;
      }
      default:
        return students;
    }

    return students.filter(s => {
      const student = s as { created_at?: string };
      if (!student.created_at) return true; // created_at이 없으면 포함
      const createdDate = new Date(student.created_at);
      const afterStart = createdDate >= startDate;
      const beforeEnd = endDate ? createdDate <= endDate : true;
      return afterStart && beforeEnd;
    });
  }, [students, statsPeriod]);

  // 학생 현황 통계 계산 (기간 필터 적용)
  const studentStatusStats = useMemo(() => {
    // 데이터가 없을 때도 0으로 채운 통계 반환 (컴포넌트가 사라지지 않도록)
    if (!filteredStudentsByPeriod || filteredStudentsByPeriod.length === 0) {
      return {
        total: 0,
        active: 0,
        onLeave: 0,
        graduated: 0,
        withdrawn: 0,
      };
    }

    const total = filteredStudentsByPeriod.length;
    const active = filteredStudentsByPeriod.filter(s => (s as { status?: StudentStatus }).status === 'active').length;
    const onLeave = filteredStudentsByPeriod.filter(s => (s as { status?: StudentStatus }).status === 'on_leave').length;
    const graduated = filteredStudentsByPeriod.filter(s => (s as { status?: StudentStatus }).status === 'graduated').length;
    const withdrawn = filteredStudentsByPeriod.filter(s => (s as { status?: StudentStatus }).status === 'withdrawn').length;

    return {
      total,
      active,
      onLeave,
      graduated,
      withdrawn,
    };
  }, [filteredStudentsByPeriod]);

  // StatsDashboard용 통계 카드 데이터
  const statsItems: StatsItem[] = useMemo(() => {
    return [
      {
        key: 'total',
        icon: Users,
        title: `전체 ${terms.PERSON_LABEL_PRIMARY}`,
        value: studentStatusStats.total,
        unit: '명',
        iconBackgroundColor: 'var(--color-primary-50)',
      },
      {
        key: 'active',
        icon: UserCheck,
        title: '활성',
        value: studentStatusStats.active,
        unit: '명',
        iconBackgroundColor: 'var(--color-success-50)',
      },
      {
        key: 'onLeave',
        icon: Clock,
        title: '휴학',
        value: studentStatusStats.onLeave,
        unit: '명',
        iconBackgroundColor: 'var(--color-warning-50)',
      },
      {
        key: 'withdrawn',
        icon: UserX,
        title: '퇴학',
        value: studentStatusStats.withdrawn,
        unit: '명',
        iconBackgroundColor: 'var(--color-error-50)',
      },
    ];
  }, [studentStatusStats, terms.PERSON_LABEL_PRIMARY]);

  // StatsDashboard용 차트 데이터 (선택된 카드에 따라 필터링)
  const chartData: ChartDataItem[] = useMemo(() => {
    if (!students || students.length === 0) {
      return [];
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // 기간에 따른 시작 날짜 계산 (filteredStudentsByPeriod와 동일한 로직)
    switch (statsPeriod) {
      case 'today': {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
      }
      case 'yesterday': {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        break;
      }
      case 'thisWeek': {
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToMonday, 0, 0, 0);
        break;
      }
      case 'lastWeek': {
        const dayOfWeek = now.getDay();
        const daysToLastMonday = dayOfWeek === 0 ? 13 : dayOfWeek + 6;
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToLastMonday, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dayOfWeek === 0 ? 7 : dayOfWeek), 23, 59, 59);
        break;
      }
      case 'lastMonth': {
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      }
      case '1month': {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      }
      case '3months': {
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      }
      case '6months': {
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      }
      case '1year': {
        startDate = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
        break;
      }
      default:
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    }

    // 선택된 카드에 따라 학생 상태 필터링 함수
    const statusFilterMap: Record<string, (status: StudentStatus) => boolean> = {
      total: () => true,
      active: (status) => status === 'active',
      onLeave: (status) => status === 'on_leave',
      withdrawn: (status) => status === 'withdrawn',
    };

    const statusFilter = statusFilterMap[selectedStatsKey] || statusFilterMap.total;

    // 날짜별로 학생 데이터를 그룹화 (상태 필터 적용)
    const dateMap = new Map<string, number>();

    students.forEach(s => {
      const student = s as { created_at?: string; status?: StudentStatus };
      if (student.created_at && statusFilter(student.status as StudentStatus)) {
        const date = new Date(student.created_at);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
      }
    });

    // 기간 내 모든 날짜 생성
    const allDates: string[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      allDates.push(dateKey);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 누적 합계 계산 (startDate 이전의 학생 수부터 시작, 상태 필터 적용)
    let cumulative = 0;

    // startDate 이전에 생성된 학생 수 계산 (상태 필터 적용)
    students.forEach(s => {
      const student = s as { created_at?: string; status?: StudentStatus };
      if (student.created_at && statusFilter(student.status as StudentStatus)) {
        const date = new Date(student.created_at);
        if (date < startDate) {
          cumulative++;
        }
      }
    });

    // 모든 날짜에 대해 차트 데이터 생성
    return allDates.map(date => {
      const newStudents = dateMap.get(date) || 0;
      cumulative += newStudents;

      // 날짜에서 연도 제거 (MM-DD 형식)
      const [, month, day] = date.split('-');
      const shortDate = `${month}-${day}`;

      return {
        name: shortDate,
        value: cumulative,
        color: 'var(--color-primary)',
      };
    });
  }, [students, statsPeriod, selectedStatsKey]);

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', height: '100vh' }}>
        <SubSidebar
          title={`${terms.PERSON_LABEL_PRIMARY}관리`}
          items={STUDENTS_SUB_MENU_ITEMS}
          selectedId={selectedSubMenu}
          onSelect={handleSubMenuChange}
          relatedMenus={STUDENTS_RELATED_MENUS}
          testId="students-sub-sidebar"
        />
        <div style={{ flex: 1 }}>
      <RightLayerMenuLayout
        layerMenu={{
          isOpen: !!selectedStudentId,
          onClose: () => handleStudentSelect(null),
          // 중요: 내용 변경 감지를 위해 selectedStudentId를 contentKey로 전달
          contentKey: selectedStudentId || undefined,
          // 중요: 학생 상세 레이어 메뉴는 AI 레이어 메뉴보다 높은 z-index를 가져야 함 (항상 열려있는 AI 레이어 위에 오버레이)
          style: {
            zIndex: 'var(--z-modal)', // AI 레이어 메뉴(--z-sticky)보다 높음
          },
          title: selectedStudentLoading ? terms.MESSAGES.LOADING : selectedStudent ? (
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 'var(--spacing-sm)', minWidth: 0 }}>
              <span
                style={{
                  // 페이지 바디 헤더 타이틀(PageHeader)과 동일한 스타일
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
                {selectedStudent.name}
              </span>
              <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                {terms.PERSON_LABEL_PRIMARY} 상세정보
              </span>
            </span>
          ) : `${terms.PERSON_LABEL_PRIMARY} 상세`,
          width: isTabletMode ? 'var(--width-layer-menu-tablet)' : 'var(--width-layer-menu)',
          children: selectedStudentLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              {terms.MESSAGES.LOADING}
            </div>
          ) : selectedStudent ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--height-full)' }}>
              {/* 탭 버튼 (StudentDetailPage와 동일한 스타일) */}
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap', borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)', paddingBottom: 'var(--spacing-lg)' }}>
                <Button
                  variant={layerMenuTab === 'info' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('info')}
                >
                  {terms.PERSON_LABEL_PRIMARY} 기본정보
                </Button>
                <Button
                  variant={layerMenuTab === 'guardians' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('guardians')}
                >
                  {terms.GUARDIAN_LABEL} 정보 ({selectedStudentGuardians?.length || 0})
                </Button>
                <Button
                  variant={layerMenuTab === 'consultations' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('consultations')}
                >
                  {terms.CONSULTATION_LABEL_PLURAL} ({selectedStudentConsultations?.length || 0})
                </Button>
                <Button
                  variant={layerMenuTab === 'tags' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('tags')}
                >
                  {terms.TAG_LABEL} 관리
                </Button>
                <Button
                  variant={layerMenuTab === 'classes' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('classes')}
                >
                  {terms.GROUP_LABEL} 배정 ({(selectedStudentClasses ?? []).filter((sc) => sc.is_active).length})
                </Button>
                <Button
                  variant={layerMenuTab === 'attendance' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('attendance')}
                >
                  {terms.ATTENDANCE_LABEL} 기록
                </Button>
                <Button
                  variant={layerMenuTab === 'risk' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('risk')}
                >
                  {terms.EMERGENCY_RISK_LABEL}
                </Button>
                <Button
                  variant={layerMenuTab === 'message' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('message')}
                >
                  {terms.MESSAGE_LABEL} 발송
                </Button>
              </div>
              {/* 탭 내용 */}
              <div className="academyAdmin-hiddenScrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                {layerMenuTab === 'info' && selectedStudent && (
                  <StudentInfoTab
                    student={selectedStudent}
                    isEditing={isEditing}
                    effectiveStudentFormSchema={effectiveFormSchema}
                    onCancel={() => setIsEditing(false)}
                    onSave={async (data) => {
                      await updateStudent.mutateAsync({ studentId: selectedStudent.id, input: data });
                      setIsEditing(false);
                    }}
                    onEdit={() => setIsEditing(true)}
                    onDelete={async () => {
                      const confirmed = await showConfirm(
                        `정말 삭제하시겠습니까?\n(문서 기준: ${terms.PERSON_LABEL_PRIMARY}은(는) 삭제 시 상태가 퇴원(withdrawn)으로 변경됩니다.)`,
                        `${terms.PERSON_LABEL_PRIMARY} ${terms.MESSAGES.DELETE_CONFIRM}`
                      );
                      if (!confirmed) return;
                      await deleteStudent.mutateAsync(selectedStudent.id);
                      toast(`${terms.PERSON_LABEL_PRIMARY}이(가) 삭제(퇴원 처리)되었습니다.`, 'success');
                      handleStudentSelect(null);
                    }}
                  />
                )}
                {layerMenuTab === 'guardians' && selectedStudent && (
                  <GuardiansTab
                    guardians={selectedStudentGuardians || []}
                    isLoading={selectedStudentGuardiansLoading}
                    showForm={showGuardianForm}
                    editingGuardianId={editingGuardianId}
                    effectiveGuardianFormSchema={effectiveGuardianFormSchema}
                    onShowForm={() => setShowGuardianForm(true)}
                    onHideForm={() => {
                      setShowGuardianForm(false);
                      setEditingGuardianId(null);
                    }}
                    onEdit={(guardianId) => {
                      setEditingGuardianId(guardianId);
                      setShowGuardianForm(true);
                    }}
                    onCreate={async (data) => {
                      await createGuardian.mutateAsync({ studentId: selectedStudent.id, guardian: data as Omit<Guardian, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'> });
                      setShowGuardianForm(false);
                    }}
                    onUpdate={async (guardianId, data) => {
                      await updateGuardian.mutateAsync({ guardianId, guardian: data, studentId: selectedStudent.id });
                      setShowGuardianForm(false);
                      setEditingGuardianId(null);
                    }}
                    onDelete={async (guardianId) => {
                      const confirmed = await showConfirm(terms.MESSAGES.DELETE_CONFIRM, `${terms.GUARDIAN_LABEL} 삭제`);
                      if (confirmed) {
                        await deleteGuardian.mutateAsync({ guardianId, studentId: selectedStudent.id });
                      }
                    }}
                    isEditable={userRole !== 'teacher' && userRole !== 'assistant'}
                  />
                )}
                {layerMenuTab === 'consultations' && selectedStudent && (
                  <ConsultationsTab
                    consultations={selectedStudentConsultations || []}
                    isLoading={selectedStudentConsultationsLoading}
                    showForm={showConsultationForm}
                    editingConsultationId={editingConsultationId}
                    consultationTypeFilter={consultationTypeFilter}
                    effectiveConsultationFormSchema={effectiveConsultationFormSchema}
                    onShowForm={() => setShowConsultationForm(true)}
                    onHideForm={() => {
                      setShowConsultationForm(false);
                      setEditingConsultationId(null);
                    }}
                    onEdit={(consultationId) => {
                      setEditingConsultationId(consultationId);
                      setShowConsultationForm(true);
                    }}
                    onCreate={async (data) => {
                      if (!userId) {
                        toast(`사용자 정보를 가져올 수 없습니다. ${terms.MESSAGES.ALERT}하세요.`, 'error');
                        return;
                      }
                      await createConsultation.mutateAsync({ studentId: selectedStudent.id, consultation: data as Omit<StudentConsultation, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>, userId });
                      setShowConsultationForm(false);
                    }}
                    onUpdate={async (consultationId, data) => {
                      await updateConsultation.mutateAsync({ consultationId, consultation: data, studentId: selectedStudent.id });
                      setShowConsultationForm(false);
                      setEditingConsultationId(null);
                    }}
                    onDelete={async (consultationId) => {
                      const confirmed = await showConfirm(terms.MESSAGES.DELETE_CONFIRM, `${terms.CONSULTATION_LABEL_PLURAL} 삭제`);
                      if (confirmed) {
                        await deleteConsultation.mutateAsync({ consultationId, studentId: selectedStudent.id });
                      }
                    }}
                    onGenerateAISummary={async (consultationId) => {
                      try {
                        await generateAISummary.mutateAsync({ consultationId, studentId: selectedStudent.id });
                      } catch (error) {
                        toast(
                          error instanceof Error ? error.message : `AI ${terms.MESSAGES.SAVE_ERROR}`,
                          'error'
                        );
                      }
                    }}
                    onFilterChange={setConsultationTypeFilter}
                    isEditable={userRole !== 'assistant'}
                  />
                )}
                {layerMenuTab === 'tags' && selectedStudent && (
                  <TagsTab
                    studentTags={selectedStudentTags || []}
                    isLoading={selectedStudentTagsLoading}
                    studentId={selectedStudent.id}
                    onUpdateTags={async (tagIds) => {
                      await updateStudentTags.mutateAsync({ studentId: selectedStudent.id, tagIds });
                    }}
                    isEditable={userRole !== 'teacher' && userRole !== 'assistant'}
                    tagFormSchema={tagFormSchema}
                  />
                )}
                {layerMenuTab === 'classes' && selectedStudent && (
                  <ClassesTab
                    studentClasses={selectedStudentClasses}
                    isLoading={selectedStudentClassesLoading}
                    allClasses={allClasses || []}
                    effectiveClassAssignmentFormSchema={effectiveClassAssignmentFormSchema}
                    onAssign={async (classId, enrolledAt) => {
                      await assignStudentToClass.mutateAsync({
                        studentId: selectedStudent.id,
                        classId,
                        enrolledAt,
                      });
                    }}
                    onUnassign={async (classId, leftAt) => {
                      await unassignStudentFromClass.mutateAsync({
                        studentId: selectedStudent.id,
                        classId,
                        leftAt,
                      });
                    }}
                    onUpdate={async (studentClassId, enrolledAt) => {
                      // [P0-2 수정] App Layer 분리 원칙 준수: Hook을 통한 업데이트
                      await updateStudentClassEnrolledAt.mutateAsync({
                        studentClassId,
                        enrolledAt,
                      });
                    }}
                    isEditable={userRole !== 'teacher' && userRole !== 'assistant'}
                  />
                )}
                {layerMenuTab === 'attendance' && selectedStudent && (
                  <AttendanceTab
                    studentId={selectedStudentId}
                    student={selectedStudent}
                    isEditable={userRole !== 'teacher' && userRole !== 'assistant'}
                  />
                )}
                {layerMenuTab === 'risk' && selectedStudent && (
                  <RiskAnalysisTab
                    studentId={selectedStudentId}
                    isEditable={userRole !== 'teacher' && userRole !== 'assistant'}
                  />
                )}
                {layerMenuTab === 'message' && selectedStudent && (
                  <MessageSendTab
                    studentId={selectedStudentId}
                    student={selectedStudent}
                    isEditable={userRole !== 'teacher' && userRole !== 'assistant'}
                  />
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              {terms.PERSON_LABEL_PRIMARY} 정보를 불러올 수 없습니다.
            </div>
          ),
        }}
      >
        <Container maxWidth="xl" padding="lg">
        {/* 타이틀 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xl)' }}>
          <PageHeader
            title={`${terms.PERSON_LABEL_PRIMARY}목록`}
            style={{ marginBottom: 0 }}
          />
          {/* 섹션 순서 토글 버튼 */}
          <Tooltip
            content={sectionOrder === 'stats-first' ? '학생목록이 위로' : '학생목록이 아래로'}
            position="top"
          >
            <button
              type="button"
              onClick={handleToggleSectionOrder}
              aria-label={sectionOrder === 'stats-first' ? '테이블을 위로 이동' : '통계를 위로 이동'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--spacing-xs)',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                borderRadius: 'var(--border-radius-sm)',
                transition: 'color var(--transition-fast), background-color var(--transition-fast)',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text)';
                e.currentTarget.style.backgroundColor = 'var(--color-primary-40)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <ArrowUpDown size={iconSize} strokeWidth={iconStrokeWidth} />
            </button>
          </Tooltip>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            await handleFileUpload(file);
          }}
        />

        {/* 학생 목록 탭 ('list') */}
        {selectedSubMenu === 'list' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              opacity: isAnimating ? 0 : 1,
              transition: 'opacity 0.2s ease-in-out',
            }}
          >
            {/* 학생 현황 통계 카드 & 그래프 - 순서에 따라 위치 변경 */}
            {sectionOrder === 'stats-first' && statsItems.length > 0 && (
              <div style={{ marginBottom: 'calc(var(--spacing-xl) * 2)' }}>
                <StatsDashboard
                  statsItems={statsItems}
                  chartData={chartData}
                  period={statsPeriod}
                  onPeriodChange={setStatsPeriod}
                  selectedStatsKey={selectedStatsKey}
                  onStatsCardClick={setSelectedStatsKey}
                />
              </div>
            )}

            {/* 테이블 섹션 컨테이너 */}
            <div>
        {/* 태그 필터 */}
        {tags && tags.length > 0 && (
            <div style={{ position: 'relative', marginBottom: 'var(--spacing-md)' }}>
              <div
                ref={tagListRef}
                style={{
                  display: 'flex',
                  gap: 'var(--spacing-xs)',
                  flexWrap: 'wrap',
                  // 토글 버튼 영역 확보 (우측 화살표가 버튼을 가리지 않도록)
                  // [불변 규칙] 하드코딩 금지: CSS 변수만 사용 (스키마엔진 문서 1 참조)
                  paddingRight: showTagListToggle
                    ? 'calc(var(--spacing-sm) + var(--size-icon-base) + var(--spacing-xs))'
                    : undefined,
                  // 접기 상태: 1줄까지만 보여주기
                  // HARD-CODE-EXCEPTION: tagListCollapsedHeight는 동적으로 계산된 값이지만 px 단위 사용 (레이아웃용 특수 값)
                  maxHeight: !isTagListExpanded && tagListCollapsedHeight ? `${tagListCollapsedHeight}px` : undefined,
                  overflow: !isTagListExpanded && showTagListToggle ? 'hidden' : undefined,
                  transition: 'max-height var(--transition-fast)',
                }}
              >
                {/* 요청사항: 태그가 있는 경우에만, 첫 번째 태그 왼쪽에 배지 버튼 출력 */}
                {/* [최적화] 외부에서 이미 tags && tags.length > 0로 체크했으므로 중복 체크 제거 */}
                  <div
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-bold)',
                      fontFamily: 'var(--font-family)',
                      lineHeight: 'var(--line-height)',
                      borderRadius: 'var(--border-radius-xs)',
                      border: 'var(--border-width-thin) solid var(--color-text)',
                      color: 'var(--color-white)',
                      backgroundColor: 'var(--color-text)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {terms.TAG_LABEL}
                  </div>
                {tags.map((tag: { id: string; name: string; color: string }) => (
                  <Button
                    key={tag.id}
                    variant={filter.tag_ids?.includes(tag.id) ? 'solid' : 'outline'}
                    size="sm"
                    onClick={() => handleTagFilter(tag.id)}
                    style={{
                      // 요청사항:
                      // - 태그 리스트 버튼 사이즈(체감)를 줄임 (CSS 변수 사용)
                      // - 기본(미선택) 버튼 배경을 화이트로 고정
                      // [불변 규칙] 하드코딩 금지: CSS 변수만 사용 (스키마엔진 문서 1 참조)
                      fontSize: 'calc(var(--font-size-sm) - var(--spacing-xxs))',
                      backgroundColor: filter.tag_ids?.includes(tag.id) ? tag.color : 'var(--color-white)',
                      color: filter.tag_ids?.includes(tag.id) ? 'var(--color-white)' : undefined,
                    }}
                  >
                    {tag.name}
                  </Button>
                ))}
              </div>

              {/* 요청사항: 화살표만 추가 (한 줄 초과 시에만 노출) */}
              {showTagListToggle && (
                <button
                  type="button"
                  aria-label={isTagListExpanded ? `${terms.TAG_LABEL} 목록 접기` : `${terms.TAG_LABEL} 목록 펼치기`}
                  onClick={() => setIsTagListExpanded((v: boolean) => !v)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    // HARD-CODE-EXCEPTION: tagListCollapsedHeight는 동적으로 계산된 값이지만 px 단위 사용 (레이아웃용 특수 값)
                    height: tagListCollapsedHeight ? `${tagListCollapsedHeight}px` : 'var(--size-pagination-button)',
                    width: 'calc(var(--spacing-sm) + var(--size-icon-base) + var(--spacing-xs))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {isTagListExpanded
                    ? <ChevronUp size={iconSize} strokeWidth={iconStrokeWidth} />
                    : <ChevronDown size={iconSize} strokeWidth={iconStrokeWidth} />}
                </button>
              )}
            </div>
        )}

        {/* [업종중립] PERSON 등록 폼 - 모달로 표시 */}
        {showCreateForm && (() => {
          let triggerSubmit: (() => void) | null = null;
          return (
            <Modal
              isOpen={showCreateForm}
              onClose={() => setShowCreateForm(false)}
              title={`${terms.PERSON_LABEL_PRIMARY}등록`}
              size="lg"
              footer={
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                    style={{ flex: 1 }}
                  >
                    {terms.MESSAGES.CANCEL}
                  </Button>
                  <Button
                    variant="solid"
                    color="primary"
                    onClick={() => triggerSubmit?.()}
                    style={{ flex: 1 }}
                  >
                    {terms.MESSAGES.SAVE}
                  </Button>
                </>
              }
            >
              <CreateStudentForm
                onClose={() => setShowCreateForm(false)}
                onSubmit={async (data) => {
                  await createStudent.mutateAsync(data);
                  setShowCreateForm(false);
                }}
                effectiveFormSchema={effectiveFormSchema}
                onSubmitTrigger={(fn) => { triggerSubmit = fn; }}
              />
            </Modal>
          );
        })()}

        {/* 학생 목록 */}
        {/* 로딩 상태 */}
        {isLoading && (
          <Card padding="lg" variant="default">
            <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              {terms.PERSON_LABEL_PRIMARY} 목록 {terms.MESSAGES.LOADING}
            </div>
          </Card>
        )}

        {/* 에러 상태 (로딩 완료 후에만 표시) */}
        {!isLoading && error && (
            <Card padding="md" variant="outlined">
              <div style={{ color: 'var(--color-error)' }}>
                {terms.MESSAGES.ERROR}: {error instanceof Error ? error.message : `${terms.PERSON_LABEL_PRIMARY} 목록 불러오기 ${terms.MESSAGES.SAVE_ERROR}`}
              </div>
          </Card>
        )}

        {/* 학생 목록 (로딩 완료 후, 에러 없을 때만 표시) */}
        {!isLoading && !error && students && students.length > 0 && (
            <>
              {effectiveTableSchema && (
                <SchemaTable
                  schema={effectiveTableSchema}
                  data={(students as unknown as Record<string, unknown>[]) || []}
                  totalCount={totalCount}
                  page={tablePage}
                  onPageChange={setTablePage}
                  filters={tableFilters}
                  actionContext={actionContextMemo}
                  onRowClick={handleRowClickMemo}
                  filterSchema={effectiveFilterSchema}
                  onFilterChange={handleFilterChange}
                  filterDefaultValues={{
                    search: filter.search || '',
                    status: filter.status || '',
                    grade: filter.grade || '',
                    class_id: filter.class_id || '',
                  }}
                  customActions={
                    <DataTableActionButtons
                      align="right"
                      onCreate={() => setShowCreateForm(true)}
                      onUpload={() => fileInputRef.current?.click()}
                      onDownload={handleDownload}
                      onDownloadTemplate={handleDownloadTemplate}
                      uploadDisabled={bulkCreateStudents.isPending}
                      createTooltip={`${terms.PERSON_LABEL_PRIMARY}등록`}
                    />
                  }
                />
              )}
          </>
        )}

        {/* 빈 상태 (로딩 완료 후, 에러 없을 때, 학생이 없을 때만 표시) */}
        {!isLoading && !error && students && students.length === 0 && (
            <Card padding="lg" variant="default">
              <EmptyState
                icon={Users}
                message={`등록된 ${terms.PERSON_LABEL_PRIMARY}이(가) ${terms.MESSAGES.NO_DATA}`}
                actions={
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateForm(true)}
                  >
                    첫 {terms.PERSON_LABEL_PRIMARY} 등록
                  </Button>
                }
              />
          </Card>
        )}
            </div>

            {/* table-first일 때 StatsDashboard를 아래에 표시 */}
            {sectionOrder === 'table-first' && statsItems.length > 0 && (
              <div style={{ marginTop: 'calc(var(--spacing-xl) * 2)' }}>
                <StatsDashboard
                  statsItems={statsItems}
                  chartData={chartData}
                  period={statsPeriod}
                  onPeriodChange={setStatsPeriod}
                  selectedStatsKey={selectedStatsKey}
                  onStatsCardClick={setSelectedStatsKey}
                />
              </div>
            )}
          </div>
        )}

        {/* [업종중립] PERSON 등록 탭 ('add') */}
        {selectedSubMenu === 'add' && (
          <Card padding="lg" variant="default">
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <h2 style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 'var(--font-weight-bold)',
                marginBottom: 'var(--spacing-md)'
              }}>
                {terms.PERSON_LABEL_PRIMARY}등록
              </h2>
            </div>
            <CreateStudentForm
              onClose={() => handleSubMenuChange('list')}
              onSubmit={async (data) => {
                await createStudent.mutateAsync(data);
                handleSubMenuChange('list');
              }}
              effectiveFormSchema={effectiveFormSchema}
            />
          </Card>
        )}

        {/* 태그 관리 탭 ('tags') */}
        {selectedSubMenu === 'tags' && (
          <Card padding="lg" variant="default">
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <h2 style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 'var(--font-weight-bold)',
                marginBottom: 'var(--spacing-md)'
              }}>
                {terms.TAG_LABEL} 관리
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                {terms.PERSON_LABEL_PRIMARY}에게 적용할 수 있는 {terms.TAG_LABEL}을(를) 관리합니다.
              </p>
            </div>
            <EmptyState
              icon={Users}
              message={`${terms.TAG_LABEL} 관리 기능은 준비 중입니다.`}
            />
          </Card>
        )}

        {/* 학생 통계 탭 ('statistics') */}
        {selectedSubMenu === 'statistics' && (
          <Card padding="lg" variant="default">
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <h2 style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 'var(--font-weight-bold)',
                marginBottom: 'var(--spacing-md)'
              }}>
                {terms.PERSON_LABEL_PRIMARY} 통계
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                {terms.PERSON_LABEL_PRIMARY} 등록, 이탈, 현황 등의 통계를 확인할 수 있습니다.
              </p>
            </div>
            <EmptyState
              icon={Users}
              message={`${terms.PERSON_LABEL_PRIMARY} 통계 기능은 준비 중입니다.`}
            />
          </Card>
        )}

      </Container>
      </RightLayerMenuLayout>
        </div>
      </div>
    </ErrorBoundary>
  );
}

// ============================================================================
// RightLayerMenu: Header(밑줄만) + Content 컨테이너 공통 스타일
// [P0-1 수정] 요구사항 확정: 헤더에 밑줄 적용 (주석과 구현 일치)
// - Card의 title 영역을 쓰지 않고, 상단 헤더를 분리하여 밑줄만 적용
// - 밑줄 색상은 텍스트 기본색(var(--color-text))을 사용
// - 테두리/배경은 제거(하드코딩 금지, CSS 변수 사용)
// ============================================================================
// LayerSectionHeader는 별도 파일(./students/components/LayerSectionHeader.tsx)에서 import 사용

// CreateStudentForm은 별도 파일(./students/components/CreateStudentForm.tsx)에서 import


// ============================================================================
// StudentDetailPage의 모든 탭 컴포넌트 (레이어 메뉴에서 재사용)
// 모든 탭 컴포넌트는 별도 파일로 분리되었습니다.
// ============================================================================

// StudentInfoTab은 별도 파일(./students/tabs/StudentInfoTab.tsx)로 분리됨
// GuardiansTab은 별도 파일(./students/tabs/GuardiansTab.tsx)로 분리됨
// ConsultationsTab은 별도 파일(./students/tabs/ConsultationsTab.tsx)로 분리됨
// TagsTab은 별도 파일(./students/tabs/TagsTab.tsx)로 분리됨
// ClassesTab은 별도 파일(./students/tabs/ClassesTab.tsx)로 분리됨
// AttendanceTab은 별도 파일(./students/tabs/AttendanceTab.tsx)로 분리됨
// RiskAnalysisTab은 별도 파일(./students/tabs/RiskAnalysisTab.tsx)로 분리됨
// MessageSendTab은 별도 파일(./students/tabs/MessageSendTab.tsx)로 분리됨

