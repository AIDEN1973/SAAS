/**
 * 학생 관리 페이지
 * 
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

import { useState } from 'react';
import { ErrorBoundary } from '@ui-core/react';
import { Container, Grid, Card, Button, Input } from '@ui-core/react';
import { useStudents, useStudentTags } from '@hooks/use-student';
import type { StudentFilter, StudentStatus, Student } from '@services/student-service';
import type { Tag } from '@core/tags';

export function StudentsPage() {
  const [filter, setFilter] = useState<StudentFilter>({});
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [searchQuery, setSearchQuery] = useState('');

  // [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
  const { data: students, isLoading, error } = useStudents({
    ...filter,
    search: searchQuery,
  });

  const { data: tags } = useStudentTags();

  const handleStatusFilter = (status: StudentStatus | 'all') => {
    setFilter((prev: StudentFilter) => ({
      ...prev,
      status: status === 'all' ? undefined : status,
    }));
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
              <Button variant="solid" color="primary">
                학생 등록
              </Button>
            </div>
          </Card>

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
                <StudentCard key={student.id} student={student} tags={tags || []} />
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
}

function StudentCard({ student, tags }: StudentCardProps) {
  // TODO: 실제 태그 연결 조회 (useStudentTagsByStudent hook 사용)
  // 현재는 전체 태그 목록만 받아서 필터링 필요
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const studentTags: Tag[] = tags.filter((_tag: Tag) => 
    // TODO: student.id와 연결된 태그만 필터링
    false // 임시로 태그 표시 안 함 (태그 연결 로직 구현 필요)
  );

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
      onClick={() => { /* TODO: 상세 페이지로 이동 */ }}
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

      {studentTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-sm)' }}>
          {studentTags.map((tag) => (
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
        <Button variant="outline" size="sm" fullWidth>
          상세
        </Button>
        <Button variant="outline" size="sm" fullWidth>
          수정
        </Button>
      </Grid>
    </Card>
  );
}

