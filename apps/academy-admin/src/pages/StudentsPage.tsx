/**
 * 학생 관리 페이지
 * 
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@ui-core/react';
import { Container, Grid, Card, Button, Input, Textarea, Select } from '@ui-core/react';
import { useStudents, useStudentTags, useStudentTagsByStudent, useCreateStudent, useBulkCreateStudents } from '@hooks/use-student';
import type { StudentFilter, StudentStatus, Student, CreateStudentInput } from '@services/student-service';
import type { Tag } from '@core/tags';
// xlsx는 동적 import로 로드 (필요할 때만)

export function StudentsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<StudentFilter>({});
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
  const { data: students, isLoading, error } = useStudents({
    ...filter,
    search: searchQuery.trim() || undefined, // 빈 문자열은 undefined로 변환
  });

  const { data: tags } = useStudentTags();
  const createStudent = useCreateStudent();
  const bulkCreateStudents = useBulkCreateStudents();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStatusFilter = (status: StudentStatus | 'all') => {
    setFilter((prev: StudentFilter) => ({
      ...prev,
      status: status === 'all' ? undefined : status,
    }));
  };

  const handleGradeFilter = (grade: string) => {
    setFilter((prev: StudentFilter) => ({
      ...prev,
      grade: grade === 'all' ? undefined : grade,
    }));
  };

  const handleTagFilter = (tagId: string) => {
    setFilter((prev: StudentFilter) => {
      const currentTagIds = prev.tag_ids || [];
      const newTagIds = currentTagIds.includes(tagId)
        ? currentTagIds.filter((id) => id !== tagId)
        : [...currentTagIds, tagId];
      return {
        ...prev,
        tag_ids: newTagIds.length > 0 ? newTagIds : undefined,
      };
    });
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h1 style={{ 
            fontSize: 'var(--font-size-2xl)', 
            fontWeight: 'var(--font-weight-bold)', 
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-text)'
          }}>
            학생 관리
          </h1>

          {/* 검색 및 필터 패널 */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {/* 검색 */}
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="학생 이름 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  fullWidth
                />
              </div>

              {/* 상태 필터 */}
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
                  재원
                </Button>
                <Button
                  variant={filter.status === 'on_leave' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusFilter('on_leave')}
                >
                  휴원
                </Button>
                <Button
                  variant={filter.status === 'withdrawn' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusFilter('withdrawn')}
                >
                  퇴원
                </Button>
              </div>

              {/* 뷰 모드 전환 */}
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <Button
                  variant={viewMode === 'card' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('card')}
                >
                  카드
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                >
                  테이블
                </Button>
              </div>

              {/* 학생 등록 버튼 */}
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <Button variant="solid" color="primary" onClick={() => setShowCreateForm(true)}>
                  학생 등록
                </Button>
                <Button 
                  variant="outline" 
                  color="primary" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={bulkCreateStudents.isPending}
                >
                  {bulkCreateStudents.isPending ? '등록 중...' : '📄 엑셀 일괄 등록'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    try {
                      // xlsx 모듈 동적 로드
                      const XLSX = await import('xlsx');
                      
                      // 엑셀 파일 읽기
                      const arrayBuffer = await file.arrayBuffer();
                      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                      const sheetName = workbook.SheetNames[0];
                      const worksheet = workbook.Sheets[sheetName];
                      
                      // JSON으로 변환
                      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
                      
                      // CreateStudentInput 형식으로 변환
                      const students: CreateStudentInput[] = jsonData.map((row: any) => ({
                        name: row['이름'] || row['name'] || '',
                        birth_date: row['생년월일'] || row['birth_date'] || '',
                        gender: (row['성별'] || row['gender'] || undefined) as any,
                        phone: row['전화번호'] || row['phone'] || '',
                        email: row['이메일'] || row['email'] || '',
                        address: row['주소'] || row['address'] || '',
                        school_name: row['학교'] || row['school_name'] || '',
                        grade: row['학년'] || row['grade'] || '',
                        status: (row['상태'] || row['status'] || 'active') as StudentStatus,
                        notes: row['비고'] || row['notes'] || '',
                      })).filter((s) => s.name.trim() !== ''); // 이름이 있는 경우만

                      if (students.length === 0) {
                        alert('등록할 학생 데이터가 없습니다.');
                        return;
                      }

                      // 일괄 등록 실행
                      const result = await bulkCreateStudents.mutateAsync(students);
                      
                      if (result.errors && result.errors.length > 0) {
                        alert(`${result.results.length}명 등록 완료, ${result.errors.length}명 실패`);
                      } else {
                        alert(`${result.results.length}명 등록 완료`);
                      }

                      // 파일 입력 초기화
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    } catch (error) {
                      console.error('엑셀 일괄 등록 실패:', error);
                      alert('엑셀 일괄 등록에 실패했습니다.');
                    }
                  }}
                />
              </div>
            </div>
          </Card>

          {/* 학년 필터 */}
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)' }}>
            <Button
              variant={!filter.grade ? 'solid' : 'outline'}
              size="sm"
              onClick={() => handleGradeFilter('all')}
            >
              전체 학년
            </Button>
            {['1학년', '2학년', '3학년', '중1', '중2', '중3', '고1', '고2', '고3'].map((grade) => (
              <Button
                key={grade}
                variant={filter.grade === grade ? 'solid' : 'outline'}
                size="sm"
                onClick={() => handleGradeFilter(grade)}
              >
                {grade}
              </Button>
            ))}
          </div>

          {/* 태그 필터 */}
          {tags && tags.length > 0 && (
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)' }}>
              {tags.map((tag: { id: string; name: string; color: string }) => (
                <Button
                  key={tag.id}
                  variant={filter.tag_ids?.includes(tag.id) ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleTagFilter(tag.id)}
                  style={{
                    backgroundColor: filter.tag_ids?.includes(tag.id) ? tag.color : undefined,
                    color: filter.tag_ids?.includes(tag.id) ? '#ffffff' : undefined,
                  }}
                >
                  {tag.name}
                </Button>
              ))}
            </div>
          )}

          {/* 학생 등록 폼 */}
          {showCreateForm && (
            <CreateStudentForm
              onClose={() => setShowCreateForm(false)}
              onSubmit={async (data) => {
                await createStudent.mutateAsync(data);
                setShowCreateForm(false);
              }}
            />
          )}

          {/* 학생 목록 */}
          {isLoading && (
            <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              로딩 중...
            </div>
          )}
          {error && (
            <Card padding="md" variant="outlined">
              <div style={{ color: '#ef4444' }}>오류: {error.message}</div>
            </Card>
          )}
          {students && (
            <Grid columns={viewMode === 'card' ? 3 : 1} gap="md">
              {students.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  tags={tags || []}
                  onDetailClick={() => navigate(`/students/${student.id}`)}
                />
              ))}
            </Grid>
          )}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

