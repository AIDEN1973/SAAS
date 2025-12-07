/**
 * ê°•ì‚¬ ê´€ë¦??˜ì´ì§€
 * 
 * [ë¶ˆë? ê·œì¹™] api-sdkë¥??µí•´?œë§Œ ?°ì´???”ì²­
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: UI??tenantIdë¥?ì§ì ‘ ?„ë‹¬?˜ì? ?ŠìŒ, Context?ì„œ ?ë™ ê°€?¸ì˜´
 * [?”êµ¬?¬í•­] ê°•ì‚¬ ?„ë¡œ???œì‹œ
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@ui-core/react';
import { Container, Card, Button, Input } from '@ui-core/react';
import { SchemaForm } from '@schema/engine';
import {
  useTeachers,
  useTeacher,
  useCreateTeacher,
  useUpdateTeacher,
  useDeleteTeacher,
} from '@hooks/use-class';
import type { Teacher, CreateTeacherInput, TeacherFilter, TeacherStatus } from '@services/class-service';
import { teacherFormSchema } from '../schemas/teacher.schema';

export function TeachersPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<TeacherFilter>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: teachers, isLoading, error } = useTeachers({
    ...filter,
    search: searchQuery.trim() || undefined, // ë¹?ë¬¸ì?´ì? undefinedë¡?ë³€??
  });
  const createTeacher = useCreateTeacher();
  const updateTeacher = useUpdateTeacher();
  const deleteTeacher = useDeleteTeacher();

  const handleStatusFilter = (status: TeacherStatus | 'all') => {
    setFilter((prev) => ({
      ...prev,
      status: status === 'all' ? undefined : status,
    }));
  };

  const handleCreateTeacher = async (input: CreateTeacherInput) => {
    try {
      await createTeacher.mutateAsync(input);
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create teacher:', error);
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
              ê°•ì‚¬ ê´€ë¦?
            </h1>
            <Button
              variant="solid"
              size="sm"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              ê°•ì‚¬ ?±ë¡
            </Button>
          </div>

          {/* ê²€??ë°??„í„° ?¨ë„ */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="ê°•ì‚¬ ?´ë¦„ ê²€??.."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  fullWidth
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                <Button
                  variant={!filter.status ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusFilter('all')}
                >
                  ?„ì²´
                </Button>
                <Button
                  variant={filter.status === 'active' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusFilter('active')}
                >
                  ?¬ì§ì¤?
                </Button>
                <Button
                  variant={filter.status === 'on_leave' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusFilter('on_leave')}
                >
                  ?´ì§
                </Button>
                <Button
                  variant={filter.status === 'resigned' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusFilter('resigned')}
                >
                  ?´ì§
                </Button>
              </div>
            </div>
          </Card>

          {/* ê°•ì‚¬ ?±ë¡ ??*/}
          {showCreateForm && (
            <CreateTeacherForm
              onSubmit={handleCreateTeacher}
              onCancel={() => setShowCreateForm(false)}
            />
          )}

          {/* ê°•ì‚¬ ëª©ë¡ */}
          {isLoading ? (
            <div>ë¡œë”© ì¤?..</div>
          ) : error ? (
            <div>?¤ë¥˜: {error.message}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--spacing-md)' }}>
              {teachers?.map((teacher) => (
                <TeacherCard
                  key={teacher.id}
                  teacher={teacher}
                  onEdit={(teacherId) => navigate(`/teachers/${teacherId}`)}
                  onDelete={async (teacherId) => {
                    if (confirm('?•ë§ ??ê°•ì‚¬ë¥??? œ?˜ì‹œê² ìŠµ?ˆê¹Œ?')) {
                      await deleteTeacher.mutateAsync(teacherId);
                    }
                  }}
                />
              ))}
              {teachers?.length === 0 && (
                <Card padding="lg" variant="default">
                  <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    ?±ë¡??ê°•ì‚¬ê°€ ?†ìŠµ?ˆë‹¤.
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

/**
 * ê°•ì‚¬ ?±ë¡ ??
 */
function CreateTeacherForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: CreateTeacherInput) => void;
  onCancel: () => void;
}) {
  const handleSubmit = async (data: any) => {
    // ?¤í‚¤ë§ˆì—??ë°›ì? ?°ì´?°ë? CreateTeacherInput ?•ì‹?¼ë¡œ ë³€??
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
    <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>ê°•ì‚¬ ?±ë¡</h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          ì·¨ì†Œ
        </Button>
      </div>
      <SchemaForm
        schema={teacherFormSchema}
        onSubmit={handleSubmit}
        defaultValues={{
          status: 'active',
        }}
      />
    </Card>
  );
}

/**
 * ê°•ì‚¬ ì¹´ë“œ (?„ë¡œ???œì‹œ)
 * [?”êµ¬?¬í•­] ê°•ì‚¬ ?„ë¡œ???œì‹œ
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
    active: '?¬ì§ì¤?,
    on_leave: '?´ì§',
    resigned: '?´ì§',
  };

  const statusColors: Record<TeacherStatus, string> = {
    active: '#10b981',
    on_leave: '#f59e0b',
    resigned: '#ef4444',
  };

  return (
    <Card
      padding="md"
      variant="default"
      style={{
        borderLeft: `4px solid ${statusColors[teacher.status]}`,
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
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: `${statusColors[teacher.status]}20`,
                color: statusColors[teacher.status],
              }}
            >
              {statusLabels[teacher.status]}
            </span>
          </div>
          {teacher.employee_id && (
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              ?¬ì›ë²ˆí˜¸: {teacher.employee_id}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
          <Button size="xs" variant="ghost" onClick={() => onEdit(teacher.id)}>
            ?˜ì •
          </Button>
          <Button size="xs" variant="ghost" onClick={() => onDelete(teacher.id)}>
            ?? œ
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
              borderRadius: 'var(--radius-md)',
            }}
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
        {teacher.specialization && <div>?„ë¬¸ ë¶„ì•¼: {teacher.specialization}</div>}
        {teacher.phone && <div>?„í™”: {teacher.phone}</div>}
        {teacher.email && <div>?´ë©”?? {teacher.email}</div>}
        {teacher.hire_date && <div>?…ì‚¬?? {teacher.hire_date}</div>}
        {teacher.bio && (
          <div style={{ marginTop: 'var(--spacing-xs)', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
            {teacher.bio}
          </div>
        )}
      </div>
    </Card>
  );
}

