// LAYER: UI_COMPONENT
/**
 * ConsultationsTab Component
 *
 * 상담일지 탭
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 * [불변 규칙] SSOT UI 디자인 준수
 */
import { useMemo, useRef } from 'react';
import { useModal, useResponsiveMode, useToast, IconButtonGroup, Card, isMobile, useIconSize, useIconStrokeWidth } from '@ui-core/react';
import { FileText, Trash2, Pencil, RefreshCcw } from 'lucide-react';
import { BadgeSelect } from '../../../components/BadgeSelect';
import { SchemaForm } from '@schema-engine';
import { useIndustryTranslations } from '@hooks/use-industry-translations';
import { LayerSectionHeader } from '../components/LayerSectionHeader';
import { PlusIcon } from '../../../components/DataTableActionButtons';
import { toKST } from '@lib/date-utils';
import type { StudentConsultation, ConsultationType } from '@services/student-service';
import type { FormSchema } from '@schema-engine/types';

// 상담일지 탭 컴포넌트
export interface ConsultationsTabProps {
  consultations: StudentConsultation[];
  isLoading: boolean;
  showForm: boolean;
  editingConsultationId: string | null;
  consultationTypeFilter: ConsultationType | 'all';
  effectiveConsultationFormSchema: FormSchema;
  onShowForm: () => void;
  onHideForm: () => void;
  onEdit: (consultationId: string) => void;
  onCreate: (data: Record<string, unknown>) => Promise<void>;
  onUpdate: (consultationId: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (consultationId: string) => Promise<void>;
  onGenerateAISummary: (consultationId: string) => Promise<void>;
  onFilterChange: (filter: ConsultationType | 'all') => void;
  isEditable?: boolean;
}

export function ConsultationsTab({
  consultations,
  isLoading,
  showForm,
  editingConsultationId,
  consultationTypeFilter,
  effectiveConsultationFormSchema,
  onShowForm,
  onHideForm,
  onEdit,
  onCreate,
  onUpdate,
  onDelete,
  onGenerateAISummary,
  onFilterChange,
  isEditable = true,
}: ConsultationsTabProps) {
  const editingConsultation = editingConsultationId ? consultations.find((c) => c.id === editingConsultationId) : null;
  const { showConfirm } = useModal();
  const { toast } = useToast();
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const formRef = useRef<HTMLDivElement>(null);

  // Automation & AI Industry-Neutral Rule (SSOT): Industry Adapter를 통한 translations 생성
  const consultationTranslations = useIndustryTranslations(effectiveConsultationFormSchema);

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  const baseIconSize = useIconSize();
  const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  const emptyStateIconStrokeWidth = useIconStrokeWidth();

  // 타이틀 아이콘 크기 및 선 두께 계산 (CSS 변수 사용)
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();

  // [P2-7 수정] DOM query 제거: textarea 높이는 schema의 ui 옵션으로 처리 권장
  // 현재는 DOM query로 처리하지만, SDUI 위젯이나 name 변경에 취약함
  // 향후 schema의 ui.minRows 또는 ui.style 옵션으로 이동 권장
  // useEffect(() => {
  //   if (showForm && formRef.current && !isMobile && !isTablet) {
  //     const form = formRef.current.querySelector('form');
  //     if (form) {
  //       const textarea = form.querySelector('textarea[name="content"]') as HTMLTextAreaElement;
  //       if (textarea) {
  //         textarea.style.minHeight = 'calc(var(--line-height) * var(--font-size-base) * 6 + var(--spacing-sm) * 2)';
  //       }
  //     }
  //   }
  // }, [showForm, isMobile, isTablet]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      if (editingConsultationId) {
        await onUpdate(editingConsultationId, data);
      } else {
        await onCreate(data);
      }
      onHideForm();
    } catch (error) {
      toast(error instanceof Error ? error.message : '상담일지 저장에 실패했습니다.', 'error');
    }
  };

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div>
      {showForm && (
        <div ref={formRef}>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <FileText size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                {editingConsultationId ? '상담일지 수정' : '상담일지 등록'}
              </span>
            }
          />
          <SchemaForm
            schema={{
              ...effectiveConsultationFormSchema,
              form: {
                ...effectiveConsultationFormSchema.form,
                // [P0-1 수정] actions를 명시적으로 비활성화하여 SchemaForm이 자동 API 호출을 하지 않도록 함
                // handleSubmit에서 onCreate/onUpdate를 통해 직접 처리
                actions: [],
              },
              // 최상위 actions도 비활성화
              actions: [],
            }}
            translations={consultationTranslations}
            onSubmit={handleSubmit}
            defaultValues={editingConsultation ? {
              consultation_date: editingConsultation.consultation_date,
              consultation_type: editingConsultation.consultation_type,
              content: editingConsultation.content,
            } : {
              consultation_date: toKST().format('YYYY-MM-DD'),
              consultation_type: 'counseling',
            }}
            disableCardPadding={false}
            cardTitle={undefined}
            onCancel={onHideForm}
            onDelete={
              isEditable && editingConsultationId
                ? async () => {
                    const confirmed = await showConfirm('정말 삭제하시겠습니까?', '상담일지 삭제');
                    if (!confirmed) return;
                    await onDelete(editingConsultationId);
                    onHideForm();
                  }
                : undefined
            }
          />
        </div>
      )}

      {!showForm && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <FileText size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                상담일지
              </span>
            }
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <BadgeSelect
                  value={consultationTypeFilter}
                  onChange={(value) => onFilterChange(value as ConsultationType | 'all')}
                  options={[
                    { value: 'all', label: '전체' },
                    { value: 'counseling', label: '상담일지' },
                    { value: 'learning', label: '학습일지' },
                    { value: 'behavior', label: '행동일지' },
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
                        tooltip: '일지등록',
                        variant: 'solid',
                        color: 'primary',
                        onClick: onShowForm,
                      },
                    ]}
                    align="right"
                  />
                )}
              </div>
            }
          />
          {consultations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {consultations.map((consultation) => (
                <Card
                  key={consultation.id}
                  padding="md"
                >
                  {/* 기본보기: 수정폼과 동일한 레이아웃을 읽기 전용으로 렌더링 */}
                  {(() => {
                    const typeLabel =
                      consultation.consultation_type === 'counseling' ? '상담일지'
                      : consultation.consultation_type === 'learning' ? '학습일지'
                      : consultation.consultation_type === 'behavior' ? '행동일지'
                      : '기타';

                    const readOnlyFields = [
                      { label: '상담일', value: consultation.consultation_date || '-' },
                      { label: '유형', value: typeLabel },
                      { label: '내용', value: consultation.content || '-', colSpan: 2 },
                      ...(consultation.ai_summary ? [{ label: 'AI 요약', value: consultation.ai_summary, colSpan: 2 as const }] : []),
                    ] as Array<{ label: string; value: string; colSpan?: 2 }>;

                    return (
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
                              alignItems: (field.label === '내용' || field.label === 'AI 요약') ? 'flex-start' : 'center',
                              paddingTop: 'var(--spacing-sm)',
                              paddingBottom: 'var(--spacing-sm)',
                              paddingLeft: 'var(--spacing-form-horizontal-left)',
                              paddingRight: 'var(--spacing-form-horizontal-right)',
                              // 요구사항: 기본보기 밑줄은 원래 연한 색상으로 복구
                              borderBottom: 'var(--border-width-thin) solid var(--color-table-row-border)',
                            }}
                          >
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
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {field.label}
                            </span>
                            <span
                              style={{
                                color: 'var(--color-text)',
                                fontSize: 'var(--font-size-base)',
                                fontFamily: 'var(--font-family)',
                                fontWeight: 'var(--font-weight-normal)',
                                lineHeight: 'var(--line-height)',
                                whiteSpace: (field.label === '내용' || field.label === 'AI 요약') ? 'pre-wrap' : 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {field.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {/* 요구사항: 기본보기 > 삭제/수정 버튼 텍스트 제거, IconButtonGroup 스타일(아이콘만) + 우측 정렬 */}
                  {isEditable && (
                    <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
                      <IconButtonGroup
                        align="right"
                        items={[
                          {
                            icon: Trash2,
                            tooltip: '삭제',
                            variant: 'outline',
                            color: 'error',
                            onClick: () => {
                              // [P1-3 수정] await 없는 onDelete에서 실패 시 사용자 피드백 추가
                              void (async () => {
                                try {
                                  await onDelete(consultation.id);
                                } catch (error) {
                                  toast(error instanceof Error ? error.message : '상담일지 삭제에 실패했습니다.', 'error');
                                }
                              })();
                            },
                          },
                          {
                            icon: RefreshCcw,
                            tooltip: consultation.ai_summary ? 'AI 재요약' : 'AI 요약',
                            variant: 'outline',
                            onClick: () => void onGenerateAISummary(consultation.id),
                          },
                          {
                            icon: Pencil,
                            tooltip: '수정',
                            variant: 'outline',
                            onClick: () => onEdit(consultation.id),
                          },
                        ]}
                      />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card padding="md">
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'calc(var(--spacing-xl) * 5)', // [불변 규칙] CSS 변수 사용
                padding: 'var(--spacing-xl)',
              }}>
                <FileText
                  size={emptyStateIconSize}
                  strokeWidth={emptyStateIconStrokeWidth}
                  style={{
                    color: 'var(--color-gray-300)',
                    marginBottom: 'var(--spacing-xs)',
                    display: 'inline-block',
                  }}
                />
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>등록된 상담일지가 없습니다.</p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
