/**
 * 반 관리 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 반 리스트 + 캘린더 뷰 생성 (Calendar-like) 제공
 */

import React, { useState, useMemo } from 'react';
import { ErrorBoundary, useModal, useResponsiveMode } from '@ui-core/react';
import { Container, Card, Button, Modal, Drawer } from '@ui-core/react';
import { SchemaForm, SchemaFilter } from '@schema-engine';
import { apiClient } from '@api-sdk/core';
import { useSchema } from '@hooks/use-schema';
import { toKST } from '@lib/date-utils';
import {
  useClasses,
  useClass,
  useCreateClass,
  useUpdateClass,
  useDeleteClass,
  useClassStatistics,
  useTeachers,
  useAssignTeacher,
} from '@hooks/use-class';
import type { Class, CreateClassInput, UpdateClassInput, ClassFilter, ClassStatus, DayOfWeek } from '@services/class-service';
import { createClassFormSchema } from '../schemas/class.schema';
import type { Teacher } from '@services/class-service';
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
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filter, setFilter] = useState<ClassFilter>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [showAllClasses, setShowAllClasses] = useState(false); // Today-First 기준: 기본값은 false

  // Today-First 기준: 기본적으로 오늘 수업 있는 반만 필터링
  // 기술문서 5-2: KST 기준 날짜 처리
  const todayFilter: ClassFilter = React.useMemo(() => {
    if (showAllClasses) {
      return filter; // 전체 반 보기 모드
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
      day_of_week: todayDayOfWeek, // 오늘 요일로 필터링
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
  const assignTeacher = useAssignTeacher();

  // Schema Registry 연동 (아키텍처 문서 S3 참조)
  const { data: classFormSchemaData } = useSchema('class', createClassFormSchema(teachers || []), 'form');
  const { data: classFilterSchemaData } = useSchema('class_filter', classFilterSchema, 'filter');

  // Fallback: Registry에서 조회 실패 시 로컬 스키마 사용
  const effectiveFormSchema = classFormSchemaData || createClassFormSchema(teachers || []);
  const effectiveFilterSchema = classFilterSchemaData || classFilterSchema;

  const handleFilterChange = React.useCallback((filters: Record<string, unknown>) => {
    setFilter({
      search: filters.search ? String(filters.search) : undefined,
      status: filters.status as ClassStatus | ClassStatus[] | undefined,
      day_of_week: filters.day_of_week as DayOfWeek | undefined,
    });
  }, []);

  const handleCreateClass = async (input: CreateClassInput) => {
    try {
      // 강사 배정 정보 분리
      const { teacher_ids, ...classInput } = input;

      // 반 생성
      const createdClass = await createClass.mutateAsync(classInput);

      // 강사 배정 (teacher_ids가 있는 경우)
      if (teacher_ids && teacher_ids.length > 0 && createdClass) {
        for (const teacherId of teacher_ids) {
          await assignTeacher.mutateAsync({
            class_id: createdClass.id,
            teacher_id: teacherId,
            role: 'teacher', // 기본값: 담임 강사
            assigned_at: toKST().format('YYYY-MM-DD'),
          });
        }
      }

      setShowCreateForm(false);
    } catch (error) {
      // 에러는 showAlert로 사용자에게 표시 (아키텍처 문서 6-3 참조)
      showAlert(
        error instanceof Error ? error.message : '반 생성에 실패했습니다.',
        '오류',
        'error'
      );
    }
  };

  const handleUpdateClass = async (classId: string, input: UpdateClassInput) => {
    try {
      await updateClass.mutateAsync({ classId, input });
      setEditingClassId(null);
    } catch (error) {
      // 에러는 showAlert로 사용자에게 표시 (아키텍처 문서 6-3 참조)
      showAlert(
        error instanceof Error ? error.message : '반 수정에 실패했습니다.',
        '오류',
        'error'
      );
    }
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <div>
              <h1 style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)'
              }}>
                반 관리
              </h1>
              {/* Today-First 기준: 기본 화면은 "오늘 수업 있는 반" (아키텍처 문서 3.2.1 참조) */}
              {!showAllClasses && (
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)'
                }}>
                  오늘 수업이 있는 반만 표시됩니다.
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <Button
                variant={showAllClasses ? 'outline' : 'solid'}
                size="sm"
                onClick={() => setShowAllClasses(!showAllClasses)}
              >
                {showAllClasses ? '오늘 수업만' : '전체 반 보기'}
              </Button>
              <Button
                variant={viewMode === 'list' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                리스트
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setViewMode('calendar')}
              >
                캘린더
              </Button>
              <Button
                variant="solid"
                size="sm"
                onClick={() => setShowCreateForm(!showCreateForm)}
              >
                반 생성
              </Button>
            </div>
          </div>

          {/* 검색 및 필터 패널 */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <SchemaFilter
              schema={effectiveFilterSchema}
              onFilterChange={handleFilterChange}
              defaultValues={{
                search: filter.search || '',
                status: filter.status || '',
                day_of_week: filter.day_of_week || '',
              }}
            />
          </Card>

          {/* 반 생성 폼 - 반응형: 모바일/태블릿은 드로어, 데스크톱은 인라인 */}
          {showCreateForm && (
            <>
              {isMobile || isTablet ? (
                // 모바일/태블릿: Drawer 사용 (아키텍처 문서 6-1 참조)
                <Drawer
                  isOpen={showCreateForm}
                  onClose={() => setShowCreateForm(false)}
                  title="반 생성"
                  position={isMobile ? 'bottom' : 'right'}
                  width={isTablet ? 'var(--width-drawer-tablet)' : '100%'}
                >
                  <CreateClassForm
                    teachers={teachers || []}
                    effectiveFormSchema={effectiveFormSchema}
                    onSubmit={handleCreateClass}
                    onCancel={() => setShowCreateForm(false)}
                  />
                </Drawer>
              ) : (
                // 데스크톱: 인라인 폼 (기존 방식)
                <CreateClassForm
                  teachers={teachers || []}
                  effectiveFormSchema={effectiveFormSchema}
                  onSubmit={handleCreateClass}
                  onCancel={() => setShowCreateForm(false)}
                />
              )}
            </>
          )}

          {/* 반 목록 또는 캘린더 뷰 */}
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
          ) : viewMode === 'list' ? (
            <ClassListView
              classes={classes || []}
              onEdit={(classId) => setEditingClassId(classId)}
              onDelete={async (classId) => {
                const confirmed = await showConfirm('정말 이 반을 삭제하시겠습니까?', '반 삭제');
                if (confirmed) {
                  try {
                  await deleteClass.mutateAsync(classId);
                  } catch (error) {
                    // 에러는 showAlert로 사용자에게 표시 (아키텍처 문서 6-3 참조)
                    showAlert(
                      error instanceof Error ? error.message : '반 삭제에 실패했습니다.',
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

          {/* 반 수정 모달 */}
          {editingClassId && (
            <EditClassModal
              classId={editingClassId}
              teachers={teachers || []}
              onSave={handleUpdateClass}
              onClose={() => setEditingClassId(null)}
            />
          )}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

/**
 * 반 생성 폼
 */
function CreateClassForm({
  teachers,
  effectiveFormSchema,
  onSubmit,
  onCancel,
}: {
  teachers: Teacher[];
  effectiveFormSchema: FormSchema;
  onSubmit: (input: CreateClassInput) => void;
  onCancel: () => void;
}) {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const showHeader = !isMobile && !isTablet;

  const handleSubmit = async (data: Record<string, unknown>) => {
    // 스키마에서 받은 데이터를 CreateClassInput 형식으로 변환
    const input: CreateClassInput = {
      name: String(data.name ?? ''),
      subject: data.subject ? String(data.subject) : undefined,
      grade: data.grade ? String(data.grade) : undefined,
      day_of_week: (data.day_of_week || 'monday') as DayOfWeek,
      start_time: String(data.start_time ?? '14:00'),
      end_time: String(data.end_time ?? '15:30'),
      capacity: Number(data.capacity ?? 20),
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
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>반 생성</h3>
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
 * 반 수정 모달
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
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const { data: classData, isLoading } = useClass(classId);

  // Schema Registry 연동 (아키텍처 문서 S3 참조)
  const { data: classFormSchemaData } = useSchema('class', createClassFormSchema(teachers || []), 'form');
  const classFormSchema = useMemo(() => classFormSchemaData || createClassFormSchema(teachers || []), [classFormSchemaData, teachers]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    const input: UpdateClassInput = {
      name: data.name ? String(data.name) : undefined,
      subject: data.subject ? String(data.subject) : undefined,
      grade: data.grade ? String(data.grade) : undefined,
      day_of_week: data.day_of_week as DayOfWeek | undefined,
      start_time: data.start_time ? String(data.start_time) : undefined,
      end_time: data.end_time ? String(data.end_time) : undefined,
      capacity: data.capacity ? Number(data.capacity) : undefined,
      room: data.room ? String(data.room) : undefined,
      notes: data.notes ? String(data.notes) : undefined,
      status: data.status as ClassStatus | undefined,
    };
    await onSave(classId, input);
  };

  // 반응형 처리: 모바일/태블릿은 Drawer, 데스크톱은 Modal (아키텍처 문서 6-1 참조)
  if (isLoading) {
    if (isMobile || isTablet) {
      return (
        <Drawer
          isOpen={true}
          onClose={onClose}
          title="반 수정"
          position={isMobile ? 'bottom' : 'right'}
          width={isTablet ? 'var(--width-drawer-tablet)' : '100%'}
        >
          <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>
        </Drawer>
      );
    }
    return (
      <Modal isOpen={true} onClose={onClose} title="반 수정" size="lg">
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>
      </Modal>
    );
  }

  if (!classData) {
    if (isMobile || isTablet) {
      return (
        <Drawer
          isOpen={true}
          onClose={onClose}
          title="반 수정"
          position={isMobile ? 'bottom' : 'right'}
          width={isTablet ? 'var(--width-drawer-tablet)' : '100%'}
        >
          <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>반을 찾을 수 없습니다.</div>
        </Drawer>
      );
    }
    return (
      <Modal isOpen={true} onClose={onClose} title="반 수정" size="lg">
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>반을 찾을 수 없습니다.</div>
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
          room: classData.room || '',
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
  if (isMobile || isTablet) {
    return (
      <Drawer
        isOpen={true}
        onClose={onClose}
        title="반 수정"
        position={isMobile ? 'bottom' : 'right'}
        width={isTablet ? 'var(--width-drawer-tablet)' : '100%'}
      >
        {formContent}
      </Drawer>
    );
  }

  // 데스크톱: Modal 사용
  return (
    <Modal isOpen={true} onClose={onClose} title="반 수정" size="lg">
      {formContent}
    </Modal>
  );
}

/**
 * 반 리스트 뷰
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
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(var(--width-card-min), 1fr))`, gap: 'var(--spacing-md)' }}>
      {classes.map((classItem) => (
        <ClassCard key={classItem.id} classItem={classItem} onEdit={onEdit} onDelete={onDelete} />
      ))}
      {classes.length === 0 && (
        <Card padding="lg" variant="default">
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            등록된 반이 없습니다.
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * 반 카드
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
  const dayLabel = DAYS_OF_WEEK.find((d) => d.value === classItem.day_of_week)?.label || classItem.day_of_week;

  return (
    <Card
      padding="md"
      variant="default"
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
        {classItem.subject && <div>과목: {classItem.subject}</div>}
        {classItem.grade && <div>학년: {classItem.grade}</div>}
        <div>요일: {dayLabel}</div>
        <div>시간: {classItem.start_time} ~ {classItem.end_time}</div>
        <div>정원: {classItem.current_count} / {classItem.capacity}</div>
        {statistics && (
          <>
            <div>정원률: {statistics.capacity_rate.toFixed(1)}%</div>
            <div>출결률: {statistics.attendance_rate.toFixed(1)}%</div>
            <div>지각률: {statistics.late_rate.toFixed(1)}%</div>
          </>
        )}
      </div>
    </Card>
  );
}

/**
 * 반 캘린더 뷰
 * [요구사항] 반 편성표(Calendar-like) 제공
 * 시간대별 그리드 형태로 개선
 */
function ClassCalendarView({ classes }: { classes: Class[] }) {
  // 시간대 생성 (08:00 ~ 22:00, 30분 단위)
  const timeSlots = React.useMemo(() => {
    const slots: string[] = [];
    for (let hour = 8; hour < 22; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  // 요일별로 반 그룹화
  const classesByDay = DAYS_OF_WEEK.map((day) => ({
    day,
    classes: classes.filter((c) => c.day_of_week === day.value),
  }));

  // 시간대에 반이 있는지 확인하는 함수
  const getClassAtTime = (dayClasses: Class[], timeSlot: string) => {
    return dayClasses.find((c) => {
      const start = c.start_time;
      const end = c.end_time;
      return timeSlot >= start && timeSlot < end;
    });
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <Card padding="lg" variant="default">
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          반 편성표
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
                const classAtTime = getClassAtTime(dayClasses, timeSlot);
                const isStartTime = classAtTime?.start_time === timeSlot;

                return (
                  <div
                    key={`${day.value}-${timeSlot}`}
                    style={{
                      minHeight: 'var(--height-row-min)',
                      padding: isStartTime ? 'var(--spacing-xs)' : '0',
                      backgroundColor: classAtTime
                        ? `${classAtTime.color}20`
                        : 'transparent',
                      borderLeft: isStartTime ? `var(--border-width-thick) solid ${classAtTime.color}` : 'none',
                      borderRadius: isStartTime ? 'var(--border-radius-sm)' : '0',
                    }}
                  >
                    {isStartTime && classAtTime && (
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)' }}>
                        {classAtTime.name}
                        </div>
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
