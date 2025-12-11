/**
 * 강사 관리 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 강사 프로필 보기
 */

import React, { useState } from 'react';
import { ErrorBoundary, useModal, useResponsiveMode } from '@ui-core/react';
import { Container, Card, Button, Modal, Drawer } from '@ui-core/react';
import { SchemaForm, SchemaFilter } from '@schema-engine';
import { useSchema } from '@hooks/use-schema';
import {
  useTeachers,
  useTeacher,
  useCreateTeacher,
  useUpdateTeacher,
  useDeleteTeacher,
} from '@hooks/use-class';
import type { Teacher, CreateTeacherInput, UpdateTeacherInput, TeacherFilter, TeacherStatus } from '@services/class-service';
import { teacherFormSchema } from '../schemas/teacher.schema';
import { teacherFilterSchema } from '../schemas/teacher.filter.schema';

export function TeachersPage() {
  const { showConfirm } = useModal();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const [filter, setFilter] = useState<TeacherFilter>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);

  const { data: teachers, isLoading, error } = useTeachers({
    ...filter,
    search: filter.search?.trim() || undefined, // 빈 문자열이면 undefined로 변환
  });
  const createTeacher = useCreateTeacher();
  const updateTeacher = useUpdateTeacher();
  const deleteTeacher = useDeleteTeacher();

  // Schema Registry 연동 (아키텍처 문서 S3 참조)
  const { data: teacherFormSchemaData } = useSchema('teacher', teacherFormSchema, 'form');
  const { data: teacherFilterSchemaData } = useSchema('teacher_filter', teacherFilterSchema, 'filter');

  // Fallback: Registry에서 조회 실패 시 로컬 스키마 사용
  const effectiveFormSchema = teacherFormSchemaData || teacherFormSchema;
  const effectiveFilterSchema = teacherFilterSchemaData || teacherFilterSchema;

  const handleFilterChange = React.useCallback((filters: Record<string, any>) => {
    setFilter({
      search: filters.search || undefined,
      status: filters.status || undefined,
    });
  }, []);

  const handleCreateTeacher = async (input: CreateTeacherInput) => {
    try {
      await createTeacher.mutateAsync(input);
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create teacher:', error);
    }
  };

  const handleUpdateTeacher = async (teacherId: string, input: UpdateTeacherInput) => {
    try {
      await updateTeacher.mutateAsync({ teacherId, input });
      setEditingTeacherId(null);
    } catch (error) {
      console.error('Failed to update teacher:', error);
    }
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <h1 style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text)'
            }}>
              강사 관리
            </h1>
            <Button
              variant="solid"
              size="sm"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              강사 등록
            </Button>
          </div>

          {/* 검색 및 필터 패널 */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <SchemaFilter
              schema={effectiveFilterSchema}
              onFilterChange={handleFilterChange}
              defaultValues={{
                search: filter.search || '',
                status: filter.status || '',
              }}
            />
          </Card>

          {/* 강사 등록 폼 - 반응형: 모바일/태블릿은 드로어, 데스크톱은 인라인 */}
          {showCreateForm && (
            <>
              {isMobile || isTablet ? (
                // 모바일/태블릿: Drawer 사용 (아키텍처 문서 6-1 참조)
                <Drawer
                  isOpen={showCreateForm}
                  onClose={() => setShowCreateForm(false)}
                  title="강사 등록"
                  position={isMobile ? 'bottom' : 'right'}
                  width={isTablet ? '500px' : '100%'}
                >
                  <CreateTeacherForm
                    onSubmit={handleCreateTeacher}
                    onCancel={() => setShowCreateForm(false)}
                    effectiveFormSchema={effectiveFormSchema}
                  />
                </Drawer>
              ) : (
                // 데스크톱: 인라인 폼 (기존 방식)
                <CreateTeacherForm
                  onSubmit={handleCreateTeacher}
                  onCancel={() => setShowCreateForm(false)}
                  effectiveFormSchema={effectiveFormSchema}
                />
              )}
            </>
          )}

          {/* 강사 목록 */}
          {isLoading ? (
            <Card padding="lg" variant="default">
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                로딩 중...
              </div>
            </Card>
          ) : error ? (
            <Card padding="md" variant="outlined">
              <div style={{ color: 'var(--color-error)', padding: 'var(--spacing-md)' }}>
                오류: {error.message}
              </div>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--spacing-md)' }}>
              {teachers?.map((teacher) => (
                <TeacherCard
                  key={teacher.id}
                  teacher={teacher}
                  onEdit={(teacherId) => setEditingTeacherId(teacherId)}
                  onDelete={async (teacherId) => {
                    const confirmed = await showConfirm('정말 이 강사를 삭제하시겠습니까?', '강사 삭제');
                    if (confirmed) {
                      await deleteTeacher.mutateAsync(teacherId);
                    }
                  }}
                />
              ))}
              {teachers?.length === 0 && (
                <Card padding="lg" variant="default">
                  <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    등록된 강사가 없습니다.
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* 강사 수정 모달 */}
          {editingTeacherId && (
            <EditTeacherModal
              teacherId={editingTeacherId}
              onSave={handleUpdateTeacher}
              onClose={() => setEditingTeacherId(null)}
            />
          )}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

/**
 * 강사 등록 폼
 */
function CreateTeacherForm({
  onSubmit,
  onCancel,
  effectiveFormSchema,
}: {
  onSubmit: (input: CreateTeacherInput) => void;
  onCancel: () => void;
  effectiveFormSchema: any;
}) {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const showHeader = !isMobile && !isTablet;

  const handleSubmit = async (data: any) => {
    // 스키마에서 받은 데이터를 CreateTeacherInput 형식으로 변환
    const input: CreateTeacherInput = {
      name: data.name || '',
      email: data.email || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      employee_id: data.employee_id || undefined,
      specialization: data.specialization || undefined,
      hire_date: data.hire_date || undefined,
      status: data.status || 'active',
      profile_image_url: data.profile_image_url || undefined,
      bio: data.bio || undefined,
      notes: data.notes || undefined,
    };
    onSubmit(input);
  };

  return (
    <div style={showHeader ? { marginBottom: 'var(--spacing-md)' } : {}}>
      {showHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>강사 등록</h3>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            취소
          </Button>
        </div>
      )}
      <SchemaForm
        schema={effectiveFormSchema}
        onSubmit={handleSubmit}
        defaultValues={{
          status: 'active',
        }}
        actionContext={{
          apiCall: async (endpoint: string, method: string, body?: any) => {
            const { apiClient } = await import('@api-sdk/core');
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
        }}
      />
    </div>
  );
}

/**
 * 강사 수정 모달
 */
function EditTeacherModal({
  teacherId,
  onSave,
  onClose,
}: {
  teacherId: string;
  onSave: (teacherId: string, input: UpdateTeacherInput) => Promise<void>;
  onClose: () => void;
}) {
  const { data: teacher, isLoading } = useTeacher(teacherId);

  // Schema Registry 연동 (아키텍처 문서 S3 참조)
  const { data: teacherFormSchemaData } = useSchema('teacher', teacherFormSchema, 'form');
  const effectiveFormSchema = teacherFormSchemaData || teacherFormSchema;

  const handleSubmit = async (data: any) => {
    const input: UpdateTeacherInput = {
      name: data.name || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      employee_id: data.employee_id || undefined,
      specialization: data.specialization || undefined,
      hire_date: data.hire_date || undefined,
      status: data.status || undefined,
      profile_image_url: data.profile_image_url || undefined,
      bio: data.bio || undefined,
      notes: data.notes || undefined,
    };
    await onSave(teacherId, input);
  };

  if (isLoading) {
    return (
      <Modal isOpen={true} onClose={onClose} title="강사 수정" size="lg">
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>
      </Modal>
    );
  }

  if (!teacher) {
    return (
      <Modal isOpen={true} onClose={onClose} title="강사 수정" size="lg">
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>강사를 찾을 수 없습니다.</div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="강사 수정" size="lg">
      <SchemaForm
        schema={effectiveFormSchema}
        onSubmit={handleSubmit}
        defaultValues={{
          name: teacher.name,
          email: teacher.email || '',
          phone: teacher.phone || '',
          address: teacher.address || '',
          employee_id: teacher.employee_id || '',
          specialization: teacher.specialization || '',
          hire_date: teacher.hire_date || '',
          status: teacher.status,
          profile_image_url: teacher.profile_image_url || '',
          bio: teacher.bio || '',
          notes: teacher.notes || '',
        }}
        actionContext={{
          apiCall: async (endpoint: string, method: string, body?: any) => {
            const { apiClient } = await import('@api-sdk/core');
            if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
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
            // showAlert는 useModal에서 가져와야 하지만, 여기서는 handleSubmit에서 처리
          },
        }}
      />
    </Modal>
  );
}

/**
 * 강사 카드 (프로필 보기)
 * [요구사항] 강사 프로필 보기
 */
function TeacherCard({
  teacher,
  onEdit,
  onDelete,
}: {
  teacher: Teacher;
  onEdit: (teacherId: string) => void;
  onDelete: (teacherId: string) => Promise<void>;
}) {
  const statusLabels: Record<TeacherStatus, string> = {
    active: '재직중',
    on_leave: '휴직',
    resigned: '퇴직',
  };

  const statusColors: Record<TeacherStatus, string> = {
    active: 'var(--color-success)',
    on_leave: 'var(--color-warning)',
    resigned: 'var(--color-error)',
  };

  return (
    <Card
      padding="md"
      variant="default"
      style={{
        borderLeft: `var(--border-width-thick) solid ${statusColors[teacher.status]}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-sm)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>
              {teacher.name}
            </h3>
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                borderRadius: 'var(--border-radius-full)',
                backgroundColor: `${statusColors[teacher.status]}20`,
                color: statusColors[teacher.status],
              }}
            >
              {statusLabels[teacher.status]}
            </span>
          </div>
          {teacher.employee_id && (
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              사원번호: {teacher.employee_id}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
          <Button size="xs" variant="ghost" onClick={() => onEdit(teacher.id)}>
            수정
          </Button>
          <Button size="xs" variant="ghost" onClick={() => onDelete(teacher.id)}>
            삭제
          </Button>
        </div>
      </div>

      {teacher.profile_image_url && (
        <div style={{ marginBottom: 'var(--spacing-sm)' }}>
          <img
            src={teacher.profile_image_url}
            alt={teacher.name}
            style={{
              width: '100%',
              maxWidth: '200px',
              height: 'auto',
              borderRadius: 'var(--border-radius-md)',
            }}
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
        {teacher.specialization && <div>전문 분야: {teacher.specialization}</div>}
        {teacher.phone && <div>전화: {teacher.phone}</div>}
        {teacher.email && <div>이메일: {teacher.email}</div>}
        {teacher.hire_date && <div>입사일: {teacher.hire_date}</div>}
        {teacher.bio && (
          <div style={{ marginTop: 'var(--spacing-xs)', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--border-radius-md)' }}>
            {teacher.bio}
          </div>
        )}
      </div>
    </Card>
  );
}
