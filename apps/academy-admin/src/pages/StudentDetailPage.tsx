/**
 * ?™ìƒ ?ì„¸ ?˜ì´ì§€
 * 
 * [ë¶ˆë? ê·œì¹™] api-sdkë¥??µí•´?œë§Œ ?°ì´???”ì²­
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: UI??tenantIdë¥?ì§ì ‘ ?„ë‹¬?˜ì? ?ŠìŒ, Context?ì„œ ?ë™ ê°€?¸ì˜´
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@ui-core/react';
import { Container, Card, Button, Input, Select, Textarea } from '@ui-core/react';
import { SchemaForm } from '@schema/engine';
import { studentFormSchema } from '../schemas/student.schema';
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
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>ë¡œë”© ì¤?..</div>
      </Container>
    );
  }

  if (!student) {
    return (
      <Container maxWidth="xl" padding="lg">
        <Card padding="md" variant="outlined">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <p>?™ìƒ??ì°¾ì„ ???†ìŠµ?ˆë‹¤.</p>
            <Button variant="outline" onClick={() => navigate('/students')} style={{ marginTop: 'var(--spacing-md)' }}>
              ëª©ë¡?¼ë¡œ ?Œì•„ê°€ê¸?
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
              {student.name} ?™ìƒ ?ì„¸
            </h1>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <Button variant="outline" onClick={() => navigate('/students')}>
                ëª©ë¡?¼ë¡œ
              </Button>
              {!isEditing && (
                <Button variant="solid" onClick={() => setIsEditing(true)}>
                  ?˜ì •
                </Button>
              )}
            </div>
          </div>

          {/* ??ë©”ë‰´ */}
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border)' }}>
            <Button
              variant={activeTab === 'info' ? 'solid' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('info')}
            >
              ê¸°ë³¸ ?•ë³´
            </Button>
            <Button
              variant={activeTab === 'guardians' ? 'solid' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('guardians')}
            >
              ?™ë?ëª?({guardians?.length || 0})
            </Button>
            <Button
              variant={activeTab === 'consultations' ? 'solid' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('consultations')}
            >
              ?ë‹´?¼ì? ({consultations?.length || 0})
            </Button>
            <Button
              variant={activeTab === 'tags' ? 'solid' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('tags')}
            >
              ?œê·¸
            </Button>
            <Button
              variant={activeTab === 'classes' ? 'solid' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('classes')}
            >
              ë°?ë°°ì • ({studentClasses?.filter((sc) => sc.is_active).length || 0})
            </Button>
          </div>

          {/* ê¸°ë³¸ ?•ë³´ ??*/}
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

          {/* ?™ë?ëª???*/}
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
                if (confirm('?•ë§ ?? œ?˜ì‹œê² ìŠµ?ˆê¹Œ?')) {
                  await deleteGuardian.mutateAsync({ guardianId, studentId: student.id });
                }
              }}
            />
          )}

          {/* ?ë‹´?¼ì? ??*/}
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
                // TODO: userId ê°€?¸ì˜¤ê¸?
                await createConsultation.mutateAsync({ studentId: student.id, consultation: data, userId: 'current-user-id' });
                setShowConsultationForm(false);
              }}
              onUpdate={async (consultationId, data) => {
                await updateConsultation.mutateAsync({ consultationId, consultation: data, studentId: student.id });
                setShowConsultationForm(false);
                setEditingConsultationId(null);
              }}
              onDelete={async (consultationId) => {
                if (confirm('?•ë§ ?? œ?˜ì‹œê² ìŠµ?ˆê¹Œ?')) {
                  await deleteConsultation.mutateAsync({ consultationId, studentId: student.id });
                }
              }}
              onGenerateAISummary={async (consultationId) => {
                try {
                  await generateAISummary.mutateAsync({ consultationId, studentId: student.id });
                } catch (error) {
                  console.error('AI ?”ì•½ ?ì„± ?¤íŒ¨:', error);
                  alert('AI ?”ì•½ ?ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤.');
                }
              }}
            />
          )}

          {/* ?œê·¸ ??*/}
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

