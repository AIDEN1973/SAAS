// LAYER: UI_COMPONENT
/**
 * AttendanceTab Component
 *
 * 출결 관리 탭
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 * [불변 규칙] SSOT UI 디자인 준수
 */
import { useState, useMemo } from 'react';
import { useToast, useIconSize, useIconStrokeWidth, Card, Badge, Button, IconButtonGroup } from '@ui-core/react';
import { Calendar, Pencil } from 'lucide-react';
import { SchemaForm } from '@schema-engine';
import { LayerSectionHeader } from '../components/LayerSectionHeader';
import { PlusIcon } from '../../../components/DataTableActionButtons';
import { toKST } from '@lib/date-utils';
import { useAttendanceLogs, useCreateAttendanceLog, useUpdateAttendanceLog } from '@hooks/use-attendance';
import { useStudentClasses } from '@hooks/use-student';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import type { Student } from '@services/student-service';
import type { CreateAttendanceLogInput } from '@services/attendance-service';
import type { FormSchema } from '@schema-engine/types';

// 레이어 섹션 본문 카드 스타일
const layerSectionCardStyle: React.CSSProperties = {};

// 출결 관리 탭 컴포넌트
export interface AttendanceTabProps {
  studentId: string | null;
  student: Student | null | undefined;
  isEditable: boolean;
}

