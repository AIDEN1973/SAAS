/**
 * 학생 관리 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { ErrorBoundary, useModal, useResponsiveMode, IconButtonGroup, useIconSize, useIconStrokeWidth } from '@ui-core/react';
import { DataTableActionButtons, PlusIcon } from '../components/DataTableActionButtons';
import { MessageSquare, FileText, User, Users, BookOpen, Calendar, AlertTriangle, Tag as TagIcon, ChevronDown, ChevronUp, Trash2, Pencil, X as XIcon, Save } from 'lucide-react';
import { BadgeSelect } from '../components/BadgeSelect';
import { Container, Card, Button, Input, Drawer, PageHeader, RightLayerMenuLayout, Badge, ActionButtonGroup } from '@ui-core/react';
import { SchemaForm, SchemaFormWithMethods, SchemaFilter, SchemaTable } from '@schema-engine';
import type { UseFormReturn } from 'react-hook-form';
import { registerWidget } from '@schema-engine';
import { useStudentsPaged, useStudentTags, useStudentTagsByStudent, useCreateStudent, useBulkCreateStudents, useStudent, useGuardians, useConsultations, useStudentClasses, useUpdateStudent, useDeleteStudent, useCreateGuardian, useUpdateGuardian, useDeleteGuardian, useCreateConsultation, useUpdateConsultation, useDeleteConsultation, useGenerateConsultationAISummary, useUpdateStudentTags, useAssignStudentToClass, useUnassignStudentFromClass } from '@hooks/use-student';
import { useClasses } from '@hooks/use-class';
import { useAttendanceLogs } from '@hooks/use-attendance';
import { useSession, useUserRole } from '@hooks/use-auth';
import { toKST } from '@lib/date-utils';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useSchema } from '@hooks/use-schema';
import type { StudentFilter, StudentStatus, Student, CreateStudentInput, Gender, ConsultationType, Guardian, StudentConsultation } from '@services/student-service';
import type { AttendanceLog } from '@services/attendance-service';
import type { Class } from '@services/class-service';
import type { StudentTaskCard } from '@hooks/use-student';
import type { Tag } from '@core/tags';
import type { FormSchema } from '@schema-engine/types';
import { studentFormSchema } from '../schemas/student.schema';
import { guardianFormSchema } from '../schemas/guardian.schema';
import { consultationFormSchema } from '../schemas/consultation.schema';
import { classAssignmentFormSchema } from '../schemas/class-assignment.schema';
import { tagFormSchema } from '../schemas/tag.schema';
import { createStudentFilterSchema } from '../schemas/student.filter.schema';
import { studentTableSchema } from '../schemas/student.table.schema';
// xlsx 동적 import로 로드 (필요한 경우만)

// [코드 중복 제거] 태그 입력값 처리 함수를 공통 유틸로 분리
// 태그 입력값 실시간 처리: 띄어쓰기 제거 (쉼표 다음 띄어쓰기는 허용)
const processTagInput = (inputValue: string): string => {
  const parts = inputValue.split(',');

  return parts.map((part, index) => {
    if (index === 0) {
      // 첫 번째 부분: 모든 띄어쓰기 제거
      return part.replace(/\s+/g, '');
    } else {
      // 쉼표 다음 부분: 앞의 띄어쓰기 하나만 허용, 나머지 제거
      const trimmed = part.trimStart();
      const withoutSpaces = trimmed.replace(/\s+/g, '');
      return part.startsWith(' ') ? ' ' + withoutSpaces : withoutSpaces;
    }
  }).join(',');
};

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
  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
registerWidget('TagNameInput', () => Promise.resolve(TagNameInputWidget));

export function StudentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const { showAlert, showConfirm } = useModal();
  const iconSize = useIconSize();
  const iconStrokeWidth = useIconStrokeWidth();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const [filter, setFilter] = useState<StudentFilter>({});
  const [isTagListExpanded, setIsTagListExpanded] = useState(false);
  const [showTagListToggle, setShowTagListToggle] = useState(false);
  const [tagListCollapsedHeight, setTagListCollapsedHeight] = useState<number | null>(null);
  const tagListRef = useRef<HTMLDivElement | null>(null);

  // [불변 규칙] 모든 환경에서 테이블 구조 유지 (모바일: 1열 세로 배치)
  // DataTable 컴포넌트가 모바일에서 자동으로 1열 세로 배치로 렌더링
  const [showCreateForm, setShowCreateForm] = useState(false);
  // const [showAdvancedOptions, setShowAdvancedOptions] = useState(false); // (미사용) 고급 옵션 UI 도입 시 사용

  // URL에서 학생 ID와 탭 정보 읽기
  const urlStudentId = params.id || searchParams.get('student') || null;
  const urlTab = searchParams.get('tab') as 'info' | 'guardians' | 'consultations' | 'tags' | 'classes' | 'attendance' | 'risk' | 'welcome' | null;

  // URL 경로에 따라 초기 탭 설정 (StudentDetailPage와 동일한 로직)
  const getInitialTab = React.useCallback((): 'info' | 'guardians' | 'consultations' | 'tags' | 'classes' | 'attendance' | 'risk' | 'welcome' => {
    const path = location.pathname;
    if (path.includes('/attendance')) return 'attendance';
    if (path.includes('/risk')) return 'risk';
    if (path.includes('/welcome')) return 'welcome';
    if (path.includes('/guardians')) return 'guardians';
    if (path.includes('/consultations')) return 'consultations';
    if (path.includes('/tags')) return 'tags';
    if (path.includes('/classes')) return 'classes';
    return urlTab || 'info';
  }, [location.pathname, urlTab]);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(urlStudentId); // 레이어 메뉴에 표시할 학생 ID

  // [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
  // SchemaFilter에서 검색 필드 디바운싱이 자동으로 적용됨
  // 서버 페이지네이션 (5천명+에서도 정확/고속)
  const [tablePage, setTablePage] = React.useState(1);
  const tablePageSize = 10; // student.table.schema의 기본 페이지 사이즈와 일치 (SchemaTable 기본값)
  const { data: studentsPaged, isLoading, error } = useStudentsPaged({
    filter: {
      ...filter,
      search: filter.search?.trim() || undefined, // 빈 문자열이면 undefined로 변환
    },
    page: tablePage,
    pageSize: tablePageSize,
  });
  const students = React.useMemo(() => studentsPaged?.students ?? [], [studentsPaged]);
  const totalCount = React.useMemo(() => studentsPaged?.totalCount ?? 0, [studentsPaged]);

  // SchemaTable의 "filters 변경 시 1페이지 리셋" 로직은 referential equality(객체 참조)에 의존하므로,
  // 매 렌더마다 새 객체를 만들면 페이지가 항상 1로 리셋되어 페이지 전환이 불가능해진다.
  // 따라서 filters 객체를 useMemo로 안정화한다.
  const tableFilters = React.useMemo(() => {
    return {
      ...(filter.status && { status: filter.status }),
      ...(filter.grade && { grade: filter.grade }),
      ...(filter.search && { search: filter.search }),
    } as Record<string, unknown>;
  }, [filter.grade, filter.search, filter.status]);

  // [디버깅] 필터 동작 검증 로그 (개발 환경에서만)
  React.useEffect(() => {
    if (!import.meta.env?.DEV) return;
    console.groupCollapsed('🔎 [StudentsPage] 필터 변경');
    console.log('filter:', filter);
    console.log('page:', tablePage);
    console.log('pageSize:', tablePageSize);
    console.log('resultCount(page):', Array.isArray(students) ? students.length : 0);
    console.log('totalCount:', totalCount);
    console.log('isLoading:', isLoading);
    console.log('error:', error);
    console.groupEnd();
  }, [filter, students, isLoading, error, tablePage, tablePageSize, totalCount]);

  const { data: tags } = useStudentTags();
  const { data: classes } = useClasses({ status: 'active' });
  const createStudent = useCreateStudent();
  const bulkCreateStudents = useBulkCreateStudents();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Schema Registry 연동 (아키텍처 문서 S3 참조)
  const { data: studentFormSchemaData } = useSchema('student', studentFormSchema, 'form');
  const { data: studentFilterSchemaData } = useSchema('student_filter', createStudentFilterSchema(classes || []), 'filter');
  const { data: studentTableSchemaData } = useSchema('student_table', studentTableSchema, 'table');
  const { data: guardianFormSchemaData } = useSchema('guardian', guardianFormSchema, 'form');
  const { data: consultationFormSchemaData } = useSchema('consultation', consultationFormSchema, 'form');
  const { data: classAssignmentFormSchemaData } = useSchema('class_assignment', classAssignmentFormSchema, 'form');

  // Fallback: Registry에서 조회 실패 시 로컬 스키마 사용
  const effectiveFormSchema = studentFormSchemaData || studentFormSchema;
  const effectiveFilterSchema = studentFilterSchemaData || createStudentFilterSchema(classes || []);
  const effectiveTableSchema = studentTableSchemaData || studentTableSchema;
  const effectiveGuardianFormSchema = guardianFormSchemaData || guardianFormSchema;
  const effectiveConsultationFormSchema = consultationFormSchemaData || consultationFormSchema;
  const effectiveClassAssignmentFormSchema = classAssignmentFormSchemaData || classAssignmentFormSchema;

  // 선택된 학생 데이터 및 관련 데이터 로드
  const { data: selectedStudent, isLoading: selectedStudentLoading } = useStudent(selectedStudentId);
  const { data: selectedStudentGuardians, isLoading: selectedStudentGuardiansLoading } = useGuardians(selectedStudentId);
  const { data: allSelectedStudentConsultations, isLoading: selectedStudentConsultationsLoading } = useConsultations(selectedStudentId);
  const { data: selectedStudentTags, isLoading: selectedStudentTagsLoading } = useStudentTagsByStudent(selectedStudentId);
  const { data: selectedStudentClasses, isLoading: selectedStudentClassesLoading } = useStudentClasses(selectedStudentId);
  const { data: allClasses } = useClasses({ status: 'active' });
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const { data: userRole } = useUserRole();

  // 레이어 메뉴 탭 상태 (URL 기반 초기화)
  const [layerMenuTab, setLayerMenuTab] = useState<'info' | 'guardians' | 'consultations' | 'tags' | 'classes' | 'attendance' | 'risk' | 'welcome'>(getInitialTab());

  // 레이어 메뉴 내부 상태
  const [isEditing, setIsEditing] = useState(false);
  const [showGuardianForm, setShowGuardianForm] = useState(false);
  const [showConsultationForm, setShowConsultationForm] = useState(false);
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [editingConsultationId, setEditingConsultationId] = useState<string | null>(null);
  const [consultationTypeFilter, setConsultationTypeFilter] = useState<ConsultationType | 'all'>('all');

  // 상담일지 필터링
  const selectedStudentConsultations = useMemo(() => {
    if (!allSelectedStudentConsultations) return [];
    if (consultationTypeFilter === 'all') return allSelectedStudentConsultations;
    return (allSelectedStudentConsultations as Array<{ consultation_type: string }>).filter((c) => c.consultation_type === consultationTypeFilter);
  }, [allSelectedStudentConsultations, consultationTypeFilter]);

  // Mutation 훅
  const updateStudent = useUpdateStudent();
  const deleteStudent = useDeleteStudent();
  const createGuardian = useCreateGuardian();
  const updateGuardian = useUpdateGuardian();
  const deleteGuardian = useDeleteGuardian();
  const createConsultation = useCreateConsultation();
  const updateConsultation = useUpdateConsultation();
  const deleteConsultation = useDeleteConsultation();
  const generateAISummary = useGenerateConsultationAISummary();
  const updateStudentTags = useUpdateStudentTags();
  const assignStudentToClass = useAssignStudentToClass();
  const unassignStudentFromClass = useUnassignStudentFromClass();

  // URL에서 학생 ID가 변경되면 레이어 메뉴 열기
  useEffect(() => {
    if (urlStudentId && urlStudentId !== selectedStudentId) {
      setSelectedStudentId(urlStudentId);
      const initialTab = getInitialTab();
      setLayerMenuTab(initialTab);
    } else if (!urlStudentId && selectedStudentId) {
      // URL에 학생 ID가 없으면 레이어 메뉴 닫기
      setSelectedStudentId(null);
    }
  }, [urlStudentId, selectedStudentId, getInitialTab]);

  // URL 경로 변경 시 탭 업데이트
  useEffect(() => {
    const newTab = getInitialTab();
    if (newTab !== layerMenuTab) {
      setLayerMenuTab(newTab);
    }
  }, [getInitialTab, layerMenuTab]);

  // 레이어 메뉴 상태 변경 시 URL 업데이트
  const handleStudentSelect = (studentId: string | null) => {
    setSelectedStudentId(studentId);
    if (studentId) {
      // URL 업데이트 (히스토리에 추가하지 않고 replace)
      navigate(`/students/list?student=${studentId}&tab=${layerMenuTab}`, { replace: true });
    } else {
      // 레이어 메뉴 닫을 때 URL에서 학생 ID 제거
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('student');
      newSearchParams.delete('tab');
      navigate(`/students/list?${newSearchParams.toString()}`, { replace: true });
    }
  };

  const handleTabChange = (newTab: 'info' | 'guardians' | 'consultations' | 'tags' | 'classes' | 'attendance' | 'risk' | 'welcome') => {
    setLayerMenuTab(newTab);
    if (selectedStudentId) {
      // 탭 변경 시 URL 업데이트
      navigate(`/students/list?student=${selectedStudentId}&tab=${newTab}`, { replace: true });
    }
  };

  // 학생 선택 시 탭 및 상태 초기화
  useEffect(() => {
    if (selectedStudentId) {
      setIsEditing(false);
      setShowGuardianForm(false);
      setShowConsultationForm(false);
      setEditingGuardianId(null);
      setEditingConsultationId(null);
      setConsultationTypeFilter('all');
    }
  }, [selectedStudentId]);

  const handleFilterChange = React.useCallback((filters: Record<string, unknown>) => {
    // SchemaFilter에서 검색 필드 디바운싱이 자동으로 적용됨
    setFilter((prev) => ({
      search: filters.search ? String(filters.search) : undefined,
      status: filters.status as StudentStatus | StudentStatus[] | undefined,
      grade: filters.grade ? String(filters.grade) : undefined,
      class_id: filters.class_id ? String(filters.class_id) : undefined,
      tag_ids: prev.tag_ids, // 태그 필터는 별도로 유지
    }));
  }, []);

  // [성능 최적화] handleTagFilter를 useCallback으로 메모이제이션
  const handleTagFilter = React.useCallback((tagId: string) => {
    setFilter((prev: StudentFilter) => {
      const currentTagIds = prev.tag_ids || [];
      const newTagIds = currentTagIds.includes(tagId)
        ? currentTagIds.filter((id) => id !== tagId)
        : [...currentTagIds, tagId];
      return {
        ...prev,
        tag_ids: newTagIds.length > 0 ? newTagIds : undefined,
      };
    });
  }, []);

  // 태그 목록이 한 줄을 넘어가는지 감지하고, 넘어가면 우측 화살표(펼치기/접기) 표시
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const el = tagListRef.current;
    if (!el) return;

    const measure = () => {
      // 첫 번째 버튼의 높이를 1줄 높이로 사용
      const firstBtn = el.querySelector('button') as HTMLButtonElement | null;
      const oneLineHeight = firstBtn?.offsetHeight ?? 32;
      setTagListCollapsedHeight(oneLineHeight);

      // wrap으로 인해 실제 컨텐츠 높이가 1줄보다 크면 토글 표시
      const isWrapped = el.scrollHeight > oneLineHeight + 1;
      setShowTagListToggle(isWrapped);

      // wrap이 아니면 펼침 상태를 강제로 해제(토글 숨김)
      if (!isWrapped) setIsTagListExpanded(false);
    };

    // 렌더 후 레이아웃 확정된 다음 측정
    const raf = window.requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    // 모바일→데스크탑 전환 등 "컨테이너 크기 변경"은 resize 이벤트만으로 누락될 수 있어
    // ResizeObserver로 실제 엘리먼트 크기 변경을 직접 감지한다.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
    ro?.observe(el);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [tags, filter.tag_ids, showTagListToggle, isTagListExpanded, mode]);

  // 다운로드 핸들러
  const handleDownload = React.useCallback(async () => {
    try {
      // xlsx 모듈 동적 로드
      const XLSX = await import('xlsx');

      // 학생 데이터를 엑셀 형식으로 변환
      const excelData = students?.map((student) => ({
        이름: student.name,
        생년월일: student.birth_date || '',
        성별: student.gender || '',
        전화번호: student.phone || '',
        이메일: student.email || '',
        주소: student.address || '',
        학교: student.school_name || '',
        학년: student.grade || '',
        상태: student.status || '',
        메모: student.notes || '',
      })) || [];

      // 워크북 생성
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '학생 목록');

      // 파일 다운로드
      const fileName = `학생목록_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : '엑셀 다운로드에 실패했습니다.',
        '오류',
        'error'
      );
    }
  }, [students, showAlert]);

  // 양식 다운로드 핸들러
  const handleDownloadTemplate = React.useCallback(async () => {
    try {
      // xlsx 모듈 동적 로드
      const XLSX = await import('xlsx');

      // 빈 양식 데이터 생성 (헤더만 있는 엑셀 파일)
      const templateData = [{
        이름: '',
        생년월일: '',
        성별: '',
        전화번호: '',
        이메일: '',
        주소: '',
        학교: '',
        학년: '',
        상태: '',
        메모: '',
      }];

      // 워크북 생성
      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '학생 양식');

      // 파일 다운로드
      const fileName = `학생등록양식_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      showAlert('양식 파일 다운로드가 완료되었습니다.', '다운로드 완료', 'success');
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : '양식 파일 다운로드에 실패했습니다.',
        '오류',
        'error'
      );
    }
  }, [showAlert]);

  return (
    <ErrorBoundary>
      <RightLayerMenuLayout
        layerMenu={{
          isOpen: !!selectedStudentId,
          onClose: () => handleStudentSelect(null),
          title: selectedStudentLoading ? '로딩 중...' : selectedStudent ? (
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 'var(--spacing-xs)', minWidth: 0 }}>
              <span
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-extrabold)',
                  color: 'var(--color-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {selectedStudent.name}
              </span>
              <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', whiteSpace: 'nowrap' }}>
                학생 상세정보
              </span>
            </span>
          ) : '학생 상세',
          width: isTablet ? 'var(--width-layer-menu-tablet)' : 'var(--width-layer-menu)',
          children: selectedStudentLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              로딩 중...
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
                  기본정보
                </Button>
                <Button
                  variant={layerMenuTab === 'guardians' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('guardians')}
                >
                  학부모 정보 ({selectedStudentGuardians?.length || 0})
                </Button>
                <Button
                  variant={layerMenuTab === 'consultations' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('consultations')}
                >
                  상담일지 ({selectedStudentConsultations?.length || 0})
                </Button>
                <Button
                  variant={layerMenuTab === 'tags' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('tags')}
                >
                  태그관리
                </Button>
                <Button
                  variant={layerMenuTab === 'classes' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('classes')}
                >
                  반배정 ({selectedStudentClasses?.filter((sc) => sc.is_active).length || 0})
                </Button>
                <Button
                  variant={layerMenuTab === 'attendance' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('attendance')}
                >
                  출결기록
                </Button>
                <Button
                  variant={layerMenuTab === 'risk' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('risk')}
                >
                  이탈위험
                </Button>
                <Button
                  variant={layerMenuTab === 'welcome' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('welcome')}
                >
                  환영 메시지
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
                        '정말 삭제하시겠습니까?\n(문서 기준: 학생은 삭제 시 상태가 퇴원(withdrawn)으로 변경됩니다.)',
                        '학생 삭제'
                      );
                      if (!confirmed) return;
                      await deleteStudent.mutateAsync(selectedStudent.id);
                      showAlert('학생이 삭제(퇴원 처리)되었습니다.', '성공', 'success');
                      handleStudentSelect(null);
                    }}
                  />
                )}
                {layerMenuTab === 'guardians' && selectedStudent && (
                  <GuardiansTab
                    guardians={(selectedStudentGuardians as Guardian[]) || []}
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
                      const confirmed = await showConfirm('정말 삭제하시겠습니까?', '보호자 삭제');
                      if (confirmed) {
                        await deleteGuardian.mutateAsync({ guardianId, studentId: selectedStudent.id });
                      }
                    }}
                    isEditable={userRole !== 'teacher' && userRole !== 'assistant'}
                  />
                )}
                {layerMenuTab === 'consultations' && selectedStudent && (
                  <ConsultationsTab
                    consultations={(selectedStudentConsultations as StudentConsultation[]) || []}
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
                        showAlert('사용자 정보를 가져올 수 없습니다. 다시 로그인해주세요.', '오류', 'error');
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
                      const confirmed = await showConfirm('정말 삭제하시겠습니까?', '상담일지 삭제');
                      if (confirmed) {
                        await deleteConsultation.mutateAsync({ consultationId, studentId: selectedStudent.id });
                      }
                    }}
                    onGenerateAISummary={async (consultationId) => {
                      try {
                        await generateAISummary.mutateAsync({ consultationId, studentId: selectedStudent.id });
                      } catch (error) {
                        showAlert(
                          error instanceof Error ? error.message : 'AI 요약에 실패했습니다.',
                          '오류',
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
                    studentClasses={selectedStudentClasses || []}
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
                {layerMenuTab === 'welcome' && selectedStudent && (
                  <WelcomeTab
                    studentId={selectedStudentId}
                    student={selectedStudent}
                    isEditable={userRole !== 'teacher' && userRole !== 'assistant'}
                  />
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              학생 정보를 불러올 수 없습니다.
            </div>
          ),
        }}
      >
        <Container maxWidth="xl" padding="lg">
        {/* 타이틀과 액션 버튼을 한 줄로 배치 */}
        <PageHeader
          title="학생관리"
          actions={
            <DataTableActionButtons
              align="right"
              onCreate={() => setShowCreateForm(true)}
              onUpload={() => fileInputRef.current?.click()}
              onDownload={handleDownload}
              onDownloadTemplate={handleDownloadTemplate}
              uploadDisabled={bulkCreateStudents.isPending}
              createTooltip="학생등록"
            />
          }
        />

        {/* 검색 및 필터 패널 */}
        {/* SchemaFilter에서 검색 필드 디바운싱이 자동으로 적용됨 */}
        <SchemaFilter
          schema={effectiveFilterSchema}
          onFilterChange={handleFilterChange}
          defaultValues={{
            search: filter.search || '',
            status: filter.status || '',
            grade: filter.grade || '',
            class_id: filter.class_id || '',
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            try {
              // xlsx 모듈 동적 로드
              const XLSX = await import('xlsx');

              // 엑셀 파일 읽기
              const arrayBuffer = await file.arrayBuffer();
              const workbook = XLSX.read(arrayBuffer, { type: 'array' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];

              // JSON으로 변환
              const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<Record<string, unknown>>;

              // CreateStudentInput 형식으로 변환
              const students: CreateStudentInput[] = jsonData.map((row: Record<string, unknown>) => ({
                name: String(row['이름'] || row['name'] || ''),
                birth_date: row['생년월일'] || row['birth_date'] ? String(row['생년월일'] || row['birth_date']) : undefined,
                gender: (row['성별'] || row['gender'] || undefined) as Gender | undefined,
                phone: row['전화번호'] || row['phone'] ? String(row['전화번호'] || row['phone']) : undefined,
                email: row['이메일'] || row['email'] ? String(row['이메일'] || row['email']) : undefined,
                address: row['주소'] || row['address'] ? String(row['주소'] || row['address']) : undefined,
                school_name: row['학교'] || row['school_name'] ? String(row['학교'] || row['school_name']) : undefined,
                grade: row['학년'] || row['grade'] ? String(row['학년'] || row['grade']) : undefined,
                status: (row['상태'] || row['status'] || 'active') as StudentStatus,
                notes: row['메모'] || row['notes'] ? String(row['메모'] || row['notes']) : (row['비고'] ? String(row['비고']) : undefined),
              })).filter((s) => s.name.trim() !== ''); // 이름이 없는 경우 제외

              if (students.length === 0) {
                showAlert('등록할 학생 데이터가 없습니다.', '알림', 'warning');
                return;
              }

              // 일괄 등록 실행
              const result = await bulkCreateStudents.mutateAsync(students);

              if (result.errors && result.errors.length > 0) {
                showAlert(
                  `${result.results.length}개 등록 완료, ${result.errors.length}개 실패`,
                  '일괄 등록 결과',
                  'warning'
                );
              } else {
                showAlert(
                  `${result.results.length}개 등록 완료`,
                  '일괄 등록 완료',
                  'success'
                );
              }

              // 파일 입력 초기화
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            } catch (error) {
              // 에러는 showAlert로 사용자에게 표시
              showAlert(
                error instanceof Error ? error.message : '엑셀 일괄 등록에 실패했습니다.',
                '오류',
                'error'
              );
            }
          }}
        />

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
                  // 28px = 8px(spacing-sm) + 16px(size-icon-base) + 4px(spacing-xs)
                  paddingRight: showTagListToggle
                    ? 'calc(var(--spacing-sm) + var(--size-icon-base) + var(--spacing-xs))'
                    : undefined,
                  // 접기 상태: 1줄까지만 보여주기
                  maxHeight: !isTagListExpanded && tagListCollapsedHeight ? `${tagListCollapsedHeight}px` : undefined,
                  overflow: !isTagListExpanded && showTagListToggle ? 'hidden' : undefined,
                  transition: 'max-height var(--transition-fast)',
                }}
              >
                {/* 요청사항: 태그가 있는 경우에만, 첫 번째 태그 왼쪽에 아이콘 1회 출력 */}
                {tags.length > 0 && (
                  <span
                    style={{
                      height: tagListCollapsedHeight ? `${tagListCollapsedHeight}px` : 'var(--size-pagination-button)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      // flex-wrap 환경에서 첫 줄 버튼들과 세로 중앙 정렬을 안정적으로 맞춤
                      alignSelf: 'center',
                      lineHeight: 0,
                      color: 'var(--color-text-secondary)',
                      marginRight: 'var(--spacing-xxs)',
                    }}
                  >
                    <TagIcon size={iconSize} strokeWidth={iconStrokeWidth} />
                  </span>
                )}
                {tags.map((tag: { id: string; name: string; color: string }) => (
                  <Button
                    key={tag.id}
                    variant={filter.tag_ids?.includes(tag.id) ? 'solid' : 'outline'}
                    size="sm"
                    onClick={() => handleTagFilter(tag.id)}
                    style={{
                      // 요청사항:
                      // - 태그 리스트 버튼 사이즈(체감)를 2px 줄임
                      // - 기본(미선택) 버튼 배경을 화이트로 고정
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
                  aria-label={isTagListExpanded ? '태그 목록 접기' : '태그 목록 펼치기'}
                  onClick={() => setIsTagListExpanded((v) => !v)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    height: tagListCollapsedHeight ? `${tagListCollapsedHeight}px` : 'var(--size-pagination-button)',
                    // 28px = 8px(spacing-sm) + 16px(size-icon-base) + 4px(spacing-xs)
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

        {/* 학생 등록 폼 - 반응형: 모바일/태블릿은 모달/드로어, 데스크톱은 인라인 */}
        {showCreateForm && (
            <>
              {isMobile || isTablet ? (
                // 모바일/태블릿: Drawer 사용 (아키텍처 문서 6-1 참조)
                <Drawer
                  isOpen={showCreateForm}
                  onClose={() => setShowCreateForm(false)}
                  title="학생 등록"
                  position={isMobile ? 'bottom' : 'right'}
                  width={isTablet ? 'var(--width-drawer-tablet)' : 'var(--width-full)'}
                >
                  <CreateStudentForm
                    onClose={() => setShowCreateForm(false)}
                    onSubmit={async (data) => {
                      await createStudent.mutateAsync(data);
                      setShowCreateForm(false);
                    }}
                    effectiveFormSchema={effectiveFormSchema}
                  />
                </Drawer>
              ) : (
                // 데스크톱: 인라인 폼 (기존 방식)
                <CreateStudentForm
                  onClose={() => setShowCreateForm(false)}
                  onSubmit={async (data) => {
                    await createStudent.mutateAsync(data);
                    setShowCreateForm(false);
                  }}
                  effectiveFormSchema={effectiveFormSchema}
                />
              )}
          </>
        )}

        {/* 학생 목록 */}
        {/* 로딩 상태 */}
        {isLoading && (
          <Card padding="lg" variant="default">
            <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              학생 목록을 불러오는 중...
            </div>
          </Card>
        )}

        {/* 에러 상태 (로딩 완료 후에만 표시) */}
        {!isLoading && error && (
            <Card padding="md" variant="outlined">
              <div style={{ color: 'var(--color-error)' }}>
                오류: {error instanceof Error ? error.message : '학생 목록을 불러오는데 실패했습니다.'}
              </div>
          </Card>
        )}

        {/* 학생 목록 (로딩 완료 후, 에러 없을 때만 표시) */}
        {!isLoading && !error && students && students.length > 0 && (
            <>
              {effectiveTableSchema && (
                <SchemaTable
                  key={`student-table-${JSON.stringify(filter)}`}
                  schema={effectiveTableSchema}
                  data={(students as unknown as Record<string, unknown>[]) || []}
                  totalCount={totalCount}
                  page={tablePage}
                  onPageChange={setTablePage}
                  filters={tableFilters}
                  actionContext={{
                    navigate: (path: string) => navigate(path),
                  }}
                  onRowClick={(row) => {
                    const studentId = row.id as string;
                    if (studentId) {
                      handleStudentSelect(studentId);
                    }
                  }}
                />
              )}
          </>
        )}

        {/* 빈 상태 (로딩 완료 후, 에러 없을 때, 학생이 없을 때만 표시) */}
        {!isLoading && !error && students && students.length === 0 && (
            <Card padding="lg" variant="default">
              <div style={{
                textAlign: 'center',
                color: 'var(--color-text-secondary)',
                padding: 'var(--spacing-xl)'
              }}>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                  등록된 학생이 없습니다.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(true)}
                >
                  첫 학생 등록하기
                </Button>
              </div>
          </Card>
        )}
      </Container>
      </RightLayerMenuLayout>
    </ErrorBoundary>
  );
}

// ============================================================================
// RightLayerMenu: Header(밑줄만) + Content 컨테이너 공통 스타일
// - Card의 title 영역을 쓰지 않고, 상단 헤더를 분리하여 밑줄만 적용
// - 밑줄 색상은 텍스트 기본색(var(--color-text))을 사용
// - 테두리/배경은 제거(하드코딩 금지, CSS 변수 사용)
// ============================================================================
function LayerSectionHeader({
  title,
  right,
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: right ? 'space-between' : 'flex-start',
        gap: 'var(--spacing-sm)',
        // 요구사항: 헤더/본문 간 여백 체감 축소를 위해 헤더 상하 패딩 한 단계 축소
        paddingTop: 'var(--spacing-sm)',
        paddingBottom: 'var(--spacing-sm)',
        // 요구사항: 우측(필터 배지/추가 버튼) 우측 여백을 좌측(아이콘+타이틀) 좌측 여백과 동일하게
        paddingLeft: 'var(--spacing-form-horizontal-left)',
        paddingRight: 'var(--spacing-form-horizontal-left)',
        // 헤더 밑줄(=borderBottom)과 본문 카드 사이 간격 표준화 (기본정보 탭 기준)
        // 요구사항: 헤더와 바로 아래 카드 사이 여백 한 단계 축소
        marginBottom: 'var(--spacing-xs)',
        // 우측 액션(필터/추가 버튼) 유무에 따라 높이가 달라지지 않도록 최소 높이 보장
        // (Card 타이틀 영역과 동일 기준: --size-pagination-button)
        minHeight: 'calc(var(--spacing-sm) + var(--size-pagination-button) + var(--spacing-sm))',
        backgroundColor: 'transparent',
        border: 'none',
        // 요구사항: 헤더 아래 밑줄 제거
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          color: 'var(--color-text)',
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-bold)',
        }}
      >
        {title}
      </div>
      {right ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          {right}
        </div>
      ) : (
        // 우측 컨텐츠가 없어도 높이(버튼 기준)를 맞추기 위한 스페이서
        <div style={{ width: 0, height: 'var(--size-pagination-button)', minHeight: 'var(--size-pagination-button)' }} />
      )}
    </div>
  );
}

