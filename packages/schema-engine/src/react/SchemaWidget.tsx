/**
 * SchemaWidget Component
 * 
 * SDUI v1.1: Widget Schema ?�더??(?�?�보?�용 카드/차트/지??
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
 * SchemaWidget 컴포?�트
 * 
 * WidgetSchema�??�더링합?�다.
 * ?�?�보?�용 카드, 차트, 지???�을 ?�시?�니??
 */
export const SchemaWidget: React.FC<SchemaWidgetProps> = ({
  schema,
  className,
}) => {
  // TODO: componentType???�라 ?�절???�젯 ?�더�?
  // ?? 'chart', 'metric', 'card' ??
  // TODO: API ?�이???�스 로드
  
  const { componentType } = schema.widget;
  
  return (
    <div className={className}>
      <p>Widget Schema ?�더�? {schema.entity}</p>
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

