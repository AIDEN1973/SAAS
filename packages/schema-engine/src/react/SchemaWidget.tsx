/**
 * SchemaWidget Component
 * 
 * SDUI v1.1: Widget Schema ?Œë”??(?€?œë³´?œìš© ì¹´ë“œ/ì°¨íŠ¸/ì§€??
 * 
 * ê¸°ìˆ ë¬¸ì„œ: SDUI ê¸°ìˆ ë¬¸ì„œ v1.1 - 15. Widget Engine
 */

import React from 'react';
import type { WidgetSchema } from '../types';

export interface SchemaWidgetProps {
  schema: WidgetSchema;
  className?: string;
}

/**
 * SchemaWidget ì»´í¬?ŒíŠ¸
 * 
 * WidgetSchemaë¥??Œë”ë§í•©?ˆë‹¤.
 * ?€?œë³´?œìš© ì¹´ë“œ, ì°¨íŠ¸, ì§€???±ì„ ?œì‹œ?©ë‹ˆ??
 */
export const SchemaWidget: React.FC<SchemaWidgetProps> = ({
  schema,
  className,
}) => {
  // TODO: componentType???°ë¼ ?ì ˆ???„ì ¯ ?Œë”ë§?
  // ?? 'chart', 'metric', 'card' ??
  // TODO: API ?°ì´???ŒìŠ¤ ë¡œë“œ
  
  const { componentType, dataSource, config } = schema.widget;
  
  return (
    <div className={className}>
      <p>Widget Schema ?Œë”ë§? {schema.entity}</p>
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

