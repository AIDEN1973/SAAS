/**
 * 강사관리 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 강사 프로필 보기
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ErrorBoundary, useModal, useResponsiveMode , Container, Card, Button, Modal, Drawer, PageHeader, isMobile, isTablet, EmptyState, SubSidebar } from '@ui-core/react';
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
// [SSOT] Barrel export를 통한 통합 import
import { TEACHERS_SUB_MENU_ITEMS, DEFAULT_TEACHERS_SUB_MENU, TEACHERS_MENU_LABEL_MAPPING, getSubMenuFromUrl, setSubMenuToUrl, applyDynamicLabels } from '../constants';
import type { TeachersSubMenuId } from '../constants';
import { templates } from '../utils';

export function TeachersPage() {
  const { showConfirm, showAlert } = useModal();
  const terms = useIndustryTerms();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);
  // 서브사이드바 축소 상태 (태블릿 모드 기본값, 사용자 토글 가능)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isTabletMode);
  // 태블릿 모드 변경 시 축소 상태 동기화
  useEffect(() => {
    setSidebarCollapsed(isTabletMode);
  }, [isTabletMode]);

  // 서브 메뉴 상태
  const validIds = TEACHERS_SUB_MENU_ITEMS.map(item => item.id) as readonly TeachersSubMenuId[];
  const selectedSubMenu = getSubMenuFromUrl(searchParams, validIds, DEFAULT_TEACHERS_SUB_MENU);

  const handleSubMenuChange = useCallback((id: TeachersSubMenuId) => {
    const newUrl = setSubMenuToUrl(id, DEFAULT_TEACHERS_SUB_MENU);
    navigate(newUrl);
  }, [navigate]);

  // [업종중립] 동적 라벨이 적용된 서브 메뉴 아이템
  const subMenuItemsWithDynamicLabels = useMemo(() => {
    return applyDynamicLabels(TEACHERS_SUB_MENU_ITEMS, TEACHERS_MENU_LABEL_MAPPING, terms);
  }, [terms]);

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
      <div style={{ display: 'flex', height: 'var(--height-full)' }}>
        {/* 서브 사이드바 (모바일에서는 숨김, 태블릿에서는 축소) */}
        {!isMobileMode && (
          <SubSidebar
            title={templates.management(terms.PERSON_LABEL_SECONDARY)}
            items={subMenuItemsWithDynamicLabels}
            selectedId={selectedSubMenu}
            onSelect={handleSubMenuChange}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            testId="teachers-sub-sidebar"
          />
        )}

        {/* 메인 콘텐츠 */}
        <Container maxWidth="xl" padding="lg" style={{ flex: 1 }}>
          <PageHeader
            title={TEACHERS_SUB_MENU_ITEMS.find(item => item.id === selectedSubMenu)?.label || `${terms.PERSON_LABEL_SECONDARY} 관리`}
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

          {/* 강사 목록 탭 (기본) */}
          {selectedSubMenu === 'list' && (
            <>
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
            </>
          )}

          {/* 강사 통계 탭 */}
          {selectedSubMenu === 'statistics' && (
            <>
              <TeacherStatisticsTab terms={terms} />
            </>
          )}

          {/* 담당 과목 탭 */}
          {selectedSubMenu === 'assignments' && (
            <>
              <TeacherAssignmentsTab terms={terms} />
            </>
          )}

          {/* 강사 성과 탭 */}
          {selectedSubMenu === 'performance' && (
            <>
              <TeacherPerformanceTab terms={terms} />
            </>
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
      </div>
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
 * [P1-1] 담당 수업 목록 표시
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
  // P1-1: 담당 수업 목록 조회
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

      {/* P1-1: 담당 수업 목록 */}
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

/**
 * 강사 통계 탭 컴포넌트
 * 전체 강사 현황 통계를 표시
 */
function TeacherStatisticsTab({ terms }: { terms: ReturnType<typeof useIndustryTerms> }) {
  const { data: teachers, isLoading: isLoadingTeachers } = useTeachers();

  // 통계 계산
  const statistics = useMemo(() => {
    if (!teachers) return null;

    // 상태별 분포
    const byStatus = {
      active: teachers.filter(t => t.status === 'active').length,
      on_leave: teachers.filter(t => t.status === 'on_leave').length,
      resigned: teachers.filter(t => t.status === 'resigned').length,
    };

    // 전문 분야별 분포
    const bySpecialization: Record<string, number> = {};
    teachers.forEach(t => {
      if (t.specialization) {
        bySpecialization[t.specialization] = (bySpecialization[t.specialization] || 0) + 1;
      }
    });

    return {
      total: teachers.length,
      byStatus,
      bySpecialization,
    };
  }, [teachers]);

  if (isLoadingTeachers) {
    return (
      <Card padding="lg">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
          로딩 중...
        </div>
      </Card>
    );
  }

  if (!statistics) return null;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* 기본 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
        <Card padding="md">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
              {statistics.total}
            </div>
            <div style={{ color: 'var(--color-text-secondary)' }}>전체 {terms.PERSON_LABEL_SECONDARY}</div>
          </div>
        </Card>
        <Card padding="md">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
              {statistics.byStatus.active}
            </div>
            <div style={{ color: 'var(--color-text-secondary)' }}>{terms.STAFF_ACTIVE}</div>
          </div>
        </Card>
        <Card padding="md">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning)' }}>
              {statistics.byStatus.on_leave}
            </div>
            <div style={{ color: 'var(--color-text-secondary)' }}>{terms.STAFF_LEAVE}</div>
          </div>
        </Card>
        <Card padding="md">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-error)' }}>
              {statistics.byStatus.resigned}
            </div>
            <div style={{ color: 'var(--color-text-secondary)' }}>{terms.STAFF_RESIGNED}</div>
          </div>
        </Card>
      </div>

      {/* 상태별 분포 차트 */}
      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          상태별 분포
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {(Object.entries(statistics.byStatus) as [TeacherStatus, number][]).map(([status, count]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
              <div style={{ width: '100px', color: 'var(--color-text-secondary)' }}>{statusLabels[status]}</div>
              <div style={{ flex: 1, height: '24px', backgroundColor: 'var(--color-gray-100)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: statistics.total > 0 ? `${(count / statistics.total) * 100}%` : '0%',
                    height: '100%',
                    backgroundColor: statusColors[status],
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div style={{ width: '60px', textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>
                {count}명
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 전문 분야별 분포 */}
      {Object.keys(statistics.bySpecialization).length > 0 && (
        <Card padding="lg">
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
            전문 분야별 분포
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--spacing-sm)' }}>
            {Object.entries(statistics.bySpecialization).map(([specialization, count]) => (
              <div
                key={specialization}
                style={{
                  padding: 'var(--spacing-md)',
                  backgroundColor: 'var(--color-primary-50)',
                  borderRadius: 'var(--border-radius-md)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
                  {count}
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{specialization}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 강사 목록 (간략) */}
      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          {terms.PERSON_LABEL_SECONDARY} 목록
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          {teachers?.map(teacher => (
            <div
              key={teacher.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--spacing-sm)',
                backgroundColor: 'var(--color-background-secondary)',
                borderRadius: 'var(--border-radius-sm)',
                borderLeft: `3px solid ${statusColors[teacher.status]}`,
              }}
            >
              <div>
                <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{teacher.name}</span>
                {teacher.specialization && (
                  <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-sm)' }}>
                    ({teacher.specialization})
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  padding: 'var(--spacing-2xs) var(--spacing-xs)',
                  borderRadius: 'var(--border-radius-full)',
                  backgroundColor: `${statusColors[teacher.status]}20`,
                  color: statusColors[teacher.status],
                }}
              >
                {statusLabels[teacher.status]}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/**
 * 담당 과목 탭 컴포넌트
 * 강사별 담당 과목/수업 현황을 표시
 */
function TeacherAssignmentsTab({ terms }: { terms: ReturnType<typeof useIndustryTerms> }) {
  const { data: teachers, isLoading: isLoadingTeachers } = useTeachers();

  // 각 강사의 담당 수업 수는 TeacherAssignmentItem에서 개별 조회

  if (isLoadingTeachers) {
    return (
      <Card padding="lg">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
          로딩 중...
        </div>
      </Card>
    );
  }

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          {terms.PERSON_LABEL_SECONDARY}별 담당 {terms.GROUP_LABEL}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {teachers?.filter(t => t.status === 'active').map(teacher => (
            <TeacherAssignmentItem key={teacher.id} teacher={teacher} terms={terms} dayLabels={dayLabels} />
          ))}
          {teachers?.filter(t => t.status === 'active').length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
              활성 {terms.PERSON_LABEL_SECONDARY}가 없습니다.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/**
 * 강사 담당 과목 아이템 컴포넌트
 */
function TeacherAssignmentItem({
  teacher,
  terms,
  dayLabels,
}: {
  teacher: Teacher;
  terms: ReturnType<typeof useIndustryTerms>;
  dayLabels: Record<string, string>;
}) {
  const { data: stats } = useTeacherStatistics(teacher.id);
  const { data: assignedClasses } = useTeacherClasses(teacher.id);

  return (
    <div
      style={{
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-md)',
        borderLeft: 'var(--border-width-thick) solid var(--color-primary)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
        <div>
          <span style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-md)' }}>{teacher.name}</span>
          {teacher.specialization && (
            <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)' }}>
              {teacher.specialization}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>
            {stats?.total_classes || 0}개 {terms.GROUP_LABEL}
          </span>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-success)', fontWeight: 'var(--font-weight-semibold)' }}>
            {stats?.total_students || 0}명 {terms.PERSON_LABEL_PRIMARY}
          </span>
        </div>
      </div>

      {assignedClasses && assignedClasses.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
          {assignedClasses.map(ct => (
            <div
              key={ct.class_id}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                backgroundColor: ct.academy_classes.color || 'var(--color-gray-200)',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: 'var(--font-size-xs)',
              }}
            >
              <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{ct.academy_classes.name}</span>
              <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-xs)' }}>
                {dayLabels[ct.academy_classes.day_of_week]} {ct.academy_classes.start_time.substring(0, 5)}
              </span>
              {ct.role === 'assistant' && (
                <span style={{ color: 'var(--color-warning)', marginLeft: 'var(--spacing-xs)' }}>({terms.ASSISTANT_TEACHER})</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          담당 {terms.GROUP_LABEL}이 없습니다.
        </div>
      )}
    </div>
  );
}

/**
 * 강사 성과 탭 컴포넌트
 * 강사별 성과 분석을 표시
 */
function TeacherPerformanceTab({ terms }: { terms: ReturnType<typeof useIndustryTerms> }) {
  const { data: teachers, isLoading: isLoadingTeachers } = useTeachers();

  if (isLoadingTeachers) {
    return (
      <Card padding="lg">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
          로딩 중...
        </div>
      </Card>
    );
  }

  const activeTeachers = teachers?.filter(t => t.status === 'active') || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* 성과 요약 */}
      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          {terms.PERSON_LABEL_SECONDARY} 성과 현황
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {activeTeachers.map(teacher => (
            <TeacherPerformanceItem key={teacher.id} teacher={teacher} terms={terms} />
          ))}
          {activeTeachers.length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
              활성 {terms.PERSON_LABEL_SECONDARY}가 없습니다.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/**
 * 강사 성과 아이템 컴포넌트
 */
function TeacherPerformanceItem({
  teacher,
  terms,
}: {
  teacher: Teacher;
  terms: ReturnType<typeof useIndustryTerms>;
}) {
  const { data: stats } = useTeacherStatistics(teacher.id);

  // 성과 점수 계산 (담당 수업 수 * 2 + 담당 학생 수)
  const performanceScore = (stats?.total_classes || 0) * 2 + (stats?.total_students || 0);

  return (
    <div
      style={{
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-md)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
        <div>
          <span style={{ fontWeight: 'var(--font-weight-bold)' }}>{teacher.name}</span>
          {teacher.specialization && (
            <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)' }}>
              {teacher.specialization}
            </span>
          )}
        </div>
        <div
          style={{
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            backgroundColor: performanceScore > 20 ? 'var(--color-success-50)' : performanceScore > 10 ? 'var(--color-warning-50)' : 'var(--color-gray-100)',
            color: performanceScore > 20 ? 'var(--color-success)' : performanceScore > 10 ? 'var(--color-warning)' : 'var(--color-text-secondary)',
            borderRadius: 'var(--border-radius-full)',
            fontWeight: 'var(--font-weight-bold)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          점수: {performanceScore}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--spacing-sm)' }}>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-primary-50)', borderRadius: 'var(--border-radius-sm)' }}>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
            {stats?.total_classes || 0}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>담당 {terms.GROUP_LABEL}</div>
        </div>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-success-50)', borderRadius: 'var(--border-radius-sm)' }}>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
            {stats?.total_students || 0}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>담당 {terms.PERSON_LABEL_PRIMARY}</div>
        </div>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-warning-50)', borderRadius: 'var(--border-radius-sm)' }}>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning)' }}>
            {stats?.main_teacher_classes || 0}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{terms.HOMEROOM_TEACHER}</div>
        </div>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-gray-100)', borderRadius: 'var(--border-radius-sm)' }}>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-secondary)' }}>
            {stats?.assistant_classes || 0}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{terms.ASSISTANT_TEACHER}</div>
        </div>
      </div>
    </div>
  );
}
