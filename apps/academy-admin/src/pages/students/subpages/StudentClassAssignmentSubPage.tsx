/**
 * 수업배정 SubPage
 *
 * [LAYER: UI_PAGE - SubPage]
 *
 * StudentsPage의 '수업배정' 탭(class-assignment)을 담당하는 SubPage 컴포넌트
 * 학생 테이블 + 수업배정 열 (클릭 시 수업배정 모달)
 */

import React, { useState, useMemo } from 'react';
import { Card, Button, Modal, EmptyState, EntityCard, DataTable, Input, Select, useResponsiveMode, isMobile, isTablet, Badge } from '@ui-core/react';
import type { DataTableColumn } from '@ui-core/react';
import { GraduationCap, Check, LayoutGrid, List } from 'lucide-react';
import { StatsTableLayout } from '../../../components';
import type { StatsItem, ChartDataItem, PeriodFilter } from '../../../components/stats';
import type { TableSchema, FilterSchema, TableColumnSchema } from '@schema-engine';
import type { Class } from '@services/class-service';

/** 학생-수업 배정 정보 */
interface StudentClassInfo {
  student_id: string;
  class_ids: string[];
}

/** 요일 레이블 매핑 (컴포넌트 외부 - 재생성 방지) */
const DAY_LABELS: Record<string, string> = {
  monday: '월',
  tuesday: '화',
  wednesday: '수',
  thursday: '목',
  friday: '금',
  saturday: '토',
  sunday: '일',
};

/**
 * 요일 배열을 표시용 문자열로 변환
 * 단일 요일: "월요일"
 * 복수 요일: "월, 화, 수요일" (마지막만 '요일' 붙임)
 */
function formatDayOfWeek(dayOfWeek: string | string[] | null | undefined): string {
  if (!dayOfWeek) return '-';

  if (Array.isArray(dayOfWeek)) {
    if (dayOfWeek.length === 0) return '-';
    if (dayOfWeek.length === 1) {
      const label = DAY_LABELS[dayOfWeek[0]] || dayOfWeek[0];
      return `${label}요일`;
    }
    // 복수 요일: 마지막만 '요일' 붙임
    const abbreviated = dayOfWeek.slice(0, -1).map(d => DAY_LABELS[d] || d);
    const lastDay = DAY_LABELS[dayOfWeek[dayOfWeek.length - 1]] || dayOfWeek[dayOfWeek.length - 1];
    return [...abbreviated, `${lastDay}요일`].join(', ');
  }

  // 문자열인 경우 (레거시 호환)
  const label = DAY_LABELS[dayOfWeek] || dayOfWeek;
  return `${label}요일`;
}

export interface StudentClassAssignmentSubPageProps {
  // 로딩/에러 상태
  isLoading: boolean;
  error: Error | null;

  // 통계 데이터
  statsItems: StatsItem[];
  chartData: ChartDataItem[];
  statsPeriod: PeriodFilter;
  onStatsPeriodChange: (period: PeriodFilter) => void;
  selectedStatsKey: string;
  onStatsCardClick: (key: string) => void;

  // 테이블 데이터
  effectiveTableSchema?: TableSchema;
  students: Record<string, unknown>[];
  totalCount: number;
  tablePage: number;
  onTablePageChange: (page: number) => void;
  tableFilters: Record<string, unknown>;
  actionContext: { navigate: (path: string) => void };

  // 필터
  effectiveFilterSchema?: FilterSchema;
  onFilterChange: (filters: Record<string, unknown>) => void;
  filterDefaultValues: {
    search: string;
    status: string | string[];
    grade: string;
    class_id: string;
  };

  // 수업 배정 관련
  allClasses: Class[];
  studentClassAssignments: StudentClassInfo[];
  onAssignClass: (studentId: string, classId: string) => Promise<void>;
  onUnassignClass: (studentId: string, classId: string) => Promise<void>;
  assignPending: boolean;

  // UI 설정
  iconSize: number;
  iconStrokeWidth: number;
  currentSubMenuLabel: string;

  // 업종 중립 라벨
  terms: {
    PERSON_LABEL_PRIMARY: string;
    GROUP_LABEL: string;
    SUBJECT_LABEL?: string;
    CAPACITY_LABEL?: string;
    MESSAGES: {
      LOADING: string;
      ERROR: string;
      SAVE_ERROR: string;
      SAVE: string;
      CANCEL: string;
    };
  };
}

