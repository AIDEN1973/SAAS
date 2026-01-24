/**
 * 학생 관리 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 *
 * [리팩토링] SubSidebar 탭별 SubPage 컴포넌트로 분리 (2024-01)
 * - StudentListSubPage: 학생 목록 탭
 * - StudentConsultSubPage: 상담관리 탭
 * - StudentTagsSubPage: 태그 관리 탭
 * - StudentStatsSubPage: 학생 통계 탭
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorBoundary, useIconSize, useIconStrokeWidth, useToast, Input, Container, Button, RightLayerMenuLayout, SubSidebar, Modal } from '@ui-core/react';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';
import type { StatsItem, ChartDataItem, PeriodFilter } from '../components/stats';
import { registerWidget } from '@schema-engine';
import { useStudentPage } from './hooks/useStudentPage';
import { tagFormSchema } from '../schemas/tag.schema';
import { consultationTableSchema } from '../schemas/consultation.table.schema';
import { consultationFilterSchema } from '../schemas/consultation.filter.schema';
import { isWidgetRegistered, setWidgetRegistered } from '../utils/widget-registry';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { toKST } from '@lib/date-utils';
// [SSOT] Barrel export를 통한 통합 import
import { createSafeNavigate, processTagInput, calculateTrend, p, templates } from '../utils';
import { STUDENTS_SUB_MENU_ITEMS, DEFAULT_STUDENTS_SUB_MENU, STUDENTS_RELATED_MENUS, STUDENTS_MENU_LABEL_MAPPING, getSubMenuFromUrl, setSubMenuToUrl, applyDynamicLabels } from '../constants';
import type { StudentsSubMenuId } from '../constants';
import { StudentInfoTab } from './students/tabs/StudentInfoTab';
import { ConsultationsTab } from './students/tabs/ConsultationsTab';
import { TagsTab } from './students/tabs/TagsTab';
import { ClassesTab } from './students/tabs/ClassesTab';
import { AttendanceTab } from './students/tabs/AttendanceTab';
import { RiskAnalysisTab } from './students/tabs/RiskAnalysisTab';
import { MessageSendTab } from './students/tabs/MessageSendTab';
import { CreateStudentForm } from './students/components/CreateStudentForm';
// SubPage 컴포넌트 import
import { StudentListSubPage, StudentTagsSubPage, StudentStatsSubPage, StudentConsultSubPage, StudentClassAssignmentSubPage } from './students/subpages';
import type { StudentStatus, StudentConsultation } from '@services/student-service';

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

  // 현재 선택된 서브메뉴의 label 가져오기 (페이지 타이틀용)
  const currentSubMenuLabel = useMemo(() => {
    const menuItem = STUDENTS_SUB_MENU_ITEMS.find(item => item.id === selectedSubMenu);
    return menuItem?.label || '';
  }, [selectedSubMenu]);

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
    showConsultationForm,
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
    tagAssignments,
    selectedStudent,
    selectedStudentLoading,
    selectedStudentConsultations,
    selectedStudentConsultationsLoading,
    selectedStudentTags,
    selectedStudentTagsLoading,
    selectedStudentClasses,
    selectedStudentClassesLoading,
    allClasses,
    userId,
    userRole,
    allConsultations,
    allConsultationsLoading,
    filteredAllConsultations,
    allStudentClasses,
    allStudentClassesLoading,
    selectedConsultationId,
    setSelectedConsultationId,

    // 스키마
    effectiveFormSchema,
    effectiveFilterSchema,
    effectiveTableSchema,
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
    setShowConsultationForm,
    setEditingConsultationId,
    setConsultationTypeFilter,
    setIsTagListExpanded,
    setTablePage,

    // Mutations
    createStudent,
    bulkCreateStudents,
    updateStudent,
    deleteStudent,
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

  // 서브사이드바 축소 상태 (태블릿 모드 기본값, 사용자 토글 가능)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isTabletMode);
  // 태블릿 모드 변경 시 축소 상태 동기화
  useEffect(() => {
    setSidebarCollapsed(isTabletMode);
  }, [isTabletMode]);

  // 서브메뉴 변경 핸들러 (useStudentPage 훅 다음에 선언하여 setShowCreateForm 사용 가능)
  const handleSubMenuChange = useCallback((id: StudentsSubMenuId) => {
    // '학생등록' 메뉴를 클릭하면 항상 모달을 띄움 (페이지 이동하지 않음)
    if (id === 'add') {
      setShowCreateForm(true);
      return;
    }
    // 다른 메뉴는 URL을 변경하여 해당 탭으로 이동 (브라우저 히스토리에 추가)
    const newUrl = setSubMenuToUrl(id, DEFAULT_STUDENTS_SUB_MENU);
    navigate(newUrl);
  }, [navigate, setShowCreateForm]);

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

  // 선택된 통계 카드 상태 (기본값: 전체 학생)
  const [selectedStatsKey, setSelectedStatsKey] = useState<string>('total');

  // 상담 탭 선택된 통계 카드 상태 (기본값: 전체 상담)
  const [selectedConsultationStatsKey, setSelectedConsultationStatsKey] = useState<string>('total');

  // 상담 필터 상태
  const [consultationFilters, setConsultationFilters] = useState({
    search: '',
    consultation_type: '',
    date_from: '',
    date_to: '',
  });

  // 상담 필터 핸들러
  const handleConsultationFilterChange = useCallback((newFilters: Record<string, unknown>) => {
    setConsultationFilters((prev) => ({
      ...prev,
      search: typeof newFilters.search === 'string' ? newFilters.search : prev.search,
      consultation_type: typeof newFilters.consultation_type === 'string' ? newFilters.consultation_type : prev.consultation_type,
      date_from: typeof newFilters.date_from === 'string' ? newFilters.date_from : prev.date_from,
      date_to: typeof newFilters.date_to === 'string' ? newFilters.date_to : prev.date_to,
    }));
  }, []);

  // 상담 목록 필터링 (SchemaTable 필터 적용)
  const filteredConsultationsWithTableFilters = useMemo(() => {
    let result = filteredAllConsultations;

    // 검색어 필터
    if (consultationFilters.search) {
      const searchLower = consultationFilters.search.toLowerCase();
      result = result.filter((c) => {
        const student = students.find(s => s.id === c.student_id);
        const studentName = student?.name || '';
        const content = c.content || '';
        return (
          studentName.toLowerCase().includes(searchLower) ||
          content.toLowerCase().includes(searchLower)
        );
      });
    }

    // 상담 구분 필터 (consultationTypeFilter와 중복이지만 SchemaTable 필터에서도 적용)
    if (consultationFilters.consultation_type) {
      result = result.filter((c) => c.consultation_type === consultationFilters.consultation_type);
    }

    // 시작일 필터
    if (consultationFilters.date_from) {
      const fromDate = new Date(consultationFilters.date_from);
      result = result.filter((c) => new Date(c.consultation_date) >= fromDate);
    }

    // 종료일 필터
    if (consultationFilters.date_to) {
      const toDate = new Date(consultationFilters.date_to);
      result = result.filter((c) => new Date(c.consultation_date) <= toDate);
    }

    return result;
  }, [filteredAllConsultations, consultationFilters, students]);

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

  // 지난달 통계 계산 (trend 표시용)
  const lastMonthStats = useMemo(() => {
    if (!students || students.length === 0) {
      return {
        total: 0,
        active: 0,
        onLeave: 0,
        graduated: 0,
        withdrawn: 0,
      };
    }

    // 지난달 말일 계산
    const now = new Date();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // 이번 달 0일 = 지난달 마지막 날

    // 지난달까지 생성된 학생들
    const lastMonthStudents = students.filter(s => {
      const student = s as { created_at?: string };
      if (!student.created_at) return false;
      return new Date(student.created_at) <= lastMonthEnd;
    });

    const total = lastMonthStudents.length;
    const active = lastMonthStudents.filter(s => (s as { status?: StudentStatus }).status === 'active').length;
    const onLeave = lastMonthStudents.filter(s => (s as { status?: StudentStatus }).status === 'on_leave').length;
    const graduated = lastMonthStudents.filter(s => (s as { status?: StudentStatus }).status === 'graduated').length;
    const withdrawn = lastMonthStudents.filter(s => (s as { status?: StudentStatus }).status === 'withdrawn').length;

    return {
      total,
      active,
      onLeave,
      graduated,
      withdrawn,
    };
  }, [students]);

  // 상담 통계 계산
  const consultationStats = useMemo(() => {
    if (!filteredConsultationsWithTableFilters || filteredConsultationsWithTableFilters.length === 0) {
      return {
        total: 0,
        counseling: 0,
        learning: 0,
        behavior: 0,
        other: 0,
      };
    }

    const total = filteredConsultationsWithTableFilters.length;
    const counseling = filteredConsultationsWithTableFilters.filter(c => c.consultation_type === 'counseling').length;
    const learning = filteredConsultationsWithTableFilters.filter(c => c.consultation_type === 'learning').length;
    const behavior = filteredConsultationsWithTableFilters.filter(c => c.consultation_type === 'behavior').length;
    const other = filteredConsultationsWithTableFilters.filter(c => c.consultation_type === 'other').length;

    return {
      total,
      counseling,
      learning,
      behavior,
      other,
    };
  }, [filteredConsultationsWithTableFilters]);

  // StatsDashboard용 통계 카드 데이터 (학생 목록 탭용)
  const statsItems: StatsItem[] = useMemo(() => {
    return [
      {
        key: 'total',
        icon: Users,
        title: `전체 ${terms.PERSON_LABEL_PRIMARY}`,
        value: studentStatusStats.total,
        unit: '명',
        iconBackgroundColor: 'var(--color-primary-50)',
        trend: calculateTrend(studentStatusStats.total, lastMonthStats.total),
      },
      {
        key: 'active',
        icon: UserCheck,
        title: '활성',
        value: studentStatusStats.active,
        unit: '명',
        iconBackgroundColor: 'var(--color-success-50)',
        trend: calculateTrend(studentStatusStats.active, lastMonthStats.active),
      },
      {
        key: 'onLeave',
        icon: Clock,
        title: terms.STAFF_LEAVE === '휴직' ? '휴원' : '휴회',  // 학원: 휴원, 피트니스: 휴회
        value: studentStatusStats.onLeave,
        unit: '명',
        iconBackgroundColor: 'var(--color-warning-50)',
        trend: calculateTrend(studentStatusStats.onLeave, lastMonthStats.onLeave),
      },
      {
        key: 'withdrawn',
        icon: UserX,
        title: terms.STAFF_RESIGNED === '퇴직' ? '퇴원' : '탈퇴',  // 학원: 퇴원, 피트니스: 탈퇴
        value: studentStatusStats.withdrawn,
        unit: '명',
        iconBackgroundColor: 'var(--color-error-50)',
        trend: calculateTrend(studentStatusStats.withdrawn, lastMonthStats.withdrawn),
      },
    ];
  }, [studentStatusStats, lastMonthStats, terms.PERSON_LABEL_PRIMARY, terms.STAFF_LEAVE, terms.STAFF_RESIGNED]);

  // 상담관리 탭용 통계 카드 데이터
  const consultationStatsItems: StatsItem[] = useMemo(() => {
    return [
      {
        key: 'total',
        icon: Users,
        title: `전체 ${terms.CONSULTATION_LABEL_PLURAL}`,
        value: consultationStats.total,
        unit: '건',
        iconBackgroundColor: 'var(--color-primary-50)',
      },
      {
        key: 'counseling',
        icon: Users,
        title: terms.CONSULTATION_TYPE_LABELS.counseling,
        value: consultationStats.counseling,
        unit: '건',
        iconBackgroundColor: 'var(--color-info-50)',
      },
      {
        key: 'learning',
        icon: Users,
        title: terms.CONSULTATION_TYPE_LABELS.learning,
        value: consultationStats.learning,
        unit: '건',
        iconBackgroundColor: 'var(--color-success-50)',
      },
      {
        key: 'behavior',
        icon: Users,
        title: terms.CONSULTATION_TYPE_LABELS.behavior,
        value: consultationStats.behavior,
        unit: '건',
        iconBackgroundColor: 'var(--color-warning-50)',
      },
      {
        key: 'other',
        icon: Users,
        title: terms.CONSULTATION_TYPE_LABELS.other,
        value: consultationStats.other,
        unit: '건',
        iconBackgroundColor: 'var(--color-error-50)',
      },
    ];
  }, [consultationStats, terms.CONSULTATION_LABEL_PLURAL, terms.CONSULTATION_TYPE_LABELS]);

  // 상담관리 탭용 차트 데이터 (선택된 카드에 따라 필터링)
  const consultationChartData: ChartDataItem[] = useMemo(() => {
    if (!filteredConsultationsWithTableFilters || filteredConsultationsWithTableFilters.length === 0) {
      return [];
    }

    // 선택된 통계 카드에 따라 필터링
    const typeFilterMap: Record<string, (type: string) => boolean> = {
      total: () => true,
      counseling: (type) => type === 'counseling',
      learning: (type) => type === 'learning',
      behavior: (type) => type === 'behavior',
      other: (type) => type === 'other',
    };

    const typeFilter = typeFilterMap[selectedConsultationStatsKey] || typeFilterMap.total;

    // 날짜별로 상담 데이터를 그룹화 (타입 필터 적용)
    const dateMap = new Map<string, number>();

    filteredConsultationsWithTableFilters
      .filter((c) => typeFilter(c.consultation_type))
      .forEach((consultation) => {
        const date = toKST(consultation.consultation_date).format('YYYY-MM-DD');
        dateMap.set(date, (dateMap.get(date) || 0) + 1);
      });

    // 날짜순 정렬하여 차트 데이터 생성
    return Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => {
        return {
          name: toKST(date).format('MM/DD'),
          value: count,
          color: 'var(--color-primary)',
        };
      });
  }, [filteredConsultationsWithTableFilters, selectedConsultationStatsKey]);

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
      graduated: (status) => status === 'graduated',
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

  // 서브메뉴 아이템에 동적 라벨 및 opensInModalOrNewWindow 속성 적용
  const subMenuItemsWithDynamicLabels = useMemo(() => {
    // 1. 동적 라벨 적용 (업종 중립)
    const itemsWithLabels = applyDynamicLabels(STUDENTS_SUB_MENU_ITEMS, STUDENTS_MENU_LABEL_MAPPING, terms);

    // 2. '등록' 메뉴에 모달 표시 추가
    return itemsWithLabels.map(item => {
      if (item.id === 'add') {
        return { ...item, opensInModalOrNewWindow: true };
      }
      return item;
    });
  }, [terms]);

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', minHeight: 'var(--height-full)' }}>
        {/* 서브 사이드바 (태블릿에서는 축소) */}
        <SubSidebar
          title={templates.management(terms.PERSON_LABEL_PRIMARY)}
          items={subMenuItemsWithDynamicLabels}
          selectedId={selectedSubMenu}
          onSelect={handleSubMenuChange}
          relatedMenus={STUDENTS_RELATED_MENUS}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
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
          // width는 RightLayerMenuLayout에서 자동으로 모바일/태블릿/데스크톱에 맞게 계산
          children: selectedStudentLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              {terms.MESSAGES.LOADING}
            </div>
          ) : selectedStudent ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--height-full)' }}>
              {/* 탭 버튼: 기본정보 → 수업배정 → 상담내역 → 태그 → 출결 → 이탈위험 → 문자발송 */}
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'calc(var(--spacing-xl) - var(--spacing-lg))', flexWrap: 'wrap' }}>
                <Button
                  variant={layerMenuTab === 'info' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('info')}
                >
                  기본정보
                </Button>
                <Button
                  variant={layerMenuTab === 'classes' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('classes')}
                >
                  {terms.GROUP_LABEL}배정 ({(selectedStudentClasses ?? []).filter((sc) => sc.is_active).length})
                </Button>
                <Button
                  variant={layerMenuTab === 'consultations' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('consultations')}
                >
                  {terms.CONSULTATION_LABEL}내역 ({selectedStudentConsultations?.length || 0})
                </Button>
                <Button
                  variant={layerMenuTab === 'tags' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('tags')}
                >
                  {terms.TAG_LABEL}
                </Button>
                <Button
                  variant={layerMenuTab === 'attendance' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('attendance')}
                >
                  {terms.ATTENDANCE_LABEL}
                </Button>
                <Button
                  variant={layerMenuTab === 'risk' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('risk')}
                >
                  이탈위험
                </Button>
                <Button
                  variant={layerMenuTab === 'message' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('message')}
                >
                  문자발송
                </Button>
              </div>
              {/* 구분선 - CardGridLayout 상단 테두리와 수평 정렬 */}
              <div style={{ borderBottom: 'var(--border-width-thin) solid var(--color-text)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }} />
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
                        `정말 삭제하시겠습니까?\n(삭제된 ${terms.PERSON_LABEL_PRIMARY}${p.은는(terms.PERSON_LABEL_PRIMARY)} 목록에서 숨겨지며, 동일한 정보로 재등록 시 복원됩니다.)`,
                        `${terms.PERSON_LABEL_PRIMARY} ${terms.MESSAGES.DELETE_CONFIRM}`
                      );
                      if (!confirmed) return;
                      await deleteStudent.mutateAsync(selectedStudent.id);
                      toast(`${terms.PERSON_LABEL_PRIMARY}${p.이가(terms.PERSON_LABEL_PRIMARY)} 삭제되었습니다.`, 'success');
                      handleStudentSelect(null);
                    }}
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

        {/* 학생 목록 탭 ('list') - StudentListSubPage로 분리됨 */}
        {selectedSubMenu === 'list' && (
          <StudentListSubPage
            isLoading={isLoading}
            error={error}
            statsItems={statsItems}
            chartData={chartData}
            statsPeriod={statsPeriod}
            onStatsPeriodChange={setStatsPeriod}
            selectedStatsKey={selectedStatsKey}
            onStatsCardClick={setSelectedStatsKey}
            effectiveTableSchema={effectiveTableSchema}
            students={(students as unknown as Record<string, unknown>[]) || []}
            totalCount={totalCount}
            tablePage={tablePage}
            onTablePageChange={setTablePage}
            tableFilters={tableFilters}
            actionContext={actionContextMemo}
            onRowClick={handleRowClickMemo}
            effectiveFilterSchema={effectiveFilterSchema}
            onFilterChange={handleFilterChange}
            filterDefaultValues={{
              search: filter.search || '',
              status: filter.status || '',
              grade: filter.grade || '',
              class_id: filter.class_id || '',
            }}
            tags={tags}
            filter={filter}
            onTagFilter={handleTagFilter}
            isTagListExpanded={isTagListExpanded}
            showTagListToggle={showTagListToggle}
            tagListCollapsedHeight={tagListCollapsedHeight}
            tagListRef={tagListRef}
            onTagListExpandToggle={setIsTagListExpanded}
            onCreateClick={() => setShowCreateForm(true)}
            onUploadClick={() => fileInputRef.current?.click()}
            onDownload={handleDownload}
            onDownloadTemplate={handleDownloadTemplate}
            uploadDisabled={bulkCreateStudents.isPending}
            iconSize={iconSize}
            iconStrokeWidth={iconStrokeWidth}
            currentSubMenuLabel={currentSubMenuLabel}
            terms={terms}
          />
        )}

        {/* 태그 관리 탭 ('tags') - StudentTagsSubPage로 분리됨 */}
        {selectedSubMenu === 'tags' && (
          <StudentTagsSubPage
            statsPeriod={statsPeriod}
            onStatsPeriodChange={setStatsPeriod}
            currentSubMenuLabel={currentSubMenuLabel}
            terms={{
              TAG_LABEL: terms.TAG_LABEL,
              PERSON_LABEL_PRIMARY: terms.PERSON_LABEL_PRIMARY,
            }}
          />
        )}

        {/* 학생 통계 탭 ('statistics') - StudentStatsSubPage로 분리됨 */}
        {selectedSubMenu === 'statistics' && (
          <StudentStatsSubPage
            statsPeriod={statsPeriod}
            onStatsPeriodChange={setStatsPeriod}
            currentSubMenuLabel={currentSubMenuLabel}
            terms={terms}
            students={students}
            consultations={allConsultations}
            tags={tags ?? undefined}
            tagAssignments={tagAssignments}
            isLoading={isLoading || allConsultationsLoading}
          />
        )}

        {/* 상담관리 탭 ('consultations') - StudentConsultSubPage로 분리됨 */}
        {selectedSubMenu === 'consultations' && (
          <StudentConsultSubPage
            consultationStatsItems={consultationStatsItems}
            consultationChartData={consultationChartData}
            statsPeriod={statsPeriod}
            onStatsPeriodChange={setStatsPeriod}
            selectedConsultationStatsKey={selectedConsultationStatsKey}
            onConsultationStatsCardClick={setSelectedConsultationStatsKey}
            consultationTableSchema={consultationTableSchema}
            tableData={allConsultationsLoading ? [] : filteredConsultationsWithTableFilters.map((consultation) => {
              const student = students.find(s => s.id === consultation.student_id);
              const originalContent = consultation.content || '';
              const contentPreview = originalContent
                ? (() => {
                    const cleaned = originalContent.replace(/\n/g, ' ').trim();
                    return cleaned.length > 60 ? cleaned.substring(0, 60) + '...' : cleaned;
                  })()
                : '';
              return {
                ...consultation,
                student_name: student?.name || '알 수 없음',
                content: contentPreview,
                _content_full: originalContent,
              };
            }) as unknown as Record<string, unknown>[]}
            totalCount={filteredConsultationsWithTableFilters.length}
            isLoading={allConsultationsLoading}
            actionContext={actionContextMemo}
            onRowClick={(consultationId) => setSelectedConsultationId(consultationId)}
            consultationFilterSchema={consultationFilterSchema}
            consultationFilters={consultationFilters}
            onConsultationFilterChange={handleConsultationFilterChange}
            selectedConsultationId={selectedConsultationId}
            allConsultations={allConsultations}
            students={students.map(s => ({ id: s.id, name: s.name }))}
            onCloseModal={() => setSelectedConsultationId(null)}
            onDeleteConsultation={async (consultationId, studentId) => {
              await deleteConsultation.mutateAsync({ consultationId, studentId });
              toast(`${terms.CONSULTATION_LABEL_PLURAL}${p.이가(terms.CONSULTATION_LABEL_PLURAL)} 성공적으로 삭제되었습니다.`, 'success', `${terms.CONSULTATION_LABEL_PLURAL} 삭제 완료`);
              setSelectedConsultationId(null);
            }}
            onUpdateConsultation={async (consultationId, studentId, data) => {
              await updateConsultation.mutateAsync({ consultationId, studentId, consultation: data });
              toast(`${terms.CONSULTATION_LABEL_PLURAL}${p.이가(terms.CONSULTATION_LABEL_PLURAL)} 성공적으로 수정되었습니다.`, 'success', `${terms.CONSULTATION_LABEL_PLURAL} 수정 완료`);
            }}
            onGenerateAISummary={async (consultationId, studentId) => {
              await generateAISummary.mutateAsync({ consultationId, studentId });
              toast('AI 요약이 성공적으로 생성되었습니다.', 'success', 'AI 요약 생성 완료');
            }}
            updateConsultationPending={updateConsultation.isPending}
            deleteConsultationPending={deleteConsultation.isPending}
            generateAISummaryPending={generateAISummary.isPending}
            onDownload={() => {
              try {
                const personNameLabel = `${terms.PERSON_LABEL_PRIMARY}명`;
                const csvData = filteredConsultationsWithTableFilters.map((consultation) => {
                  const student = students.find(s => s.id === consultation.student_id);
                  return {
                    [personNameLabel]: student?.name || '알 수 없음',
                    '상담일': consultation.consultation_date,
                    '상담 구분': terms.CONSULTATION_TYPE_LABELS[consultation.consultation_type as keyof typeof terms.CONSULTATION_TYPE_LABELS] || consultation.consultation_type,
                    '내용': consultation.content || '',
                    '등록일시': consultation.created_at,
                  };
                });
                const headers = [personNameLabel, '상담일', '상담 구분', '내용', '등록일시'];
                const csvContent = [
                  headers.join(','),
                  ...csvData.map((row) =>
                    headers.map((header) => {
                      const value = String(row[header as keyof typeof row] || '');
                      return `"${value.replace(/"/g, '""')}"`;
                    }).join(',')
                  )
                ].join('\n');
                const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `상담목록_${toKST(new Date()).format('YYYY-MM-DD')}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast('상담 목록을 다운로드했습니다.', 'success', '다운로드 완료');
              } catch (error) {
                toast(error instanceof Error ? error.message : '다운로드 중 오류가 발생했습니다.', 'error', '다운로드 실패');
              }
            }}
            onDownloadTemplate={() => {
              try {
                const personNameLabel = `${terms.PERSON_LABEL_PRIMARY}명(필수)`;
                const headers = [personNameLabel, '상담일(필수,YYYY-MM-DD)', '상담구분(필수,counseling/learning/behavior/other)', '내용'];
                const csvContent = [
                  headers.join(','),
                  '"홍길동","2024-01-15","counseling","학습 진도 및 성적 관련 상담"',
                ].join('\n');
                const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `${terms.CONSULTATION_LABEL}등록_템플릿.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast(`${terms.CONSULTATION_LABEL} 등록 템플릿을 다운로드했습니다.`, 'success', '다운로드 완료');
              } catch (error) {
                toast(error instanceof Error ? error.message : '다운로드 중 오류가 발생했습니다.', 'error', '다운로드 실패');
              }
            }}
            onCreateClick={() => {
              toast(`${terms.CONSULTATION_LABEL} 등록 기능은 ${terms.PERSON_LABEL_PRIMARY} 상세에서 이용 가능합니다.`, 'info', '안내');
            }}
            onUploadClick={() => {
              toast(`${terms.CONSULTATION_LABEL} 일괄 등록 기능은 준비 중입니다.`, 'info', '안내');
            }}
            iconSize={iconSize}
            iconStrokeWidth={iconStrokeWidth}
            currentSubMenuLabel={currentSubMenuLabel}
            terms={{
              PERSON_LABEL_PRIMARY: terms.PERSON_LABEL_PRIMARY,
              CONSULTATION_LABEL: terms.CONSULTATION_LABEL,
              CONSULTATION_LABEL_PLURAL: terms.CONSULTATION_LABEL_PLURAL,
              CONSULTATION_TYPE_LABELS: terms.CONSULTATION_TYPE_LABELS,
            }}
            showConfirm={showConfirm}
          />
        )}

        {/* 수업배정 탭 ('class-assignment') - StudentClassAssignmentSubPage로 분리됨 */}
        {selectedSubMenu === 'class-assignment' && (
          <StudentClassAssignmentSubPage
            isLoading={isLoading || allStudentClassesLoading}
            error={error}
            statsItems={statsItems}
            chartData={chartData}
            statsPeriod={statsPeriod}
            onStatsPeriodChange={setStatsPeriod}
            selectedStatsKey={selectedStatsKey}
            onStatsCardClick={setSelectedStatsKey}
            effectiveTableSchema={effectiveTableSchema}
            students={(students as unknown as Record<string, unknown>[]) || []}
            totalCount={totalCount}
            tablePage={tablePage}
            onTablePageChange={setTablePage}
            tableFilters={tableFilters}
            actionContext={actionContextMemo}
            effectiveFilterSchema={effectiveFilterSchema}
            onFilterChange={handleFilterChange}
            filterDefaultValues={{
              search: filter.search || '',
              status: filter.status || '',
              grade: filter.grade || '',
              class_id: filter.class_id || '',
            }}
            allClasses={allClasses || []}
            studentClassAssignments={allStudentClasses}
            onAssignClass={async (studentId, classId) => {
              await assignStudentToClass.mutateAsync({ studentId, classId });
              toast(`${terms.GROUP_LABEL} 배정이 완료되었습니다.`, 'success', '배정 완료');
            }}
            onUnassignClass={async (studentId, classId) => {
              await unassignStudentFromClass.mutateAsync({ studentId, classId });
              toast(`${terms.GROUP_LABEL} 배정이 해제되었습니다.`, 'success', '해제 완료');
            }}
            assignPending={assignStudentToClass.isPending || unassignStudentFromClass.isPending}
            iconSize={iconSize}
            iconStrokeWidth={iconStrokeWidth}
            currentSubMenuLabel={currentSubMenuLabel}
            terms={{
              PERSON_LABEL_PRIMARY: terms.PERSON_LABEL_PRIMARY,
              GROUP_LABEL: terms.GROUP_LABEL,
              MESSAGES: terms.MESSAGES,
            }}
          />
        )}

      </Container>

      {/* [업종중립] PERSON 등록 폼 - 모달로 표시 (모든 탭에서 접근 가능하도록 Container 밖에 배치) */}
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
// ConsultationsTab은 별도 파일(./students/tabs/ConsultationsTab.tsx)로 분리됨
// TagsTab은 별도 파일(./students/tabs/TagsTab.tsx)로 분리됨
// ClassesTab은 별도 파일(./students/tabs/ClassesTab.tsx)로 분리됨
// AttendanceTab은 별도 파일(./students/tabs/AttendanceTab.tsx)로 분리됨
// RiskAnalysisTab은 별도 파일(./students/tabs/RiskAnalysisTab.tsx)로 분리됨
// MessageSendTab은 별도 파일(./students/tabs/MessageSendTab.tsx)로 분리됨