// NOTE: “헤더는 분리(밑줄만), 본문은 카드로 보여야 함” 요구사항에 따라
// 레이어 섹션 본문은 Card 기본 스타일(배경/테두리 포함)을 유지합니다.
// 따라서 여기서는 본문 카드의 스타일을 오버라이드하지 않습니다.
const layerSectionCardStyle: React.CSSProperties = {};

// 학생 등록 폼 컴포넌트
interface CreateStudentFormProps {
  onClose: () => void;
  onSubmit: (data: CreateStudentInput) => Promise<void>;
  effectiveFormSchema: FormSchema;
}

function CreateStudentForm({ onClose, onSubmit, effectiveFormSchema }: CreateStudentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showAlert } = useModal();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';

  const handleSubmit = async (data: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      // 스키마에서 받은 데이터를 CreateStudentInput 형식으로 변환
      const input: CreateStudentInput = {
        name: String(data.name ?? ''),
        birth_date: data.birth_date ? String(data.birth_date) : undefined,
        gender: data.gender as Gender | undefined,
        phone: data.phone ? String(data.phone) : undefined,
        email: data.email ? String(data.email) : undefined,
        address: data.address ? String(data.address) : undefined,
        school_name: data.school_name ? String(data.school_name) : undefined,
        grade: data.grade ? String(data.grade) : undefined,
        status: (data.status || 'active') as StudentStatus,
        notes: data.notes ? String(data.notes) : undefined,
      };
      await onSubmit(input);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Drawer 내부에서는 헤더가 Drawer에 있으므로 중복 제거
  // 데스크톱에서만 인라인으로 표시되므로 showHeader는 데스크톱에서만 true
  const showHeader = !isMobile && !isTablet;
  // Drawer 내부에서 사용될 때는 padding 중복 방지를 위해 disableCardPadding=true
  // 모바일/태블릿에서는 Drawer를 사용하므로 disableCardPadding=true
  const isInDrawer = isMobile || isTablet;

  return (
    <div style={showHeader ? { marginBottom: 'var(--spacing-md)' } : {}}>
      {showHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>학생 등록</h3>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            닫기
          </Button>
        </div>
      )}
      <SchemaForm
        schema={effectiveFormSchema}
        onSubmit={handleSubmit}
        defaultValues={{
          status: 'active',
        }}
        disableCardPadding={isInDrawer}
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
    </div>
  );
}

