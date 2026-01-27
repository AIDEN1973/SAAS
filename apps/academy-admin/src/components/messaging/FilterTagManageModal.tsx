/**
 * FilterTagManageModal - 필터 태그 관리 모달 컴포넌트
 *
 * [LAYER: UI_COMPONENT]
 * [불변 규칙] 업종 중립 용어 사용 (useIndustryTerms)
 * [불변 규칙] CSS 변수 사용 (design-system 토큰)
 * [불변 규칙] UI Core 컴포넌트 사용
 */

import { memo, useState, useEffect, useMemo } from 'react';
import { Modal, Input, Select, Button, Spinner } from '@ui-core/react';
import {
  useCreateFilterTag,
  useUpdateFilterTag,
  useDeleteFilterTag,
  type FilterTag,
} from '@hooks/use-filter-tags';
import {
  FILTER_CONDITION_CATALOG,
  FILTER_CATEGORY_CONFIG,
  getSortedCategories,
  type FilterConditionCategory,
  type FilterConditionType,
} from '@core/notification';

export interface FilterTagManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTag?: FilterTag | null;
}

// 색상 프리셋 목록
const COLOR_PRESETS = [
  '#FFC107', // Yellow
  '#FF6B6B', // Red
  '#51CF66', // Green
  '#4DABF7', // Blue
  '#845EF7', // Purple
  '#F06595', // Pink
  '#20C997', // Teal
  '#FFD43B', // Orange
  '#ADB5BD', // Gray
  '#339AF0', // Light Blue
];

// 카테고리 옵션 생성
const getCategoryOptions = () => {
  return getSortedCategories().map((config) => ({
    value: config.id,
    label: FILTER_CATEGORY_CONFIG[config.id]?.label ?? config.id,
  }));
};

// 조건 타입 옵션 생성 (카테고리별)
const getConditionTypeOptions = (category: FilterConditionCategory) => {
  return Object.entries(FILTER_CONDITION_CATALOG)
    .filter(([, config]) => config.category === category)
    .map(([type, config]) => ({
      value: type,
      label: config.name,
    }));
};

