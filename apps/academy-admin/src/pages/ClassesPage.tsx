/**
 * 반 관리 페이지
 * 
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 반 리스트 + 캘린더 뷰, 반 편성표(Calendar-like) 제공
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@ui-core/react';
import { Container, Card, Button, Input, Select } from '@ui-core/react';
import {
  useClasses,
  useCreateClass,
  useUpdateClass,
  useDeleteClass,
  useClassStatistics,
  useTeachers,
} from '@hooks/use-class';
import type { Class, CreateClassInput, ClassFilter, ClassStatus, DayOfWeek } from '@services/class-service';

const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: '월요일' },
  { value: 'tuesday', label: '화요일' },
  { value: 'wednesday', label: '수요일' },
  { value: 'thursday', label: '목요일' },
  { value: 'friday', label: '금요일' },
  { value: 'saturday', label: '토요일' },
  { value: 'sunday', label: '일요일' },
];

export function ClassesPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filter, setFilter] = useState<ClassFilter>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: classes, isLoading, error } = useClasses({
    ...filter,
    search: searchQuery.trim() || undefined, // 빈 문자열은 undefined로 변환
  });
  const { data: teachers } = useTeachers();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();

  const handleStatusFilter = (status: ClassStatus | 'all') => {
    setFilter((prev) => ({
      ...prev,
      status: status === 'all' ? undefined : status,
    }));
  };

  const handleDayFilter = (day: DayOfWeek | 'all') => {
    setFilter((prev) => ({
      ...prev,
      day_of_week: day === 'all' ? undefined : day,
    }));
  };

  const handleCreateClass = async (input: CreateClassInput) => {
    try {
      await createClass.mutateAsync(input);
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create class:', error);
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
              반 관리
            </h1>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <Button
                variant={viewMode === 'list' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                리스트
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setViewMode('calendar')}
              >
                캘린더
              </Button>
              <Button
                variant="solid"
                size="sm"
                onClick={() => setShowCreateForm(!showCreateForm)}
              >
                반 생성
              </Button>
            </div>
          </div>

          {/* 검색 및 필터 패널 */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="반 이름 검색..."
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
                  운영중
                </Button>
                <Button
                  variant={filter.status === 'inactive' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusFilter('inactive')}
                >
                  비활성
                </Button>
              </div>

              <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                <Button
                  variant={!filter.day_of_week ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleDayFilter('all')}
                >
                  전체 요일
                </Button>
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day.value}
                    variant={filter.day_of_week === day.value ? 'solid' : 'outline'}
                    size="sm"
                    onClick={() => handleDayFilter(day.value)}
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          {/* 반 생성 폼 */}
          {showCreateForm && (
            <CreateClassForm
              teachers={teachers || []}
              onSubmit={handleCreateClass}
              onCancel={() => setShowCreateForm(false)}
            />
          )}

          {/* 반 목록 또는 캘린더 뷰 */}
          {isLoading ? (
            <div>로딩 중...</div>
          ) : error ? (
            <div>오류: {error.message}</div>
          ) : viewMode === 'list' ? (
            <ClassListView
              classes={classes || []}
              onEdit={(classId) => navigate(`/classes/${classId}`)}
              onDelete={async (classId) => {
                if (confirm('정말 이 반을 삭제하시겠습니까?')) {
                  await deleteClass.mutateAsync(classId);
                }
              }}
            />
          ) : (
            <ClassCalendarView classes={classes || []} />
          )}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

/**
 * 반 생성 폼
 */