// ê¸°ë³¸ ?•ë³´ ??ì»´í¬?ŒíŠ¸
interface StudentInfoTabProps {
  student: any;
  isEditing: boolean;
  onCancel: () => void;
  onSave: (data: any) => Promise<void>;
}

function StudentInfoTab({ student, isEditing, onCancel, onSave }: StudentInfoTabProps) {
  if (!isEditing) {
    return (
      <Card padding="md" variant="default">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-md)' }}>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>?´ë¦„</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>{student.name}</p>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>?ë…„?”ì¼</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>{student.birth_date || '-'}</p>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>?±ë³„</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>{student.gender === 'male' ? '?? : student.gender === 'female' ? '?? : '-'}</p>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>?„í™”ë²ˆí˜¸</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>{student.phone || '-'}</p>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>?´ë©”??/label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>{student.email || '-'}</p>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>ì£¼ì†Œ</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>{student.address || '-'}</p>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>?™êµ</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>{student.school_name || '-'}</p>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>?™ë…„</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>{student.grade || '-'}</p>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>?íƒœ</label>
            <p style={{ fontSize: 'var(--font-size-base)' }}>
              {student.status === 'active' ? '?¬ì›' : student.status === 'on_leave' ? '?´ì›' : student.status === 'withdrawn' ? '?´ì›' : 'ì¡¸ì—…'}
            </p>
          </div>
          {student.notes && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>ë¹„ê³ </label>
              <p style={{ fontSize: 'var(--font-size-base)' }}>{student.notes}</p>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // ?˜ì • ëª¨ë“œ: SchemaForm ?¬ìš©
  const handleSubmit = async (data: any) => {
    // ?¤í‚¤ë§ˆì—??ë°›ì? ?°ì´?°ë? UpdateStudentInput ?•ì‹?¼ë¡œ ë³€??
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

  // ?˜ì • ëª¨ë“œë¥??„í•œ ?¤í‚¤ë§?(submit ë²„íŠ¼ ì»¤ìŠ¤?°ë§ˆ?´ì§•)
  const editSchema = {
    ...studentFormSchema,
    form: {
      ...studentFormSchema.form,
      submit: {
        label: '?€??,
        variant: 'solid' as const,
        color: 'primary' as const,
        size: 'md' as const,
      },
    },
  };

  return (
    <Card padding="md" variant="default">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>?™ìƒ ?•ë³´ ?˜ì •</h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          ì·¨ì†Œ
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

// ?™ë?ëª???ì»´í¬?ŒíŠ¸
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
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>ë¡œë”© ì¤?..</div>;
  }

  return (
    <div>
      {!showForm && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <Button variant="solid" onClick={onShowForm}>
            ?™ë?ëª?ì¶”ê?
          </Button>
        </div>
      )}

      {showForm && (
        <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-md)' }}>{editingGuardianId ? '?™ë?ëª??˜ì •' : '?™ë?ëª?ì¶”ê?'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>?´ë¦„ *</label>
                <Input
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                  fullWidth
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>ê´€ê³?*</label>
                <Select
                  value={formData.relationship}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, relationship: e.target.value as GuardianRelationship })}
                  fullWidth
                  required
                >
                  <option value="parent">ë¶€ëª?/option>
                  <option value="guardian">ë³´í˜¸??/option>
                  <option value="other">ê¸°í?</option>
                </Select>
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>?„í™”ë²ˆí˜¸ *</label>
                <Input
                  value={formData.phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, phone: e.target.value })}
                  fullWidth
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>?´ë©”??/label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                  fullWidth
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_primary}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, is_primary: e.target.checked })}
                  />
                  ì£?ë³´í˜¸??
                </label>
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>ë¹„ê³ </label>
                <Textarea
                  value={formData.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, notes: e.target.value })}
                  fullWidth
                  rows={3}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                <Button type="button" variant="outline" onClick={onHideForm}>
                  ì·¨ì†Œ
                </Button>
                <Button type="submit" variant="solid">
                  {editingGuardianId ? '?˜ì •' : 'ì¶”ê?'}
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
                      ì£?ë³´í˜¸??
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  {guardian.relationship === 'parent' ? 'ë¶€ëª? : guardian.relationship === 'guardian' ? 'ë³´í˜¸?? : 'ê¸°í?'}
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
                  ?˜ì •
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(guardian.id)}>
                  ?? œ
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {guardians.length === 0 && !showForm && (
          <Card padding="md" variant="outlined">
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>?±ë¡???™ë?ëª¨ê? ?†ìŠµ?ˆë‹¤.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

// ?ë‹´?¼ì? ??ì»´í¬?ŒíŠ¸
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
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>ë¡œë”© ì¤?..</div>;
  }

  return (
    <div>
      {!showForm && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <Button variant="solid" onClick={onShowForm}>
            ?ë‹´?¼ì? ì¶”ê?
          </Button>
        </div>
      )}

      {showForm && (
        <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-md)' }}>{editingConsultationId ? '?ë‹´?¼ì? ?˜ì •' : '?ë‹´?¼ì? ì¶”ê?'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>?ë‹´?¼ì *</label>
                <Input
                  type="date"
                  value={formData.consultation_date}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, consultation_date: e.target.value })}
                  fullWidth
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>?ë‹´ ? í˜• *</label>
                <Select
                  value={formData.consultation_type}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, consultation_type: e.target.value as ConsultationType })}
                  fullWidth
                  required
                >
                  <option value="counseling">?ë‹´</option>
                  <option value="learning">?™ìŠµ</option>
                  <option value="behavior">?‰ë™</option>
                  <option value="other">ê¸°í?</option>
                </Select>
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>?ë‹´ ?´ìš© *</label>
                <Textarea
                  value={formData.content}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, content: e.target.value })}
                  fullWidth
                  rows={8}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                <Button type="button" variant="outline" onClick={onHideForm}>
                  ì·¨ì†Œ
                </Button>
                <Button type="submit" variant="solid">
                  {editingConsultationId ? '?˜ì •' : 'ì¶”ê?'}
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
                    {consultation.consultation_type === 'counseling' ? '?ë‹´' : consultation.consultation_type === 'learning' ? '?™ìŠµ' : consultation.consultation_type === 'behavior' ? '?‰ë™' : 'ê¸°í?'}
                  </span>
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
                  {consultation.content}
                </p>
                {consultation.ai_summary && (
                  <div style={{ marginTop: 'var(--spacing-sm)', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-blue-50)', borderRadius: '4px' }}>
                    <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>AI ?”ì•½</p>
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
                      ?¤– AI ?”ì•½ ?ì„±
                    </Button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <Button variant="ghost" size="sm" onClick={() => onEdit(consultation.id)}>
                  ?˜ì •
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(consultation.id)}>
                  ?? œ
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {consultations.length === 0 && !showForm && (
          <Card padding="md" variant="outlined">
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>?±ë¡???ë‹´?¼ì?ê°€ ?†ìŠµ?ˆë‹¤.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

// ?œê·¸ ??ì»´í¬?ŒíŠ¸
interface TagsTabProps {
  studentTags: Array<{ id: string; name: string; color: string }>;
  isLoading: boolean;
  studentId: string;
  onUpdateTags: (tagIds: string[]) => Promise<void>;
}

function TagsTab({ studentTags, isLoading, studentId, onUpdateTags }: TagsTabProps) {
  // TODO: ?„ì²´ ?œê·¸ ëª©ë¡ ì¡°íšŒ ë°??œê·¸ ? íƒ UI êµ¬í˜„
  // ?„ì¬??ê°„ë‹¨???œì‹œë§???
  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>ë¡œë”© ì¤?..</div>;
  }

  return (
    <Card padding="md" variant="default">
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
        ?œê·¸ ê´€ë¦?ê¸°ëŠ¥?€ ì¶”í›„ êµ¬í˜„ ?ˆì •?…ë‹ˆ??
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

// ë°?ë°°ì • ??ì»´í¬?ŒíŠ¸
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

  // ?´ë? ë°°ì •??ë°?ID ëª©ë¡
  const assignedClassIds = studentClasses
    .filter((sc) => sc.is_active)
    .map((sc) => sc.class_id);

  // ë°°ì • ê°€?¥í•œ ë°?ëª©ë¡ (?œì„± ?íƒœ?´ê³  ?„ì§ ë°°ì •?˜ì? ?Šì? ë°?
  const availableClasses = allClasses.filter(
    (c) => c.status === 'active' && !assignedClassIds.includes(c.id)
  );

  const DAYS_OF_WEEK: { value: string; label: string }[] = [
    { value: 'monday', label: '?”ìš”?? },
    { value: 'tuesday', label: '?”ìš”?? },
    { value: 'wednesday', label: '?˜ìš”?? },
    { value: 'thursday', label: 'ëª©ìš”?? },
    { value: 'friday', label: 'ê¸ˆìš”?? },
    { value: 'saturday', label: '? ìš”?? },
    { value: 'sunday', label: '?¼ìš”?? },
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
      alert('ë°?ë°°ì •???¤íŒ¨?ˆìŠµ?ˆë‹¤.');
    }
  };

  const handleUnassign = async (classId: string) => {
    if (!confirm('?•ë§ ??ë°˜ì—???œì™¸?˜ì‹œê² ìŠµ?ˆê¹Œ?')) return;

    try {
      await onUnassign(classId, new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Failed to unassign class:', error);
      alert('ë°??œì™¸???¤íŒ¨?ˆìŠµ?ˆë‹¤.');
    }
  };

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>ë¡œë”© ì¤?..</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <Button
          variant="solid"
          onClick={() => setShowAssignForm(!showAssignForm)}
          disabled={availableClasses.length === 0}
        >
          ë°?ë°°ì •
        </Button>
        {availableClasses.length === 0 && (
          <span style={{ marginLeft: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            ë°°ì • ê°€?¥í•œ ë°˜ì´ ?†ìŠµ?ˆë‹¤.
          </span>
        )}
      </div>

      {showAssignForm && (
        <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-md)' }}>ë°?ë°°ì •</h3>
          <form onSubmit={handleAssign}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <Select
                label="ë°?? íƒ"
                value={selectedClassId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedClassId(e.target.value)}
                required
                fullWidth
              >
                <option value="">ë°˜ì„ ? íƒ?˜ì„¸??/option>
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
                label="ë°°ì •??
                type="date"
                value={enrolledAt}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnrolledAt(e.target.value)}
                required
                fullWidth
              />

              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                <Button type="button" variant="outline" onClick={() => setShowAssignForm(false)}>
                  ì·¨ì†Œ
                </Button>
                <Button type="submit" variant="solid">
                  ë°°ì •
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
                      {classItem.subject && <div>ê³¼ëª©: {classItem.subject}</div>}
                      {classItem.grade && <div>?€?? {classItem.grade}</div>}
                      <div>?”ì¼: {dayLabel}</div>
                      <div>?œê°„: {classItem.start_time} ~ {classItem.end_time}</div>
                      {classItem.room && <div>ê°•ì˜?? {classItem.room}</div>}
                      <div>ë°°ì •?? {studentClass.enrolled_at}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnassign(classItem.id)}
                  >
                    ?œì™¸
                  </Button>
                </div>
              </Card>
            );
          })}
        {studentClasses.filter((sc) => sc.is_active && sc.class).length === 0 && (
          <Card padding="md" variant="outlined">
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              ë°°ì •??ë°˜ì´ ?†ìŠµ?ˆë‹¤.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

