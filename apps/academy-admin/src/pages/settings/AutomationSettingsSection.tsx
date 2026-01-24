/**
 * 자동화 설정 섹션
 *
 * [LAYER: UI_SECTION]
 *
 * 기존 AutomationSettingsPage의 콘텐츠를 섹션 컴포넌트로 래핑
 * 통합 설정 페이지(SettingsPage)에서 사용
 *
 * UI 스타일: 카드 그리드 패턴 (수업카드 스타일 참고)
 * - 카테고리별 SettingsSection으로 그룹화
 * - 각 자동화 규칙은 카드로 표시 (클릭 시 카드 내 인라인 설정)
 * - 반응형: 데스크톱 3열, 태블릿 2열, 모바일 1열
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  useModal,
  Switch,
  SettingsSection,
  Button,
  Input,
  Select,
  Card,
  EmptyState,
  useIsMobile,
  useIsTablet,
} from '@ui-core/react';
import { getApiContext, apiClient } from '@api-sdk/core';
import { AUTOMATION_EVENT_CATALOG, AUTOMATION_EVENT_PLANNED } from '@core/core-automation';
import { Wallet, Users, Heart, Megaphone, ShieldCheck, UserCog, BarChart3 } from 'lucide-react';
import {
  AUTOMATION_EVENT_DESCRIPTIONS,
  AUTOMATION_EVENT_CRITERIA_FIELDS,
  POLICY_KEY_V2_CATEGORIES,
  AUTOMATION_SUB_MENU_ITEMS,
  type AutomationEventCriteriaField,
  type AutomationSubMenuId,
} from '../../constants';
import { useUpdateConfig, useConfig, useTenantSettingByPath } from '@hooks/use-config';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { getAutomationEventPolicyPath } from '../../utils';

type AutomationEventType = (typeof AUTOMATION_EVENT_CATALOG)[number];

/**
 * 자동화 규칙 카드 컴포넌트
 *
 * 수업카드 스타일 기반 - 클릭 시 카드 내 인라인 설정 모드로 전환
 */
interface AutomationCardProps {
  eventType: AutomationEventType;
  terms: ReturnType<typeof useIndustryTerms>;
  stats?: {
    total: number;
    success: number;
    failed: number;
  };
  showStats?: boolean;
}