export const FilterTagManageModal = memo(function FilterTagManageModal({
  isOpen,
  onClose,
  editingTag,
}: FilterTagManageModalProps) {
  const createMutation = useCreateFilterTag();
  const updateMutation = useUpdateFilterTag();
  const deleteMutation = useDeleteFilterTag();

  // 폼 상태
  const [formData, setFormData] = useState<{
    name: string;
    category: FilterConditionCategory;
    condition_type: string;
    condition_params: Record<string, unknown>;
    color: string;
  }>({
    name: '',
    category: 'attendance',
    condition_type: '',
    condition_params: {},
    color: COLOR_PRESETS[0],
  });

  // 편집 모드 시 초기값 설정
  useEffect(() => {
    if (editingTag) {
      setFormData({
        name: editingTag.name,
        category: editingTag.category,
        condition_type: editingTag.condition_type,
        condition_params: editingTag.condition_params,
        color: editingTag.color,
      });
    } else {
      setFormData({
        name: '',
        category: 'attendance',
        condition_type: '',
        condition_params: {},
        color: COLOR_PRESETS[0],
      });
    }
  }, [editingTag, isOpen]);

  // 선택된 조건 설정 가져오기
  const selectedCondition = useMemo(() => {
    if (!formData.condition_type) return null;
    return FILTER_CONDITION_CATALOG[formData.condition_type as FilterConditionType];
  }, [formData.condition_type]);

  // 조건 타입 변경 시 파라미터 초기화
  useEffect(() => {
    if (selectedCondition) {
      const defaultParams: Record<string, unknown> = {};
      Object.entries(selectedCondition.params).forEach(([key, config]) => {
        if (config.default !== undefined) {
          defaultParams[key] = config.default;
        }
      });
      // 편집 모드일 때는 기존 파라미터 유지
      if (!editingTag || formData.condition_type !== editingTag.condition_type) {
        setFormData((prev) => ({
          ...prev,
          condition_params: defaultParams,
        }));
      }
    }
  }, [formData.condition_type, selectedCondition, editingTag]);

  // display_label 자동 생성
  const generateDisplayLabel = () => {
    const paramSummary = Object.entries(formData.condition_params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([, value]) => {
        if (Array.isArray(value)) {
          return value.length > 0 ? value.join(', ') : '';
        }
        return String(value);
      })
      .filter(Boolean)
      .join(' ');

    return `#${formData.name}${paramSummary ? ` ${paramSummary}` : ''}`;
  };

  // 폼 제출
  const handleSubmit = async () => {
    if (!formData.name || !formData.condition_type) return;

    const display_label = generateDisplayLabel();

    try {
      if (editingTag) {
        await updateMutation.mutateAsync({
          id: editingTag.id,
          name: formData.name,
          display_label,
          category: formData.category,
          condition_type: formData.condition_type,
          condition_params: formData.condition_params,
          color: formData.color,
        });
      } else {
        await createMutation.mutateAsync({
          name: formData.name,
          display_label,
          category: formData.category,
          condition_type: formData.condition_type,
          condition_params: formData.condition_params,
          color: formData.color,
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to save filter tag:', error);
    }
  };

  // 삭제 처리
  const handleDelete = async () => {
    if (!editingTag) return;

    const confirmed = window.confirm('이 태그를 삭제하시겠습니까?');
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(editingTag.id);
      onClose();
    } catch (error) {
      console.error('Failed to delete filter tag:', error);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const canSubmit = formData.name && formData.condition_type && !isSubmitting;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingTag ? '태그 수정' : '태그 생성'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {/* 태그 이름 */}
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: 'var(--spacing-xs)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)',
            }}
          >
            태그 이름 *
          </label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="예: 3일 연속 지각"
          />
        </div>

        {/* 카테고리 선택 */}
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: 'var(--spacing-xs)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)',
            }}
          >
            카테고리 *
          </label>
          <Select
            value={formData.category}
            onChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                category: value as FilterConditionCategory,
                condition_type: '', // 카테고리 변경 시 조건 타입 초기화
              }))
            }
            options={getCategoryOptions()}
          />
        </div>

        {/* 필터 조건 선택 */}
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: 'var(--spacing-xs)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)',
            }}
          >
            필터 조건 *
          </label>
          <Select
            value={formData.condition_type || '__placeholder__'}
            onChange={(value) => setFormData((prev) => ({ ...prev, condition_type: (value === '__placeholder__' ? '' : value) as string }))}
            options={[
              { value: '__placeholder__', label: '조건 선택...' },
              ...getConditionTypeOptions(formData.category),
            ]}
          />
          {selectedCondition && (
            <p
              style={{
                marginTop: 'var(--spacing-xs)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              {selectedCondition.description}
            </p>
          )}
        </div>

        {/* 조건 파라미터 */}
        {selectedCondition && Object.keys(selectedCondition.params).length > 0 && (
          <div
            style={{
              padding: 'var(--spacing-md)',
              backgroundColor: 'var(--color-gray-50)',
              borderRadius: 'var(--border-radius-md)',
            }}
          >
            <h4
              style={{
                margin: '0 0 var(--spacing-sm) 0',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-secondary)',
              }}
            >
              조건 설정
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {Object.entries(selectedCondition.params).map(([key, config]) => (
                <div key={key}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 'var(--spacing-xs)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    {config.label}
                    {config.required && ' *'}
                  </label>

                  {config.type === 'number' && (
                    <Input
                      type="number"
                      value={String(formData.condition_params[key] ?? config.default ?? '')}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          condition_params: {
                            ...prev.condition_params,
                            [key]: Number(e.target.value),
                          },
                        }))
                      }
                      min={config.min}
                      max={config.max}
                    />
                  )}

                  {config.type === 'select' && config.options && (() => {
                    const currentValue = formData.condition_params[key] ?? config.default;
                    const needsPlaceholder = currentValue === undefined || currentValue === '';
                    const selectValue = needsPlaceholder ? '__param_placeholder__' : String(currentValue);
                    const selectOptions = needsPlaceholder
                      ? [{ value: '__param_placeholder__', label: '선택...' }, ...config.options]
                      : config.options;

                    return (
                      <Select
                        value={selectValue}
                        onChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            condition_params: {
                              ...prev.condition_params,
                              [key]: value === '__param_placeholder__' ? '' : value,
                            },
                          }))
                        }
                        options={selectOptions}
                      />
                    );
                  })()}

                  {config.type === 'multiselect' && config.options && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                      {config.options.map((option) => {
                        const currentValues = (formData.condition_params[key] as string[]) || [];
                        const isChecked = currentValues.includes(option.value);

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              const newValues = isChecked
                                ? currentValues.filter((v) => v !== option.value)
                                : [...currentValues, option.value];
                              setFormData((prev) => ({
                                ...prev,
                                condition_params: {
                                  ...prev.condition_params,
                                  [key]: newValues,
                                },
                              }));
                            }}
                            style={{
                              padding: 'var(--spacing-xs) var(--spacing-sm)',
                              fontSize: 'var(--font-size-xs)',
                              backgroundColor: isChecked
                                ? 'var(--color-primary)'
                                : 'var(--color-white)',
                              color: isChecked ? 'var(--color-white)' : 'var(--color-text-secondary)',
                              border: 'var(--border-width-thin) solid var(--color-border)',
                              borderRadius: 'var(--border-radius-xs)',
                              cursor: 'pointer',
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 색상 선택 */}
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: 'var(--spacing-xs)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)',
            }}
          >
            태그 색상
          </label>
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, color }))}
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: color,
                  border:
                    formData.color === color
                      ? '3px solid var(--color-text-primary)'
                      : 'var(--border-width-thin) solid var(--color-border)',
                  borderRadius: 'var(--border-radius-sm)',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>

        {/* 미리보기 */}
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: 'var(--spacing-xs)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)',
            }}
          >
            미리보기
          </label>
          <div
            style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              backgroundColor: formData.color,
              color: 'var(--color-white)',
              borderRadius: 'var(--border-radius-sm)',
              display: 'inline-block',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            {generateDisplayLabel() || '#태그이름'}
          </div>
        </div>

        {/* 액션 버튼 */}
        <div
          style={{
            display: 'flex',
            justifyContent: editingTag ? 'space-between' : 'flex-end',
            gap: 'var(--spacing-sm)',
            marginTop: 'var(--spacing-md)',
            paddingTop: 'var(--spacing-md)',
            borderTop: 'var(--border-width-thin) solid var(--color-border)',
          }}
        >
          {editingTag && !editingTag.is_system_default && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Spinner size="sm" /> : '삭제'}
            </Button>
          )}

          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              취소
            </Button>
            <Button
              variant="solid"
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {isSubmitting ? <Spinner size="sm" /> : editingTag ? '수정' : '생성'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
});

export default FilterTagManageModal;
