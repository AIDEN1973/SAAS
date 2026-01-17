// LAYER: UI_COMPONENT
/**
 * TagsTab Component
 *
 * 태그관리 탭
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 * [불변 규칙] SSOT UI 디자인 준수
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import { useResponsiveMode, useToast, IconButtonGroup, Card, isMobile, isTablet, useIconSize, useIconStrokeWidth, Drawer, ActionButtonGroup, EmptyState } from '@ui-core/react';
import { Tag as TagIcon, Pencil, X as XIcon, Save } from 'lucide-react';
import { SchemaFormWithMethods } from '@schema-engine';
import { useIndustryTranslations } from '@hooks/use-industry-translations';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { LayerSectionHeader } from '../components/LayerSectionHeader';
import { PlusIcon } from '../../../components/DataTableActionButtons';
import { useStudentTags } from '@hooks/use-student';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { logWarn, processTagInput, p } from '../../../utils';
import type { FormSchema } from '@schema-engine/types';
import type { Tag } from '@core/tags';
import type { UseFormReturn } from 'react-hook-form';

// [P2-QUALITY-1 해결] processTagInput 함수는 utils/data-normalization-utils.ts에서 SSOT로 관리
// import { processTagInput } from '../../../utils';

// 태그 탭 컴포넌트
export interface TagsTabProps {
  studentTags: Array<{ id: string; name: string; color: string }>;
  isLoading: boolean;
  studentId: string;
  onUpdateTags: (tagIds: string[]) => Promise<void>;
  isEditable?: boolean;
  tagFormSchema: FormSchema;
}

export function TagsTab({ studentTags, isLoading, studentId, onUpdateTags, isEditable = true, tagFormSchema }: TagsTabProps) {
  // Automation & AI Industry-Neutral Rule (SSOT): Industry Adapter를 통한 translations 생성
  const tagTranslations = useIndustryTranslations(tagFormSchema);
  const terms = useIndustryTerms();

  // [P0-1 수정] tagFormSchema의 actions를 명시적으로 비활성화하여 SchemaFormWithMethods가 자동 API 호출을 하지 않도록 함
  // handleCreateTag에서 직접 처리하므로 스키마의 자동 API 동작을 완전히 차단
  const safeTagFormSchema = useMemo(() => ({
    ...tagFormSchema,
    form: { ...tagFormSchema.form, actions: [] },
    actions: [],
  }), [tagFormSchema]);
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);
  const { data: allTags, isLoading: allTagsLoading, refetch: refetchTags } = useStudentTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempSelectedTagIds, setTempSelectedTagIds] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const context = getApiContext();
  // [P1-1] tenantId는 queryKey 네임스페이스용 (서버 전달 아님, Zero-Trust 규칙 준수)
  const tenantId = context.tenantId;
  const { toast } = useToast();

  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  // const baseIconSize = useIconSize();
  // const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  // const emptyStateIconStrokeWidth = useIconStrokeWidth();

  // [P1-4 수정] RGB를 HEX로 변환하는 유틸리티 함수
  // DB가 hex 포맷을 기대하는 경우를 대비하여 rgb/rgba를 hex로 변환
  // [P0-3 수정] 하드코딩 fallback 제거: 테마 컬러를 읽을 수 없으면 에러로 처리
  // 운영에서 테마 토큰이 항상 정의되도록 강제 (하드코딩 금지 규칙 준수)
  const rgbToHex = (rgb: string): string => {
    // rgb(34, 197, 94) 또는 rgba(34, 197, 94, 0.5) 형식 파싱
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      return `#${[r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('')}`;
    }
    // 이미 hex 형식이면 그대로 반환
    if (rgb.startsWith('#')) {
      return rgb;
    }
    // [P0-3 수정] 변환 실패 시 에러: 하드코딩 금지 규칙 준수
    throw new Error(`색상 변환 실패: ${rgb}. 테마 컬러(--color-primary)를 읽을 수 없습니다. 테마 설정을 확인하세요.`);
  };

  const createTag = useMutation({
    mutationFn: async (data: { name: string }) => {
      // 인더스트리 테마 색상 가져오기
      // [불변 규칙] 하드코딩 금지: CSS 변수만 사용
      // getComputedStyle로 CSS 변수 값을 가져오고, 없으면 CSS 변수 문자열 자체를 사용
      // [P1-4 수정] DB가 hex 포맷을 기대하는 경우를 대비하여 rgb를 hex로 변환
      let primaryColor = 'var(--color-primary)';
      if (typeof window !== 'undefined') {
        const computedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
        if (computedColor) {
          // rgb/rgba 형식이면 hex로 변환, 이미 hex이면 그대로 사용
          primaryColor = computedColor.startsWith('rgb') ? rgbToHex(computedColor) : computedColor;
        }
      }

      // [P1-1 수정] processTagInput 규칙 재사용: 입력 표준화 규칙 통일
      // processTagInput은 "쉼표 뒤 공백 1개 허용" 규칙을 따르므로, 저장 시에도 동일 규칙 적용
      const processedInput = processTagInput(data.name);
      const tagNames = processedInput
        .split(',')
        .map((name) => {
          // processTagInput 결과에서 쉼표 뒤 공백 1개는 이미 포함되어 있으므로, 최종 저장 시에는 제거
          // (DB에는 공백 없는 순수 태그명 저장)
          return name.trim().replace(/\s+/g, '');
        })
        .filter((name) => name.length > 0);

      // [P1-2 수정] 중복 제거: 대소문자 구분 없이 Set으로 dedupe
      const uniqueTagNames = Array.from(new Set(tagNames.map(name => name.toLowerCase())));
      // 원본 대소문자 유지 (첫 번째 발견된 대소문자 사용)
      const dedupedTagNames = uniqueTagNames.map(lowerName => {
        const original = tagNames.find(name => name.toLowerCase() === lowerName);
        return original || lowerName;
      });

      if (dedupedTagNames.length === 0) {
        throw new Error('태그 이름을 입력해주세요.');
      }

      // [P1-4 수정] createdOrLinkedTags: 새로 생성된 태그 + 기존 태그(재사용) 모두 포함
      // onSuccess에서 선택 태그 목록 업데이트에 사용되므로, 생성/연결 구분 없이 모두 포함
      const createdOrLinkedTags: Tag[] = [];
      const errors: string[] = [];

      // 기존 태그 목록에서 같은 이름의 태그 찾기
      const existingTags = allTags || [];
      const existingTagsMap = new Map<string, { id: string; name: string; color: string }>();
      existingTags.forEach((tag) => {
        existingTagsMap.set(tag.name.toLowerCase(), tag);
      });

      // 여러 태그 생성 및 개별회원 전용 태그로 할당
      for (const tagName of dedupedTagNames) {
        try {
          let tagId: string | undefined;

          // 기존 태그가 있는지 확인
          const existingTag = existingTagsMap.get(tagName.toLowerCase());
          if (existingTag) {
            // 기존 태그 사용
            tagId = existingTag.id;
          } else {
            // 새 태그 생성
            const tagResponse = await apiClient.post<Tag>('tags', {
              name: tagName,
              color: primaryColor,
              entity_type: 'student',
            });

            if (tagResponse.error || !tagResponse.data) {
              // [P2-9 수정] 중복 키 오류 감지: 에러 메시지 의존 대신 에러 코드 기반으로 변경
              // PostgreSQL 에러 코드 23505 (unique_violation) 사용
              const isDuplicateKeyError = tagResponse.error?.code === '23505' ||
                tagResponse.error?.message?.includes('duplicate key') ||
                tagResponse.error?.message?.includes('unique constraint');
              if (isDuplicateKeyError) {
                // 태그 목록을 다시 불러와서 확인
                const refetchResponse = await refetchTags();
                const refetchedTags = refetchResponse.data || [];
                const foundTag = refetchedTags.find(
                  (t) => t.name.toLowerCase() === tagName.toLowerCase()
                );
                if (foundTag) {
                  tagId = foundTag.id;
                  // [P1-1 수정] 중복키 처리 시 foundTag도 createdOrLinkedTags에 추가
                  // onSuccess에서 selectedTagIds 업데이트에 사용되므로 생성/연결 구분 없이 모두 포함
                  createdOrLinkedTags.push({
                    id: foundTag.id,
                    name: foundTag.name,
                    color: foundTag.color,
                  } as Tag);
                } else {
                  errors.push(`${tagName}: ${tagResponse.error?.message || '태그 생성 실패'}`);
                  continue;
                }
              } else {
                errors.push(`${tagName}: ${tagResponse.error?.message || '태그 생성 실패'}`);
                continue;
              }
            } else {
              tagId = tagResponse.data.id;
              createdOrLinkedTags.push(tagResponse.data);
            }
          }

          if (!tagId) {
            errors.push(`${tagName}: 태그를 찾을 수 없습니다.`);
            continue;
          }

          // [P1-4 수정] 기존 태그를 사용한 경우에도 createdOrLinkedTags에 추가 (할당 목적)
          // onSuccess에서 선택 태그 목록 업데이트에 사용되므로 생성/연결 구분 없이 모두 포함
          if (existingTag) {
            // Tag 타입으로 변환 (필요한 필드만 포함)
            createdOrLinkedTags.push({
              id: existingTag.id,
              name: existingTag.name,
              color: existingTag.color,
            } as Tag);
          }

          // 개별회원 전용 태그로 할당 (즉시 해당 학생에게 할당)
          // 이미 할당되어 있는지 확인하지 않고 할당 시도 (중복은 서버에서 처리)
          const assignmentResponse = await apiClient.post('tag_assignments', {
            entity_id: studentId,
            entity_type: 'student',
            tag_id: tagId,
          });

          if (assignmentResponse.error) {
            // [P1-5 수정] 타입 안전성: optional chaining으로 안전하게 접근
            // [P1-2 수정] 중복 할당 오류 감지: 에러 코드 기반으로 통일 (태그 생성과 동일)
            // PostgreSQL 에러 코드 23505 (unique_violation) 사용
            const code = assignmentResponse.error?.code;
            const isDuplicateKeyError = code === '23505' ||
              assignmentResponse.error?.message?.includes('duplicate key') ||
              assignmentResponse.error?.message?.includes('unique constraint');
            // 중복 할당 오류는 무시 (이미 할당된 경우)
            if (!isDuplicateKeyError) {
              errors.push(`${tagName} 할당 실패: ${assignmentResponse.error.message}`);
            }
          }
        } catch (error) {
          errors.push(`${tagName}: ${error instanceof Error ? error.message : '태그 생성 실패'}`);
        }
      }

      if (createdOrLinkedTags.length === 0) {
        throw new Error(errors.length > 0 ? errors.join(', ') : '태그 생성에 실패했습니다.');
      }

      if (errors.length > 0) {
        toast(
          `${createdOrLinkedTags.length}개 태그 생성/연결 완료, ${errors.length}개 실패: ${errors.join(', ')}`,
          'warning',
          '부분 성공'
        );
      }

      return createdOrLinkedTags;
    },
    onSuccess: (createdOrLinkedTags) => {
      void queryClient.invalidateQueries({ queryKey: ['tags', tenantId, 'student'] });
      void queryClient.invalidateQueries({ queryKey: ['student-tags', tenantId, studentId] });
      void refetchTags();
      setShowForm(false);

      // [P1-4 수정] 생성/연결된 태그를 선택된 태그 목록에 추가 (생성/연결 구분 없이 모두 포함)
      // [P1-2 수정] 중복 제거: Set으로 중복 tagId 제거
      if (createdOrLinkedTags.length > 0) {
        const newTagIds = createdOrLinkedTags.map((tag) => tag.id);
        setSelectedTagIds((prev) => Array.from(new Set([...prev, ...newTagIds])));
        toast(`${createdOrLinkedTags.length}개 태그가 생성/연결되고 할당되었습니다.`, 'success');
      }
    },
    onError: (error: Error) => {
      toast(error.message || '태그 생성에 실패했습니다.', 'error');
    },
  });

  useEffect(() => {
    if (studentTags) {
      setSelectedTagIds(studentTags.map((tag) => tag.id));
    }
  }, [studentTags]);

  // 수정 모드 진입 시 임시 선택 상태 초기화
  useEffect(() => {
    if (isEditMode) {
      setTempSelectedTagIds([...selectedTagIds]);
    }
  }, [isEditMode, selectedTagIds]);

  // [P1-4 수정] 태그 즉시 저장 레이스 컨디션 방지: 저장 중 상태 관리
  const [isSavingTag, setIsSavingTag] = useState(false);

  const handleTagToggle = async (tagId: string) => {
    // 수정 모드가 아닐 때만 즉시 저장
    if (!isEditMode) {
      // [P1-4 수정] 저장 중이면 무시 (레이스 컨디션 방지)
      if (isSavingTag) return;

      // [P1-5 수정] race condition 방지: prev를 캡처하여 rollback에 사용
      const prevIds = selectedTagIds;
      const newIds = prevIds.includes(tagId)
        ? prevIds.filter((id) => id !== tagId)
        : [...prevIds, tagId];

      setSelectedTagIds(newIds);
      setIsSavingTag(true);

      // 즉시 저장
      try {
        await onUpdateTags(newIds);
      } catch (error) {
        // 실패 시 캡처한 prevIds로 복원 (stale closure 방지)
        setSelectedTagIds(prevIds);
        toast(error instanceof Error ? error.message : '태그 저장에 실패했습니다.', 'error');
      } finally {
        setIsSavingTag(false);
      }
    } else {
      // 수정 모드에서는 임시 상태만 변경
      setTempSelectedTagIds((prev) => {
        return prev.includes(tagId)
          ? prev.filter((id) => id !== tagId)
          : [...prev, tagId];
      });
    }
  };

  const handleSaveTags = async () => {
    try {
      // [P0-3 수정] 태그 엔티티 삭제 제거: onUpdateTags가 tag_assignments만 업데이트
      // 태그가 다른 학생/엔티티에서도 사용될 수 있으므로 태그 자체를 삭제하면 안 됨
      // 태그 할당만 업데이트 (해제된 태그의 할당은 onUpdateTags 내부에서 자동 제거됨)
      await onUpdateTags(tempSelectedTagIds);
      setSelectedTagIds(tempSelectedTagIds);
      setIsEditMode(false);
      setShowForm(false);

      // 태그 목록 새로고침
      void queryClient.invalidateQueries({ queryKey: ['tags', tenantId, 'student'] });
      void refetchTags();

      toast('태그가 저장되었습니다.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : '태그 저장에 실패했습니다.', 'error');
    }
  };

  // hex/rgb 색상을 rgba로 변환하여 opacity 적용
  // [P0-4 수정] hex뿐만 아니라 rgb() 형식도 지원
  // [P1-5 수정] CSS 변수(var(--...))는 변환 불가: DB에 HEX 저장하도록 createTag에서 처리
  // var(--...)가 들어오면 opacity가 적용되지 않으므로, 가능하면 DB에는 항상 HEX 저장 권장
  const hexToRgba = (color: string, opacity: number) => {
    // CSS 변수 문자열인 경우 처리 불가 (런타임에만 값 알 수 있음)
    if (color.startsWith('var(')) {
      // CSS 변수는 color-mix() 사용 권장, 여기서는 fallback으로 투명도 적용 불가
      // [P1-5] DB에 HEX 저장하도록 createTag에서 처리하므로, var(--...)는 일반적으로 들어오지 않음
      // [P2-2 수정] 운영 로그 오염 방지: DEV 환경에서만 경고
      if (import.meta.env?.DEV) {
        logWarn('StudentsPage:hexToRgba', 'CSS 변수는 직접 변환 불가, color-mix() 사용 권장 또는 DB에 HEX 저장');
      }
      return color;
    }

    // rgb/rgba 형식 처리
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${opacity})`;
    }

    // hex 형식 처리 (#RRGGBB 또는 #RGB)
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      // 3자리 hex를 6자리로 확장
      const fullHex = hex.length === 3
        ? hex.split('').map(c => c + c).join('')
        : hex;

      if (fullHex.length === 6) {
        const r = parseInt(fullHex.slice(0, 2), 16);
        const g = parseInt(fullHex.slice(2, 4), 16);
        const b = parseInt(fullHex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      }
    }

    // 변환 실패 시 원본 반환
    // [P2-2 수정] 운영 로그 오염 방지: DEV 환경에서만 경고
    if (import.meta.env?.DEV) {
      logWarn('StudentsPage:hexToRgba', `지원하지 않는 색상 형식: ${color}`);
    }
    return color;
  };

  // [타입 안정성] any 타입 제거, 명시적 타입 체크
  const handleCreateTag = async (data: Record<string, unknown>) => {
    if (typeof data.name !== 'string' || !data.name.trim()) {
      throw new Error('태그 이름은 필수입니다.');
    }
    await createTag.mutateAsync({
      name: data.name,
    });
  };

  // 태그 등록 폼의 form 인스턴스 참조
  const tagFormRef = useRef<UseFormReturn<Record<string, unknown>> | null>(null);

  if (isLoading || allTagsLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div style={{ paddingBottom: isMobileMode ? 'var(--spacing-bottom-action-bar)' : 'var(--spacing-none)' }}>

      {showForm && (
        <>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <TagIcon size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                {isEditMode ? `${terms.TAG_LABEL} 수정` : `${terms.TAG_LABEL} 추가`}
              </span>
            }
          />
          {isEditMode ? (
            // 수정 모드: 태그 선택/해제 UI
            <>
              {isMobileMode || isTabletMode ? (
                <Drawer
                  isOpen={showForm}
                  onClose={() => {
                    setShowForm(false);
                    setIsEditMode(false);
                    setTempSelectedTagIds([]);
                  }}
                  title={`${terms.TAG_LABEL} 수정`}
                  position={isMobileMode ? 'bottom' : 'right'}
                  width={isTabletMode ? 'var(--width-drawer-tablet)' : 'var(--width-full)'}
                >
                  <div style={{ padding: 'var(--spacing-md)' }}>
                    <Card
                      padding="md"
                      variant="default"
                      title={`${terms.TAG_LABEL} 선택`}
                      titleIcon={<TagIcon size={titleIconSize} strokeWidth={titleIconStrokeWidth} />}
                      titlePosition="top-left"
                    >
                      {allTags && allTags.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', paddingTop: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                          {allTags.map((tag) => {
                            const isSelected = tempSelectedTagIds.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => handleTagToggle(tag.id)}
                                // [P1-4] 수정 모드에서는 disabled 불필요 (임시 상태만 변경)
                                style={{
                                  padding: 'var(--spacing-sm) var(--spacing-md)',
                                  fontSize: 'var(--font-size-base)',
                                  fontWeight: 'var(--font-weight-medium)',
                                  fontFamily: 'var(--font-family)',
                                  lineHeight: 'var(--line-height)',
                                  // 요구사항: 카드 라운드 한 단계 축소 (xl -> lg)
                                  // 요구사항: 태그배지 라운드 한 단계 증가 (lg -> xl)
                                  borderRadius: 'var(--border-radius-xl)',
                                  border: `var(--border-width-thin) solid ${isSelected ? tag.color : 'var(--color-gray-300)'}`,
                                  color: isSelected ? tag.color : 'var(--color-text-secondary)',
                                  backgroundColor: isSelected ? hexToRgba(tag.color, 0.1) : 'transparent',
                                  cursor: 'pointer',
                                  transition: 'var(--transition-all)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {tag.name}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <EmptyState
                          icon={TagIcon}
                          message={`등록된 ${terms.TAG_LABEL}${p.이가(terms.TAG_LABEL)} 없습니다.`}
                        />
                      )}
                      {/* 요구사항: 태그수정 > 취소/저장 버튼은 학생관리 수정폼처럼 텍스트+아이콘 함께 출력 */}
                      <ActionButtonGroup
                        marginTop="xl"
                        gap="sm"
                        iconVariant="small"
                        items={[
                          {
                            key: 'tags-edit-cancel',
                            label: '취소',
                            icon: <XIcon />,
                            variant: 'outline',
                            onClick: () => {
                              setShowForm(false);
                              setIsEditMode(false);
                              setTempSelectedTagIds([]);
                            },
                          },
                          {
                            key: 'tags-edit-save',
                            label: '저장',
                            icon: <Save />,
                            variant: 'solid',
                            color: 'primary',
                            onClick: handleSaveTags,
                          },
                        ]}
                      />
                    </Card>
                  </div>
                </Drawer>
              ) : (
                <Card padding="md">
                  {allTags && allTags.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', paddingTop: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                      {allTags.map((tag) => {
                        const isSelected = tempSelectedTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => handleTagToggle(tag.id)}
                            style={{
                              padding: 'var(--spacing-sm) var(--spacing-md)',
                              fontSize: 'var(--font-size-base)',
                              fontWeight: 'var(--font-weight-medium)',
                              fontFamily: 'var(--font-family)',
                              lineHeight: 'var(--line-height)',
                              // 요구사항: 카드 라운드 한 단계 축소 (xl -> lg)
                              // 요구사항: 태그배지 라운드 한 단계 증가 (lg -> xl)
                              borderRadius: 'var(--border-radius-xl)',
                              border: `var(--border-width-thin) solid ${isSelected ? tag.color : 'var(--color-gray-300)'}`,
                              color: isSelected ? tag.color : 'var(--color-text-secondary)',
                              backgroundColor: isSelected ? hexToRgba(tag.color, 0.1) : 'transparent',
                              cursor: 'pointer',
                              transition: 'var(--transition-all)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      icon={TagIcon}
                      message={`등록된 ${terms.TAG_LABEL}${p.이가(terms.TAG_LABEL)} 없습니다.`}
                    />
                  )}
                  {/* 요구사항: 태그수정 > 취소/저장 버튼은 학생관리 수정폼처럼 텍스트+아이콘 함께 출력 */}
                  <ActionButtonGroup
                    marginTop="xl"
                    gap="sm"
                    iconVariant="small"
                    items={[
                      {
                        key: 'tags-edit-cancel',
                        label: '취소',
                        icon: <XIcon />,
                        variant: 'outline',
                        onClick: () => {
                          setShowForm(false);
                          setIsEditMode(false);
                          setTempSelectedTagIds([]);
                        },
                      },
                      {
                        key: 'tags-edit-save',
                        label: '저장',
                        icon: <Save />,
                        variant: 'solid',
                        color: 'primary',
                        onClick: handleSaveTags,
                      },
                    ]}
                  />
                </Card>
              )}
            </>
          ) : (
            // 등록 모드: 태그 생성 폼
            <SchemaFormWithMethods
              schema={safeTagFormSchema}
              translations={tagTranslations}
              onSubmit={handleCreateTag}
              onCancel={() => {
                setShowForm(false);
                if (tagFormRef.current) {
                  tagFormRef.current.reset();
                }
              }}
              cardTitle={undefined}
              disableCardPadding={false}
              cancelLabel="취소"
              formRef={tagFormRef}
            />
          )}
        </>
      )}

      {!showForm && (
        <div>
          <LayerSectionHeader
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <TagIcon size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                {`${terms.TAG_LABEL} 관리`}
              </span>
            }
            right={
              isEditable ? (
                <IconButtonGroup
                  items={[
                    {
                      icon: PlusIcon,
                      tooltip: `${terms.TAG_LABEL} 추가`,
                      variant: 'solid',
                      color: 'primary',
                      onClick: () => setShowForm(true),
                    },
                  ]}
                  align="right"
                />
              ) : null
            }
          />
          <Card padding="md">
        {selectedTagIds.length > 0 && allTags ? (
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', paddingTop: 'var(--spacing-sm)' }}>
              {allTags
                .filter((tag) => selectedTagIds.includes(tag.id))
                .map((tag) => (
                  <div
                    key={tag.id}
                    style={{
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      fontSize: 'var(--font-size-base)',
                      fontWeight: 'var(--font-weight-medium)',
                      fontFamily: 'var(--font-family)',
                      lineHeight: 'var(--line-height)',
                      // 요구사항: 카드 라운드 한 단계 축소 (xl -> lg)
                      // 요구사항: 태그배지 라운드 한 단계 증가 (lg -> xl)
                      borderRadius: 'var(--border-radius-xl)',
                      border: `var(--border-width-thin) solid ${tag.color}`,
                      color: tag.color,
                      backgroundColor: hexToRgba(tag.color, 0.1),
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tag.name}
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={TagIcon}
            message={`등록된 ${terms.TAG_LABEL}${p.이가(terms.TAG_LABEL)} 없습니다.`}
          />
        )}

        {/* 요구사항: 페이지별 카드 헤더 우측 수정 버튼 제거 → 카드 하단 우측 수정 버튼 */}
        {isEditable && allTags && allTags.length > 0 && (
          <div style={{ width: '100%', paddingTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
            <IconButtonGroup
              align="right"
              items={[
                {
                  icon: Pencil,
                  tooltip: '수정',
                  variant: 'outline',
                  onClick: () => {
                    setIsEditMode(true);
                    setShowForm(true);
                  },
                },
              ]}
            />
          </div>
        )}

          </Card>
        </div>
      )}
    </div>
  );
}
