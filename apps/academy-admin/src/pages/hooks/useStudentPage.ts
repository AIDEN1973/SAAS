/**
 * 학생 관리 페이지 Application Layer Hook
 *
 * [아키텍처] Application Layer와 UI Composition 분리
 * - 이 Hook은 비즈니스 로직, 상태 관리, 데이터 페칭을 담당
 * - UI Composition은 StudentsPage.tsx에서 담당
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useModal } from '@ui-core/react';
import { useStudentsPaged, useStudentTags, useStudentTagsByStudent, useCreateStudent, useBulkCreateStudents, useStudent, useGuardians, fetchGuardians, useConsultations, useStudentClasses, useUpdateStudent, useDeleteStudent, useCreateGuardian, useUpdateGuardian, useDeleteGuardian, useCreateConsultation, useUpdateConsultation, useDeleteConsultation, useGenerateConsultationAISummary, useUpdateStudentTags, useAssignStudentToClass, useUnassignStudentFromClass } from '@hooks/use-student';
import { useClasses } from '@hooks/use-class';
import { useSession, useUserRole } from '@hooks/use-auth';
import { useSchema } from '@hooks/use-schema';
import { useResponsiveMode } from '@ui-core/react';
import { toKST } from '@lib/date-utils';
import type { StudentFilter, StudentStatus, Student, CreateStudentInput, Gender, ConsultationType, Guardian, StudentConsultation } from '@services/student-service';
import type { Class } from '@services/class-service';
import { studentFormSchema } from '../../schemas/student.schema';
import { guardianFormSchema } from '../../schemas/guardian.schema';
import { consultationFormSchema } from '../../schemas/consultation.schema';
import { classAssignmentFormSchema } from '../../schemas/class-assignment.schema';
import { createStudentFilterSchema } from '../../schemas/student.filter.schema';
import { studentTableSchema } from '../../schemas/student.table.schema';
import type { FormSchema, FilterSchema, TableSchema } from '@schema-engine/types';

export type LayerMenuTab = 'info' | 'guardians' | 'consultations' | 'tags' | 'classes' | 'attendance' | 'risk' | 'message';

export interface UseStudentPageReturn {
  // 상태
  filter: StudentFilter;
  selectedStudentId: string | null;
  layerMenuTab: LayerMenuTab;
  isEditing: boolean;
  showCreateForm: boolean;
  showGuardianForm: boolean;
  showConsultationForm: boolean;
  editingGuardianId: string | null;
  editingConsultationId: string | null;
  consultationTypeFilter: ConsultationType | 'all';
  isTagListExpanded: boolean;
  showTagListToggle: boolean;
  tagListCollapsedHeight: number | null;
  tagListRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;

  // 데이터
  students: Student[];
  totalCount: number;
  isLoading: boolean;
  error: Error | null;
  tags: Array<{ id: string; name: string; color: string }> | undefined;
  classes: Class[] | undefined;
  selectedStudent: Student | null | undefined;
  selectedStudentLoading: boolean;
  selectedStudentGuardians: Guardian[] | undefined;
  selectedStudentGuardiansLoading: boolean;
  selectedStudentConsultations: StudentConsultation[];
  selectedStudentConsultationsLoading: boolean;
  selectedStudentTags: Array<{ id: string; name: string; color: string }> | undefined;
  selectedStudentTagsLoading: boolean;
  selectedStudentClasses: Array<{ id: string; class_id: string; enrolled_at: string; left_at?: string; is_active: boolean; class: Class | null }>;
  selectedStudentClassesLoading: boolean;
  allClasses: Class[] | undefined;
  userId: string | undefined;
  userRole: 'admin' | 'teacher' | 'assistant' | null | undefined;

  // 스키마
  effectiveFormSchema: FormSchema;
  effectiveFilterSchema: FilterSchema;
  effectiveTableSchema: TableSchema;
  effectiveGuardianFormSchema: FormSchema;
  effectiveConsultationFormSchema: FormSchema;
  effectiveClassAssignmentFormSchema: FormSchema;

  // 테이블 관련
  tablePage: number;
  tablePageSize: number;
  tableFilters: Record<string, unknown>;

  // 반응형
  isMobile: boolean;
  isTablet: boolean;

  // 핸들러
  setFilter: React.Dispatch<React.SetStateAction<StudentFilter>>;
  handleStudentSelect: (studentId: string | null) => void;
  handleTabChange: (newTab: LayerMenuTab) => void;
  handleFilterChange: (filters: Record<string, unknown>) => void;
  handleTagFilter: (tagId: string) => void;
  handleDownload: () => Promise<void>;
  handleDownloadTemplate: () => Promise<void>;
  handleFileUpload: (file: File) => Promise<void>;
  setShowCreateForm: (show: boolean) => void;
  setIsEditing: (editing: boolean) => void;
  setShowGuardianForm: (show: boolean) => void;
  setShowConsultationForm: (show: boolean) => void;
  setEditingGuardianId: (id: string | null) => void;
  setEditingConsultationId: (id: string | null) => void;
  setConsultationTypeFilter: (filter: ConsultationType | 'all') => void;
  setIsTagListExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setTablePage: (page: number) => void;

  // Mutations
  createStudent: ReturnType<typeof useCreateStudent>;
  bulkCreateStudents: ReturnType<typeof useBulkCreateStudents>;
  updateStudent: ReturnType<typeof useUpdateStudent>;
  deleteStudent: ReturnType<typeof useDeleteStudent>;
  createGuardian: ReturnType<typeof useCreateGuardian>;
  updateGuardian: ReturnType<typeof useUpdateGuardian>;
  deleteGuardian: ReturnType<typeof useDeleteGuardian>;
  createConsultation: ReturnType<typeof useCreateConsultation>;
  updateConsultation: ReturnType<typeof useUpdateConsultation>;
  deleteConsultation: ReturnType<typeof useDeleteConsultation>;
  generateAISummary: ReturnType<typeof useGenerateConsultationAISummary>;
  updateStudentTags: ReturnType<typeof useUpdateStudentTags>;
  assignStudentToClass: ReturnType<typeof useAssignStudentToClass>;
  unassignStudentFromClass: ReturnType<typeof useUnassignStudentFromClass>;

  // 모달
  showAlert: (message: string, title?: string, variant?: 'success' | 'error' | 'warning' | 'info') => void;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
}

export function useStudentPage(): UseStudentPageReturn {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const { showAlert, showConfirm } = useModal();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';

  // 필터 상태
  const [filter, setFilter] = useState<StudentFilter>({});
  const [isTagListExpanded, setIsTagListExpanded] = useState(false);
  const [showTagListToggle, setShowTagListToggle] = useState(false);
  const [tagListCollapsedHeight, setTagListCollapsedHeight] = useState<number | null>(null);
  const tagListRef = useRef<HTMLDivElement | null>(null);

  // UI 상태
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showGuardianForm, setShowGuardianForm] = useState(false);
  const [showConsultationForm, setShowConsultationForm] = useState(false);
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [editingConsultationId, setEditingConsultationId] = useState<string | null>(null);
  const [consultationTypeFilter, setConsultationTypeFilter] = useState<ConsultationType | 'all'>('all');

  // ✅ 타입 가드 함수 (P0-E)
  const isLayerMenuTab = useCallback((value: string | null): value is LayerMenuTab => {
    if (!value) return false;
    const validTabs: LayerMenuTab[] = ['info', 'guardians', 'consultations', 'tags', 'classes', 'attendance', 'risk', 'message'];
    return validTabs.includes(value as LayerMenuTab);
  }, []);

  // URL에서 학생 ID와 탭 정보 읽기
  const urlStudentId = params.id
    || searchParams.get('studentId')  // ✅ 새 표준
    || searchParams.get('student')    // 기존 호환
    || null;

  const urlPanel = isLayerMenuTab(searchParams.get('panel'))
    ? searchParams.get('panel')
    : null;  // ✅ P0-E: 타입 가드
  const urlTab = isLayerMenuTab(searchParams.get('tab'))
    ? searchParams.get('tab')
    : null;  // ✅ P0-E: 타입 가드

  // URL 경로에 따라 초기 탭 설정
  const getInitialTab = useCallback((): LayerMenuTab => {
    const path = location.pathname;
    if (path.includes('/attendance')) return 'attendance';
    if (path.includes('/risk')) return 'risk';
    if (path.includes('/welcome') || path.includes('/message')) return 'message';
    if (path.includes('/guardians')) return 'guardians';
    if (path.includes('/consultations')) return 'consultations';
    if (path.includes('/tags')) return 'tags';
    if (path.includes('/classes')) return 'classes';
    return (urlPanel || urlTab || 'info') as LayerMenuTab;  // ✅ canonical 우선
  }, [location.pathname, urlPanel, urlTab]);

  // ✅ P0-D 개선: 상태별 1회 보장 (더 안전)
  const lastRewrittenSearchRef = useRef<string | null>(null);

  useEffect(() => {
    const current = location.search;

    // 이미 이 search에 대해 rewrite 했으면 스킵
    if (lastRewrittenSearchRef.current === current) {
      return;
    }

    const legacyStudent = searchParams.get('student');
    const legacyTab = searchParams.get('tab');
    const canonicalStudentId = searchParams.get('studentId');
    const canonicalPanel = searchParams.get('panel');

    // canonical이면 그냥 return
    if (canonicalStudentId && canonicalPanel) {
      return;
    }

    // Legacy → Canonical rewrite
    if (legacyStudent && !canonicalStudentId) {
      const targetPanel = canonicalPanel || (isLayerMenuTab(legacyTab) ? legacyTab : 'info');
      navigate(`/students/list?studentId=${legacyStudent}&panel=${targetPanel}`, {
        replace: true
      });
      lastRewrittenSearchRef.current = current;  // ✅ 이 search에 대해 1회만
      return;
    }

    if (legacyTab && !canonicalPanel && canonicalStudentId) {
      const targetPanel = isLayerMenuTab(legacyTab) ? legacyTab : 'info';
      navigate(`/students/list?studentId=${canonicalStudentId}&panel=${targetPanel}`, {
        replace: true
      });
      lastRewrittenSearchRef.current = current;  // ✅ 이 search에 대해 1회만
      return;
    }
  }, [location.search, searchParams, navigate, isLayerMenuTab]);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(urlStudentId);
  // [성능 최적화] lazy initialization으로 초기 렌더링에서만 함수 실행
  // ✅ 기본값 fallback: canonical 우선
  const activeTab: LayerMenuTab = (urlPanel || urlTab || getInitialTab()) as LayerMenuTab;
  const [layerMenuTab, setLayerMenuTab] = useState<LayerMenuTab>(activeTab);

  // 테이블 페이지네이션
  const [tablePage, setTablePage] = useState(1);
  const tablePageSize = 10;

  // 필터 객체 안정화
  const stableFilter = useMemo(() => {
    const trimmedSearch = filter.search?.trim() || undefined;
    const result: StudentFilter = {};
    if (trimmedSearch) result.search = trimmedSearch;
    if (filter.status) result.status = filter.status;
    if (filter.grade) result.grade = filter.grade;
    if (filter.tag_ids && filter.tag_ids.length > 0) result.tag_ids = filter.tag_ids;
    if (filter.class_id) result.class_id = filter.class_id;
    return Object.keys(result).length > 0 ? result : undefined;
  }, [filter.search, filter.status, filter.grade, filter.tag_ids, filter.class_id]);

  // 학생 목록 데이터
  const { data: studentsPaged, isLoading, error } = useStudentsPaged({
    filter: stableFilter,
    page: tablePage,
    pageSize: tablePageSize,
  });
  const students = useMemo(() => (studentsPaged as { students: Student[]; totalCount: number } | undefined)?.students ?? [], [studentsPaged]);
  const totalCount = useMemo(() => (studentsPaged as { students: Student[]; totalCount: number } | undefined)?.totalCount ?? 0, [studentsPaged]);

  // 테이블 필터
  const tableFilters = useMemo(() => {
    return {
      ...(filter.status && { status: filter.status }),
      ...(filter.grade && { grade: filter.grade }),
      ...(filter.search && { search: filter.search }),
    } as Record<string, unknown>;
  }, [filter.grade, filter.search, filter.status]);

  // 태그 및 반 데이터
  const { data: tags } = useStudentTags();
  const { data: classes } = useClasses({ status: 'active' });

  // 파일 입력 ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Schema Registry 연동
  // [성능 최적화] createStudentFilterSchema를 메모이제이션하여 중복 호출 방지
  const studentFilterSchema = useMemo(() => createStudentFilterSchema(classes || []), [classes]);
  const { data: studentFormSchemaData } = useSchema('student', studentFormSchema, 'form');
  const { data: studentFilterSchemaData } = useSchema('student_filter', studentFilterSchema, 'filter');
  const { data: studentTableSchemaData } = useSchema('student_table', studentTableSchema, 'table');
  const { data: guardianFormSchemaData } = useSchema('guardian', guardianFormSchema, 'form');
  const { data: consultationFormSchemaData } = useSchema('consultation', consultationFormSchema, 'form');
  const { data: classAssignmentFormSchemaData } = useSchema('class_assignment', classAssignmentFormSchema, 'form');

  // Fallback: Registry에서 조회 실패 시 로컬 스키마 사용
  const effectiveFormSchema = studentFormSchemaData || studentFormSchema;
  const effectiveFilterSchema: FilterSchema = studentFilterSchemaData || studentFilterSchema;
  const effectiveTableSchema: TableSchema = studentTableSchemaData || studentTableSchema;
  const effectiveGuardianFormSchema = guardianFormSchemaData || guardianFormSchema;
  const effectiveConsultationFormSchema = consultationFormSchemaData || consultationFormSchema;
  const effectiveClassAssignmentFormSchema = classAssignmentFormSchemaData || classAssignmentFormSchema;

  // 선택된 학생 데이터
  const { data: selectedStudent, isLoading: selectedStudentLoading } = useStudent(selectedStudentId);
  const { data: selectedStudentGuardiansData, isLoading: selectedStudentGuardiansLoading } = useGuardians(selectedStudentId);
  const selectedStudentGuardians = useMemo<Guardian[] | undefined>(() => {
    if (!selectedStudentGuardiansData) return undefined;
    return (selectedStudentGuardiansData as unknown) as Guardian[];
  }, [selectedStudentGuardiansData]);
  const { data: allSelectedStudentConsultations, isLoading: selectedStudentConsultationsLoading } = useConsultations(selectedStudentId);
  const { data: selectedStudentTags, isLoading: selectedStudentTagsLoading } = useStudentTagsByStudent(selectedStudentId);
  const { data: selectedStudentClasses, isLoading: selectedStudentClassesLoading } = useStudentClasses(selectedStudentId);
  const { data: allClasses } = useClasses({ status: 'active' });
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const { data: userRole } = useUserRole();

  // 상담일지 필터링
  const selectedStudentConsultations = useMemo<StudentConsultation[]>(() => {
    if (!allSelectedStudentConsultations) return [];
    const consultations = (allSelectedStudentConsultations as unknown) as StudentConsultation[];
    if (consultationTypeFilter === 'all') return consultations;
    return consultations.filter((c) => c.consultation_type === consultationTypeFilter);
  }, [allSelectedStudentConsultations, consultationTypeFilter]);

  // Mutation 훅
  const createStudent = useCreateStudent();
  const bulkCreateStudents = useBulkCreateStudents();
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

  // URL 동기화
  useEffect(() => {
    if (urlStudentId && urlStudentId !== selectedStudentId) {
      setSelectedStudentId(urlStudentId);
      const initialTab: LayerMenuTab = (urlPanel || urlTab || getInitialTab()) as LayerMenuTab;
      setLayerMenuTab(initialTab);
    } else if (!urlStudentId && selectedStudentId) {
      setSelectedStudentId(null);
    }
  }, [urlStudentId, selectedStudentId, urlPanel, urlTab, getInitialTab]);

  useEffect(() => {
    const newTab: LayerMenuTab = (urlPanel || urlTab || getInitialTab()) as LayerMenuTab;
    if (newTab !== layerMenuTab) {
      setLayerMenuTab(newTab);
    }
  }, [urlPanel, urlTab, getInitialTab, layerMenuTab]);

  // 학생 선택 핸들러
  const handleStudentSelect = useCallback((studentId: string | null) => {
    setSelectedStudentId(studentId);
    if (studentId) {
      // ✅ canonical URL 사용
      navigate(`/students/list?studentId=${studentId}&panel=${layerMenuTab}`, { replace: true });
    } else {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('studentId');
      newSearchParams.delete('student');  // legacy 제거
      newSearchParams.delete('panel');
      newSearchParams.delete('tab');  // legacy 제거
      navigate(`/students/list?${newSearchParams.toString()}`, { replace: true });
    }
  }, [navigate, layerMenuTab, searchParams]);

  // 탭 변경 핸들러
  const handleTabChange = useCallback((newTab: LayerMenuTab) => {
    setLayerMenuTab(newTab);
    if (selectedStudentId) {
      // ✅ canonical URL 사용
      navigate(`/students/list?studentId=${selectedStudentId}&panel=${newTab}`, { replace: true });
    }
  }, [selectedStudentId, navigate]);

  // 학생 선택 시 상태 초기화
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

  // 필터 변경 핸들러
  const handleFilterChange = useCallback((filters: Record<string, unknown>) => {
    setFilter((prev) => ({
      search: filters.search ? String(filters.search) : undefined,
      status: filters.status as StudentStatus | StudentStatus[] | undefined,
      grade: filters.grade ? String(filters.grade) : undefined,
      class_id: filters.class_id ? String(filters.class_id) : undefined,
      tag_ids: prev.tag_ids,
    }));
  }, []);

  // 태그 필터 핸들러
  const handleTagFilter = useCallback((tagId: string) => {
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

  // 태그 목록 높이 감지
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const el = tagListRef.current;
    if (!el) return;

    const measure = () => {
      const firstBtn = el.querySelector('button') as HTMLButtonElement | null;
      const oneLineHeight = firstBtn?.offsetHeight ?? 32;
      setTagListCollapsedHeight(oneLineHeight);

      const isWrapped = el.scrollHeight > oneLineHeight + 1;
      setShowTagListToggle((prev) => prev !== isWrapped ? isWrapped : prev);

      if (!isWrapped) {
        setIsTagListExpanded((prev) => prev !== false ? false : prev);
      }
    };

    const raf = window.requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
    ro?.observe(el);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [tags, filter.tag_ids]);

  // 다운로드 핸들러
  const handleDownload = useCallback(async () => {
    try {
      const XLSX = await import('xlsx');
      const excelData = students?.map((student: Student) => ({
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

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '학생 목록');

      const fileName = `학생목록_${toKST().format('YYYY-MM-DD')}.xlsx`;
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
  const handleDownloadTemplate = useCallback(async () => {
    try {
      const XLSX = await import('xlsx');
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

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '학생 양식');

      const fileName = `학생등록양식_${toKST().format('YYYY-MM-DD')}.xlsx`;
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

  // 파일 업로드 핸들러
  const handleFileUpload = useCallback(async (file: File) => {
    try {
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<Record<string, unknown>>;

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
      })).filter((s) => s.name.trim() !== '');

      if (students.length === 0) {
        showAlert('등록할 학생 데이터가 없습니다.', '알림', 'warning');
        return;
      }

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

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : '엑셀 일괄 등록에 실패했습니다.',
        '오류',
        'error'
      );
    }
  }, [bulkCreateStudents, showAlert]);

  return {
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
    error: error as Error | null,
    tags,
    classes,
    selectedStudent,
    selectedStudentLoading,
    selectedStudentGuardians,
    selectedStudentGuardiansLoading,
    selectedStudentConsultations,
    selectedStudentConsultationsLoading,
    selectedStudentTags,
    selectedStudentTagsLoading,
    selectedStudentClasses: selectedStudentClasses?.map((sc) => ({
      ...sc,
      class: sc.class || null,
    })) || [],
    selectedStudentClassesLoading,
    allClasses,
    userId,
    userRole: userRole as 'admin' | 'teacher' | 'assistant' | null | undefined,

    // 스키마
    effectiveFormSchema,
    effectiveFilterSchema,
    effectiveTableSchema,
    effectiveGuardianFormSchema,
    effectiveConsultationFormSchema,
    effectiveClassAssignmentFormSchema,

    // 테이블 관련
    tablePage,
    tablePageSize,
    tableFilters,

    // 반응형
    isMobile,
    isTablet,

    // 핸들러
    setFilter,
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

    // 모달
    showAlert,
    showConfirm,
  };
}

