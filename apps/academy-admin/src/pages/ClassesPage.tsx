/**
 * ë°?ê´€ë¦??˜ì´ì§€
 * 
 * [ë¶ˆë? ê·œì¹™] api-sdkë¥??µí•´?œë§Œ ?°ì´???”ì²­
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: UI??tenantIdë¥?ì§ì ‘ ?„ë‹¬?˜ì? ?ŠìŒ, Context?ì„œ ?ë™ ê°€?¸ì˜´
 * [?”êµ¬?¬í•­] ë°?ë¦¬ìŠ¤??+ ìº˜ë¦°??ë·? ë°??¸ì„±??Calendar-like) ?œê³µ
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@ui-core/react';
import { Container, Card, Button, Input } from '@ui-core/react';
import { SchemaForm } from '@schema/engine';
import {
  useClasses,
  useCreateClass,
  useUpdateClass,
  useDeleteClass,
  useClassStatistics,
  useTeachers,
} from '@hooks/use-class';
import type { Class, CreateClassInput, ClassFilter, ClassStatus, DayOfWeek } from '@services/class-service';
import { classFormSchema } from '../schemas/class.schema';

const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: '?”ìš”?? },
  { value: 'tuesday', label: '?”ìš”?? },
  { value: 'wednesday', label: '?˜ìš”?? },
  { value: 'thursday', label: 'ëª©ìš”?? },
  { value: 'friday', label: 'ê¸ˆìš”?? },
  { value: 'saturday', label: '? ìš”?? },
  { value: 'sunday', label: '?¼ìš”?? },
];

export function ClassesPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filter, setFilter] = useState<ClassFilter>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: classes, isLoading, error } = useClasses({
    ...filter,
    search: searchQuery.trim() || undefined, // ë¹?ë¬¸ì?´ì? undefinedë¡?ë³€??
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
              ë°?ê´€ë¦?
            </h1>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <Button
                variant={viewMode === 'list' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                ë¦¬ìŠ¤??
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setViewMode('calendar')}
              >
                ìº˜ë¦°??
              </Button>
              <Button
                variant="solid"
                size="sm"
                onClick={() => setShowCreateForm(!showCreateForm)}
              >
                ë°??ì„±
              </Button>
            </div>
          </div>

          {/* ê²€??ë°??„í„° ?¨ë„ */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="ë°??´ë¦„ ê²€??.."
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
                  ?´ì˜ì¤?
                </Button>
                <Button
                  variant={filter.status === 'inactive' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusFilter('inactive')}
                >
                  ë¹„í™œ??
                </Button>
              </div>

              <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                <Button
                  variant={!filter.day_of_week ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleDayFilter('all')}
                >
                  ?„ì²´ ?”ì¼
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

          {/* ë°??ì„± ??*/}
          {showCreateForm && (
            <CreateClassForm
              teachers={teachers || []}
              onSubmit={handleCreateClass}
              onCancel={() => setShowCreateForm(false)}
            />
          )}

          {/* ë°?ëª©ë¡ ?ëŠ” ìº˜ë¦°??ë·?*/}
          {isLoading ? (
            <div>ë¡œë”© ì¤?..</div>
          ) : error ? (
            <div>?¤ë¥˜: {error.message}</div>
          ) : viewMode === 'list' ? (
            <ClassListView
              classes={classes || []}
              onEdit={(classId) => navigate(`/classes/${classId}`)}
              onDelete={async (classId) => {
                if (confirm('?•ë§ ??ë°˜ì„ ?? œ?˜ì‹œê² ìŠµ?ˆê¹Œ?')) {
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
 * ë°??ì„± ??
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
  const handleSubmit = async (data: any) => {
    // ?¤í‚¤ë§ˆì—??ë°›ì? ?°ì´?°ë? CreateClassInput ?•ì‹?¼ë¡œ ë³€??
    const input: CreateClassInput = {
      name: data.name || '',
      subject: data.subject || undefined,
      grade: data.grade || undefined,
      day_of_week: data.day_of_week || 'monday',
      start_time: data.start_time || '14:00',
      end_time: data.end_time || '15:30',
      capacity: data.capacity || 20,
      room: data.room || undefined,
      notes: data.notes || undefined,
      status: data.status || 'active',
    };
    onSubmit(input);
  };

  return (
    <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>ë°??ì„±</h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          ì·¨ì†Œ
        </Button>
      </div>
      <SchemaForm
        schema={classFormSchema}
        onSubmit={handleSubmit}
        defaultValues={{
          day_of_week: 'monday',
          start_time: '14:00',
          end_time: '15:30',
          capacity: 20,
          status: 'active',
        }}
      />
    </Card>
  );
}

/**
 * ë°?ë¦¬ìŠ¤??ë·?
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
            ?±ë¡??ë°˜ì´ ?†ìŠµ?ˆë‹¤.
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * ë°?ì¹´ë“œ
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
            ?˜ì •
          </Button>
          <Button size="xs" variant="ghost" onClick={() => onDelete(classItem.id)}>
            ?? œ
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
        {classItem.subject && <div>ê³¼ëª©: {classItem.subject}</div>}
        {classItem.grade && <div>?€?? {classItem.grade}</div>}
        <div>?”ì¼: {dayLabel}</div>
        <div>?œê°„: {classItem.start_time} ~ {classItem.end_time}</div>
        <div>?•ì›: {classItem.current_count} / {classItem.capacity}</div>
        {statistics && (
          <>
            <div>?•ì›ë¥? {statistics.capacity_rate.toFixed(1)}%</div>
            <div>ì¶œê²°ë¥? {statistics.attendance_rate.toFixed(1)}%</div>
            <div>ì§€ê°ë¥ : {statistics.late_rate.toFixed(1)}%</div>
          </>
        )}
      </div>
    </Card>
  );
}

/**
 * ë°?ìº˜ë¦°??ë·?(?¸ì„±??
 * [?”êµ¬?¬í•­] ë°??¸ì„±??Calendar-like) ?œê³µ
 */
function ClassCalendarView({ classes }: { classes: Class[] }) {
  // ?”ì¼ë³„ë¡œ ë°?ê·¸ë£¹??
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
              ?±ë¡??ë°˜ì´ ?†ìŠµ?ˆë‹¤.
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
                          {classItem.start_time} ~ {classItem.end_time} | {classItem.current_count} / {classItem.capacity}ëª?
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

