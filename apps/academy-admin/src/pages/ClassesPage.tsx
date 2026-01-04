/**
 * 수업 관리 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 수업 리스트 + 캘린더 뷰 생성 (Calendar-like) 제공
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ErrorBoundary, useModal, useResponsiveMode , Container, Card, Button, Modal, Drawer, PageHeader, isMobile, isTablet } from '@ui-core/react';
import { SchemaForm, SchemaFilter } from '@schema-engine';
import { apiClient } from '@api-sdk/core';
import { useSchema } from '@hooks/use-schema';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { toKST } from '@lib/date-utils';
import {
  useClasses,
  useClass,
  useCreateClass,
  useUpdateClass,
  useDeleteClass,
  useClassStatistics,
  useTeachers,
  useCheckScheduleConflicts,
  useClassTeachers,
} from '@hooks/use-class';
import type { Class, CreateClassInput, UpdateClassInput, ClassFilter, ClassStatus, DayOfWeek , Teacher } from '@services/class-service';
import { createClassFormSchema } from '../schemas/class.schema';
import type { FormSchema } from '@schema-engine/types';
import { classFilterSchema } from '../schemas/class.filter.schema';

const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: '월요일' },
  { value: 'tuesday', label: '화요일' },
  { value: 'wednesday', label: '수요일' },
  { value: 'thursday', label: '목요일' },
  { value: 'friday', label: '금요일' },
  { value: 'saturday', label: '토요일' },
  { value: 'sunday', label: '일요일' },
];

export function ClassesPage() {
  const { showConfirm, showAlert } = useModal();
  const { id: urlClassId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const mode = useResponsiveMode();
  const terms = useIndustryTerms();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);

  // localStorage 기반 상태 초기화 (SSR Safe, AutomationSettingsPage 패턴 적용)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(() => {
    try {
      const stored = localStorage.getItem('classes-page-view-mode');
      return stored === 'calendar' ? 'calendar' : 'list';
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn('ClassesPage: localStorage 접근 실패, 기본값 사용', { error });
      }
      return 'list';
    }
  });

  const [filter, setFilter] = useState<ClassFilter>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  // URL 파라미터로 클래스 ID가 전달되면 자동으로 상세 모달 열기
  useEffect(() => {
    if (urlClassId) {
      setEditingClassId(urlClassId);
    }
  }, [urlClassId]);

  // 상세 모달 닫을 때 URL도 업데이트
  const handleCloseEditModal = useCallback(() => {
    setEditingClassId(null);
    // URL에서 ID가 있었다면 기본 classes 페이지로 이동
    if (urlClassId) {
      navigate('/classes', { replace: true });
    }
  }, [urlClassId, navigate]);

  // Today-First 기준: 기본값은 false (localStorage 기반 지속성)
  const [showAllClasses, setShowAllClasses] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('classes-page-show-all');
      return stored === 'true';
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn('ClassesPage: localStorage 접근 실패, 기본값 사용', { error });
      }
      return false;
    }
  });

  // Today-First 기준: 기본적으로 오늘 수업 있는 반만 필터링
  // 기술문서 5-2: KST 기준 날짜 처리
  // P0-3: search 필터가 있으면 Today-First 우선순위 해제
  const todayFilter: ClassFilter = useMemo(() => {
    if (showAllClasses) {
      return filter; // 전체 수업 보기 모드
    }

    // P0-3: search 필터가 있으면 day_of_week 필터 적용 안 함
    if (filter.search && filter.search.trim().length > 0) {
      return {
        ...filter,
        status: 'active', // 활성 반만
      };
    }

    // 오늘 요일 계산 (월요일=1, 일요일=0) - KST 기준
    const todayKST = toKST();
    const dayOfWeek = todayKST.day(); // 0(일) ~ 6(토)
    const dayOfWeekMap: Record<number, DayOfWeek> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };
    const todayDayOfWeek = dayOfWeekMap[dayOfWeek];

    return {
      ...filter,
      day_of_week: filter.day_of_week || todayDayOfWeek, // 사용자 선택 요일 우선, 없으면 오늘 요일
      status: 'active', // 활성 반만
    };
  }, [filter, showAllClasses]);

  const { data: classes, isLoading, error } = useClasses({
    ...todayFilter,
    search: todayFilter.search?.trim() || undefined, // 빈 문자열이면 undefined로 변환
  });
  const { data: teachers } = useTeachers();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();

  // Schema Registry 연동 (아키텍처 문서 S3 참조)
  const { data: classFormSchemaData } = useSchema('class', createClassFormSchema(teachers || [], terms), 'form');
  const { data: classFilterSchemaData } = useSchema('class_filter', classFilterSchema, 'filter');

  // Fallback: Registry에서 조회 실패 시 로컬 스키마 사용
  const effectiveFormSchema = classFormSchemaData || createClassFormSchema(teachers || [], terms);
  const effectiveFilterSchema = classFilterSchemaData || classFilterSchema;

  // 뷰 모드 토글 핸들러 (localStorage 지속성)
  const handleToggleViewMode = useCallback((mode: 'list' | 'calendar') => {
    setViewMode(mode);
    try {
      localStorage.setItem('classes-page-view-mode', mode);
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn('ClassesPage: localStorage 저장 실패', { error });
      }
    }
  }, []);

  // 전체 보기 토글 핸들러 (localStorage 지속성)
  const handleToggleShowAll = useCallback((checked: boolean) => {
    setShowAllClasses(checked);
    try {
      localStorage.setItem('classes-page-show-all', String(checked));
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn('ClassesPage: localStorage 저장 실패', { error });
      }
    }
  }, []);

  const handleFilterChange = useCallback((filters: Record<string, unknown>) => {
    setFilter({
      search: filters.search ? String(filters.search) : undefined,
      status: filters.status as ClassStatus | ClassStatus[] | undefined,
      day_of_week: filters.day_of_week as DayOfWeek | undefined,
    });
    // Promise 반환 없음
  }, []);

  const checkConflicts = useCheckScheduleConflicts();

  const handleCreateClass = async (input: CreateClassInput) => {
    try {
      // 시간 범위 검증
      if (input.start_time >= input.end_time) {
        showAlert('시작 시간은 종료 시간보다 빨라야 합니다.', '입력 오류', 'error');
        return;
      }

      // 일정 충돌 감지 (디어쌤_아키텍처.md 3.2.2)
      const conflictResult = await checkConflicts.mutateAsync({
        dayOfWeek: input.day_of_week,
        startTime: input.start_time,
        endTime: input.end_time,
        teacherIds: input.teacher_ids,
        room: input.room,
      });

      // 충돌이 있으면 사용자 확인
      if (conflictResult.has_conflicts) {
        const conflictMessages = conflictResult.conflicts.map((c) => c.message).join('\n');
        const confirmed = await showConfirm(
          `다음 충돌이 발견되었습니다:\n\n${conflictMessages}\n\n그래도 생성하시겠습니까?`,
          '일정 충돌 감지'
        );
        if (!confirmed) {
          return;
        }
      }

      // P0-2: useCreateClass Hook이 DB RPC로 트랜잭션 처리하므로 직접 호출만 하면 됨
      await createClass.mutateAsync(input);
      setShowCreateForm(false);
    } catch (error) {
      // 에러는 showAlert로 사용자에게 표시 (아키텍처 문서 6-3 참조)
      showAlert(
        error instanceof Error ? error.message : `${terms.GROUP_LABEL} 생성에 실패했습니다.`,
        '오류',
        'error'
      );
    }
  };

  const handleUpdateClass = async (classId: string, input: UpdateClassInput) => {
    try {
      // 시간 범위 검증
      if (input.start_time && input.end_time && input.start_time >= input.end_time) {
        showAlert('시작 시간은 종료 시간보다 빨라야 합니다.', '입력 오류', 'error');
        return;
      }

      // 일정 변경이 있으면 충돌 감지
      if (input.day_of_week || input.start_time || input.end_time || input.teacher_ids || input.room) {
        const classData = classes?.find((c) => c.id === classId);
        if (classData) {
          const conflictResult = await checkConflicts.mutateAsync({
            classId,
            dayOfWeek: input.day_of_week || classData.day_of_week,
            startTime: input.start_time || classData.start_time,
            endTime: input.end_time || classData.end_time,
            teacherIds: input.teacher_ids,
            room: input.room || classData.room,
          });

          if (conflictResult.has_conflicts) {
            const conflictMessages = conflictResult.conflicts.map((c) => c.message).join('\n');
            const confirmed = await showConfirm(
              `다음 충돌이 발견되었습니다:\n\n${conflictMessages}\n\n그래도 수정하시겠습니까?`,
              '일정 충돌 감지'
            );
            if (!confirmed) {
              return;
            }
          }
        }
      }

      await updateClass.mutateAsync({ classId, input });
      handleCloseEditModal();
    } catch (error) {
      // 에러는 showAlert로 사용자에게 표시 (아키텍처 문서 6-3 참조)
      showAlert(
        error instanceof Error ? error.message : `${terms.GROUP_LABEL} 수정에 실패했습니다.`,
        '오류',
        'error'
      );
    }
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <PageHeader
          title={`${terms.GROUP_LABEL} 관리`}
          actions={
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <Button
                variant={showAllClasses ? 'outline' : 'solid'}
                size="sm"
                onClick={() => handleToggleShowAll(!showAllClasses)}
              >
                {showAllClasses ? `오늘 ${terms.GROUP_LABEL}만` : `전체 ${terms.GROUP_LABEL_PLURAL} 보기`}
              </Button>
              <Button
                variant={viewMode === 'list' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => handleToggleViewMode('list')}
              >
                리스트
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => handleToggleViewMode('calendar')}
              >
                캘린더
              </Button>
              <Button
                variant="solid"
                size="sm"
                onClick={() => setShowCreateForm(!showCreateForm)}
              >
                {terms.GROUP_LABEL} 생성
              </Button>
            </div>
          }
        />

        {/* 검색 및 필터 패널 */}
        <SchemaFilter
          schema={effectiveFilterSchema}
          onFilterChange={(filters) => {
            void handleFilterChange(filters);
          }}
          defaultValues={{
            search: filter.search || '',
            status: filter.status || '',
            day_of_week: filter.day_of_week || '',
          }}
        />

          {/* 수업 생성 폼 - 반응형: 모바일/태블릿은 드로어, 데스크톱은 인라인 */}
          {showCreateForm && (
            <>
              {isMobileMode || isTabletMode ? (
                // 모바일/태블릿: Drawer 사용 (아키텍처 문서 6-1 참조)
                <Drawer
                  isOpen={showCreateForm}
                  onClose={() => setShowCreateForm(false)}
                  title={`${terms.GROUP_LABEL} 생성`}
                  position={isMobileMode ? 'bottom' : 'right'}
                  width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
                >
                  <CreateClassForm
                    effectiveFormSchema={effectiveFormSchema}
                    onSubmit={handleCreateClass}
                    onCancel={() => setShowCreateForm(false)}
                  />
                </Drawer>
              ) : (
                // 데스크톱: 인라인 폼 (기존 방식)
                <CreateClassForm
                  effectiveFormSchema={effectiveFormSchema}
                  onSubmit={(input) => {
                    void handleCreateClass(input);
                  }}
                  onCancel={() => setShowCreateForm(false)}
                />
              )}
            </>
          )}

          {/* 수업 목록 또는 캘린더 뷰 */}
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
          ) : viewMode === 'list' ? (
            <ClassListView
              classes={classes || []}
              onEdit={(classId) => setEditingClassId(classId)}
              onDelete={async (classId) => {
                const confirmed = await showConfirm(`정말 이 ${terms.GROUP_LABEL}을(를) 삭제하시겠습니까?`, `${terms.GROUP_LABEL} 삭제`);
                if (confirmed) {
                  try {
                  await deleteClass.mutateAsync(classId);
                  } catch (error) {
                    // 에러는 showAlert로 사용자에게 표시 (아키텍처 문서 6-3 참조)
                    showAlert(
                      error instanceof Error ? error.message : `${terms.GROUP_LABEL} 삭제에 실패했습니다.`,
                      '오류',
                      'error'
                    );
                  }
                }
              }}
            />
          ) : (
            <ClassCalendarView classes={classes || []} />
          )}

          {/* 수업 수정 모달 */}
          {editingClassId && (
            <EditClassModal
              classId={editingClassId}
              teachers={teachers || []}
              onSave={handleUpdateClass}
              onClose={handleCloseEditModal}
            />
        )}
      </Container>
    </ErrorBoundary>
  );
}