// ============================================================================
// StudentDetailPage의 모든 탭 컴포넌트 (레이어 메뉴에서 재사용)
// ============================================================================

// 기본 정보 탭 컴포넌트
interface StudentInfoTabProps {
  student: Student;
  isEditing: boolean;
  effectiveStudentFormSchema: FormSchema;
  onCancel: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
}

function StudentInfoTab({ student, isEditing, effectiveStudentFormSchema, onCancel, onSave, onEdit, onDelete }: StudentInfoTabProps) {
  // 훅은 항상 컴포넌트 최상단에서 호출되어야 함 (React Hooks 규칙)
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  // [성능 최적화] 디버깅 로그는 개발 환경에서만 실행
  // 프로덕션에서는 제거되어 번들 크기 감소
  React.useEffect(() => {
    if (import.meta.env?.DEV) {
      console.group('🔍 [StudentInfoTab] 디버깅 정보');
      console.log('📋 student prop:', {
        id: student?.id,
        name: student?.name,
        birth_date: student?.birth_date,
        gender: student?.gender,
        phone: student?.phone,
        email: student?.email,
        address: student?.address,
        school_name: student?.school_name,
        grade: student?.grade,
        status: student?.status,
        notes: student?.notes,
      });
      console.log('✏️ isEditing:', isEditing);
      console.groupEnd();
    }
  }, [student, isEditing]);

  // defaultValues를 useMemo로 메모이제이션하여 student 변경 시 재계산
  // [중요] 모든 Hook은 조건문 이전에 호출되어야 함
  const formDefaultValues = React.useMemo(() => {
    const values = {
      name: student.name || '',
      birth_date: student.birth_date || '',
      gender: student.gender || '',
      phone: student.phone || '',
      email: student.email || '',
      address: student.address || '',
      school_name: student.school_name || '',
      grade: student.grade || '',
      status: student.status || 'active',
      notes: student.notes || '',
    };

    // 디버깅: formDefaultValues 계산 확인
    if (import.meta.env?.DEV) {
      console.log('📝 [StudentInfoTab] formDefaultValues 계산:', values);
    }

    return values;
  }, [student]);

  // 수정 모드를 위한 스키마 (submit 버튼 커스터마이징)
  // [중요] 모든 Hook은 조건문 이전에 호출되어야 함
  const editSchema = React.useMemo(() => ({
    ...effectiveStudentFormSchema,
    form: {
      ...effectiveStudentFormSchema.form,
      submit: {
        label: '저장',
        variant: 'solid' as const,
        color: 'primary' as const,
        size: 'md' as const,
      },
    },
  }), [effectiveStudentFormSchema]);

  // 조회(읽기) 모드 스키마: 수정폼과 동일 레이아웃을 쓰되, 모든 필드를 disabled 처리
  // [중요] Hook은 조건문 밖에서 호출되어야 함
  // 디버깅: SchemaForm 렌더링 확인
  // [중요] 모든 Hook은 조건문 이전에 호출되어야 함
  React.useEffect(() => {
    if (isEditing && import.meta.env?.DEV) {
      console.log('📋 [StudentInfoTab] SchemaForm 렌더링:', {
        studentId: student.id,
        formDefaultValues,
        editSchemaFields: editSchema.form?.fields?.map(f => f.name),
      });
    }
  }, [isEditing, student.id, formDefaultValues, editSchema]);

  // 읽기 전용 모드: 수정폼과 동일한 2열 레이아웃, 텍스트만 출력 (아이콘/드롭다운 없음)
  // 필드 정의 (수정폼 스키마와 동일한 순서/구조)
  const readOnlyFields = React.useMemo(() => [
    { label: '이름', value: student.name || '-' },
    { label: '생년월일', value: student.birth_date || '-' },
    { label: '성별', value: student.gender === 'male' ? '남' : student.gender === 'female' ? '여' : '-' },
    { label: '전화번호', value: student.phone || '-' },
    { label: '이메일', value: student.email || '-' },
    { label: '학교', value: student.school_name || '-' },
    { label: '학년', value: student.grade || '-' },
    { label: '상태', value: student.status === 'active' ? '재원' : student.status === 'on_leave' ? '휴원' : student.status === 'withdrawn' ? '퇴원' : student.status === 'graduated' ? '졸업' : '-' },
    { label: '주소', value: student.address || '-', colSpan: 2 },
    { label: '메모', value: student.notes || '-', colSpan: 2 },
  ], [student]);

  if (!isEditing) {
    return (
      <div>
        <LayerSectionHeader
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <User size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
              기본정보
            </span>
          }
        />
        <Card
          padding="md"
          variant="default"
          style={{
            ...layerSectionCardStyle,
            // 요구사항: 기본보기에서만 카드 테두리를 텍스트 기본 색상으로 출력
            border: 'var(--border-width-thin) solid var(--color-text)',
          }}
        >
        {/* 수정폼과 동일한 2열 그리드 레이아웃, 텍스트만 출력 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
            gap: 'var(--spacing-md)',
          }}
        >
          {readOnlyFields.map((field, idx) => (
            <div
              key={idx}
              style={{
                // 모바일 기본보기: 1열이므로 colSpan 2도 span 1로 강제
                gridColumn: field.colSpan === 2 ? (isMobile ? 'span 1' : 'span 2') : undefined,
                display: 'flex',
                width: '100%',
                alignItems: field.label === '메모' ? 'flex-start' : 'center',
                // 수정폼(Input/Select/DatePicker)의 md 패딩과 동일하게 맞춤
                paddingTop: 'var(--spacing-sm)',
                paddingBottom: 'var(--spacing-sm)',
                paddingLeft: 'var(--spacing-form-horizontal-left)',
                paddingRight: 'var(--spacing-form-horizontal-right)',
                // 요구사항: 기본보기 밑줄은 원래 연한 색상으로 복구
                borderBottom: 'var(--border-width-thin) solid var(--color-table-row-border)',
              }}
            >
              {/* 항목명: 고정 너비 (수정폼 인라인 라벨과 동일) */}
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
              {/* 결과값 */}
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
        {/* 요구사항: 기본보기 > 삭제/수정 버튼 텍스트 제거, IconButtonGroup 스타일(아이콘만) + 우측 정렬 */}
        {(onEdit || onDelete) && (
          <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
            <IconButtonGroup
              align="right"
              items={[
                ...(onDelete ? [{
                  icon: Trash2,
                  tooltip: '삭제',
                  variant: 'outline' as const,
                  color: 'error' as const,
                  onClick: () => { void onDelete?.(); },
                }] : []),
                ...(onEdit ? [{
                  icon: Pencil,
                  tooltip: '수정',
                  variant: 'outline' as const,
                  onClick: onEdit,
                }] : []),
              ]}
            />
          </div>
        )}
        </Card>
      </div>
    );
  }

  // 수정 모드: SchemaForm 사용
  const handleSubmit = async (data: Record<string, unknown>) => {
    // 스키마에서 받은 데이터를 UpdateStudentInput 형식으로 변환
    const updateData = {
      name: data.name || student.name,
      birth_date: data.birth_date || undefined,
      gender: data.gender || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      address: data.address || undefined,
      school_name: data.school_name || undefined,
      grade: data.grade || undefined,
      status: data.status || student.status,
      notes: data.notes || undefined,
    };
    await onSave(updateData);
  };

  return (
    <div>
      <LayerSectionHeader
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <User size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
            학생정보 수정
          </span>
        }
      />
      <SchemaForm
        key={student.id} // student.id를 key로 사용하여 학생 변경 시 폼 재마운트
        schema={editSchema}
        onSubmit={handleSubmit}
        defaultValues={formDefaultValues}
        apiClient={apiClient}
        disableCardPadding={false}
        cardTitle={undefined}
        onCancel={onCancel}
        onDelete={onDelete}
      />
    </div>
  );
}

