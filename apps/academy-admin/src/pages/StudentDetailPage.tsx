/**
 * 학생 상세 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ErrorBoundary, useModal } from '@ui-core/react';
import { Container, Card, Button, Input, Select, Textarea } from '@ui-core/react';
import { SchemaForm, SchemaDetail } from '@schema-engine';
import { toKST } from '@lib/date-utils';
import { studentFormSchema } from '../schemas/student.schema';
import { studentDetailSchema } from '../schemas/student.detail.schema';
import { guardianFormSchema } from '../schemas/guardian.schema';
import { consultationFormSchema } from '../schemas/consultation.schema';
import { classAssignmentFormSchema } from '../schemas/class-assignment.schema';
import {
  useStudent,
  useGuardians,
  useConsultations,
  useStudentTags,
  useStudentTagsByStudent,
  useUpdateStudent,
  useCreateGuardian,
  useUpdateGuardian,
  useDeleteGuardian,
  useCreateConsultation,
  useUpdateConsultation,
  useDeleteConsultation,
  useGenerateConsultationAISummary,
  useUpdateStudentTags,
  useStudentClasses,
  useAssignStudentToClass,
  useUnassignStudentFromClass,
} from '@hooks/use-student';
import { useClasses } from '@hooks/use-class';
import type { Class } from '@services/class-service';
import type { StudentStatus, Gender, GuardianRelationship, ConsultationType } from '@services/student-service';
import type { Tag } from '@core/tags';

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useModal();
  const [activeTab, setActiveTab] = useState<'info' | 'guardians' | 'consultations' | 'tags' | 'classes'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [showGuardianForm, setShowGuardianForm] = useState(false);
  const [showConsultationForm, setShowConsultationForm] = useState(false);
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [editingConsultationId, setEditingConsultationId] = useState<string | null>(null);
  const [consultationTypeFilter, setConsultationTypeFilter] = useState<ConsultationType | 'all'>('all');

  const { data: student, isLoading: studentLoading } = useStudent(id || null);
  const { data: guardians, isLoading: guardiansLoading } = useGuardians(id || null);
  const { data: allConsultations, isLoading: consultationsLoading } = useConsultations(id || null);
  const { data: studentTags, isLoading: tagsLoading } = useStudentTagsByStudent(id || null);
  const { data: studentClasses, isLoading: classesLoading } = useStudentClasses(id || null);
  const { data: allClasses } = useClasses({ status: 'active' });

  // 학습일지 필터링 (요구사항: 상담일지/학습일지 관리)
  const consultations = useMemo(() => {
    if (!allConsultations) return [];
    if (consultationTypeFilter === 'all') return allConsultations;
    return allConsultations.filter((c) => c.consultation_type === consultationTypeFilter);
  }, [allConsultations, consultationTypeFilter]);

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

  if (studentLoading) {
    return (
      <Container maxWidth="xl" padding="lg">
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>
      </Container>
    );
  }

  if (!student) {
    return (
      <Container maxWidth="xl" padding="lg">
        <Card padding="md" variant="outlined">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <p>학생을 찾을 수 없습니다.</p>
            <Button variant="outline" onClick={() => navigate('/students')} style={{ marginTop: 'var(--spacing-md)' }}>
              목록으로 돌아가기
            </Button>
          </div>
        </Card>
      </Container>
    );
  }

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
              {student.name} 학생 상세
            </h1>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <Button variant="outline" onClick={() => navigate('/students')}>
                목록으로
              </Button>
              {!isEditing && (
                <Button variant="solid" onClick={() => setIsEditing(true)}>
                  수정
                </Button>
              )}
            </div>
          </div>

          {/* 탭 메뉴 */}
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border)' }}>
            <Button
              variant={activeTab === 'info' ? 'solid' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('info')}
            >
              기본 정보
            </Button>
            <Button
              variant={activeTab === 'guardians' ? 'solid' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('guardians')}
            >
              학부모 ({guardians?.length || 0})
            </Button>
            <Button
              variant={activeTab === 'consultations' ? 'solid' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('consultations')}
            >
              상담일지 ({consultations?.length || 0})
            </Button>
            <Button
              variant={activeTab === 'tags' ? 'solid' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('tags')}
            >
              태그
            </Button>
            <Button
              variant={activeTab === 'classes' ? 'solid' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('classes')}
            >
              반 배정 ({studentClasses?.filter((sc) => sc.is_active).length || 0})
            </Button>
          </div>

          {/* 기본 정보 탭 */}
          {activeTab === 'info' && (
            <StudentInfoTab
              student={student}
              isEditing={isEditing}
              onCancel={() => setIsEditing(false)}
              onSave={async (data) => {
                await updateStudent.mutateAsync({ studentId: student.id, input: data });
                setIsEditing(false);
              }}
            />
          )}

          {/* 학부모 탭 */}
          {activeTab === 'guardians' && (
            <GuardiansTab
              guardians={guardians || []}
              isLoading={guardiansLoading}
              showForm={showGuardianForm}
              editingGuardianId={editingGuardianId}
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
                await createGuardian.mutateAsync({ studentId: student.id, guardian: data });
                setShowGuardianForm(false);
              }}
              onUpdate={async (guardianId, data) => {
                await updateGuardian.mutateAsync({ guardianId, guardian: data, studentId: student.id });
                setShowGuardianForm(false);
                setEditingGuardianId(null);
              }}
              onDelete={async (guardianId) => {
                const confirmed = await showConfirm('정말 삭제하시겠습니까?', '보호자 삭제');
                if (confirmed) {
                  await deleteGuardian.mutateAsync({ guardianId, studentId: student.id });
                }
              }}
            />
          )}

          {/* 상담일지 탭 */}
          {activeTab === 'consultations' && (
            <ConsultationsTab
              consultations={consultations || []}
              isLoading={consultationsLoading}
              showForm={showConsultationForm}
              editingConsultationId={editingConsultationId}
              consultationTypeFilter={consultationTypeFilter}
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
                // TODO: userId 가져오기
                await createConsultation.mutateAsync({ studentId: student.id, consultation: data, userId: 'current-user-id' });
                setShowConsultationForm(false);
              }}
              onUpdate={async (consultationId, data) => {
                await updateConsultation.mutateAsync({ consultationId, consultation: data, studentId: student.id });
                setShowConsultationForm(false);
                setEditingConsultationId(null);
              }}
              onDelete={async (consultationId) => {
                const confirmed = await showConfirm('정말 삭제하시겠습니까?', '상담일지 삭제');
                if (confirmed) {
                  await deleteConsultation.mutateAsync({ consultationId, studentId: student.id });
                }
              }}
              onGenerateAISummary={async (consultationId) => {
                try {
                  await generateAISummary.mutateAsync({ consultationId, studentId: student.id });
                } catch (error) {
                  console.error('AI 요약 생성 실패:', error);
                  showAlert('AI 요약 생성에 실패했습니다.', '오류', 'error');
                }
              }}
              onFilterChange={setConsultationTypeFilter}
            />
          )}

          {/* 태그 탭 */}
          {activeTab === 'tags' && (
            <TagsTab
              studentTags={studentTags || []}
              isLoading={tagsLoading}
              studentId={student.id}
              onUpdateTags={async (tagIds) => {
                await updateStudentTags.mutateAsync({ studentId: student.id, tagIds });
              }}
            />
          )}

          {activeTab === 'classes' && (
            <ClassesTab
              studentId={student.id}
              studentClasses={studentClasses || []}
              isLoading={classesLoading}
              allClasses={allClasses || []}
              onAssign={async (classId, enrolledAt) => {
                await assignStudentToClass.mutateAsync({
                  studentId: student.id,
                  classId,
                  enrolledAt,
                });
              }}
              onUnassign={async (classId, leftAt) => {
                await unassignStudentFromClass.mutateAsync({
                  studentId: student.id,
                  classId,
                  leftAt,
                });
              }}
            />
          )}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

