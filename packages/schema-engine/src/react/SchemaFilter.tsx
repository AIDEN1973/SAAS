/**
 * SchemaFilter Component
 * 
 * SDUI v1.1: Filter Schema ?Œë”??(Table ?ë‹¨ ê²€??ì¡°ê±´)
 * 
 * ê¸°ìˆ ë¬¸ì„œ: SDUI ê¸°ìˆ ë¬¸ì„œ v1.1 - 15. Filter Engine
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
 * SchemaFilter ì»´í¬?ŒíŠ¸
 * 
 * FilterSchemaë¥??Œë”ë§í•©?ˆë‹¤.
 * FormFieldSchemaë¥??¬ì‚¬?©í•˜?? submit???„ë‹Œ "?„í„° ë³€ê²??´ë²¤??ë¥?ë°œìƒ?œí‚µ?ˆë‹¤.
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
  
  // ?„í„° ê°?ë³€ê²?ê°ì‹œ
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

