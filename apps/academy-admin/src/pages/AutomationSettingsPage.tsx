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

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { ErrorBoundary, useModal, Container, Card, PageHeader, Switch, NotificationCardLayout, Badge, Input, Select, Button, useResponsiveMode, isMobile, isTablet, SubSidebar } from '@ui-core/react';
import { getApiContext, apiClient } from '@api-sdk/core';
import { AUTOMATION_EVENT_CATALOG, AUTOMATION_EVENT_PLANNED } from '@core/core-automation';
// [SSOT] Barrel export를 통한 통합 import
import { AUTOMATION_EVENT_DESCRIPTIONS, POLICY_KEY_V2_CATEGORIES, AUTOMATION_EVENT_CRITERIA_FIELDS, AUTOMATION_SUB_MENU_ITEMS, DEFAULT_AUTOMATION_SUB_MENU, getSubMenuFromUrl, setSubMenuToUrl } from '../constants';
import type { AutomationSubMenuId } from '../constants';
import { Zap, Settings } from 'lucide-react';
import { useTenantSettingByPath, useUpdateConfig, useConfig } from '@hooks/use-config';
import { useIndustryTerms } from '@hooks/use-industry-terms';
// [SSOT] Barrel export를 통한 통합 import
import { getPolicyValueFromConfig, getAutomationEventPolicyPath, extractFieldPathFromPolicyPath, setPolicyValueByPath } from '../utils';
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
  stats?: {
    total: number;
    success: number;
    failed: number;
    lastRun?: Date;
  };
  showStats?: boolean;
  terms: ReturnType<typeof useIndustryTerms>;
}

