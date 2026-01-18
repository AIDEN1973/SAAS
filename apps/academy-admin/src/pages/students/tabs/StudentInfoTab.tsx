// LAYER: UI_COMPONENT
/**
 * StudentInfoTab Component
 *
 * 학생 기본정보 탭
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 * [불변 규칙] SSOT UI 디자인 준수
 */
import { useMemo, useEffect } from 'react';
import { useResponsiveMode, useToast, IconButtonGroup, Card, isMobile, useIconSize, useIconStrokeWidth } from '@ui-core/react';
import { User, Trash2, Pencil } from 'lucide-react';
import { SchemaForm } from '@schema-engine';
import { LayerSectionHeader } from '../components/LayerSectionHeader';
import { toNullable, logInfo } from '../../../utils';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import type { Student } from '@services/student-service';
import type { FormSchema } from '@schema-engine/types';

// [P2-1 수정] 동적 import 캐싱: module-scope로 이동하여 진짜 캐싱 보장
// useEffect 내부 지역변수는 effect가 다시 돌면 캐시가 초기화되므로 module-scope로 이동
let maskPIICache: ((x: unknown) => unknown) | null = null;

async function getMaskPII(): Promise<(x: unknown) => unknown> {
  if (!maskPIICache) {
    const module = await import('@core/pii-utils');
    maskPIICache = module.maskPII;
  }
  return maskPIICache;
}

export interface StudentInfoTabProps {
  student: Student;
  isEditing: boolean;
  effectiveStudentFormSchema: FormSchema;
  onCancel: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
}

