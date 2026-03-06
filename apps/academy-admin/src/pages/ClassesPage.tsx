/**
 * 수업 관리 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 수업 리스트 + 캘린더 뷰 생성 (Calendar-like) 제공
 */

import React, { Suspense } from 'react';
import { ErrorBoundary, Container, Card, Button, Modal, PageHeader, DataTable, SubSidebar, RightLayerMenuLayout, Badge } from '@ui-core/react';
import { useClassesPageData } from './classes/hooks/useClassesPageData';
import { DAYS_OF_WEEK } from './classes/constants';
import { StatisticsCards } from './classes/components/StatisticsCards';
import { ClassCalendarView } from './classes/components/ClassCalendarView';
import { ClassStatisticsTab } from './classes/components/ClassStatisticsTab';
import { ScheduleConflictsTab } from './classes/components/ScheduleConflictsTab';
import { ClassInfoTab, ClassStudentsTab, ClassTeachersTab } from './classes/tabs';
import { CreateClassForm } from './classes/components/CreateClassForm';
import { templates } from '../utils';
import type { ClassStatus, DayOfWeek } from '@services/class-service';

export function ClassesPage() {
  const data = useClassesPageData();

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', minHeight: 'var(--height-full)' }}>
        {/* 서브 사이드바 (모바일에서는 숨김, 태블릿에서는 축소) */}
        {!data.isMobileMode && (
          <SubSidebar
            title={templates.management(data.terms.GROUP_LABEL)}
            items={data.subMenuItemsWithDynamicLabels}
            selectedId={data.selectedSubMenu}
            onSelect={data.handleSubMenuChange}
            collapsed={data.sidebarCollapsed}
            onCollapsedChange={data.setSidebarCollapsed}
            testId="classes-sub-sidebar"
          />
        )}

        {/* 메인 콘텐츠 */}
        <div style={{ flex: 1 }}>
          <RightLayerMenuLayout
            layerMenu={{
              isOpen: !!data.selectedClassId,
              onClose: data.handleCloseLayerMenu,
              contentKey: data.selectedClassId || undefined,
              style: {
                zIndex: 'var(--z-modal)',
              },
              title: data.selectedClassLoading ? '로딩 중...' : data.selectedClass ? (
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 'var(--spacing-sm)', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 'var(--font-size-3xl)',
                      fontWeight: 'var(--font-weight-extrabold)',
                      lineHeight: 'var(--line-height-tight)',
                      color: 'var(--color-text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}
                  >
                    {data.selectedClass.name}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {data.terms.GROUP_LABEL} 상세정보
                  </span>
                </span>
              ) : `${data.terms.GROUP_LABEL} 상세`,
              children: data.selectedClassLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                  로딩 중...
                </div>
              ) : data.selectedClass ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--height-full)' }}>
                  {/* 탭 버튼 */}
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'calc(var(--spacing-xl) - var(--spacing-lg))', flexWrap: 'wrap' }}>
                    <Button
                      variant={data.layerMenuTab === 'info' ? 'solid' : 'outline'}
                      size="sm"
                      onClick={() => data.handleTabChange('info')}
                    >
                      기본정보
                    </Button>
                    <Button
                      variant={data.layerMenuTab === 'students' ? 'solid' : 'outline'}
                      size="sm"
                      onClick={() => data.handleTabChange('students')}
                    >
                      {data.terms.PERSON_LABEL_PRIMARY} ({data.selectedClass.current_count || 0})
                    </Button>
                    <Button
                      variant={data.layerMenuTab === 'teachers' ? 'solid' : 'outline'}
                      size="sm"
                      onClick={() => data.handleTabChange('teachers')}
                    >
                      담당강사 ({data.selectedClassTeachers?.length || 0})
                    </Button>
                  </div>
                  {/* 구분선 */}
                  <div style={{ borderBottom: 'var(--border-width-thin) solid var(--color-border)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }} />
                  {/* 탭 내용 */}
                  <div className="academyAdmin-hiddenScrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                    <Suspense fallback={<div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>로딩 중...</div>}>
                      {data.layerMenuTab === 'info' && (
                        <ClassInfoTab
                          classData={data.selectedClass}
                          classTeachers={data.selectedClassTeachers || []}
                          teachers={data.teachers || []}
                          isEditing={data.isEditingInLayer}
                          effectiveFormSchema={data.effectiveFormSchema}
                          onEdit={() => data.setIsEditingInLayer(true)}
                          onCancel={() => data.setIsEditingInLayer(false)}
                          onSave={data.handleUpdateClass}
                          onDelete={data.handleDeleteClass}
                        />
                      )}
                      {data.layerMenuTab === 'students' && (
                        <ClassStudentsTab classId={data.selectedClass.id} />
                      )}
                      {data.layerMenuTab === 'teachers' && (
                        <ClassTeachersTab
                          classTeachers={data.selectedClassTeachers || []}
                          isLoading={data.selectedClassTeachersLoading}
                          allTeachers={data.teachers || []}
                        />
                      )}
                    </Suspense>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                  {data.terms.GROUP_LABEL} 정보를 불러올 수 없습니다.
                </div>
              ),
            }}
          >
          <Container maxWidth="xl" padding="lg">
          <PageHeader
            title={data.subMenuItemsWithDynamicLabels.find(item => item.id === data.selectedSubMenu)?.label || templates.management(data.terms.GROUP_LABEL)}
            actions={
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <Button
                  variant={data.showAllClasses ? 'outline' : 'solid'}
                  size="sm"
                  onClick={() => data.handleToggleShowAll(!data.showAllClasses)}
                >
                  {data.showAllClasses ? `오늘 ${data.terms.GROUP_LABEL}만` : `전체 ${data.terms.GROUP_LABEL_PLURAL} 보기`}
                </Button>
                <Button
                  variant={data.viewMode === 'list' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => data.handleToggleViewMode('list')}
                >
                  리스트
                </Button>
                <Button
                  variant={data.viewMode === 'calendar' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => data.handleToggleViewMode('calendar')}
                >
                  캘린더
                </Button>
                <Button
                  variant="solid"
                  size="sm"
                  onClick={() => data.setShowCreateForm(!data.showCreateForm)}
                >
                  {data.terms.GROUP_LABEL} 생성
                </Button>
              </div>
            }
          />

          {/* 수업 목록 탭 (기본) */}
          {data.selectedSubMenu === 'list' && (
            <>
              {/* 통계 카드 */}
              <StatisticsCards />

          {/* 수업 목록 또는 캘린더 뷰 */}
          {data.isLoading ? (
            <Card padding="lg">
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                로딩 중...
              </div>
            </Card>
          ) : data.error ? (
            <Card padding="md">
              <div style={{ color: 'var(--color-error)', padding: 'var(--spacing-md)' }}>
                오류: {data.error.message}
              </div>
            </Card>
          ) : (
            <DataTable
              data={data.filteredClasses}
              onRowClick={(classItem) => data.handleClassSelect(classItem.id)}
              filters={[
                {
                  type: 'text',
                  columnKey: 'search',
                  label: '검색',
                  placeholder: `${data.terms.GROUP_LABEL}명을 검색하세요.`,
                },
                {
                  type: 'select',
                  columnKey: 'subject',
                  label: data.terms.SUBJECT_LABEL || '과목',
                  placeholder: '과목을 선택하세요.',
                  options: [
                    { value: '', label: '전체' },
                    { value: '국어', label: '국어' },
                    { value: '영어', label: '영어' },
                    { value: '수학', label: '수학' },
                    { value: '과학', label: '과학' },
                  ],
                },
                {
                  type: 'select',
                  columnKey: 'day_of_week',
                  label: '요일',
                  placeholder: '요일을 선택하세요.',
                  options: [
                    { value: '', label: '전체' },
                    ...DAYS_OF_WEEK.map(d => ({ value: d.value, label: d.label })),
                  ],
                },
                {
                  type: 'select',
                  columnKey: 'time_slot',
                  label: '시간대',
                  placeholder: '시간대를 선택하세요.',
                  options: [
                    { value: '', label: '전체' },
                    { value: 'morning', label: '오전 (06~12시)' },
                    { value: 'afternoon', label: '오후 (12~18시)' },
                    { value: 'evening', label: '저녁 (18~24시)' },
                  ],
                },
                {
                  type: 'select',
                  columnKey: 'status',
                  label: '상태',
                  placeholder: '상태를 선택하세요.',
                  options: [
                    { value: '', label: '전체' },
                    { value: 'active', label: '운영 중' },
                    { value: 'inactive', label: '중단' },
                  ],
                },
              ]}
              initialFilterState={{
                search: { text: data.filter.search || '' },
                subject: { selected: data.filter.subject || '' },
                day_of_week: { selected: typeof data.filter.day_of_week === 'string' ? data.filter.day_of_week : '' },
                time_slot: { selected: data.timeSlotFilter },
                status: { selected: typeof data.filter.status === 'string' ? data.filter.status : '' },
              }}
              onFilterChange={(filterState) => {
                if (filterState.search?.text !== undefined) {
                  data.setFilter(prev => ({ ...prev, search: filterState.search.text }));
                }
                if (filterState.subject?.selected !== undefined) {
                  data.setFilter(prev => ({ ...prev, subject: filterState.subject.selected || undefined }));
                }
                if (filterState.day_of_week?.selected !== undefined) {
                  data.setFilter(prev => ({ ...prev, day_of_week: filterState.day_of_week.selected as DayOfWeek | undefined }));
                }
                if (filterState.time_slot?.selected !== undefined) {
                  data.setTimeSlotFilter(filterState.time_slot.selected || '');
                }
                if (filterState.status?.selected !== undefined) {
                  data.setFilter(prev => ({ ...prev, status: filterState.status.selected as ClassStatus | undefined }));
                }
              }}
              enableClientSideFiltering={false}
              columns={[
                {
                  key: 'subject',
                  label: data.terms.SUBJECT_LABEL || '과목',
                  width: '12%',
                  render: (_, classItem) => (
                    <span>{classItem.subject || '-'}</span>
                  ),
                },
                {
                  key: 'name',
                  label: `${data.terms.GROUP_LABEL}명`,
                  width: '18%',
                  render: (_, classItem) => (
                    <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{classItem.name}</span>
                  ),
                },
                {
                  key: 'schedule',
                  label: '일정',
                  width: '18%',
                  render: (_, classItem) => {
                    const dayOfWeek = classItem.day_of_week;
                    let dayLabels: string;
                    if (Array.isArray(dayOfWeek) && dayOfWeek.length > 0) {
                      if (dayOfWeek.length === 1) {
                        dayLabels = DAYS_OF_WEEK.find((day) => day.value === dayOfWeek[0])?.label || dayOfWeek[0];
                      } else {
                        const abbreviated = dayOfWeek.slice(0, -1).map(d => {
                          const label = DAYS_OF_WEEK.find((day) => day.value === d)?.label || d;
                          return label.charAt(0);
                        });
                        const lastDay = DAYS_OF_WEEK.find((day) => day.value === dayOfWeek[dayOfWeek.length - 1])?.label || dayOfWeek[dayOfWeek.length - 1];
                        dayLabels = [...abbreviated, lastDay].join(', ');
                      }
                    } else if (dayOfWeek) {
                      dayLabels = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek)?.label || String(dayOfWeek);
                    } else {
                      dayLabels = '-';
                    }
                    return <span>{dayLabels}</span>;
                  },
                },
                {
                  key: 'time',
                  label: '수업시간',
                  width: '18%',
                  render: (_, classItem) => {
                    const formatTime = (time: string | null | undefined) => {
                      if (!time) return null;
                      const match = time.match(/^(\d{2}:\d{2})/);
                      return match ? match[1] : time;
                    };
                    const startTime = formatTime(classItem.start_time);
                    const endTime = formatTime(classItem.end_time);
                    return (
                      <span>
                        {startTime && endTime ? `${startTime} ~ ${endTime}` : '-'}
                      </span>
                    );
                  },
                },
                {
                  key: 'capacity',
                  label: `${data.terms.CAPACITY_LABEL}`,
                  width: '12%',
                  align: 'center',
                  render: (_, classItem) => (
                    <span>
                      {classItem.capacity ? `${classItem.current_count || 0}/${classItem.capacity}명` : '-'}
                    </span>
                  ),
                },
                {
                  key: 'teacher',
                  label: '담당',
                  width: '12%',
                  render: (_, classItem) => {
                    const teacherNames = data.classTeachersMap.get(classItem.id) as Array<{ name: string }> | undefined;
                    if (teacherNames && teacherNames.length > 0) {
                      return <span>{teacherNames.map((t) => t.name).join(', ')}</span>;
                    }
                    return <span style={{ color: 'var(--color-text-tertiary)' }}>-</span>;
                  },
                },
                {
                  key: 'status',
                  label: '상태',
                  width: '10%',
                  align: 'center',
                  render: (_, classItem) => {
                    const isActive = classItem.status === 'active';
                    return (
                      <Badge
                        color={isActive ? 'success' : 'gray'}
                        variant="solid"
                        size="sm"
                      >
                        {isActive ? '운영 중' : '중단'}
                      </Badge>
                    );
                  },
                },
              ]}
            />
          )}
            </>
          )}

          {/* 수업 편성표(캘린더) 탭 */}
          {data.selectedSubMenu === 'calendar' && (
            <>
              {data.isLoading ? (
                <Card padding="lg">
                  <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                    로딩 중...
                  </div>
                </Card>
              ) : (
                <ClassCalendarView classes={data.classes || []} onClassSelect={data.handleClassSelect} />
              )}
            </>
          )}

          {/* 수업 통계 탭 */}
          {data.selectedSubMenu === 'statistics' && (
            <ClassStatisticsTab />
          )}

          {/* 일정 충돌 탭 */}
          {data.selectedSubMenu === 'schedule-conflicts' && (
            <ScheduleConflictsTab />
          )}

          {/* [업종중립] 수업 등록 폼 - 모달로 표시 */}
          {data.showCreateForm && (() => {
            let triggerSubmit: (() => void) | null = null;
            return (
              <Modal
                isOpen={data.showCreateForm}
                onClose={() => data.setShowCreateForm(false)}
                title={`${data.terms.GROUP_LABEL}생성`}
                size="lg"
                footer={
                  <>
                    <Button
                      variant="outline"
                      onClick={() => data.setShowCreateForm(false)}
                      style={{ flex: 1 }}
                    >
                      취소
                    </Button>
                    <Button
                      variant="solid"
                      color="primary"
                      onClick={() => triggerSubmit?.()}
                      style={{ flex: 1 }}
                    >
                      저장
                    </Button>
                  </>
                }
              >
                <CreateClassForm
                  onClose={() => data.setShowCreateForm(false)}
                  onSubmit={async (formData) => {
                    await data.handleCreateClass(formData);
                  }}
                  effectiveFormSchema={data.effectiveFormSchema}
                  onSubmitTrigger={(fn) => { triggerSubmit = fn; }}
                />
              </Modal>
            );
          })()}
        </Container>
        </RightLayerMenuLayout>
        </div>
      </div>
    </ErrorBoundary>
  );
}