function AutomationCard({ eventType, isEnabled, criteriaValues, isEditing, onEdit, onCancel, onClick, stats, showStats, terms }: AutomationCardProps) {
  const description = AUTOMATION_EVENT_DESCRIPTIONS[eventType];
  const criteriaFields = useMemo(() => AUTOMATION_EVENT_CRITERIA_FIELDS[eventType] || [], [eventType]);

  // 조건 값이 포함된 설명 생성
  const enhancedDescription = useMemo(() => {
    let desc = description.description;

    // [P1] 업종중립 용어 치환 (Runtime replacement)
    desc = desc.replace(/학부모/g, terms.PAYER_LABEL);
    desc = desc.replace(/학생(?!의)/g, terms.PERSON_LABEL_PRIMARY); // "학생의" 제외
    desc = desc.replace(/학생의/g, `${terms.PERSON_LABEL_PRIMARY}의`);
    desc = desc.replace(/수업/g, terms.GROUP_LABEL);
    desc = desc.replace(/강사/g, terms.PERSON_LABEL_SECONDARY);
    desc = desc.replace(/수납률/g, terms.COLLECTION_RATE_LABEL);

    // 각 이벤트 타입별로 조건을 설명에 삽입
    criteriaFields.forEach((field) => {
      const value = criteriaValues?.[field.field];
      if (value === null || value === undefined) return;

      // channel, require_approval 필드는 설명에 추가하지 않음 (내부 설정)
      if (field.field === 'channel' || field.field === 'require_approval') return;

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
        else if (field.label.includes('건')) unit = '건';
        else if (field.label.includes('자')) unit = '자';
      }

      const valueWithUnit = `${displayValue}${unit}`;
      const boldValue = `**${valueWithUnit}**`;

      // 이벤트 타입별 설명 템플릿 치환 (볼드 처리)
      if (eventType === 'payment_due_reminder') {
        if (field.field === 'days_before_first') {
          desc = desc.replace(/결제 예정일 \d+일 전/, `결제 예정일 ${boldValue} 전`);
        } else if (field.field === 'days_before_second') {
          desc = desc.replace(/\d+일 전에/, `${boldValue} 전에`);
        }
      }
      else if (eventType === 'revenue_target_under' && field.field === 'monthly_target') {
        desc = desc.replace('목표치보다', `목표치 ${boldValue}보다`);
      }
      else if (eventType === 'revenue_required_per_day' && field.field === 'monthly_target') {
        desc = desc.replace('관리자에게', `(월 목표 ${boldValue} 기준) 관리자에게`);
      }
      else if (eventType === 'collection_rate_drop' && field.field === 'threshold') {
        desc = desc.replace('하락할 때', `${boldValue} 이하로 하락할 때`);
      }
      else if (eventType === 'overdue_outstanding_over_limit' && field.field === 'limit_amount') {
        desc = desc.replace('한도를 초과할 때', `한도 ${boldValue}을 초과할 때`);
      }
      else if (eventType === 'refund_spike' && field.field === 'threshold') {
        desc = desc.replace('급증할 때', `${boldValue} 이상 급증할 때`);
      }
      else if (eventType === 'monthly_business_report' && field.field === 'report_day') {
        desc = desc.replace('리포트를', `매월 ${boldValue}에 리포트를`);
      }
      else if (eventType === 'class_fill_rate_low_persistent') {
        if (field.field === 'threshold') {
          desc = desc.replace('낮을 때', `${boldValue} 이하로 낮을 때`);
        } else if (field.field === 'persistent_days') {
          desc = desc.replace(/낮을 때/, `낮은 상태가 ${boldValue} 이상 지속될 때`);
        }
      }
      else if (eventType === 'time_slot_fill_rate_low' && field.field === 'threshold') {
        desc = desc.replace('낮을 때', `${boldValue} 이하로 낮을 때`);
      }
      else if (eventType === 'high_fill_rate_expand_candidate' && field.field === 'threshold') {
        desc = desc.replace('높은 반을', `${boldValue} 이상인 ${terms.GROUP_LABEL}을`);
      }
      else if (eventType === 'unused_class_persistent' && field.field === 'persistent_days') {
        desc = desc.replace('사용되지 않는 반을', `${boldValue} 이상 사용되지 않는 ${terms.GROUP_LABEL}을`);
      }
      else if (eventType === 'weekly_ops_summary' && field.field === 'report_day_of_week') {
        desc = desc.replace('매주 월요일', `매주 **${displayValue}**`);
      }
      else if (eventType === 'class_reminder_today' && field.field === 'minutes_before') {
        desc = desc.replace('시작 전에', `시작 ${boldValue} 전에`);
      }
      else if (eventType === 'class_schedule_tomorrow' && field.field === 'notification_time') {
        desc = desc.replace(/\d+시에/, `**${displayValue}**에`);
      }
      else if (eventType === 'consultation_reminder') {
        if (field.field === 'hours_before_first') {
          desc = desc.replace(/\d+시간 전/, `${boldValue} 전`);
        } else if (field.field === 'hours_before_second') {
          desc = desc.replace(/\d+시간 전에/, `${boldValue} 전에`);
        }
      }
      else if (eventType === 'churn_increase' && field.field === 'threshold') {
        desc = desc.replace('증가할 때', `${boldValue} 이상 증가할 때`);
      }
      else if (eventType === 'attendance_rate_drop_weekly' && field.field === 'threshold') {
        desc = desc.replace('하락할 때', `${boldValue} 이상 하락할 때`);
      }
      else if (eventType === 'new_member_drop' && field.field === 'threshold') {
        desc = desc.replace('감소할 때', `${boldValue} 이상 감소할 때`);
      }
      else if (eventType === 'inquiry_conversion_drop' && field.field === 'threshold') {
        desc = desc.replace('하락할 때', `${boldValue} 이상 하락할 때`);
      }
      else if (eventType === 'regional_underperformance' && field.field === 'threshold') {
        desc = desc.replace('저조할 때', `${boldValue} 이하로 저조할 때`);
      }
      else if (eventType === 'regional_rank_drop' && field.field === 'threshold') {
        desc = desc.replace('하락할 때', `${boldValue} 이상 하락할 때`);
      }
      else if (eventType === 'checkin_reminder' && field.field === 'minutes_before') {
        desc = desc.replace('시작 전에', `시작 ${boldValue} 전에`);
      }
      else if (eventType === 'checkout_missing_alert' && field.field === 'grace_period_minutes') {
        desc = desc.replace('누락되면', `${boldValue} 후에도 누락되면`);
      }
      else if (eventType === 'announcement_digest' && field.field === 'digest_period') {
        desc = desc.replace('주간 또는 월간', `**${displayValue}**`);
      }
      else if (eventType === 'consultation_summary_ready' && field.field === 'min_length') {
        desc = desc.replace('요약이 완료되면', `(${boldValue} 이상인 경우) 요약이 완료되면`);
      }
      else if (eventType === 'attendance_pattern_anomaly' && field.field === 'threshold') {
        desc = desc.replace('이상이 감지되면', `최근 ${boldValue} 동안 이상이 감지되면`);
      }
      else if (eventType === 'teacher_workload_imbalance' && field.field === 'threshold') {
        desc = desc.replace('불균형할 때', `${boldValue} 이상 차이날 때`);
      }
    });

    return desc;
  }, [description, criteriaFields, criteriaValues, eventType, terms]);

  // 메타 정보: 상태 배지와 통계 표시
  const metaContent = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
      <Badge
        variant={isEnabled ? 'solid' : 'soft'}
        color={isEnabled ? 'success' : 'gray'}
        style={{ fontSize: 'var(--font-size-xs)' }}
      >
        {isEnabled ? '사용중' : '사용중단'}
      </Badge>
      {showStats && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', gap: 'var(--spacing-xs)' }}>
          {stats ? (
            <>
              <span>실행 {stats.total}회</span>
              <span>•</span>
              <span style={{ color: 'var(--color-success)' }}>성공 {stats.success}</span>
              {stats.failed > 0 && (
                <>
                  <span>•</span>
                  <span style={{ color: 'var(--color-error)' }}>실패 {stats.failed}</span>
                </>
              )}
            </>
          ) : (
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xxs)' }}>
              최근 30일 데이터 없음
            </span>
          )}
        </div>
      )}
    </div>
  );

  // 마크다운 볼드(**텍스트**)를 React 엘리먼트로 변환
  const renderDescription = useMemo(() => {
    const parts = enhancedDescription.split(/(\*\*[^*]+\*\*)/g);
    return (
      <>
        {parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const text = part.slice(2, -2);
            return <strong key={index}>{text}</strong>;
          }
          return <span key={index}>{part}</span>;
        })}
      </>
    );
  }, [enhancedDescription]);

  // 편집 모드면 수정 폼 표시
  if (isEditing) {
    return (
      <AutomationSettingsCard
        eventType={eventType}
        onCancel={onCancel || (() => {})}
      />
    );
  }

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
        description={renderDescription}
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
        // [SSOT] field.policyPath를 직접 사용하여 중첩 경로 지원
        const policyPath = field.policyPath;
        // [SSOT] getPolicyValueFromConfig를 사용하여 Policy 조회 통일
        const value = getPolicyValueFromConfig(configData, policyPath);
        if (value !== null && value !== undefined) {
          // DB에 실제 값이 있는 경우 사용
          values[field.field] = value;
        } else if (field.defaultValue !== undefined) {
          // DB에 값이 없으면 기본값 사용 (편집 폼 초기값 및 저장 시 DB에 기록)
          values[field.field] = field.defaultValue;
        }
      });
      return values;
    }, [configData, isLoadingConfig, criteriaFields]);

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
      // [캐시 동기화] 자동화 통계도 무효화 (설정 변경이 통계에 영향)
      void queryClient.invalidateQueries({ queryKey: ['automation-stats', tenantId] });
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
              // 타입별 초기값 처리 (DB 값 우선, 없으면 기본값 사용)
              const currentValue = formValues.criteria[field.field] ?? field.defaultValue ?? null;
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
                    <Select
                      value={String(displayValue)}
                      onChange={(value) => {
                        if (typeof value === 'string') {
                          // option value가 number인 경우 number로 변환
                          const option = field.options?.find(opt => String(opt.value) === value);
                          const convertedValue = option && typeof option.value === 'number' ? option.value : value;
                          handleCriteriaChange(field.field, convertedValue);
                        }
                      }}
                      disabled={isLoading || saveMutation.isPending}
                      fullWidth
                      showInlineLabelWhenHasValue={false}
                    >
                      {field.options.map((option) => (
                        <option key={option.value} value={String(option.value)}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  ) : field.type === 'boolean' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                      <Switch
                        checked={displayValue as boolean}
                        onChange={(e) => handleCriteriaChange(field.field, e.target.checked)}
                        disabled={isLoading || saveMutation.isPending}
                      />
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        {displayValue ? '활성화' : '비활성화'}
                      </span>
                    </div>
                  ) : field.type === 'number' ? (
                    <Input
                      type="number"
                      value={String(displayValue)}
                      onChange={(e) => {
                        const numValue = e.target.value === '' ? null : Number(e.target.value);
                        handleCriteriaChange(field.field, numValue);
                      }}
                      disabled={isLoading || saveMutation.isPending}
                      placeholder="값을 입력하세요"
                      fullWidth
                      showInlineLabelWhenHasValue={false}
                    />
                  ) : (
                    <Input
                      type="text"
                      value={displayValue as string}
                      onChange={(e) => {
                        handleCriteriaChange(field.field, e.target.value);
                      }}
                      disabled={isLoading || saveMutation.isPending}
                      placeholder="값을 입력하세요"
                      fullWidth
                      showInlineLabelWhenHasValue={false}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={saveMutation.isPending}
          size="sm"
        >
          취소
        </Button>
        <Button
          variant="solid"
          color="primary"
          onClick={handleSave}
          disabled={isLoading || saveMutation.isPending}
          size="sm"
        >
          {saveMutation.isPending ? '저장 중...' : '저장'}
        </Button>
      </div>
    </Card>
  );
}