function CreateClassForm({
  teachers,
  onSubmit,
  onCancel,
}: {
  teachers: any[];
  onSubmit: (input: CreateClassInput) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<CreateClassInput>({
    name: '',
    subject: '',
    grade: '',
    day_of_week: 'monday',
    start_time: '14:00',
    end_time: '15:30',
    capacity: 20,
    room: '',
    notes: '',
    status: 'active',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>반 생성</h3>
        
        <Input
          label="반 이름"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          fullWidth
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
          <Input
            label="과목"
            value={formData.subject || ''}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            fullWidth
          />
          <Input
            label="대상 학년"
            value={formData.grade || ''}
            onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
            fullWidth
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
          <Select
            label="요일"
            value={formData.day_of_week}
            onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value as DayOfWeek })}
            required
            fullWidth
          >
            {DAYS_OF_WEEK.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </Select>
          <Input
            label="시작 시간"
            type="time"
            value={formData.start_time}
            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
            required
            fullWidth
          />
          <Input
            label="종료 시간"
            type="time"
            value={formData.end_time}
            onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
            required
            fullWidth
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
          <Input
            label="정원"
            type="number"
            value={formData.capacity}
            onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 20 })}
            required
            fullWidth
          />
          <Input
            label="강의실"
            value={formData.room || ''}
            onChange={(e) => setFormData({ ...formData, room: e.target.value })}
            fullWidth
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
          <Button type="button" variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button type="submit" variant="solid">
            생성
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * 반 리스트 뷰
 */
function ClassListView({
  classes,
  onEdit,
  onDelete,
}: {
  classes: Class[];
  onEdit: (classId: string) => void;
  onDelete: (classId: string) => Promise<void>;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--spacing-md)' }}>
      {classes.map((classItem) => (
        <ClassCard key={classItem.id} classItem={classItem} onEdit={onEdit} onDelete={onDelete} />
      ))}
      {classes.length === 0 && (
        <Card padding="lg" variant="default">
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            등록된 반이 없습니다.
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * 반 카드
 */
function ClassCard({
  classItem,
  onEdit,
  onDelete,
}: {
  classItem: Class;
  onEdit: (classId: string) => void;
  onDelete: (classId: string) => Promise<void>;
}) {
  const { data: statistics } = useClassStatistics(classItem.id);
  const dayLabel = DAYS_OF_WEEK.find((d) => d.value === classItem.day_of_week)?.label || classItem.day_of_week;

  return (
    <Card
      padding="md"
      variant="default"
      style={{
        borderLeft: `4px solid ${classItem.color}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-sm)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>
          {classItem.name}
        </h3>
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
          <Button size="xs" variant="ghost" onClick={() => onEdit(classItem.id)}>
            수정
          </Button>
          <Button size="xs" variant="ghost" onClick={() => onDelete(classItem.id)}>
            삭제
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
        {classItem.subject && <div>과목: {classItem.subject}</div>}
        {classItem.grade && <div>대상: {classItem.grade}</div>}
        <div>요일: {dayLabel}</div>
        <div>시간: {classItem.start_time} ~ {classItem.end_time}</div>
        <div>정원: {classItem.current_count} / {classItem.capacity}</div>
        {statistics && (
          <>
            <div>정원률: {statistics.capacity_rate.toFixed(1)}%</div>
            <div>출결률: {statistics.attendance_rate.toFixed(1)}%</div>
            <div>지각률: {statistics.late_rate.toFixed(1)}%</div>
          </>
        )}
      </div>
    </Card>
  );
}

/**
 * 반 캘린더 뷰 (편성표)
 * [요구사항] 반 편성표(Calendar-like) 제공
 */
function ClassCalendarView({ classes }: { classes: Class[] }) {
  // 요일별로 반 그룹화
  const classesByDay = DAYS_OF_WEEK.map((day) => ({
    day,
    classes: classes.filter((c) => c.day_of_week === day.value),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {classesByDay.map(({ day, classes: dayClasses }) => (
        <Card key={day.value} padding="md" variant="default">
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
            {day.label}
          </h3>
          {dayClasses.length === 0 ? (
            <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--spacing-lg)' }}>
              등록된 반이 없습니다.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {dayClasses
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map((classItem) => (
                  <div
                    key={classItem.id}
                    style={{
                      padding: 'var(--spacing-sm)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: `${classItem.color}20`,
                      borderLeft: `4px solid ${classItem.color}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{classItem.name}</div>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                          {classItem.start_time} ~ {classItem.end_time} | {classItem.current_count} / {classItem.capacity}명
                        </div>
                      </div>
                      {classItem.room && (
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                          {classItem.room}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

