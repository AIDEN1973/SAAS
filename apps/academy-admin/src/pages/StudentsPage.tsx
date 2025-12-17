/**
 * 학생 관리 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { ErrorBoundary, useModal, useResponsiveMode } from '@ui-core/react';
import { DataTableActionButtons } from '../components/DataTableActionButtons';
import { BadgeSelect } from '../components/BadgeSelect';
import { Container, Grid, Card, Button, Input, Modal, Drawer, PageHeader, RightLayerMenuLayout, Tabs, BottomActionBar, Badge, Select } from '@ui-core/react';
import { SchemaForm, SchemaFilter, SchemaTable, SchemaDetail } from '@schema-engine';
import { useStudents, useStudentTags, useStudentTagsByStudent, useCreateStudent, useBulkCreateStudents, useStudent, useGuardians, useConsultations, useStudentClasses, useUpdateStudent, useCreateGuardian, useUpdateGuardian, useDeleteGuardian, useCreateConsultation, useUpdateConsultation, useDeleteConsultation, useGenerateConsultationAISummary, useUpdateStudentTags, useAssignStudentToClass, useUnassignStudentFromClass } from '@hooks/use-student';
import { useClasses } from '@hooks/use-class';
import { useAttendanceLogs } from '@hooks/use-attendance';
import { useSession, useUserRole } from '@hooks/use-auth';
import { toKST } from '@lib/date-utils';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useSchema } from '@hooks/use-schema';
import type { StudentFilter, StudentStatus, Student, CreateStudentInput, Gender, GuardianRelationship, ConsultationType, Guardian, StudentConsultation } from '@services/student-service';
import type { AttendanceLog } from '@services/attendance-service';
import type { Class } from '@services/class-service';
import type { StudentTaskCard } from '@hooks/use-student';
import type { Tag } from '@core/tags';
import type { FormSchema, DetailSchema } from '@schema-engine/types';
import { studentFormSchema } from '../schemas/student.schema';
import { studentDetailSchema } from '../schemas/student.detail.schema';
import { guardianFormSchema } from '../schemas/guardian.schema';
import { consultationFormSchema } from '../schemas/consultation.schema';
import { classAssignmentFormSchema } from '../schemas/class-assignment.schema';
import { createStudentFilterSchema } from '../schemas/student.filter.schema';
import { studentTableSchema } from '../schemas/student.table.schema';
// xlsx 동적 import로 로드 (필요한 경우만)

export function StudentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showAlert, showConfirm } = useModal();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const isDesktop = mode === 'lg' || mode === 'xl';
  const [filter, setFilter] = useState<StudentFilter>({});

  // [불변 규칙] 모든 환경에서 테이블 구조 유지 (모바일: 1열 세로 배치)
  // DataTable 컴포넌트가 모바일에서 자동으로 1열 세로 배치로 렌더링
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false); // 아키텍처 문서 3.1.7: 고급 옵션 숨김

  // URL에서 학생 ID와 탭 정보 읽기
  const urlStudentId = params.id || searchParams.get('student') || null;
  const urlTab = searchParams.get('tab') as 'info' | 'guardians' | 'consultations' | 'tags' | 'classes' | 'attendance' | 'risk' | 'welcome' | null;

  // URL 경로에 따라 초기 탭 설정 (StudentDetailPage와 동일한 로직)
  const getInitialTab = (): 'info' | 'guardians' | 'consultations' | 'tags' | 'classes' | 'attendance' | 'risk' | 'welcome' => {
    const path = location.pathname;
    if (path.includes('/attendance')) return 'attendance';
    if (path.includes('/risk')) return 'risk';
    if (path.includes('/welcome')) return 'welcome';
    if (path.includes('/guardians')) return 'guardians';
    if (path.includes('/consultations')) return 'consultations';
    if (path.includes('/tags')) return 'tags';
    if (path.includes('/classes')) return 'classes';
    return urlTab || 'info';
  };

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(urlStudentId); // 레이어 메뉴에 표시할 학생 ID

  // [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
  // SchemaFilter에서 검색 필드 디바운싱이 자동으로 적용됨
  const { data: students, isLoading, error } = useStudents({
    ...filter,
    search: filter.search?.trim() || undefined, // 빈 문자열이면 undefined로 변환
  });

  const { data: tags } = useStudentTags();
  const { data: classes } = useClasses({ status: 'active' });
  const createStudent = useCreateStudent();
  const bulkCreateStudents = useBulkCreateStudents();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Schema Registry 연동 (아키텍처 문서 S3 참조)
  const { data: studentFormSchemaData } = useSchema('student', studentFormSchema, 'form');
  const { data: studentFilterSchemaData } = useSchema('student_filter', createStudentFilterSchema(classes || []), 'filter');
  const { data: studentTableSchemaData } = useSchema('student_table', studentTableSchema, 'table');
  const { data: studentDetailSchemaData } = useSchema('student_detail', studentDetailSchema, 'detail');
  const { data: guardianFormSchemaData } = useSchema('guardian', guardianFormSchema, 'form');
  const { data: consultationFormSchemaData } = useSchema('consultation', consultationFormSchema, 'form');
  const { data: classAssignmentFormSchemaData } = useSchema('class_assignment', classAssignmentFormSchema, 'form');

  // Fallback: Registry에서 조회 실패 시 로컬 스키마 사용
  const effectiveFormSchema = studentFormSchemaData || studentFormSchema;
  const effectiveFilterSchema = studentFilterSchemaData || createStudentFilterSchema(classes || []);
  const effectiveTableSchema = studentTableSchemaData || studentTableSchema;
  const effectiveDetailSchema = studentDetailSchemaData || studentDetailSchema;
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
  }, [urlStudentId, location.pathname]);

  // URL 경로 변경 시 탭 업데이트
  useEffect(() => {
    const newTab = getInitialTab();
    if (newTab !== layerMenuTab) {
      setLayerMenuTab(newTab);
    }
  }, [location.pathname]);

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

  const handleTagFilter = (tagId: string) => {
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
  };

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
        비고: student.notes || '',
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
        비고: '',
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
          title: selectedStudentLoading ? '로딩 중...' : selectedStudent ? `${selectedStudent.name} 학생 상세정보` : '학생 상세',
          width: isTablet ? 'var(--width-layer-menu-tablet)' : 'var(--width-layer-menu)',
          children: selectedStudentLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              로딩 중...
            </div>
          ) : selectedStudent ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {layerMenuTab === 'info' && selectedStudent && (
                  <StudentInfoTab
                    student={selectedStudent}
                    isEditing={isEditing}
                    effectiveStudentDetailSchema={effectiveDetailSchema}
                    effectiveStudentFormSchema={effectiveFormSchema}
                    onCancel={() => setIsEditing(false)}
                    onSave={async (data) => {
                      await updateStudent.mutateAsync({ studentId: selectedStudent.id, input: data });
                      setIsEditing(false);
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
                          error instanceof Error ? error.message : 'AI 요약 생성에 실패했습니다.',
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
                  />
                )}
                {layerMenuTab === 'classes' && selectedStudent && (
                  <ClassesTab
                    studentId={selectedStudent.id}
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
                  <AttendanceTab studentId={selectedStudentId} student={selectedStudent} />
                )}
                {layerMenuTab === 'risk' && selectedStudent && (
                  <RiskAnalysisTab studentId={selectedStudentId} student={selectedStudent} />
                )}
                {layerMenuTab === 'welcome' && selectedStudent && (
                  <WelcomeTab studentId={selectedStudentId} student={selectedStudent} />
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
                notes: row['비고'] || row['notes'] ? String(row['비고'] || row['notes']) : undefined,
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
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)' }}>
              {tags.map((tag: { id: string; name: string; color: string }) => (
                <Button
                  key={tag.id}
                  variant={filter.tag_ids?.includes(tag.id) ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTagFilter(tag.id)}
                  style={{
                    backgroundColor: filter.tag_ids?.includes(tag.id) ? tag.color : undefined,
                    color: filter.tag_ids?.includes(tag.id) ? 'var(--color-white)' : undefined,
                  }}
                >
                  {tag.name}
                </Button>
              ))}
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
                  width={isTablet ? 'var(--width-drawer-tablet)' : '100%'}
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
                  filters={{
                    ...(filter.status && { status: filter.status }),
                    ...(filter.grade && { grade: filter.grade }),
                    ...(filter.search && { search: filter.search }),
                  }}
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

interface StudentCardProps {
  student: Student;
  onDetailClick: () => void;
}

function StudentCard({ student, onDetailClick }: StudentCardProps) {
  // 아키텍처 문서 3.1.4: 이름, 학부모, 연락처, 대표반만 표시
  // 태그는 고급 옵션 활성화 시에만 표시 (아키텍처 문서 3.1.6)

  const statusConfig = {
    active: { label: '재원', bgColor: 'var(--color-green-100)', textColor: 'var(--color-green-800)' },
    on_leave: { label: '휴원', bgColor: 'var(--color-yellow-100)', textColor: 'var(--color-yellow-800)' },
    withdrawn: { label: '퇴원', bgColor: 'var(--color-gray-100)', textColor: 'var(--color-gray-800)' },
  };

  const status = student.status as keyof typeof statusConfig;
  const statusInfo = statusConfig[status] || statusConfig.withdrawn;

  // 아키텍처 문서 3.1.4 요구사항: 이름, 학부모, 연락처, 대표반만 표시
  const studentWithExtras = student as Student & { primary_guardian_name?: string; primary_class_name?: string };

  return (
    <Card
      variant="elevated"
      padding="md"
      style={{ cursor: 'pointer', transition: `box-shadow var(--transition-slow)` }}
      onClick={onDetailClick}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>{student.name}</h3>
        <span
          style={{
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            fontSize: 'var(--font-size-xs)',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: statusInfo.bgColor,
            color: statusInfo.textColor,
          }}
        >
          {statusInfo.label}
        </span>
      </div>

      {/* 아키텍처 문서 3.1.4 요구사항: 학부모 정보 표시 */}
      {studentWithExtras.primary_guardian_name && (
        <p style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--spacing-xs)'
        }}>
          학부모: {studentWithExtras.primary_guardian_name}
        </p>
      )}

      {/* 아키텍처 문서 3.1.4 요구사항: 연락처 표시 */}
      {student.phone && (
        <p style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--spacing-xs)'
        }}>
          연락처: {student.phone}
        </p>
      )}

      {/* 아키텍처 문서 3.1.4 요구사항: 대표반 표시 */}
      {studentWithExtras.primary_class_name && (
        <p style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--spacing-sm)'
        }}>
          대표반: {studentWithExtras.primary_class_name}
        </p>
      )}

      <Grid columns={{ xs: 1, sm: 2 }} gap="sm" style={{ marginTop: 'var(--spacing-md)' }}>
        <Button variant="outline" size="sm" fullWidth onClick={(e) => { e?.stopPropagation(); onDetailClick(); }}>
          상세
        </Button>
        {/* 수정 버튼: 상세 페이지로 이동 후 수정 모드 활성화 (아키텍처 문서 3.1.4: 학생 등록/수정) */}
        <Button variant="outline" size="sm" fullWidth onClick={(e) => { e?.stopPropagation(); onDetailClick(); }}>
          수정
        </Button>
      </Grid>
    </Card>
  );
}

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
  effectiveStudentDetailSchema: DetailSchema;
  effectiveStudentFormSchema: FormSchema;
  onCancel: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

