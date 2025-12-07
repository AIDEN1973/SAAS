/**
 * 학생 상세 페이지
 * 
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@ui-core/react';
import { Container, Card, Button, Input, Textarea, Select } from '@ui-core/react';
import {
  useStudent,
  useGuardians,
  useConsultations,
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
  const [activeTab, setActiveTab] = useState<'info' | 'guardians' | 'consultations' | 'tags' | 'classes'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [showGuardianForm, setShowGuardianForm] = useState(false);
  const [showConsultationForm, setShowConsultationForm] = useState(false);
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [editingConsultationId, setEditingConsultationId] = useState<string | null>(null);

  const { data: student, isLoading: studentLoading } = useStudent(id || null);
  const { data: guardians, isLoading: guardiansLoading } = useGuardians(id || null);
  const { data: consultations, isLoading: consultationsLoading } = useConsultations(id || null);
  const { data: studentTags, isLoading: tagsLoading } = useStudentTagsByStudent(id || null);
  const { data: studentClasses, isLoading: classesLoading } = useStudentClasses(id || null);
  const { data: allClasses } = useClasses({ status: 'active' });

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
                if (confirm('정말 삭제하시겠습니까?')) {
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
                if (confirm('정말 삭제하시겠습니까?')) {
                  await deleteConsultation.mutateAsync({ consultationId, studentId: student.id });
                }
              }}
              onGenerateAISummary={async (consultationId) => {
                try {
                  await generateAISummary.mutateAsync({ consultationId, studentId: student.id });
                } catch (error) {
                  console.error('AI 요약 생성 실패:', error);
                  alert('AI 요약 생성에 실패했습니다.');
                }
              }}
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
  const [formData, setFormData] = useState({
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
  });

  if (!isEditing) {
    return (
      <Card padding="md" variant="default">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-md)' }}>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>이름</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>{student.name}</p>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>생년월일</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>{student.birth_date || '-'}</p>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>성별</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>{student.gender === 'male' ? '남' : student.gender === 'female' ? '여' : '-'}</p>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>전화번호</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>{student.phone || '-'}</p>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>이메일</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>{student.email || '-'}</p>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>주소</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>{student.address || '-'}</p>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>학교</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>{student.school_name || '-'}</p>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>학년</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>{student.grade || '-'}</p>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>상태</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>
              {student.status === 'active' ? '재원' : student.status === 'on_leave' ? '휴원' : student.status === 'withdrawn' ? '퇴원' : '졸업'}
            </p>
          </div>
          {student.notes && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>비고</label>
              <p style={{ fontSize: 'var(--font-size-base)' }}>{student.notes}</p>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md" variant="default">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-md)' }}>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>이름 *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
            />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>생년월일</label>
            <Input
              type="date"
              value={formData.birth_date}
              onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
              fullWidth
            />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>성별</label>
            <Select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              fullWidth
            >
              <option value="">선택</option>
              <option value="male">남</option>
              <option value="female">여</option>
            </Select>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>전화번호</label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              fullWidth
            />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>이메일</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
            />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>주소</label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              fullWidth
            />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>학교</label>
            <Input
              value={formData.school_name}
              onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
              fullWidth
            />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>학년</label>
            <Input
              value={formData.grade}
              onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
              fullWidth
            />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>상태</label>
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as StudentStatus })}
              fullWidth
            >
              <option value="active">재원</option>
              <option value="on_leave">휴원</option>
              <option value="withdrawn">퇴원</option>
              <option value="graduated">졸업</option>
            </Select>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>비고</label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            fullWidth
            rows={4}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
          <Button variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button variant="solid" onClick={() => onSave(formData)}>
            저장
          </Button>
        </div>
      </div>
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
  const [formData, setFormData] = useState({
    name: editingGuardian?.name || '',
    relationship: editingGuardian?.relationship || 'parent',
    phone: editingGuardian?.phone || '',
    email: editingGuardian?.email || '',
    is_primary: editingGuardian?.is_primary || false,
    notes: editingGuardian?.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGuardianId) {
      await onUpdate(editingGuardianId, formData);
    } else {
      await onCreate(formData);
    }
    setFormData({
      name: '',
      relationship: 'parent',
      phone: '',
      email: '',
      is_primary: false,
      notes: '',
    });
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
          <h3 style={{ marginBottom: 'var(--spacing-md)' }}>{editingGuardianId ? '학부모 수정' : '학부모 추가'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>이름 *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  fullWidth
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>관계 *</label>
                <Select
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value as GuardianRelationship })}
                  fullWidth
                  required
                >
                  <option value="parent">부모</option>
                  <option value="guardian">보호자</option>
                  <option value="other">기타</option>
                </Select>
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>전화번호 *</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  fullWidth
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>이메일</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  fullWidth
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_primary}
                    onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                  />
                  주 보호자
                </label>
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>비고</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  fullWidth
                  rows={3}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                <Button type="button" variant="outline" onClick={onHideForm}>
                  취소
                </Button>
                <Button type="submit" variant="solid">
                  {editingGuardianId ? '수정' : '추가'}
                </Button>
              </div>
            </div>
          </form>
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
  onShowForm: () => void;
  onHideForm: () => void;
  onEdit: (consultationId: string) => void;
  onCreate: (data: any) => Promise<void>;
  onUpdate: (consultationId: string, data: any) => Promise<void>;
  onDelete: (consultationId: string) => Promise<void>;
  onGenerateAISummary: (consultationId: string) => Promise<void>;
}

function ConsultationsTab({
  consultations,
  isLoading,
  showForm,
  editingConsultationId,
  onShowForm,
  onHideForm,
  onEdit,
  onCreate,
  onUpdate,
  onDelete,
  onGenerateAISummary,
}: ConsultationsTabProps) {
  const editingConsultation = editingConsultationId ? consultations.find((c) => c.id === editingConsultationId) : null;
  const [formData, setFormData] = useState({
    consultation_date: editingConsultation?.consultation_date || new Date().toISOString().split('T')[0],
    consultation_type: editingConsultation?.consultation_type || 'counseling',
    content: editingConsultation?.content || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingConsultationId) {
      await onUpdate(editingConsultationId, formData);
    } else {
      await onCreate(formData);
    }
    setFormData({
      consultation_date: new Date().toISOString().split('T')[0],
      consultation_type: 'counseling',
      content: '',
    });
  };

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div>
      {!showForm && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <Button variant="solid" onClick={onShowForm}>
            상담일지 추가
          </Button>
        </div>
      )}

      {showForm && (
        <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-md)' }}>{editingConsultationId ? '상담일지 수정' : '상담일지 추가'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>상담일자 *</label>
                <Input
                  type="date"
                  value={formData.consultation_date}
                  onChange={(e) => setFormData({ ...formData, consultation_date: e.target.value })}
                  fullWidth
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>상담 유형 *</label>
                <Select
                  value={formData.consultation_type}
                  onChange={(e) => setFormData({ ...formData, consultation_type: e.target.value as ConsultationType })}
                  fullWidth
                  required
                >
                  <option value="counseling">상담</option>
                  <option value="learning">학습</option>
                  <option value="behavior">행동</option>
                  <option value="other">기타</option>
                </Select>
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>상담 내용 *</label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  fullWidth
                  rows={8}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                <Button type="button" variant="outline" onClick={onHideForm}>
                  취소
                </Button>
                <Button type="submit" variant="solid">
                  {editingConsultationId ? '수정' : '추가'}
                </Button>
              </div>
            </div>
          </form>
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
  studentTags: Tag[];
  isLoading: boolean;
  studentId: string;
  onUpdateTags: (tagIds: string[]) => Promise<void>;
}

function TagsTab({ studentTags, isLoading, studentId, onUpdateTags }: TagsTabProps) {
  // TODO: 전체 태그 목록 조회 및 태그 선택 UI 구현
  // 현재는 간단히 표시만 함
  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <Card padding="md" variant="default">
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
        태그 관리 기능은 추후 구현 예정입니다.
      </p>
      {studentTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
          {studentTags.map((tag) => (
            <span
              key={tag.id}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                fontSize: 'var(--font-size-sm)',
                borderRadius: '4px',
                color: '#ffffff',
                backgroundColor: tag.color,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
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
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [enrolledAt, setEnrolledAt] = useState(new Date().toISOString().split('T')[0]);

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

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) return;

    try {
      await onAssign(selectedClassId, enrolledAt);
      setShowAssignForm(false);
      setSelectedClassId('');
      setEnrolledAt(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Failed to assign class:', error);
      alert('반 배정에 실패했습니다.');
    }
  };

  const handleUnassign = async (classId: string) => {
    if (!confirm('정말 이 반에서 제외하시겠습니까?')) return;

    try {
      await onUnassign(classId, new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Failed to unassign class:', error);
      alert('반 제외에 실패했습니다.');
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
          <h3 style={{ marginBottom: 'var(--spacing-md)' }}>반 배정</h3>
          <form onSubmit={handleAssign}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <Select
                label="반 선택"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                required
                fullWidth
              >
                <option value="">반을 선택하세요</option>
                {availableClasses.map((classItem) => {
                  const dayLabel = DAYS_OF_WEEK.find((d) => d.value === classItem.day_of_week)?.label || classItem.day_of_week;
                  return (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name} ({dayLabel} {classItem.start_time}~{classItem.end_time})
                    </option>
                  );
                })}
              </Select>

              <Input
                label="배정일"
                type="date"
                value={enrolledAt}
                onChange={(e) => setEnrolledAt(e.target.value)}
                required
                fullWidth
              />

              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                <Button type="button" variant="outline" onClick={() => setShowAssignForm(false)}>
                  취소
                </Button>
                <Button type="submit" variant="solid">
                  배정
                </Button>
              </div>
            </div>
          </form>
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

