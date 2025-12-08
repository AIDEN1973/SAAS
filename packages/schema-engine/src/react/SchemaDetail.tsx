/**
 * SchemaDetail Component
 * 
 * SDUI v1.1: Detail Schema ?�더??(?�기 ?�용 ?�보 ?�면)
 * 
 * 기술문서: SDUI 기술문서 v1.1 - 15. Detail Engine
 */

import React from 'react';
import { Grid } from '@ui-core/react';
import type { DetailSchema } from '../types';
// import { SchemaField } from './SchemaField'; // TODO: 향후 사용 예정
// TODO: useForm ?�???�기 ?�용 ?�이???�용

export interface SchemaDetailProps {
  schema: DetailSchema;
  data?: Record<string, any>;
  className?: string;
}

/**
 * SchemaDetail 컴포?�트
 * 
 * DetailSchema�??�기 ?�용?�로 ?�더링합?�다.
 * FormFieldSchema�??�사?�하???�력 불�? ?�태�??�시?�니??
 */
export const SchemaDetail: React.FC<SchemaDetailProps> = ({
  schema,
  data = {},
  className,
}) => {
  const layout = schema.detail.layout;
  
  // TODO: ?�기 ?�용 ?�드 ?�더�?
  // SchemaField�??�사?�하??disabled={true} ?�는 readonly 모드�??�시
  
  return (
    <div className={className}>
      <Grid
        columns={(layout?.columns || 1) as 1 | 2 | 3 | 4}
        gap={layout?.columnGap || 'md'}
      >
        {schema.detail.fields.map((field) => (
          <div key={field.name}>
            <p>{field.ui?.label || field.name}: {data[field.name] ?? '-'}</p>
            {/* 
            <SchemaField
              field={{ ...field, disabled: true }}
              value={data[field.name]}
              readonly
            />
            */}
          </div>
        ))}
      </Grid>
    </div>
  );
};