/**
 * 수업 생성 폼
 */
function CreateClassForm({
  effectiveFormSchema,
  onSubmit,
  onCancel,
}: {
  effectiveFormSchema: FormSchema;
  onSubmit: (input: CreateClassInput) => void;
  onCancel: () => void;
}) {
  const mode = useResponsiveMode();
  const terms = useIndustryTerms();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);
  const showHeader = !isMobileMode && !isTabletMode;

  const handleSubmit = (data: Record<string, unknown>) => {
    // 스키마에서 받은 데이터를 CreateClassInput 형식으로 변환
    const input: CreateClassInput = {
      name: String(data.name ?? ''),
      subject: data.subject ? String(data.subject) : undefined,
      grade: data.grade ? String(data.grade) : undefined,
      day_of_week: (data.day_of_week || 'monday') as DayOfWeek,
      start_time: String(data.start_time ?? '14:00'),
      end_time: String(data.end_time ?? '15:30'),
      capacity: Number(data.capacity ?? 20),
      color: data.color ? String(data.color) : undefined,
      room: data.room ? String(data.room) : undefined,
      notes: data.notes ? String(data.notes) : undefined,
      status: (data.status || 'active') as ClassStatus,
      teacher_ids: data.teacher_ids && Array.isArray(data.teacher_ids) && data.teacher_ids.length > 0
        ? data.teacher_ids
        : undefined,
    };
    onSubmit(input);
  };

  return (
    <div style={showHeader ? { marginBottom: 'var(--spacing-md)' } : {}}>
      {showHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>{terms.GROUP_LABEL} 생성</h3>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            취소
          </Button>
        </div>
      )}
      <SchemaForm
        schema={effectiveFormSchema}
        onSubmit={handleSubmit}
        defaultValues={{
          day_of_week: 'monday',
          start_time: '14:00',
          end_time: '15:30',
          capacity: 20,
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
 * 수업 수정 모달
 */
function EditClassModal({
  classId,
  teachers,
  onSave,
  onClose,
}: {
  classId: string;
  teachers: Teacher[];
  onSave: (classId: string, input: UpdateClassInput) => Promise<void>;
  onClose: () => void;
}) {
  const { showAlert } = useModal();
  const mode = useResponsiveMode();
  const terms = useIndustryTerms();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);
  const { data: classData, isLoading } = useClass(classId);
  const { data: classTeachers } = useClassTeachers(classId);

  // Schema Registry 연동 (아키텍처 문서 S3 참조)
  const { data: classFormSchemaData } = useSchema('class', createClassFormSchema(teachers || [], terms), 'form');
  const classFormSchema = useMemo(() => classFormSchemaData || createClassFormSchema(teachers || [], terms), [classFormSchemaData, teachers, terms]);

  // 현재 배정된 강사 ID 목록
  const currentTeacherIds = useMemo(
    () => classTeachers?.map((ct) => ct.teacher_id) || [],
    [classTeachers]
  );

  const handleSubmit = (data: Record<string, unknown>) => {
    const input: UpdateClassInput = {
      name: data.name ? String(data.name) : undefined,
      subject: data.subject ? String(data.subject) : undefined,
      grade: data.grade ? String(data.grade) : undefined,
      day_of_week: data.day_of_week as DayOfWeek | undefined,
      start_time: data.start_time ? String(data.start_time) : undefined,
      end_time: data.end_time ? String(data.end_time) : undefined,
      capacity: data.capacity ? Number(data.capacity) : undefined,
      color: data.color ? String(data.color) : undefined,
      room: data.room ? String(data.room) : undefined,
      notes: data.notes ? String(data.notes) : undefined,
      status: data.status as ClassStatus | undefined,
      teacher_ids: data.teacher_ids && Array.isArray(data.teacher_ids) && data.teacher_ids.length > 0
        ? data.teacher_ids
        : undefined,
    };
    void onSave(classId, input);
  };

  // 반응형 처리: 모바일/태블릿은 Drawer, 데스크톱은 Modal (아키텍처 문서 6-1 참조)
  if (isLoading) {
    if (isMobileMode || isTabletMode) {
      return (
        <Drawer
          isOpen={true}
          onClose={onClose}
          title={`${terms.GROUP_LABEL} 수정`}
          position={isMobileMode ? 'bottom' : 'right'}
          width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
        >
          <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>
        </Drawer>
      );
    }
    return (
      <Modal isOpen={true} onClose={onClose} title={`${terms.GROUP_LABEL} 수정`} size="lg">
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>
      </Modal>
    );
  }

  if (!classData) {
    if (isMobileMode || isTabletMode) {
      return (
        <Drawer
          isOpen={true}
          onClose={onClose}
          title={`${terms.GROUP_LABEL} 수정`}
          position={isMobileMode ? 'bottom' : 'right'}
          width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
        >
          <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>{terms.GROUP_LABEL}을(를) 찾을 수 없습니다.</div>
        </Drawer>
      );
    }
    return (
      <Modal isOpen={true} onClose={onClose} title={`${terms.GROUP_LABEL} 수정`} size="lg">
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>{terms.GROUP_LABEL}을(를) 찾을 수 없습니다.</div>
      </Modal>
    );
  }

  const formContent = (
      <SchemaForm
        schema={classFormSchema}
        onSubmit={handleSubmit}
        defaultValues={{
          name: classData.name,
          subject: classData.subject || '',
          grade: classData.grade || '',
          day_of_week: classData.day_of_week,
          start_time: classData.start_time,
          end_time: classData.end_time,
          capacity: classData.capacity,
          color: classData.color || 'var(--color-primary)',
          room: classData.room || '',
          teacher_ids: currentTeacherIds,
          notes: classData.notes || '',
          status: classData.status,
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
  );

  // 모바일/태블릿: Drawer 사용 (아키텍처 문서 6-1 참조)
  if (isMobileMode || isTabletMode) {
    return (
      <Drawer
        isOpen={true}
        onClose={onClose}
        title={`${terms.GROUP_LABEL} 수정`}
        position={isMobileMode ? 'bottom' : 'right'}
        width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
      >
        {formContent}
      </Drawer>
    );
  }

  // 데스크톱: Modal 사용
  return (
    <Modal isOpen={true} onClose={onClose} title={`${terms.GROUP_LABEL} 수정`} size="lg">
      {formContent}
    </Modal>
  );
}

/**
 * 수업 리스트 뷰
 */
function ClassListView({
  classes,
  onEdit,
  onDelete,
}: {
  classes: Class[];
  onEdit: (classId: string) => void;
  onDelete: (classId: string) => Promise<void>;
}) {
  const terms = useIndustryTerms();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(var(--width-card-min), 1fr))`, gap: 'var(--spacing-md)' }}>
      {classes.map((classItem) => (
        <ClassCard key={classItem.id} classItem={classItem} onEdit={onEdit} onDelete={onDelete} />
      ))}
      {classes.length === 0 && (
        <Card padding="lg">
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            등록된 {terms.GROUP_LABEL}이 없습니다.
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * 수업 카드
 */
function ClassCard({
  classItem,
  onEdit,
  onDelete,
}: {
  classItem: Class;
  onEdit: (classId: string) => void;
  onDelete: (classId: string) => Promise<void>;
}) {
  const { data: statistics } = useClassStatistics(classItem.id);
  const terms = useIndustryTerms();
  const dayLabel = DAYS_OF_WEEK.find((d) => d.value === classItem.day_of_week)?.label || classItem.day_of_week;

  return (
    <Card
      padding="md"
      style={{
        borderLeft: `var(--border-width-thick) solid ${classItem.color}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-sm)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>
          {classItem.name}
        </h3>
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
          <Button size="xs" variant="ghost" onClick={() => onEdit(classItem.id)}>
            수정
          </Button>
          <Button size="xs" variant="ghost" onClick={() => onDelete(classItem.id)}>
            삭제
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', color: 'var(--color-text-secondary)' }}>
        {classItem.subject && <div>{terms.SUBJECT_LABEL}: {classItem.subject}</div>}
        {classItem.grade && <div>{terms.GRADE_LABEL}: {classItem.grade}</div>}
        <div>요일: {dayLabel}</div>
        <div>시간: {classItem.start_time} ~ {classItem.end_time}</div>
        <div>{terms.CAPACITY_LABEL}: {classItem.current_count} / {classItem.capacity}</div>
        {statistics && statistics.capacity_rate > 0 && (
          <div>{terms.CAPACITY_LABEL}률: {statistics.capacity_rate.toFixed(1)}%</div>
        )}
        {/* 출결률/지각률은 출결 데이터 구현 후 표시 */}
      </div>
    </Card>
  );
}