// 기본 정보 탭 컴포넌트
interface StudentInfoTabProps {
  student: any;
  isEditing: boolean;
  onCancel: () => void;
  onSave: (data: any) => Promise<void>;
}

function StudentInfoTab({ student, isEditing, onCancel, onSave }: StudentInfoTabProps) {
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
          schema={studentDetailSchema}
          data={detailData}
        />
      </Card>
    );
  }

  // 수정 모드: SchemaForm 사용
  const handleSubmit = async (data: any) => {
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
    ...studentFormSchema,
    form: {
      ...studentFormSchema.form,
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
  guardians: any[];
  isLoading: boolean;
  showForm: boolean;
  editingGuardianId: string | null;
  onShowForm: () => void;
  onHideForm: () => void;
  onEdit: (guardianId: string) => void;
  onCreate: (data: any) => Promise<void>;
  onUpdate: (guardianId: string, data: any) => Promise<void>;
  onDelete: (guardianId: string) => Promise<void>;
}

function GuardiansTab({
  guardians,
  isLoading,
  showForm,
  editingGuardianId,
  onShowForm,
  onHideForm,
  onEdit,
  onCreate,
  onUpdate,
  onDelete,
}: GuardiansTabProps) {
  const editingGuardian = editingGuardianId ? guardians.find((g) => g.id === editingGuardianId) : null;
  const { showAlert } = useModal();

  const handleSubmit = async (data: any) => {
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
      {!showForm && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <Button variant="solid" onClick={onShowForm}>
            학부모 추가
          </Button>
        </div>
      )}

      {showForm && (
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
            schema={guardianFormSchema}
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
              showToast: (message: string, variant?: string) => {
                showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
              },
            }}
          />
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {guardians.map((guardian) => (
          <Card key={guardian.id} padding="md" variant="default">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                  <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>{guardian.name}</h4>
                  {guardian.is_primary && (
                    <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', backgroundColor: 'var(--color-blue-100)', color: 'var(--color-blue-800)', borderRadius: '4px' }}>
                      주 보호자
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  {guardian.relationship === 'parent' ? '부모' : guardian.relationship === 'guardian' ? '보호자' : '기타'}
                </p>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{guardian.phone}</p>
                {guardian.email && (
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{guardian.email}</p>
                )}
                {guardian.notes && (
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>{guardian.notes}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <Button variant="ghost" size="sm" onClick={() => onEdit(guardian.id)}>
                  수정
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(guardian.id)}>
                  삭제
                </Button>
              </div>
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
  consultations: any[];
  isLoading: boolean;
  showForm: boolean;
  editingConsultationId: string | null;
  consultationTypeFilter: ConsultationType | 'all';
  onShowForm: () => void;
  onHideForm: () => void;
  onEdit: (consultationId: string) => void;
  onCreate: (data: any) => Promise<void>;
  onUpdate: (consultationId: string, data: any) => Promise<void>;
  onDelete: (consultationId: string) => Promise<void>;
  onGenerateAISummary: (consultationId: string) => Promise<void>;
  onFilterChange: (filter: ConsultationType | 'all') => void;
}

function ConsultationsTab({
  consultations,
  isLoading,
  showForm,
  editingConsultationId,
  consultationTypeFilter,
  onShowForm,
  onHideForm,
  onEdit,
  onCreate,
  onUpdate,
  onDelete,
  onGenerateAISummary,
  onFilterChange,
}: ConsultationsTabProps) {
  const editingConsultation = editingConsultationId ? consultations.find((c) => c.id === editingConsultationId) : null;
  const { showAlert } = useModal();

  const handleSubmit = async (data: any) => {
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
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <Button
              variant={consultationTypeFilter === 'all' ? 'solid' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('all')}
            >
              전체
            </Button>
            <Button
              variant={consultationTypeFilter === 'counseling' ? 'solid' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('counseling')}
            >
              상담일지
            </Button>
            <Button
              variant={consultationTypeFilter === 'learning' ? 'solid' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('learning')}
            >
              학습일지
            </Button>
            <Button
              variant={consultationTypeFilter === 'behavior' ? 'solid' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('behavior')}
            >
              행동일지
            </Button>
          </div>
          <Button variant="solid" onClick={onShowForm}>
            상담일지 추가
          </Button>
        </div>
      )}

      {showForm && (
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
            schema={consultationFormSchema}
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
              showToast: (message: string, variant?: string) => {
                showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
              },
            }}
          />
        </Card>
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
                  <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', backgroundColor: 'var(--color-gray-100)', color: 'var(--color-gray-800)', borderRadius: '4px' }}>
                    {consultation.consultation_type === 'counseling' ? '상담' : consultation.consultation_type === 'learning' ? '학습' : consultation.consultation_type === 'behavior' ? '행동' : '기타'}
                  </span>
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
                  {consultation.content}
                </p>
                {consultation.ai_summary && (
                  <div style={{ marginTop: 'var(--spacing-sm)', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-blue-50)', borderRadius: '4px' }}>
                    <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>AI 요약</p>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{consultation.ai_summary}</p>
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
                      🤖 AI 요약 생성
                    </Button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <Button variant="ghost" size="sm" onClick={() => onEdit(consultation.id)}>
                  수정
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(consultation.id)}>
                  삭제
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {consultations.length === 0 && !showForm && (
          <Card padding="md" variant="outlined">
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>등록된 상담일지가 없습니다.</p>
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
}

function TagsTab({ studentTags, isLoading, studentId, onUpdateTags }: TagsTabProps) {
  const { data: allTags, isLoading: allTagsLoading } = useStudentTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // 학생 태그가 로드되면 선택된 태그 ID 업데이트
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
    <Card padding="md" variant="default">
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
          태그 관리
        </h3>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
          학생에게 태그를 추가하거나 제거할 수 있습니다.
        </p>
      </div>

      {/* 전체 태그 목록 */}
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
                  onClick={() => handleTagToggle(tag.id)}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    fontSize: 'var(--font-size-sm)',
                    borderRadius: '4px',
                    border: isSelected ? `2px solid ${tag.color}` : '2px solid transparent',
                    color: isSelected ? '#ffffff' : tag.color,
                    backgroundColor: isSelected ? tag.color : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 저장 버튼 */}
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
    </Card>
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
  onAssign: (classId: string, enrolledAt?: string) => Promise<void>;
  onUnassign: (classId: string, leftAt?: string) => Promise<void>;
}

function ClassesTab({
  studentId,
  studentClasses,
  isLoading,
  allClasses,
  onAssign,
  onUnassign,
}: ClassesTabProps) {
  const { showAlert, showConfirm } = useModal();
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [enrolledAt, setEnrolledAt] = useState(toKST().format('YYYY-MM-DD'));

  // 이미 배정된 반 ID 목록
  const assignedClassIds = studentClasses
    .filter((sc) => sc.is_active)
    .map((sc) => sc.class_id);

  // 배정 가능한 반 목록 (활성 상태이고 아직 배정되지 않은 반)
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

  const handleAssign = async (data: any) => {
    if (!data.class_id) return;

    try {
      await onAssign(data.class_id, data.enrolled_at || toKST().format('YYYY-MM-DD'));
      setShowAssignForm(false);
      setSelectedClassId('');
      setEnrolledAt(toKST().format('YYYY-MM-DD'));
    } catch (error) {
      console.error('Failed to assign class:', error);
      showAlert('반 배정에 실패했습니다.', '오류', 'error');
    }
  };

  const handleUnassign = async (classId: string) => {
    const confirmed = await showConfirm('정말 이 반에서 제외하시겠습니까?', '반 제외');
    if (!confirmed) return;

    try {
      await onUnassign(classId, toKST().format('YYYY-MM-DD'));
    } catch (error) {
      console.error('Failed to unassign class:', error);
      showAlert('반 제외에 실패했습니다.', '오류', 'error');
    }
  };

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <Button
          variant="solid"
          onClick={() => setShowAssignForm(!showAssignForm)}
          disabled={availableClasses.length === 0}
        >
          반 배정
        </Button>
        {availableClasses.length === 0 && (
          <span style={{ marginLeft: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            배정 가능한 반이 없습니다.
          </span>
        )}
      </div>

      {showAssignForm && (
        <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>반 배정</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowAssignForm(false)}>
              닫기
                </Button>
              </div>
          <SchemaForm
            schema={{
              ...classAssignmentFormSchema,
              form: {
                ...classAssignmentFormSchema.form,
                fields: [
                  {
                    ...classAssignmentFormSchema.form.fields[0],
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
                  classAssignmentFormSchema.form.fields[1],
                ],
              },
            }}
            onSubmit={handleAssign}
            defaultValues={{
              enrolled_at: toKST().format('YYYY-MM-DD'),
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
              showToast: (message: string, variant?: string) => {
                showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
              },
            }}
          />
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {studentClasses
          .filter((sc) => sc.is_active && sc.class)
          .map((studentClass) => {
            const classItem = studentClass.class!;
            const dayLabel = DAYS_OF_WEEK.find((d) => d.value === classItem.day_of_week)?.label || classItem.day_of_week;

            return (
              <Card key={studentClass.id} padding="md" variant="default" style={{ borderLeft: `4px solid ${classItem.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                      {classItem.name}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {classItem.subject && <div>과목: {classItem.subject}</div>}
                      {classItem.grade && <div>대상: {classItem.grade}</div>}
                      <div>요일: {dayLabel}</div>
                      <div>시간: {classItem.start_time} ~ {classItem.end_time}</div>
                      {classItem.room && <div>강의실: {classItem.room}</div>}
                      <div>배정일: {studentClass.enrolled_at}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnassign(classItem.id)}
                  >
                    제외
                  </Button>
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

