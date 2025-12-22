/**
 * 자동화 설정 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 39개 자동화 항목 카드 스타일 표시, 클릭 시 설정 카드로 변경
 * [문서 준수] docu/프론트 자동화.md, docu/AI_자동화_기능_정리.md 엄격 준수
 *
 * Automation Config First 원칙:
 * - 모든 자동화는 사용자 설정값(Policy / Threshold / Toggle)을 통해 활성·비활성 및 강도가 결정됨
 * - 기본값은 Default Policy이며, 테넌트 생성 시 설정값으로 저장됨
 * - 설정이 없으면 실행하지 않음 (Fail Closed)
 */

import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary, useModal, Container, Card, PageHeader, Switch, useResponsiveMode } from '@ui-core/react';
import { apiClient, getApiContext } from '@api-sdk/core';
import { AUTOMATION_EVENT_CATALOG } from '@core/core-automation';
import { AUTOMATION_EVENT_DESCRIPTIONS, POLICY_KEY_V2_CATEGORIES, AUTOMATION_EVENT_CRITERIA_FIELDS } from '../constants/automation-event-descriptions';
import { useTenantSettingByPath, useUpdateConfig, useConfig } from '@hooks/use-config';

type AutomationEventType = (typeof AUTOMATION_EVENT_CATALOG)[number];

interface AutomationCardProps {
  eventType: AutomationEventType;
  isEnabled: boolean;
  criteriaValues?: Record<string, unknown>;
  isEditing?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onClick?: () => void;
}