function AutomationCard({ eventType, terms, stats, showStats }: AutomationCardProps) {
  const { showAlert } = useModal();
  const context = getApiContext();
  const tenantId = context.tenantId;

  const description = AUTOMATION_EVENT_DESCRIPTIONS[eventType];
  const criteriaFields = useMemo(() => AUTOMATION_EVENT_CRITERIA_FIELDS[eventType] || [], [eventType]);
  const enabledPolicyPath = getAutomationEventPolicyPath(eventType, 'enabled');

  const { data: enabledValue, isLoading } = useTenantSettingByPath(enabledPolicyPath);
  const serverEnabled = enabledValue === true;

  // Optimistic UI: mutation 진행 중에만 로컬 상태 사용
  const [optimisticEnabled, setOptimisticEnabled] = useState<boolean | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  // 인라인 설정 폼 상태
  const [formValues, setFormValues] = useState<Record<string, string | number | boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  // mutation 진행 중이면 optimistic 값 사용, 아니면 서버 값 사용
  const isEnabled = isMutating && optimisticEnabled !== null ? optimisticEnabled : serverEnabled;

  // 최신 config 데이터 참조용 (handleToggle에서 스냅샷 전달)
  const { data: currentConfigData } = useConfig();
  const updateConfig = useUpdateConfig();

  // 각 조건 필드의 현재 값 조회
  const getCriteriaValue = useCallback((field: AutomationEventCriteriaField): string | number | boolean | null => {
    if (!currentConfigData) return field.defaultValue ?? null;
    const autoNotification = (currentConfigData as Record<string, unknown>).auto_notification as Record<string, unknown> | undefined;
    if (!autoNotification) return field.defaultValue ?? null;
    const eventConfig = autoNotification[eventType] as Record<string, unknown> | undefined;
    if (!eventConfig) return field.defaultValue ?? null;
    const value = eventConfig[field.field];
    return value !== undefined ? (value as string | number | boolean) : (field.defaultValue ?? null);
  }, [currentConfigData, eventType]);

  // 설명을 구조화된 형태로 분리 (메인 설명, 예시, 설정값)
  interface DescriptionParts {
    mainDescription: string;
    example: string | null;
    settings: string | null;
  }

  const descriptionParts = useMemo((): DescriptionParts => {
    let desc = description.description;

    // 업종 용어 치환
    desc = desc.replace(/학부모/g, terms.PAYER_LABEL);
    desc = desc.replace(/학생(?!의)/g, terms.PERSON_LABEL_PRIMARY);
    desc = desc.replace(/학생의/g, `${terms.PERSON_LABEL_PRIMARY}의`);
    desc = desc.replace(/수업/g, terms.GROUP_LABEL);
    desc = desc.replace(/강사/g, terms.PERSON_LABEL_SECONDARY);
    desc = desc.replace(/수납률/g, terms.COLLECTION_RATE_LABEL);

    // "예:" 기준으로 메인 설명과 예시 분리
    const exampleMarkerIndex = desc.indexOf(' 예:');
    let mainDescription = desc;
    let example: string | null = null;

    if (exampleMarkerIndex !== -1) {
      mainDescription = desc.substring(0, exampleMarkerIndex).trim();
      // "예:" → "예 : "로 변경하여 표시
      const rawExample = desc.substring(exampleMarkerIndex + 1).trim(); // "예: ..." 포함
      example = rawExample.replace(/^예:/, '예 :');
    }

    // 주요 조건 필드 값 표시 (채널 제외, 숫자/boolean 조건만)
    const conditionFields = criteriaFields.filter(f =>
      (f.type === 'number' || f.type === 'boolean') && f.field !== 'channel'
    );

    let settings: string | null = null;
    if (conditionFields.length > 0) {
      const conditions = conditionFields.map(field => {
        const value = getCriteriaValue(field);
        if (value === null || value === undefined) return null;

        // 값 포맷팅
        let formattedValue: string;
        if (field.type === 'boolean') {
          formattedValue = value ? '활성화' : '비활성화';
        } else if (field.label.includes('원)')) {
          formattedValue = `${Number(value).toLocaleString()}원`;
        } else if (field.label.includes('%')) {
          formattedValue = `${value}%`;
        } else if (field.label.includes('일)') || field.label.includes('일수')) {
          formattedValue = `${value}일`;
        } else if (field.label.includes('분)') || field.label.includes('시간')) {
          formattedValue = field.label.includes('시간') ? `${value}시간` : `${value}분`;
        } else if (field.label.includes('배수')) {
          formattedValue = `${value}배`;
        } else if (field.label.includes('위)')) {
          formattedValue = `${value}위`;
        } else if (field.label.includes('명)') || field.label.includes('수')) {
          formattedValue = `${value}명`;
        } else if (field.label.includes('건수')) {
          formattedValue = `${value}건`;
        } else {
          formattedValue = String(value);
        }

        // 필드 라벨에서 괄호 부분 제거하여 간결하게
        const shortLabel = field.label.replace(/\s*\([^)]*\)/g, '').trim();
        return `${shortLabel} : ${formattedValue}`;
      }).filter(Boolean);

      if (conditions.length > 0) {
        settings = conditions.join(', ');
      }
    }

    return { mainDescription, example, settings };
  }, [description, terms, criteriaFields, getCriteriaValue]);

  // 토글 핸들러
  const toggleMutation = useMutation({
    // mutationKey로 이벤트별 고유 mutation 식별 (중복 실행 방지)
    mutationKey: ['automation-toggle', eventType],
    mutationFn: async ({ newEnabled, configSnapshot }: { newEnabled: boolean; configSnapshot: Record<string, unknown> }) => {
      if (!tenantId) throw new Error('Tenant ID is required');

      // configSnapshot: 호출 시점의 최신 데이터 사용 (클로저 문제 방지)
      const autoNotification = (configSnapshot.auto_notification || {}) as Record<string, unknown>;
      const eventConfig = (autoNotification[eventType] || {}) as Record<string, unknown>;

      const updatedEventConfig = {
        ...eventConfig,
        enabled: newEnabled,
      };

      const updatedAutoNotification = {
        ...autoNotification,
        [eventType]: updatedEventConfig,
      };

      return updateConfig.mutateAsync({
        auto_notification: updatedAutoNotification,
      });
    },
    onSuccess: () => {
      // 서버 응답 후 mutation 상태 초기화
      // useConfig의 setQueryData가 캐시를 업데이트하므로 serverEnabled가 자동 갱신됨
      setIsMutating(false);
      setOptimisticEnabled(null);
    },
    onError: (error: Error) => {
      // 실패 시 optimistic 상태 롤백
      setIsMutating(false);
      setOptimisticEnabled(null);
      showAlert(`설정 변경에 실패했습니다: ${error.message}`, '오류');
    },
  });

  const handleToggle = useCallback((checked: boolean) => {
    // Optimistic update: 즉시 UI 반영
    setIsMutating(true);
    setOptimisticEnabled(checked);
    // 호출 시점의 최신 config 스냅샷 전달 (클로저 문제 방지)
    toggleMutation.mutate({
      newEnabled: checked,
      configSnapshot: (currentConfigData || {}) as Record<string, unknown>,
    });
  }, [toggleMutation, currentConfigData]);


  // 설정 저장 핸들러 (저장만 수행, 모드 전환은 호출자가 처리)
  const handleSaveSettings = useCallback(async (): Promise<boolean> => {
    if (!tenantId) {
      showAlert('테넌트 ID가 없습니다.', '오류');
      return false;
    }

    setIsSaving(true);
    try {
      const configSnapshot = (currentConfigData || {}) as Record<string, unknown>;
      const autoNotification = (configSnapshot.auto_notification || {}) as Record<string, unknown>;
      const eventConfig = (autoNotification[eventType] || {}) as Record<string, unknown>;

      // 폼 값을 이벤트 설정에 병합
      const updatedEventConfig = {
        ...eventConfig,
        ...formValues,
      };

      const updatedAutoNotification = {
        ...autoNotification,
        [eventType]: updatedEventConfig,
      };

      await updateConfig.mutateAsync({
        auto_notification: updatedAutoNotification,
      });

      showAlert('설정이 저장되었습니다.', '성공');
      return true;
    } catch (error) {
      showAlert(`설정 저장에 실패했습니다: ${(error as Error).message}`, '오류');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [tenantId, currentConfigData, eventType, formValues, updateConfig, showAlert]);

  // 폼 값 변경 핸들러
  const handleFormValueChange = useCallback((fieldName: string, value: string | number | boolean) => {
    setFormValues(prev => ({ ...prev, [fieldName]: value }));
  }, []);

  // 설정 가능한 필드가 있는지 확인
  const hasConfigurableFields = criteriaFields.length > 0;

  // 설정 모드 상태 (카드 내 인라인 설정)
  const [isEditMode, setIsEditMode] = useState(false);

  // 설정 모드로 전환
  const handleEnterEditMode = useCallback(() => {
    if (hasConfigurableFields) {
      // 현재 설정값으로 폼 초기화
      const initialValues: Record<string, string | number | boolean> = {};
      criteriaFields.forEach(field => {
        const value = getCriteriaValue(field);
        initialValues[field.field] = value ?? field.defaultValue ?? '';
      });
      setFormValues(initialValues);
      setIsEditMode(true);
    }
  }, [hasConfigurableFields, criteriaFields, getCriteriaValue]);

  // 설정 모드 종료 (취소)
  const handleCancelEdit = useCallback(() => {
    setIsEditMode(false);
    setFormValues({});
  }, []);

  // 설정 저장 후 모드 종료
  const handleSaveAndClose = useCallback(async () => {
    const success = await handleSaveSettings();
    if (success) {
      setIsEditMode(false);
      setFormValues({});
    }
  }, [handleSaveSettings]);

  // 일반 모드 렌더링
  const renderViewMode = () => (
    <>
      {/* 상단: 제목 + 토글 스위치 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontWeight: 'var(--font-weight-semibold)',
            fontSize: 'var(--font-size-lg)',
            color: 'var(--color-text)',
          }}
        >
          {description.title}
        </span>
        {/* 토글 wrapper: 카드 클릭 이벤트 전파 방지 */}
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={isEnabled}
            onChange={(e) => {
              handleToggle(e.target.checked);
            }}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* 구분선 */}
      <div
        style={{
          borderTop: 'var(--border-width-thin) solid var(--color-gray-200)',
          marginTop: 'var(--spacing-xs)',
        }}
      />

      {/* 메인 설명 - 베이스 폰트 */}
      <div
        style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--color-text-secondary)',
          lineHeight: 'var(--line-height-relaxed)',
        }}
      >
        {descriptionParts.mainDescription}
      </div>

      {/* 예시 라인 - 베이스 폰트, 연한 색상 */}
      {descriptionParts.example && (
        <div
          style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-tertiary)',
            lineHeight: 'var(--line-height-relaxed)',
          }}
        >
          {descriptionParts.example}
        </div>
      )}

      {/* 예시와 설정값 사이 구분선 */}
      {descriptionParts.settings && (
        <div
          style={{
            borderTop: 'var(--border-width-thin) solid var(--color-gray-200)',
            marginTop: 'var(--spacing-xs)',
          }}
        />
      )}

      {/* 하단: 설정값 + 설정 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        {/* 설정값 라인 - 베이스 폰트, 볼드 */}
        {descriptionParts.settings ? (
          <div
            style={{
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {descriptionParts.settings}
          </div>
        ) : (
          <div />
        )}

        {/* 설정 버튼 (조건 필드가 있는 경우에만 표시) - 배지 스타일 */}
        {hasConfigurableFields && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEnterEditMode();
            }}
            style={{
              padding: '2px var(--spacing-xs)',
              backgroundColor: 'var(--color-gray-500)',
              border: 'none',
              borderRadius: 'var(--border-radius-xs)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-white)',
              cursor: 'pointer',
              transition: 'var(--transition-base)',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-gray-600)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-gray-500)';
            }}
            aria-label={`${description.title} 설정`}
          >
            설정
          </button>
        )}
      </div>

      {/* 통계 */}
      {showStats && stats && stats.total > 0 && (
        <div
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            borderTop: 'var(--border-width-thin) solid var(--color-gray-100)',
            paddingTop: 'var(--spacing-sm)',
          }}
        >
          실행 {stats.total}회 • 성공 {stats.success}
          {stats.failed > 0 && ` • 실패 ${stats.failed}`}
        </div>
      )}
    </>
  );

  // 설정 모드 렌더링
  const renderEditMode = () => (
    <>
      {/* 상단: 제목 + 토글 스위치 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontWeight: 'var(--font-weight-semibold)',
            fontSize: 'var(--font-size-lg)',
            color: 'var(--color-text)',
          }}
        >
          {description.title} 설정
        </span>
        {/* 토글 wrapper: 카드 클릭 이벤트 전파 방지 */}
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={isEnabled}
            onChange={(e) => {
              handleToggle(e.target.checked);
            }}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* 구분선 */}
      <div
        style={{
          borderTop: 'var(--border-width-thin) solid var(--color-gray-200)',
          marginTop: 'var(--spacing-xs)',
        }}
      />

      {/* 설정 폼 필드 - 클릭 이벤트 전파 방지 */}
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {criteriaFields.map((field) => (
          <div key={field.field}>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              {field.label}
            </label>
            {field.type === 'select' && field.options ? (
              <Select
                value={String(formValues[field.field] ?? field.defaultValue ?? '')}
                onChange={(value) => handleFormValueChange(field.field, Array.isArray(value) ? value[0] : value)}
                options={field.options.map(opt => ({
                  value: String(opt.value),
                  label: opt.label,
                }))}
                fullWidth
                size="sm"
              />
            ) : field.type === 'boolean' ? (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Switch
                  checked={Boolean(formValues[field.field] ?? field.defaultValue ?? false)}
                  onChange={(e) => handleFormValueChange(field.field, e.target.checked)}
                />
                <span
                  style={{
                    marginLeft: 'var(--spacing-sm)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {(formValues[field.field] ?? field.defaultValue ?? false) ? '활성화' : '비활성화'}
                </span>
              </div>
            ) : field.type === 'number' ? (
              <Input
                type="number"
                value={String(formValues[field.field] ?? field.defaultValue ?? '')}
                onChange={(e) => handleFormValueChange(field.field, Number(e.target.value))}
                min={field.min}
                max={field.max}
                fullWidth
                size="sm"
              />
            ) : (
              <Input
                type="text"
                value={String(formValues[field.field] ?? field.defaultValue ?? '')}
                onChange={(e) => handleFormValueChange(field.field, e.target.value)}
                fullWidth
                size="sm"
              />
            )}
          </div>
        ))}
      </div>

      {/* 버튼 위 구분선 */}
      <div
        style={{
          borderTop: 'var(--border-width-thin) solid var(--color-gray-200)',
          marginTop: 'var(--spacing-md)',
          paddingTop: 'var(--spacing-md)',
        }}
      />

      {/* 하단: 취소/저장 버튼 */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'auto' }}>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleCancelEdit();
          }}
          style={{ flex: 1 }}
        >
          취소
        </Button>
        <Button
          variant="solid"
          color="primary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            void handleSaveAndClose();
          }}
          disabled={isSaving}
          style={{ flex: 1 }}
        >
          {isSaving ? '저장 중...' : '저장'}
        </Button>
      </div>
    </>
  );

  return (
    <Card
      padding="md"
      variant="outlined"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-sm)',
        cursor: 'default',
        borderColor: isEditMode ? 'var(--color-primary)' : isEnabled ? 'var(--color-primary-light)' : 'var(--color-gray-200)',
        // 비활성 카드: 기본 gray-50, 활성 카드: 기본 white
        backgroundColor: isEditMode
          ? 'var(--color-gray-50)'
          : isEnabled
            ? 'var(--color-white)'
            : 'var(--color-gray-50)',
        transition: 'background-color var(--transition-fast), border-color var(--transition-fast)',
        paddingTop: 'var(--spacing-lg)',
        paddingBottom: 'var(--spacing-lg)',
        height: '100%',
        minHeight: isEditMode ? 'auto' : undefined,
      }}
    >
      {isEditMode ? renderEditMode() : renderViewMode()}
    </Card>
  );
}

