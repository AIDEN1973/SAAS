/**
 * SchemaWidget Component
 *
 * SDUI v1.1: Widget Schema 렌더러(대시보드용 카드/차트/지표)
 *
 * 기술문서: SDUI 기술문서 v1.1 - 15. Widget Engine
 * [불변 규칙] CSS 변수 사용, Tailwind 클래스 직접 사용 금지
 * [불변 규칙] Zero-Trust: @api-sdk/core를 통한 API 호출
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@ui-core/react';
import type { WidgetSchema } from '../types';

export interface SchemaWidgetProps {
  schema: WidgetSchema;
  className?: string;
  // API 호출 함수 (선택적, 없으면 @api-sdk/core의 apiClient 사용)
  apiCall?: (endpoint: string, method: string, body?: any) => Promise<any>;
}

/**
 * SchemaWidget 컴포넌트
 *
 * WidgetSchema를 렌더링합니다.
 * 대시보드용 카드, 차트, 지표 등을 표시합니다.
 */
export const SchemaWidget: React.FC<SchemaWidgetProps> = ({
  schema,
  className,
  apiCall,
}) => {
  const { componentType, dataSource, config, refreshInterval } = schema.widget;

  // SDUI v1.1: API 데이터 소스 로드
  const { data, isLoading, error } = useQuery({
    queryKey: ['schema-widget', schema.entity, dataSource?.endpoint],
    queryFn: async () => {
      if (!dataSource || dataSource.type !== 'api') {
        return null;
      }

      // ⚠️ 중요: Zero-Trust 원칙 - apiCall prop 또는 @api-sdk/core 사용
      if (apiCall) {
        return await apiCall(dataSource.endpoint, dataSource.method || 'GET');
      }

      // @api-sdk/core를 통한 API 호출
      const { apiClient } = await import('@api-sdk/core');
      const res = await apiClient.get(dataSource.endpoint);
      return (res as any).data ?? res;
    },
    enabled: !!dataSource?.endpoint,
    refetchInterval: refreshInterval || undefined,
  });

  // componentType별 위젯 렌더링
  const renderWidget = () => {
    if (isLoading) {
      return (
        <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          로딩 중...
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ padding: 'var(--spacing-md)', color: 'var(--color-error)' }}>
          에러: {error instanceof Error ? error.message : String(error)}
        </div>
      );
    }

    switch (componentType) {
      case 'metric':
        return renderMetricWidget(data, config);
      case 'card':
        return renderCardWidget(data, config);
      case 'chart':
        return renderChartWidget(data, config);
      default:
        // Custom Widget 로드 시도
        return renderCustomWidget();
    }
  };

  // Metric 위젯 렌더링 (지표 카드)
  const renderMetricWidget = (widgetData: any, widgetConfig?: Record<string, any>) => {
    const { label, value, trend, unit, color } = widgetConfig || {};
    const displayValue = widgetData?.value ?? value ?? widgetData ?? '-';
    const displayLabel = widgetData?.label ?? label ?? '';
    const displayTrend = widgetData?.trend ?? trend;
    const displayUnit = widgetData?.unit ?? unit ?? '';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        {displayLabel && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {displayLabel}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--spacing-xs)' }}>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: color || 'var(--color-text)' }}>
            {typeof displayValue === 'number' ? displayValue.toLocaleString() : displayValue}
          </div>
          {displayUnit && (
            <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
              {displayUnit}
            </div>
          )}
        </div>
        {displayTrend && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: displayTrend.startsWith('+') ? 'var(--color-success)' : 'var(--color-error)' }}>
            {displayTrend}
          </div>
        )}
      </div>
    );
  };

  // Card 위젯 렌더링 (카드 형태)
  const renderCardWidget = (widgetData: any, widgetConfig?: Record<string, any>) => {
    const { title, fields } = widgetConfig || {};
    const displayTitle = widgetData?.title ?? title ?? '';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {displayTitle && (
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
            {displayTitle}
          </h3>
        )}
        {fields && Array.isArray(fields) && fields.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {fields.map((field: any, index: number) => {
              const fieldKey = field.key || field.name;
              const fieldLabel = field.label || fieldKey;
              const fieldValue = widgetData?.[fieldKey] ?? '-';
              return (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    {fieldLabel}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>
                    {typeof fieldValue === 'number' ? fieldValue.toLocaleString() : fieldValue}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
            {JSON.stringify(widgetData)}
          </div>
        )}
      </div>
    );
  };

  // Chart 위젯 렌더링 (차트 - 기본 구현)
  const renderChartWidget = (widgetData: any, _widgetConfig?: Record<string, any>) => {
    return (
      <div style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        차트 위젯 (구현 예정)
        <div style={{ marginTop: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)' }}>
          데이터: {JSON.stringify(widgetData)}
        </div>
      </div>
    );
  };

  // Custom Widget 렌더링 (동적 로딩)
  const [customWidgetComponent, setCustomWidgetComponent] = React.useState<React.ComponentType<any> | null>(null);
  const [customWidgetError, setCustomWidgetError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (componentType && !['metric', 'card', 'chart'].includes(componentType)) {
      let mounted = true;

      async function loadCustomWidget() {
        try {
          const { loadWidget } = await import('../widgets/registry');
          const CustomComponent = await loadWidget(componentType);

          if (mounted) {
            if (CustomComponent) {
              setCustomWidgetComponent(() => CustomComponent);
              setCustomWidgetError(null);
            } else {
              setCustomWidgetComponent(null);
              setCustomWidgetError(new Error(`위젯 "${componentType}"을 찾을 수 없습니다.`));
            }
          }
        } catch (err) {
          if (mounted) {
            setCustomWidgetComponent(null);
            setCustomWidgetError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      }

      loadCustomWidget();

      return () => {
        mounted = false;
      };
    }
  }, [componentType]);

  const renderCustomWidget = () => {
    if (customWidgetError) {
      return (
        <div style={{ padding: 'var(--spacing-md)', color: 'var(--color-error)' }}>
          위젯 로드 실패: {customWidgetError.message}
        </div>
      );
    }

    if (!customWidgetComponent) {
      return (
        <div style={{ padding: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>
          위젯 로딩 중...
        </div>
      );
    }

    const CustomComponent = customWidgetComponent;
    return <CustomComponent data={data} config={config} />;
  };

  return (
    <Card padding="lg" variant="default" className={className}>
      {renderWidget()}
    </Card>
  );
};
