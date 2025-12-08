/**
 * SchemaDetail Component
 * 
 * SDUI v1.1: Detail Schema 렌더러(읽기 전용 정보 화면)
 * 
 * 기술문서: SDUI 기술문서 v1.1 - 15. Detail Engine
 */

import React from 'react';
import { Grid } from '@ui-core/react';
import type { DetailSchema } from '../types';
// import { SchemaField } from './SchemaField'; // TODO: 향후 사용 예정
// TODO: useForm 없이 읽기 전용 필드 사용

export interface SchemaDetailProps {
  schema: DetailSchema;
  data?: Record<string, any>;
  className?: string;
}

/**
 * SchemaDetail 컴포넌트
 * 
 * DetailSchema를 읽기 전용으로 렌더링합니다.
 * FormFieldSchema를 사용하되 입력 불가 상태로 표시합니다.
 */
export const SchemaDetail: React.FC<SchemaDetailProps> = ({
  schema,
  data = {},
  className,
}) => {
  const layout = schema.detail.layout;
  
  // TODO: 읽기 전용 필드 렌더링
  // SchemaField를 사용하되 disabled={true} 또는 readonly 모드로 표시
  
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
