/**
 * 학생 관리 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary, useModal } from '@ui-core/react';
import { Container, Grid, Card, Button, Input } from '@ui-core/react';
import { SchemaForm, SchemaFilter, SchemaTable } from '@schema-engine';
import { useStudents, useStudentTags, useStudentTagsByStudent, useCreateStudent, useBulkCreateStudents } from '@hooks/use-student';
import { useClasses } from '@hooks/use-class';
import { apiClient, getApiContext } from '@api-sdk/core';
import type { StudentFilter, StudentStatus, Student, CreateStudentInput } from '@services/student-service';
import type { Tag } from '@core/tags';
import { studentFormSchema } from '../schemas/student.schema';
import { createStudentFilterSchema } from '../schemas/student.filter.schema';
import { studentTableSchema } from '../schemas/student.table.schema';
// xlsx 동적 import로 로드 (필요한 경우만)

export function StudentsPage() {
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const [filter, setFilter] = useState<StudentFilter>({});
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [showCreateForm, setShowCreateForm] = useState(false);

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
  const studentTableSchemaData = studentTableSchema;

  const handleFilterChange = React.useCallback((filters: Record<string, any>) => {
    setFilter((prev) => ({
      search: filters.search || undefined,
      status: filters.status || undefined,
      grade: filters.grade || undefined,
      class_id: filters.class_id || undefined,
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
                schema={createStudentFilterSchema(classes)}
                onFilterChange={handleFilterChange}
                defaultValues={{
                  search: filter.search || '',
                  status: filter.status || '',
                  grade: filter.grade || '',
                  class_id: filter.class_id || '',
                }}
              />

              {/* 보기 모드 전환 */}
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <Button
                  variant={viewMode === 'card' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('card')}
                >
                  카드
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                >
                  테이블
                </Button>
              </div>

              {/* 학생 등록 버튼 */}
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <Button variant="solid" color="primary" onClick={() => setShowCreateForm(true)}>
                  학생 등록
                </Button>
                <Button
                  variant="outline"
                  color="primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={bulkCreateStudents.isPending}
                >
                  {bulkCreateStudents.isPending ? '등록 중..' : '엑셀 파일 일괄 등록'}
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
                      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

                      // CreateStudentInput 형식으로 변환
                      const students: CreateStudentInput[] = jsonData.map((row: any) => ({
                        name: row['이름'] || row['name'] || '',
                        birth_date: row['생년월일'] || row['birth_date'] || '',
                        gender: (row['성별'] || row['gender'] || undefined) as any,
                        phone: row['전화번호'] || row['phone'] || '',
                        email: row['이메일'] || row['email'] || '',
                        address: row['주소'] || row['address'] || '',
                        school_name: row['학교'] || row['school_name'] || '',
                        grade: row['학년'] || row['grade'] || '',
                        status: (row['상태'] || row['status'] || 'active') as StudentStatus,
                        notes: row['비고'] || row['notes'] || '',
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
                      console.error('엑셀 일괄 등록 실패:', error);
                      showAlert('엑셀 일괄 등록에 실패했습니다.', '오류', 'error');
                    }
                  }}
                />
              </div>
            </div>
          </Card>

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
                    color: filter.tag_ids?.includes(tag.id) ? '#ffffff' : undefined,
                  }}
                >
                  {tag.name}
                </Button>
              ))}
            </div>
          )}

          {/* 학생 등록 폼 */}
          {showCreateForm && (
            <CreateStudentForm
              onClose={() => setShowCreateForm(false)}
              onSubmit={async (data) => {
                await createStudent.mutateAsync(data);
                setShowCreateForm(false);
              }}
            />
          )}

          {/* 학생 목록 */}
          {isLoading && (
            <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              로딩 중..
            </div>
          )}
          {error && (
            <Card padding="md" variant="outlined">
              <div style={{ color: '#ef4444' }}>오류: {error.message}</div>
            </Card>
          )}
          {students && viewMode === 'card' && (
            <Grid columns={3} gap="md">
              {students.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  tags={tags || []}
                  onDetailClick={() => navigate(`/students/${student.id}`)}
                />
              ))}
            </Grid>
          )}
          {viewMode === 'table' && studentTableSchemaData && (
            <SchemaTable
              key={`student-table-${JSON.stringify(filter)}`}
              schema={studentTableSchemaData}
              apiCall={async (endpoint: string, method: string) => {
                const response = await apiClient.get<Student>('students', {
                  filters: {
                    ...(filter.status && { status: filter.status }),
                    ...(filter.grade && { grade: filter.grade }),
                    ...(filter.class_id && { class_id: filter.class_id }),
                  },
                  orderBy: { column: 'created_at', ascending: false },
                });
                if (response.error) {
                  throw new Error(response.error.message);
                }
                // 필터 적용
                let filteredData = response.data || [];
                if (filter.search) {
                  const searchLower = filter.search.toLowerCase();
                  filteredData = filteredData.filter((s) =>
                    s.name.toLowerCase().includes(searchLower) ||
                    s.phone?.toLowerCase().includes(searchLower) ||
                    s.email?.toLowerCase().includes(searchLower)
                  );
                }
                if (filter.tag_ids && filter.tag_ids.length > 0) {
                  // 태그 필터는 클라이언트 측에서 처리 (API에서 지원하지 않는 경우)
                  // TODO: API에서 태그 필터 지원 시 서버 측으로 이동
                }
                return filteredData;
              }}
            />
          )}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