function AutomationCard({ eventType, isEnabled, criteriaValues, isEditing, onEdit, onCancel, onClick }: AutomationCardProps) {
  const description = AUTOMATION_EVENT_DESCRIPTIONS[eventType];
  const criteriaFields = AUTOMATION_EVENT_CRITERIA_FIELDS[eventType] || [];

  // 편집 모드면 수정 폼 표시
  if (isEditing) {
    return (
      <AutomationSettingsCard
        eventType={eventType}
        onCancel={onCancel || (() => {})}
      />
    );
  }

  // 일반 모드: 카드 표시
  return (
    <Card
      padding="md"
      variant={isEnabled ? 'default' : 'outlined'}
      onClick={onClick || onEdit}
      style={{
        cursor: 'pointer',
        transition: 'var(--transition-all)',
        opacity: isEnabled ? 'var(--opacity-full)' : 'var(--opacity-secondary)',
        borderLeft: `var(--border-width-medium) solid ${isEnabled ? 'var(--color-primary)' : 'var(--color-border)'}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `translateY(calc(var(--spacing-xxs) * -1))`;
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-xs)' }}>
        <h3
          style={{
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text)',
            margin: 0,
            flex: 1,
          }}
        >
          {description.title}
        </h3>
        <div
          style={{
            padding: 'var(--spacing-xs)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isEnabled ? 'var(--color-success-light)' : 'var(--color-background-secondary)',
            color: isEnabled ? 'var(--color-success)' : 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-medium)',
            whiteSpace: 'nowrap',
            marginLeft: 'var(--spacing-sm)',
          }}
        >
          {isEnabled ? '사용중' : '사용중단'}
        </div>
      </div>
      <p
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          margin: 0,
          lineHeight: 'var(--line-height)',
          marginBottom: criteriaFields.length > 0 ? 'var(--spacing-xs)' : 0,
        }}
      >
        {description.description}
      </p>
      {criteriaFields.length > 0 && (
        <div style={{ marginTop: 'var(--spacing-xs)', paddingTop: 'var(--spacing-xs)', borderTop: 'var(--border-width-thin) solid var(--color-border)' }}>
          {criteriaFields.map((field) => {
            const value = criteriaValues?.[field.field];

            // 값이 없으면 표시하지 않음 (기본값이 설정되어 있으면 표시됨)
            if (value === null || value === undefined) return null;

            let displayValue: string;
            if (field.type === 'select' && field.options) {
              const option = field.options.find((opt) => String(opt.value) === String(value));
              displayValue = option ? option.label : String(value);
            } else if (field.type === 'boolean') {
              displayValue = value ? '예' : '아니오';
            } else {
              displayValue = String(value);
            }

            // 단위 추가
            let unit = '';
            if (field.type === 'number') {
              if (field.label.includes('일')) unit = '일';
              else if (field.label.includes('시간')) unit = '시간';
              else if (field.label.includes('분')) unit = '분';
              else if (field.label.includes('원')) unit = '원';
              else if (field.label.includes('%')) unit = '%';
              else if (field.label.includes('위')) unit = '위';
              else if (field.label.includes('배수')) unit = '배';
              else if (field.label.includes('개')) unit = '개';
            }

            return (
              <div key={field.field} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xxs)' }}>
                {field.label}: {displayValue}{unit && ` ${unit}`}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

interface AutomationSettingsCardProps {
  eventType: AutomationEventType;
  onCancel: () => void;
}

function AutomationSettingsCard({ eventType, onCancel }: AutomationSettingsCardProps) {
  const { showAlert } = useModal();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  const description = AUTOMATION_EVENT_DESCRIPTIONS[eventType];
  const criteriaFields = AUTOMATION_EVENT_CRITERIA_FIELDS[eventType] || [];
  const enabledPolicyPath = `auto_notification.${eventType}.enabled`;

  // 현재 설정 조회
  const { data: enabledValue, isLoading: isLoadingEnabled } = useTenantSettingByPath(enabledPolicyPath);
  const isEnabled = enabledValue === true;

  // 자동화 기준 필드 값 조회
  const criteriaQueries = criteriaFields.map((field) => ({
    field,
    query: useTenantSettingByPath(field.policyPath),
  }));

  const isLoadingCriteria = criteriaQueries.some(({ query }) => query.isLoading);
  const isLoading = isLoadingEnabled || isLoadingCriteria;

  // 기준 필드 값 객체 생성
  // 각 쿼리의 data와 isLoading 상태를 의존성으로 사용하여 안정적인 메모이제이션
  // isLoading이 false이고 data가 null이면 기본값이 설정되지 않은 것이므로 표시하지 않음
  const criteriaDataArray = criteriaQueries.map(({ query }) => ({ data: query.data, isLoading: query.isLoading }));
  const criteriaValues = useMemo(() => {
    const values: Record<string, unknown> = {};
    criteriaQueries.forEach(({ field, query }) => {
      // 조회가 완료되었고 값이 있으면 포함
      // 조회 중이면 포함하지 않음 (로딩 중 표시 방지)
      if (!query.isLoading && query.data !== null && query.data !== undefined) {
        values[field.field] = query.data;
      }
    });
    return values;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, criteriaDataArray);

  // 설정 저장
  // 정본 규칙: apiClient.get('tenant_settings') 직접 호출 금지, useUpdateConfig Hook 사용
  const updateConfig = useUpdateConfig();
  const { data: currentConfigData } = useConfig();
  const saveMutation = useMutation({
    mutationFn: async (values: { enabled: boolean; criteria: Record<string, unknown> }) => {
      if (!tenantId) throw new Error('Tenant ID is required');

      // 정본 규칙: useConfig Hook의 캐시된 데이터 사용 (queryClient.getQueryData 대신)
      const currentConfig = (currentConfigData || {}) as Record<string, unknown>;

      // auto_notification 경로 설정
      const autoNotification = (currentConfig.auto_notification || {}) as Record<string, unknown>;
      const eventConfig = (autoNotification[eventType] || {}) as Record<string, unknown>;

      // enabled 값 업데이트
      const updatedEventConfig: Record<string, unknown> = {
        ...eventConfig,
        enabled: values.enabled,
      };

      // 기준 필드 값 업데이트
      criteriaFields.forEach((field) => {
        const value = values.criteria[field.field];
        if (value !== null && value !== undefined) {
          // 중첩 경로 처리 (예: throttle.daily_limit)
          const pathParts = field.policyPath.split('.');
          if (pathParts.length > 3) {
            // auto_notification.eventType.throttle.daily_limit 같은 경우
            const nestedKey = pathParts.slice(2).join('.');
            const keys = nestedKey.split('.');
            let current = updatedEventConfig;
            for (let i = 0; i < keys.length - 1; i++) {
              if (!current[keys[i]]) {
                current[keys[i]] = {};
              }
              current = current[keys[i]] as Record<string, unknown>;
            }
            current[keys[keys.length - 1]] = value;
          } else {
            // auto_notification.eventType.field 같은 경우
            const fieldName = pathParts[pathParts.length - 1];
            updatedEventConfig[fieldName] = value;
          }
        }
      });

      const updatedAutoNotification = {
        ...autoNotification,
        [eventType]: updatedEventConfig,
      };

      // 정본 규칙: useUpdateConfig Hook 사용
      const updateInput = {
        auto_notification: updatedAutoNotification,
      };

      return await updateConfig.mutateAsync(updateInput);
    },
    onSuccess: () => {
      // 모든 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['config', tenantId, 'path', enabledPolicyPath] });
      criteriaFields.forEach((field) => {
        queryClient.invalidateQueries({ queryKey: ['config', tenantId, 'path', field.policyPath] });
      });
      queryClient.invalidateQueries({ queryKey: ['config', tenantId] });
      showAlert('자동화 설정이 저장되었습니다.', '성공');
      onCancel();
    },
    onError: (error: Error) => {
      showAlert(`자동화 설정 저장에 실패했습니다: ${error.message}`, '오류');
    },
  });

  const [formValues, setFormValues] = useState<{ enabled: boolean; criteria: Record<string, unknown> }>({
    enabled: isEnabled,
    criteria: criteriaValues,
  });

  // enabled 또는 criteriaValues 변경 시 formValues 업데이트
  // criteriaValues 객체의 깊은 비교를 위해 JSON.stringify 사용
  const criteriaValuesString = JSON.stringify(criteriaValues);
  React.useEffect(() => {
    setFormValues({
      enabled: isEnabled,
      criteria: criteriaValues,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, criteriaValuesString]);

  const handleToggle = (checked: boolean) => {
    setFormValues((prev) => ({ ...prev, enabled: checked }));
  };

  const handleCriteriaChange = (field: string, value: unknown) => {
    setFormValues((prev) => ({
      ...prev,
      criteria: { ...prev.criteria, [field]: value },
    }));
  };

  const handleSave = () => {
    saveMutation.mutate(formValues);
  };

  return (
    <Card
      padding="md"
      variant={formValues.enabled ? 'default' : 'outlined'}
      style={{
        opacity: formValues.enabled ? 'var(--opacity-full)' : 'var(--opacity-secondary)',
        borderLeft: `var(--border-width-medium) solid ${formValues.enabled ? 'var(--color-primary)' : 'var(--color-border)'}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-xs)' }}>
        <h3
          style={{
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text)',
            margin: 0,
            flex: 1,
          }}
        >
          {description.title}
        </h3>
        <div
          style={{
            padding: 'var(--spacing-xs)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: formValues.enabled ? 'var(--color-success-light)' : 'var(--color-background-secondary)',
            color: formValues.enabled ? 'var(--color-success)' : 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-medium)',
            whiteSpace: 'nowrap',
            marginLeft: 'var(--spacing-sm)',
          }}
        >
          {formValues.enabled ? '사용중' : '사용중단'}
        </div>
      </div>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 'var(--line-height)', marginBottom: 'var(--spacing-xs)' }}>
        {description.description}
      </p>

      <div style={{ marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <label
              style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text)',
                display: 'block',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              자동화 활성화
            </label>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
              이 자동화 기능을 활성화하거나 비활성화합니다.
            </p>
          </div>
          <Switch
            checked={formValues.enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            disabled={isLoading || saveMutation.isPending}
          />
        </div>
      </div>

      {criteriaFields.length > 0 && (
        <div style={{ marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: 'var(--border-width-thin) solid var(--color-border)' }}>
          <h4
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              marginBottom: 'var(--spacing-sm)',
              color: 'var(--color-text)',
            }}
          >
            자동화 기준 설정
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {criteriaFields.map((field) => {
              // 타입별 초기값 처리
              const currentValue = formValues.criteria[field.field] ?? null;
              const displayValue = field.type === 'number'
                ? (currentValue as number ?? '')
                : field.type === 'boolean'
                ? (currentValue as boolean ?? false)
                : (currentValue as string ?? '');

              // min/max 범위 텍스트 생성
              const rangeText = field.type === 'number' && (field.min !== undefined || field.max !== undefined)
                ? ` (${field.min !== undefined ? `최소: ${field.min}` : ''}${field.min !== undefined && field.max !== undefined ? ', ' : ''}${field.max !== undefined ? `최대: ${field.max}` : ''})`
                : '';

              return (
                <div key={field.field}>
                  <label
                    style={{
                      fontSize: 'var(--font-size-base)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-text)',
                      display: 'block',
                      marginBottom: 'var(--spacing-xs)',
                    }}
                  >
                    {field.label}
                    {rangeText && (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-normal)', marginLeft: 'var(--spacing-xs)' }}>
                        {rangeText}
                      </span>
                    )}
                  </label>
                  {field.type === 'select' && field.options ? (
                    <select
                      value={String(displayValue)}
                      onChange={(e) => {
                        // option value가 number인 경우 number로 변환
                        const option = field.options?.find(opt => String(opt.value) === e.target.value);
                        const value = option && typeof option.value === 'number' ? option.value : e.target.value;
                        handleCriteriaChange(field.field, value);
                      }}
                      disabled={isLoading || saveMutation.isPending}
                      style={{
                        width: 'var(--width-full)',
                        padding: 'var(--spacing-sm)',
                        fontSize: 'var(--font-size-base)',
                        border: 'var(--border-width-thin) solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-white)',
                        color: 'var(--color-text)',
                      }}
                    >
                      {field.options.map((option) => (
                        <option key={option.value} value={String(option.value)}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'boolean' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                      <input
                        type="checkbox"
                        checked={displayValue as boolean}
                        onChange={(e) => handleCriteriaChange(field.field, e.target.checked)}
                        disabled={isLoading || saveMutation.isPending}
                        style={{
                          width: 'var(--size-icon-sm)',
                          height: 'var(--size-icon-sm)',
                          cursor: isLoading || saveMutation.isPending ? 'not-allowed' : 'pointer',
                        }}
                      />
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        {displayValue ? '활성화' : '비활성화'}
                      </span>
                    </div>
                  ) : field.type === 'number' ? (
                    <input
                      type="number"
                      value={displayValue as number}
                      onChange={(e) => {
                        const numValue = e.target.value === '' ? null : Number(e.target.value);
                        handleCriteriaChange(field.field, numValue);
                      }}
                      disabled={isLoading || saveMutation.isPending}
                      min={field.min}
                      max={field.max}
                      placeholder="값을 입력하세요"
                      style={{
                        width: 'var(--width-full)',
                        padding: 'var(--spacing-sm)',
                        fontSize: 'var(--font-size-base)',
                        border: 'var(--border-width-thin) solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-white)',
                        color: 'var(--color-text)',
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={displayValue as string}
                      onChange={(e) => {
                        handleCriteriaChange(field.field, e.target.value);
                      }}
                      disabled={isLoading || saveMutation.isPending}
                      placeholder="값을 입력하세요"
                      style={{
                        width: 'var(--width-full)',
                        padding: 'var(--spacing-sm)',
                        fontSize: 'var(--font-size-base)',
                        border: 'var(--border-width-thin) solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-white)',
                        color: 'var(--color-text)',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
        <button
          onClick={onCancel}
          disabled={saveMutation.isPending}
          style={{
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            fontSize: 'var(--font-size-sm)',
            border: 'var(--border-width-thin) solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-white)',
            color: 'var(--color-text)',
            cursor: saveMutation.isPending ? 'not-allowed' : 'pointer',
          }}
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={isLoading || saveMutation.isPending}
          style={{
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            fontSize: 'var(--font-size-sm)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-white)',
            cursor: isLoading || saveMutation.isPending ? 'not-allowed' : 'pointer',
          }}
        >
          {saveMutation.isPending ? '저장 중...' : '저장'}
        </button>
      </div>
    </Card>
  );
}

// status='planned' 항목 목록 (문서 Section 11 참조)
const PLANNED_EVENTS: AutomationEventType[] = [
  'inquiry_conversion_drop',
  'birthday_greeting',
  'enrollment_anniversary',
  'announcement_urgent',
  'announcement_digest',
  'staff_absence_schedule_risk',
];

export function AutomationSettingsPage() {
  const [editingEventType, setEditingEventType] = useState<AutomationEventType | null>(null);
  const [showPlanned, setShowPlanned] = useState(false);
  const mode = useResponsiveMode();

  // 표시할 event_type 목록 필터링
  const visibleEvents = useMemo(() => {
    if (showPlanned) {
      return AUTOMATION_EVENT_CATALOG;
    }
    return AUTOMATION_EVENT_CATALOG.filter((eventType) => !PLANNED_EVENTS.includes(eventType));
  }, [showPlanned]);

  // 카테고리별로 그룹화
  const eventsByCategory = useMemo(() => {
    const grouped: Record<string, AutomationEventType[]> = {};

    visibleEvents.forEach((eventType) => {
      const description = AUTOMATION_EVENT_DESCRIPTIONS[eventType];
      if (description) {
        const category = description.policyKey;
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(eventType);
      }
    });

    // 카테고리 순서대로 정렬
    return Object.keys(grouped)
      .sort((a, b) => {
        const orderA = POLICY_KEY_V2_CATEGORIES[a]?.order || 999;
        const orderB = POLICY_KEY_V2_CATEGORIES[b]?.order || 999;
        return orderA - orderB;
      })
      .map((category) => ({
        category,
        events: grouped[category],
      }));
  }, [visibleEvents]);

  // 반응형 그리드 컬럼 수 계산 (3열 기본, 모바일은 1열, 태블릿은 2열)
  const gridColumns = useMemo(() => {
    if (mode === 'xs' || mode === 'sm') return 1;
    if (mode === 'md') return 2;
    return 3; // lg, xl
  }, [mode]);


  return (
    <ErrorBoundary>
      <Container>
        <PageHeader title="자동화 설정" />
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)', marginBottom: 'var(--spacing-lg)' }}>
          39개 자동화 기능의 활성화 여부를 설정합니다. 모든 자동화는 Policy 기반으로 동작하며, 설정이 없으면 실행되지 않습니다 (Fail Closed).
        </p>

        {/* 우측 상단 토글 스위치 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <label
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              준비중 포함
            </label>
            <Switch checked={showPlanned} onChange={(e) => setShowPlanned(e.target.checked)} />
          </div>
        </div>

        {/* 카테고리별 섹션 */}
        {eventsByCategory.map(({ category, events }) => {
          const categoryInfo = POLICY_KEY_V2_CATEGORIES[category];
          if (!categoryInfo) return null;

          return (
            <div key={category} style={{ marginBottom: 'var(--spacing-xl)' }}>
              {/* 카테고리 헤더 */}
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <h2
                  style={{
                    fontSize: 'var(--font-size-xl)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-text)',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                >
                  {categoryInfo.title}
                </h2>
                <p
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    margin: 0,
                  }}
                >
                  {categoryInfo.description}
                </p>
              </div>

              {/* 반응형 그리드 레이아웃 (3열 기본, 모바일 1열, 태블릿 2열) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                  gap: 'var(--spacing-md)',
                }}
              >
                {events.map((eventType) => {
                  return (
                    <AutomationCardWithState
                      key={eventType}
                      eventType={eventType}
                      isEditing={editingEventType === eventType}
                      onEdit={() => setEditingEventType(eventType)}
                      onCancel={() => setEditingEventType(null)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </Container>
    </ErrorBoundary>
  );
}

// 각 카드에서 개별적으로 활성화 상태 및 자동화 기준을 조회하는 컴포넌트
function AutomationCardWithState({
  eventType,
  isEditing,
  onEdit,
  onCancel
}: {
  eventType: AutomationEventType;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const enabledPolicyPath = `auto_notification.${eventType}.enabled`;
  const { data: enabledValue } = useTenantSettingByPath(enabledPolicyPath);
  const isEnabled = enabledValue === true;

  const criteriaFields = AUTOMATION_EVENT_CRITERIA_FIELDS[eventType] || [];
  const criteriaQueries = criteriaFields.map((field) => ({
    field,
    query: useTenantSettingByPath(field.policyPath),
  }));

  // 각 쿼리의 data와 isLoading 상태를 의존성으로 사용하여 안정적인 메모이제이션
  // isLoading이 false이고 data가 null이면 기본값이 설정되지 않은 것이므로 표시하지 않음
  const criteriaDataArray = criteriaQueries.map(({ query }) => ({ data: query.data, isLoading: query.isLoading }));
  const criteriaValues = useMemo(() => {
    const values: Record<string, unknown> = {};
    criteriaQueries.forEach(({ field, query }) => {
      // 조회가 완료되었고 값이 있으면 포함
      // 조회 중이면 포함하지 않음 (로딩 중 표시 방지)
      // 중요: 기본값이 설정되어 있으면 query.data가 값을 반환해야 함
      if (!query.isLoading) {
        if (query.data !== null && query.data !== undefined) {
          values[field.field] = query.data;
          // 디버깅: 값이 있는 경우
          if (process.env.NODE_ENV === 'development') {
            console.log(`[AutomationCardWithState] 값 있음: ${field.policyPath}`, {
              field: field.field,
              value: query.data,
              type: typeof query.data,
            });
          }
        }
        // 디버깅: 기본값이 설정되어 있어도 null이면 상세 로그 출력
        else if (process.env.NODE_ENV === 'development') {
          console.warn(`[AutomationCardWithState] 기본값 없음: ${field.policyPath}`, {
            field: field.field,
            policyPath: field.policyPath,
            data: query.data,
            isLoading: query.isLoading,
            queryState: {
              data: query.data,
              isLoading: query.isLoading,
              isError: query.isError,
              error: query.error,
            },
          });
        }
      } else {
        // 디버깅: 로딩 중
        if (process.env.NODE_ENV === 'development') {
          console.log(`[AutomationCardWithState] 로딩 중: ${field.policyPath}`, { isLoading: query.isLoading });
        }
      }
    });
    return values;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, criteriaDataArray);

  return (
    <AutomationCard
      eventType={eventType}
      isEnabled={isEnabled}
      criteriaValues={criteriaValues}
      isEditing={isEditing}
      onEdit={onEdit}
      onCancel={onCancel}
    />
  );
}