// [SSOT] status='planned' 항목은 @core/core-automation의 AUTOMATION_EVENT_PLANNED에서 가져옴

export function AutomationSettingsPage() {
  const { showAlert, showConfirm } = useModal();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = useResponsiveMode();
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);
  // 서브사이드바 축소 상태 (태블릿 모드 기본값, 사용자 토글 가능)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isTabletMode);
  // 태블릿 모드 변경 시 축소 상태 동기화
  useEffect(() => {
    setSidebarCollapsed(isTabletMode);
  }, [isTabletMode]);
  const updateConfig = useUpdateConfig();
  const { data: currentConfigData } = useConfig();
  const terms = useIndustryTerms();

  // 서브 메뉴 상태
  const validIds = AUTOMATION_SUB_MENU_ITEMS.map(item => item.id) as readonly AutomationSubMenuId[];
  const selectedSubMenu = getSubMenuFromUrl(searchParams, validIds, DEFAULT_AUTOMATION_SUB_MENU);

  const handleSubMenuChange = useCallback((id: AutomationSubMenuId) => {
    const newUrl = setSubMenuToUrl(id, DEFAULT_AUTOMATION_SUB_MENU);
    navigate(newUrl);
  }, [navigate]);

  const [editingEventType, setEditingEventType] = useState<AutomationEventType | null>(null);
  const [showStats, setShowStats] = useState<boolean>(false);

  // 자동화 실행 통계 조회
  const { data: executionStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['automation-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) return {};

      // 최근 30일간의 모든 자동화 실행 기록을 한번에 조회
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // operation_type이 'automation.'으로 시작하는 모든 레코드 조회
      const response = await apiClient.get<{
        id: string;
        operation_type: string;
        status: string;
        occurred_at: string;
      }>('execution_audit_runs', {
        filters: {
          operation_type: 'like.automation.%',
        },
        orderBy: { column: 'occurred_at', ascending: false },
        limit: 10000, // 최근 10000건 (충분한 데이터)
      });

      // 클라이언트 측에서 30일 필터링
      const filteredData = response.data?.filter((record) => {
        const recordDate = new Date(record.occurred_at);
        return recordDate >= thirtyDaysAgo;
      }) || [];

      // 데이터가 없으면 빈 객체 반환
      if (!filteredData || filteredData.length === 0) {
        return {};
      }

      // event_type별로 그룹화하여 통계 계산
      const stats: Record<string, { total: number; success: number; failed: number; lastRun?: Date }> = {};

      filteredData.forEach((record) => {
        // operation_type에서 'automation.' 접두사 제거하여 eventType 추출
        const eventType = record.operation_type.replace('automation.', '');

        if (!stats[eventType]) {
          stats[eventType] = {
            total: 0,
            success: 0,
            failed: 0,
          };
        }

        stats[eventType].total += 1;

        if (record.status === 'success') {
          stats[eventType].success += 1;
        } else if (record.status === 'failed') {
          stats[eventType].failed += 1;
        }

        // 가장 최근 실행 시간 업데이트 (이미 내림차순 정렬되어 있으므로 첫 번째가 최신)
        if (!stats[eventType].lastRun) {
          stats[eventType].lastRun = new Date(record.occurred_at);
        }
      });

      return stats;
    },
    enabled: !!tenantId && showStats,
    staleTime: 5 * 60 * 1000, // 5분
    refetchOnWindowFocus: false, // 윈도우 포커스 시 재조회 방지
  });

  // [P1 개선] showPlanned 상태 지속성: localStorage 기반 상태 관리
  // 페이지 이탈 후 재방문 시에도 토글 상태 유지
  const [showPlanned, setShowPlanned] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('automation-settings-show-planned');
      return stored === 'true';
    } catch (error) {
      // localStorage 접근 실패 시 기본값 반환 (SSR 환경 등)
      if (import.meta.env?.DEV) {
        console.warn('[AutomationSettingsPage] localStorage 접근 실패, 기본값 사용', error);
      }
      return false;
    }
  });

  // 검색 및 필터링 상태
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'required' | 'not_required'>('all');

  // showPlanned 변경 시 localStorage에 저장
  const handleTogglePlanned = (checked: boolean) => {
    setShowPlanned(checked);
    try {
      localStorage.setItem('automation-settings-show-planned', String(checked));
    } catch (error) {
      // localStorage 저장 실패 시 경고 (쿠키 차단, 프라이빗 모드 등)
      if (import.meta.env?.DEV) {
        console.warn('[AutomationSettingsPage] localStorage 저장 실패', error);
      }
    }
  };

  // 일괄 활성화/비활성화 mutation
  const bulkToggleMutation = useMutation({
    mutationFn: async ({ eventTypes, enabled }: { eventTypes: AutomationEventType[]; enabled: boolean }) => {
      if (!tenantId) throw new Error('Tenant ID is required');

      const currentConfig = (currentConfigData || {}) as Record<string, unknown>;
      const autoNotification = (currentConfig.auto_notification || {}) as Record<string, unknown>;

      // 각 eventType의 enabled 값 업데이트
      const updatedAutoNotification = { ...autoNotification };
      eventTypes.forEach((eventType) => {
        const eventConfig = (updatedAutoNotification[eventType] || {}) as Record<string, unknown>;
        updatedAutoNotification[eventType] = {
          ...eventConfig,
          enabled,
        };
      });

      return updateConfig.mutateAsync({
        auto_notification: updatedAutoNotification,
      });
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['config', tenantId] });
      // [캐시 동기화] 자동화 통계도 무효화 (설정 변경이 통계에 영향)
      void queryClient.invalidateQueries({ queryKey: ['automation-stats', tenantId] });
      const action = variables.enabled ? '활성화' : '비활성화';
      showAlert(`${variables.eventTypes.length}개 자동화가 ${action}되었습니다.`, '성공');
    },
    onError: (error) => {
      showAlert(`일괄 변경 중 오류가 발생했습니다: ${error.message}`, '오류');
    },
  });

  // 카테고리별 일괄 토글
  const handleToggleCategory = async (category: string, enabled: boolean) => {
    const categoryEvents = eventsByCategory.find((item) => item.category === category)?.events || [];
    if (categoryEvents.length === 0) return;

    const categoryInfo = POLICY_KEY_V2_CATEGORIES[category];
    const action = enabled ? '활성화' : '비활성화';

    const confirmed = await showConfirm(
      `"${categoryInfo?.title}" 카테고리의 모든 자동화(${categoryEvents.length}개)를 ${action}하시겠습니까?`,
      '카테고리 일괄 설정'
    );
    if (confirmed) {
      bulkToggleMutation.mutate({ eventTypes: categoryEvents, enabled });
    }
  };

  // 표시할 event_type 목록 필터링
  const visibleEvents = useMemo(() => {
    let events = showPlanned
      ? [...AUTOMATION_EVENT_CATALOG] // readonly 배열을 일반 배열로 복사
      : AUTOMATION_EVENT_CATALOG.filter((eventType) => !AUTOMATION_EVENT_PLANNED.includes(eventType));

    // 검색어 필터링
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      events = events.filter((eventType) => {
        const description = AUTOMATION_EVENT_DESCRIPTIONS[eventType];
        if (!description) return false;

        const titleMatch = description.title.toLowerCase().includes(query);
        const descMatch = description.description.toLowerCase().includes(query);
        return titleMatch || descMatch;
      });
    }

    // 카테고리 필터링
    if (categoryFilter !== 'all') {
      events = events.filter((eventType) => {
        const description = AUTOMATION_EVENT_DESCRIPTIONS[eventType];
        return description?.policyKey === categoryFilter;
      });
    }

    // 상태 필터링
    if (statusFilter !== 'all') {
      events = events.filter((eventType) => {
        const autoNotification = (currentConfigData?.auto_notification || {}) as Record<string, unknown>;
        const eventConfig = (autoNotification[eventType] || {}) as Record<string, unknown>;
        const isEnabled = eventConfig.enabled === true;

        return statusFilter === 'enabled' ? isEnabled : !isEnabled;
      });
    }

    // 승인 필요 여부 필터링
    if (approvalFilter !== 'all') {
      events = events.filter((eventType) => {
        const autoNotification = (currentConfigData?.auto_notification || {}) as Record<string, unknown>;
        const eventConfig = (autoNotification[eventType] || {}) as Record<string, unknown>;
        const requiresApproval = eventConfig.require_approval === true;

        return approvalFilter === 'required' ? requiresApproval : !requiresApproval;
      });
    }

    return events;
  }, [showPlanned, searchQuery, categoryFilter, statusFilter, approvalFilter, currentConfigData]);

  // 전체 일괄 토글
  const handleToggleAll = async (enabled: boolean) => {
    const action = enabled ? '활성화' : '비활성화';

    const confirmed = await showConfirm(
      `모든 자동화(${visibleEvents.length}개)를 ${action}하시겠습니까?`,
      '전체 일괄 설정'
    );
    if (confirmed) {
      bulkToggleMutation.mutate({ eventTypes: visibleEvents, enabled });
    }
  };

  // 필터 초기화
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setApprovalFilter('all');
  };

  // 필터가 활성화되었는지 확인
  const hasActiveFilters = searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || approvalFilter !== 'all';

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
      <div style={{ display: 'flex', minHeight: 'var(--height-full)' }}>
        {/* 서브 사이드바 (모바일에서는 숨김, 태블릿에서는 축소) */}
        {!isMobileMode && (
          <SubSidebar
            title="자동화 설정"
            items={AUTOMATION_SUB_MENU_ITEMS}
            selectedId={selectedSubMenu}
            onSelect={handleSubMenuChange}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            testId="automation-sub-sidebar"
          />
        )}

        {/* 메인 콘텐츠 */}
        <Container maxWidth="xl" padding="lg" style={{ flex: 1 }}>
          <PageHeader title={AUTOMATION_SUB_MENU_ITEMS.find(item => item.id === selectedSubMenu)?.label || "자동화 설정"} />
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)', marginBottom: 'var(--spacing-lg)' }}>
            42개 자동화 기능의 활성화 여부를 설정합니다. 모든 자동화는 Policy 기반으로 동작하며, 설정이 없으면 실행되지 않습니다 (Fail Closed).
          </p>

          {/* 자동화 규칙 탭 (기본) */}
          {selectedSubMenu === 'rules' && (
            <>
              {/* 상단 컨트롤 영역 */}
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          {/* 검색 및 필터 */}
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)', flexWrap: 'wrap' }}>
            {/* 검색 입력 */}
            <div style={{ flex: '1 1 300px' }}>
              <Input
                type="text"
                placeholder="자동화 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                fullWidth
                size="sm"
              />
            </div>

            {/* 상태 필터 */}
            <Select
              value={statusFilter}
              onChange={(value) => {
                if (typeof value === 'string') {
                  setStatusFilter(value as 'all' | 'enabled' | 'disabled');
                }
              }}
              size="sm"
              style={{ minWidth: '140px' }}
            >
              <option value="all">전체 상태</option>
              <option value="enabled">사용중</option>
              <option value="disabled">사용중단</option>
            </Select>

            {/* 카테고리 필터 */}
            <Select
              value={categoryFilter}
              onChange={(value) => {
                if (typeof value === 'string') {
                  setCategoryFilter(value);
                }
              }}
              size="sm"
              style={{ minWidth: '160px' }}
            >
              <option value="all">전체 카테고리</option>
              {Object.entries(POLICY_KEY_V2_CATEGORIES)
                .sort(([, a], [, b]) => a.order - b.order)
                .map(([key, category]) => (
                  <option key={key} value={key}>
                    {category.title}
                  </option>
                ))}
            </Select>

            {/* 승인 필터 */}
            <Select
              value={approvalFilter}
              onChange={(value) => {
                if (typeof value === 'string') {
                  setApprovalFilter(value as 'all' | 'required' | 'not_required');
                }
              }}
              size="sm"
              style={{ minWidth: '140px' }}
            >
              <option value="all">승인 전체</option>
              <option value="required">승인 필요</option>
              <option value="not_required">승인 불필요</option>
            </Select>

            {/* 필터 초기화 버튼 */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={handleResetFilters}
                size="sm"
              >
                필터 초기화
              </Button>
            )}
          </div>

          {/* 검색 결과 표시 */}
          {hasActiveFilters && (
            <div style={{ marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              {visibleEvents.length}개의 자동화가 검색되었습니다.
            </div>
          )}

          {/* 전체 통계 요약 */}
          {showStats && !isLoadingStats && executionStats && Object.keys(executionStats).length > 0 && (
            <div style={{
              marginBottom: 'var(--spacing-md)',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              backgroundColor: 'var(--color-background-secondary)',
              borderRadius: 'var(--radius-md)',
              border: 'var(--border-width-thin) solid var(--color-border)',
              display: 'flex',
              gap: 'var(--spacing-lg)',
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>총 실행 횟수</span>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>
                  {Object.values(executionStats).reduce((sum, stat) => sum + stat.total, 0)}회
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>성공</span>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-success)' }}>
                  {Object.values(executionStats).reduce((sum, stat) => sum + stat.success, 0)}회
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>실패</span>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-error)' }}>
                  {Object.values(executionStats).reduce((sum, stat) => sum + stat.failed, 0)}회
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>성공률</span>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>
                  {(() => {
                    const total = Object.values(executionStats).reduce((sum, stat) => sum + stat.total, 0);
                    const success = Object.values(executionStats).reduce((sum, stat) => sum + stat.success, 0);
                    return total > 0 ? `${Math.round((success / total) * 100)}%` : '0%';
                  })()}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>활성 자동화</span>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>
                  {Object.keys(executionStats).length}개
                </span>
              </div>
            </div>
          )}

          {/* 일괄 작업 및 토글 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
            {/* 좌측: 일괄 활성화/비활성화 */}
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                color="primary"
                onClick={() => handleToggleAll(true)}
                disabled={bulkToggleMutation.isPending}
                size="sm"
              >
                전체 활성화
              </Button>
              <Button
                variant="outline"
                onClick={() => handleToggleAll(false)}
                disabled={bulkToggleMutation.isPending}
                size="sm"
              >
                전체 비활성화
              </Button>
            </div>

            {/* 우측: 토글 버튼들 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <label
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    실행 통계 표시
                  </label>
                  {showStats && isLoadingStats && (
                    <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--color-text-tertiary)' }}>
                      통계 로딩중...
                    </span>
                  )}
                  {showStats && !isLoadingStats && executionStats && (
                    <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--color-text-tertiary)' }}>
                      최근 30일 기준
                    </span>
                  )}
                </div>
                <Switch checked={showStats} onChange={(e) => setShowStats(e.target.checked)} />
              </div>
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
          </div>
        </div>

        {/* 카테고리별 섹션 */}
        {eventsByCategory.map(({ category, events }) => {
          const categoryInfo = POLICY_KEY_V2_CATEGORIES[category];
          if (!categoryInfo) return null;

          return (
            <div key={category} style={{ marginBottom: 'var(--spacing-2xl)' }}>
              {/* 카테고리 헤더 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-md)', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
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
                {/* 카테고리별 일괄 토글 버튼 */}
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                  <Button
                    variant="outline"
                    color="success"
                    onClick={() => handleToggleCategory(category, true)}
                    disabled={bulkToggleMutation.isPending}
                    size="xs"
                  >
                    전체 활성화
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleToggleCategory(category, false)}
                    disabled={bulkToggleMutation.isPending}
                    size="xs"
                  >
                    전체 비활성화
                  </Button>
                </div>
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
                    stats={executionStats?.[eventType]}
                    showStats={showStats}
                    terms={terms}
                  />
                ))}
                desktopColumns={3}
                tabletColumns={2}
                mobileColumns={1}
              />
            </div>
          );
        })}
            </>
          )}

          {/* 자동화 통계 탭 */}
          {selectedSubMenu === 'statistics' && (
            <>
            <Card padding="lg">
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>자동화 통계</h3>
              {isLoadingStats ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                  로딩 중...
                </div>
              ) : executionStats && Object.keys(executionStats).length > 0 ? (
                <div>
                  <div style={{
                    marginBottom: 'var(--spacing-lg)',
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-background-secondary)',
                    borderRadius: 'var(--radius-md)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 'var(--spacing-md)',
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
                        {Object.values(executionStats).reduce((sum, stat) => sum + stat.total, 0)}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>총 실행 횟수</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
                        {Object.values(executionStats).reduce((sum, stat) => sum + stat.success, 0)}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>성공</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-error)' }}>
                        {Object.values(executionStats).reduce((sum, stat) => sum + stat.failed, 0)}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>실패</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
                        {(() => {
                          const total = Object.values(executionStats).reduce((sum, stat) => sum + stat.total, 0);
                          const success = Object.values(executionStats).reduce((sum, stat) => sum + stat.success, 0);
                          return total > 0 ? `${Math.round((success / total) * 100)}%` : '0%';
                        })()}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>성공률</div>
                    </div>
                  </div>
                  <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                    최근 30일 기준
                  </p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                  자동화 실행 데이터가 없습니다.
                </div>
              )}
            </Card>
            </>
          )}
        </Container>
      </div>
    </ErrorBoundary>
  );
}

