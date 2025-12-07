/**
 * 강사 관리 페이지
 * 
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 강사 프로필 표시
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@ui-core/react';
import { Container, Card, Button, Input, Textarea } from '@ui-core/react';
import {
  useTeachers,
  useTeacher,
  useCreateTeacher,
  useUpdateTeacher,
  useDeleteTeacher,
} from '@hooks/use-class';
import type { Teacher, CreateTeacherInput, TeacherFilter, TeacherStatus } from '@services/class-service';

export function TeachersPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<TeacherFilter>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: teachers, isLoading, error } = useTeachers({
    ...filter,
    search: searchQuery.trim() || undefined, // 빈 문자열은 undefined로 변환
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
              강사 관리
            </h1>
            <Button
              variant="solid"
              size="sm"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              강사 등록
            </Button>
          </div>

          {/* 검색 및 필터 패널 */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="강사 이름 검색..."
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
                  전체
                </Button>
                <Button
                  variant={filter.status === 'active' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusFilter('active')}
                >
                  재직중
                </Button>
                <Button
                  variant={filter.status === 'on_leave' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusFilter('on_leave')}
                >
                  휴직
                </Button>
                <Button
                  variant={filter.status === 'resigned' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusFilter('resigned')}
                >
                  퇴직
                </Button>
              </div>
            </div>
          </Card>

          {/* 강사 등록 폼 */}
          {showCreateForm && (
            <CreateTeacherForm
              onSubmit={handleCreateTeacher}
              onCancel={() => setShowCreateForm(false)}
            />
          )}

          {/* 강사 목록 */}
          {isLoading ? (
            <div>로딩 중...</div>
          ) : error ? (
            <div>오류: {error.message}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--spacing-md)' }}>
              {teachers?.map((teacher) => (
                <TeacherCard
                  key={teacher.id}
                  teacher={teacher}
                  onEdit={(teacherId) => navigate(`/teachers/${teacherId}`)}
                  onDelete={async (teacherId) => {
                    if (confirm('정말 이 강사를 삭제하시겠습니까?')) {
                      await deleteTeacher.mutateAsync(teacherId);
                    }
                  }}
                />
              ))}
              {teachers?.length === 0 && (
                <Card padding="lg" variant="default">
                  <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    등록된 강사가 없습니다.
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
 * 강사 등록 폼
 */
function CreateTeacherForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: CreateTeacherInput) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<CreateTeacherInput>({
    name: '',
    email: '',
    phone: '',
    address: '',
    employee_id: '',
    specialization: '',
    hire_date: '',
    status: 'active',
    profile_image_url: '',
    bio: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>강사 등록</h3>

        <Input
          label="이름"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          fullWidth
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
          <Input
            label="이메일"
            type="email"
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            fullWidth
          />
          <Input
            label="전화번호"
            value={formData.phone || ''}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            fullWidth
          />
        </div>

        <Input
          label="주소"
          value={formData.address || ''}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          fullWidth
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
          <Input
            label="사원번호"
            value={formData.employee_id || ''}
            onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
            fullWidth
          />
          <Input
            label="전문 분야"
            value={formData.specialization || ''}
            onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
            fullWidth
          />
          <Input
            label="입사일"
            type="date"
            value={formData.hire_date || ''}
            onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
            fullWidth
          />
        </div>

        <Textarea
          label="강사 소개"
          value={formData.bio || ''}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          rows={3}
          fullWidth
        />

        <Textarea
          label="비고"
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
          fullWidth
        />

        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
          <Button type="button" variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button type="submit" variant="solid">
            등록
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * 강사 카드 (프로필 표시)
 * [요구사항] 강사 프로필 표시
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
    active: '재직중',
    on_leave: '휴직',
    resigned: '퇴직',
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
              사원번호: {teacher.employee_id}
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
        {teacher.specialization && <div>전문 분야: {teacher.specialization}</div>}
        {teacher.phone && <div>전화: {teacher.phone}</div>}
        {teacher.email && <div>이메일: {teacher.email}</div>}
        {teacher.hire_date && <div>입사일: {teacher.hire_date}</div>}
        {teacher.bio && (
          <div style={{ marginTop: 'var(--spacing-xs)', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
            {teacher.bio}
          </div>
        )}
      </div>
    </Card>
  );
}

