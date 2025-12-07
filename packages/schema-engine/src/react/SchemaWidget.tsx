/**
 * SchemaWidget Component
 * 
 * SDUI v1.1: Widget Schema 렌더러 (대시보드용 카드/차트/지표)
 * 
 * 기술문서: SDUI 기술문서 v1.1 - 15. Widget Engine
 */

import React from 'react';
import type { WidgetSchema } from '../types';

export interface SchemaWidgetProps {
  schema: WidgetSchema;
  className?: string;
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
}) => {
  // TODO: componentType에 따라 적절한 위젯 렌더링
  // 예: 'chart', 'metric', 'card' 등
  // TODO: API 데이터 소스 로드
  
  const { componentType, dataSource, config } = schema.widget;
  
  return (
    <div className={className}>
      <p>Widget Schema 렌더링: {schema.entity}</p>
      <p>Component Type: {componentType}</p>
      {/* 
      switch (componentType) {
        case 'chart':
          return <ChartWidget dataSource={dataSource} config={config} />;
        case 'metric':
          return <MetricWidget dataSource={dataSource} config={config} />;
        case 'card':
          return <CardWidget dataSource={dataSource} config={config} />;
        default:
          return <div>Unknown widget type: {componentType}</div>;
      }
      */}
    </div>
  );
};