interface StudentCardProps {
  student: Student;
  tags: Tag[];
  onDetailClick: () => void;
}

function StudentCard({ student, tags, onDetailClick }: StudentCardProps) {
  const { data: studentTags } = useStudentTagsByStudent(student.id);
  const displayedTags = studentTags || [];

  const statusConfig = {
    active: { label: '재원', bgColor: 'var(--color-green-100)', textColor: 'var(--color-green-800)' },
    on_leave: { label: '휴원', bgColor: 'var(--color-yellow-100)', textColor: 'var(--color-yellow-800)' },
    withdrawn: { label: '퇴원', bgColor: 'var(--color-gray-100)', textColor: 'var(--color-gray-800)' },
  };

  const status = student.status as keyof typeof statusConfig;
  const statusInfo = statusConfig[status] || statusConfig.withdrawn;

  return (
    <Card 
      variant="elevated" 
      padding="md"
      style={{ cursor: 'pointer', transition: 'box-shadow 0.3s ease-in-out' }}
      onClick={onDetailClick}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>{student.name}</h3>
        <span
          style={{
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            fontSize: 'var(--font-size-xs)',
            borderRadius: '0.25rem',
            backgroundColor: statusInfo.bgColor,
            color: statusInfo.textColor,
          }}
        >
          {statusInfo.label}
        </span>
      </div>

      {student.grade && (
        <p style={{ 
          fontSize: '0.875rem', 
          color: 'var(--color-text-secondary)', 
          marginBottom: 'var(--spacing-sm)'
        }}>
          학년: {student.grade}
        </p>
      )}

      {(studentTags || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-sm)' }}>
          {(studentTags || []).map((tag: { id: string; name: string; color: string }) => (
            <span
              key={tag.id}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                fontSize: '0.75rem',
                borderRadius: '0.25rem',
                color: '#ffffff',
                backgroundColor: tag.color,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <Grid columns={2} gap="sm" style={{ marginTop: 'var(--spacing-md)' }}>
        <Button variant="outline" size="sm" fullWidth onClick={(e) => { e.stopPropagation(); onDetailClick(); }}>
          상세
        </Button>
        <Button variant="outline" size="sm" fullWidth onClick={(e) => { e.stopPropagation(); onDetailClick(); }}>
          수정
        </Button>
      </Grid>
    </Card>
  );
}

// 학생 등록 폼 컴포넌트
interface CreateStudentFormProps {
  onClose: () => void;
  onSubmit: (data: CreateStudentInput) => Promise<void>;
}

function CreateStudentForm({ onClose, onSubmit }: CreateStudentFormProps) {
  const [formData, setFormData] = useState<CreateStudentInput>({
    name: '',
    birth_date: '',
    gender: undefined,
    phone: '',
    email: '',
    address: '',
    school_name: '',
    grade: '',
    status: 'active',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>학생 등록</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          닫기
        </Button>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-md)' }}>
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
              value={formData.gender || ''}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value as any || undefined })}
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
        <div style={{ marginTop: 'var(--spacing-md)' }}>
          <label style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>비고</label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            fullWidth
            rows={3}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            취소
          </Button>
          <Button type="submit" variant="solid" disabled={isSubmitting}>
            {isSubmitting ? '등록 중...' : '등록'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

