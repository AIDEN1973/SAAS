/**
 * 강사관리 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 강사 프로필 보기
 */

import React, { useState, useCallback } from 'react';
import { ErrorBoundary, useModal, useResponsiveMode , Container, Card, Button, Modal, Drawer, PageHeader, isMobile, isTablet, EmptyState } from '@ui-core/react';
import { UserCog } from 'lucide-react';
import { SchemaForm, SchemaFilter } from '@schema-engine';
import { useSchema } from '@hooks/use-schema';
import {
  useTeachers,
  useTeacher,
  useCreateTeacher,
  useUpdateTeacher,
  useDeleteTeacher,
  useTeacherStatistics,
  useTeacherClasses,
} from '@hooks/use-class';
import type { Teacher, CreateTeacherInput, UpdateTeacherInput, TeacherFilter, TeacherStatus } from '@services/class-service';
import { apiClient } from '@api-sdk/core';
import { teacherFormSchema } from '../schemas/teacher.schema';
import type { FormSchema } from '@schema-engine/types';
import { teacherFilterSchema } from '../schemas/teacher.filter.schema';
import { useIndustryTerms } from '@hooks/use-industry-terms';

export function TeachersPage() {
  const { showConfirm, showAlert } = useModal();
  const terms = useIndustryTerms();
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);
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

  const handleFilterChange = useCallback((filters: Record<string, unknown>) => {
    setFilter({
      search: typeof filters.search === 'string' ? filters.search : undefined,
      status: filters.status as TeacherStatus | TeacherStatus[] | undefined,
    });
  }, []);

  const handleCreateTeacher = async (input: CreateTeacherInput) => {
    try {
      await createTeacher.mutateAsync(input);
      setShowCreateForm(false);
    } catch (error) {
      // 에러는 showAlert로 사용자에게 표시 (아키텍처 문서 6-3 참조)
      showAlert(
        error instanceof Error ? error.message : `${terms.PERSON_LABEL_SECONDARY} 등록에 실패했습니다.`,
        '오류',
        'error'
      );
    }
  };

  const handleUpdateTeacher = async (teacherId: string, input: UpdateTeacherInput): Promise<void> => {
    try {
      await updateTeacher.mutateAsync({ teacherId, input });
      setEditingTeacherId(null);
    } catch (error) {
      // 에러는 showAlert로 사용자에게 표시 (아키텍처 문서 6-3 참조)
      showAlert(
        error instanceof Error ? error.message : `${terms.PERSON_LABEL_SECONDARY} 수정에 실패했습니다.`,
        '오류',
        'error'
      );
    }
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <PageHeader
          title={`${terms.PERSON_LABEL_SECONDARY} 관리`}
          actions={
            <Button
              variant="solid"
              size="sm"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {terms.PERSON_LABEL_SECONDARY} 등록
            </Button>
          }
        />

        {/* 검색 및 필터 패널 */}
        <SchemaFilter
          schema={effectiveFilterSchema}
          onFilterChange={handleFilterChange}
          defaultValues={{
            search: filter.search || '',
            status: filter.status || '',
          }}
        />

        {/* 강사 등록 폼 - 반응형: 모바일/태블릿은 드로어, 데스크톱은 인라인 */}
          {showCreateForm && (
            <>
              {isMobileMode || isTabletMode ? (
                // 모바일/태블릿: Drawer 사용 (아키텍처 문서 6-1 참조)
                <Drawer
                  isOpen={showCreateForm}
                  onClose={() => setShowCreateForm(false)}
                  title={`${terms.PERSON_LABEL_SECONDARY} 등록`}
                  position={isMobileMode ? 'bottom' : 'right'}
                  width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
                >
                  <CreateTeacherForm
                    onSubmit={handleCreateTeacher}
                    onCancel={() => setShowCreateForm(false)}
                    effectiveFormSchema={effectiveFormSchema}
                    terms={terms}
                  />
                </Drawer>
              ) : (
                // 데스크톱: 인라인 폼 (기존 방식)
                <CreateTeacherForm
                  onSubmit={handleCreateTeacher}
                  onCancel={() => setShowCreateForm(false)}
                  effectiveFormSchema={effectiveFormSchema}
                  terms={terms}
                />
              )}
            </>
          )}

          {/* 강사 목록 */}
          {isLoading ? (
            <Card padding="lg">
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                로딩 중...
              </div>
            </Card>
          ) : error ? (
            <Card padding="md">
              <div style={{ color: 'var(--color-error)', padding: 'var(--spacing-md)' }}>
                오류: {error.message}
              </div>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(var(--width-card-min), 1fr))`, gap: 'var(--spacing-md)' }}>
              {teachers?.map((teacher) => (
                <TeacherCard
                  key={teacher.id}
                  teacher={teacher}
                  onEdit={(teacherId) => setEditingTeacherId(teacherId)}
                  onDelete={async (teacherId) => {
                    const confirmed = await showConfirm(`정말 이 ${terms.PERSON_LABEL_SECONDARY}를 삭제하시겠습니까?`, `${terms.PERSON_LABEL_SECONDARY} 삭제`);
                    if (confirmed) {
                      try {
                      await deleteTeacher.mutateAsync(teacherId);
                      } catch (error) {
                        // 에러는 showAlert로 사용자에게 표시 (아키텍처 문서 6-3 참조)
                        showAlert(
                          error instanceof Error ? error.message : `${terms.PERSON_LABEL_SECONDARY} 삭제에 실패했습니다.`,
                          '오류',
                          'error'
                        );
                      }
                    }
                  }}
                  terms={terms}
                />
              ))}
              {teachers?.length === 0 && (
                <Card padding="lg">
                  <EmptyState
                    icon={UserCog}
                    message={`등록된 ${terms.PERSON_LABEL_SECONDARY}가 없습니다.`}
                  />
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
              terms={terms}
            />
          )}
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
  terms,
}: {
  onSubmit: (input: CreateTeacherInput) => void;
  onCancel: () => void;
  effectiveFormSchema: FormSchema;
  terms: ReturnType<typeof useIndustryTerms>;
}) {
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);
  const showHeader = !isMobileMode && !isTabletMode;

  const handleSubmit = (data: Record<string, unknown>) => {
    // 스키마에서 받은 데이터를 CreateTeacherInput 형식으로 변환
    const input: CreateTeacherInput = {
      name: typeof data.name === 'string' ? data.name : '',
      email: typeof data.email === 'string' ? data.email : undefined,
      phone: typeof data.phone === 'string' ? data.phone : undefined,
      address: typeof data.address === 'string' ? data.address : undefined,
      employee_id: typeof data.employee_id === 'string' ? data.employee_id : undefined,
      specialization: typeof data.specialization === 'string' ? data.specialization : undefined,
      hire_date: typeof data.hire_date === 'string' ? data.hire_date : undefined,
      status: (data.status as TeacherStatus) || 'active',
      profile_image_url: typeof data.profile_image_url === 'string' ? data.profile_image_url : undefined,
      bio: typeof data.bio === 'string' ? data.bio : undefined,
      notes: typeof data.notes === 'string' ? data.notes : undefined,
    };
    onSubmit(input);
  };

  return (
    <div style={showHeader ? { marginBottom: 'var(--spacing-md)' } : {}}>
      {showHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>{terms.PERSON_LABEL_SECONDARY} 등록</h3>
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
  terms,
}: {
  teacherId: string;
  onSave: (teacherId: string, input: UpdateTeacherInput) => Promise<void>;
  onClose: () => void;
  terms: ReturnType<typeof useIndustryTerms>;
}) {
  const { showAlert } = useModal();
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);
  const { data: teacher, isLoading } = useTeacher(teacherId);

  // Schema Registry 연동 (아키텍처 문서 S3 참조)
  const { data: teacherFormSchemaData } = useSchema('teacher', teacherFormSchema, 'form');
  const effectiveFormSchema = teacherFormSchemaData || teacherFormSchema;

  const handleSubmit = async (data: Record<string, unknown>) => {
    const input: UpdateTeacherInput = {
      name: typeof data.name === 'string' ? data.name : undefined,
      email: typeof data.email === 'string' ? data.email : undefined,
      phone: typeof data.phone === 'string' ? data.phone : undefined,
      address: typeof data.address === 'string' ? data.address : undefined,
      employee_id: typeof data.employee_id === 'string' ? data.employee_id : undefined,
      specialization: typeof data.specialization === 'string' ? data.specialization : undefined,
      hire_date: typeof data.hire_date === 'string' ? data.hire_date : undefined,
      status: data.status as TeacherStatus | undefined,
      profile_image_url: typeof data.profile_image_url === 'string' ? data.profile_image_url : undefined,
      bio: typeof data.bio === 'string' ? data.bio : undefined,
      notes: typeof data.notes === 'string' ? data.notes : undefined,
    };
    await onSave(teacherId, input);
  };

  // 반응형 처리: 모바일/태블릿은 Drawer, 데스크톱은 Modal (아키텍처 문서 6-1 참조)
  if (isLoading) {
    if (isMobileMode || isTabletMode) {
      return (
        <Drawer
          isOpen={true}
          onClose={onClose}
          title={`${terms.PERSON_LABEL_SECONDARY} 수정`}
          position={isMobileMode ? 'bottom' : 'right'}
          width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
        >
          <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>
        </Drawer>
      );
    }
    return (
      <Modal isOpen={true} onClose={onClose} title={`${terms.PERSON_LABEL_SECONDARY} 수정`} size="lg">
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>
      </Modal>
    );
  }

  if (!teacher) {
    if (isMobileMode || isTabletMode) {
      return (
        <Drawer
          isOpen={true}
          onClose={onClose}
          title={`${terms.PERSON_LABEL_SECONDARY} 수정`}
          position={isMobileMode ? 'bottom' : 'right'}
          width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
        >
          <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>{terms.PERSON_LABEL_SECONDARY}를 찾을 수 없습니다.</div>
        </Drawer>
      );
    }
    return (
      <Modal isOpen={true} onClose={onClose} title={`${terms.PERSON_LABEL_SECONDARY} 수정`} size="lg">
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>{terms.PERSON_LABEL_SECONDARY}를 찾을 수 없습니다.</div>
      </Modal>
    );
  }

  const formContent = (
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
          apiCall: async (endpoint: string, method: string, body?: unknown) => {
            if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
              const response = await apiClient.post(endpoint, (body ?? {}) as Record<string, unknown>);
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
  );

  // 모바일/태블릿: Drawer 사용 (아키텍처 문서 6-1 참조)
  if (isMobileMode || isTabletMode) {
    return (
      <Drawer
        isOpen={true}
        onClose={onClose}
        title={`${terms.PERSON_LABEL_SECONDARY} 수정`}
        position={isMobileMode ? 'bottom' : 'right'}
        width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
      >
        {formContent}
      </Drawer>
    );
  }

  // 데스크톱: Modal 사용
  return (
    <Modal isOpen={true} onClose={onClose} title={`${terms.PERSON_LABEL_SECONDARY} 수정`} size="lg">
      {formContent}
    </Modal>
  );
}

/**
 * 강사 카드 (프로필 보기)
 * [요구사항] 강사 프로필 보기
 * [P1-1] 담당 반 목록 표시
 * [P1-3] 강사 통계 표시
 */
function TeacherCard({
  teacher,
  onEdit,
  onDelete,
  terms,
}: {
  teacher: Teacher;
  onEdit: (teacherId: string) => void;
  onDelete: (teacherId: string) => Promise<void>;
  terms: ReturnType<typeof useIndustryTerms>;
}) {
  // P1-3: 강사 통계 조회
  const { data: stats } = useTeacherStatistics(teacher.id);
  // P1-1: 담당 반 목록 조회
  const { data: assignedClasses } = useTeacherClasses(teacher.id);

  const statusLabels: Record<TeacherStatus, string> = {
    active: terms.STAFF_ACTIVE,
    on_leave: terms.STAFF_LEAVE,
    resigned: terms.STAFF_RESIGNED,
  };

  const statusColors: Record<TeacherStatus, string> = {
    active: 'var(--color-success)',
    on_leave: 'var(--color-warning)',
    resigned: 'var(--color-error)',
  };

  const dayLabels: Record<string, string> = {
    monday: '월',
    tuesday: '화',
    wednesday: '수',
    thursday: '목',
    friday: '금',
    saturday: '토',
    sunday: '일',
  };

  return (
    <Card
      padding="md"
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
            <div style={{ color: 'var(--color-text-secondary)' }}>
              {terms.STAFF_ID_LABEL}: {teacher.employee_id}
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
            loading="lazy"
            decoding="async"
            style={{
              width: '100%',
              maxWidth: 'var(--width-student-info-min)',
              height: 'auto',
              borderRadius: 'var(--border-radius-md)',
            }}
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', color: 'var(--color-text-secondary)' }}>
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

      {/* P1-3: 강사 통계 카드 */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)', paddingTop: 'var(--spacing-sm)', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--border-radius-sm)' }}>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
              {stats.total_classes}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              담당 {terms.GROUP_LABEL}
            </div>
            {stats.main_teacher_classes > 0 && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--spacing-xs)' }}>
                {terms.HOMEROOM_TEACHER} {stats.main_teacher_classes}개
              </div>
            )}
          </div>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--border-radius-sm)' }}>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
              {stats.total_students}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              담당 {terms.PERSON_LABEL_PRIMARY}
            </div>
            {stats.assistant_classes > 0 && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--spacing-xs)' }}>
                {terms.ASSISTANT_TEACHER} {stats.assistant_classes}개
              </div>
            )}
          </div>
        </div>
      )}

      {/* P1-1: 담당 반 목록 */}
      {assignedClasses && assignedClasses.length > 0 && (
        <div style={{ marginTop: 'var(--spacing-sm)', paddingTop: 'var(--spacing-sm)', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}>
            담당 {terms.GROUP_LABEL} 목록 ({assignedClasses.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            {assignedClasses.map((ct) => (
              <div
                key={ct.class_id}
                style={{
                  padding: 'var(--spacing-xs)',
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderRadius: 'var(--border-radius-sm)',
                  borderLeft: `3px solid ${ct.academy_classes.color || 'var(--color-border)'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)' }}>
                    {ct.academy_classes.name}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      padding: '2px var(--spacing-xs)',
                      borderRadius: 'var(--border-radius-full)',
                      backgroundColor: ct.role === 'teacher' ? 'var(--color-primary)20' : 'var(--color-secondary)20',
                      color: ct.role === 'teacher' ? 'var(--color-primary)' : 'var(--color-secondary)',
                    }}
                  >
                    {ct.role === 'teacher' ? terms.HOMEROOM_TEACHER : terms.ASSISTANT_TEACHER}
                  </div>
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {dayLabels[ct.academy_classes.day_of_week]} {ct.academy_classes.start_time.substring(0, 5)} ~ {ct.academy_classes.end_time.substring(0, 5)}
                  {ct.academy_classes.room && ` | ${ct.academy_classes.room}`}
                  {ct.academy_classes.subject && ` | ${ct.academy_classes.subject}`}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                  {ct.academy_classes.current_count}/{ct.academy_classes.capacity}명
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