export function AttendanceTab({
  studentId,
  student,
  isEditable,
}: {
  studentId: string | null;
  student: Student | null | undefined;
  isEditable: boolean;
}) {
  const { toast } = useToast();
  const terms = useIndustryTerms();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();
  // [불변 규칙] 하드코딩 금지: CSS 변수에서 아이콘 크기 읽기
  const iconSize = useIconSize();
  const iconStrokeWidth = useIconStrokeWidth();

  // 출결 기록 생성/수정 Hook
  const createAttendanceLog = useCreateAttendanceLog();
  const updateAttendanceLog = useUpdateAttendanceLog();

  // 학생의 배정된 반 목록 조회
  // [P1-7] studentId가 null일 수 있지만, hook 내부에서 enabled: !!studentId로 처리됨
  const { data: studentClassesData } = useStudentClasses(studentId);
  const studentClasses = useMemo(() => studentClassesData ?? [], [studentClassesData]);

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  const baseIconSize = useIconSize();
  const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  const emptyStateIconStrokeWidth = useIconStrokeWidth();

  const thirtyDaysAgo = useMemo(() => {
    return toKST().subtract(30, 'day').format('YYYY-MM-DD');
  }, []);

  const { data: attendanceLogsData, isLoading } = useAttendanceLogs({
    student_id: studentId || undefined,
    date_from: thirtyDaysAgo,
  });
  const attendanceLogs = useMemo(() => attendanceLogsData ?? [], [attendanceLogsData]);

  const stats = useMemo(() => {
    if (attendanceLogs.length === 0) return null;

    const present = attendanceLogs.filter(log => log.status === 'present').length;
    const late = attendanceLogs.filter(log => log.status === 'late').length;
    const absent = attendanceLogs.filter(log => log.status === 'absent').length;
    const total = attendanceLogs.length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      total,
      present,
      late,
      absent,
      attendanceRate,
    };
  }, [attendanceLogs]);


  // [P0-1 수정] 출결 기록 추가 폼 스키마 생성: 조건부 return 이전에 Hook 호출
  // React Hooks 규칙 준수: 모든 Hook은 조건부 return보다 위에서 호출되어야 함
  // studentClasses는 useStudentClasses에서 안전하게 처리되므로 null 체크 불필요
  const attendanceFormSchema = useMemo<FormSchema>(() => ({
    version: '1.0.0',
    minSupportedClient: '1.0.0',
    entity: 'attendance',
    type: 'form',
    form: {
      layout: {
        columns: 2,
        columnGap: 'md',
        rowGap: 'md',
      },
      fields: [
        {
          name: 'class_id',
          kind: 'select',
          ui: {
            label: `${terms.GROUP_LABEL} (선택)`,
            colSpan: 1,
          },
          options: [
            { label: '선택 안함', value: '' },
            ...studentClasses
              .filter((sc) => sc.class && sc.is_active)
              .map((sc) => ({
                label: sc.class!.name,
                value: sc.class!.id,
              })),
          ],
        },
        {
          name: 'occurred_at',
          kind: 'datetime',
          ui: {
            label: `${terms.ATTENDANCE_LABEL} 시간`,
            colSpan: 1,
          },
          // [P1-2] defaultValue는 SchemaForm defaultValues prop으로 동적 전달 (마운트 시점 고정 방지)
          validation: {
            required: true,
          },
        },
        {
          name: 'attendance_type',
          kind: 'select',
          ui: {
            label: `${terms.ATTENDANCE_LABEL} 유형`,
            colSpan: 1,
          },
          options: [
            { label: terms.CHECK_IN_LABEL, value: 'check_in' },
            { label: terms.CHECK_OUT_LABEL, value: 'check_out' },
            { label: '지각', value: 'late' },
            { label: '결석', value: 'absent' },
          ],
          defaultValue: 'check_in',
          validation: {
            required: true,
          },
        },
        {
          name: 'status',
          kind: 'select',
          ui: {
            label: '상태',
            colSpan: 1,
          },
          options: [
            { label: '출석', value: 'present' },
            { label: '지각', value: 'late' },
            { label: '결석', value: 'absent' },
            { label: '사유', value: 'excused' },
          ],
          defaultValue: 'present',
          validation: {
            required: true,
          },
        },
        {
          name: 'notes',
          kind: 'textarea',
          ui: {
            label: '메모',
            colSpan: 2,
          },
        },
      ],
      submit: {
        label: '저장',
        variant: 'solid',
        color: 'primary',
        size: 'md',
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [studentClasses]);

  // [P0-1 수정] 수정 중인 출결 기록 찾기: 조건부 return 이전에 Hook 호출
  const editingLog = useMemo(() => {
    if (!editingLogId) return null;
    return attendanceLogs.find((log) => log.id === editingLogId);
  }, [editingLogId, attendanceLogs]);

  // [P0-1 수정] 출결 기록 수정 모드 상태: 조건부 return 이전에 Hook 호출
  const [showEditList, setShowEditList] = useState(false);

  // 출결 기록 추가 핸들러
  const handleAddAttendance = async (data: Record<string, unknown>) => {
    if (!studentId) return;

    try {
      const input: CreateAttendanceLogInput = {
        student_id: studentId,
        class_id: data.class_id ? String(data.class_id) : undefined,
        occurred_at: String(data.occurred_at),
        attendance_type: data.attendance_type as CreateAttendanceLogInput['attendance_type'],
        status: data.status as CreateAttendanceLogInput['status'],
        notes: data.notes ? String(data.notes) : undefined,
      };
      await createAttendanceLog.mutateAsync(input);

      toast(`${terms.ATTENDANCE_LABEL} 기록이 추가되었습니다.`, 'success');
      setShowAddForm(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `${terms.ATTENDANCE_LABEL} 기록 추가에 실패했습니다.`;
      toast(errorMessage, 'error');
    }
  };

  // 출결 기록 수정 핸들러
  const handleUpdateAttendance = async (data: Record<string, unknown>) => {
    if (!editingLogId) return;

    try {
      const input: Partial<CreateAttendanceLogInput> = {
          class_id: data.class_id ? String(data.class_id) : undefined,
          occurred_at: String(data.occurred_at),
        attendance_type: data.attendance_type as CreateAttendanceLogInput['attendance_type'],
        status: data.status as CreateAttendanceLogInput['status'],
          notes: data.notes ? String(data.notes) : undefined,
      };
      await updateAttendanceLog.mutateAsync({
        logId: editingLogId,
        input,
      });

      toast(`${terms.ATTENDANCE_LABEL} 기록이 수정되었습니다.`, 'success');
      setEditingLogId(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `${terms.ATTENDANCE_LABEL} 기록 수정에 실패했습니다.`;
      toast(errorMessage, 'error');
    }
  };

  // [P0-1 수정] 조건부 return을 모든 Hook 호출 이후로 이동
  if (!studentId || !student) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          학생 정보를 불러올 수 없습니다.
        </div>
      </Card>
    );
  }

  // 출결 기록 수정 시작 (출결 기록 목록 표시)
  const handleStartEdit = () => {
    if (attendanceLogs.length === 0) {
      toast(`수정할 ${terms.ATTENDANCE_LABEL} 기록이 없습니다.`, 'info');
      return;
    }
    setShowEditList(true);
  };

  // 출결 기록 선택하여 수정 시작
  const handleSelectLogForEdit = (logId: string) => {
    setEditingLogId(logId);
    setShowEditList(false);
  };

  return (
    <div>
      {showAddForm && !editingLogId && !showEditList && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Calendar size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                {terms.ATTENDANCE_LABEL} 기록 추가
              </span>
            }
          />
          <SchemaForm
            schema={{
              ...attendanceFormSchema,
              form: {
                ...attendanceFormSchema.form,
                // [P0-1 수정] actions를 명시적으로 비활성화하여 SchemaForm이 자동 API 호출을 하지 않도록 함
                // handleAddAttendance에서 createAttendanceLog.mutateAsync를 통해 직접 처리
                actions: [],
              },
              // 최상위 actions도 비활성화
              actions: [],
            }}
            onSubmit={handleAddAttendance}
            // [P1-2 수정] showAddForm 열 때마다 최신 시간으로 동적 설정
            defaultValues={{
              occurred_at: toKST().format('YYYY-MM-DDTHH:mm'),
              attendance_type: 'check_in',
              status: 'present',
            }}
            disableCardPadding={false}
            cardTitle={undefined}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {showEditList && !editingLogId && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Calendar size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                {terms.ATTENDANCE_LABEL} 기록 수정
              </span>
            }
            right={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEditList(false)}
              >
                취소
              </Button>
            }
          />
          <Card padding="md" variant="default" style={layerSectionCardStyle}>
            {attendanceLogs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {attendanceLogs.map((log, index) => {
                  const statusColor = log.status === 'present' ? 'success' : log.status === 'late' ? 'warning' : 'error';
                  const statusLabel = log.status === 'present' ? '출석' : log.status === 'late' ? '지각' : log.status === 'absent' ? '결석' : '사유';
                  const typeLabel = log.attendance_type === 'check_in' ? terms.CHECK_IN_LABEL : log.attendance_type === 'check_out' ? terms.CHECK_OUT_LABEL : log.attendance_type;

                  return (
                    <div
                      key={log.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 'var(--spacing-sm)',
                        paddingBottom: 'var(--spacing-sm)',
                        paddingLeft: 'var(--spacing-md)',
                        paddingRight: 'var(--spacing-md)',
                        borderBottom: index < attendanceLogs.length - 1
                          ? 'var(--border-width-thin) solid var(--color-table-row-border)'
                          : 'none',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleSelectLogForEdit(log.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flex: 1 }}>
                        <Badge variant="soft" color={statusColor}>
                          {statusLabel}
                        </Badge>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                          {typeLabel}
                        </span>
                        <span style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-base)', marginLeft: 'auto' }}>
                          {toKST(log.occurred_at).format('YYYY-MM-DD HH:mm')}
                        </span>
                        <Pencil size={iconSize} strokeWidth={iconStrokeWidth} style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-sm)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'calc(var(--spacing-xl) * 5)',
                padding: 'var(--spacing-xl)',
              }}>
                <Calendar
                  size={emptyStateIconSize}
                  strokeWidth={emptyStateIconStrokeWidth}
                  style={{
                    color: 'var(--color-gray-300)',
                    marginBottom: 'var(--spacing-xs)',
                    display: 'inline-block',
                  }}
                />
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  수정할 {terms.ATTENDANCE_LABEL} 기록이 없습니다.
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {editingLogId && editingLog && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Calendar size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                {terms.ATTENDANCE_LABEL} 기록 수정
              </span>
            }
          />
          <SchemaForm
            schema={{
              ...attendanceFormSchema,
              form: {
                ...attendanceFormSchema.form,
                // [P0-1 수정] actions를 명시적으로 비활성화하여 SchemaForm이 자동 API 호출을 하지 않도록 함
                // handleUpdateAttendance에서 updateAttendanceLog.mutateAsync를 통해 직접 처리
                actions: [],
              },
              // 최상위 actions도 비활성화
              actions: [],
            }}
            onSubmit={handleUpdateAttendance}
            defaultValues={{
              class_id: editingLog.class_id || '',
              occurred_at: toKST(editingLog.occurred_at).format('YYYY-MM-DDTHH:mm'),
              attendance_type: editingLog.attendance_type,
              status: editingLog.status,
              notes: editingLog.notes || '',
            }}
            disableCardPadding={false}
            cardTitle={undefined}
            onCancel={() => {
              setEditingLogId(null);
              setShowEditList(false);
            }}
          />
        </div>
      )}

      {!showAddForm && !editingLogId && !showEditList && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {/* 출결 통계 */}
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Calendar size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                {terms.ATTENDANCE_LABEL}통계
              </span>
            }
            right={
              isEditable ? (
                <IconButtonGroup
                  items={[
                    {
                      icon: PlusIcon,
                      tooltip: `${terms.ATTENDANCE_LABEL}기록 추가`,
                      variant: 'solid',
                      color: 'primary',
                      onClick: () => {
                        setShowAddForm(true);
                      },
                    },
                  ]}
                  align="right"
                />
              ) : undefined
            }
          />
          <Card padding="md" variant="default" style={layerSectionCardStyle}>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                {terms.ATTENDANCE_LABEL} 정보를 불러오는 중...
              </div>
            ) : stats ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)' }}>
                {/* 출석률 - 주요 지표로 상단에 강조 표시 */}
                <div style={{
                  padding: 'var(--spacing-lg)',
                  borderRadius: 'var(--border-radius-md)',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-white)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', opacity: 'var(--opacity-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                    출석률
                  </div>
                  <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)' }}>
                    {stats.attendanceRate}%
                  </div>
                </div>

                {/* 상세 통계 - 2열 그리드 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 'var(--spacing-md)'
                }}>
                  <div style={{
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--border-radius-sm)',
                    backgroundColor: 'var(--color-gray-50)',
                    textAlign: 'center',
                  }}>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                      총 {terms.ATTENDANCE_LABEL}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
                      {stats.total}
                    </div>
                  </div>
                  <div style={{
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--border-radius-sm)',
                    backgroundColor: 'var(--color-success-50)',
                    textAlign: 'center',
                  }}>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                      출석
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
                      {stats.present}
                    </div>
                  </div>
                  <div style={{
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--border-radius-sm)',
                    backgroundColor: 'var(--color-warning-50)',
                    textAlign: 'center',
                  }}>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                      지각
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning)' }}>
                      {stats.late}
                    </div>
                  </div>
                  <div style={{
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--border-radius-sm)',
                    backgroundColor: 'var(--color-error-50)',
                    textAlign: 'center',
                  }}>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                      결석
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-error)' }}>
                      {stats.absent}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'calc(var(--spacing-xl) * 5)',
                padding: 'var(--spacing-xl)',
              }}>
                <Calendar
                  size={emptyStateIconSize}
                  strokeWidth={emptyStateIconStrokeWidth}
                  style={{
                    color: 'var(--color-gray-300)',
                    marginBottom: 'var(--spacing-xs)',
                    display: 'inline-block',
                  }}
                />
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  {terms.ATTENDANCE_LABEL} 데이터가 없습니다.
                </p>
              </div>
            )}

            {isEditable && attendanceLogs.length > 0 && (
              <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
                <IconButtonGroup
                  align="right"
                  items={[
                    {
                      icon: Pencil,
                      tooltip: '수정',
                      variant: 'outline',
                      onClick: handleStartEdit,
                    },
                  ]}
                />
              </div>
            )}
          </Card>
        </div>

        {/* 최근 출결 내역 */}
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Calendar size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                최근 {terms.ATTENDANCE_LABEL}내역
              </span>
            }
          />
          <Card padding="md" variant="default" style={layerSectionCardStyle}>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                {terms.ATTENDANCE_LABEL} 정보를 불러오는 중...
              </div>
            ) : attendanceLogs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 'var(--spacing-sm)' }}>
                {attendanceLogs.slice(0, 10).map((log, index) => {
                  const statusColor = log.status === 'present' ? 'success' : log.status === 'late' ? 'warning' : 'error';
                  const statusLabel = log.status === 'present' ? '출석' : log.status === 'late' ? '지각' : log.status === 'absent' ? '결석' : '사유';
                  const typeLabel = log.attendance_type === 'check_in' ? terms.CHECK_IN_LABEL : log.attendance_type === 'check_out' ? terms.CHECK_OUT_LABEL : log.attendance_type;

                  return (
                    <div
                      key={log.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 'var(--spacing-sm)',
                        paddingBottom: 'var(--spacing-sm)',
                        paddingLeft: 'var(--spacing-md)',
                        paddingRight: 'var(--spacing-md)',
                        borderBottom: index < attendanceLogs.slice(0, 10).length - 1
                          ? 'var(--border-width-thin) solid var(--color-table-row-border)'
                          : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flex: 1 }}>
                        <Badge variant="soft" color={statusColor}>
                          {statusLabel}
                        </Badge>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                          {typeLabel}
                        </span>
                        <span style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-base)', marginLeft: 'auto' }}>
                          {toKST(log.occurred_at).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'calc(var(--spacing-xl) * 5)',
                padding: 'var(--spacing-xl)',
              }}>
                <Calendar
                  size={emptyStateIconSize}
                  strokeWidth={emptyStateIconStrokeWidth}
                  style={{
                    color: 'var(--color-gray-300)',
                    marginBottom: 'var(--spacing-xs)',
                    display: 'inline-block',
                  }}
                />
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  {attendanceLogs.length === 0
                    ? `최근 ${terms.ATTENDANCE_LABEL} 내역이 없습니다.`
                    : `필터 조건에 맞는 ${terms.ATTENDANCE_LABEL} 내역이 없습니다.`}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}
