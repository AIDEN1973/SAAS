// LAYER: UI_COMPONENT
/**
 * GuardiansTab Component
 *
 * 학부모 정보 탭
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 * [불변 규칙] SSOT UI 디자인 준수
 */
import React, { useState, useMemo } from 'react';
import { useModal, useResponsiveMode, useToast, IconButtonGroup, Card, isMobile, useIconSize, useIconStrokeWidth } from '@ui-core/react';
import { Users, Trash2, Pencil } from 'lucide-react';
import { BadgeSelect } from '../../../components/BadgeSelect';
import { SchemaForm } from '@schema-engine';
import { useIndustryTranslations } from '@hooks/use-industry-translations';
import { LayerSectionHeader } from '../components/LayerSectionHeader';
import { PlusIcon } from '../../../components/DataTableActionButtons';
import type { Guardian } from '@services/student-service';
import type { FormSchema } from '@schema-engine/types';

// 학부모 탭 컴포넌트
export interface GuardiansTabProps {
  guardians: Guardian[];
  isLoading: boolean;
  showForm: boolean;
  editingGuardianId: string | null;
  effectiveGuardianFormSchema: FormSchema;
  onShowForm: () => void;
  onHideForm: () => void;
  onEdit: (guardianId: string) => void;
  onCreate: (data: Record<string, unknown>) => Promise<void>;
  onUpdate: (guardianId: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (guardianId: string) => Promise<void>;
  isEditable?: boolean;
}

export function GuardiansTab({
  guardians,
  isLoading,
  showForm,
  editingGuardianId,
  effectiveGuardianFormSchema,
  onShowForm,
  onHideForm,
  onEdit,
  onCreate,
  onUpdate,
  onDelete,
  isEditable = true,
}: GuardiansTabProps) {
  const editingGuardian = editingGuardianId ? guardians.find((g) => g.id === editingGuardianId) : null;
  const { showConfirm } = useModal();
  const { toast } = useToast();
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const [relationshipFilter, setRelationshipFilter] = useState<'all' | 'parent' | 'guardian' | 'other'>('all');

  // Automation & AI Industry-Neutral Rule (SSOT): Industry Adapter를 통한 translations 생성
  const guardianTranslations = useIndustryTranslations(effectiveGuardianFormSchema);

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      // 주 보호자 처리:
      // - DB 레벨에 "주 보호자 1명" 제약이 없어서 복수 true가 들어갈 수 있음
      // - 하지만 다른 기능(예: 알림 발송 등)에서 is_primary=true 1명을 전제로 조회하므로
      //   새로 주 보호자를 true로 저장할 때 기존 주 보호자는 자동으로 false로 내림
      // [P1-4 수정] create/edit 모두 처리: 수정 모드에서도 is_primary=true로 바꾸면 기존 primary 내림
      // [P2-2 주의] 동시성 문제: 여러 관리자가 동시에 편집하면 경합 조건 발생 가능
      // 최종적으로는 DB 제약/트랜잭션(또는 RPC)로 "원자적 업데이트"가 제일 안전
      const wantsPrimary = Boolean((data as { is_primary?: unknown }).is_primary);
      if (wantsPrimary) {
        const currentPrimaryGuardians = guardians.filter((g) => g.is_primary && g.id !== editingGuardianId);
        if (currentPrimaryGuardians.length > 0) {
          // 사용자 확인 없이 자동 조정(UX 단순화)
          await Promise.all(
            currentPrimaryGuardians.map((g) => onUpdate(g.id, { is_primary: false }))
          );
        }
      }

      if (editingGuardianId) {
        await onUpdate(editingGuardianId, data);
      } else {
        await onCreate(data);
      }
      onHideForm();
    } catch (error) {
      toast(error instanceof Error ? error.message : '학부모 정보 저장에 실패했습니다.', 'error');
    }
  };

  // 타이틀 아이콘 크기 및 선 두께 계산 (CSS 변수 사용)
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  const baseIconSize = useIconSize();
  const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  const emptyStateIconStrokeWidth = useIconStrokeWidth();

  // 필터링된 학부모 목록
  const filteredGuardians = useMemo(() => {
    if (relationshipFilter === 'all') {
      return guardians;
    }
    return guardians.filter((guardian) => guardian.relationship === relationshipFilter);
  }, [guardians, relationshipFilter]);

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div>
      {showForm && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Users size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                {isEditable && editingGuardianId ? '학부모 정보 수정' : '학부모 추가'}
              </span>
            }
          />
          <SchemaForm
            schema={{
              ...effectiveGuardianFormSchema,
              form: {
                ...effectiveGuardianFormSchema.form,
                // [불변 규칙] actions를 명시적으로 비활성화하여 SchemaForm이 자동 API 호출을 하지 않도록 함
                // handleSubmit에서 onCreate/onUpdate를 통해 직접 처리
                actions: [],
              },
              // 최상위 actions도 비활성화
              actions: [],
            }}
            translations={guardianTranslations}
            onSubmit={handleSubmit}
            defaultValues={editingGuardian ? {
              name: editingGuardian.name,
              relationship: editingGuardian.relationship,
              phone: editingGuardian.phone || '',
              email: editingGuardian.email || '',
              is_primary: editingGuardian.is_primary || false,
              notes: editingGuardian.notes || '',
            } : {
              relationship: 'parent',
              is_primary: false,
            }}
            disableCardPadding={false}
            cardTitle={undefined}
            onCancel={onHideForm}
            onDelete={
              isEditable && editingGuardianId
                ? async () => {
                    const confirmed = await showConfirm('정말 삭제하시겠습니까?', '보호자 삭제');
                    if (!confirmed) return;
                    await onDelete(editingGuardianId);
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
                <Users size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                학부모 정보
              </span>
            }
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <BadgeSelect
                  value={relationshipFilter}
                  onChange={(value) => setRelationshipFilter(value as typeof relationshipFilter)}
                  options={[
                    { value: 'all', label: '전체' },
                    { value: 'parent', label: '부모' },
                    { value: 'guardian', label: '보호자' },
                    { value: 'other', label: '기타' },
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
                        tooltip: '학부모 추가',
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
          {filteredGuardians.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {filteredGuardians.map((guardian) => (
                <Card
                  key={guardian.id}
                  padding="md"
                >
                  {/* 기본보기: 수정폼과 동일한 레이아웃을 읽기 전용으로 렌더링 (아이콘/드롭다운 없음) */}
                  {(() => {
                    const readOnlyFields = [
                      { label: '이름', value: guardian.name || '-' },
                      {
                        label: '관계',
                        value: guardian.relationship === 'parent' ? '부모' : guardian.relationship === 'guardian' ? '보호자' : '기타',
                      },
                      { label: '전화번호', value: guardian.phone || '-' },
                      { label: '이메일', value: guardian.email || '-', },
                      { label: '주 보호자', value: guardian.is_primary ? '예' : '아니오' },
                      { label: '메모', value: guardian.notes || '-', colSpan: 2 },
                    ] as Array<{ label: string; value: string; colSpan?: 2 }>;

                    return (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobileMode ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                          // 기본정보(tab=info) 기본보기와 동일
                          gap: 'var(--spacing-md)',
                          // 기본정보(tab=info)에서는 정상인데 guardians에서만 밑줄이 짧아지는 케이스 방지:
                          // grid item이 내용 폭으로 줄어들지 않도록 강제
                          width: '100%',
                          justifyItems: 'stretch',
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
                              paddingTop: 'var(--spacing-sm)',
                              paddingBottom: 'var(--spacing-sm)',
                              paddingLeft: 'var(--spacing-form-horizontal-left)',
                              paddingRight: 'var(--spacing-form-horizontal-right)',
                              // tab=info와 동일하게 borderBottom 사용 (overflow: hidden 제거로 클리핑 해결)
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
                                  await onDelete(guardian.id);
                                } catch (error) {
                                  toast(error instanceof Error ? error.message : '보호자 삭제에 실패했습니다.', 'error');
                                }
                              })();
                            },
                          },
                          {
                            icon: Pencil,
                            tooltip: '수정',
                            variant: 'outline',
                            onClick: () => onEdit(guardian.id),
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
                <Users
                  size={emptyStateIconSize}
                  strokeWidth={emptyStateIconStrokeWidth}
                  style={{
                    color: 'var(--color-gray-300)',
                    marginBottom: 'var(--spacing-xs)',
                    display: 'inline-block',
                  }}
                />
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  {guardians.length === 0 ? '등록된 학부모가 없습니다.' : '필터 조건에 맞는 학부모가 없습니다.'}
                </p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
