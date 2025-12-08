/**
 * SchemaFilter Component
 * 
 * SDUI v1.1: Filter Schema 렌더러(Table 상단 검색 조건)
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
 * FormFieldSchema를 사용하되 submit이 아닌 "필터 변경 이벤트"를 발생시킵니다.
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
  
  // 이전 값과 비교하여 실제 변경이 있을 때만 호출
  const prevValuesRef = React.useRef<Record<string, any>>({});
  
  React.useEffect(() => {
    // 초기 마운트 시에는 호출하지 않음
    if (Object.keys(prevValuesRef.current).length === 0) {
      prevValuesRef.current = watchedValues;
      return;
    }
    
    // 값이 실제로 변경되었는지 확인
    const hasChanged = Object.keys(watchedValues).some(
      key => watchedValues[key] !== prevValuesRef.current[key]
    ) || Object.keys(prevValuesRef.current).some(
      key => !(key in watchedValues) || watchedValues[key] !== prevValuesRef.current[key]
    );
    
    if (hasChanged && onFilterChange) {
      prevValuesRef.current = watchedValues;
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
