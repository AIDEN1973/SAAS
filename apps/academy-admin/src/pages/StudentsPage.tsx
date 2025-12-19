/**
 * 학생 관리 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary, useIconSize, useIconStrokeWidth, useModal, useResponsiveMode, IconButtonGroup, Input, Badge, ActionButtonGroup } from '@ui-core/react';
import { DataTableActionButtons, PlusIcon } from '../components/DataTableActionButtons';
import { MessageSquare, FileText, User, Users, BookOpen, Calendar, AlertTriangle, Tag as TagIcon, ChevronDown, ChevronUp, Trash2, Pencil, X as XIcon, Save, AlertCircle, CheckCircle2, Lightbulb, RefreshCcw } from 'lucide-react';
import { BadgeSelect } from '../components/BadgeSelect';
import { Container, Card, Button, Drawer, PageHeader, RightLayerMenuLayout } from '@ui-core/react';
import { SchemaForm, SchemaFormWithMethods, SchemaFilter, SchemaTable } from '@schema-engine';
import type { UseFormReturn } from 'react-hook-form';
import { registerWidget } from '@schema-engine';
import { useStudentPage } from './hooks/useStudentPage';
import { useStudentTags, useStudentClasses } from '@hooks/use-student';
import { useConsultations } from '@hooks/use-student';
import { useAttendanceLogs, useCreateAttendanceLog, useUpdateAttendanceLog } from '@hooks/use-attendance';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useSchema } from '@hooks/use-schema';
import { toKST } from '@lib/date-utils';
import type { StudentFilter, StudentStatus, Student, CreateStudentInput, Gender, ConsultationType, Guardian, StudentConsultation } from '@services/student-service';
import type { AttendanceLog, CreateAttendanceLogInput } from '@services/attendance-service';
import type { Class } from '@services/class-service';
import type { Tag } from '@core/tags';
import type { FormSchema } from '@schema-engine/types';
import type { NotificationChannel } from '@core/notification';
import { notificationFormSchema } from '../schemas/notification.schema';
import { tagFormSchema } from '../schemas/tag.schema';

// [코드 중복 제거] 태그 입력값 처리 함수를 공통 유틸로 분리
// 태그 입력값 실시간 처리: 띄어쓰기 제거 (쉼표 다음 띄어쓰기는 허용)
const processTagInput = (inputValue: string): string => {
  const parts = inputValue.split(',');

  return parts.map((part, index) => {
    if (index === 0) {
      // 첫 번째 부분: 모든 띄어쓰기 제거
      return part.replace(/\s+/g, '');
    } else {
      // 쉼표 다음 부분: 앞의 띄어쓰기 하나만 허용, 나머지 제거
      const trimmed = part.trimStart();
      const withoutSpaces = trimmed.replace(/\s+/g, '');
      return part.startsWith(' ') ? ' ' + withoutSpaces : withoutSpaces;
    }
  }).join(',');
};

// 태그 이름 입력 필드 커스텀 컴포넌트 (실시간 띄어쓰기 제거)
const TagNameInputWidget: React.FC<{
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  fullWidth?: boolean;
}> = ({ value = '', onChange, onBlur, label, placeholder, error, disabled, fullWidth = true }) => {
  // [성능 최적화] processTagInput을 useCallback으로 메모이제이션
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const processed = processTagInput(newValue);
    onChange?.(processed);
  }, [onChange]);

  return (
    <Input
      type="text"
      label={label}
      placeholder={placeholder}
      error={error}
      disabled={disabled}
      fullWidth={fullWidth}
      value={value}
      onChange={handleChange}
      onBlur={onBlur}
    />
  );
};

// 위젯 등록
registerWidget('TagNameInput', () => Promise.resolve(TagNameInputWidget));

export function StudentsPage() {
  const navigate = useNavigate();
  const iconSize = useIconSize();
  const iconStrokeWidth = useIconStrokeWidth();

  // [아키텍처] Application Layer와 UI Composition 분리
  // - useStudentPage Hook이 모든 비즈니스 로직, 상태 관리, 데이터 페칭을 담당
  // - 이 컴포넌트는 UI 조립만 담당
  const {
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
    error,
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
    selectedStudentClasses,
    selectedStudentClassesLoading,
    allClasses,
    userId,
    userRole,

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
  } = useStudentPage();

  // actionContext와 onRowClick 메모이제이션하여 불필요한 리렌더링 방지
  const actionContextMemo = useMemo(() => ({
    navigate: (path: string) => navigate(path),
  }), [navigate]);

  const handleRowClickMemo = useCallback((row: Record<string, unknown>) => {
    const studentId = row.id as string;
    if (studentId) {
      handleStudentSelect(studentId);
    }
  }, [handleStudentSelect]);

  return (
    <ErrorBoundary>
      <RightLayerMenuLayout
        layerMenu={{
          isOpen: !!selectedStudentId,
          onClose: () => handleStudentSelect(null),
          title: selectedStudentLoading ? '로딩 중...' : selectedStudent ? (
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 'var(--spacing-xs)', minWidth: 0 }}>
              <span
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-extrabold)',
                  color: 'var(--color-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {selectedStudent.name}
              </span>
              <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', whiteSpace: 'nowrap' }}>
                학생 상세정보
              </span>
            </span>
          ) : '학생 상세',
          width: isTablet ? 'var(--width-layer-menu-tablet)' : 'var(--width-layer-menu)',
          children: selectedStudentLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              로딩 중...
            </div>
          ) : selectedStudent ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--height-full)' }}>
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
                  반배정 ({selectedStudentClasses.filter((sc) => sc.is_active).length})
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
                  variant={layerMenuTab === 'message' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange('message')}
                >
                  메시지 발송
                </Button>
              </div>
              {/* 탭 내용 */}
              <div className="academyAdmin-hiddenScrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                {layerMenuTab === 'info' && selectedStudent && (
                  <StudentInfoTab
                    student={selectedStudent}
                    isEditing={isEditing}
                    effectiveStudentFormSchema={effectiveFormSchema}
                    onCancel={() => setIsEditing(false)}
                    onSave={async (data) => {
                      await updateStudent.mutateAsync({ studentId: selectedStudent.id, input: data });
                      setIsEditing(false);
                    }}
                    onEdit={() => setIsEditing(true)}
                    onDelete={async () => {
                      const confirmed = await showConfirm(
                        '정말 삭제하시겠습니까?\n(문서 기준: 학생은 삭제 시 상태가 퇴원(withdrawn)으로 변경됩니다.)',
                        '학생 삭제'
                      );
                      if (!confirmed) return;
                      await deleteStudent.mutateAsync(selectedStudent.id);
                      showAlert('학생이 삭제(퇴원 처리)되었습니다.', '성공', 'success');
                      handleStudentSelect(null);
                    }}
                  />
                )}
                {layerMenuTab === 'guardians' && selectedStudent && (
                  <GuardiansTab
                    guardians={selectedStudentGuardians || []}
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
                    consultations={selectedStudentConsultations || []}
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
                          error instanceof Error ? error.message : 'AI 요약에 실패했습니다.',
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
                    tagFormSchema={tagFormSchema}
                  />
                )}
                {layerMenuTab === 'classes' && selectedStudent && (
                  <ClassesTab
                    studentClasses={selectedStudentClasses}
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
                    onUpdate={async (studentClassId, enrolledAt) => {
                      // enrolled_at만 업데이트 (같은 반일 때)
                      const { apiClient } = await import('@api-sdk/core');
                      await apiClient.patch('student_classes', studentClassId, {
                        enrolled_at: enrolledAt,
                      });
                    }}
                    isEditable={userRole !== 'teacher' && userRole !== 'assistant'}
                  />
                )}
                {layerMenuTab === 'attendance' && selectedStudent && (
                  <AttendanceTab
                    studentId={selectedStudentId}
                    student={selectedStudent}
                    isEditable={userRole !== 'teacher' && userRole !== 'assistant'}
                  />
                )}
                {layerMenuTab === 'risk' && selectedStudent && (
                  <RiskAnalysisTab
                    studentId={selectedStudentId}
                    isEditable={userRole !== 'teacher' && userRole !== 'assistant'}
                  />
                )}
                {layerMenuTab === 'message' && selectedStudent && (
                  <MessageSendTab
                    studentId={selectedStudentId}
                    student={selectedStudent}
                    isEditable={userRole !== 'teacher' && userRole !== 'assistant'}
                  />
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
            await handleFileUpload(file);
          }}
        />

        {/* 태그 필터 */}
        {tags && tags.length > 0 && (
            <div style={{ position: 'relative', marginBottom: 'var(--spacing-md)' }}>
              <div
                ref={tagListRef}
                style={{
                  display: 'flex',
                  gap: 'var(--spacing-xs)',
                  flexWrap: 'wrap',
                  // 토글 버튼 영역 확보 (우측 화살표가 버튼을 가리지 않도록)
                  // [불변 규칙] 하드코딩 금지: CSS 변수만 사용 (스키마엔진 문서 1 참조)
                  paddingRight: showTagListToggle
                    ? 'calc(var(--spacing-sm) + var(--size-icon-base) + var(--spacing-xs))'
                    : undefined,
                  // 접기 상태: 1줄까지만 보여주기
                  maxHeight: !isTagListExpanded && tagListCollapsedHeight ? `${tagListCollapsedHeight}px` : undefined,
                  overflow: !isTagListExpanded && showTagListToggle ? 'hidden' : undefined,
                  transition: 'max-height var(--transition-fast)',
                }}
              >
                {/* 요청사항: 태그가 있는 경우에만, 첫 번째 태그 왼쪽에 배지 버튼 출력 */}
                {/* [최적화] 외부에서 이미 tags && tags.length > 0로 체크했으므로 중복 체크 제거 */}
                  <div
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-bold)',
                      fontFamily: 'var(--font-family)',
                      lineHeight: 'var(--line-height)',
                      borderRadius: 'var(--border-radius-xs)',
                      border: 'var(--border-width-thin) solid var(--color-text)',
                      color: 'var(--color-white)',
                      backgroundColor: 'var(--color-text)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    태그
                  </div>
                {tags.map((tag: { id: string; name: string; color: string }) => (
                  <Button
                    key={tag.id}
                    variant={filter.tag_ids?.includes(tag.id) ? 'solid' : 'outline'}
                    size="sm"
                    onClick={() => handleTagFilter(tag.id)}
                    style={{
                      // 요청사항:
                      // - 태그 리스트 버튼 사이즈(체감)를 줄임 (CSS 변수 사용)
                      // - 기본(미선택) 버튼 배경을 화이트로 고정
                      // [불변 규칙] 하드코딩 금지: CSS 변수만 사용 (스키마엔진 문서 1 참조)
                      fontSize: 'calc(var(--font-size-sm) - var(--spacing-xxs))',
                      backgroundColor: filter.tag_ids?.includes(tag.id) ? tag.color : 'var(--color-white)',
                      color: filter.tag_ids?.includes(tag.id) ? 'var(--color-white)' : undefined,
                    }}
                  >
                    {tag.name}
                  </Button>
                ))}
              </div>

              {/* 요청사항: 화살표만 추가 (한 줄 초과 시에만 노출) */}
              {showTagListToggle && (
                <button
                  type="button"
                  aria-label={isTagListExpanded ? '태그 목록 접기' : '태그 목록 펼치기'}
                  onClick={() => setIsTagListExpanded((v: boolean) => !v)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    height: tagListCollapsedHeight ? `${tagListCollapsedHeight}px` : 'var(--size-pagination-button)',
                    // [불변 규칙] 하드코딩 금지: CSS 변수만 사용 (스키마엔진 문서 1 참조)
                    width: 'calc(var(--spacing-sm) + var(--size-icon-base) + var(--spacing-xs))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {isTagListExpanded
                    ? <ChevronUp size={iconSize} strokeWidth={iconStrokeWidth} />
                    : <ChevronDown size={iconSize} strokeWidth={iconStrokeWidth} />}
                </button>
              )}
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
                  width={isTablet ? 'var(--width-drawer-tablet)' : 'var(--width-full)'}
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
                  schema={effectiveTableSchema}
                  data={(students as unknown as Record<string, unknown>[]) || []}
                  totalCount={totalCount}
                  page={tablePage}
                  onPageChange={setTablePage}
                  filters={tableFilters}
                  actionContext={actionContextMemo}
                  onRowClick={handleRowClickMemo}
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

// ============================================================================
// RightLayerMenu: Header(밑줄만) + Content 컨테이너 공통 스타일
// - Card의 title 영역을 쓰지 않고, 상단 헤더를 분리하여 밑줄만 적용
// - 밑줄 색상은 텍스트 기본색(var(--color-text))을 사용
// - 테두리/배경은 제거(하드코딩 금지, CSS 변수 사용)
// ============================================================================
function LayerSectionHeader({
  title,
  right,
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: right ? 'space-between' : 'flex-start',
        gap: 'var(--spacing-sm)',
        // 요구사항: 헤더/본문 간 여백 체감 축소를 위해 헤더 상하 패딩 한 단계 축소
        paddingTop: 'var(--spacing-sm)',
        paddingBottom: 'var(--spacing-sm)',
        // 요구사항: 우측(필터 배지/추가 버튼) 우측 여백을 좌측(아이콘+타이틀) 좌측 여백과 동일하게
        paddingLeft: 'var(--spacing-form-horizontal-left)',
        paddingRight: 'var(--spacing-form-horizontal-left)',
        // 헤더 밑줄(=borderBottom)과 본문 카드 사이 간격 표준화 (기본정보 탭 기준)
        // 요구사항: 헤더와 바로 아래 카드 사이 여백 한 단계 축소
        marginBottom: 'var(--spacing-xs)',
        // 우측 액션(필터/추가 버튼) 유무에 따라 높이가 달라지지 않도록 최소 높이 보장
        // (Card 타이틀 영역과 동일 기준: --size-pagination-button)
        minHeight: 'calc(var(--spacing-sm) + var(--size-pagination-button) + var(--spacing-sm))',
        backgroundColor: 'transparent',
        border: 'none',
        // 요구사항: 헤더 아래 밑줄 제거
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          color: 'var(--color-text)',
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-bold)',
        }}
      >
        {title}
      </div>
      {right ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          {right}
        </div>
      ) : (
        // 우측 컨텐츠가 없어도 높이(버튼 기준)를 맞추기 위한 스페이서
        <div style={{ width: 0, height: 'var(--size-pagination-button)', minHeight: 'var(--size-pagination-button)' }} />
      )}
    </div>
  );
}

// NOTE: “헤더는 분리(밑줄만), 본문은 카드로 보여야 함” 요구사항에 따라
// 레이어 섹션 본문은 Card 기본 스타일(배경/테두리 포함)을 유지합니다.
// 따라서 여기서는 본문 카드의 스타일을 오버라이드하지 않습니다.
const layerSectionCardStyle: React.CSSProperties = {};

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
  effectiveStudentFormSchema: FormSchema;
  onCancel: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
}

