/**
 * ?™ìƒ ê´€ë¦??˜ì´ì§€
 * 
 * [ë¶ˆë? ê·œì¹™] api-sdkë¥??µí•´?œë§Œ ?°ì´???”ì²­
 * [ë¶ˆë? ê·œì¹™] SDUI ?¤í‚¤ë§?ê¸°ë°˜ ?”ë©´ ?ë™ ?ì„±
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: UI??tenantIdë¥?ì§ì ‘ ?„ë‹¬?˜ì? ?ŠìŒ, Context?ì„œ ?ë™ ê°€?¸ì˜´
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@ui-core/react';
import { Container, Grid, Card, Button, Input } from '@ui-core/react';
import { SchemaForm } from '@schema/engine';
import { useStudents, useStudentTags, useStudentTagsByStudent, useCreateStudent, useBulkCreateStudents } from '@hooks/use-student';
import type { StudentFilter, StudentStatus, Student, CreateStudentInput } from '@services/student-service';
import type { Tag } from '@core/tags';
import { studentFormSchema } from '../schemas/student.schema';
// xlsx???™ì  importë¡?ë¡œë“œ (?„ìš”???Œë§Œ)

export function StudentsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<StudentFilter>({});
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // [ë¶ˆë? ê·œì¹™] Zero-Trust: tenantId??Context?ì„œ ?ë™?¼ë¡œ ê°€?¸ì˜´
  const { data: students, isLoading, error } = useStudents({
    ...filter,
    search: searchQuery.trim() || undefined, // ë¹?ë¬¸ì?´ì? undefinedë¡?ë³€??
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
            ?™ìƒ ê´€ë¦?
          </h1>

          {/* ê²€??ë°??„í„° ?¨ë„ */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {/* ê²€??*/}
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="?™ìƒ ?´ë¦„ ê²€??.."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  fullWidth
                />
              </div>

              {/* ?íƒœ ?„í„° */}
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
                  ?¬ì›
                </Button>
                <Button
                  variant={filter.status === 'on_leave' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusFilter('on_leave')}
                >
                  ?´ì›
                </Button>
                <Button
                  variant={filter.status === 'withdrawn' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusFilter('withdrawn')}
                >
                  ?´ì›
                </Button>
              </div>

              {/* ë·?ëª¨ë“œ ?„í™˜ */}
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <Button
                  variant={viewMode === 'card' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('card')}
                >
                  ì¹´ë“œ
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                >
                  ?Œì´ë¸?
                </Button>
              </div>

              {/* ?™ìƒ ?±ë¡ ë²„íŠ¼ */}
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <Button variant="solid" color="primary" onClick={() => setShowCreateForm(true)}>
                  ?™ìƒ ?±ë¡
                </Button>
                <Button 
                  variant="outline" 
                  color="primary" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={bulkCreateStudents.isPending}
                >
                  {bulkCreateStudents.isPending ? '?±ë¡ ì¤?..' : '?“„ ?‘ì? ?¼ê´„ ?±ë¡'}
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
                      // xlsx ëª¨ë“ˆ ?™ì  ë¡œë“œ
                      const XLSX = await import('xlsx');
                      
                      // ?‘ì? ?Œì¼ ?½ê¸°
                      const arrayBuffer = await file.arrayBuffer();
                      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                      const sheetName = workbook.SheetNames[0];
                      const worksheet = workbook.Sheets[sheetName];
                      
                      // JSON?¼ë¡œ ë³€??
                      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
                      
                      // CreateStudentInput ?•ì‹?¼ë¡œ ë³€??
                      const students: CreateStudentInput[] = jsonData.map((row: any) => ({
                        name: row['?´ë¦„'] || row['name'] || '',
                        birth_date: row['?ë…„?”ì¼'] || row['birth_date'] || '',
                        gender: (row['?±ë³„'] || row['gender'] || undefined) as any,
                        phone: row['?„í™”ë²ˆí˜¸'] || row['phone'] || '',
                        email: row['?´ë©”??] || row['email'] || '',
                        address: row['ì£¼ì†Œ'] || row['address'] || '',
                        school_name: row['?™êµ'] || row['school_name'] || '',
                        grade: row['?™ë…„'] || row['grade'] || '',
                        status: (row['?íƒœ'] || row['status'] || 'active') as StudentStatus,
                        notes: row['ë¹„ê³ '] || row['notes'] || '',
                      })).filter((s) => s.name.trim() !== ''); // ?´ë¦„???ˆëŠ” ê²½ìš°ë§?

                      if (students.length === 0) {
                        alert('?±ë¡???™ìƒ ?°ì´?°ê? ?†ìŠµ?ˆë‹¤.');
                        return;
                      }

                      // ?¼ê´„ ?±ë¡ ?¤í–‰
                      const result = await bulkCreateStudents.mutateAsync(students);
                      
                      if (result.errors && result.errors.length > 0) {
                        alert(`${result.results.length}ëª??±ë¡ ?„ë£Œ, ${result.errors.length}ëª??¤íŒ¨`);
                      } else {
                        alert(`${result.results.length}ëª??±ë¡ ?„ë£Œ`);
                      }

                      // ?Œì¼ ?…ë ¥ ì´ˆê¸°??
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    } catch (error) {
                      console.error('?‘ì? ?¼ê´„ ?±ë¡ ?¤íŒ¨:', error);
                      alert('?‘ì? ?¼ê´„ ?±ë¡???¤íŒ¨?ˆìŠµ?ˆë‹¤.');
                    }
                  }}
                />
              </div>
            </div>
          </Card>

          {/* ?™ë…„ ?„í„° */}
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)' }}>
            <Button
              variant={!filter.grade ? 'solid' : 'outline'}
              size="sm"
              onClick={() => handleGradeFilter('all')}
            >
              ?„ì²´ ?™ë…„
            </Button>
            {['1?™ë…„', '2?™ë…„', '3?™ë…„', 'ì¤?', 'ì¤?', 'ì¤?', 'ê³?', 'ê³?', 'ê³?'].map((grade) => (
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

          {/* ?œê·¸ ?„í„° */}
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

          {/* ?™ìƒ ?±ë¡ ??*/}
          {showCreateForm && (
            <CreateStudentForm
              onClose={() => setShowCreateForm(false)}
              onSubmit={async (data) => {
                await createStudent.mutateAsync(data);
                setShowCreateForm(false);
              }}
            />
          )}

          {/* ?™ìƒ ëª©ë¡ */}
          {isLoading && (
            <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              ë¡œë”© ì¤?..
            </div>
          )}
          {error && (
            <Card padding="md" variant="outlined">
              <div style={{ color: '#ef4444' }}>?¤ë¥˜: {error.message}</div>
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
  tags: Array<{ id: string; name: string; color: string }>;
  onDetailClick: () => void;
}

function StudentCard({ student, tags, onDetailClick }: StudentCardProps) {
  const { data: studentTags } = useStudentTagsByStudent(student.id);
  const displayedTags = studentTags || [];

  const statusConfig = {
    active: { label: '?¬ì›', bgColor: 'var(--color-green-100)', textColor: 'var(--color-green-800)' },
    on_leave: { label: '?´ì›', bgColor: 'var(--color-yellow-100)', textColor: 'var(--color-yellow-800)' },
    withdrawn: { label: '?´ì›', bgColor: 'var(--color-gray-100)', textColor: 'var(--color-gray-800)' },
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
          ?™ë…„: {student.grade}
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
          ?ì„¸
        </Button>
        <Button variant="outline" size="sm" fullWidth onClick={(e) => { e.stopPropagation(); onDetailClick(); }}>
          ?˜ì •
        </Button>
      </Grid>
    </Card>
  );
}

// ?™ìƒ ?±ë¡ ??ì»´í¬?ŒíŠ¸
interface CreateStudentFormProps {
  onClose: () => void;
  onSubmit: (data: CreateStudentInput) => Promise<void>;
}

function CreateStudentForm({ onClose, onSubmit }: CreateStudentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      // ?¤í‚¤ë§ˆì—??ë°›ì? ?°ì´?°ë? CreateStudentInput ?•ì‹?¼ë¡œ ë³€??
      const input: CreateStudentInput = {
        name: data.name || '',
        birth_date: data.birth_date || undefined,
        gender: data.gender || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        school_name: data.school_name || undefined,
        grade: data.grade || undefined,
        status: data.status || 'active',
        notes: data.notes || undefined,
      };
      await onSubmit(input);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>?™ìƒ ?±ë¡</h3>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
          ?«ê¸°
        </Button>
      </div>
      <SchemaForm
        schema={studentFormSchema}
        onSubmit={handleSubmit}
        defaultValues={{
          status: 'active',
        }}
      />
    </Card>
  );
}

