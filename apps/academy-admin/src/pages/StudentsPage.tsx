/**
 * 학생 관리 페이지
 * 
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 */

import { useState } from 'react';
import { ErrorBoundary } from '@ui-core/react';
import { Container, Grid, Card, Button, Input } from '@ui-core/react';
import { useStudents, useStudentTags } from '@hooks/use-student';
import type { StudentFilter, StudentStatus } from '@services/student-service';

// 임시: 실제로는 인증 시스템에서 가져옴
const MOCK_TENANT_ID = '00000000-0000-0000-0000-000000000000';
const MOCK_INDUSTRY_TYPE = 'academy';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';

export function StudentsPage() {
  const [filter, setFilter] = useState<StudentFilter>({});
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: students, isLoading, error } = useStudents(
    {
      tenantId: MOCK_TENANT_ID,
      industryType: MOCK_INDUSTRY_TYPE,
      userId: MOCK_USER_ID,
    },
    { ...filter, search: searchQuery }
  );

  const { data: tags } = useStudentTags({
    tenantId: MOCK_TENANT_ID,
    industryType: MOCK_INDUSTRY_TYPE,
  });

  const handleStatusFilter = (status: StudentStatus | 'all') => {
    setFilter((prev) => ({
      ...prev,
      status: status === 'all' ? undefined : status,
    }));
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-4">학생 관리</h1>

          {/* 검색 및 필터 패널 */}
          <Card padding="md" className="mb-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* 검색 */}
              <div className="flex-1">
                <Input
                  placeholder="학생 이름 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  fullWidth
                />
              </div>

              {/* 상태 필터 */}
              <div className="flex gap-2">
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
              <div className="flex gap-2">
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
          {isLoading && <div>로딩 중...</div>}
          {error && <div className="text-red-500">오류: {error.message}</div>}
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
  student: any; // Student 타입
  tags: any[]; // StudentTag 타입
}

function StudentCard({ student, tags }: StudentCardProps) {
  // TODO: 실제 태그 연결 조회
  const studentTags: any[] = [];

  return (
    <Card variant="elevated" padding="md" className="hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-semibold">{student.name}</h3>
        <span
          className={`px-2 py-1 text-xs rounded ${
            student.status === 'active'
              ? 'bg-green-100 text-green-800'
              : student.status === 'on_leave'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {student.status === 'active'
            ? '재원'
            : student.status === 'on_leave'
            ? '휴원'
            : '퇴원'}
        </span>
      </div>

      {student.grade && (
        <p className="text-sm text-gray-600 mb-2">학년: {student.grade}</p>
      )}

      {studentTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {studentTags.map((tag) => (
            <span
              key={tag.id}
              className="px-2 py-1 text-xs rounded text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <Button variant="outline" size="sm" className="flex-1">
          상세
        </Button>
        <Button variant="outline" size="sm" className="flex-1">
          수정
        </Button>
      </div>
    </Card>
  );
}