function StudentInfoTab({ student, isEditing, effectiveStudentFormSchema, onCancel, onSave, onEdit, onDelete }: StudentInfoTabProps) {
  // 훅은 항상 컴포넌트 최상단에서 호출되어야 함 (React Hooks 규칙)
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  // [성능 최적화] 디버깅 로그는 개발 환경에서만 실행
  // 프로덕션에서는 제거되어 번들 크기 감소
  // [PII 보안] PII 필드는 마스킹하여 로깅
  useEffect(() => {
    if (import.meta.env?.DEV) {
      // PII 마스킹 유틸리티 import
      import('@core/pii-utils').then(({ maskPII }) => {
        console.group('🔍 [StudentInfoTab] 디버깅 정보');
        console.log('📋 student prop:', maskPII({
          id: student?.id,
          name: student?.name,
          birth_date: student?.birth_date,
          gender: student?.gender,
          phone: student?.phone,
          email: student?.email,
          address: student?.address,
          school_name: student?.school_name,
          grade: student?.grade,
          status: student?.status,
          notes: student?.notes,
        }));
        console.log('✏️ isEditing:', isEditing);
        console.groupEnd();
      });
    }
  }, [student, isEditing]);

  // defaultValues를 useMemo로 메모이제이션하여 student 변경 시 재계산
  // [중요] 모든 Hook은 조건문 이전에 호출되어야 함
  const formDefaultValues = useMemo(() => {
    const values = {
      name: student.name || '',
      birth_date: student.birth_date || '',
      gender: student.gender || '',
      phone: student.phone || '',
      email: student.email || '',
      address: student.address || '',
      school_name: student.school_name || '',
      grade: student.grade || '',
      status: student.status || 'active',
      notes: student.notes || '',
    };

    // 디버깅: formDefaultValues 계산 확인
    // [PII 보안] PII 필드는 마스킹하여 로깅
    if (import.meta.env?.DEV) {
      import('@core/pii-utils').then(({ maskPII }) => {
        console.log('📝 [StudentInfoTab] formDefaultValues 계산:', maskPII(values));
      });
    }

    return values;
  }, [student]);

  // 수정 모드를 위한 스키마 (submit 버튼 커스터마이징)
  // [중요] 모든 Hook은 조건문 이전에 호출되어야 함
  const editSchema = useMemo(() => ({
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
  }), [effectiveStudentFormSchema]);

  // 조회(읽기) 모드 스키마: 수정폼과 동일 레이아웃을 쓰되, 모든 필드를 disabled 처리
  // [중요] Hook은 조건문 밖에서 호출되어야 함
  // 디버깅: SchemaForm 렌더링 확인
  // [중요] 모든 Hook은 조건문 이전에 호출되어야 함
  // [PII 보안] PII 필드는 마스킹하여 로깅
  useEffect(() => {
    if (isEditing && import.meta.env?.DEV) {
      import('@core/pii-utils').then(({ maskPII }) => {
        console.log('📋 [StudentInfoTab] SchemaForm 렌더링:', maskPII({
          studentId: student.id,
          formDefaultValues,
          editSchemaFields: editSchema.form?.fields?.map(f => f.name),
        }));
      });
    }
  }, [isEditing, student.id, formDefaultValues, editSchema]);

  // 읽기 전용 모드: 수정폼과 동일한 2열 레이아웃, 텍스트만 출력 (아이콘/드롭다운 없음)
  // 필드 정의 (수정폼 스키마와 동일한 순서/구조)
  const readOnlyFields = useMemo(() => [
    { label: '이름', value: student.name || '-' },
    { label: '생년월일', value: student.birth_date || '-' },
    { label: '성별', value: student.gender === 'male' ? '남' : student.gender === 'female' ? '여' : '-' },
    { label: '전화번호', value: student.phone || '-' },
    { label: '이메일', value: student.email || '-' },
    { label: '학교', value: student.school_name || '-' },
    { label: '학년', value: student.grade || '-' },
    { label: '상태', value: student.status === 'active' ? '재원' : student.status === 'on_leave' ? '휴원' : student.status === 'withdrawn' ? '퇴원' : student.status === 'graduated' ? '졸업' : '-' },
    { label: '주소', value: student.address || '-', colSpan: 2 },
    { label: '메모', value: student.notes || '-', colSpan: 2 },
  ], [student]);

  if (!isEditing) {
    return (
      <div>
        <LayerSectionHeader
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <User size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
              기본정보
            </span>
          }
        />
        <Card
          padding="md"
          variant="default"
          style={{
            ...layerSectionCardStyle,
            // 요구사항: 기본보기에서만 카드 테두리를 텍스트 기본 색상으로 출력
            border: 'var(--border-width-thin) solid var(--color-text)',
          }}
        >
        {/* 수정폼과 동일한 2열 그리드 레이아웃, 텍스트만 출력 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
            gap: 'var(--spacing-md)',
          }}
        >
          {readOnlyFields.map((field, idx) => (
            <div
              key={idx}
              style={{
                // 모바일 기본보기: 1열이므로 colSpan 2도 span 1로 강제
                gridColumn: field.colSpan === 2 ? (isMobile ? 'span 1' : 'span 2') : undefined,
                display: 'flex',
                width: '100%',
                alignItems: field.label === '메모' ? 'flex-start' : 'center',
                // 수정폼(Input/Select/DatePicker)의 md 패딩과 동일하게 맞춤
                paddingTop: 'var(--spacing-sm)',
                paddingBottom: 'var(--spacing-sm)',
                paddingLeft: 'var(--spacing-form-horizontal-left)',
                paddingRight: 'var(--spacing-form-horizontal-right)',
                // 요구사항: 기본보기 밑줄은 원래 연한 색상으로 복구
                borderBottom: 'var(--border-width-thin) solid var(--color-table-row-border)',
              }}
            >
              {/* 항목명: 고정 너비 (수정폼 인라인 라벨과 동일) */}
              <span
                style={{
                  color: 'var(--color-form-inline-label)',
                  fontSize: 'var(--font-size-base)',
                  fontFamily: 'var(--font-family)',
                  fontWeight: 'var(--font-weight-normal)',
                  lineHeight: 'var(--line-height)',
                  minWidth: 'var(--width-form-inline-label)',
                  flexShrink: 0,
                  marginRight: 'var(--spacing-form-inline-label-gap)',
                }}
              >
                {field.label}
              </span>
              {/* 결과값 */}
              <span
                style={{
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-size-base)',
                  fontFamily: 'var(--font-family)',
                  fontWeight: 'var(--font-weight-normal)',
                  lineHeight: 'var(--line-height)',
                  whiteSpace: field.label === '메모' ? 'pre-wrap' : 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {field.value}
              </span>
            </div>
          ))}
        </div>
        {/* 요구사항: 기본보기 > 삭제/수정 버튼 텍스트 제거, IconButtonGroup 스타일(아이콘만) + 우측 정렬 */}
        {(onEdit || onDelete) && (
          <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
            <IconButtonGroup
              align="right"
              items={[
                ...(onDelete ? [{
                  icon: Trash2,
                  tooltip: '삭제',
                  variant: 'outline' as const,
                  color: 'error' as const,
                  onClick: () => { void onDelete?.(); },
                }] : []),
                ...(onEdit ? [{
                  icon: Pencil,
                  tooltip: '수정',
                  variant: 'outline' as const,
                  onClick: onEdit,
                }] : []),
              ]}
            />
          </div>
        )}
        </Card>
      </div>
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

  return (
    <div>
      <LayerSectionHeader
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <User size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
            학생정보 수정
          </span>
        }
      />
      <SchemaForm
        key={student.id} // student.id를 key로 사용하여 학생 변경 시 폼 재마운트
        schema={editSchema}
        onSubmit={handleSubmit}
        defaultValues={formDefaultValues}
        apiClient={apiClient}
        disableCardPadding={false}
        cardTitle={undefined}
        onCancel={onCancel}
        onDelete={onDelete}
      />
    </div>
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
  const [relationshipFilter, setRelationshipFilter] = useState<'all' | 'parent' | 'guardian' | 'other'>('all');

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      // 주 보호자 처리:
      // - DB 레벨에 "주 보호자 1명" 제약이 없어서 복수 true가 들어갈 수 있음
      // - 하지만 다른 기능(예: 알림 발송 등)에서 is_primary=true 1명을 전제로 조회하므로
      //   새로 주 보호자를 true로 저장할 때 기존 주 보호자는 자동으로 false로 내림
      const wantsPrimary = Boolean((data as { is_primary?: unknown }).is_primary);
      if (!editingGuardianId && wantsPrimary) {
        const currentPrimaryGuardians = guardians.filter((g) => g.is_primary);
        if (currentPrimaryGuardians.length > 0) {
          // 사용자 확인 없이 자동 조정(UX 단순화)
          await Promise.all(
            currentPrimaryGuardians.map((g) => onUpdate(g.id, { is_primary: false }))
          );
        }
      }

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

  // 타이틀 아이콘 크기 및 선 두께 계산 (CSS 변수 사용)
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  const baseIconSize = useIconSize();
  const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  const emptyStateIconStrokeWidth = useIconStrokeWidth();

  // 필터링된 학부모 목록
  const filteredGuardians = useMemo(() => {
    if (relationshipFilter === 'all') {
      return guardians;
    }
    return guardians.filter((guardian) => guardian.relationship === relationshipFilter);
  }, [guardians, relationshipFilter]);

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div>
      {showForm && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Users size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                {isEditable && editingGuardianId ? '학부모 정보 수정' : '학부모 추가'}
              </span>
            }
          />
          <SchemaForm
            schema={{
              ...effectiveGuardianFormSchema,
              form: {
                ...effectiveGuardianFormSchema.form,
                // [불변 규칙] actions를 명시적으로 비활성화하여 SchemaForm이 자동 API 호출을 하지 않도록 함
                // handleSubmit에서 onCreate/onUpdate를 통해 직접 처리
                actions: [],
              },
              // 최상위 actions도 비활성화
              actions: [],
            }}
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
            disableCardPadding={false}
            cardTitle={undefined}
            onCancel={onHideForm}
            onDelete={
              isEditable && editingGuardianId
                ? async () => {
                    const confirmed = await showConfirm('정말 삭제하시겠습니까?', '보호자 삭제');
                    if (!confirmed) return;
                    await onDelete(editingGuardianId);
                    onHideForm();
                  }
                : undefined
            }
          />
        </div>
      )}

      {!showForm && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Users size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                학부모 정보
              </span>
            }
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <BadgeSelect
                  value={relationshipFilter}
                  onChange={(value) => setRelationshipFilter(value as typeof relationshipFilter)}
                  options={[
                    { value: 'all', label: '전체' },
                    { value: 'parent', label: '부모' },
                    { value: 'guardian', label: '보호자' },
                    { value: 'other', label: '기타' },
                  ]}
                  size="sm"
                  selectedColor="var(--color-text)"
                  unselectedColor="var(--color-text)"
                />
                {isEditable && (
                  <IconButtonGroup
                    items={[
                      {
                        icon: PlusIcon,
                        tooltip: '학부모 추가',
                        variant: 'solid',
                        color: 'primary',
                        onClick: onShowForm,
                      },
                    ]}
                    align="right"
                  />
                )}
              </div>
            }
          />
          {filteredGuardians.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {filteredGuardians.map((guardian) => (
                <Card
                  key={guardian.id}
                  padding="md"
                  variant="default"
                  style={{
                    // 요구사항: 카드 라운드 한 단계 축소 (md -> sm)
                    borderRadius: 'var(--border-radius-sm)',
                    // 요구사항: 기본보기에서만 카드 테두리를 텍스트 기본 색상으로 출력
                    border: 'var(--border-width-thin) solid var(--color-text)',
                  }}
                >
                  {/* 기본보기: 수정폼과 동일한 레이아웃을 읽기 전용으로 렌더링 (아이콘/드롭다운 없음) */}
                  {(() => {
                    const readOnlyFields = [
                      { label: '이름', value: guardian.name || '-' },
                      {
                        label: '관계',
                        value: guardian.relationship === 'parent' ? '부모' : guardian.relationship === 'guardian' ? '보호자' : '기타',
                      },
                      { label: '전화번호', value: guardian.phone || '-' },
                      { label: '이메일', value: guardian.email || '-', },
                      { label: '주 보호자', value: guardian.is_primary ? '예' : '아니오' },
                      { label: '메모', value: guardian.notes || '-', colSpan: 2 },
                    ] as Array<{ label: string; value: string; colSpan?: 2 }>;

                    return (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                          // 기본정보(tab=info) 기본보기와 동일
                          gap: 'var(--spacing-md)',
                          // 기본정보(tab=info)에서는 정상인데 guardians에서만 밑줄이 짧아지는 케이스 방지:
                          // grid item이 내용 폭으로 줄어들지 않도록 강제
                          width: '100%',
                          justifyItems: 'stretch',
                        }}
                      >
                        {readOnlyFields.map((field, idx) => (
                          <div
                            key={idx}
                            style={{
                              // 모바일 기본보기: 1열이므로 colSpan 2도 span 1로 강제
                              gridColumn: field.colSpan === 2 ? (isMobile ? 'span 1' : 'span 2') : undefined,
                              display: 'flex',
                              width: '100%',
                              alignItems: field.label === '메모' ? 'flex-start' : 'center',
                              paddingTop: 'var(--spacing-sm)',
                              paddingBottom: 'var(--spacing-sm)',
                              paddingLeft: 'var(--spacing-form-horizontal-left)',
                              paddingRight: 'var(--spacing-form-horizontal-right)',
                              // tab=info와 동일하게 borderBottom 사용 (overflow: hidden 제거로 클리핑 해결)
                              borderBottom: 'var(--border-width-thin) solid var(--color-table-row-border)',
                            }}
                          >
                            <span
                              style={{
                                color: 'var(--color-form-inline-label)',
                                fontSize: 'var(--font-size-base)',
                                fontFamily: 'var(--font-family)',
                                fontWeight: 'var(--font-weight-normal)',
                                lineHeight: 'var(--line-height)',
                                minWidth: 'var(--width-form-inline-label)',
                                flexShrink: 0,
                                marginRight: 'var(--spacing-form-inline-label-gap)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {field.label}
                            </span>
                            <span
                              style={{
                                color: 'var(--color-text)',
                                fontSize: 'var(--font-size-base)',
                                fontFamily: 'var(--font-family)',
                                fontWeight: 'var(--font-weight-normal)',
                                lineHeight: 'var(--line-height)',
                                whiteSpace: field.label === '메모' ? 'pre-wrap' : 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {field.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {/* 요구사항: 기본보기 > 삭제/수정 버튼 텍스트 제거, IconButtonGroup 스타일(아이콘만) + 우측 정렬 */}
                  {isEditable && (
                    <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
                      <IconButtonGroup
                        align="right"
                        items={[
                          {
                            icon: Trash2,
                            tooltip: '삭제',
                            variant: 'outline',
                            color: 'error',
                            onClick: () => onDelete(guardian.id),
                          },
                          {
                            icon: Pencil,
                            tooltip: '수정',
                            variant: 'outline',
                            onClick: () => onEdit(guardian.id),
                          },
                        ]}
                      />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card padding="md" variant="default" style={layerSectionCardStyle}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'calc(var(--spacing-xl) * 5)', // [불변 규칙] CSS 변수 사용
                padding: 'var(--spacing-xl)',
              }}>
                <Users
                  size={emptyStateIconSize}
                  strokeWidth={emptyStateIconStrokeWidth}
                  style={{
                    color: 'var(--color-gray-300)',
                    marginBottom: 'var(--spacing-xs)',
                    display: 'inline-block',
                  }}
                />
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  {guardians.length === 0 ? '등록된 학부모가 없습니다.' : '필터 조건에 맞는 학부모가 없습니다.'}
                </p>
              </div>
            </Card>
          )}
        </div>
      )}
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
  const formRef = useRef<HTMLDivElement>(null);

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  const baseIconSize = useIconSize();
  const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  const emptyStateIconStrokeWidth = useIconStrokeWidth();

  // 타이틀 아이콘 크기 및 선 두께 계산 (CSS 변수 사용)
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();

  // [불변 규칙] textarea 높이는 CSS 변수로만 계산
  // 하드코딩된 rows 값 사용 금지 (문서 규칙 준수)
  // getComputedStyle + parseFloat 대신 calc() 사용하여 하드코딩 완전 제거
  useEffect(() => {
    if (showForm && formRef.current && !isMobile && !isTablet) {
      const form = formRef.current.querySelector('form');
      if (form) {
        // 상담 내용 textarea 높이 조정
        const textarea = form.querySelector('textarea[name="content"]') as HTMLTextAreaElement;
        if (textarea) {
          // [불변 규칙] CSS 변수만 사용하여 minHeight 계산 (calc() 사용)
          // 6줄 기준: line-height * font-size-base * 6 + padding (상하)
          textarea.style.minHeight = 'calc(var(--line-height) * var(--font-size-base) * 6 + var(--spacing-sm) * 2)';
        }
      }
    }
  }, [showForm, isMobile, isTablet]);

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
      {showForm && (
        <div ref={formRef}>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <FileText size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                {editingConsultationId ? '상담일지 수정' : '상담일지 등록'}
              </span>
            }
          />
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
            disableCardPadding={false}
            cardTitle={undefined}
            onCancel={onHideForm}
            onDelete={
              isEditable && editingConsultationId
                ? async () => {
                    const confirmed = await showConfirm('정말 삭제하시겠습니까?', '상담일지 삭제');
                    if (!confirmed) return;
                    await onDelete(editingConsultationId);
                    onHideForm();
                  }
                : undefined
            }
          />
        </div>
      )}

      {!showForm && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <FileText size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                상담일지
              </span>
            }
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
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
                  selectedColor="var(--color-text)"
                  unselectedColor="var(--color-text)"
                />
                {isEditable && (
                  <IconButtonGroup
                    items={[
                      {
                        icon: PlusIcon,
                        tooltip: '일지등록',
                        variant: 'solid',
                        color: 'primary',
                        onClick: onShowForm,
                      },
                    ]}
                    align="right"
                  />
                )}
              </div>
            }
          />
          {consultations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {consultations.map((consultation) => (
                <Card
                  key={consultation.id}
                  padding="md"
                  variant="default"
                  style={{
                    // 요구사항: 카드 라운드 한 단계 축소 (md -> sm)
                    borderRadius: 'var(--border-radius-sm)',
                    // 요구사항: 기본보기에서만 카드 테두리를 텍스트 기본 색상으로 출력
                    border: 'var(--border-width-thin) solid var(--color-text)',
                  }}
                >
                  {/* 기본보기: 수정폼과 동일한 레이아웃을 읽기 전용으로 렌더링 */}
                  {(() => {
                    const typeLabel =
                      consultation.consultation_type === 'counseling' ? '상담일지'
                      : consultation.consultation_type === 'learning' ? '학습일지'
                      : consultation.consultation_type === 'behavior' ? '행동일지'
                      : '기타';

                    const readOnlyFields = [
                      { label: '상담일', value: consultation.consultation_date || '-' },
                      { label: '유형', value: typeLabel },
                      { label: '내용', value: consultation.content || '-', colSpan: 2 },
                      ...(consultation.ai_summary ? [{ label: 'AI 요약', value: consultation.ai_summary, colSpan: 2 as const }] : []),
                    ] as Array<{ label: string; value: string; colSpan?: 2 }>;

                    return (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                          gap: 'var(--spacing-md)',
                        }}
                      >
                        {readOnlyFields.map((field, idx) => (
                          <div
                            key={idx}
                            style={{
                              // 모바일 기본보기: 1열이므로 colSpan 2도 span 1로 강제
                              gridColumn: field.colSpan === 2 ? (isMobile ? 'span 1' : 'span 2') : undefined,
                              display: 'flex',
                              width: '100%',
                              alignItems: (field.label === '내용' || field.label === 'AI 요약') ? 'flex-start' : 'center',
                              paddingTop: 'var(--spacing-sm)',
                              paddingBottom: 'var(--spacing-sm)',
                              paddingLeft: 'var(--spacing-form-horizontal-left)',
                              paddingRight: 'var(--spacing-form-horizontal-right)',
                              // 요구사항: 기본보기 밑줄은 원래 연한 색상으로 복구
                              borderBottom: 'var(--border-width-thin) solid var(--color-table-row-border)',
                            }}
                          >
                            <span
                              style={{
                                color: 'var(--color-form-inline-label)',
                                fontSize: 'var(--font-size-base)',
                                fontFamily: 'var(--font-family)',
                                fontWeight: 'var(--font-weight-normal)',
                                lineHeight: 'var(--line-height)',
                                minWidth: 'var(--width-form-inline-label)',
                                flexShrink: 0,
                                marginRight: 'var(--spacing-form-inline-label-gap)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {field.label}
                            </span>
                            <span
                              style={{
                                color: 'var(--color-text)',
                                fontSize: 'var(--font-size-base)',
                                fontFamily: 'var(--font-family)',
                                fontWeight: 'var(--font-weight-normal)',
                                lineHeight: 'var(--line-height)',
                                whiteSpace: (field.label === '내용' || field.label === 'AI 요약') ? 'pre-wrap' : 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {field.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {/* 요구사항: 기본보기 > 삭제/수정 버튼 텍스트 제거, IconButtonGroup 스타일(아이콘만) + 우측 정렬 */}
                  {isEditable && (
                    <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
                      <IconButtonGroup
                        align="right"
                        items={[
                          {
                            icon: Trash2,
                            tooltip: '삭제',
                            variant: 'outline',
                            color: 'error',
                            onClick: () => onDelete(consultation.id),
                          },
                          {
                            icon: RefreshCcw,
                            tooltip: consultation.ai_summary ? 'AI 재요약' : 'AI 요약',
                            variant: 'outline',
                            onClick: () => onGenerateAISummary(consultation.id),
                          },
                          {
                            icon: Pencil,
                            tooltip: '수정',
                            variant: 'outline',
                            onClick: () => onEdit(consultation.id),
                          },
                        ]}
                      />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card padding="md" variant="default" style={layerSectionCardStyle}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'calc(var(--spacing-xl) * 5)', // [불변 규칙] CSS 변수 사용
                padding: 'var(--spacing-xl)',
              }}>
                <FileText
                  size={emptyStateIconSize}
                  strokeWidth={emptyStateIconStrokeWidth}
                  style={{
                    color: 'var(--color-gray-300)',
                    marginBottom: 'var(--spacing-xs)',
                    display: 'inline-block',
                  }}
                />
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>등록된 상담일지가 없습니다.</p>
              </div>
            </Card>
          )}
        </div>
      )}
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
  tagFormSchema: FormSchema;
}

function TagsTab({ studentTags, isLoading, studentId, onUpdateTags, isEditable = true, tagFormSchema }: TagsTabProps) {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const { data: allTags, isLoading: allTagsLoading, refetch: refetchTags } = useStudentTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempSelectedTagIds, setTempSelectedTagIds] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { showAlert } = useModal();

  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  const baseIconSize = useIconSize();
  const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  const emptyStateIconStrokeWidth = useIconStrokeWidth();

  const createTag = useMutation({
    mutationFn: async (data: { name: string }) => {
      // 인더스트리 테마 색상 가져오기
      // [불변 규칙] 하드코딩 금지: CSS 변수만 사용
      // getComputedStyle로 CSS 변수 값을 가져오고, 없으면 CSS 변수 문자열 자체를 사용
      let primaryColor = 'var(--color-primary)';
      if (typeof window !== 'undefined') {
        const computedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
        if (computedColor) {
          primaryColor = computedColor;
        }
      }

      // 쉼표만 구분자로 사용하고, 각 태그 이름에서 띄어쓰기 제거
      const tagNames = data.name
        .split(',')
        .map((name) => name.trim().replace(/\s+/g, ''))
        .filter((name) => name.length > 0);

      if (tagNames.length === 0) {
        throw new Error('태그 이름을 입력해주세요.');
      }

      const createdTags: Tag[] = [];
      const errors: string[] = [];

      // 기존 태그 목록에서 같은 이름의 태그 찾기
      const existingTags = allTags || [];
      const existingTagsMap = new Map<string, { id: string; name: string; color: string }>();
      existingTags.forEach((tag) => {
        existingTagsMap.set(tag.name.toLowerCase(), tag);
      });

      // 여러 태그 생성 및 개별회원 전용 태그로 할당
      for (const tagName of tagNames) {
        try {
          let tagId: string | undefined;

          // 기존 태그가 있는지 확인
          const existingTag = existingTagsMap.get(tagName.toLowerCase());
          if (existingTag) {
            // 기존 태그 사용
            tagId = existingTag.id;
          } else {
            // 새 태그 생성
            const tagResponse = await apiClient.post<Tag>('tags', {
              name: tagName,
              color: primaryColor,
              entity_type: 'student',
            });

            if (tagResponse.error || !tagResponse.data) {
              // 중복 키 오류인 경우 기존 태그를 다시 찾아보기
              if (tagResponse.error?.message?.includes('duplicate key')) {
                // 태그 목록을 다시 불러와서 확인
                const refetchResponse = await refetchTags();
                const refetchedTags = refetchResponse.data || [];
                const foundTag = refetchedTags.find(
                  (t) => t.name.toLowerCase() === tagName.toLowerCase()
                );
                if (foundTag) {
                  tagId = foundTag.id;
                } else {
                  errors.push(`${tagName}: ${tagResponse.error?.message || '태그 생성 실패'}`);
                  continue;
                }
              } else {
                errors.push(`${tagName}: ${tagResponse.error?.message || '태그 생성 실패'}`);
                continue;
              }
            } else {
              tagId = tagResponse.data.id;
              createdTags.push(tagResponse.data);
            }
          }

          if (!tagId) {
            errors.push(`${tagName}: 태그를 찾을 수 없습니다.`);
            continue;
          }

          // 기존 태그를 사용한 경우에도 createdTags에 추가 (할당 목적)
          if (existingTag) {
            // Tag 타입으로 변환 (필요한 필드만 포함)
            createdTags.push({
              id: existingTag.id,
              name: existingTag.name,
              color: existingTag.color,
            } as Tag);
          }

          // 개별회원 전용 태그로 할당 (즉시 해당 학생에게 할당)
          // 이미 할당되어 있는지 확인하지 않고 할당 시도 (중복은 서버에서 처리)
          const assignmentResponse = await apiClient.post('tag_assignments', {
            entity_id: studentId,
            entity_type: 'student',
            tag_id: tagId,
          });

          if (assignmentResponse.error) {
            // 중복 할당 오류는 무시 (이미 할당된 경우)
            if (!assignmentResponse.error.message?.includes('duplicate')) {
              errors.push(`${tagName} 할당 실패: ${assignmentResponse.error.message}`);
            }
          }
        } catch (error) {
          errors.push(`${tagName}: ${error instanceof Error ? error.message : '태그 생성 실패'}`);
        }
      }

      if (createdTags.length === 0) {
        throw new Error(errors.length > 0 ? errors.join(', ') : '태그 생성에 실패했습니다.');
      }

      if (errors.length > 0) {
        showAlert(
          `${createdTags.length}개 태그 생성 완료, ${errors.length}개 실패: ${errors.join(', ')}`,
          '부분 성공',
          'warning'
        );
      }

      return createdTags;
    },
    onSuccess: (createdTags) => {
      queryClient.invalidateQueries({ queryKey: ['tags', tenantId, 'student'] });
      queryClient.invalidateQueries({ queryKey: ['student-tags', tenantId, studentId] });
      refetchTags();
      setShowForm(false);

      // 생성된 태그를 선택된 태그 목록에 추가하여 #태그명 스타일로 표시
      if (createdTags.length > 0) {
        const newTagIds = createdTags.map((tag) => tag.id);
        setSelectedTagIds((prev) => [...prev, ...newTagIds]);
        showAlert(`${createdTags.length}개 태그가 생성되고 할당되었습니다.`, '성공', 'success');
      }
    },
    onError: (error: Error) => {
      showAlert(error.message || '태그 생성에 실패했습니다.', '오류', 'error');
    },
  });

  useEffect(() => {
    if (studentTags) {
      setSelectedTagIds(studentTags.map((tag) => tag.id));
    }
  }, [studentTags]);

  // 수정 모드 진입 시 임시 선택 상태 초기화
  useEffect(() => {
    if (isEditMode) {
      setTempSelectedTagIds([...selectedTagIds]);
    }
  }, [isEditMode, selectedTagIds]);

  const handleTagToggle = async (tagId: string) => {
    // 수정 모드가 아닐 때만 즉시 저장
    if (!isEditMode) {
      const newIds = selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId];

      setSelectedTagIds(newIds);

      // 즉시 저장
      try {
        await onUpdateTags(newIds);
      } catch (error) {
        // 실패 시 이전 상태로 복원
        setSelectedTagIds(selectedTagIds);
        showAlert(error instanceof Error ? error.message : '태그 저장에 실패했습니다.', '오류', 'error');
      }
    } else {
      // 수정 모드에서는 임시 상태만 변경
      setTempSelectedTagIds((prev) => {
        return prev.includes(tagId)
          ? prev.filter((id) => id !== tagId)
          : [...prev, tagId];
      });
    }
  };

  const handleSaveTags = async () => {
    try {
      // 해제된 태그 ID 찾기 (이전에 선택되었지만 현재 선택되지 않은 태그)
      const removedTagIds = selectedTagIds.filter((id) => !tempSelectedTagIds.includes(id));

      // 해제된 태그 삭제
      const deleteErrors: string[] = [];
      for (const tagId of removedTagIds) {
        try {
          const deleteResponse = await apiClient.delete('tags', tagId);
          if (deleteResponse.error) {
            const tag = allTags?.find((t) => t.id === tagId);
            deleteErrors.push(tag ? `${tag.name}: ${deleteResponse.error.message}` : `태그 삭제 실패: ${deleteResponse.error.message}`);
          }
        } catch (error) {
          const tag = allTags?.find((t) => t.id === tagId);
          deleteErrors.push(tag ? `${tag.name}: ${error instanceof Error ? error.message : '태그 삭제 실패'}` : `태그 삭제 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
      }

      // 태그 할당 업데이트
      await onUpdateTags(tempSelectedTagIds);
      setSelectedTagIds(tempSelectedTagIds);
      setIsEditMode(false);
      setShowForm(false);

      // 태그 목록 새로고침
      queryClient.invalidateQueries({ queryKey: ['tags', tenantId, 'student'] });
      refetchTags();

      if (deleteErrors.length > 0) {
        showAlert(
          `태그 저장 완료. 일부 태그 삭제 실패: ${deleteErrors.join(', ')}`,
          '부분 성공',
          'warning'
        );
      } else {
        showAlert('태그가 저장되었습니다.', '성공', 'success');
      }
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '태그 저장에 실패했습니다.', '오류', 'error');
    }
  };

  // hex 색상을 rgba로 변환하여 opacity 적용
  const hexToRgba = (hex: string, opacity: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // [타입 안정성] any 타입 제거, 명시적 타입 체크
  const handleCreateTag = async (data: Record<string, unknown>) => {
    if (typeof data.name !== 'string' || !data.name.trim()) {
      throw new Error('태그 이름은 필수입니다.');
    }
    await createTag.mutateAsync({
      name: data.name,
    });
  };

  // [코드 중복 제거] processTagInput 함수는 파일 상단에 공통으로 정의됨

  // 태그 등록 폼의 form 인스턴스 참조
  const tagFormRef = useRef<UseFormReturn<Record<string, unknown>> | null>(null);

  if (isLoading || allTagsLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div style={{ paddingBottom: isMobile ? 'var(--spacing-bottom-action-bar)' : 'var(--spacing-none)' }}>

      {showForm && (
        <>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <TagIcon size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                {isEditMode ? '태그수정' : '태그추가'}
              </span>
            }
          />
          {isEditMode ? (
            // 수정 모드: 태그 선택/해제 UI
            <>
              {isMobile || isTablet ? (
                <Drawer
                  isOpen={showForm}
                  onClose={() => {
                    setShowForm(false);
                    setIsEditMode(false);
                    setTempSelectedTagIds([]);
                  }}
                  title="태그수정"
                  position={isMobile ? 'bottom' : 'right'}
                  width={isTablet ? 'var(--width-drawer-tablet)' : 'var(--width-full)'}
                >
                  <div style={{ padding: 'var(--spacing-md)' }}>
                    <Card
                      padding="md"
                      variant="default"
                      title="태그 선택"
                      titleIcon={<TagIcon size={titleIconSize} strokeWidth={titleIconStrokeWidth} />}
                      titlePosition="top-left"
                    >
                      {allTags && allTags.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', paddingTop: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                          {allTags.map((tag) => {
                            const isSelected = tempSelectedTagIds.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                onClick={() => handleTagToggle(tag.id)}
                                style={{
                                  padding: 'var(--spacing-sm) var(--spacing-md)',
                                  fontSize: 'var(--font-size-base)',
                                  fontWeight: 'var(--font-weight-medium)',
                                  fontFamily: 'var(--font-family)',
                                  lineHeight: 'var(--line-height)',
                                  // 요구사항: 카드 라운드 한 단계 축소 (xl -> lg)
                                  // 요구사항: 태그배지 라운드 한 단계 증가 (lg -> xl)
                                  borderRadius: 'var(--border-radius-xl)',
                                  border: `var(--border-width-thin) solid ${isSelected ? tag.color : 'var(--color-gray-300)'}`,
                                  color: isSelected ? tag.color : 'var(--color-text-secondary)',
                                  backgroundColor: isSelected ? hexToRgba(tag.color, 0.1) : 'transparent',
                                  cursor: 'pointer',
                                  transition: 'var(--transition-all)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {tag.name}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p style={{ color: 'var(--color-text-secondary)' }}>등록된 태그가 없습니다.</p>
                      )}
                      {/* 요구사항: 태그수정 > 취소/저장 버튼은 학생관리 수정폼처럼 텍스트+아이콘 함께 출력 */}
                      <ActionButtonGroup
                        marginTop="xl"
                        gap="sm"
                        iconVariant="small"
                        items={[
                          {
                            key: 'tags-edit-cancel',
                            label: '취소',
                            icon: <XIcon />,
                            variant: 'outline',
                            onClick: () => {
                              setShowForm(false);
                              setIsEditMode(false);
                              setTempSelectedTagIds([]);
                            },
                          },
                          {
                            key: 'tags-edit-save',
                            label: '저장',
                            icon: <Save />,
                            variant: 'solid',
                            color: 'primary',
                            onClick: handleSaveTags,
                          },
                        ]}
                      />
                    </Card>
                  </div>
                </Drawer>
              ) : (
                <Card padding="md" variant="default" style={layerSectionCardStyle}>
                  {allTags && allTags.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', paddingTop: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                      {allTags.map((tag) => {
                        const isSelected = tempSelectedTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => handleTagToggle(tag.id)}
                            style={{
                              padding: 'var(--spacing-sm) var(--spacing-md)',
                              fontSize: 'var(--font-size-base)',
                              fontWeight: 'var(--font-weight-medium)',
                              fontFamily: 'var(--font-family)',
                              lineHeight: 'var(--line-height)',
                              // 요구사항: 카드 라운드 한 단계 축소 (xl -> lg)
                              // 요구사항: 태그배지 라운드 한 단계 증가 (lg -> xl)
                              borderRadius: 'var(--border-radius-xl)',
                              border: `var(--border-width-thin) solid ${isSelected ? tag.color : 'var(--color-gray-300)'}`,
                              color: isSelected ? tag.color : 'var(--color-text-secondary)',
                              backgroundColor: isSelected ? hexToRgba(tag.color, 0.1) : 'transparent',
                              cursor: 'pointer',
                              transition: 'var(--transition-all)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--color-text-secondary)' }}>등록된 태그가 없습니다.</p>
                  )}
                  {/* 요구사항: 태그수정 > 취소/저장 버튼은 학생관리 수정폼처럼 텍스트+아이콘 함께 출력 */}
                  <ActionButtonGroup
                    marginTop="xl"
                    gap="sm"
                    iconVariant="small"
                    items={[
                      {
                        key: 'tags-edit-cancel',
                        label: '취소',
                        icon: <XIcon />,
                        variant: 'outline',
                        onClick: () => {
                          setShowForm(false);
                          setIsEditMode(false);
                          setTempSelectedTagIds([]);
                        },
                      },
                      {
                        key: 'tags-edit-save',
                        label: '저장',
                        icon: <Save />,
                        variant: 'solid',
                        color: 'primary',
                        onClick: handleSaveTags,
                      },
                    ]}
                  />
                </Card>
              )}
            </>
          ) : (
            // 등록 모드: 태그 생성 폼
            <SchemaFormWithMethods
              schema={tagFormSchema}
              onSubmit={handleCreateTag}
              onCancel={() => {
                setShowForm(false);
                if (tagFormRef.current) {
                  tagFormRef.current.reset();
                }
              }}
              cardTitle={undefined}
              disableCardPadding={false}
              cancelLabel="취소"
              formRef={tagFormRef}
            />
          )}
        </>
      )}

      {!showForm && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <TagIcon size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                태그관리
              </span>
            }
            right={
              isEditable ? (
                <IconButtonGroup
                  items={[
                    {
                      icon: PlusIcon,
                      tooltip: '태그추가',
                      variant: 'solid',
                      color: 'primary',
                      onClick: () => setShowForm(true),
                    },
                  ]}
                  align="right"
                />
              ) : null
            }
          />
          <Card padding="md" variant="default" style={{ ...layerSectionCardStyle, border: 'var(--border-width-thin) solid var(--color-text)' }}>
        {selectedTagIds.length > 0 && allTags ? (
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', paddingTop: 'var(--spacing-sm)' }}>
              {allTags
                .filter((tag) => selectedTagIds.includes(tag.id))
                .map((tag) => (
                  <div
                    key={tag.id}
                    style={{
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      fontSize: 'var(--font-size-base)',
                      fontWeight: 'var(--font-weight-medium)',
                      fontFamily: 'var(--font-family)',
                      lineHeight: 'var(--line-height)',
                      // 요구사항: 카드 라운드 한 단계 축소 (xl -> lg)
                      // 요구사항: 태그배지 라운드 한 단계 증가 (lg -> xl)
                      borderRadius: 'var(--border-radius-xl)',
                      border: `var(--border-width-thin) solid ${tag.color}`,
                      color: tag.color,
                      backgroundColor: hexToRgba(tag.color, 0.1),
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tag.name}
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(var(--spacing-xl) * 5)', // [불변 규칙] CSS 변수 사용 (spacing-xl = 2rem, 5배 = 10rem ≈ 160px)
            padding: 'var(--spacing-xl)',
          }}>
            <TagIcon
              size={emptyStateIconSize}
              strokeWidth={emptyStateIconStrokeWidth}
              style={{
                color: 'var(--color-gray-300)',
                marginBottom: 'var(--spacing-xs)',
                display: 'inline-block',
              }}
            />
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>등록된 태그가 없습니다.</p>
          </div>
        )}

        {/* 요구사항: 페이지별 카드 헤더 우측 수정 버튼 제거 → 카드 하단 우측 수정 버튼 */}
        {isEditable && allTags && allTags.length > 0 && (
          <div style={{ width: '100%', paddingTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
            <IconButtonGroup
              align="right"
              items={[
                {
                  icon: Pencil,
                  tooltip: '수정',
                  variant: 'outline',
                  onClick: () => {
                    setIsEditMode(true);
                    setShowForm(true);
                  },
                },
              ]}
            />
          </div>
        )}

          </Card>
        </div>
      )}
    </div>
  );
}

// 반 배정 탭 컴포넌트
interface ClassesTabProps {
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
  onUpdate?: (studentClassId: string, enrolledAt: string) => Promise<void>; // enrolled_at만 업데이트하는 경우
  isEditable?: boolean;
}

function ClassesTab({
  studentClasses,
  isLoading,
  allClasses,
  effectiveClassAssignmentFormSchema,
  onAssign,
  onUnassign,
  onUpdate,
  isEditable = true,
}: ClassesTabProps) {
  const { showAlert, showConfirm } = useModal();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [classNameFilter, setClassNameFilter] = useState<string>('all');

  // 타이틀 아이콘 크기 및 선 두께 계산 (CSS 변수 사용)
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  const baseIconSize = useIconSize();
  const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  const emptyStateIconStrokeWidth = useIconStrokeWidth();

  const assignedClassIds = studentClasses
    .filter((sc) => sc.is_active)
    .map((sc) => sc.class_id);

  // 배정 가능한 반 목록 (아직 배정되지 않은 활성 반)
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
      setEditingClassId(null);
      setEditingEnrolledAt('');
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

  // 수정 모드 상태 관리 (반별)
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingStudentClassId, setEditingStudentClassId] = useState<string | null>(null);
  const [editingEnrolledAt, setEditingEnrolledAt] = useState<string>('');

  // 필터링된 반 목록 (handleEdit보다 먼저 정의)
  const filteredStudentClasses = useMemo(() => {
    if (classNameFilter === 'all') {
      return studentClasses;
    }
    return studentClasses.filter((sc) => sc.class && sc.class.id === classNameFilter);
  }, [studentClasses, classNameFilter]);

  const handleEdit = (studentClass: { id: string; class_id: string; enrolled_at: string; left_at?: string; is_active: boolean; class: Class | null }) => {
    setEditingClassId(studentClass.class_id);
    setEditingStudentClassId(studentClass.id);
    setEditingEnrolledAt(studentClass.enrolled_at);
    setShowAssignForm(true);
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!editingClassId || !editingStudentClassId || !data.class_id) return;

    const newClassId = String(data.class_id);
    const newEnrolledAt = String(data.enrolled_at || toKST().format('YYYY-MM-DD'));

    try {
      // 문서 요구사항: 반 배정 수정 시 같은 반이면 enrolled_at만 업데이트, 다른 반이면 반 이동
      if (editingClassId === newClassId) {
        // 같은 반: enrolled_at만 업데이트 (문서 요구사항 준수)
        if (onUpdate && editingStudentClassId) {
          await onUpdate(editingStudentClassId, newEnrolledAt);
        } else {
          // onUpdate가 없으면 직접 API 호출
          const { apiClient } = await import('@api-sdk/core');
          await apiClient.patch('student_classes', editingStudentClassId, {
            enrolled_at: newEnrolledAt,
          });
        }
        showAlert('배정일이 수정되었습니다.', '완료', 'success');
      } else {
        // 다른 반: 반 이동 (문서 요구사항: 반 이동 시 이전 반의 left_at 설정)
        // 기존 반 제외 (left_at 설정)
        await onUnassign(editingClassId, toKST().format('YYYY-MM-DD'));
        // 새 반 배정
        await onAssign(newClassId, newEnrolledAt);
        showAlert('반이 이동되었습니다.', '완료', 'success');
      }
      setShowAssignForm(false);
      setEditingClassId(null);
      setEditingStudentClassId(null);
      setEditingEnrolledAt('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '반 배정 수정에 실패했습니다.';
      showAlert(errorMessage, '오류', 'error');
    }
  };

  // 반 이름 옵션 생성 (중복 제거)
  const classOptions = useMemo(() => {
    const uniqueClasses = new Map<string, { id: string; name: string }>();
    studentClasses.forEach((sc) => {
      if (sc.class && !uniqueClasses.has(sc.class.id)) {
        uniqueClasses.set(sc.class.id, { id: sc.class.id, name: sc.class.name });
      }
    });
    return Array.from(uniqueClasses.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [studentClasses]);

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div>
      {showAssignForm && (
        <div>
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
                      // 수정 모드일 때는 현재 배정된 반도 포함 (현재 반을 유지하거나 다른 반으로 변경 가능)
                      ...(editingClassId
                        ? filteredStudentClasses
                            .filter((sc) => sc.class && sc.class_id === editingClassId)
                            .map((sc) => {
                              const classItem = sc.class!;
                              const dayLabel = DAYS_OF_WEEK.find((d) => d.value === classItem.day_of_week)?.label || classItem.day_of_week;
                              return {
                                label: `${classItem.name} (${dayLabel} ${classItem.start_time}~${classItem.end_time})`,
                                value: classItem.id,
                              };
                            })
                        : []),
                      // 배정 가능한 반만 포함 (이미 배정된 반 제외)
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
            onSubmit={editingClassId ? handleUpdate : handleAssign}
            defaultValues={{
              class_id: editingClassId || '',
              enrolled_at: editingEnrolledAt || toKST().format('YYYY-MM-DD'),
            }}
            disableCardPadding={false}
            cardTitle={undefined}
            onCancel={() => {
              setShowAssignForm(false);
              setEditingClassId(null);
              setEditingStudentClassId(null);
              setEditingEnrolledAt('');
            }}
          />
        </div>
      )}

      {!showAssignForm && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <BookOpen size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                반 배정
              </span>
            }
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <BadgeSelect
                  value={classNameFilter}
                  onChange={(value) => setClassNameFilter(value as string)}
                  options={[
                    { value: 'all', label: '전체' },
                    ...classOptions.map((classItem) => ({
                      value: classItem.id,
                      label: classItem.name,
                    })),
                  ]}
                  size="sm"
                  selectedColor="var(--color-text)"
                  unselectedColor="var(--color-text)"
                />
                {isEditable && (
                  <IconButtonGroup
                    items={[
                      {
                        icon: PlusIcon,
                        tooltip: '반 배정',
                        variant: 'solid',
                        color: 'primary',
                        onClick: () => {
                          setEditingClassId(null);
                          setEditingEnrolledAt('');
                          setShowAssignForm(true);
                        },
                        disabled: availableClasses.length === 0,
                      },
                    ]}
                    align="right"
                  />
                )}
              </div>
            }
          />
          <Card
            padding="md"
            variant="default"
            style={{
              ...layerSectionCardStyle,
              // 요구사항: 기본보기에서만 카드 테두리를 텍스트 기본 색상으로 출력
              border: 'var(--border-width-thin) solid var(--color-text)',
            }}
          >
        {filteredStudentClasses.filter((sc) => sc.class).length > 0 ? (
          // 각 반별로 그룹화하여 표시
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {filteredStudentClasses
              .filter((sc) => sc.class)
              .map((studentClass) => {
                const classItem = studentClass.class!;
                const dayLabel = DAYS_OF_WEEK.find((d) => d.value === classItem.day_of_week)?.label || classItem.day_of_week;

                // 각 반 정보를 필드 형태로 변환
                const fields = [
                  { label: '반명', value: classItem.name },
                  { label: '과목', value: classItem.subject || '-' },
                  { label: '대상', value: classItem.grade || '-' },
                  { label: '요일', value: dayLabel },
                  { label: '시간', value: `${classItem.start_time} ~ ${classItem.end_time}` },
                  { label: '강의실', value: classItem.room || '-' },
                  { label: '배정일', value: studentClass.enrolled_at },
                ];

                return (
                  <div key={studentClass.id}>
                    {/* 수정폼과 동일한 2열 그리드 레이아웃, 텍스트만 출력 */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                        gap: 'var(--spacing-md)',
                      }}
                    >
                      {fields.map((field, fieldIdx) => (
                        <div
                          key={fieldIdx}
                          style={{
                            display: 'flex',
                            width: '100%',
                            alignItems: 'center',
                            // 수정폼(Input/Select/DatePicker)의 md 패딩과 동일하게 맞춤
                            paddingTop: 'var(--spacing-sm)',
                            paddingBottom: 'var(--spacing-sm)',
                            paddingLeft: 'var(--spacing-form-horizontal-left)',
                            paddingRight: 'var(--spacing-form-horizontal-right)',
                            // 요구사항: 기본보기 밑줄은 원래 연한 색상으로 복구
                            borderBottom: 'var(--border-width-thin) solid var(--color-table-row-border)',
                          }}
                        >
                          {/* 항목명: 고정 너비 (수정폼 인라인 라벨과 동일) */}
                          <span
                            style={{
                              color: 'var(--color-form-inline-label)',
                              fontSize: 'var(--font-size-base)',
                              fontFamily: 'var(--font-family)',
                              fontWeight: 'var(--font-weight-normal)',
                              lineHeight: 'var(--line-height)',
                              minWidth: 'var(--width-form-inline-label)',
                              flexShrink: 0,
                              marginRight: 'var(--spacing-form-inline-label-gap)',
                            }}
                          >
                            {field.label}
                          </span>
                          {/* 결과값 */}
                          <span
                            style={{
                              color: 'var(--color-text)',
                              fontSize: 'var(--font-size-base)',
                              fontFamily: 'var(--font-family)',
                              fontWeight: 'var(--font-weight-normal)',
                              lineHeight: 'var(--line-height)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {field.value}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* 요구사항: 기본보기 > 삭제/수정 버튼 텍스트 제거, IconButtonGroup 스타일(아이콘만) + 우측 정렬 */}
                    {isEditable && (
                      <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
                        <IconButtonGroup
                          align="right"
                          items={[
                            {
                              icon: Trash2,
                              tooltip: '삭제',
                              variant: 'outline' as const,
                              color: 'error' as const,
                              onClick: () => { void handleUnassign(classItem.id); },
                            },
                            {
                              icon: Pencil,
                              tooltip: '수정',
                              variant: 'outline' as const,
                              onClick: () => handleEdit(studentClass),
                            },
                          ]}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(var(--spacing-xl) * 5)', // [불변 규칙] CSS 변수 사용 (spacing-xl = 2rem, 5배 = 10rem ≈ 160px)
            padding: 'var(--spacing-xl)',
          }}>
            <BookOpen
              size={emptyStateIconSize}
              strokeWidth={emptyStateIconStrokeWidth}
              style={{
                color: 'var(--color-gray-300)',
                marginBottom: 'var(--spacing-xs)',
                display: 'inline-block',
              }}
            />
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              {studentClasses.filter((sc) => sc.class).length === 0
                ? '배정된 반이 없습니다.'
                : '필터 조건에 맞는 반이 없습니다.'}
            </p>
          </div>
        )}
        </Card>
        </div>
      )}
    </div>
  );
}

// 출결 관리 탭 컴포넌트
function AttendanceTab({
  studentId,
  student,
  isEditable,
}: {
  studentId: string | null;
  student: Student | null | undefined;
  isEditable: boolean;
}) {
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'all' | 'present' | 'late' | 'absent' | 'excused'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();
  // [불변 규칙] 하드코딩 금지: CSS 변수에서 아이콘 크기 읽기
  const iconSize = useIconSize();
  const iconStrokeWidth = useIconStrokeWidth();

  // 출결 기록 생성/수정 Hook
  const createAttendanceLog = useCreateAttendanceLog();
  const updateAttendanceLog = useUpdateAttendanceLog();

  // 학생의 배정된 반 목록 조회
  const { data: studentClassesData } = useStudentClasses(studentId);
  const studentClasses = useMemo(() => studentClassesData ?? [], [studentClassesData]);

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  const baseIconSize = useIconSize();
  const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  const emptyStateIconStrokeWidth = useIconStrokeWidth();

  const thirtyDaysAgo = useMemo(() => {
    return toKST().subtract(30, 'day').format('YYYY-MM-DD');
  }, []);

  const { data: attendanceLogsData, isLoading } = useAttendanceLogs({
    student_id: studentId || undefined,
    date_from: thirtyDaysAgo,
  });
  const attendanceLogs = useMemo(() => attendanceLogsData ?? [], [attendanceLogsData]);

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

  // 필터링된 출결 내역
  const filteredAttendanceLogs = useMemo(() => {
    if (attendanceStatusFilter === 'all') {
      return attendanceLogs;
    }
    return attendanceLogs.filter((log) => log.status === attendanceStatusFilter);
  }, [attendanceLogs, attendanceStatusFilter]);

  if (!studentId || !student) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          학생 정보를 불러올 수 없습니다.
        </div>
      </Card>
    );
  }

  // 출결 기록 추가 폼 스키마 생성
  const attendanceFormSchema = useMemo<FormSchema>(() => ({
    version: '1.0.0',
    minSupportedClient: '1.0.0',
    entity: 'attendance',
    type: 'form',
    form: {
      layout: {
        columns: 2,
        columnGap: 'md',
        rowGap: 'md',
      },
      fields: [
        {
          name: 'class_id',
          kind: 'select',
          ui: {
            label: '반 (선택)',
            colSpan: 1,
          },
          options: [
            { label: '선택 안함', value: '' },
            ...studentClasses
              .filter((sc) => sc.class && sc.is_active)
              .map((sc) => ({
                label: sc.class!.name,
                value: sc.class!.id,
              })),
          ],
        },
        {
          name: 'occurred_at',
          kind: 'datetime',
          ui: {
            label: '출결 시간',
            colSpan: 1,
          },
          defaultValue: toKST().format('YYYY-MM-DDTHH:mm'),
          validation: {
            required: true,
          },
        },
        {
          name: 'attendance_type',
          kind: 'select',
          ui: {
            label: '출결 유형',
            colSpan: 1,
          },
          options: [
            { label: '등원', value: 'check_in' },
            { label: '하원', value: 'check_out' },
            { label: '지각', value: 'late' },
            { label: '결석', value: 'absent' },
          ],
          defaultValue: 'check_in',
          validation: {
            required: true,
          },
        },
        {
          name: 'status',
          kind: 'select',
          ui: {
            label: '상태',
            colSpan: 1,
          },
          options: [
            { label: '출석', value: 'present' },
            { label: '지각', value: 'late' },
            { label: '결석', value: 'absent' },
            { label: '사유', value: 'excused' },
          ],
          defaultValue: 'present',
          validation: {
            required: true,
          },
        },
        {
          name: 'notes',
          kind: 'textarea',
          ui: {
            label: '메모',
            colSpan: 2,
          },
        },
      ],
      submit: {
        label: '저장',
        variant: 'solid',
        color: 'primary',
        size: 'md',
      },
    },
  }), [studentClasses]);

  // 수정 중인 출결 기록 찾기
  const editingLog = useMemo(() => {
    if (!editingLogId) return null;
    return attendanceLogs.find((log) => log.id === editingLogId);
  }, [editingLogId, attendanceLogs]);

  // 출결 기록 추가 핸들러
  const handleAddAttendance = async (data: Record<string, unknown>) => {
    if (!studentId) return;

    try {
      const input: CreateAttendanceLogInput = {
        student_id: studentId,
        class_id: data.class_id ? String(data.class_id) : undefined,
        occurred_at: String(data.occurred_at),
        attendance_type: data.attendance_type as CreateAttendanceLogInput['attendance_type'],
        status: data.status as CreateAttendanceLogInput['status'],
        notes: data.notes ? String(data.notes) : undefined,
      };
      await createAttendanceLog.mutateAsync(input);

      showAlert('출결 기록이 추가되었습니다.', '성공', 'success');
      setShowAddForm(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '출결 기록 추가에 실패했습니다.';
      showAlert(errorMessage, '오류', 'error');
    }
  };

  // 출결 기록 수정 핸들러
  const handleUpdateAttendance = async (data: Record<string, unknown>) => {
    if (!editingLogId) return;

    try {
      const input: Partial<CreateAttendanceLogInput> = {
          class_id: data.class_id ? String(data.class_id) : undefined,
          occurred_at: String(data.occurred_at),
        attendance_type: data.attendance_type as CreateAttendanceLogInput['attendance_type'],
        status: data.status as CreateAttendanceLogInput['status'],
          notes: data.notes ? String(data.notes) : undefined,
      };
      await updateAttendanceLog.mutateAsync({
        logId: editingLogId,
        input,
      });

      showAlert('출결 기록이 수정되었습니다.', '성공', 'success');
      setEditingLogId(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '출결 기록 수정에 실패했습니다.';
      showAlert(errorMessage, '오류', 'error');
    }
  };

  // 출결 기록 수정 모드 상태
  const [showEditList, setShowEditList] = useState(false);

  // 출결 기록 수정 시작 (출결 기록 목록 표시)
  const handleStartEdit = () => {
    if (filteredAttendanceLogs.length === 0) {
      showAlert('수정할 출결 기록이 없습니다.', '알림', 'info');
      return;
    }
    setShowEditList(true);
  };

  // 출결 기록 선택하여 수정 시작
  const handleSelectLogForEdit = (logId: string) => {
    setEditingLogId(logId);
    setShowEditList(false);
  };

  return (
    <div>
      {showAddForm && !editingLogId && !showEditList && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Calendar size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                출결 기록 추가
              </span>
            }
          />
          <SchemaForm
            schema={attendanceFormSchema}
            onSubmit={handleAddAttendance}
            disableCardPadding={false}
            cardTitle={undefined}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {showEditList && !editingLogId && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Calendar size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                출결 기록 수정
              </span>
            }
            right={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEditList(false)}
              >
                취소
              </Button>
            }
          />
          <Card padding="md" variant="default" style={layerSectionCardStyle}>
            {filteredAttendanceLogs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {filteredAttendanceLogs.map((log, index) => {
                  const statusColor = log.status === 'present' ? 'success' : log.status === 'late' ? 'warning' : 'error';
                  const statusLabel = log.status === 'present' ? '출석' : log.status === 'late' ? '지각' : log.status === 'absent' ? '결석' : '사유';
                  const typeLabel = log.attendance_type === 'check_in' ? '등원' : log.attendance_type === 'check_out' ? '하원' : log.attendance_type;

                  return (
                    <div
                      key={log.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 'var(--spacing-sm)',
                        paddingBottom: 'var(--spacing-sm)',
                        paddingLeft: 'var(--spacing-md)',
                        paddingRight: 'var(--spacing-md)',
                        borderBottom: index < filteredAttendanceLogs.length - 1
                          ? 'var(--border-width-thin) solid var(--color-table-row-border)'
                          : 'none',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleSelectLogForEdit(log.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flex: 1 }}>
                        <Badge variant="soft" color={statusColor}>
                          {statusLabel}
                        </Badge>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                          {typeLabel}
                        </span>
                        <span style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-base)', marginLeft: 'auto' }}>
                          {toKST(log.occurred_at).format('YYYY-MM-DD HH:mm')}
                        </span>
                        <Pencil size={iconSize} strokeWidth={iconStrokeWidth} style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-sm)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'calc(var(--spacing-xl) * 5)',
                padding: 'var(--spacing-xl)',
              }}>
                <Calendar
                  size={emptyStateIconSize}
                  strokeWidth={emptyStateIconStrokeWidth}
                  style={{
                    color: 'var(--color-gray-300)',
                    marginBottom: 'var(--spacing-xs)',
                    display: 'inline-block',
                  }}
                />
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  수정할 출결 기록이 없습니다.
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {editingLogId && editingLog && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Calendar size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                출결 기록 수정
              </span>
            }
          />
          <SchemaForm
            schema={attendanceFormSchema}
            onSubmit={handleUpdateAttendance}
            defaultValues={{
              class_id: editingLog.class_id || '',
              occurred_at: toKST(editingLog.occurred_at).format('YYYY-MM-DDTHH:mm'),
              attendance_type: editingLog.attendance_type,
              status: editingLog.status,
              notes: editingLog.notes || '',
            }}
            disableCardPadding={false}
            cardTitle={undefined}
            onCancel={() => {
              setEditingLogId(null);
              setShowEditList(false);
            }}
          />
        </div>
      )}

      {!showAddForm && !editingLogId && !showEditList && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {/* 출결 통계 */}
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Calendar size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                출결통계
              </span>
            }
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <BadgeSelect
                  value={attendanceStatusFilter}
                  onChange={(value) => setAttendanceStatusFilter(value as typeof attendanceStatusFilter)}
                  options={[
                    { value: 'all', label: '전체' },
                    { value: 'present', label: '출석' },
                    { value: 'late', label: '지각' },
                    { value: 'absent', label: '결석' },
                    { value: 'excused', label: '사유' },
                  ]}
                  size="sm"
                  selectedColor="var(--color-text)"
                  unselectedColor="var(--color-text)"
                />
                {isEditable && (
                  <IconButtonGroup
                    items={[
                      {
                        icon: PlusIcon,
                        tooltip: '출결기록 추가',
                        variant: 'solid',
                        color: 'primary',
                        onClick: () => {
                          setShowAddForm(true);
                        },
                      },
                    ]}
                    align="right"
                  />
                )}
              </div>
            }
          />
          <Card padding="md" variant="default" style={{ ...layerSectionCardStyle, border: 'var(--border-width-thin) solid var(--color-text)' }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                출결 정보를 불러오는 중...
              </div>
            ) : stats ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)' }}>
                {/* 출석률 - 주요 지표로 상단에 강조 표시 */}
                <div style={{
                  padding: 'var(--spacing-lg)',
                  borderRadius: 'var(--border-radius-md)',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-white)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', opacity: 'var(--opacity-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                    출석률
                  </div>
                  <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)' }}>
                    {stats.attendanceRate}%
                  </div>
                </div>

                {/* 상세 통계 - 2열 그리드 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 'var(--spacing-md)'
                }}>
                  <div style={{
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--border-radius-sm)',
                    backgroundColor: 'var(--color-gray-50)',
                    textAlign: 'center',
                  }}>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                      총 출결
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
                      {stats.total}
                    </div>
                  </div>
                  <div style={{
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--border-radius-sm)',
                    backgroundColor: 'var(--color-success-50)',
                    textAlign: 'center',
                  }}>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                      출석
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
                      {stats.present}
                    </div>
                  </div>
                  <div style={{
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--border-radius-sm)',
                    backgroundColor: 'var(--color-warning-50)',
                    textAlign: 'center',
                  }}>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                      지각
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning)' }}>
                      {stats.late}
                    </div>
                  </div>
                  <div style={{
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--border-radius-sm)',
                    backgroundColor: 'var(--color-error-50)',
                    textAlign: 'center',
                  }}>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                      결석
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-error)' }}>
                      {stats.absent}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'calc(var(--spacing-xl) * 5)',
                padding: 'var(--spacing-xl)',
              }}>
                <Calendar
                  size={emptyStateIconSize}
                  strokeWidth={emptyStateIconStrokeWidth}
                  style={{
                    color: 'var(--color-gray-300)',
                    marginBottom: 'var(--spacing-xs)',
                    display: 'inline-block',
                  }}
                />
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  출결 데이터가 없습니다.
                </p>
              </div>
            )}

            {isEditable && filteredAttendanceLogs.length > 0 && (
              <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
                <IconButtonGroup
                  align="right"
                  items={[
                    {
                      icon: Pencil,
                      tooltip: '수정',
                      variant: 'outline',
                      onClick: handleStartEdit,
                    },
                  ]}
                />
              </div>
            )}
          </Card>
        </div>

        {/* 최근 출결 내역 */}
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Calendar size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                최근 출결내역
              </span>
            }
          />
          <Card padding="md" variant="default" style={layerSectionCardStyle}>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                출결 정보를 불러오는 중...
              </div>
            ) : filteredAttendanceLogs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 'var(--spacing-sm)' }}>
                {filteredAttendanceLogs.slice(0, 10).map((log, index) => {
                  const statusColor = log.status === 'present' ? 'success' : log.status === 'late' ? 'warning' : 'error';
                  const statusLabel = log.status === 'present' ? '출석' : log.status === 'late' ? '지각' : log.status === 'absent' ? '결석' : '사유';
                  const typeLabel = log.attendance_type === 'check_in' ? '등원' : log.attendance_type === 'check_out' ? '하원' : log.attendance_type;

                  return (
                    <div
                      key={log.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 'var(--spacing-sm)',
                        paddingBottom: 'var(--spacing-sm)',
                        paddingLeft: 'var(--spacing-md)',
                        paddingRight: 'var(--spacing-md)',
                        borderBottom: index < filteredAttendanceLogs.slice(0, 10).length - 1
                          ? 'var(--border-width-thin) solid var(--color-table-row-border)'
                          : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flex: 1 }}>
                        <Badge variant="soft" color={statusColor}>
                          {statusLabel}
                        </Badge>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                          {typeLabel}
                        </span>
                        <span style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-base)', marginLeft: 'auto' }}>
                          {toKST(log.occurred_at).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'calc(var(--spacing-xl) * 5)',
                padding: 'var(--spacing-xl)',
              }}>
                <Calendar
                  size={emptyStateIconSize}
                  strokeWidth={emptyStateIconStrokeWidth}
                  style={{
                    color: 'var(--color-gray-300)',
                    marginBottom: 'var(--spacing-xs)',
                    display: 'inline-block',
                  }}
                />
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  {attendanceLogs.length === 0
                    ? '최근 출결 내역이 없습니다.'
                    : '필터 조건에 맞는 출결 내역이 없습니다.'}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}

// 이탈위험 분석 탭 컴포넌트
function RiskAnalysisTab({
  studentId,
  isEditable,
}: {
  studentId: string | null;
  isEditable: boolean;
}) {
  const { showAlert } = useModal();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  // 훅은 항상 컴포넌트 최상단에서 호출되어야 함 (React Hooks 규칙)
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();
  // [불변 규칙] 하드코딩 금지: CSS 변수에서 아이콘 크기 읽기 (--size-icon-md = 14px)
  const buttonIconSize = useIconSize('--size-icon-md');

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  const baseIconSize = useIconSize();
  const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  const emptyStateIconStrokeWidth = useIconStrokeWidth();

  const thirtyDaysAgo = useMemo(() => {
    return toKST().subtract(30, 'day').format('YYYY-MM-DD');
  }, []);

  const { data: attendanceLogsData } = useAttendanceLogs({
    student_id: studentId || undefined,
    date_from: thirtyDaysAgo,
  });
  const attendanceLogs = useMemo(() => attendanceLogsData ?? [], [attendanceLogsData]);

  const { data: consultations } = useConsultations(studentId);

  // 이탈위험 분석 결과를 DB에서 불러오기
  const { data: savedRiskAnalysis, isLoading: isLoadingSaved } = useQuery({
    queryKey: ['student-risk-analysis-saved', tenantId, studentId],
    queryFn: async () => {
      if (!tenantId || !studentId) return null;

      const response = await apiClient.get<Array<{
        id: string;
        details: {
          risk_score: number;
          risk_level: 'low' | 'medium' | 'high';
          reasons: string[];
          recommended_actions: string[];
        };
        created_at: string;
        updated_at: string;
      }>>('ai_insights', {
        filters: {
          tenant_id: tenantId,
          student_id: studentId,
          insight_type: 'risk_analysis',
          status: 'active',
        },
        orderBy: { column: 'created_at', ascending: false },
        limit: 1,
      });

      if (response.error || !response.data || response.data.length === 0) {
        return null;
      }

      const insight = (response.data[0] as unknown) as {
        id: string;
        details: {
          risk_score: number;
          risk_level: 'low' | 'medium' | 'high';
          reasons: string[];
          recommended_actions: string[];
        };
        created_at: string;
        updated_at: string;
      } | undefined;

      if (!insight || !insight.details || typeof insight.details !== 'object') {
        return null;
      }

      const details = insight.details;

      return {
        risk_score: details.risk_score,
        risk_level: details.risk_level,
        reasons: details.reasons,
        recommended_actions: details.recommended_actions,
        analyzed_at: insight.updated_at || insight.created_at,
      };
    },
    enabled: !!tenantId && !!studentId,
    staleTime: 5 * 60 * 1000, // 5분간 캐싱
    refetchOnWindowFocus: false,
  });

  // 이탈위험 분석: 수동으로만 실행 (버튼 클릭 시)
  // [변경] 페이지 접속 시 자동 분석 제거, 재분석 버튼 클릭 시에만 실행
  // [불변 규칙] Zero-Trust: @api-sdk/core를 통해서만 API 요청 (UI 문서 1.1, 기술문서 2.2 참조)
  const { data: newRiskAnalysis, isLoading: isAnalyzing, refetch: refetchRiskAnalysis } = useQuery({
    queryKey: ['student-risk-analysis', tenantId, studentId],
    queryFn: async () => {
      if (!tenantId || !studentId) return null;

      // [불변 규칙] Zero-Trust: @api-sdk/core를 통해서만 Edge Function 호출
      // apiClient.post()는 자동으로 tenant_id, industry_type, JWT 토큰을 포함하여 요청
      const response = await apiClient.post<{ risk_score?: number; factors?: string[]; recommendations?: string[] }>(
        'functions/v1/student-risk-analysis',
        {
          student_id: studentId,
        } as Record<string, unknown>
      );

      if (response.error) {
        throw new Error(response.error.message || '이탈위험 분석에 실패했습니다.');
      }

      return response.data;
    },
    enabled: false, // [변경] 자동 실행 비활성화, 수동으로만 실행
    staleTime: Infinity, // 캐시된 데이터 유지
    refetchOnWindowFocus: false,
  });

  // 새로 분석한 결과가 있으면 그것을 사용, 없으면 저장된 결과 사용
  // [타입 안정성] 두 타입을 통합하여 처리
  const riskAnalysis = (newRiskAnalysis || savedRiskAnalysis) as {
    risk_score: number;
    risk_level?: 'low' | 'medium' | 'high';
    reasons?: string[];
    recommended_actions?: string[];
    analyzed_at?: string;
    factors?: string[];
    recommendations?: string[];
  } | null | undefined;
  const isLoading = isAnalyzing || isLoadingSaved;

  if (isLoading) {
    return (
      <div>
        <LayerSectionHeader
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <AlertTriangle size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
              이탈위험 분석
            </span>
          }
        />
        <Card padding="md" variant="default" style={{ ...layerSectionCardStyle, border: 'var(--border-width-thin) solid var(--color-text)' }}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            분석 중...
          </div>
        </Card>
      </div>
    );
  }

  // 분석 데이터가 없고 로딩 중이 아닌 경우 - 재분석 버튼 표시
  if (!riskAnalysis && !isLoading) {
    return (
      <div>
        <LayerSectionHeader
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <AlertTriangle size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
              이탈위험 분석
            </span>
          }
        />
        <Card padding="md" variant="default" style={{ ...layerSectionCardStyle, border: 'var(--border-width-thin) solid var(--color-text)' }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(var(--spacing-xl) * 5)', // [불변 규칙] CSS 변수 사용
            padding: 'var(--spacing-xl)',
            gap: 'var(--spacing-md)',
          }}>
            <AlertTriangle
              size={emptyStateIconSize}
              strokeWidth={emptyStateIconStrokeWidth}
              style={{
                color: 'var(--color-gray-300)',
                marginBottom: 'var(--spacing-xs)',
                display: 'inline-block',
              }}
            />
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              분석 데이터가 없습니다.
              <br />
              아래 버튼을 클릭하여 이탈위험 분석을 시작하세요.
            </p>
            {isEditable && (
              <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outline"
                  size="sm"
                onClick={async () => {
                  try {
                    await refetchRiskAnalysis();
                    showAlert('이탈위험 분석이 완료되었습니다.', '알림', 'success');
                  } catch (error) {
                    showAlert(
                      error instanceof Error ? error.message : '이탈위험 분석에 실패했습니다.',
                      '오류',
                      'error'
                    );
                  }
                }}
                disabled={isLoading}
              >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                    {/* [불변 규칙] 하드코딩 금지: CSS 변수 사용 (--size-icon-md = 14px) */}
                    <RefreshCcw size={buttonIconSize} strokeWidth={titleIconStrokeWidth} />
                    <span>{isLoading ? '분석 중...' : '분석시작'}</span>
                  </span>
              </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // 아키텍처 문서 3.7.3 risk_score 레이블 표 준수:
  // 90 이상: Emergency (error), 70-89: 고위험 (error), 40-69: 중위험 (warning), 0-39: 저위험 (success)
  // [타입 안정성] riskAnalysis가 없으면 null 반환
  if (!riskAnalysis || riskAnalysis.risk_score === undefined) {
    return null;
  }

  const getRiskLevelLabel = (riskScore: number): 'Emergency' | '고위험' | '중위험' | '저위험' => {
    if (riskScore >= 90) return 'Emergency';
    if (riskScore >= 70) return '고위험';
    if (riskScore >= 40) return '중위험';
    return '저위험';
  };

  // [타입 안정성] riskAnalysis가 존재하고 risk_score가 정의되어 있음을 확인
  const riskScore = riskAnalysis.risk_score;
  const reasons = riskAnalysis.reasons || riskAnalysis.factors || [];
  const recommendedActions = riskAnalysis.recommended_actions || riskAnalysis.recommendations || [];

  const riskLevelLabel = getRiskLevelLabel(riskScore);
  const riskColor = riskScore >= 70 ? 'error' : riskScore >= 40 ? 'warning' : 'success';
  const riskBgColor = riskScore >= 70 ? 'var(--color-error)' : riskScore >= 40 ? 'var(--color-warning)' : 'var(--color-success)';
  const riskBgColorLight = riskScore >= 70 ? 'var(--color-error-50)' : riskScore >= 40 ? 'var(--color-warning-50)' : 'var(--color-success-50)';
  const riskBorderColor = riskScore >= 70 ? 'var(--color-error)' : riskScore >= 40 ? 'var(--color-warning)' : 'var(--color-success)';

  return (
    <div>
      <LayerSectionHeader
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <AlertTriangle size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
            이탈위험 분석
          </span>
        }
      />
      <Card padding="md" variant="default" style={{ ...layerSectionCardStyle, border: 'var(--border-width-thin) solid var(--color-text)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)' }}>
          {/* 위험점수 - 주요 지표로 상단에 강조 표시 */}
          <div style={{
            padding: 'var(--spacing-lg)',
            borderRadius: 'var(--border-radius-md)',
            backgroundColor: riskBgColor,
            color: 'var(--color-white)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 'var(--font-size-sm)', opacity: 'var(--opacity-secondary)', marginBottom: 'var(--spacing-xs)' }}>
              위험점수
            </div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-xs)' }}>
              {riskScore}점
            </div>
            <Badge variant="solid" color={riskColor} style={{ backgroundColor: 'var(--color-white)', fontWeight: 'var(--font-weight-bold)', opacity: 'var(--opacity-secondary)', color: riskBgColor }}>
              {riskLevelLabel}
            </Badge>
            {/* 마지막 분석 일시 표시 */}
            {riskAnalysis?.analyzed_at && (
              <div style={{ fontSize: 'var(--font-size-xs)', opacity: 'var(--opacity-secondary)', marginTop: 'var(--spacing-sm)' }}>
                마지막 분석: {toKST(riskAnalysis.analyzed_at).format('YYYY-MM-DD HH:mm:ss')}
              </div>
            )}
          </div>

          {/* 위험요인 - 카드 형태로 개선 */}
          {reasons.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)' }}>
                <AlertCircle size={titleIconSize} strokeWidth={titleIconStrokeWidth} style={{ color: 'var(--color-error)' }} />
                <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', margin: 0 }}>
                  위험요인
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {reasons.map((reason: string, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      padding: 'var(--spacing-md)',
                      borderRadius: 'var(--border-radius-sm)',
                      border: 'var(--border-width-thin) solid var(--color-error)',
                      backgroundColor: 'var(--color-error-50)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--spacing-sm)',
                    }}
                  >
                    <AlertCircle size={titleIconSize} strokeWidth={titleIconStrokeWidth} style={{ color: 'var(--color-error)', flexShrink: 0 }} />
                    <div style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-base)', lineHeight: 'var(--line-height)' }}>
                      {reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 권장조치 - 카드 형태로 개선 */}
          {recommendedActions.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)' }}>
                <Lightbulb size={titleIconSize} strokeWidth={titleIconStrokeWidth} style={{ color: 'var(--color-primary)' }} />
                <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', margin: 0 }}>
                  권장조치
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {recommendedActions.map((action: string, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      padding: 'var(--spacing-md)',
                      borderRadius: 'var(--border-radius-sm)',
                      border: 'var(--border-width-thin) solid var(--color-primary)',
                      backgroundColor: 'var(--color-primary-50)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--spacing-sm)',
                    }}
                  >
                    <CheckCircle2 size={titleIconSize} strokeWidth={titleIconStrokeWidth} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                    <div style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-base)', lineHeight: 'var(--line-height)' }}>
                      {action}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 재분석 버튼 - IconButtonGroup으로 변경 */}
          {riskAnalysis && isEditable && (
            <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
              <IconButtonGroup
                align="right"
                items={[
                  {
                    icon: RefreshCcw,
                    tooltip: '재분석',
                    variant: 'outline',
                    onClick: async () => {
                      try {
                        await refetchRiskAnalysis();
                        // 새로 분석한 결과로 인해 쿼리가 무효화되므로 저장된 결과도 다시 불러옴
                        queryClient.invalidateQueries({ queryKey: ['student-risk-analysis-saved', tenantId, studentId] });
                        showAlert('이탈위험 분석이 완료되었습니다.', '알림', 'success');
                      } catch (error) {
                        showAlert(
                          error instanceof Error ? error.message : '이탈위험 분석에 실패했습니다.',
                          '오류',
                          'error'
                        );
                      }
                    },
                  },
                ]}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// 메시지 발송 탭 컴포넌트
// [불변 규칙] 기존 notificationFormSchema와 SchemaForm 재사용 (중복 개발 방지)
// [불변 규칙] 하드코딩 금지, CSS 변수 사용 필수
function MessageSendTab({
  studentId,
  student,
  isEditable,
}: {
  studentId: string | null;
  student: Student | null | undefined;
  isEditable: boolean;
}) {
  const { showAlert } = useModal();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  // [불변 규칙] 기존 스키마 재사용
  const { data: schema } = useSchema('notification', notificationFormSchema, 'form');

  // [불변 규칙] 하드코딩된 문자열 상수화
  const MESSAGE_CONSTANTS = {
    TAB_TITLE: '메시지 발송',
    STUDENT_DEFAULT: '학생',
    PHONE_NOT_AVAILABLE: '전화번호 없음',
    LOADING_GUARDIANS: '보호자 정보를 불러오는 중...',
    TARGET_STUDENT_LABEL: '학생',
    NO_GUARDIANS_MESSAGE: '보호자 정보가 없습니다. 보호자를 먼저 등록해주세요.',
    NO_STUDENT_PHONE_MESSAGE: '학생 전화번호가 없습니다.',
    NO_RECIPIENTS_SELECTED: '발송 대상을 선택해주세요.',
    SEND_SUCCESS_TITLE: '성공',
    SEND_SUCCESS_MESSAGE: '메시지가 발송되었습니다.',
    ERROR_TITLE: '오류',
    ERROR_STUDENT_NOT_FOUND: '학생 정보가 없습니다.',
    ERROR_GUARDIAN_NOT_FOUND: '보호자 정보를 찾을 수 없습니다.',
    ERROR_PHONE_NOT_FOUND: '보호자 전화번호를 찾을 수 없습니다.',
    ERROR_CONTENT_REQUIRED: '메시지 내용을 입력해주세요.',
    ERROR_SEND_PARTIAL_FAILED: '일부 메시지 발송에 실패했습니다:',
    ERROR_UNKNOWN: '알 수 없는 오류',
    PARTIAL_SUCCESS_MESSAGE: '명에게 발송 성공,',
    PARTIAL_FAILURE_MESSAGE: '명에게 발송 실패:',
    ALERT_TITLE: '알림',
    COUNT_SUFFIX: '명',
    COUNT_ZERO: '0명',
  } as const;

  const formRef = useRef<UseFormReturn<Record<string, unknown>> | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<NotificationChannel>('sms');
  // 수신자 선택 상태 (학생, 보호자 각각 선택 가능)
  const [selectedStudent, setSelectedStudent] = useState(false); // 기본값: 선택 안 함
  const [selectedGuardians, setSelectedGuardians] = useState<Set<string>>(new Set()); // 선택된 보호자 ID 집합
  // 기본 선택 초기화 여부 (한 번만 실행)
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  // defaultValues 메모이제이션 (selectedChannel 변경 시 자동 업데이트)
  const formDefaultValues = useMemo(() => ({
    channel: selectedChannel,
  }), [selectedChannel]);

  // 채널 변경 시 content 필드 초기화
  useEffect(() => {
    if (formRef.current) {
      formRef.current.setValue('channel', selectedChannel);
    }
  }, [selectedChannel]);

  // 보호자 목록 조회
  const { data: guardians, isLoading: guardiansLoading } = useQuery({
    queryKey: ['guardians', tenantId, studentId],
    queryFn: async (): Promise<Guardian[]> => {
      if (!tenantId || !studentId) return [];

      const response = await apiClient.get<Guardian[]>('guardians', {
        filters: { student_id: studentId },
      });

      if (response.error || !response.data) {
        return [];
      }

      // apiClient.get은 배열을 반환
      return (Array.isArray(response.data) ? response.data : [response.data]) as unknown as Guardian[];
    },
    enabled: !!tenantId && !!studentId,
  });

  // 보호자 관계별 그룹화 및 관계명 매핑
  const getRelationshipLabel = (relationship: string): string => {
    switch (relationship) {
      case 'parent':
        return '부';
      case 'guardian':
        return '모';
      case 'other':
        return '기타';
      default:
        return '기타';
    }
  };

  // 보호자를 관계별로 그룹화 (부, 모, 기타)
  const guardiansByRelationship = useMemo(() => {
    if (!guardians) return { parent: [], guardian: [], other: [] };

    const parent: Guardian[] = [];
    const guardian: Guardian[] = [];
    const other: Guardian[] = [];

    guardians.forEach((g) => {
      if (g.relationship === 'parent') {
        parent.push(g);
      } else if (g.relationship === 'guardian') {
        guardian.push(g);
      } else {
        other.push(g);
      }
    });

    return { parent, guardian, other };
  }, [guardians]);

  // 전화번호가 있는 보호자만 필터링
  const guardiansWithPhone = useMemo(() => {
    if (!guardians) return [];
    return guardians.filter((g) => {
      const phone = typeof g.phone === 'string' ? g.phone : String(g.phone || '');
      return phone.trim().length > 0;
    });
  }, [guardians]);

  // 기본 선택 초기화: 모 -> 부 -> 기타 -> 학생 순서로 자동 체크
  useEffect(() => {
    if (hasInitializedSelection || guardiansLoading) return;

    const newSelectedGuardians = new Set<string>();
    let found = false;

    // 1순위: 모 (guardian)
    if (guardiansByRelationship.guardian.length > 0) {
      const guardianWithPhone = guardiansByRelationship.guardian.find((g) => {
        const phone = typeof g.phone === 'string' ? g.phone : String(g.phone || '');
        return phone.trim().length > 0;
      });
      if (guardianWithPhone) {
        newSelectedGuardians.add(guardianWithPhone.id);
        found = true;
      }
    }

    // 2순위: 부 (parent)
    if (!found && guardiansByRelationship.parent.length > 0) {
      const parentWithPhone = guardiansByRelationship.parent.find((g) => {
        const phone = typeof g.phone === 'string' ? g.phone : String(g.phone || '');
        return phone.trim().length > 0;
      });
      if (parentWithPhone) {
        newSelectedGuardians.add(parentWithPhone.id);
        found = true;
      }
    }

    // 3순위: 기타 (other)
    if (!found && guardiansByRelationship.other.length > 0) {
      const otherWithPhone = guardiansByRelationship.other.find((g) => {
        const phone = typeof g.phone === 'string' ? g.phone : String(g.phone || '');
        return phone.trim().length > 0;
      });
      if (otherWithPhone) {
        newSelectedGuardians.add(otherWithPhone.id);
        found = true;
      }
    }

    // 4순위: 학생
    if (!found && student?.phone) {
      const phone = typeof student.phone === 'string' ? student.phone : String(student.phone || '');
      if (phone.trim().length > 0) {
        setSelectedStudent(true);
        found = true;
      }
    }

    if (found) {
      setSelectedGuardians(newSelectedGuardians);
      setHasInitializedSelection(true);
    }
  }, [guardiansByRelationship, guardiansLoading, hasInitializedSelection, student]);

  // 보호자 전체 선택/해제 (전화번호가 있는 보호자만)
  const handleSelectAllGuardians = (checked: boolean) => {
    if (checked && guardiansWithPhone.length > 0) {
      const allGuardianIds = new Set(guardiansWithPhone.map((g) => g.id));
      setSelectedGuardians(allGuardianIds);
    } else {
      setSelectedGuardians(new Set());
    }
  };

  const allGuardiansSelected = guardiansWithPhone.length > 0 && selectedGuardians.size === guardiansWithPhone.length;

  // 선택된 발송 대상 목록 (채널 셀렉터 아래 표시용)
  const selectedRecipients = useMemo(() => {
    const recipients: Array<{ label: string; phone: string }> = [];

    // 학생 선택 시
    if (selectedStudent && student?.phone) {
      const phone = typeof student.phone === 'string' ? student.phone : String(student.phone);
      if (phone.trim().length > 0) {
        recipients.push({ label: MESSAGE_CONSTANTS.TARGET_STUDENT_LABEL, phone: phone.trim() });
      }
    }

    // 선택된 보호자
    if (guardians && selectedGuardians.size > 0) {
      guardians.forEach((guardian) => {
        if (selectedGuardians.has(guardian.id)) {
          const phone = typeof guardian.phone === 'string' ? guardian.phone : String(guardian.phone || '');
          if (phone.trim().length > 0) {
            recipients.push({
              label: getRelationshipLabel(guardian.relationship),
              phone: phone.trim()
            });
          }
        }
      });
    }

    return recipients;
  }, [selectedStudent, selectedGuardians, student, guardians]);

  // 메시지 발송 (기존 notificationFormSchema 재사용)
  // [불변 규칙] api-sdk를 통해서만 API 요청
  // [불변 규칙] 기존 SchemaForm의 onSubmit을 확장하여 선택된 수신자에게 발송
  const handleSendMessage = async (data: Record<string, unknown>) => {
    try {
      if (!tenantId || !studentId || !student) {
        throw new Error(MESSAGE_CONSTANTS.ERROR_STUDENT_NOT_FOUND);
      }

      const content = String(data.content || '').trim();
      if (!content) {
        throw new Error(MESSAGE_CONSTANTS.ERROR_CONTENT_REQUIRED);
      }

      // 템플릿 변수 치환 (예: {{student_name}} -> 실제 학생 이름)
      const finalContent = content.replace(/\{\{student_name\}\}/g, student.name || MESSAGE_CONSTANTS.STUDENT_DEFAULT);

      // 수신자 전화번호 수집 (학생 + 선택된 보호자)
      const recipientPhones: string[] = [];

      // 학생 선택 시
      if (selectedStudent) {
        if (student.phone) {
          const phone = typeof student.phone === 'string' ? student.phone : String(student.phone);
          const trimmedPhone = phone.trim();
          if (trimmedPhone.length > 0) {
            recipientPhones.push(trimmedPhone);
          } else {
            throw new Error(MESSAGE_CONSTANTS.NO_STUDENT_PHONE_MESSAGE);
          }
        } else {
          throw new Error(MESSAGE_CONSTANTS.NO_STUDENT_PHONE_MESSAGE);
        }
      }

      // 선택된 보호자 전화번호 수집
      if (selectedGuardians.size > 0 && guardians && guardians.length > 0) {
        const guardianPhones = guardians
          .filter((g) => selectedGuardians.has(g.id))
          .map((g) => {
            const phone = typeof g.phone === 'string' ? g.phone : String(g.phone || '');
            return phone.trim();
          })
          .filter((phone) => phone.length > 0);
        recipientPhones.push(...guardianPhones);
      }

      if (recipientPhones.length === 0) {
        throw new Error(MESSAGE_CONSTANTS.NO_RECIPIENTS_SELECTED);
      }

      // 각 수신자에게 메시지 발송
      // [불변 규칙] 아키텍처 문서 3.5.4: 채널 우선순위는 Edge Function에서 처리
      const promises = recipientPhones.map((phone) =>
        apiClient.post<{ id: string }>('notifications', {
          channel: data.channel,
          recipient: phone,
          content: finalContent,
        status: 'pending',
        })
      );

      const results = await Promise.all(promises);

      // 에러 확인 및 부분 실패 처리
      const errors = results.filter((r) => r.error);
      const successCount = results.length - errors.length;

      if (errors.length > 0) {
        // 일부 실패한 경우
        if (successCount > 0) {
          // 부분 성공: 성공한 건수와 실패한 건수를 모두 표시
          const errorMessage = `${successCount}${MESSAGE_CONSTANTS.PARTIAL_SUCCESS_MESSAGE} ${errors.length}${MESSAGE_CONSTANTS.PARTIAL_FAILURE_MESSAGE} ${errors[0].error?.message || MESSAGE_CONSTANTS.ERROR_UNKNOWN}`;
          // [일관성] useModal 시그니처 준수: showAlert(message, title, type)
          showAlert(errorMessage, MESSAGE_CONSTANTS.ERROR_TITLE, 'error');
          // 부분 성공이어도 쿼리 무효화 (성공한 알림은 조회 가능하도록)
          queryClient.invalidateQueries({ queryKey: ['notifications', tenantId] });
          // 폼은 초기화하지 않음 (사용자가 재시도할 수 있도록)
          return;
        } else {
          // 전체 실패
          throw new Error(`${MESSAGE_CONSTANTS.ERROR_SEND_PARTIAL_FAILED} ${errors[0].error?.message || MESSAGE_CONSTANTS.ERROR_UNKNOWN}`);
        }
      }

      // 전체 성공
      queryClient.invalidateQueries({ queryKey: ['notifications', tenantId] });
      // [일관성] useModal 시그니처 준수: showAlert(message, title, type)
      showAlert(MESSAGE_CONSTANTS.SEND_SUCCESS_MESSAGE, MESSAGE_CONSTANTS.SEND_SUCCESS_TITLE, 'success');

      // 폼 초기화
      if (formRef.current) {
        formRef.current.reset();
        formRef.current.setValue('channel', selectedChannel);
      }
    } catch (error) {
      // [일관성] useModal 시그니처 준수: showAlert(message, title, type)
      const errorMessage = error instanceof Error ? error.message : MESSAGE_CONSTANTS.ERROR_UNKNOWN;
      showAlert(errorMessage, MESSAGE_CONSTANTS.ERROR_TITLE, 'error');
      throw error; // SchemaForm의 에러 처리도 위해 다시 throw
    }
  };

  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();
  // [불변 규칙] 하드코딩 금지: CSS 변수에서 아이콘 크기 읽기 (--size-icon-md = 14px)
  const buttonIconSize = useIconSize('--size-icon-md');

  return (
    <div>
      <LayerSectionHeader
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <MessageSquare size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
            {MESSAGE_CONSTANTS.TAB_TITLE}
          </span>
        }
      />
        <Card padding="md" variant="default" style={{ ...layerSectionCardStyle, border: 'var(--border-width-thin) solid var(--color-text)' }}>
        {/* 발송 대상 선택 */}
        <div style={{ paddingTop: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>

          {/* 학생, 부, 모, 기타를 같은 행에 한줄로 출력 - 모두 항상 표시 */}
          {guardiansLoading ? (
            <div style={{ padding: 'var(--spacing-sm)', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
              {MESSAGE_CONSTANTS.LOADING_GUARDIANS}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
              {/* 학생 - 항상 표시 */}
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  cursor: student?.phone ? 'pointer' : 'not-allowed',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderRadius: 'var(--border-radius-full)',
                  backgroundColor: selectedStudent ? 'var(--color-primary-50)' : 'var(--color-gray-50)',
                  border: selectedStudent ? 'var(--border-width-thin) solid var(--color-primary)' : 'var(--border-width-thin) solid var(--color-gray-200)',
                  opacity: student?.phone ? 1 : 0.5,
                  whiteSpace: 'nowrap',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.checked)}
                  disabled={!student?.phone}
                  style={{ width: 'var(--spacing-md)', height: 'var(--spacing-md)', cursor: student?.phone ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                />
                <span style={{ fontSize: 'var(--font-size-base)', color: selectedStudent ? 'var(--color-primary)' : (student?.phone ? 'var(--color-text)' : 'var(--color-text-secondary)') }}>
                  {MESSAGE_CONSTANTS.TARGET_STUDENT_LABEL}
            </span>
              </label>

              {/* 부 (parent) - 항상 표시 (보호자가 없어도) */}
              {guardiansByRelationship.parent.length > 0 ? (
                guardiansByRelationship.parent.map((guardian) => {
                  const isSelected = selectedGuardians.has(guardian.id);
                  const phone = typeof guardian.phone === 'string' ? guardian.phone : String(guardian.phone || '');
                  const hasPhone = phone.trim().length > 0;
                  return (
                    <label
                      key={guardian.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        cursor: hasPhone ? 'pointer' : 'not-allowed',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        borderRadius: 'var(--border-radius-full)',
                        backgroundColor: isSelected ? 'var(--color-primary-50)' : 'var(--color-gray-50)',
                        border: isSelected ? 'var(--border-width-thin) solid var(--color-primary)' : 'var(--border-width-thin) solid var(--color-gray-200)',
                        opacity: hasPhone ? 1 : 0.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (!hasPhone) return;
                          const newSet = new Set(selectedGuardians);
                          if (e.target.checked) {
                            newSet.add(guardian.id);
                          } else {
                            newSet.delete(guardian.id);
                          }
                          setSelectedGuardians(newSet);
                        }}
                        disabled={!hasPhone}
                        style={{ width: 'var(--spacing-md)', height: 'var(--spacing-md)', cursor: hasPhone ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 'var(--font-size-base)', color: isSelected ? 'var(--color-primary)' : (hasPhone ? 'var(--color-text)' : 'var(--color-text-secondary)') }}>
                        {getRelationshipLabel(guardian.relationship)}
                      </span>
                    </label>
                  );
                })
              ) : (
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    cursor: 'not-allowed',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    borderRadius: 'var(--border-radius-full)',
                    backgroundColor: 'var(--color-gray-50)',
                    border: 'var(--border-width-thin) solid var(--color-gray-200)',
                    opacity: 'var(--opacity-disabled)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={true}
                    style={{ width: 'var(--spacing-md)', height: 'var(--spacing-md)', cursor: 'not-allowed', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                    부
                  </span>
                </label>
              )}

              {/* 모 (guardian) - 항상 표시 (보호자가 없어도) */}
              {guardiansByRelationship.guardian.length > 0 ? (
                guardiansByRelationship.guardian.map((guardian) => {
                  const isSelected = selectedGuardians.has(guardian.id);
                  const phone = typeof guardian.phone === 'string' ? guardian.phone : String(guardian.phone || '');
                  const hasPhone = phone.trim().length > 0;
                  return (
                    <label
                      key={guardian.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        cursor: hasPhone ? 'pointer' : 'not-allowed',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        borderRadius: 'var(--border-radius-full)',
                        backgroundColor: isSelected ? 'var(--color-primary-50)' : 'var(--color-gray-50)',
                        border: isSelected ? 'var(--border-width-thin) solid var(--color-primary)' : 'var(--border-width-thin) solid var(--color-gray-200)',
                        opacity: hasPhone ? 1 : 0.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (!hasPhone) return;
                          const newSet = new Set(selectedGuardians);
                          if (e.target.checked) {
                            newSet.add(guardian.id);
                          } else {
                            newSet.delete(guardian.id);
                          }
                          setSelectedGuardians(newSet);
                        }}
                        disabled={!hasPhone}
                        style={{ width: 'var(--spacing-md)', height: 'var(--spacing-md)', cursor: hasPhone ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 'var(--font-size-base)', color: isSelected ? 'var(--color-primary)' : (hasPhone ? 'var(--color-text)' : 'var(--color-text-secondary)') }}>
                        {getRelationshipLabel(guardian.relationship)}
            </span>
                    </label>
                  );
                })
              ) : (
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    cursor: 'not-allowed',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    borderRadius: 'var(--border-radius-full)',
                    backgroundColor: 'var(--color-gray-50)',
                    border: 'var(--border-width-thin) solid var(--color-gray-200)',
                    opacity: 'var(--opacity-disabled)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={true}
                    style={{ width: 'var(--spacing-md)', height: 'var(--spacing-md)', cursor: 'not-allowed', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                    모
                  </span>
                </label>
              )}

              {/* 기타 (other) - 항상 표시 (보호자가 없어도) */}
              {guardiansByRelationship.other.length > 0 ? (
                guardiansByRelationship.other.map((guardian) => {
                  const isSelected = selectedGuardians.has(guardian.id);
                  const phone = typeof guardian.phone === 'string' ? guardian.phone : String(guardian.phone || '');
                  const hasPhone = phone.trim().length > 0;
                  return (
                    <label
                      key={guardian.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        cursor: hasPhone ? 'pointer' : 'not-allowed',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        borderRadius: 'var(--border-radius-full)',
                        backgroundColor: isSelected ? 'var(--color-primary-50)' : 'var(--color-gray-50)',
                        border: isSelected ? 'var(--border-width-thin) solid var(--color-primary)' : 'var(--border-width-thin) solid var(--color-gray-200)',
                        opacity: hasPhone ? 1 : 0.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (!hasPhone) return;
                          const newSet = new Set(selectedGuardians);
                          if (e.target.checked) {
                            newSet.add(guardian.id);
                          } else {
                            newSet.delete(guardian.id);
                          }
                          setSelectedGuardians(newSet);
                        }}
                        disabled={!hasPhone}
                        style={{ width: 'var(--spacing-md)', height: 'var(--spacing-md)', cursor: hasPhone ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 'var(--font-size-base)', color: isSelected ? 'var(--color-primary)' : (hasPhone ? 'var(--color-text)' : 'var(--color-text-secondary)') }}>
                        {getRelationshipLabel(guardian.relationship)}
                      </span>
                    </label>
                  );
                })
              ) : (
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    cursor: 'not-allowed',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    borderRadius: 'var(--border-radius-full)',
                    backgroundColor: 'var(--color-gray-50)',
                    border: 'var(--border-width-thin) solid var(--color-gray-200)',
                    opacity: 'var(--opacity-disabled)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={true}
                    style={{ width: 'var(--spacing-md)', height: 'var(--spacing-md)', cursor: 'not-allowed', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                    기타
                  </span>
                </label>
              )}

              {/* 보호자가 없는 경우 */}
              {guardians && guardians.length === 0 && (
                <div style={{ padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-warning-50)', borderRadius: 'var(--border-radius-sm)' }}>
                  <p style={{ color: 'var(--color-warning)', fontSize: 'var(--font-size-base)', textAlign: 'center', margin: 0 }}>
                    {MESSAGE_CONSTANTS.NO_GUARDIANS_MESSAGE}
                  </p>
          </div>
              )}
        </div>
      )}
        </div>

        {/* [불변 규칙] 기존 notificationFormSchema와 SchemaForm 재사용 */}
        {/* 학생 또는 보호자가 선택되었을 때만 폼 표시 */}
        {isEditable && schema && (selectedStudent || selectedGuardians.size > 0) && (
          <>
            {/* [불변 규칙] 기존 notificationFormSchema와 SchemaFormWithMethods 재사용 */}
            {/* 하나의 카드 레이아웃으로 통합: channel, content, 발송 버튼 */}
            {/* 근본 원인 해결: 외부 Card와 SchemaFormWithMethods 내부 Card가 중첩되어 이중 패딩 발생 */}
            {/* 해결책: SchemaFormWithMethods 내부 Card의 padding을 var(--spacing-none)으로 오버라이드하여 외부 Card의 padding에만 의존 */}
            {/* 이렇게 하면 다른 탭들(TagsTab, AttendanceTab)과 동일한 패딩 구조 유지 */}
            <SchemaFormWithMethods
                    formRef={formRef}
                    schema={{
                      ...schema,
                      form: {
                        ...schema.form,
                        // recipient 필드는 제거 (보호자 목록을 자동으로 사용)
                        // channel과 content 필드만 남김 (순서: channel, content)
                        fields: schema.form.fields
                          .filter((field) => field.name !== 'recipient')
                          .sort((a, b) => {
                            // channel 필드를 먼저, content 필드를 나중에
                            if (a.name === 'channel') return -1;
                            if (b.name === 'channel') return 1;
                            return 0;
                          })
                          .map((field) => {
                            // content 필드에 rows 속성 추가 (5행)
                            if (field.name === 'content' && field.kind === 'textarea') {
                              return {
                                ...field,
                                ui: {
                                  ...field.ui,
                                  rows: 5,
                                },
                              };
                            }
                            return field;
                          }),
                        // 발송 버튼 아이콘을 MessageSquare로 변경 (메시지 발송 타이틀과 동일, 크기 14픽셀)
                        // [불변 규칙] 하드코딩 금지: CSS 변수 사용 (--size-icon-md = 14px)
                        // [참고] FormSchema 타입에 icon이 없지만, SchemaForm.tsx에서 (formConfig.submit as any).icon으로 사용하므로 타입 단언 필요
                        submit: {
                          ...schema.form.submit,
                          icon: <MessageSquare size={buttonIconSize} />,
                        } as any,
                      },
                    }}
                    onSubmit={handleSendMessage}
                    defaultValues={formDefaultValues}
                    disableCardPadding={false}
                    cardTitle={undefined}
                    cardStyle={{
                      border: 'none',
                      boxShadow: 'none',
                      // [불변 규칙] 하드코딩 금지: CSS 변수 사용 (docu/스키마엔진.txt: "하드코딩된 px 값을 금지합니다")
                      borderRadius: 'var(--spacing-none)',
                      // [불변 규칙] 내부 Card의 padding을 var(--spacing-none)으로 오버라이드하여 외부 Card의 padding에 의존
                      paddingTop: 'var(--spacing-none)',
                      paddingRight: 'var(--spacing-none)',
                      paddingLeft: 'var(--spacing-none)',
                      paddingBottom: 'var(--spacing-none)',
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
                        // [일관성] useModal 시그니처 준수: showAlert(message, title, type)
                        const title = variant === 'success' ? MESSAGE_CONSTANTS.SEND_SUCCESS_TITLE : variant === 'error' ? MESSAGE_CONSTANTS.ERROR_TITLE : MESSAGE_CONSTANTS.ALERT_TITLE;
                        const type = variant === 'success' ? 'success' : variant === 'error' ? 'error' : 'info';
                        showAlert(message, title, type);
                      },
                    }}
              />
          </>
      )}
      </Card>
    </div>
  );
}
