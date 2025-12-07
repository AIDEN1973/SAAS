/**
 * SchemaFilter Component
 * 
 * SDUI v1.1: Filter Schema 렌더러 (Table 상단 검색 조건)
 * 
 * 기술문서: SDUI 기술문서 v1.1 - 15. Filter Engine
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { Grid } from '@ui-core/react';
import type { FilterSchema } from '../types';
import { SchemaField } from './SchemaField';

export interface SchemaFilterProps {
  schema: FilterSchema;
  onFilterChange?: (filters: Record<string, any>) => void;
  defaultValues?: Record<string, any>;
  className?: string;
}

/**
 * SchemaFilter 컴포넌트
 * 
 * FilterSchema를 렌더링합니다.
 * FormFieldSchema를 재사용하되, submit이 아닌 "필터 변경 이벤트"를 발생시킵니다.
 */
export const SchemaFilter: React.FC<SchemaFilterProps> = ({
  schema,
  onFilterChange,
  defaultValues,
  className,
}) => {
  const form = useForm({
    defaultValues,
  });

  const { register, control, watch, formState: { errors } } = form;
  
  // 필터 값 변경 감시
  const watchedValues = watch();
  
  React.useEffect(() => {
    if (onFilterChange) {
      onFilterChange(watchedValues);
    }
  }, [watchedValues, onFilterChange]);

  const layout = schema.filter.layout;

  return (
    <div className={className}>
      <Grid
        columns={(layout?.columns || 1) as 1 | 2 | 3 | 4}
        gap={layout?.columnGap || 'md'}
      >
        {schema.filter.fields.map((field) => (
          <SchemaField
            key={field.name}
            field={field}
            register={register}
            errors={errors}
            control={control}
          />
        ))}
      </Grid>
    </div>
  );
};

