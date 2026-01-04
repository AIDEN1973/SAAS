// LAYER: UI_COMPONENT
/**
 * ClassesTab Component
 *
 * 반 배정 탭
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 * [불변 규칙] SSOT UI 디자인 준수
 */
import { useState, useMemo } from 'react';
import { useModal, useResponsiveMode, useToast, IconButtonGroup, Card, isMobile, useIconSize, useIconStrokeWidth } from '@ui-core/react';
import { BookOpen, Trash2, Pencil } from 'lucide-react';
import { BadgeSelect } from '../../../components/BadgeSelect';
import { SchemaForm } from '@schema-engine';
import { useIndustryTranslations } from '@hooks/use-industry-translations';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { LayerSectionHeader } from '../components/LayerSectionHeader';
import { PlusIcon } from '../../../components/DataTableActionButtons';
import { toKST } from '@lib/date-utils';
import { logError } from '../../../utils';
import type { Class } from '@services/class-service';
import type { FormSchema } from '@schema-engine/types';

// 요일 상수
const DAYS_OF_WEEK: { value: string; label: string }[] = [
  { value: 'monday', label: '월요일' },
  { value: 'tuesday', label: '화요일' },
  { value: 'wednesday', label: '수요일' },
  { value: 'thursday', label: '목요일' },
  { value: 'friday', label: '금요일' },
  { value: 'saturday', label: '토요일' },
  { value: 'sunday', label: '일요일' },
];

// 반 배정 탭 컴포넌트
export interface ClassesTabProps {
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
  effectiveClassAssignmentFormSchema: FormSchema;
  onAssign: (classId: string, enrolledAt?: string) => Promise<void>;
  onUnassign: (classId: string, leftAt?: string) => Promise<void>;
  onUpdate?: (studentClassId: string, enrolledAt: string) => Promise<void>; // enrolled_at만 업데이트하는 경우
  isEditable?: boolean;
}