export function AutomationSettingsSection() {
  const context = getApiContext();
  const tenantId = context.tenantId;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const terms = useIndustryTerms();

  // 반응형 모드 감지
  const isMobileMode = useIsMobile();
  const isTabletMode = useIsTablet();

  // 탭 상태 (URL 쿼리 파라미터 기반)
  const tabParam = searchParams.get('tab') as AutomationSubMenuId | null;
  const selectedTab =
    tabParam && ['rules', 'statistics'].includes(tabParam)
      ? tabParam
      : 'rules';

  const handleTabChange = useCallback(
    (tabId: string) => {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('tab', tabId);
      navigate(`?${newSearchParams.toString()}`, { replace: true });
    },
    [navigate, searchParams]
  );

  // 실행 통계: 항상 활성화
  const showStats = true;

  // 준비중 이벤트 표시: 항상 활성화
  const showPlanned = true;

  // 실행 통계 조회
  const { data: executionStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['automation-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) return {};

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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
        limit: 10000,
      });

      const filteredData =
        response.data?.filter((record) => {
          const recordDate = new Date(record.occurred_at);
          return recordDate >= thirtyDaysAgo;
        }) || [];

      if (!filteredData || filteredData.length === 0) {
        return {};
      }

      const stats: Record<string, { total: number; success: number; failed: number }> = {};

      filteredData.forEach((record) => {
        const eventType = record.operation_type.replace('automation.', '');

        if (!stats[eventType]) {
          stats[eventType] = { total: 0, success: 0, failed: 0 };
        }

        stats[eventType].total += 1;
        if (record.status === 'success') {
          stats[eventType].success += 1;
        } else if (record.status === 'failed') {
          stats[eventType].failed += 1;
        }
      });

      return stats;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // 표시할 이벤트 목록 (준비중 포함 여부에 따라 필터링)
  const visibleEvents = useMemo(() => {
    return showPlanned
      ? [...AUTOMATION_EVENT_CATALOG]
      : AUTOMATION_EVENT_CATALOG.filter((eventType) => !AUTOMATION_EVENT_PLANNED.includes(eventType));
  }, [showPlanned]);

  // 카테고리별 그룹화
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
    <div>
      {/* 탭 네비게이션 - Button 컴포넌트 스타일 */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-sm)',
          marginBottom: 'var(--spacing-3xl)',
        }}
      >
        {AUTOMATION_SUB_MENU_ITEMS.map((item) => {
          const isActive = selectedTab === item.id;
          return (
            <Button
              key={item.id}
              variant={isActive ? 'solid' : 'outline'}
              size="sm"
              onClick={() => handleTabChange(item.id)}
              style={{
                color: isActive ? 'var(--color-white)' : 'var(--color-text-secondary)',
              }}
            >
              {item.label}
            </Button>
          );
        })}
      </div>

      {/* 자동화 규칙 탭 (기본) */}
      {selectedTab === 'rules' && (
        <>
          {/* 카테고리별 섹션 */}
          {eventsByCategory.map(({ category, events }) => {
            const categoryInfo = POLICY_KEY_V2_CATEGORIES[category];
            if (!categoryInfo) return null;

            // 카테고리별 아이콘 매핑 (출결관리 페이지 스타일: size={22}, strokeWidth={1.5})
            const categoryIconMap: Record<string, React.ReactNode> = {
              financial_health: <Wallet size={22} strokeWidth={1.5} />,
              capacity_optimization: <Users size={22} strokeWidth={1.5} />,
              customer_retention: <Heart size={22} strokeWidth={1.5} />,
              growth_marketing: <Megaphone size={22} strokeWidth={1.5} />,
              safety_compliance: <ShieldCheck size={22} strokeWidth={1.5} />,
              workforce_ops: <UserCog size={22} strokeWidth={1.5} />,
            };

            return (
              <SettingsSection key={category} title={categoryInfo.title} icon={categoryIconMap[category]} noBorder>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobileMode ? '1fr' : isTabletMode ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                    gap: 'var(--spacing-md)',
                  }}
                >
                  {events.map((eventType) => (
                    <AutomationCard
                      key={eventType}
                      eventType={eventType}
                      terms={terms}
                      stats={executionStats?.[eventType]}
                      showStats={showStats}
                    />
                  ))}
                </div>
              </SettingsSection>
            );
          })}
        </>
      )}

      {/* 자동화 통계 탭 */}
      {selectedTab === 'statistics' && (
        <SettingsSection title="자동화 통계" icon={<BarChart3 size={22} strokeWidth={1.5} />}>
          <div style={{ padding: 'var(--spacing-lg)' }}>
            {isLoadingStats ? (
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                통계를 불러오는 중...
              </div>
            ) : executionStats && Object.keys(executionStats).length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 'var(--spacing-lg)',
                }}
              >
                <div
                  style={{
                    textAlign: 'center',
                    padding: 'var(--spacing-lg)',
                    backgroundColor: 'var(--color-gray-50)',
                    borderRadius: 'var(--border-radius-sm)',
                  }}
                >
                  <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
                    {Object.values(executionStats).reduce((sum, stat) => sum + stat.total, 0)}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
                    총 실행 횟수
                  </div>
                </div>
                <div
                  style={{
                    textAlign: 'center',
                    padding: 'var(--spacing-lg)',
                    backgroundColor: 'var(--color-success-50)',
                    borderRadius: 'var(--border-radius-sm)',
                  }}
                >
                  <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
                    {Object.values(executionStats).reduce((sum, stat) => sum + stat.success, 0)}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
                    성공
                  </div>
                </div>
                <div
                  style={{
                    textAlign: 'center',
                    padding: 'var(--spacing-lg)',
                    backgroundColor: 'var(--color-error-50)',
                    borderRadius: 'var(--border-radius-sm)',
                  }}
                >
                  <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-error)' }}>
                    {Object.values(executionStats).reduce((sum, stat) => sum + stat.failed, 0)}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
                    실패
                  </div>
                </div>
                <div
                  style={{
                    textAlign: 'center',
                    padding: 'var(--spacing-lg)',
                    backgroundColor: 'var(--color-primary-50)',
                    borderRadius: 'var(--border-radius-sm)',
                  }}
                >
                  <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
                    {(() => {
                      const total = Object.values(executionStats).reduce((sum, stat) => sum + stat.total, 0);
                      const success = Object.values(executionStats).reduce((sum, stat) => sum + stat.success, 0);
                      return total > 0 ? `${Math.round((success / total) * 100)}%` : '0%';
                    })()}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
                    성공률
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={BarChart3}
                message="자동화 실행 데이터가 없습니다"
                description="자동화 규칙을 활성화하면 실행 통계가 여기에 표시됩니다."
              />
            )}
          </div>
        </SettingsSection>
      )}
    </div>
  );
}

export default AutomationSettingsSection;