export function StudentClassAssignmentSubPage({
  isLoading,
  error,
  statsItems,
  chartData,
  statsPeriod,
  onStatsPeriodChange,
  selectedStatsKey,
  onStatsCardClick,
  effectiveTableSchema,
  students,
  totalCount,
  tablePage,
  onTablePageChange,
  tableFilters,
  actionContext,
  effectiveFilterSchema,
  onFilterChange,
  filterDefaultValues,
  allClasses,
  studentClassAssignments,
  onAssignClass,
  onUnassignClass,
  assignPending,
  iconSize,
  iconStrokeWidth,
  currentSubMenuLabel,
  terms,
}: StudentClassAssignmentSubPageProps) {
  // 반응형 모드 감지
  const mode = useResponsiveMode();
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);

  // 수업배정 모달 상태 (학생 선택 모드)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 학생배정 모달 상태 (수업 선택 모드)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [studentModalPage, setStudentModalPage] = useState(1);
  const STUDENTS_PER_PAGE = 10;

  // 시간대 필터 상태: 'all' | 'morning' | 'afternoon' | 'evening'
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');

  // 보기 모드 상태: 'card' | 'table'
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  // 버튼 hover 상태
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  // 선택된 학생 정보
  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return students.find((s) => (s as { id: string }).id === selectedStudentId);
  }, [selectedStudentId, students]);

  // 선택된 수업 정보
  const selectedClass = useMemo(() => {
    if (!selectedClassId) return null;
    return allClasses.find((c) => c.id === selectedClassId);
  }, [selectedClassId, allClasses]);

  // 활성 수업만 필터링 (시간대 필터 적용)
  const activeClasses = useMemo(() => {
    return allClasses.filter((c) => {
      if (c.status !== 'active') return false;

      // 시간대 필터링
      if (timeFilter === 'all' || !c.start_time) return true;
      const hour = parseInt(c.start_time.split(':')[0], 10);
      if (timeFilter === 'morning') return hour >= 0 && hour < 12;
      if (timeFilter === 'afternoon') return hour >= 12 && hour < 18;
      if (timeFilter === 'evening') return hour >= 18 && hour < 24;
      return true;
    });
  }, [allClasses, timeFilter]);

  // 활성 학생의 학년 목록 (중복 제거 및 정렬)
  const gradeOptions = useMemo(() => {
    const grades = new Set<string>();
    students.forEach((student) => {
      const s = student as { status?: string; grade?: string };
      if (s.status && s.status !== 'active') return;
      if (s.grade) grades.add(s.grade);
    });
    return [
      { value: 'all', label: '전체 학년' },
      ...Array.from(grades).sort().map((grade) => ({ value: grade, label: grade }))
    ];
  }, [students]);

  // 학생 검색 결과 (활성 학생만)
  const filteredStudents = useMemo(() => {
    const query = studentSearchQuery.toLowerCase().trim();
    return students.filter((student) => {
      const s = student as { name: string; status?: string; grade?: string };
      // 활성 학생만 표시
      if (s.status && s.status !== 'active') return false;
      // 학년 필터링
      if (gradeFilter !== 'all' && s.grade !== gradeFilter) return false;
      // 검색어 필터링
      if (!query) return true;
      return s.name.toLowerCase().includes(query) || (s.grade || '').toLowerCase().includes(query);
    });
  }, [students, studentSearchQuery, gradeFilter]);

  // 페이지네이션된 학생 목록
  const paginatedStudents = useMemo(() => {
    const startIndex = (studentModalPage - 1) * STUDENTS_PER_PAGE;
    return filteredStudents.slice(startIndex, startIndex + STUDENTS_PER_PAGE);
  }, [filteredStudents, studentModalPage]);

  // 전체 페이지 수
  const totalStudentPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);


  // 수업배정 열이 추가된 테이블 스키마 (상태 열을 마지막으로 이동)
  const tableSchemaWithAssignment: TableSchema | undefined = useMemo(() => {
    if (!effectiveTableSchema) return undefined;

    const assignmentColumn: TableColumnSchema = {
      key: 'class_assignment',
      label: `${terms.GROUP_LABEL}배정`,
      sortable: false,
      type: 'text',
    };

    // 상태 열을 분리하고 마지막에 배치
    const originalColumns = effectiveTableSchema.table.columns;
    const statusColumn = originalColumns.find(col => col.key === 'status');
    const columnsWithoutStatus = originalColumns.filter(col => col.key !== 'status');

    return {
      ...effectiveTableSchema,
      table: {
        ...effectiveTableSchema.table,
        columns: [
          ...columnsWithoutStatus,
          assignmentColumn,
          ...(statusColumn ? [statusColumn] : []),
        ],
      },
    };
  }, [effectiveTableSchema, terms.GROUP_LABEL]);

  // 학생별 배정된 수업 수 추가된 데이터
  const studentsWithAssignmentCount = useMemo(() => {
    return students.map((student) => {
      const studentId = (student as { id: string }).id;
      const assignment = studentClassAssignments.find((a) => a.student_id === studentId);
      const assignedCount = assignment?.class_ids.length || 0;

      return {
        ...student,
        class_assignment: assignedCount > 0 ? `${assignedCount}개` : '-',
        _assignedClassCount: assignedCount,
      };
    });
  }, [students, studentClassAssignments]);

  // 모달 열기
  const handleOpenModal = (studentId: string) => {
    const assignment = studentClassAssignments.find((a) => a.student_id === studentId);
    setSelectedStudentId(studentId);
    setSelectedClassIds(assignment?.class_ids || []);
  };

  // 모달 닫기
  const handleCloseModal = () => {
    setSelectedStudentId(null);
    setSelectedClassIds([]);
  };

  // 수업 토글
  const handleToggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  };

  // 저장
  const handleSave = async () => {
    if (!selectedStudentId) return;

    setIsSaving(true);
    try {
      const assignment = studentClassAssignments.find((a) => a.student_id === selectedStudentId);
      const currentClassIds = assignment?.class_ids || [];

      // 새로 추가할 수업
      const toAssign = selectedClassIds.filter((id) => !currentClassIds.includes(id));
      // 제거할 수업
      const toUnassign = currentClassIds.filter((id) => !selectedClassIds.includes(id));

      // 순차적으로 처리
      for (const classId of toAssign) {
        await onAssignClass(selectedStudentId, classId);
      }
      for (const classId of toUnassign) {
        await onUnassignClass(selectedStudentId, classId);
      }

      handleCloseModal();
    } finally {
      setIsSaving(false);
    }
  };

  // 행 클릭 핸들러 - 행 클릭 시 수업배정 모달 열기
  const handleRowClick = (row: Record<string, unknown>) => {
    const studentId = (row as { id: string }).id;
    handleOpenModal(studentId);
  };

  // 수업 카드 클릭 핸들러 - 학생배정 모달 열기
  const handleClassCardClick = (classId: string) => {
    const classAssignments = studentClassAssignments.filter((a) => a.class_ids.includes(classId));
    const assignedStudentIds = classAssignments.map((a) => a.student_id);

    setSelectedClassId(classId);
    setSelectedStudentIds(assignedStudentIds);
    setStudentSearchQuery('');
    setGradeFilter('all');
    setStudentModalPage(1);
  };

  // 학생배정 모달 닫기
  const handleCloseClassModal = () => {
    setSelectedClassId(null);
    setSelectedStudentIds([]);
    setStudentSearchQuery('');
    setGradeFilter('all');
    setStudentModalPage(1);
  };

  // 검색어 변경 핸들러 (페이지 리셋)
  const handleStudentSearchChange = (value: string) => {
    setStudentSearchQuery(value);
    setStudentModalPage(1);
  };

  // 학년 필터 변경 핸들러 (페이지 리셋)
  const handleGradeFilterChange = (value: string) => {
    setGradeFilter(value);
    setStudentModalPage(1);
  };

  // 학생 토글 (배정/해제)
  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  // 학생 배정 저장
  const handleSaveStudents = async () => {
    if (!selectedClassId) return;

    setIsSaving(true);
    try {
      // 현재 배정된 학생 ID 목록
      const currentAssignments = studentClassAssignments.filter((a) => a.class_ids.includes(selectedClassId));
      const currentStudentIds = currentAssignments.map((a) => a.student_id);

      // 새로 배정할 학생
      const toAssign = selectedStudentIds.filter((id) => !currentStudentIds.includes(id));
      // 배정 해제할 학생
      const toUnassign = currentStudentIds.filter((id) => !selectedStudentIds.includes(id));

      // 순차적으로 처리
      for (const studentId of toAssign) {
        await onAssignClass(studentId, selectedClassId);
      }
      for (const studentId of toUnassign) {
        await onUnassignClass(studentId, selectedClassId);
      }

      handleCloseClassModal();
    } finally {
      setIsSaving(false);
    }
  };

  // 배지 색상 매핑
  const getBadgeColor = (subject?: string): 'primary' | 'success' | 'warning' | 'error' | 'secondary' => {
    const subjectLower = (subject || '').toLowerCase();
    if (subjectLower.includes('국어') || subjectLower.includes('korean')) return 'primary';
    if (subjectLower.includes('수학') || subjectLower.includes('math')) return 'error';
    if (subjectLower.includes('과학') || subjectLower.includes('science')) return 'success';
    if (subjectLower.includes('영어') || subjectLower.includes('english')) return 'warning';
    return 'secondary';
  };

  // 수업별 학생 수 계산
  const classStudentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    studentClassAssignments.forEach((assignment) => {
      assignment.class_ids.forEach((classId) => {
        counts[classId] = (counts[classId] || 0) + 1;
      });
    });
    return counts;
  }, [studentClassAssignments]);

  return (
    <>
      {/* 로딩 상태 */}
      {isLoading && (
        <Card padding="lg" variant="default">
          <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            {terms.PERSON_LABEL_PRIMARY} 목록 {terms.MESSAGES.LOADING}
          </div>
        </Card>
      )}

      {/* 에러 상태 */}
      {!isLoading && error && (
        <Card padding="md" variant="outlined">
          <div style={{ color: 'var(--color-error)' }}>
            {terms.MESSAGES.ERROR}: {error instanceof Error ? error.message : terms.MESSAGES.SAVE_ERROR}
          </div>
        </Card>
      )}

      {/* 수업배정 테이블 */}
      {!isLoading && !error && tableSchemaWithAssignment && (
        <StatsTableLayout
          title={currentSubMenuLabel}
          entityName={`${terms.GROUP_LABEL}배정`}
          statsItems={statsItems}
          chartData={chartData}
          period={statsPeriod}
          onPeriodChange={onStatsPeriodChange}
          selectedStatsKey={selectedStatsKey}
          onStatsCardClick={onStatsCardClick}
          chartTooltipUnit="명"
          chartTooltipLabel={`총 ${terms.PERSON_LABEL_PRIMARY}수`}
          tableSchema={tableSchemaWithAssignment}
          tableData={studentsWithAssignmentCount}
          totalCount={totalCount}
          page={tablePage}
          onPageChange={onTablePageChange}
          filters={tableFilters}
          actionContext={actionContext}
          onRowClick={handleRowClick}
          filterSchema={effectiveFilterSchema}
          onFilterChange={onFilterChange}
          filterDefaultValues={filterDefaultValues}
          iconSize={iconSize}
          iconStrokeWidth={iconStrokeWidth}
          sectionOrderKey="students-section-order-class-assignment"
          showTitle={true}
          hideStats={true}
          beforeTable={
            <div style={{ marginBottom: 'calc(var(--spacing-xl) * 2)' }}>
              {/* 시간대 필터 + 보기 모드 전환 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 'var(--spacing-md)', gap: 'var(--spacing-md)' }}>
                {/* 시간대 필터 버튼 */}
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                  {[
                    { value: 'all', label: '전체' },
                    { value: 'morning', label: '오전' },
                    { value: 'afternoon', label: '오후' },
                    { value: 'evening', label: '저녁' },
                  ].map((option) => {
                    const isActive = timeFilter === option.value;
                    const isHovered = hoveredButton === `time-${option.value}`;

                    // StatsDashboard 패턴: hover 시 배경색 계산
                    const getBackgroundColor = () => {
                      if (isActive) {
                        return isHovered ? 'var(--color-primary-dark)' : 'var(--color-primary)';
                      }
                      return isHovered ? 'var(--color-primary-hover)' : 'var(--color-white)';
                    };

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTimeFilter(option.value as 'all' | 'morning' | 'afternoon' | 'evening')}
                        onMouseEnter={() => setHoveredButton(`time-${option.value}`)}
                        onMouseLeave={() => setHoveredButton(null)}
                        style={{
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 'var(--font-weight-medium)',
                          border: isActive ? 'none' : 'var(--border-width-thin) solid var(--color-gray-200)',
                          borderRadius: 'var(--border-radius-xs)',
                          backgroundColor: getBackgroundColor(),
                          color: isActive ? 'var(--color-white)' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          transition: 'var(--transition-all)',
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {/* 보기 모드 전환 아이콘 (정사각형 버튼) */}
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'stretch' }}>
                  {/* 카드형 버튼 */}
                  {(() => {
                    const isActive = viewMode === 'card';
                    const isHovered = hoveredButton === 'view-card';

                    // StatsDashboard 패턴: hover 시 배경색 계산
                    const getBackgroundColor = () => {
                      if (isActive) {
                        return isHovered ? 'var(--color-primary-dark)' : 'var(--color-primary)';
                      }
                      return isHovered ? 'var(--color-primary-hover)' : 'var(--color-white)';
                    };

                    const buttonElement = (
                      <button
                        type="button"
                        onClick={() => setViewMode('card')}
                        onMouseEnter={() => setHoveredButton('view-card')}
                        onMouseLeave={() => setHoveredButton(null)}
                        style={{
                          width: 'calc(var(--font-size-sm) * var(--line-height) + var(--spacing-xs) * 2)',
                          height: 'calc(var(--font-size-sm) * var(--line-height) + var(--spacing-xs) * 2)',
                          padding: 0,
                          border: isActive ? 'none' : 'var(--border-width-thin) solid var(--color-gray-200)',
                          borderRadius: 'var(--border-radius-xs)',
                          backgroundColor: getBackgroundColor(),
                          color: isActive ? 'var(--color-white)' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'var(--transition-all)',
                          flexShrink: 0,
                        }}
                      >
                        <LayoutGrid size={iconSize} strokeWidth={iconStrokeWidth} />
                      </button>
                    );

                    // 선택된 경우 고정 툴팁 표시
                    if (isActive) {
                      return (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          {/* 고정 툴팁 */}
                          <div style={{
                            position: 'absolute',
                            bottom: 'calc(100% + var(--spacing-tooltip-offset))',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                            backgroundColor: 'var(--color-primary)',
                            color: 'var(--color-white)',
                            fontSize: 'var(--font-size-xs)',
                            borderRadius: 'var(--border-radius-xs)',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                            zIndex: 1000,
                          }}>
                            카드형
                            {/* 화살표 */}
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 0,
                              height: 0,
                              borderLeft: 'var(--spacing-xs) solid transparent',
                              borderRight: 'var(--spacing-xs) solid transparent',
                              borderTop: 'var(--spacing-xs) solid var(--color-primary)',
                            }} />
                          </div>
                          {buttonElement}
                        </div>
                      );
                    }

                    return <div style={{ display: 'inline-block' }}>{buttonElement}</div>;
                  })()}

                  {/* 테이블형 버튼 */}
                  {(() => {
                    const isActive = viewMode === 'table';
                    const isHovered = hoveredButton === 'view-table';

                    // StatsDashboard 패턴: hover 시 배경색 계산
                    const getBackgroundColor = () => {
                      if (isActive) {
                        return isHovered ? 'var(--color-primary-dark)' : 'var(--color-primary)';
                      }
                      return isHovered ? 'var(--color-primary-hover)' : 'var(--color-white)';
                    };

                    const buttonElement = (
                      <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        onMouseEnter={() => setHoveredButton('view-table')}
                        onMouseLeave={() => setHoveredButton(null)}
                        style={{
                          width: 'calc(var(--font-size-sm) * var(--line-height) + var(--spacing-xs) * 2)',
                          height: 'calc(var(--font-size-sm) * var(--line-height) + var(--spacing-xs) * 2)',
                          padding: 0,
                          border: isActive ? 'none' : 'var(--border-width-thin) solid var(--color-gray-200)',
                          borderRadius: 'var(--border-radius-xs)',
                          backgroundColor: getBackgroundColor(),
                          color: isActive ? 'var(--color-white)' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'var(--transition-all)',
                          flexShrink: 0,
                        }}
                      >
                        <List size={iconSize} strokeWidth={iconStrokeWidth} />
                      </button>
                    );

                    // 선택된 경우 고정 툴팁 표시
                    if (isActive) {
                      return (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          {/* 고정 툴팁 */}
                          <div style={{
                            position: 'absolute',
                            bottom: 'calc(100% + var(--spacing-tooltip-offset))',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                            backgroundColor: 'var(--color-primary)',
                            color: 'var(--color-white)',
                            fontSize: 'var(--font-size-xs)',
                            borderRadius: 'var(--border-radius-xs)',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                            zIndex: 1000,
                          }}>
                            테이블형
                            {/* 화살표 */}
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 0,
                              height: 0,
                              borderLeft: 'var(--spacing-xs) solid transparent',
                              borderRight: 'var(--spacing-xs) solid transparent',
                              borderTop: 'var(--spacing-xs) solid var(--color-primary)',
                            }} />
                          </div>
                          {buttonElement}
                        </div>
                      );
                    }

                    return <div style={{ display: 'inline-block' }}>{buttonElement}</div>;
                  })()}
                </div>
              </div>

              {/* 수업 목록 (카드형 / 테이블형) */}
              {activeClasses.length > 0 ? (
                viewMode === 'card' ? (
                  // 카드형 보기 (반응형 그리드: 모바일 1열, 태블릿 2열, 데스크톱 3열)
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobileMode ? '1fr' : isTabletMode ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                      gap: 'var(--spacing-md)',
                    }}
                  >
                    {activeClasses.map((classItem) => {
                      const studentCount = classStudentCounts[classItem.id] || 0;
                      // 요일을 배열로 전달하여 개별 원형 배지로 표시
                      const dayOfWeekArray = Array.isArray(classItem.day_of_week)
                        ? classItem.day_of_week
                        : classItem.day_of_week
                          ? [classItem.day_of_week]
                          : [];

                      return (
                        <EntityCard
                          key={classItem.id}
                          badge={{
                            label: classItem.subject || terms.GROUP_LABEL,
                            color: getBadgeColor(classItem.subject),
                          }}
                          secondaryLabel="-"
                          title={classItem.name}
                          mainValue={studentCount}
                          subValue={` / ${classItem.capacity}`}
                          dayOfWeek={dayOfWeekArray.length > 0 ? dayOfWeekArray : undefined}
                          description={`${classItem.start_time?.slice(0, 5)}~${classItem.end_time?.slice(0, 5)}`}
                          onClick={() => handleClassCardClick(classItem.id)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  // 테이블형 보기 (수업관리 테이블과 동일한 형식)
                  <DataTable
                    data={activeClasses.map((classItem) => ({
                      ...classItem,
                      studentCount: classStudentCounts[classItem.id] || 0,
                    }))}
                    onRowClick={(row) => handleClassCardClick((row as Class).id)}
                    columns={[
                      {
                        key: 'subject',
                        label: terms.SUBJECT_LABEL || '과목',
                        width: '12%',
                        render: (_, row) => (
                          <span>{(row as Class).subject || '-'}</span>
                        ),
                      },
                      {
                        key: 'name',
                        label: `${terms.GROUP_LABEL}명`,
                        width: '18%',
                        render: (_, row) => (
                          <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{(row as Class).name}</span>
                        ),
                      },
                      {
                        key: 'schedule',
                        label: '일정',
                        width: '18%',
                        render: (_, row) => {
                          const classItem = row as Class;
                          const dayOfWeek = classItem.day_of_week;
                          let dayLabelsStr: string;
                          if (Array.isArray(dayOfWeek) && dayOfWeek.length > 0) {
                            if (dayOfWeek.length === 1) {
                              // 단일 요일: 전체 표기 (예: 월요일)
                              dayLabelsStr = DAY_LABELS[dayOfWeek[0]] ? `${DAY_LABELS[dayOfWeek[0]]}요일` : dayOfWeek[0];
                            } else {
                              // 멀티 요일: 마지막만 전체 표기, 나머지는 첫 글자만 (예: 월, 화, 수, 목, 금요일)
                              const abbreviated = dayOfWeek.slice(0, -1).map(d => DAY_LABELS[d] || d);
                              const lastDay = DAY_LABELS[dayOfWeek[dayOfWeek.length - 1]] || dayOfWeek[dayOfWeek.length - 1];
                              dayLabelsStr = [...abbreviated, `${lastDay}요일`].join(', ');
                            }
                          } else if (dayOfWeek) {
                            dayLabelsStr = DAY_LABELS[dayOfWeek as string] ? `${DAY_LABELS[dayOfWeek as string]}요일` : String(dayOfWeek);
                          } else {
                            dayLabelsStr = '-';
                          }
                          return <span>{dayLabelsStr}</span>;
                        },
                      },
                      {
                        key: 'time',
                        label: '수업시간',
                        width: '15%',
                        render: (_, row) => {
                          const classItem = row as Class;
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
                        label: terms.CAPACITY_LABEL || '정원',
                        width: '12%',
                        align: 'center',
                        render: (_, row) => {
                          const classItem = row as Class & { studentCount: number };
                          return (
                            <span>
                              {classItem.capacity ? `${classItem.studentCount || 0}/${classItem.capacity}명` : '-'}
                            </span>
                          );
                        },
                      },
                      {
                        key: 'teacher',
                        label: '담당',
                        width: '12%',
                        render: (_, row) => {
                          const teacherNames = (row as unknown as { teachers?: Array<{ name: string }> }).teachers;
                          if (teacherNames && teacherNames.length > 0) {
                            return <span>{teacherNames.map(t => t.name).join(', ')}</span>;
                          }
                          return <span style={{ color: 'var(--color-text-tertiary)' }}>-</span>;
                        },
                      },
                      {
                        key: 'status',
                        label: '상태',
                        width: '10%',
                        align: 'center',
                        render: (_, row) => {
                          const isActive = (row as Class).status === 'active';
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
                    ] as DataTableColumn<Class & { studentCount: number }>[]}
                    keyExtractor={(row) => (row as Class).id}
                    hideFilterControls
                    stickyHeader={false}
                  />
                )
              ) : (
                <Card
                  padding="md"
                  variant="outlined"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '300px',
                  }}
                >
                  <EmptyState
                    icon={GraduationCap}
                    message={timeFilter === 'all' ? `등록된 ${terms.GROUP_LABEL}이 없습니다.` : `해당 시간대의 ${terms.GROUP_LABEL}이 없습니다.`}
                  />
                </Card>
              )}
            </div>
          }
        />
      )}

      {/* 수업배정 모달 */}
      <Modal
        isOpen={selectedStudentId !== null}
        onClose={handleCloseModal}
        title={`${terms.GROUP_LABEL}배정`}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={handleCloseModal}
              disabled={isSaving || assignPending}
              style={{ flex: 1 }}
            >
              {terms.MESSAGES.CANCEL}
            </Button>
            <Button
              variant="solid"
              color="primary"
              onClick={handleSave}
              disabled={isSaving || assignPending}
              style={{ flex: 1 }}
            >
              {terms.MESSAGES.SAVE}
            </Button>
          </>
        }
      >
        {selectedStudent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {/* 학생 정보 */}
            <div
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-primary-50)',
                borderRadius: 'var(--border-radius-xs)',
              }}
            >
              <span style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)', fontSize: 'var(--font-size-base)' }}>
                {(selectedStudent as { name: string }).name} {terms.PERSON_LABEL_PRIMARY}에게 {terms.GROUP_LABEL}을 배정합니다.
              </span>
            </div>

            {/* 수업 목록 - 테이블 리스트형 */}
            {activeClasses.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  border: 'var(--border-width-thin) solid var(--color-gray-200)',
                  borderRadius: 'var(--border-radius-xs)',
                  overflow: 'hidden',
                }}
              >
                {activeClasses.map((classItem, index) => {
                  const isSelected = selectedClassIds.includes(classItem.id);
                  const dayLabel = formatDayOfWeek(classItem.day_of_week);
                  const studentCount = classStudentCounts[classItem.id] || 0;
                  const isLastItem = index === activeClasses.length - 1;

                  return (
                    <button
                      key={classItem.id}
                      type="button"
                      onClick={() => handleToggleClass(classItem.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-md)',
                        padding: 'var(--spacing-md)',
                        border: 'none',
                        borderBottom: isLastItem ? 'none' : 'var(--border-width-thin) solid var(--color-gray-200)',
                        backgroundColor: isSelected ? 'var(--color-primary-40)' : 'var(--color-white)',
                        cursor: 'pointer',
                        transition: 'background-color var(--transition-fast)',
                        textAlign: 'left',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'var(--color-primary-40)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'var(--color-white)';
                        }
                      }}
                    >
                      {/* 체크박스 */}
                      <div
                        style={{
                          width: 'var(--size-icon-base)',
                          height: 'var(--size-icon-base)',
                          borderRadius: 'var(--border-radius-xs)',
                          border: `var(--border-width-thin) solid ${isSelected ? 'var(--color-primary)' : 'var(--color-gray-200)'}`,
                          backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isSelected && (
                          <Check size={12} color="var(--color-white)" strokeWidth={3} />
                        )}
                      </div>

                      {/* 과목 */}
                      <div style={{ flex: '0 0 80px' }}>
                        <span
                          style={{
                            fontSize: 'var(--font-size-base)',
                            fontWeight: 'var(--font-weight-semibold)',
                            color: 'var(--color-text)',
                          }}
                        >
                          {classItem.subject || terms.GROUP_LABEL}
                        </span>
                      </div>

                      {/* 수업명 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: 'var(--font-size-base)',
                            color: 'var(--color-text)',
                          }}
                        >
                          {classItem.name}
                        </span>
                      </div>

                      {/* 인원 */}
                      <div style={{ flex: '0 0 80px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: 'var(--font-size-base)',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          {studentCount}/{classItem.capacity}
                        </span>
                      </div>

                      {/* 시간 */}
                      <div style={{ flex: '0 0 140px', textAlign: 'right' }}>
                        <span
                          style={{
                            fontSize: 'var(--font-size-base)',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          {dayLabel} {classItem.start_time?.slice(0, 5)}~{classItem.end_time?.slice(0, 5)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={GraduationCap}
                message={`배정 가능한 ${terms.GROUP_LABEL}${terms.GROUP_LABEL.endsWith('업') ? '이' : '가'} 없습니다.`}
              />
            )}
          </div>
        )}
      </Modal>

      {/* 학생배정 모달 (수업 선택 모드) */}
      <Modal
        isOpen={selectedClassId !== null}
        onClose={handleCloseClassModal}
        title={`${terms.PERSON_LABEL_PRIMARY}배정`}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={handleCloseClassModal}
              disabled={isSaving || assignPending}
              style={{ flex: 1 }}
            >
              {terms.MESSAGES.CANCEL}
            </Button>
            <Button
              variant="solid"
              color="primary"
              onClick={handleSaveStudents}
              disabled={isSaving || assignPending}
              style={{ flex: 1 }}
            >
              {terms.MESSAGES.SAVE}
            </Button>
          </>
        }
      >
        {selectedClass && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {/* 수업 정보 */}
            <div
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-primary-50)',
                borderRadius: 'var(--border-radius-xs)',
              }}
            >
              <span style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)', fontSize: 'var(--font-size-base)' }}>
                {selectedClass.name} {terms.GROUP_LABEL}에 {terms.PERSON_LABEL_PRIMARY}을 배정합니다.
              </span>
            </div>

            {/* 학생 검색 + 학년 필터 */}
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <div style={{ flex: 1 }}>
                <Input
                  type="text"
                  placeholder={`${terms.PERSON_LABEL_PRIMARY} 이름 검색`}
                  value={studentSearchQuery}
                  onChange={(e) => handleStudentSearchChange(e.target.value)}
                  fullWidth
                />
              </div>
              <div style={{ minWidth: '140px' }}>
                <Select
                  label=""
                  size="md"
                  value={gradeFilter}
                  onChange={(value) => handleGradeFilterChange(value as string)}
                  options={gradeOptions}
                  fullWidth
                />
              </div>
            </div>

            {/* 검색 결과 카운트 */}
            <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
              총 {filteredStudents.length}명 {selectedStudentIds.length > 0 && `(${selectedStudentIds.length}명 선택됨)`}
            </div>

            {/* 학생 목록 - 테이블 리스트형 */}
            {paginatedStudents.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  border: 'var(--border-width-thin) solid var(--color-gray-200)',
                  borderRadius: 'var(--border-radius-xs)',
                  overflow: 'hidden',
                }}
              >
                {paginatedStudents.map((student, index) => {
                  const studentData = student as { id: string; name: string; grade?: string; phone?: string; birth_date?: string };
                  const isSelected = selectedStudentIds.includes(studentData.id);
                  const isLastItem = index === paginatedStudents.length - 1;

                  return (
                    <button
                      key={studentData.id}
                      type="button"
                      onClick={() => handleToggleStudent(studentData.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-md)',
                        padding: 'var(--spacing-md)',
                        border: 'none',
                        borderBottom: isLastItem ? 'none' : 'var(--border-width-thin) solid var(--color-gray-200)',
                        backgroundColor: isSelected ? 'var(--color-primary-40)' : 'var(--color-white)',
                        cursor: 'pointer',
                        transition: 'background-color var(--transition-fast)',
                        textAlign: 'left',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'var(--color-primary-40)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'var(--color-white)';
                        }
                      }}
                    >
                      {/* 체크박스 */}
                      <div
                        style={{
                          width: 'var(--size-icon-base)',
                          height: 'var(--size-icon-base)',
                          borderRadius: 'var(--border-radius-xs)',
                          border: `var(--border-width-thin) solid ${isSelected ? 'var(--color-primary)' : 'var(--color-gray-200)'}`,
                          backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isSelected && (
                          <Check size={12} color="var(--color-white)" strokeWidth={3} />
                        )}
                      </div>

                      {/* 학생 정보 */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                        {/* 이름 */}
                        <span
                          style={{
                            fontSize: 'var(--font-size-base)',
                            fontWeight: 'var(--font-weight-semibold)',
                            color: 'var(--color-text)',
                          }}
                        >
                          {studentData.name}
                        </span>

                        {/* 학년 */}
                        {studentData.grade && (
                          <span
                            style={{
                              fontSize: 'var(--font-size-base)',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            {studentData.grade}
                          </span>
                        )}

                        {/* 전화번호 */}
                        {studentData.phone && (
                          <span
                            style={{
                              fontSize: 'var(--font-size-base)',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            {studentData.phone}
                          </span>
                        )}

                        {/* 생년월일 */}
                        {studentData.birth_date && (
                          <span
                            style={{
                              fontSize: 'var(--font-size-base)',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            {studentData.birth_date}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={GraduationCap}
                message={studentSearchQuery || gradeFilter !== 'all' ? '검색 결과가 없습니다.' : `배정 가능한 ${terms.PERSON_LABEL_PRIMARY}${terms.PERSON_LABEL_PRIMARY.endsWith('생') ? '이' : '가'} 없습니다.`}
              />
            )}

            {/* 페이지네이션 */}
            {totalStudentPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStudentModalPage((prev) => Math.max(1, prev - 1))}
                  disabled={studentModalPage === 1}
                >
                  이전
                </Button>
                <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                  {studentModalPage} / {totalStudentPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStudentModalPage((prev) => Math.min(totalStudentPages, prev + 1))}
                  disabled={studentModalPage === totalStudentPages}
                >
                  다음
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
