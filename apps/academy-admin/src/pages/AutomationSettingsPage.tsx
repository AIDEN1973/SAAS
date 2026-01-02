/**
 * 자동화 설정 페이지
 *
 * [LAYER: UI_PAGE]
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

import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary, useModal, Container, Card, PageHeader, Switch, NotificationCardLayout, Badge } from '@ui-core/react';
import { getApiContext } from '@api-sdk/core';
import { AUTOMATION_EVENT_CATALOG, AUTOMATION_EVENT_PLANNED } from '@core/core-automation';
// [SSOT] Barrel export를 통한 통합 import
import { AUTOMATION_EVENT_DESCRIPTIONS, POLICY_KEY_V2_CATEGORIES, AUTOMATION_EVENT_CRITERIA_FIELDS } from '../constants';
import { Zap, Settings } from 'lucide-react';
import { useTenantSettingByPath, useUpdateConfig, useConfig } from '@hooks/use-config';
// [SSOT] Barrel export를 통한 통합 import
import { getPolicyValueFromConfig, getAutomationEventPolicyPath, extractFieldPathFromPolicyPath, setPolicyValueByPath, logInfo, logWarn } from '../utils';
import { CardGridLayout } from '../components/CardGridLayout';

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

  // 기준 필드 표시 텍스트 생성
  const criteriaText = criteriaFields.length > 0 ? criteriaFields.map((field) => {
    const value = criteriaValues?.[field.field];
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

    return `${field.label}: ${displayValue}${unit ? ` ${unit}` : ''}`;
  }).filter(Boolean).join(' · ') : '';

  // 메타 정보: 상태 배지 + 기준 필드
  const metaContent = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
      <Badge
        variant={isEnabled ? 'solid' : 'soft'}
        color={isEnabled ? 'success' : 'gray'}
        style={{ fontSize: 'var(--font-size-xs)' }}
      >
        {isEnabled ? '사용중' : '사용중단'}
      </Badge>
      {criteriaText && (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          {criteriaText}
        </span>
      )}
    </div>
  );

  // 일반 모드: NotificationCardLayout 사용
  return (
    <div
      style={{
        cursor: 'pointer',
        opacity: isEnabled ? 'var(--opacity-full)' : 'var(--opacity-secondary)',
      }}
    >
      <NotificationCardLayout
        icon={isEnabled ? <Zap /> : <Settings />}
        title={description.title}
        description={description.description}
        meta={metaContent}
        variant="default"
        onClick={onClick || onEdit}
        iconBackgroundColor={isEnabled ? 'var(--color-primary-50)' : 'var(--color-gray-100)'}
      />
    </div>
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
  // [SSOT] Policy 경로를 헬퍼 함수로 생성하여 하드코딩 방지
  const enabledPolicyPath = getAutomationEventPolicyPath(eventType, 'enabled');

  // 현재 설정 조회
  const { data: enabledValue, isLoading: isLoadingEnabled } = useTenantSettingByPath(enabledPolicyPath);
  const isEnabled = enabledValue === true;

  // 전체 config 조회 (React Hooks 규칙 준수: map 내부에서 Hook 호출 금지)
  const { data: configData, isLoading: isLoadingConfig } = useConfig();

  // 기준 필드 목록 (useMemo로 메모이제이션하여 의존성 안정화)
  const criteriaFields = useMemo(() => AUTOMATION_EVENT_CRITERIA_FIELDS[eventType] || [], [eventType]);

  // 기준 필드 값 객체 생성
  // configData에서 필요한 경로만 추출
    const criteriaValues = useMemo(() => {
      if (!configData || isLoadingConfig) return {};

      const values: Record<string, unknown> = {};
      criteriaFields.forEach((field) => {
        // [SSOT] Policy 경로를 헬퍼 함수로 생성하여 하드코딩 방지
        const policyPath = getAutomationEventPolicyPath(eventType, field.field);
        // [SSOT] getPolicyValueFromConfig를 사용하여 Policy 조회 통일
        const value = getPolicyValueFromConfig(configData, policyPath);
        if (value !== null && value !== undefined) {
          values[field.field] = value;
        }
      });
      return values;
    }, [configData, isLoadingConfig, criteriaFields, eventType]);

  const isLoading = isLoadingEnabled || isLoadingConfig;

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
      let updatedEventConfig: Record<string, unknown> = {
        ...eventConfig,
        enabled: values.enabled,
      };

      // 기준 필드 값 업데이트
      // [SSOT] setPolicyValueByPath 유틸리티 사용하여 중첩 경로 처리 통일
      criteriaFields.forEach((field) => {
        const value = values.criteria[field.field];
        if (value !== null && value !== undefined) {
          // [SSOT] extractFieldPathFromPolicyPath를 사용하여 eventType 이후 경로만 추출
          // 예: 'auto_notification.payment_due_reminder.throttle.daily_limit' -> 'throttle.daily_limit'
          const fieldPath = extractFieldPathFromPolicyPath(field.policyPath, eventType);
          if (fieldPath) {
            // [SSOT] setPolicyValueByPath 사용하여 중첩 경로 안전하게 설정
            updatedEventConfig = setPolicyValueByPath(updatedEventConfig, fieldPath, value);
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

      return updateConfig.mutateAsync(updateInput);
    },
    onSuccess: () => {
      // [최적화] 상위 쿼리 무효화 시 하위 쿼리도 자동으로 무효화됨 (queryKey prefix matching)
      // ['config', tenantId] 무효화 → ['config', tenantId, 'path', *] 모두 자동 무효화
      void queryClient.invalidateQueries({ queryKey: ['config', tenantId] });
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
  useEffect(() => {
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

// [SSOT] status='planned' 항목은 @core/core-automation의 AUTOMATION_EVENT_PLANNED에서 가져옴

export function AutomationSettingsPage() {
  const [editingEventType, setEditingEventType] = useState<AutomationEventType | null>(null);

  // [P1 개선] showPlanned 상태 지속성: localStorage 기반 상태 관리
  // 페이지 이탈 후 재방문 시에도 토글 상태 유지
  const [showPlanned, setShowPlanned] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('automation-settings-show-planned');
      return stored === 'true';
    } catch (error) {
      // localStorage 접근 실패 시 기본값 반환 (SSR 환경 등)
      if (import.meta.env?.DEV) {
        logWarn('AutomationSettingsPage', 'localStorage 접근 실패, 기본값 사용', { error });
      }
      return false;
    }
  });

  // showPlanned 변경 시 localStorage에 저장
  const handleTogglePlanned = (checked: boolean) => {
    setShowPlanned(checked);
    try {
      localStorage.setItem('automation-settings-show-planned', String(checked));
    } catch (error) {
      // localStorage 저장 실패 시 경고 (쿠키 차단, 프라이빗 모드 등)
      if (import.meta.env?.DEV) {
        logWarn('AutomationSettingsPage', 'localStorage 저장 실패', { error });
      }
    }
  };

  // 표시할 event_type 목록 필터링
  const visibleEvents = useMemo(() => {
    if (showPlanned) {
      return AUTOMATION_EVENT_CATALOG;
    }
    // [SSOT] AUTOMATION_EVENT_PLANNED는 @core/core-automation에서 가져옴
    return AUTOMATION_EVENT_CATALOG.filter((eventType) => !AUTOMATION_EVENT_PLANNED.includes(eventType));
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
            <Switch checked={showPlanned} onChange={(e) => handleTogglePlanned(e.target.checked)} />
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
              <CardGridLayout
                cards={events.map((eventType) => (
                  <AutomationCardWithState
                    key={eventType}
                    eventType={eventType}
                    isEditing={editingEventType === eventType}
                    onEdit={() => setEditingEventType(eventType)}
                    onCancel={() => setEditingEventType(null)}
                  />
                ))}
                desktopColumns={3}
                tabletColumns={2}
                mobileColumns={1}
              />
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
  // [SSOT] Policy 경로를 헬퍼 함수로 생성하여 하드코딩 방지
  const enabledPolicyPath = getAutomationEventPolicyPath(eventType, 'enabled');
  const { data: enabledValue } = useTenantSettingByPath(enabledPolicyPath);
  const isEnabled = enabledValue === true;

  // 전체 config 조회 (React Hooks 규칙 준수: map 내부에서 Hook 호출 금지)
  const { data: configData, isLoading: isLoadingConfig } = useConfig();

  // 기준 필드 목록 (useMemo로 메모이제이션하여 의존성 안정화)
  const criteriaFields = useMemo(() => AUTOMATION_EVENT_CRITERIA_FIELDS[eventType] || [], [eventType]);

  // 기준 필드 값 객체 생성
  // configData에서 필요한 경로만 추출
  const criteriaValues = useMemo(() => {
    if (!configData || isLoadingConfig) return {};

    const values: Record<string, unknown> = {};
    criteriaFields.forEach((field) => {
      // [SSOT] Policy 경로를 헬퍼 함수로 생성하여 하드코딩 방지
      const policyPath = getAutomationEventPolicyPath(eventType, field.field);
      // [SSOT] getPolicyValueFromConfig를 사용하여 Policy 조회 통일
      const value = getPolicyValueFromConfig(configData, policyPath);
      if (value !== null && value !== undefined) {
        values[field.field] = value;
        // 디버깅: 값이 있는 경우
        if (import.meta.env?.DEV) {
          logInfo('AutomationSettingsPage:AutomationCardWithState', `값 있음: ${policyPath}`, {
            field: field.field,
            value: value,
            type: typeof value,
          });
        }
      } else {
        // 디버깅: 기본값이 설정되어 있어도 null이면 상세 로그 출력
        if (import.meta.env?.DEV) {
          logWarn('AutomationSettingsPage:AutomationCardWithState', `기본값 없음: ${policyPath}`, {
            field: field.field,
            policyPath: policyPath,
          });
        }
      }
    });
    return values;
  }, [configData, isLoadingConfig, criteriaFields, eventType]);

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