export function ClassesTab({
  studentClasses,
  isLoading,
  allClasses,
  effectiveClassAssignmentFormSchema,
  onAssign,
  onUnassign,
  onUpdate,
  isEditable = true,
}: ClassesTabProps) {
  // Automation & AI Industry-Neutral Rule (SSOT): Industry Adapter를 통한 translations 생성
  const classAssignmentTranslations = useIndustryTranslations(effectiveClassAssignmentFormSchema);
  const terms = useIndustryTerms();
  const { showConfirm } = useModal();
  const { toast } = useToast();
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [classNameFilter, setClassNameFilter] = useState<string>('all');

  // 타이틀 아이콘 크기 및 선 두께 계산 (CSS 변수 사용)
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  const baseIconSize = useIconSize();
  const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  const emptyStateIconStrokeWidth = useIconStrokeWidth();

  const assignedClassIds = studentClasses
    .filter((sc) => sc.is_active)
    .map((sc) => sc.class_id);

  // 배정 가능한 반 목록 (아직 배정되지 않은 활성 반)
  const availableClasses = allClasses.filter(
    (c) => c.status === 'active' && !assignedClassIds.includes(c.id)
  );

  // 수정 모드 상태 관리 (반별) - [P2-3 수정] 선언 순서 정리: handleAssign보다 먼저 선언
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingStudentClassId, setEditingStudentClassId] = useState<string | null>(null);
  const [editingEnrolledAt, setEditingEnrolledAt] = useState<string>('');

  const handleAssign = async (data: Record<string, unknown>) => {
    if (!data.class_id) return;

    try {
      await onAssign(String(data.class_id ?? ''), String(data.enrolled_at || toKST().format('YYYY-MM-DD')));
      setShowAssignForm(false);
      setEditingClassId(null);
      setEditingEnrolledAt('');
    } catch (error) {
      toast('반 배정에 실패했습니다.', 'error');
    }
  };

  const handleUnassign = async (classId: string) => {
    const confirmed = await showConfirm('정말 이 반에서 제외하시겠습니까?', '반 제외');
    if (!confirmed) return;

    try {
      await onUnassign(classId, toKST().format('YYYY-MM-DD'));
    } catch (error) {
      toast('반 제외에 실패했습니다.', 'error');
    }
  };

  // 필터링된 반 목록 (handleEdit보다 먼저 정의)
  const filteredStudentClasses = useMemo(() => {
    if (classNameFilter === 'all') {
      return studentClasses;
    }
    return studentClasses.filter((sc) => sc.class && sc.class.id === classNameFilter);
  }, [studentClasses, classNameFilter]);

  const handleEdit = (studentClass: { id: string; class_id: string; enrolled_at: string; left_at?: string; is_active: boolean; class: Class | null }) => {
    setEditingClassId(studentClass.class_id);
    setEditingStudentClassId(studentClass.id);
    setEditingEnrolledAt(studentClass.enrolled_at);
    setShowAssignForm(true);
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!editingClassId || !editingStudentClassId || !data.class_id) return;

    const newClassId = String(data.class_id);
    const newEnrolledAt = String(data.enrolled_at || toKST().format('YYYY-MM-DD'));

    try {
      // 문서 요구사항: 반 배정 수정 시 같은 반이면 enrolled_at만 업데이트, 다른 반이면 반 이동
      if (editingClassId === newClassId) {
        // 같은 반: enrolled_at만 업데이트 (문서 요구사항 준수)
        // [P1-3 수정] onUpdate는 필수: App Layer 분리 원칙 준수 (UI는 호출만, 비즈니스 로직은 Hook/Service에서)
        if (!onUpdate) {
          throw new Error('반 배정 수정 기능이 초기화되지 않았습니다.');
        }
        await onUpdate(editingStudentClassId, newEnrolledAt);
        toast('배정일이 수정되었습니다.', 'success', '완료');
      } else {
        // 다른 반: 반 이동 (문서 요구사항: 반 이동 시 이전 반의 left_at 설정)
        // 기존 반 제외 (left_at 설정)
        await onUnassign(editingClassId, toKST().format('YYYY-MM-DD'));
        // 새 반 배정
        await onAssign(newClassId, newEnrolledAt);
        toast('반이 이동되었습니다.', 'success', '완료');
      }
      setShowAssignForm(false);
      setEditingClassId(null);
      setEditingStudentClassId(null);
      setEditingEnrolledAt('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '반 배정 수정에 실패했습니다.';
      toast(errorMessage, 'error');
    }
  };

  // 반 이름 옵션 생성 (중복 제거)
  const classOptions = useMemo(() => {
    const uniqueClasses = new Map<string, { id: string; name: string }>();
    studentClasses.forEach((sc) => {
      if (sc.class && !uniqueClasses.has(sc.class.id)) {
        uniqueClasses.set(sc.class.id, { id: sc.class.id, name: sc.class.name });
      }
    });
    return Array.from(uniqueClasses.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [studentClasses]);

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div>
      {showAssignForm && (
        <div>
          <SchemaForm
            schema={{
              ...effectiveClassAssignmentFormSchema,
              form: {
                ...effectiveClassAssignmentFormSchema.form,
                // [P0-1 수정] actions를 명시적으로 비활성화하여 SchemaForm이 자동 API 호출을 하지 않도록 함
                // handleAssign/handleUpdate에서 onAssign/onUpdate를 통해 직접 처리
                actions: [],
                fields: [
                  // [P1-1 수정] 인덱스 접근 대신 name 기반으로 필드 찾기: 스키마 변경에 안전
                  // [P1-1 수정] 필드가 없을 때 throw 대신 안전한 fallback UI 제공
                  (() => {
                    const classIdField = effectiveClassAssignmentFormSchema.form.fields.find(f => f.name === 'class_id');
                    if (!classIdField) {
                      // 스키마 버전 불일치 시 안전한 fallback: 기본 필드 반환
                      logError('StudentsPage:ClassesTab', 'class_id 필드를 찾을 수 없습니다. 스키마 버전을 확인하세요.');
                      return {
                        name: 'class_id',
                        kind: 'select' as const,
                        ui: { label: '반 선택', colSpan: 1 },
                        validation: { required: true },
                        options: [{ label: '스키마 오류: 반을 선택할 수 없습니다', value: '' }],
                      };
                    }
                    return {
                      ...classIdField,
                      options: [
                        { label: '반을 선택하세요', value: '' },
                        // [P0-3 수정] 수정 모드일 때는 현재 배정된 반도 포함 (필터와 독립적으로 원본에서 찾기)
                        // filteredStudentClasses가 아닌 studentClasses 원본에서 찾아 필터 영향 받지 않도록
                        ...(editingClassId
                          ? studentClasses
                              .filter((sc) => sc.class && sc.class_id === editingClassId)
                              .map((sc) => {
                                const classItem = sc.class!;
                                const dayLabel = DAYS_OF_WEEK.find((d) => d.value === classItem.day_of_week)?.label || classItem.day_of_week;
                                return {
                                  label: `${classItem.name} (${dayLabel} ${classItem.start_time}~${classItem.end_time})`,
                                  value: classItem.id,
                                };
                              })
                          : []),
                        // 배정 가능한 반만 포함 (이미 배정된 반 제외)
                        ...availableClasses.map((classItem) => {
                          const dayLabel = DAYS_OF_WEEK.find((d) => d.value === classItem.day_of_week)?.label || classItem.day_of_week;
                          return {
                            label: `${classItem.name} (${dayLabel} ${classItem.start_time}~${classItem.end_time})`,
                            value: classItem.id,
                          };
                        }),
                      ],
                    };
                  })(),
                  // [P1-1 수정] 인덱스 접근 대신 name 기반으로 필드 찾기: 스키마 변경에 안전
                  // [P1-1 수정] 필드가 없을 때 throw 대신 안전한 fallback UI 제공
                  (() => {
                    const enrolledAtField = effectiveClassAssignmentFormSchema.form.fields.find(f => f.name === 'enrolled_at');
                    if (!enrolledAtField) {
                      // 스키마 버전 불일치 시 안전한 fallback: 기본 필드 반환
                      logError('StudentsPage:ClassesTab', 'enrolled_at 필드를 찾을 수 없습니다. 스키마 버전을 확인하세요.');
                      return {
                        name: 'enrolled_at',
                        kind: 'date' as const,
                        ui: { label: '배정일', colSpan: 1 },
                        validation: { required: true },
                      };
                    }
                    return enrolledAtField;
                  })(),
                ],
              },
              // 최상위 actions도 비활성화
              actions: [],
            }}
            translations={classAssignmentTranslations}
            onSubmit={editingClassId ? handleUpdate : handleAssign}
            defaultValues={{
              class_id: editingClassId || '',
              enrolled_at: editingEnrolledAt || toKST().format('YYYY-MM-DD'),
            }}
            disableCardPadding={false}
            cardTitle={undefined}
            onCancel={() => {
              setShowAssignForm(false);
              setEditingClassId(null);
              setEditingStudentClassId(null);
              setEditingEnrolledAt('');
            }}
          />
        </div>
      )}

      {!showAssignForm && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <BookOpen size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                {`${terms.GROUP_LABEL} 배정`}
              </span>
            }
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <BadgeSelect
                  value={classNameFilter}
                  onChange={(value) => setClassNameFilter(value as string)}
                  options={[
                    { value: 'all', label: '전체' },
                    ...classOptions.map((classItem) => ({
                      value: classItem.id,
                      label: classItem.name,
                    })),
                  ]}
                  size="sm"
                  selectedColor="var(--color-text)"
                  unselectedColor="var(--color-text)"
                />
                {isEditable && (
                  <IconButtonGroup
                    items={[
                      {
                        icon: PlusIcon,
                        tooltip: `${terms.GROUP_LABEL} 배정`,
                        variant: 'solid',
                        color: 'primary',
                        onClick: () => {
                          setEditingClassId(null);
                          setEditingEnrolledAt('');
                          setShowAssignForm(true);
                        },
                        disabled: availableClasses.length === 0,
                      },
                    ]}
                    align="right"
                  />
                )}
              </div>
            }
          />
          <Card
            padding="md"
                      >
        {filteredStudentClasses.filter((sc) => sc.class).length > 0 ? (
          // 각 반별로 그룹화하여 표시
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {filteredStudentClasses
              .filter((sc) => sc.class)
              .map((studentClass) => {
                const classItem = studentClass.class!;
                const dayLabel = DAYS_OF_WEEK.find((d) => d.value === classItem.day_of_week)?.label || classItem.day_of_week;

                // 각 반 정보를 필드 형태로 변환
                const fields = [
                  { label: `${terms.GROUP_LABEL}명`, value: classItem.name },
                  { label: '과목', value: classItem.subject || '-' },
                  { label: '대상', value: classItem.grade || '-' },
                  { label: '요일', value: dayLabel },
                  { label: '시간', value: `${classItem.start_time} ~ ${classItem.end_time}` },
                  { label: '강의실', value: classItem.room || '-' },
                  { label: '배정일', value: studentClass.enrolled_at },
                ];

                return (
                  <div key={studentClass.id}>
                    {/* 수정폼과 동일한 2열 그리드 레이아웃, 텍스트만 출력 */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobileMode ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                        gap: 'var(--spacing-md)',
                      }}
                    >
                      {fields.map((field, fieldIdx) => (
                        <div
                          key={fieldIdx}
                          style={{
                            display: 'flex',
                            width: '100%',
                            alignItems: 'center',
                            // 수정폼(Input/Select/DatePicker)의 md 패딩과 동일하게 맞춤
                            paddingTop: 'var(--spacing-sm)',
                            paddingBottom: 'var(--spacing-sm)',
                            paddingLeft: 'var(--spacing-form-horizontal-left)',
                            paddingRight: 'var(--spacing-form-horizontal-right)',
                            // 요구사항: 기본보기 밑줄은 원래 연한 색상으로 복구
                            borderBottom: 'var(--border-width-thin) solid var(--color-table-row-border)',
                          }}
                        >
                          {/* 항목명: 고정 너비 (수정폼 인라인 라벨과 동일) */}
                          <span
                            style={{
                              color: 'var(--color-form-inline-label)',
                              fontSize: 'var(--font-size-base)',
                              fontFamily: 'var(--font-family)',
                              fontWeight: 'var(--font-weight-normal)',
                              lineHeight: 'var(--line-height)',
                              minWidth: 'var(--width-form-inline-label)',
                              flexShrink: 0,
                              marginRight: 'var(--spacing-form-inline-label-gap)',
                            }}
                          >
                            {field.label}
                          </span>
                          {/* 결과값 */}
                          <span
                            style={{
                              color: 'var(--color-text)',
                              fontSize: 'var(--font-size-base)',
                              fontFamily: 'var(--font-family)',
                              fontWeight: 'var(--font-weight-normal)',
                              lineHeight: 'var(--line-height)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {field.value}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* 요구사항: 기본보기 > 삭제/수정 버튼 텍스트 제거, IconButtonGroup 스타일(아이콘만) + 우측 정렬 */}
                    {isEditable && (
                      <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
                        <IconButtonGroup
                          align="right"
                          items={[
                            {
                              icon: Trash2,
                              tooltip: '삭제',
                              variant: 'outline' as const,
                              color: 'error' as const,
                              onClick: () => { void handleUnassign(classItem.id); },
                            },
                            {
                              icon: Pencil,
                              tooltip: '수정',
                              variant: 'outline' as const,
                              onClick: () => handleEdit(studentClass),
                            },
                          ]}
                        />
                      </div>
                    )}
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
            minHeight: 'calc(var(--spacing-xl) * 5)', // [불변 규칙] CSS 변수 사용 (spacing-xl = 2rem, 5배 = 10rem ≈ 160px)
            padding: 'var(--spacing-xl)',
          }}>
            <BookOpen
              size={emptyStateIconSize}
              strokeWidth={emptyStateIconStrokeWidth}
              style={{
                color: 'var(--color-gray-300)',
                marginBottom: 'var(--spacing-xs)',
                display: 'inline-block',
              }}
            />
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              {studentClasses.filter((sc) => sc.class).length === 0
                ? `배정된 ${terms.GROUP_LABEL}이(가) 없습니다.`
                : `필터 조건에 맞는 ${terms.GROUP_LABEL}이(가) 없습니다.`}
            </p>
          </div>
        )}
        </Card>
        </div>
      )}
    </div>
  );
}