// 각 카드에서 개별적으로 활성화 상태 및 자동화 기준을 조회하는 컴포넌트
function AutomationCardWithState({
  eventType,
  isEditing,
  onEdit,
  onCancel,
  stats,
  showStats,
  terms
}: {
  eventType: AutomationEventType;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  stats?: {
    total: number;
    success: number;
    failed: number;
    lastRun?: Date;
  };
  showStats?: boolean;
  terms: ReturnType<typeof useIndustryTerms>;
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
      // [SSOT] field.policyPath를 직접 사용하여 중첩 경로 지원
      const policyPath = field.policyPath;
      // [SSOT] getPolicyValueFromConfig를 사용하여 Policy 조회 통일
      const value = getPolicyValueFromConfig(configData, policyPath);
      if (value !== null && value !== undefined) {
        // DB에 실제 값이 있는 경우 사용
        values[field.field] = value;
      } else if (field.defaultValue !== undefined) {
        // DB에 값이 없으면 기본값 사용 (편집 폼 초기값 및 저장 시 DB에 기록)
        values[field.field] = field.defaultValue;
      }
    });
    return values;
  }, [configData, isLoadingConfig, criteriaFields]);

  return (
    <AutomationCard
      eventType={eventType}
      isEnabled={isEnabled}
      criteriaValues={criteriaValues}
      isEditing={isEditing}
      onEdit={onEdit}
      onCancel={onCancel}
      stats={stats}
      showStats={showStats}
      terms={terms}
    />
  );
}