// 학부모 탭 컴포넌트
interface GuardiansTabProps {
  guardians: Guardian[];
  isLoading: boolean;
  showForm: boolean;
  editingGuardianId: string | null;
  effectiveGuardianFormSchema: FormSchema;
  onShowForm: () => void;
  onHideForm: () => void;
  onEdit: (guardianId: string) => void;
  onCreate: (data: Record<string, unknown>) => Promise<void>;
  onUpdate: (guardianId: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (guardianId: string) => Promise<void>;
  isEditable?: boolean;
}

function GuardiansTab({
  guardians,
  isLoading,
  showForm,
  editingGuardianId,
  effectiveGuardianFormSchema,
  onShowForm,
  onHideForm,
  onEdit,
  onCreate,
  onUpdate,
  onDelete,
  isEditable = true,
}: GuardiansTabProps) {
  const editingGuardian = editingGuardianId ? guardians.find((g) => g.id === editingGuardianId) : null;
  const { showAlert, showConfirm } = useModal();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const [relationshipFilter, setRelationshipFilter] = useState<'all' | 'parent' | 'guardian' | 'other'>('all');

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      // 주 보호자 처리:
      // - DB 레벨에 "주 보호자 1명" 제약이 없어서 복수 true가 들어갈 수 있음
      // - 하지만 다른 기능(예: 알림 발송 등)에서 is_primary=true 1명을 전제로 조회하므로
      //   새로 주 보호자를 true로 저장할 때 기존 주 보호자는 자동으로 false로 내림
      const wantsPrimary = Boolean((data as { is_primary?: unknown }).is_primary);
      if (!editingGuardianId && wantsPrimary) {
        const currentPrimaryGuardians = guardians.filter((g) => g.is_primary);
        if (currentPrimaryGuardians.length > 0) {
          // 사용자 확인 없이 자동 조정(UX 단순화)
          await Promise.all(
            currentPrimaryGuardians.map((g) => onUpdate(g.id, { is_primary: false }))
          );
        }
      }

      if (editingGuardianId) {
        await onUpdate(editingGuardianId, data);
      } else {
        await onCreate(data);
      }
      onHideForm();
    } catch (error) {
      showAlert('오류', error instanceof Error ? error.message : '학부모 정보 저장에 실패했습니다.');
    }
  };

  // 타이틀 아이콘 크기 및 선 두께 계산 (CSS 변수 사용)
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  const baseIconSize = useIconSize();
  const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  const emptyStateIconStrokeWidth = useIconStrokeWidth();

  // 필터링된 학부모 목록
  const filteredGuardians = useMemo(() => {
    if (relationshipFilter === 'all') {
      return guardians;
    }
    return guardians.filter((guardian) => guardian.relationship === relationshipFilter);
  }, [guardians, relationshipFilter]);

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div>
      {showForm && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Users size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                {isEditable && editingGuardianId ? '학부모 정보 수정' : '학부모 추가'}
              </span>
            }
          />
          <SchemaForm
            schema={{
              ...effectiveGuardianFormSchema,
              form: {
                ...effectiveGuardianFormSchema.form,
                // [불변 규칙] actions를 명시적으로 비활성화하여 SchemaForm이 자동 API 호출을 하지 않도록 함
                // handleSubmit에서 onCreate/onUpdate를 통해 직접 처리
                actions: [],
              },
              // 최상위 actions도 비활성화
              actions: [],
            }}
            onSubmit={handleSubmit}
            defaultValues={editingGuardian ? {
              name: editingGuardian.name,
              relationship: editingGuardian.relationship,
              phone: editingGuardian.phone || '',
              email: editingGuardian.email || '',
              is_primary: editingGuardian.is_primary || false,
              notes: editingGuardian.notes || '',
            } : {
              relationship: 'parent',
              is_primary: false,
            }}
            disableCardPadding={false}
            cardTitle={undefined}
            onCancel={onHideForm}
            onDelete={
              isEditable && editingGuardianId
                ? async () => {
                    const confirmed = await showConfirm('정말 삭제하시겠습니까?', '보호자 삭제');
                    if (!confirmed) return;
                    await onDelete(editingGuardianId);
                    onHideForm();
                  }
                : undefined
            }
          />
        </div>
      )}

      {!showForm && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Users size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                학부모 정보
              </span>
            }
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <BadgeSelect
                  value={relationshipFilter}
                  onChange={(value) => setRelationshipFilter(value as typeof relationshipFilter)}
                  options={[
                    { value: 'all', label: '전체' },
                    { value: 'parent', label: '부모' },
                    { value: 'guardian', label: '보호자' },
                    { value: 'other', label: '기타' },
                  ]}
                  size="sm"
                  selectedColor="var(--color-text)"
                  unselectedColor="var(--color-text)"
                />
                {isEditable && (
                  <IconButtonGroup
                    items={[
                      {
                        icon: PlusIcon,
                        tooltip: '학부모 추가',
                        variant: 'solid',
                        color: 'primary',
                        onClick: onShowForm,
                      },
                    ]}
                    align="right"
                  />
                )}
              </div>
            }
          />
          {filteredGuardians.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {filteredGuardians.map((guardian) => (
                <Card
                  key={guardian.id}
                  padding="md"
                  variant="default"
                  style={{
                    // 요구사항: 카드 라운드 한 단계 축소 (md -> sm)
                    borderRadius: 'var(--border-radius-sm)',
                    // 요구사항: 기본보기에서만 카드 테두리를 텍스트 기본 색상으로 출력
                    border: 'var(--border-width-thin) solid var(--color-text)',
                  }}
                >
                  {/* 기본보기: 수정폼과 동일한 레이아웃을 읽기 전용으로 렌더링 (아이콘/드롭다운 없음) */}
                  {(() => {
                    const readOnlyFields = [
                      { label: '이름', value: guardian.name || '-' },
                      {
                        label: '관계',
                        value: guardian.relationship === 'parent' ? '부모' : guardian.relationship === 'guardian' ? '보호자' : '기타',
                      },
                      { label: '전화번호', value: guardian.phone || '-' },
                      { label: '이메일', value: guardian.email || '-', },
                      { label: '주 보호자', value: guardian.is_primary ? '예' : '아니오' },
                      { label: '메모', value: guardian.notes || '-', colSpan: 2 },
                    ] as Array<{ label: string; value: string; colSpan?: 2 }>;

                    return (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                          // 기본정보(tab=info) 기본보기와 동일
                          gap: 'var(--spacing-md)',
                          // 기본정보(tab=info)에서는 정상인데 guardians에서만 밑줄이 짧아지는 케이스 방지:
                          // grid item이 내용 폭으로 줄어들지 않도록 강제
                          width: '100%',
                          justifyItems: 'stretch',
                        }}
                      >
                        {readOnlyFields.map((field, idx) => (
                          <div
                            key={idx}
                            style={{
                              // 모바일 기본보기: 1열이므로 colSpan 2도 span 1로 강제
                              gridColumn: field.colSpan === 2 ? (isMobile ? 'span 1' : 'span 2') : undefined,
                              display: 'flex',
                              width: '100%',
                              alignItems: field.label === '메모' ? 'flex-start' : 'center',
                              paddingTop: 'var(--spacing-sm)',
                              paddingBottom: 'var(--spacing-sm)',
                              paddingLeft: 'var(--spacing-form-horizontal-left)',
                              paddingRight: 'var(--spacing-form-horizontal-right)',
                              // tab=info와 동일하게 borderBottom 사용 (overflow: hidden 제거로 클리핑 해결)
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
                                whiteSpace: 'nowrap',
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
                    );
                  })()}
                  {/* 요구사항: 기본보기 > 삭제/수정 버튼 텍스트 제거, IconButtonGroup 스타일(아이콘만) + 우측 정렬 */}
                  {isEditable && (
                    <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
                      <IconButtonGroup
                        align="right"
                        items={[
                          {
                            icon: Trash2,
                            tooltip: '삭제',
                            variant: 'outline',
                            color: 'error',
                            onClick: () => onDelete(guardian.id),
                          },
                          {
                            icon: Pencil,
                            tooltip: '수정',
                            variant: 'outline',
                            onClick: () => onEdit(guardian.id),
                          },
                        ]}
                      />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card padding="md" variant="default" style={layerSectionCardStyle}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'calc(var(--spacing-xl) * 5)', // [불변 규칙] CSS 변수 사용
                padding: 'var(--spacing-xl)',
              }}>
                <Users
                  size={emptyStateIconSize}
                  strokeWidth={emptyStateIconStrokeWidth}
                  style={{
                    color: 'var(--color-gray-300)',
                    marginBottom: 'var(--spacing-xs)',
                    display: 'inline-block',
                  }}
                />
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  {guardians.length === 0 ? '등록된 학부모가 없습니다.' : '필터 조건에 맞는 학부모가 없습니다.'}
                </p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// 상담일지 탭 컴포넌트
interface ConsultationsTabProps {
  consultations: StudentConsultation[];
  isLoading: boolean;
  showForm: boolean;
  editingConsultationId: string | null;
  consultationTypeFilter: ConsultationType | 'all';
  effectiveConsultationFormSchema: FormSchema;
  onShowForm: () => void;
  onHideForm: () => void;
  onEdit: (consultationId: string) => void;
  onCreate: (data: Record<string, unknown>) => Promise<void>;
  onUpdate: (consultationId: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (consultationId: string) => Promise<void>;
  onGenerateAISummary: (consultationId: string) => Promise<void>;
  onFilterChange: (filter: ConsultationType | 'all') => void;
  isEditable?: boolean;
}

function ConsultationsTab({
  consultations,
  isLoading,
  showForm,
  editingConsultationId,
  consultationTypeFilter,
  effectiveConsultationFormSchema,
  onShowForm,
  onHideForm,
  onEdit,
  onCreate,
  onUpdate,
  onDelete,
  onGenerateAISummary,
  onFilterChange,
  isEditable = true,
}: ConsultationsTabProps) {
  const editingConsultation = editingConsultationId ? consultations.find((c) => c.id === editingConsultationId) : null;
  const { showAlert, showConfirm } = useModal();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const formRef = useRef<HTMLDivElement>(null);

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  const baseIconSize = useIconSize();
  const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  const emptyStateIconStrokeWidth = useIconStrokeWidth();

  // 타이틀 아이콘 크기 및 선 두께 계산 (CSS 변수 사용)
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();

  // [불변 규칙] textarea 높이는 CSS 변수로만 계산
  // 하드코딩된 rows 값 사용 금지 (문서 규칙 준수)
  // getComputedStyle + parseFloat 대신 calc() 사용하여 하드코딩 완전 제거
  useEffect(() => {
    if (showForm && formRef.current && !isMobile && !isTablet) {
      const form = formRef.current.querySelector('form');
      if (form) {
        // 상담 내용 textarea 높이 조정
        const textarea = form.querySelector('textarea[name="content"]') as HTMLTextAreaElement;
        if (textarea) {
          // [불변 규칙] CSS 변수만 사용하여 minHeight 계산 (calc() 사용)
          // 6줄 기준: line-height * font-size-base * 6 + padding (상하)
          textarea.style.minHeight = 'calc(var(--line-height) * var(--font-size-base) * 6 + var(--spacing-sm) * 2)';
        }
      }
    }
  }, [showForm, isMobile, isTablet]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      if (editingConsultationId) {
        await onUpdate(editingConsultationId, data);
      } else {
        await onCreate(data);
      }
      onHideForm();
    } catch (error) {
      showAlert('오류', error instanceof Error ? error.message : '상담일지 저장에 실패했습니다.');
    }
  };

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div>
      {showForm && (
        <div ref={formRef}>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <FileText size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                {editingConsultationId ? '상담일지 수정' : '상담일지 등록'}
              </span>
            }
          />
          <SchemaForm
            schema={effectiveConsultationFormSchema}
            onSubmit={handleSubmit}
            defaultValues={editingConsultation ? {
              consultation_date: editingConsultation.consultation_date,
              consultation_type: editingConsultation.consultation_type,
              content: editingConsultation.content,
            } : {
              consultation_date: toKST().format('YYYY-MM-DD'),
              consultation_type: 'counseling',
            }}
            disableCardPadding={false}
            cardTitle={undefined}
            onCancel={onHideForm}
            onDelete={
              isEditable && editingConsultationId
                ? async () => {
                    const confirmed = await showConfirm('정말 삭제하시겠습니까?', '상담일지 삭제');
                    if (!confirmed) return;
                    await onDelete(editingConsultationId);
                    onHideForm();
                  }
                : undefined
            }
          />
        </div>
      )}

      {!showForm && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <FileText size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                상담일지
              </span>
            }
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <BadgeSelect
                  value={consultationTypeFilter}
                  onChange={(value) => onFilterChange(value as ConsultationType | 'all')}
                  options={[
                    { value: 'all', label: '전체' },
                    { value: 'counseling', label: '상담일지' },
                    { value: 'learning', label: '학습일지' },
                    { value: 'behavior', label: '행동일지' },
                  ]}
                  size="sm"
                  selectedColor="var(--color-text)"
                  unselectedColor="var(--color-text)"
                />
                {isEditable && (
                  <IconButtonGroup
                    items={[
                      {
                        icon: PlusIcon,
                        tooltip: '일지등록',
                        variant: 'solid',
                        color: 'primary',
                        onClick: onShowForm,
                      },
                    ]}
                    align="right"
                  />
                )}
              </div>
            }
          />
          {consultations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {consultations.map((consultation) => (
                <Card
                  key={consultation.id}
                  padding="md"
                  variant="default"
                  style={{
                    // 요구사항: 카드 라운드 한 단계 축소 (md -> sm)
                    borderRadius: 'var(--border-radius-sm)',
                    // 요구사항: 기본보기에서만 카드 테두리를 텍스트 기본 색상으로 출력
                    border: 'var(--border-width-thin) solid var(--color-text)',
                  }}
                >
                  {/* 기본보기: 수정폼과 동일한 레이아웃을 읽기 전용으로 렌더링 */}
                  {(() => {
                    const typeLabel =
                      consultation.consultation_type === 'counseling' ? '상담일지'
                      : consultation.consultation_type === 'learning' ? '학습일지'
                      : consultation.consultation_type === 'behavior' ? '행동일지'
                      : '기타';

                    const readOnlyFields = [
                      { label: '상담일', value: consultation.consultation_date || '-' },
                      { label: '유형', value: typeLabel },
                      { label: '내용', value: consultation.content || '-', colSpan: 2 },
                      ...(consultation.ai_summary ? [{ label: 'AI 요약', value: consultation.ai_summary, colSpan: 2 as const }] : []),
                    ] as Array<{ label: string; value: string; colSpan?: 2 }>;

                    return (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                          gap: 'var(--spacing-md)',
                        }}
                      >
                        {readOnlyFields.map((field, idx) => (
                          <div
                            key={idx}
                            style={{
                              // 모바일 기본보기: 1열이므로 colSpan 2도 span 1로 강제
                              gridColumn: field.colSpan === 2 ? (isMobile ? 'span 1' : 'span 2') : undefined,
                              display: 'flex',
                              width: '100%',
                              alignItems: (field.label === '내용' || field.label === 'AI 요약') ? 'flex-start' : 'center',
                              paddingTop: 'var(--spacing-sm)',
                              paddingBottom: 'var(--spacing-sm)',
                              paddingLeft: 'var(--spacing-form-horizontal-left)',
                              paddingRight: 'var(--spacing-form-horizontal-right)',
                              // 요구사항: 기본보기 밑줄은 원래 연한 색상으로 복구
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
                                whiteSpace: 'nowrap',
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
                                whiteSpace: (field.label === '내용' || field.label === 'AI 요약') ? 'pre-wrap' : 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {field.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {/* 요구사항: 기본보기 > 삭제/수정 버튼 텍스트 제거, IconButtonGroup 스타일(아이콘만) + 우측 정렬 */}
                  {isEditable && (
                    <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
                      <IconButtonGroup
                        align="right"
                        items={[
                          {
                            icon: Trash2,
                            tooltip: '삭제',
                            variant: 'outline',
                            color: 'error',
                            onClick: () => onDelete(consultation.id),
                          },
                          {
                            icon: MessageSquare,
                            tooltip: consultation.ai_summary ? 'AI 재요약' : 'AI 요약',
                            variant: 'outline',
                            onClick: () => onGenerateAISummary(consultation.id),
                          },
                          {
                            icon: Pencil,
                            tooltip: '수정',
                            variant: 'outline',
                            onClick: () => onEdit(consultation.id),
                          },
                        ]}
                      />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card padding="md" variant="default" style={layerSectionCardStyle}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'calc(var(--spacing-xl) * 5)', // [불변 규칙] CSS 변수 사용
                padding: 'var(--spacing-xl)',
              }}>
                <FileText
                  size={emptyStateIconSize}
                  strokeWidth={emptyStateIconStrokeWidth}
                  style={{
                    color: 'var(--color-gray-300)',
                    marginBottom: 'var(--spacing-xs)',
                    display: 'inline-block',
                  }}
                />
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>등록된 상담일지가 없습니다.</p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// 태그 탭 컴포넌트
interface TagsTabProps {
  studentTags: Array<{ id: string; name: string; color: string }>;
  isLoading: boolean;
  studentId: string;
  onUpdateTags: (tagIds: string[]) => Promise<void>;
  isEditable?: boolean;
  tagFormSchema: FormSchema;
}

function TagsTab({ studentTags, isLoading, studentId, onUpdateTags, isEditable = true, tagFormSchema }: TagsTabProps) {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const { data: allTags, isLoading: allTagsLoading, refetch: refetchTags } = useStudentTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempSelectedTagIds, setTempSelectedTagIds] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { showAlert } = useModal();

  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  const baseIconSize = useIconSize();
  const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  const emptyStateIconStrokeWidth = useIconStrokeWidth();

  const createTag = useMutation({
    mutationFn: async (data: { name: string }) => {
      // 인더스트리 테마 색상 가져오기
      // [불변 규칙] 하드코딩 금지: CSS 변수만 사용
      // getComputedStyle로 CSS 변수 값을 가져오고, 없으면 CSS 변수 문자열 자체를 사용
      let primaryColor = 'var(--color-primary)';
      if (typeof window !== 'undefined') {
        const computedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
        if (computedColor) {
          primaryColor = computedColor;
        }
      }

      // 쉼표만 구분자로 사용하고, 각 태그 이름에서 띄어쓰기 제거
      const tagNames = data.name
        .split(',')
        .map((name) => name.trim().replace(/\s+/g, ''))
        .filter((name) => name.length > 0);

      if (tagNames.length === 0) {
        throw new Error('태그 이름을 입력해주세요.');
      }

      const createdTags: Tag[] = [];
      const errors: string[] = [];

      // 기존 태그 목록에서 같은 이름의 태그 찾기
      const existingTags = allTags || [];
      const existingTagsMap = new Map<string, { id: string; name: string; color: string }>();
      existingTags.forEach((tag) => {
        existingTagsMap.set(tag.name.toLowerCase(), tag);
      });

      // 여러 태그 생성 및 개별회원 전용 태그로 할당
      for (const tagName of tagNames) {
        try {
          let tagId: string | undefined;

          // 기존 태그가 있는지 확인
          const existingTag = existingTagsMap.get(tagName.toLowerCase());
          if (existingTag) {
            // 기존 태그 사용
            tagId = existingTag.id;
          } else {
            // 새 태그 생성
            const tagResponse = await apiClient.post<Tag>('tags', {
              name: tagName,
              color: primaryColor,
              entity_type: 'student',
            });

            if (tagResponse.error || !tagResponse.data) {
              // 중복 키 오류인 경우 기존 태그를 다시 찾아보기
              if (tagResponse.error?.message?.includes('duplicate key')) {
                // 태그 목록을 다시 불러와서 확인
                const refetchResponse = await refetchTags();
                const refetchedTags = refetchResponse.data || [];
                const foundTag = refetchedTags.find(
                  (t) => t.name.toLowerCase() === tagName.toLowerCase()
                );
                if (foundTag) {
                  tagId = foundTag.id;
                } else {
                  errors.push(`${tagName}: ${tagResponse.error?.message || '태그 생성 실패'}`);
                  continue;
                }
              } else {
                errors.push(`${tagName}: ${tagResponse.error?.message || '태그 생성 실패'}`);
                continue;
              }
            } else {
              tagId = tagResponse.data.id;
              createdTags.push(tagResponse.data);
            }
          }

          if (!tagId) {
            errors.push(`${tagName}: 태그를 찾을 수 없습니다.`);
            continue;
          }

          // 기존 태그를 사용한 경우에도 createdTags에 추가 (할당 목적)
          if (existingTag) {
            // Tag 타입으로 변환 (필요한 필드만 포함)
            createdTags.push({
              id: existingTag.id,
              name: existingTag.name,
              color: existingTag.color,
            } as Tag);
          }

          // 개별회원 전용 태그로 할당 (즉시 해당 학생에게 할당)
          // 이미 할당되어 있는지 확인하지 않고 할당 시도 (중복은 서버에서 처리)
          const assignmentResponse = await apiClient.post('tag_assignments', {
            entity_id: studentId,
            entity_type: 'student',
            tag_id: tagId,
          });

          if (assignmentResponse.error) {
            // 중복 할당 오류는 무시 (이미 할당된 경우)
            if (!assignmentResponse.error.message?.includes('duplicate')) {
              errors.push(`${tagName} 할당 실패: ${assignmentResponse.error.message}`);
            }
          }
        } catch (error) {
          errors.push(`${tagName}: ${error instanceof Error ? error.message : '태그 생성 실패'}`);
        }
      }

      if (createdTags.length === 0) {
        throw new Error(errors.length > 0 ? errors.join(', ') : '태그 생성에 실패했습니다.');
      }

      if (errors.length > 0) {
        showAlert(
          `${createdTags.length}개 태그 생성 완료, ${errors.length}개 실패: ${errors.join(', ')}`,
          '부분 성공',
          'warning'
        );
      }

      return createdTags;
    },
    onSuccess: (createdTags) => {
      queryClient.invalidateQueries({ queryKey: ['tags', tenantId, 'student'] });
      queryClient.invalidateQueries({ queryKey: ['student-tags', tenantId, studentId] });
      refetchTags();
      setShowForm(false);

      // 생성된 태그를 선택된 태그 목록에 추가하여 #태그명 스타일로 표시
      if (createdTags.length > 0) {
        const newTagIds = createdTags.map((tag) => tag.id);
        setSelectedTagIds((prev) => [...prev, ...newTagIds]);
        showAlert(`${createdTags.length}개 태그가 생성되고 할당되었습니다.`, '성공', 'success');
      }
    },
    onError: (error: Error) => {
      showAlert(error.message || '태그 생성에 실패했습니다.', '오류', 'error');
    },
  });

  useEffect(() => {
    if (studentTags) {
      setSelectedTagIds(studentTags.map((tag) => tag.id));
    }
  }, [studentTags]);

  // 수정 모드 진입 시 임시 선택 상태 초기화
  useEffect(() => {
    if (isEditMode) {
      setTempSelectedTagIds([...selectedTagIds]);
    }
  }, [isEditMode, selectedTagIds]);

  const handleTagToggle = async (tagId: string) => {
    // 수정 모드가 아닐 때만 즉시 저장
    if (!isEditMode) {
      const newIds = selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId];

      setSelectedTagIds(newIds);

      // 즉시 저장
      try {
        await onUpdateTags(newIds);
      } catch (error) {
        // 실패 시 이전 상태로 복원
        setSelectedTagIds(selectedTagIds);
        showAlert(error instanceof Error ? error.message : '태그 저장에 실패했습니다.', '오류', 'error');
      }
    } else {
      // 수정 모드에서는 임시 상태만 변경
      setTempSelectedTagIds((prev) => {
        return prev.includes(tagId)
          ? prev.filter((id) => id !== tagId)
          : [...prev, tagId];
      });
    }
  };

  const handleSaveTags = async () => {
    try {
      // 해제된 태그 ID 찾기 (이전에 선택되었지만 현재 선택되지 않은 태그)
      const removedTagIds = selectedTagIds.filter((id) => !tempSelectedTagIds.includes(id));

      // 해제된 태그 삭제
      const deleteErrors: string[] = [];
      for (const tagId of removedTagIds) {
        try {
          const deleteResponse = await apiClient.delete('tags', tagId);
          if (deleteResponse.error) {
            const tag = allTags?.find((t) => t.id === tagId);
            deleteErrors.push(tag ? `${tag.name}: ${deleteResponse.error.message}` : `태그 삭제 실패: ${deleteResponse.error.message}`);
          }
        } catch (error) {
          const tag = allTags?.find((t) => t.id === tagId);
          deleteErrors.push(tag ? `${tag.name}: ${error instanceof Error ? error.message : '태그 삭제 실패'}` : `태그 삭제 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
      }

      // 태그 할당 업데이트
      await onUpdateTags(tempSelectedTagIds);
      setSelectedTagIds(tempSelectedTagIds);
      setIsEditMode(false);
      setShowForm(false);

      // 태그 목록 새로고침
      queryClient.invalidateQueries({ queryKey: ['tags', tenantId, 'student'] });
      refetchTags();

      if (deleteErrors.length > 0) {
        showAlert(
          `태그 저장 완료. 일부 태그 삭제 실패: ${deleteErrors.join(', ')}`,
          '부분 성공',
          'warning'
        );
      } else {
        showAlert('태그가 저장되었습니다.', '성공', 'success');
      }
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '태그 저장에 실패했습니다.', '오류', 'error');
    }
  };

  // hex 색상을 rgba로 변환하여 opacity 적용
  const hexToRgba = (hex: string, opacity: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // [타입 안정성] any 타입 제거, 명시적 타입 체크
  const handleCreateTag = async (data: Record<string, unknown>) => {
    if (typeof data.name !== 'string' || !data.name.trim()) {
      throw new Error('태그 이름은 필수입니다.');
    }
    await createTag.mutateAsync({
      name: data.name,
    });
  };

  // [코드 중복 제거] processTagInput 함수는 파일 상단에 공통으로 정의됨

  // 태그 등록 폼의 form 인스턴스 참조
  const tagFormRef = React.useRef<UseFormReturn<Record<string, unknown>> | null>(null);

  if (isLoading || allTagsLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div style={{ paddingBottom: isMobile ? 'var(--spacing-bottom-action-bar)' : 'var(--spacing-none)' }}>

      {showForm && (
        <>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <TagIcon size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                {isEditMode ? '태그수정' : '태그추가'}
              </span>
            }
          />
          {isEditMode ? (
            // 수정 모드: 태그 선택/해제 UI
            <>
              {isMobile || isTablet ? (
                <Drawer
                  isOpen={showForm}
                  onClose={() => {
                    setShowForm(false);
                    setIsEditMode(false);
                    setTempSelectedTagIds([]);
                  }}
                  title="태그수정"
                  position={isMobile ? 'bottom' : 'right'}
                  width={isTablet ? 'var(--width-drawer-tablet)' : 'var(--width-full)'}
                >
                  <div style={{ padding: 'var(--spacing-md)' }}>
                    <Card
                      padding="md"
                      variant="default"
                      title="태그 선택"
                      titleIcon={<TagIcon size={titleIconSize} strokeWidth={titleIconStrokeWidth} />}
                      titlePosition="top-left"
                    >
                      {allTags && allTags.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', paddingTop: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                          {allTags.map((tag) => {
                            const isSelected = tempSelectedTagIds.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                onClick={() => handleTagToggle(tag.id)}
                                style={{
                                  padding: 'var(--spacing-sm) var(--spacing-md)',
                                  fontSize: 'var(--font-size-sm)',
                                  fontWeight: 'var(--font-weight-medium)',
                                  fontFamily: 'var(--font-family)',
                                  lineHeight: 'var(--line-height)',
                                  // 요구사항: 카드 라운드 한 단계 축소 (xl -> lg)
                                  // 요구사항: 태그배지 라운드 한 단계 증가 (lg -> xl)
                                  borderRadius: 'var(--border-radius-xl)',
                                  border: `var(--border-width-thin) solid ${isSelected ? tag.color : 'var(--color-gray-300)'}`,
                                  color: isSelected ? tag.color : 'var(--color-text-secondary)',
                                  backgroundColor: isSelected ? hexToRgba(tag.color, 0.1) : 'transparent',
                                  cursor: 'pointer',
                                  transition: 'var(--transition-all)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {tag.name}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p style={{ color: 'var(--color-text-secondary)' }}>등록된 태그가 없습니다.</p>
                      )}
                      {/* 요구사항: 태그수정 > 취소/저장 버튼은 학생관리 수정폼처럼 텍스트+아이콘 함께 출력 */}
                      <ActionButtonGroup
                        marginTop="xl"
                        gap="sm"
                        iconVariant="small"
                        items={[
                          {
                            key: 'tags-edit-cancel',
                            label: '취소',
                            icon: <XIcon />,
                            variant: 'outline',
                            onClick: () => {
                              setShowForm(false);
                              setIsEditMode(false);
                              setTempSelectedTagIds([]);
                            },
                          },
                          {
                            key: 'tags-edit-save',
                            label: '저장',
                            icon: <Save />,
                            variant: 'solid',
                            color: 'primary',
                            onClick: handleSaveTags,
                          },
                        ]}
                      />
                    </Card>
                  </div>
                </Drawer>
              ) : (
                <Card padding="md" variant="default" style={layerSectionCardStyle}>
                  {allTags && allTags.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', paddingTop: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                      {allTags.map((tag) => {
                        const isSelected = tempSelectedTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => handleTagToggle(tag.id)}
                            style={{
                              padding: 'var(--spacing-sm) var(--spacing-md)',
                              fontSize: 'var(--font-size-sm)',
                              fontWeight: 'var(--font-weight-medium)',
                              fontFamily: 'var(--font-family)',
                              lineHeight: 'var(--line-height)',
                              // 요구사항: 카드 라운드 한 단계 축소 (xl -> lg)
                              // 요구사항: 태그배지 라운드 한 단계 증가 (lg -> xl)
                              borderRadius: 'var(--border-radius-xl)',
                              border: `var(--border-width-thin) solid ${isSelected ? tag.color : 'var(--color-gray-300)'}`,
                              color: isSelected ? tag.color : 'var(--color-text-secondary)',
                              backgroundColor: isSelected ? hexToRgba(tag.color, 0.1) : 'transparent',
                              cursor: 'pointer',
                              transition: 'var(--transition-all)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--color-text-secondary)' }}>등록된 태그가 없습니다.</p>
                  )}
                  {/* 요구사항: 태그수정 > 취소/저장 버튼은 학생관리 수정폼처럼 텍스트+아이콘 함께 출력 */}
                  <ActionButtonGroup
                    marginTop="xl"
                    gap="sm"
                    iconVariant="small"
                    items={[
                      {
                        key: 'tags-edit-cancel',
                        label: '취소',
                        icon: <XIcon />,
                        variant: 'outline',
                        onClick: () => {
                          setShowForm(false);
                          setIsEditMode(false);
                          setTempSelectedTagIds([]);
                        },
                      },
                      {
                        key: 'tags-edit-save',
                        label: '저장',
                        icon: <Save />,
                        variant: 'solid',
                        color: 'primary',
                        onClick: handleSaveTags,
                      },
                    ]}
                  />
                </Card>
              )}
            </>
          ) : (
            // 등록 모드: 태그 생성 폼
            <SchemaFormWithMethods
              schema={tagFormSchema}
              onSubmit={handleCreateTag}
              onCancel={() => {
                setShowForm(false);
                if (tagFormRef.current) {
                  tagFormRef.current.reset();
                }
              }}
              cardTitle={undefined}
              disableCardPadding={false}
              cancelLabel="취소"
              formRef={tagFormRef}
            />
          )}
        </>
      )}

      {!showForm && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <TagIcon size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                태그관리
              </span>
            }
            right={
              isEditable ? (
                <IconButtonGroup
                  items={[
                    {
                      icon: PlusIcon,
                      tooltip: '태그추가',
                      variant: 'solid',
                      color: 'primary',
                      onClick: () => setShowForm(true),
                    },
                  ]}
                  align="right"
                />
              ) : null
            }
          />
          <Card padding="md" variant="default" style={layerSectionCardStyle}>
        {selectedTagIds.length > 0 && allTags ? (
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', paddingTop: 'var(--spacing-sm)' }}>
              {allTags
                .filter((tag) => selectedTagIds.includes(tag.id))
                .map((tag) => (
                  <div
                    key={tag.id}
                    style={{
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-medium)',
                      fontFamily: 'var(--font-family)',
                      lineHeight: 'var(--line-height)',
                      // 요구사항: 카드 라운드 한 단계 축소 (xl -> lg)
                      // 요구사항: 태그배지 라운드 한 단계 증가 (lg -> xl)
                      borderRadius: 'var(--border-radius-xl)',
                      border: `var(--border-width-thin) solid ${tag.color}`,
                      color: tag.color,
                      backgroundColor: hexToRgba(tag.color, 0.1),
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tag.name}
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(var(--spacing-xl) * 5)', // [불변 규칙] CSS 변수 사용 (spacing-xl = 2rem, 5배 = 10rem ≈ 160px)
            padding: 'var(--spacing-xl)',
          }}>
            <TagIcon
              size={emptyStateIconSize}
              strokeWidth={emptyStateIconStrokeWidth}
              style={{
                color: 'var(--color-gray-300)',
                marginBottom: 'var(--spacing-xs)',
                display: 'inline-block',
              }}
            />
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>등록된 태그가 없습니다.</p>
          </div>
        )}

        {/* 요구사항: 페이지별 카드 헤더 우측 수정 버튼 제거 → 카드 하단 우측 수정 버튼 */}
        {isEditable && allTags && allTags.length > 0 && (
          <div style={{ width: '100%', paddingTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
            <IconButtonGroup
              align="right"
              items={[
                {
                  icon: Pencil,
                  tooltip: '수정',
                  variant: 'outline',
                  onClick: () => {
                    setIsEditMode(true);
                    setShowForm(true);
                  },
                },
              ]}
            />
          </div>
        )}

          </Card>
        </div>
      )}
    </div>
  );
}

// 반 배정 탭 컴포넌트
interface ClassesTabProps {
  studentClasses: Array<{
    id: string;
    class_id: string;
    enrolled_at: string;
    left_at?: string;
    is_active: boolean;
    class: Class | null;
  }>;
  isLoading: boolean;
  allClasses: Class[];
  effectiveClassAssignmentFormSchema: FormSchema;
  onAssign: (classId: string, enrolledAt?: string) => Promise<void>;
  onUnassign: (classId: string, leftAt?: string) => Promise<void>;
  isEditable?: boolean;
}

function ClassesTab({
  studentClasses,
  isLoading,
  allClasses,
  effectiveClassAssignmentFormSchema,
  onAssign,
  onUnassign,
  isEditable = true,
}: ClassesTabProps) {
  const { showAlert, showConfirm } = useModal();
  useResponsiveMode(); // 반응형 훅 호출은 유지(기존 패턴 일관성), 현재 로직에서는 값 미사용
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [classNameFilter, setClassNameFilter] = useState<string>('all');

  // 타이틀 아이콘 크기 및 선 두께 계산 (CSS 변수 사용)
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  const baseIconSize = useIconSize();
  const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  const emptyStateIconStrokeWidth = useIconStrokeWidth();

  const assignedClassIds = studentClasses
    .filter((sc) => sc.is_active)
    .map((sc) => sc.class_id);

  const availableClasses = allClasses.filter(
    (c) => c.status === 'active' && !assignedClassIds.includes(c.id)
  );

  const DAYS_OF_WEEK: { value: string; label: string }[] = [
    { value: 'monday', label: '월요일' },
    { value: 'tuesday', label: '화요일' },
    { value: 'wednesday', label: '수요일' },
    { value: 'thursday', label: '목요일' },
    { value: 'friday', label: '금요일' },
    { value: 'saturday', label: '토요일' },
    { value: 'sunday', label: '일요일' },
  ];

  const handleAssign = async (data: Record<string, unknown>) => {
    if (!data.class_id) return;

    try {
      await onAssign(String(data.class_id ?? ''), String(data.enrolled_at || toKST().format('YYYY-MM-DD')));
      setShowAssignForm(false);
    } catch (error) {
      showAlert('반 배정에 실패했습니다.', '오류', 'error');
    }
  };

  const handleUnassign = async (classId: string) => {
    const confirmed = await showConfirm('정말 이 반에서 제외하시겠습니까?', '반 제외');
    if (!confirmed) return;

    try {
      await onUnassign(classId, toKST().format('YYYY-MM-DD'));
    } catch (error) {
      showAlert('반 제외에 실패했습니다.', '오류', 'error');
    }
  };

  // 반 이름 옵션 생성 (중복 제거)
  const classOptions = useMemo(() => {
    const uniqueClasses = new Map<string, { id: string; name: string }>();
    studentClasses.forEach((sc) => {
      if (sc.class && !uniqueClasses.has(sc.class.id)) {
        uniqueClasses.set(sc.class.id, { id: sc.class.id, name: sc.class.name });
      }
    });
    return Array.from(uniqueClasses.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [studentClasses]);

  // 필터링된 반 목록
  const filteredStudentClasses = useMemo(() => {
    if (classNameFilter === 'all') {
      return studentClasses;
    }
    return studentClasses.filter((sc) => sc.class && sc.class.id === classNameFilter);
  }, [studentClasses, classNameFilter]);

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div>
      {showAssignForm && (
        <div>
          <SchemaForm
            schema={{
              ...effectiveClassAssignmentFormSchema,
              form: {
                ...effectiveClassAssignmentFormSchema.form,
                fields: [
                  {
                    ...effectiveClassAssignmentFormSchema.form.fields[0],
                    options: [
                      { label: '반을 선택하세요', value: '' },
                      ...availableClasses.map((classItem) => {
                        const dayLabel = DAYS_OF_WEEK.find((d) => d.value === classItem.day_of_week)?.label || classItem.day_of_week;
                        return {
                          label: `${classItem.name} (${dayLabel} ${classItem.start_time}~${classItem.end_time})`,
                          value: classItem.id,
                        };
                      }),
                    ],
                  },
                  effectiveClassAssignmentFormSchema.form.fields[1],
                ],
              },
            }}
            onSubmit={handleAssign}
            defaultValues={{
              enrolled_at: toKST().format('YYYY-MM-DD'),
            }}
            disableCardPadding={false}
            cardTitle={undefined}
            onCancel={() => setShowAssignForm(false)}
          />
        </div>
      )}

      {!showAssignForm && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <BookOpen size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                반 배정
              </span>
            }
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <BadgeSelect
                  value={classNameFilter}
                  onChange={(value) => setClassNameFilter(value as string)}
                  options={[
                    { value: 'all', label: '전체' },
                    ...classOptions.map((classItem) => ({
                      value: classItem.id,
                      label: classItem.name,
                    })),
                  ]}
                  size="sm"
                  selectedColor="var(--color-text)"
                  unselectedColor="var(--color-text)"
                />
                {isEditable && (
                  <IconButtonGroup
                    items={[
                      {
                        icon: PlusIcon,
                        tooltip: '반 배정',
                        variant: 'solid',
                        color: 'primary',
                        onClick: () => setShowAssignForm(true),
                        disabled: availableClasses.length === 0,
                      },
                    ]}
                    align="right"
                  />
                )}
              </div>
            }
          />
          <Card padding="md" variant="default" style={layerSectionCardStyle}>
        {filteredStudentClasses.filter((sc) => sc.class).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {filteredStudentClasses
              .filter((sc) => sc.class)
              .map((studentClass) => {
                const classItem = studentClass.class!;
                const dayLabel = DAYS_OF_WEEK.find((d) => d.value === classItem.day_of_week)?.label || classItem.day_of_week;

                return (
                  <Card key={studentClass.id} padding="md" variant="default" style={{ borderLeft: `var(--border-width-thick) solid ${classItem.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                          {classItem.name}
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', color: 'var(--color-text-secondary)' }}>
                          {classItem.subject && <div>과목: {classItem.subject}</div>}
                          {classItem.grade && <div>대상: {classItem.grade}</div>}
                          <div>요일: {dayLabel}</div>
                          <div>시간: {classItem.start_time} ~ {classItem.end_time}</div>
                          {classItem.room && <div>강의실: {classItem.room}</div>}
                          <div>배정일: {studentClass.enrolled_at}</div>
                        </div>
                      </div>
                      {isEditable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnassign(classItem.id)}
                        >
                          제외
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(var(--spacing-xl) * 5)', // [불변 규칙] CSS 변수 사용 (spacing-xl = 2rem, 5배 = 10rem ≈ 160px)
            padding: 'var(--spacing-xl)',
          }}>
            <BookOpen
              size={emptyStateIconSize}
              strokeWidth={emptyStateIconStrokeWidth}
              style={{
                color: 'var(--color-gray-300)',
                marginBottom: 'var(--spacing-xs)',
                display: 'inline-block',
              }}
            />
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              {studentClasses.filter((sc) => sc.class).length === 0
                ? '배정된 반이 없습니다.'
                : '필터 조건에 맞는 반이 없습니다.'}
            </p>
          </div>
        )}
        {/* 요구사항: 페이지별 카드 헤더 우측 수정 버튼 제거 → 카드 하단 우측 수정 버튼 */}
        {isEditable && studentClasses.filter((sc) => sc.class).length > 0 && (
          <div style={{ width: '100%', paddingTop: 'var(--spacing-md)' }}>
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={() => showAlert('반 배정 수정 기능은 준비 중입니다.', '알림', 'info')}
            >
              수정
            </Button>
          </div>
        )}
        </Card>
        </div>
      )}
    </div>
  );
}

// 출결 관리 탭 컴포넌트
function AttendanceTab({
  studentId,
  student,
  isEditable,
}: {
  studentId: string | null;
  student: Student | null | undefined;
  isEditable: boolean;
}) {
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'all' | 'present' | 'late' | 'absent' | 'excused'>('all');
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  const baseIconSize = useIconSize();
  const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  const emptyStateIconStrokeWidth = useIconStrokeWidth();

  const thirtyDaysAgo = useMemo(() => {
    return toKST().subtract(30, 'day').format('YYYY-MM-DD');
  }, []);

  const { data: attendanceLogsData, isLoading } = useAttendanceLogs({
    student_id: studentId || undefined,
    date_from: thirtyDaysAgo,
  });
  const attendanceLogs = useMemo(() => attendanceLogsData ?? [], [attendanceLogsData]);

  const stats = useMemo(() => {
    if (attendanceLogs.length === 0) return null;

    const present = attendanceLogs.filter(log => log.status === 'present').length;
    const late = attendanceLogs.filter(log => log.status === 'late').length;
    const absent = attendanceLogs.filter(log => log.status === 'absent').length;
    const total = attendanceLogs.length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      total,
      present,
      late,
      absent,
      attendanceRate,
    };
  }, [attendanceLogs]);

  // 필터링된 출결 내역
  const filteredAttendanceLogs = useMemo(() => {
    if (attendanceStatusFilter === 'all') {
      return attendanceLogs;
    }
    return attendanceLogs.filter((log) => log.status === attendanceStatusFilter);
  }, [attendanceLogs, attendanceStatusFilter]);

  if (!studentId || !student) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          학생 정보를 불러올 수 없습니다.
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {/* 출결 통계 */}
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Calendar size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                출결통계
              </span>
            }
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <BadgeSelect
                  value={attendanceStatusFilter}
                  onChange={(value) => setAttendanceStatusFilter(value as typeof attendanceStatusFilter)}
                  options={[
                    { value: 'all', label: '전체' },
                    { value: 'present', label: '출석' },
                    { value: 'late', label: '지각' },
                    { value: 'absent', label: '결석' },
                    { value: 'excused', label: '사유' },
                  ]}
                  size="sm"
                  selectedColor="var(--color-text)"
                  unselectedColor="var(--color-text)"
                />
                {isEditable && (
                  <IconButtonGroup
                    items={[
                      {
                        icon: PlusIcon,
                        tooltip: '출결기록 추가',
                        variant: 'solid',
                        color: 'primary',
                        onClick: () => {
                          showAlert('출결 기록 추가 기능은 준비 중입니다.', '알림', 'info');
                        },
                      },
                    ]}
                    align="right"
                  />
                )}
              </div>
            }
          />
          <Card padding="md" variant="default" style={layerSectionCardStyle}>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                출결 정보를 불러오는 중...
              </div>
            ) : stats ? (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(var(--width-button-grid-min), 1fr))`, gap: 'var(--spacing-md)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                    총 출결
                  </div>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
                    {stats.total}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                    출석
                  </div>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
                    {stats.present}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                    지각
                  </div>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning)' }}>
                    {stats.late}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                    결석
                  </div>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-error)' }}>
                    {stats.absent}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                    출석률
                  </div>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
                    {stats.attendanceRate}%
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'calc(var(--spacing-xl) * 5)',
                padding: 'var(--spacing-xl)',
              }}>
                <Calendar
                  size={emptyStateIconSize}
                  strokeWidth={emptyStateIconStrokeWidth}
                  style={{
                    color: 'var(--color-gray-300)',
                    marginBottom: 'var(--spacing-xs)',
                    display: 'inline-block',
                  }}
                />
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  출결 데이터가 없습니다.
                </p>
              </div>
            )}

            {isEditable && filteredAttendanceLogs.length > 0 && (
              <div style={{ width: '100%', paddingTop: 'var(--spacing-md)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={() => showAlert('출결 기록 수정 기능은 준비 중입니다.', '알림', 'info')}
                >
                  수정
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* 최근 출결 내역 */}
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Calendar size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                최근 출결내역
              </span>
            }
          />
          <Card padding="md" variant="default" style={layerSectionCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/attendance?student_id=${student.id}`)}
              >
                전체 출결 보기
              </Button>
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                출결 정보를 불러오는 중...
              </div>
            ) : filteredAttendanceLogs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {filteredAttendanceLogs.slice(0, 10).map((log) => {
                  const statusColor = log.status === 'present' ? 'success' : log.status === 'late' ? 'warning' : 'error';
                  const statusLabel = log.status === 'present' ? '출석' : log.status === 'late' ? '지각' : log.status === 'absent' ? '결석' : '사유';
                  const typeLabel = log.attendance_type === 'check_in' ? '등원' : log.attendance_type === 'check_out' ? '하원' : log.attendance_type;

                  return (
                    <Card key={log.id} padding="sm" variant="outlined">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                            <Badge variant="soft" color={statusColor}>
                              {statusLabel}
                            </Badge>
                            <span style={{ color: 'var(--color-text-secondary)' }}>
                              {typeLabel}
                            </span>
                          </div>
                          <div style={{ color: 'var(--color-text-secondary)' }}>
                            {toKST(log.occurred_at).format('YYYY-MM-DD HH:mm')}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'calc(var(--spacing-xl) * 5)',
                padding: 'var(--spacing-xl)',
              }}>
                <Calendar
                  size={emptyStateIconSize}
                  strokeWidth={emptyStateIconStrokeWidth}
                  style={{
                    color: 'var(--color-gray-300)',
                    marginBottom: 'var(--spacing-xs)',
                    display: 'inline-block',
                  }}
                />
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  {attendanceLogs.length === 0
                    ? '최근 출결 내역이 없습니다.'
                    : '필터 조건에 맞는 출결 내역이 없습니다.'}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// 이탈 위험 분석 탭 컴포넌트
function RiskAnalysisTab({
  studentId,
  isEditable,
}: {
  studentId: string | null;
  isEditable: boolean;
}) {
  const { showAlert } = useModal();
  const context = getApiContext();
  const tenantId = context.tenantId;

  // 훅은 항상 컴포넌트 최상단에서 호출되어야 함 (React Hooks 규칙)
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  const baseIconSize = useIconSize();
  const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  const emptyStateIconStrokeWidth = useIconStrokeWidth();

  const thirtyDaysAgo = React.useMemo(() => {
    return toKST().subtract(30, 'day').format('YYYY-MM-DD');
  }, []);

  const { data: attendanceLogsData } = useAttendanceLogs({
    student_id: studentId || undefined,
    date_from: thirtyDaysAgo,
  });
  const attendanceLogs = useMemo(() => attendanceLogsData ?? [], [attendanceLogsData]);

  const { data: consultations } = useConsultations(studentId);

  const { data: riskAnalysis, isLoading } = useQuery({
    queryKey: ['student-risk-analysis', tenantId, studentId],
    queryFn: async () => {
      if (!tenantId || !studentId) return null;

      const recentAbsences = attendanceLogs.filter((log: AttendanceLog) =>
        log.status === 'absent' || log.status === 'late'
      ).length;

      const absenceRate = attendanceLogs.length > 0
        ? (recentAbsences / attendanceLogs.length) * 100
        : 0;

      let riskScore = 0;
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      const reasons: string[] = [];

      if (absenceRate > 30) {
        riskScore += 40;
        riskLevel = 'high';
        reasons.push('최근 30일간 결석/지각률이 30% 이상입니다.');
      } else if (absenceRate > 20) {
        riskScore += 25;
        riskLevel = 'medium';
        reasons.push('최근 30일간 결석/지각률이 20% 이상입니다.');
      }

      if (consultations && consultations.length === 0) {
        riskScore += 15;
        if (riskLevel === 'low') riskLevel = 'medium';
        reasons.push('상담일지가 없어 학생 상태 파악이 어렵습니다.');
      }

      return {
        risk_score: Math.min(riskScore, 100),
        risk_level: riskLevel,
        reasons,
        recommended_actions: [
          '학부모와 상담 일정을 잡아주세요.',
          '출결 패턴을 면밀히 관찰하세요.',
          '학생의 학습 동기를 파악하세요.',
        ],
      };
    },
    enabled: !!tenantId && !!studentId,
  });

  if (isLoading) {
    return (
      <div>
        <LayerSectionHeader
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <AlertTriangle size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
              이탈 위험 분석
            </span>
          }
        />
        <Card padding="md" variant="default" style={layerSectionCardStyle}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            분석 중...
          </div>
        </Card>
      </div>
    );
  }

  if (!riskAnalysis) {
    return (
      <div>
        <LayerSectionHeader
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <AlertTriangle size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
              이탈 위험 분석
            </span>
          }
        />
        <Card padding="md" variant="default" style={layerSectionCardStyle}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(var(--spacing-xl) * 5)', // [불변 규칙] CSS 변수 사용
            padding: 'var(--spacing-xl)',
          }}>
            <AlertTriangle
              size={emptyStateIconSize}
              strokeWidth={emptyStateIconStrokeWidth}
              style={{
                color: 'var(--color-gray-300)',
                marginBottom: 'var(--spacing-xs)',
                display: 'inline-block',
              }}
            />
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              분석 데이터가 없습니다.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const riskColor = riskAnalysis.risk_level === 'high' ? 'error' : riskAnalysis.risk_level === 'medium' ? 'warning' : 'success';

  return (
    <div>
      <LayerSectionHeader
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <AlertTriangle size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
            이탈 위험 분석
          </span>
        }
      />
      <Card padding="md" variant="default" style={layerSectionCardStyle}>

      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
            위험 점수: {riskAnalysis.risk_score}점
          </div>
          <Badge variant="solid" color={riskColor}>
            {riskAnalysis.risk_level === 'high' ? '높음' : riskAnalysis.risk_level === 'medium' ? '보통' : '낮음'}
          </Badge>
        </div>
      </div>

      {riskAnalysis.reasons.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
            위험 요인
          </h4>
          <ul style={{ paddingLeft: 'var(--spacing-md)', margin: 'var(--spacing-none)' }}>
            {riskAnalysis.reasons.map((reason, idx) => (
              <li key={idx} style={{ marginBottom: 'var(--spacing-xs)', color: 'var(--color-text-secondary)' }}>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {riskAnalysis.recommended_actions.length > 0 && (
        <div>
          <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
            권장 조치
          </h4>
          <ul style={{ paddingLeft: 'var(--spacing-md)', margin: 'var(--spacing-none)' }}>
            {riskAnalysis.recommended_actions.map((action, idx) => (
              <li key={idx} style={{ marginBottom: 'var(--spacing-xs)', color: 'var(--color-text-secondary)' }}>
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* 요구사항: 페이지별 카드 헤더 우측 수정 버튼 제거 → 카드 하단 우측 수정 버튼 */}
      {riskAnalysis && isEditable && (
        <div style={{ width: '100%', paddingTop: 'var(--spacing-md)' }}>
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={() => showAlert('이탈 위험 분석은 자동으로 업데이트됩니다.', '알림', 'info')}
          >
            수정
          </Button>
        </div>
      )}
      </Card>
    </div>
  );
}

// 환영 메시지 탭 컴포넌트
function WelcomeTab({
  studentId,
  student,
  isEditable,
}: {
  studentId: string | null;
  student: Student | null | undefined;
  isEditable: boolean;
}) {
  const { showAlert } = useModal();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  const { data: welcomeMessageSent } = useQuery({
    queryKey: ['welcome-message-sent', tenantId, studentId],
    queryFn: async () => {
      if (!tenantId || !studentId) return false;

      const response = await apiClient.get<StudentTaskCard[]>('student_task_cards', {
        filters: {
          student_id: studentId,
          task_type: 'new_signup',
        },
        limit: 1,
      });

      if (response.error || !response.data || response.data.length === 0) {
        return false;
      }

      const card = response.data[0];
      return (card as { welcome_message_sent?: boolean }).welcome_message_sent || false;
    },
    enabled: !!tenantId && !!studentId,
  });

  const sendWelcomeMessage = useMutation({
    mutationFn: async () => {
      if (!tenantId || !studentId || !student) {
        throw new Error('학생 정보가 없습니다.');
      }

      const guardiansResponse = await apiClient.get<Guardian[]>('guardians', {
        filters: { student_id: studentId, is_primary: true },
        limit: 1,
      });

      // [타입 안정성] 에러 및 데이터 존재 여부 체크
      if (guardiansResponse.error || !guardiansResponse.data || guardiansResponse.data.length === 0) {
        throw new Error('주 보호자 정보를 찾을 수 없습니다.');
      }

      // [타입 안정성] 배열에서 첫 번째 요소 추출 및 타입 체크
      // apiClient.get은 배열을 반환하므로 첫 번째 요소를 추출
      const guardianArray = guardiansResponse.data;
      if (!Array.isArray(guardianArray) || guardianArray.length === 0) {
        throw new Error('주 보호자 정보를 찾을 수 없습니다.');
      }

      const guardian = guardianArray[0];

      // [타입 안정성] 타입 가드를 사용하여 명시적 타입 체크
      if (!guardian || typeof guardian !== 'object' || !('phone' in guardian)) {
        throw new Error('주 보호자 정보 형식이 올바르지 않습니다.');
      }

      const guardianPhone = typeof guardian.phone === 'string' ? guardian.phone : String(guardian.phone);
      if (!guardianPhone.trim()) {
        throw new Error('주 보호자 전화번호를 찾을 수 없습니다.');
      }

      const notificationResponse = await apiClient.post<{ id: string }>('notifications', {
        channel: 'sms',
        recipient: guardianPhone,
        content: `${student.name} 학생의 학원 등록을 환영합니다! 앞으로 함께 성장해 나가겠습니다.`,
        status: 'pending',
      });

      if (notificationResponse.error) {
        throw new Error(notificationResponse.error.message);
      }

      const taskCardResponse = await apiClient.get<StudentTaskCard[]>('student_task_cards', {
        filters: {
          student_id: studentId,
          task_type: 'new_signup',
        },
        limit: 1,
      });

      // [타입 안정성] 타입 단언 제거, 명시적 타입 체크
      if (!taskCardResponse.error && taskCardResponse.data && taskCardResponse.data.length > 0) {
        const taskCard = taskCardResponse.data[0];
        if (taskCard && typeof taskCard === 'object' && 'id' in taskCard && typeof taskCard.id === 'string') {
          await apiClient.patch('student_task_cards', taskCard.id, {
            welcome_message_sent: true,
          });
        }
      }

      return notificationResponse.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['welcome-message-sent', tenantId, studentId] });
      queryClient.invalidateQueries({ queryKey: ['student-task-cards', tenantId] });
      showAlert('환영 메시지가 발송되었습니다.', '성공', 'success');
    },
    onError: (error: Error) => {
      showAlert(error.message, '오류', 'error');
    },
  });

  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();

  return (
    <div>
      <LayerSectionHeader
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <MessageSquare size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
            신규 등록 환영
          </span>
        }
        right={
          isEditable ? (
            <IconButtonGroup
              items={[
                ...(!welcomeMessageSent ? [{
                  icon: PlusIcon,
                  tooltip: sendWelcomeMessage.isPending ? '발송 중...' : '환영 메시지 발송',
                  variant: 'solid' as const,
                  color: 'primary' as const,
                  onClick: () => sendWelcomeMessage.mutate(),
                  disabled: sendWelcomeMessage.isPending,
                }] : []),
              ]}
              align="right"
            />
          ) : undefined
        }
      />
      <Card padding="md" variant="default" style={layerSectionCardStyle}>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
        신규 등록 학생을 위한 환영 메시지를 발송하고 초기 설정을 완료하세요.
      </p>

      {welcomeMessageSent && (
        <div style={{
          padding: 'var(--spacing-md)',
          backgroundColor: 'var(--color-success-50)',
          // 요구사항: 카드 라운드 한 단계 축소 (md -> sm)
          borderRadius: 'var(--border-radius-sm)',
          marginBottom: 'var(--spacing-md)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <span style={{ fontSize: 'var(--font-size-xl)' }}>완료</span>
            <span style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-semibold)' }}>
              환영 메시지가 이미 발송되었습니다.
            </span>
          </div>
        </div>
      )}
      {/* 요구사항: 페이지별 카드 헤더 우측 수정 버튼 제거 → 카드 하단 우측 수정 버튼 */}
      {isEditable && welcomeMessageSent && (
        <div style={{ width: '100%', paddingTop: 'var(--spacing-md)' }}>
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={() => showAlert('환영 메시지 수정 기능은 준비 중입니다.', '알림', 'info')}
          >
            수정
          </Button>
        </div>
      )}
      </Card>
    </div>
  );
}