interface StudentCardProps {
  student: Student;
  tags: Array<{ id: string; name: string; color: string }>;
  onDetailClick: () => void;
}

function StudentCard({ student, tags, onDetailClick }: StudentCardProps) {
  const { data: studentTags } = useStudentTagsByStudent(student.id);
  const displayedTags = studentTags || [];

  const statusConfig = {
    active: { label: '재원', bgColor: 'var(--color-green-100)', textColor: 'var(--color-green-800)' },
    on_leave: { label: '휴원', bgColor: 'var(--color-yellow-100)', textColor: 'var(--color-yellow-800)' },
    withdrawn: { label: '퇴원', bgColor: 'var(--color-gray-100)', textColor: 'var(--color-gray-800)' },
  };

  const status = student.status as keyof typeof statusConfig;
  const statusInfo = statusConfig[status] || statusConfig.withdrawn;

  return (
    <Card
      variant="elevated"
      padding="md"
      style={{ cursor: 'pointer', transition: 'box-shadow 0.3s ease-in-out' }}
      onClick={onDetailClick}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>{student.name}</h3>
        <span
          style={{
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            fontSize: 'var(--font-size-xs)',
            borderRadius: '0.25rem',
            backgroundColor: statusInfo.bgColor,
            color: statusInfo.textColor,
          }}
        >
          {statusInfo.label}
        </span>
      </div>

      {student.grade && (
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--spacing-sm)'
        }}>
          학년: {student.grade}
        </p>
      )}

      {(studentTags || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-sm)' }}>
          {(studentTags || []).map((tag: { id: string; name: string; color: string }) => (
            <span
              key={tag.id}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                fontSize: '0.75rem',
                borderRadius: '0.25rem',
                color: '#ffffff',
                backgroundColor: tag.color,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <Grid columns={2} gap="sm" style={{ marginTop: 'var(--spacing-md)' }}>
        <Button variant="outline" size="sm" fullWidth onClick={(e) => { e.stopPropagation(); onDetailClick(); }}>
          상세
        </Button>
        <Button variant="outline" size="sm" fullWidth onClick={(e) => { e.stopPropagation(); onDetailClick(); }}>
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
}

function CreateStudentForm({ onClose, onSubmit }: CreateStudentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showAlert } = useModal();

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      // 스키마에서 받은 데이터를 CreateStudentInput 형식으로 변환
      const input: CreateStudentInput = {
        name: data.name || '',
        birth_date: data.birth_date || undefined,
        gender: data.gender || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        school_name: data.school_name || undefined,
        grade: data.grade || undefined,
        status: data.status || 'active',
        notes: data.notes || undefined,
      };
      await onSubmit(input);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>학생 등록</h3>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
          닫기
        </Button>
      </div>
      <SchemaForm
        schema={studentFormSchema}
        onSubmit={handleSubmit}
        defaultValues={{
          status: 'active',
        }}
        actionContext={{
          apiCall: async (endpoint: string, method: string, body?: any) => {
            if (method === 'POST') {
              const response = await apiClient.post(endpoint, body);
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
  );
}
