/**
 * 학생 관리 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary, useModal, useResponsiveMode } from '@ui-core/react';
import { Container, Grid, Card, Button, Input, Modal, Drawer } from '@ui-core/react';
import { SchemaForm, SchemaFilter, SchemaTable } from '@schema-engine';
import { useStudents, useStudentTags, useStudentTagsByStudent, useCreateStudent, useBulkCreateStudents } from '@hooks/use-student';
import { useClasses } from '@hooks/use-class';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useSchema } from '@hooks/use-schema';
import type { StudentFilter, StudentStatus, Student, CreateStudentInput, Gender } from '@services/student-service';
import type { Tag } from '@core/tags';
import type { FormSchema } from '@schema-engine/types';
import { studentFormSchema } from '../schemas/student.schema';
import { createStudentFilterSchema } from '../schemas/student.filter.schema';
import { studentTableSchema } from '../schemas/student.table.schema';
// xlsx 동적 import로 로드 (필요한 경우만)

export function StudentsPage() {
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const isDesktop = mode === 'lg' || mode === 'xl';
  const [filter, setFilter] = useState<StudentFilter>({});

  // 아키텍처 문서 408-431줄: 기기별 자동 레이아웃 결정
  // PC: 테이블 형태, Tablet: 2열 카드, Mobile: 1열 카드
  const viewMode: 'card' | 'table' = isDesktop ? 'table' : 'card';
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false); // 아키텍처 문서 3.1.7: 고급 옵션 숨김

  // [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
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

  // Fallback: Registry에서 조회 실패 시 로컬 스키마 사용
  const effectiveFormSchema = studentFormSchemaData || studentFormSchema;
  const effectiveFilterSchema = studentFilterSchemaData || createStudentFilterSchema(classes || []);
  const effectiveTableSchema = studentTableSchemaData || studentTableSchema;

  const handleFilterChange = React.useCallback((filters: Record<string, unknown>) => {
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

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h1 style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-text)'
          }}>
            학생 관리
          </h1>

          {/* 검색 및 필터 패널 */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {/* SchemaFilter 사용 */}
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

              {/* 아키텍처 문서 408-431줄: 기기별 자동 레이아웃 결정으로 사용자 선택 제거 */}
              {/* PC: 테이블 자동, Tablet/Mobile: 카드 자동 */}

              {/* 학생 등록 버튼 */}
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <Button variant="solid" color="primary" onClick={() => setShowCreateForm(true)}>
                  학생 등록
                </Button>
                {/* 아키텍처 문서 3.1.7: 일괄 등록은 고급 옵션 */}
                {showAdvancedOptions && (
                  <Button
                    variant="outline"
                    color="primary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={bulkCreateStudents.isPending}
                  >
                    {bulkCreateStudents.isPending ? '등록 중..' : '엑셀 파일 일괄 등록'}
                  </Button>
                )}
                {/* 고급 옵션 토글 버튼 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                >
                  {showAdvancedOptions ? '고급 옵션 숨기기' : '고급 옵션'}
                </Button>
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
              </div>
            </div>
          </Card>

          {/* 태그 필터 - 아키텍처 문서 3.1.6: 고급 옵션 활성화 시에만 표시 */}
          {showAdvancedOptions && tags && tags.length > 0 && (
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
              {viewMode === 'card' && (
                <Grid
                  columns={{
                    xs: 1,      // Mobile: 1열 (아키텍처 문서 431줄)
                    sm: 1,      // Mobile: 1열
                    md: 2,      // Tablet: 2열 (아키텍처 문서 419줄)
                    // lg, xl은 viewMode가 'table'이므로 사용되지 않음
                  }}
                  gap="md"
                >
                  {students.map((student) => (
                    <StudentCard
                      key={student.id}
                      student={student}
                      onDetailClick={() => navigate(`/students/${student.id}`)}
                    />
                  ))}
                </Grid>
              )}
              {viewMode === 'table' && effectiveTableSchema && (
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
        </div>
      </Container>
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