function StudentInfoTab({ student, isEditing, effectiveStudentDetailSchema, effectiveStudentFormSchema, onCancel, onSave }: StudentInfoTabProps) {
  if (!isEditing) {
    // SchemaDetail 사용
    const detailData = {
      name: student.name,
      birth_date: student.birth_date || '',
      gender: student.gender === 'male' ? '남' : student.gender === 'female' ? '여' : '',
      phone: student.phone || '',
      email: student.email || '',
      address: student.address || '',
      school_name: student.school_name || '',
      grade: student.grade || '',
      status: student.status === 'active' ? '재원' : student.status === 'on_leave' ? '휴원' : student.status === 'withdrawn' ? '퇴원' : '졸업',
      notes: student.notes || '',
    };

    return (
      <Card padding="md" variant="default">
        <SchemaDetail
          schema={effectiveStudentDetailSchema}
          data={detailData}
        />
      </Card>
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

  // 수정 모드를 위한 스키마 (submit 버튼 커스터마이징)
  const editSchema = {
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
  };

  return (
    <Card padding="md" variant="default">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>학생 정보 수정</h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          취소
        </Button>
      </div>
      <SchemaForm
        schema={editSchema}
        onSubmit={handleSubmit}
        defaultValues={{
          name: student.name,
          birth_date: student.birth_date || '',
          gender: student.gender || '',
          phone: student.phone || '',
          email: student.email || '',
          address: student.address || '',
          school_name: student.school_name || '',
          grade: student.grade || '',
          status: student.status,
          notes: student.notes || '',
        }}
      />
    </Card>
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
  const isTablet = mode === 'md';

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
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

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div>
      {!showForm && isEditable && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <Button variant="solid" onClick={onShowForm}>
            학부모 추가
          </Button>
        </div>
      )}

      {showForm && (
        <>
          {isMobile || isTablet ? (
            <Drawer
              isOpen={showForm}
              onClose={onHideForm}
              title={editingGuardianId ? '학부모 수정' : '학부모 추가'}
              position={isMobile ? 'bottom' : 'right'}
              width={isTablet ? 'var(--width-drawer-tablet)' : '100%'}
            >
              <SchemaForm
                schema={effectiveGuardianFormSchema}
                onSubmit={handleSubmit}
                defaultValues={editingGuardian ? {
                  name: editingGuardian.name,
                  relationship: editingGuardian.relationship,
                  phone: editingGuardian.phone || '',
                  email: editingGuardian.email || '',
                  is_primary: editingGuardian.is_primary || false,
                } : {}}
                disableCardPadding={true}
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
            </Drawer>
          ) : (
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                  {editingGuardianId ? '학부모 수정' : '학부모 추가'}
                </h3>
                <Button variant="ghost" size="sm" onClick={onHideForm}>
                  닫기
                </Button>
              </div>
              <SchemaForm
                schema={effectiveGuardianFormSchema}
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
            </Card>
          )}
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {guardians.map((guardian) => (
          <Card key={guardian.id} padding="md" variant="default">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                  <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>{guardian.name}</h4>
                  {guardian.is_primary && (
                    <span style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-xs) var(--spacing-sm)', backgroundColor: 'var(--color-blue-100)', color: 'var(--color-blue-800)', borderRadius: 'var(--border-radius-sm)' }}>
                      주 보호자
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  {guardian.relationship === 'parent' ? '부모' : guardian.relationship === 'guardian' ? '보호자' : '기타'}
                </p>
                <p style={{ color: 'var(--color-text-secondary)' }}>{guardian.phone}</p>
                {guardian.email && (
                  <p style={{ color: 'var(--color-text-secondary)' }}>{guardian.email}</p>
                )}
                {guardian.notes && (
                  <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>{guardian.notes}</p>
                )}
              </div>
              {isEditable && (
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(guardian.id)}>
                    수정
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(guardian.id)}>
                    삭제
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
        {guardians.length === 0 && !showForm && (
          <Card padding="md" variant="outlined">
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>등록된 학부모가 없습니다.</p>
          </Card>
        )}
      </div>
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
      {!showForm && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
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
            selectedColor="var(--color-primary-dark)"
            unselectedColor="var(--color-text)"
          />
          {isEditable && (
            <Button variant="solid" onClick={onShowForm}>
              상담일지 추가
            </Button>
          )}
        </div>
      )}

      {showForm && (
        <>
          {isMobile || isTablet ? (
            <Drawer
              isOpen={showForm}
              onClose={onHideForm}
              title={editingConsultationId ? '상담일지 수정' : '상담일지 추가'}
              position={isMobile ? 'bottom' : 'right'}
              width={isTablet ? 'var(--width-drawer-tablet)' : '100%'}
            >
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
                disableCardPadding={true}
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
            </Drawer>
          ) : (
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                  {editingConsultationId ? '상담일지 수정' : '상담일지 추가'}
                </h3>
                <Button variant="ghost" size="sm" onClick={onHideForm}>
                  닫기
                </Button>
              </div>
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
            </Card>
          )}
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {consultations.map((consultation) => (
          <Card key={consultation.id} padding="md" variant="default">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                  <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>
                    {consultation.consultation_date}
                  </h4>
                  <span style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-xs) var(--spacing-sm)', backgroundColor: 'var(--color-gray-100)', color: 'var(--color-gray-800)', borderRadius: 'var(--border-radius-sm)' }}>
                    {consultation.consultation_type === 'counseling' ? '상담' : consultation.consultation_type === 'learning' ? '학습' : consultation.consultation_type === 'behavior' ? '행동' : '기타'}
                  </span>
                </div>
                <p style={{ color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
                  {consultation.content}
                </p>
                {consultation.ai_summary && (
                  <div style={{ marginTop: 'var(--spacing-sm)', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-blue-50)', borderRadius: 'var(--border-radius-sm)' }}>
                    <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>AI 요약</p>
                    <p style={{ color: 'var(--color-text-secondary)' }}>{consultation.ai_summary}</p>
                  </div>
                )}
                {!consultation.ai_summary && (
                  <div style={{ marginTop: 'var(--spacing-sm)' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onGenerateAISummary(consultation.id)}
                      style={{ fontSize: 'var(--font-size-xs)' }}
                    >
                      AI 요약 생성
                    </Button>
                  </div>
                )}
              </div>
              {isEditable && (
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(consultation.id)}>
                    수정
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(consultation.id)}>
                    삭제
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
        {consultations.length === 0 && !showForm && (
          <Card padding="md" variant="outlined">
            <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-gray-400)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginBottom: 'var(--spacing-xs)', display: 'inline-block' }}
              >
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 15h8"/>
                <path d="M8 9h2"/>
                <path d="M14 9h2"/>
              </svg>
              <p>등록된 상담일지가 없습니다.</p>
            </div>
          </Card>
        )}
      </div>
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
}

function TagsTab({ studentTags, isLoading, studentId, onUpdateTags, isEditable = true }: TagsTabProps) {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const { data: allTags, isLoading: allTagsLoading } = useStudentTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  useEffect(() => {
    if (studentTags) {
      setSelectedTagIds(studentTags.map((tag) => tag.id));
    }
  }, [studentTags]);

  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const newIds = prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId];
      return newIds;
    });
  };

  const handleSave = async () => {
    await onUpdateTags(selectedTagIds);
  };

  if (isLoading || allTagsLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div style={{ paddingBottom: isMobile ? 'var(--spacing-bottom-action-bar)' : '0' }}>
      <Card padding="md" variant="default">
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
            태그 관리
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
            학생에게 태그를 추가하거나 제거할 수 있습니다.
          </p>
        </div>

        {allTags && allTags.length > 0 && (
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
              사용 가능한 태그
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
              {allTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => isEditable && handleTagToggle(tag.id)}
                    disabled={!isEditable}
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      fontSize: 'var(--font-size-sm)',
                      borderRadius: 'var(--border-radius-sm)',
                      border: isSelected ? `var(--border-width-base) solid ${tag.color}` : `var(--border-width-base) solid transparent`,
                      color: isSelected ? 'var(--color-white)' : tag.color,
                      backgroundColor: isSelected ? tag.color : 'transparent',
                      cursor: isEditable ? 'pointer' : 'not-allowed',
                      opacity: isEditable ? 'var(--opacity-full)' : 'var(--opacity-loading)',
                      transition: 'var(--transition-all)',
                    }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isEditable && (
          <>
            {isMobile ? (
              <BottomActionBar>
                <div style={{ flex: 1 }} />
                <Button
                  variant="solid"
                  color="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={isLoading}
                >
                  저장
                </Button>
              </BottomActionBar>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
                <Button
                  variant="solid"
                  color="primary"
                  onClick={handleSave}
                  disabled={isLoading}
                >
                  저장
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

// 반 배정 탭 컴포넌트
interface ClassesTabProps {
  studentId: string;
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
  studentId,
  studentClasses,
  isLoading,
  allClasses,
  effectiveClassAssignmentFormSchema,
  onAssign,
  onUnassign,
  isEditable = true,
}: ClassesTabProps) {
  const { showAlert, showConfirm } = useModal();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const [showAssignForm, setShowAssignForm] = useState(false);

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

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div>
      {isEditable && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <Button
            variant="solid"
            onClick={() => setShowAssignForm(!showAssignForm)}
            disabled={availableClasses.length === 0}
          >
            반 배정
          </Button>
          {availableClasses.length === 0 && (
            <span style={{ marginLeft: 'var(--spacing-sm)', color: 'var(--color-text-secondary)' }}>
              배정 가능한 반이 없습니다.
            </span>
          )}
        </div>
      )}

      {showAssignForm && (
        <>
          {isMobile || isTablet ? (
            <Drawer
              isOpen={showAssignForm}
              onClose={() => setShowAssignForm(false)}
              title="반 배정"
              position={isMobile ? 'bottom' : 'right'}
              width={isTablet ? 'var(--width-drawer-tablet)' : '100%'}
            >
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
            </Drawer>
          ) : (
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>반 배정</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowAssignForm(false)}>
                  닫기
                </Button>
              </div>
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
            </Card>
          )}
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {studentClasses
          .filter((sc) => sc.is_active && sc.class)
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
        {studentClasses.filter((sc) => sc.is_active && sc.class).length === 0 && (
          <Card padding="md" variant="outlined">
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              배정된 반이 없습니다.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

// 출결 관리 탭 컴포넌트
function AttendanceTab({
  studentId,
  student,
}: {
  studentId: string | null;
  student: Student | null | undefined;
}) {
  const navigate = useNavigate();
  const { showAlert } = useModal();

  const thirtyDaysAgo = useMemo(() => {
    return toKST().subtract(30, 'day').format('YYYY-MM-DD');
  }, []);

  const { data: attendanceLogsData, isLoading } = useAttendanceLogs({
    student_id: studentId || undefined,
    date_from: thirtyDaysAgo,
  });
  const attendanceLogs = attendanceLogsData || [];

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      <Card padding="md" variant="default">
        <h3 style={{ marginBottom: 'var(--spacing-md)' }}>출결 통계 (최근 30일)</h3>
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
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            출결 데이터가 없습니다.
          </div>
        )}
      </Card>

      <Card padding="md" variant="default">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <h3>최근 출결 내역</h3>
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
        ) : attendanceLogs && attendanceLogs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {attendanceLogs.slice(0, 10).map((log) => {
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
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--spacing-xl)' }}>
            최근 출결 내역이 없습니다.
          </div>
        )}
      </Card>
    </div>
  );
}

// 이탈 위험 분석 탭 컴포넌트
function RiskAnalysisTab({ studentId, student }: { studentId: string | null; student: Student | null | undefined }) {
  const { showAlert } = useModal();
  const context = getApiContext();
  const tenantId = context.tenantId;

  const thirtyDaysAgo = React.useMemo(() => {
    return toKST().subtract(30, 'day').format('YYYY-MM-DD');
  }, []);

  const { data: attendanceLogsData } = useAttendanceLogs({
    student_id: studentId || undefined,
    date_from: thirtyDaysAgo,
  });
  const attendanceLogs = attendanceLogsData || [];

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
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          분석 중...
        </div>
      </Card>
    );
  }

  if (!riskAnalysis) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
          분석 데이터가 없습니다.
        </div>
      </Card>
    );
  }

  const riskColor = riskAnalysis.risk_level === 'high' ? 'error' : riskAnalysis.risk_level === 'medium' ? 'warning' : 'success';

  return (
    <Card padding="md" variant="default">
      <h3 style={{ marginBottom: 'var(--spacing-md)' }}>이탈 위험 분석</h3>

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
          <ul style={{ paddingLeft: 'var(--spacing-md)', margin: 0 }}>
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
          <ul style={{ paddingLeft: 'var(--spacing-md)', margin: 0 }}>
            {riskAnalysis.recommended_actions.map((action, idx) => (
              <li key={idx} style={{ marginBottom: 'var(--spacing-xs)', color: 'var(--color-text-secondary)' }}>
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// 환영 메시지 탭 컴포넌트
function WelcomeTab({ studentId, student }: { studentId: string | null; student: Student | null | undefined }) {
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

      if (guardiansResponse.error || !guardiansResponse.data || guardiansResponse.data.length === 0) {
        throw new Error('주 보호자 정보를 찾을 수 없습니다.');
      }

      const guardian = guardiansResponse.data[0];

      const notificationResponse = await apiClient.post<{ id: string }>('notifications', {
        channel: 'sms',
        recipient: (guardian as unknown as Guardian).phone,
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

      if (!taskCardResponse.error && taskCardResponse.data && taskCardResponse.data.length > 0) {
        const cardId = ((taskCardResponse.data[0] as unknown) as { id: string }).id;
        await apiClient.patch('student_task_cards', cardId, {
          welcome_message_sent: true,
        });
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

  return (
    <Card padding="md" variant="default">
      <h3 style={{ marginBottom: 'var(--spacing-md)' }}>신규 등록 환영</h3>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
        신규 등록 학생을 위한 환영 메시지를 발송하고 초기 설정을 완료하세요.
      </p>

      {welcomeMessageSent ? (
        <div style={{
          padding: 'var(--spacing-md)',
          backgroundColor: 'var(--color-success-50)',
          borderRadius: 'var(--border-radius-md)',
          marginBottom: 'var(--spacing-md)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <span style={{ fontSize: 'var(--font-size-xl)' }}>완료</span>
            <span style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-semibold)' }}>
              환영 메시지가 이미 발송되었습니다.
            </span>
          </div>
        </div>
      ) : (
        <Button
          variant="solid"
          onClick={() => sendWelcomeMessage.mutate()}
          disabled={sendWelcomeMessage.isPending}
        >
          {sendWelcomeMessage.isPending ? '발송 중...' : '환영 메시지 발송'}
        </Button>
      )}
    </Card>
  );
}