/**
 * 수업 캘린더 뷰
 * [요구사항] 수업 편성표(Calendar-like) 제공
 * 시간대별 그리드 형태로 개선
 */
function ClassCalendarView({ classes }: { classes: Class[] }) {
  const terms = useIndustryTerms();
  // 시간대 생성 (08:00 ~ 22:00, 30분 단위)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 8; hour < 22; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  // 요일별로 수업 그룹화
  const classesByDay = DAYS_OF_WEEK.map((day) => ({
    day,
    classes: classes.filter((c) => c.day_of_week === day.value),
  }));

  // P1-5: 시간대에 해당하는 모든 수업 조회 (겹침 표시)
  const getClassesAtTime = (dayClasses: Class[], timeSlot: string): Class[] => {
    return dayClasses.filter((c) => {
      const start = c.start_time;
      const end = c.end_time;
      return timeSlot >= start && timeSlot < end;
    });
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <Card padding="lg">
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          {terms.GROUP_LABEL} 편성표
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'var(--width-grid-column) repeat(7, 1fr)', gap: 'var(--spacing-xs)', minWidth: 'var(--width-grid-min)' }}>
          {/* 헤더 */}
          <div style={{ padding: 'var(--spacing-sm)', fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)' }}>
            시간
          </div>
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day.value}
              style={{
                padding: 'var(--spacing-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                fontSize: 'var(--font-size-sm)',
                textAlign: 'center',
                backgroundColor: 'var(--color-background-secondary)',
                borderRadius: 'var(--border-radius-sm)',
              }}
            >
            {day.label}
            </div>
          ))}

          {/* 시간대별 행 */}
          {timeSlots.map((timeSlot) => (
            <React.Fragment key={timeSlot}>
              <div
                style={{
                  padding: 'var(--spacing-xs)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  textAlign: 'right',
                }}
              >
                {timeSlot}
              </div>
              {DAYS_OF_WEEK.map((day) => {
                const dayClasses = classesByDay.find((d) => d.day.value === day.value)?.classes || [];
                const classesAtTime = getClassesAtTime(dayClasses, timeSlot);
                const hasClasses = classesAtTime.length > 0;
                const firstClass = classesAtTime[0];
                const isStartTime = firstClass?.start_time === timeSlot;
                const hasOverlap = classesAtTime.length > 1;

                return (
                  <div
                    key={`${day.value}-${timeSlot}`}
                    style={{
                      minHeight: 'var(--height-row-min)',
                      // HARD-CODE-EXCEPTION: padding 0은 레이아웃용 특수 값
                      padding: isStartTime ? 'var(--spacing-xs)' : '0',
                      backgroundColor: hasClasses
                        ? `${firstClass.color}20`
                        : 'transparent',
                      borderLeft: isStartTime ? `var(--border-width-thick) solid ${firstClass.color}` : 'none',
                      // HARD-CODE-EXCEPTION: borderRadius 0은 레이아웃용 특수 값
                      borderRadius: isStartTime ? 'var(--border-radius-sm)' : '0',
                      // P1-5: 겹침 표시 (점선 테두리)
                      border: hasOverlap && isStartTime ? 'var(--border-width-base) dashed var(--color-warning)' : undefined,
                      position: 'relative',
                    }}
                  >
                    {isStartTime && firstClass && (
                      <>
                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)' }}>
                          {firstClass.name}
                        </div>
                        {/* P1-5: 겹침 개수 표시 */}
                        {hasOverlap && (
                          <div
                            style={{
                              fontSize: 'var(--font-size-2xs)',
                              color: 'var(--color-warning)',
                              fontWeight: 'var(--font-weight-bold)',
                              marginTop: 'var(--spacing-2xs)',
                            }}
                          >
                            +{classesAtTime.length - 1} 겹침
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        {/* 범례 */}
        {classes.length > 0 && (
          <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
            {classes.map((classItem) => (
              <div
                key={classItem.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                <div
                  style={{
                    width: 'var(--font-size-sm)',
                    height: 'var(--font-size-sm)',
                    backgroundColor: classItem.color,
                    borderRadius: 'var(--border-radius-sm)',
                  }}
                />
                <span>{classItem.name}</span>
                  </div>
                ))}
            </div>
          )}
        </Card>
    </div>
  );
}