export function StudentInfoTab({ student, isEditing, effectiveStudentFormSchema, onCancel, onSave, onEdit, onDelete }: StudentInfoTabProps) {
  // 훅은 항상 컴포넌트 최상단에서 호출되어야 함 (React Hooks 규칙)
  const terms = useIndustryTerms();
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const { toast } = useToast();

  // [성능 최적화] 디버깅 로그는 개발 환경에서만 실행
  // 프로덕션에서는 제거되어 번들 크기 감소
  // [PII 보안] PII 필드는 마스킹하여 로깅
  // [P2-1 수정] 동적 import 캐싱: module-scope 함수 사용
  useEffect(() => {
    if (import.meta.env?.DEV) {
      void getMaskPII().then((maskPII) => {
        logInfo('StudentInfoTab:Debug', 'student prop', maskPII({
          id: student?.id,
          name: student?.name,
          birth_date: student?.birth_date,
          gender: student?.gender,
          phone: student?.phone,
          attendance_number: student?.attendance_number,
          father_phone: student?.father_phone,
          mother_phone: student?.mother_phone,
          address: student?.address,
          school_name: student?.school_name,
          grade: student?.grade,
          status: student?.status,
          notes: student?.notes,
        }));
        logInfo('StudentInfoTab:Debug', 'isEditing', isEditing);
      });
    }
  }, [student, isEditing]);

  // defaultValues를 useMemo로 메모이제이션하여 student 변경 시 재계산
  // [중요] 모든 Hook은 조건문 이전에 호출되어야 함
  const formDefaultValues = useMemo(() => {
    return {
      name: student.name || '',
      birth_date: student.birth_date || '',
      gender: student.gender || '',
      phone: student.phone || '',
      attendance_number: student.attendance_number || '',
      father_phone: student.father_phone || '',
      mother_phone: student.mother_phone || '',
      address: student.address || '',
      school_name: student.school_name || '',
      grade: student.grade || '',
      status: student.status || 'active',
      notes: student.notes || '',
    };
  }, [student]);

  // [P2-1 수정] useMemo 내부 dynamic import 로깅을 useEffect로 이동
  // StrictMode/리렌더 상황에서 메모 계산이 순수하지 않게 되어 예측 불가한 로그 반복 방지
  // [P2-1 수정] 동적 import 캐싱: module-scope 함수 사용
  useEffect(() => {
    if (import.meta.env?.DEV) {
      // 디버깅: formDefaultValues 계산 확인
      // [PII 보안] PII 필드는 마스킹하여 로깅
      void getMaskPII().then((maskPII) => {
        logInfo('StudentInfoTab:FormDefaultValues', 'formDefaultValues 계산', maskPII(formDefaultValues));
      });
    }
  }, [formDefaultValues]);

  // 수정 모드를 위한 스키마 (submit 버튼 커스터마이징)
  // [중요] 모든 Hook은 조건문 이전에 호출되어야 함
  const editSchema = useMemo(() => ({
    ...effectiveStudentFormSchema,
    form: {
      ...effectiveStudentFormSchema.form,
      submit: {
        label: '저장',
        variant: 'solid' as const,
        color: 'primary' as const,
        size: 'md' as const,
      },
    },
  }), [effectiveStudentFormSchema]);

  // 조회(읽기) 모드 스키마: 수정폼과 동일 레이아웃을 쓰되, 모든 필드를 disabled 처리
  // [중요] Hook은 조건문 밖에서 호출되어야 함
  // 디버깅: SchemaForm 렌더링 확인
  // [중요] 모든 Hook은 조건문 이전에 호출되어야 함
  // [PII 보안] PII 필드는 마스킹하여 로깅
  // [P2-1 수정] 동적 import 캐싱: module-scope 함수 사용
  useEffect(() => {
    if (isEditing && import.meta.env?.DEV) {
      void getMaskPII().then((maskPII) => {
        logInfo('StudentInfoTab:SchemaForm', 'SchemaForm 렌더링', maskPII({
          studentId: student.id,
          formDefaultValues,
          editSchemaFields: editSchema.form?.fields?.map(f => f.name),
        }));
      });
    }
  }, [isEditing, student.id, formDefaultValues, editSchema]);

  // 읽기 전용 모드: 수정폼과 동일한 2열 레이아웃, 텍스트만 출력 (아이콘/드롭다운 없음)
  // 필드 정의 (수정폼 스키마와 동일한 순서/구조)
  const readOnlyFields = useMemo(() => [
    { label: '이름', value: student.name || '-' },
    { label: '생년월일', value: student.birth_date || '-' },
    { label: '성별', value: student.gender === 'male' ? '남' : student.gender === 'female' ? '여' : '-' },
    { label: '전화번호', value: student.phone || '-' },
    { label: '출결번호', value: student.attendance_number || '-' },
    { label: '상태', value: student.status === 'active' ? '재원' : student.status === 'on_leave' ? '휴원' : student.status === 'withdrawn' ? '퇴원' : student.status === 'graduated' ? '졸업' : '-' },
    { label: '아버지 전화번호', value: student.father_phone || '-' },
    { label: '어머니 전화번호', value: student.mother_phone || '-' },
    { label: '학교', value: student.school_name || '-' },
    { label: '학년', value: student.grade || '-' },
    { label: '주소', value: student.address || '-', colSpan: 2 },
    { label: '메모', value: student.notes || '-', colSpan: 2 },
  ], [student]);

  if (!isEditing) {
    return (
      <div>
        <LayerSectionHeader
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <User size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
              기본정보
            </span>
          }
        />
        <Card
          padding="md"
                  >
        {/* 수정폼과 동일한 2열 그리드 레이아웃, 텍스트만 출력 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobileMode ? '1fr' : 'repeat(2, minmax(0, 1fr))',
            gap: 'var(--spacing-md)',
          }}
        >
          {readOnlyFields.map((field, idx) => (
            <div
              key={idx}
              style={{
                // 모바일 기본보기: 1열이므로 colSpan 2도 span 1로 강제
                gridColumn: field.colSpan === 2 ? (isMobileMode ? 'span 1' : 'span 2') : undefined,
                display: 'flex',
                width: '100%',
                alignItems: field.label === '메모' ? 'flex-start' : 'center',
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
                  whiteSpace: field.label === '메모' ? 'pre-wrap' : 'nowrap',
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
        {(onEdit || onDelete) && (
          <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
            <IconButtonGroup
              align="right"
              items={[
                ...(onDelete ? [{
                  icon: Trash2,
                  tooltip: '삭제',
                  variant: 'outline' as const,
                  color: 'error' as const,
                  onClick: async () => {
                    // [P1-3 수정] await 없는 onDelete에서 실패 시 사용자 피드백 추가
                    try {
                      await onDelete?.();
                    } catch (error) {
                      toast(error instanceof Error ? error.message : '삭제에 실패했습니다.', 'error');
                    }
                  },
                }] : []),
                ...(onEdit ? [{
                  icon: Pencil,
                  tooltip: '수정',
                  variant: 'outline' as const,
                  onClick: onEdit,
                }] : []),
              ]}
            />
          </div>
        )}
        </Card>
      </div>
    );
  }

  // 수정 모드: SchemaForm 사용
  const handleSubmit = async (data: Record<string, unknown>) => {
    // 스키마에서 받은 데이터를 UpdateStudentInput 형식으로 변환
    // [P0-1 수정] 빈 문자열 처리: CreateStudent와 일치하도록 빈 문자열을 null로 정규화
    // 서버가 "삭제는 null" 규칙을 따르므로, 빈 문자열은 null로 변환
    // [SSOT] toNullable은 utils/data-normalization-utils.ts에서 SSOT로 관리

    const updateData = {
      name: data.name ?? student.name,
      birth_date: toNullable(data.birth_date),
      gender: toNullable(data.gender),
      phone: toNullable(data.phone),
      attendance_number: toNullable(data.attendance_number),
      father_phone: toNullable(data.father_phone),
      mother_phone: toNullable(data.mother_phone),
      address: toNullable(data.address),
      school_name: toNullable(data.school_name),
      grade: toNullable(data.grade),
      status: data.status ?? student.status,
      notes: toNullable(data.notes),
    };
    await onSave(updateData);
  };

  return (
    <div>
      <LayerSectionHeader
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <User size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
            {terms.PERSON_LABEL_PRIMARY}정보 수정
          </span>
        }
      />
      <SchemaForm
        key={student.id} // student.id를 key로 사용하여 학생 변경 시 폼 재마운트
        schema={{
          ...editSchema,
          form: {
            ...editSchema.form,
            // [P0-1 수정] actions를 명시적으로 비활성화하여 SchemaForm이 자동 API 호출을 하지 않도록 함
            // handleSubmit에서 onSave를 통해 직접 처리
            actions: [],
          },
          // 최상위 actions도 비활성화
          actions: [],
        }}
        onSubmit={handleSubmit}
        defaultValues={formDefaultValues}
        // [P1-6 수정] actions를 비활성화했으므로 apiClient prop 불필요 (SchemaForm 내부 참조 경로 차단)
        // apiClient={apiClient}
        disableCardPadding={false}
        cardTitle={undefined}
        onCancel={onCancel}
        onDelete={onDelete}
      />
    </div>
  );
}
