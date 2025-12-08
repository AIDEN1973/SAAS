/**
 * Renderer Factory
 * 
 * SDUI v1.1: ?�키�??�?�에 ?�라 ?�절???�더?��? ?�택?�는 ?�토�? * 
 * 기술문서: SDUI 기술문서 v1.1 - 8. Renderer Factory
 */

import React from 'react';
import type { UISchema, FormSchema, TableSchema, DetailSchema, FilterSchema, WidgetSchema } from '../types';
import type { ActionContext } from '../core/actionEngine';
import { SchemaForm } from '../react/SchemaForm';
import { SchemaTable } from '../react/SchemaTable';
import { SchemaDetail } from '../react/SchemaDetail';
import { SchemaFilter } from '../react/SchemaFilter';
import { SchemaWidget } from '../react/SchemaWidget';

export interface SchemaRendererProps {
  schema: UISchema;
  onSubmit?: (data: any) => void | Promise<void>;
  defaultValues?: Record<string, any>;
  className?: string;
  // SDUI v1.1: Action Engine 컨텍?�트 (?�택??
  actionContext?: Partial<ActionContext>;
  // SDUI v1.1: i18n 번역 (?�택??
  translations?: Record<string, string>;
  // SDUI v1.1: API ?�출 ?�수 (Table?? ?�택??
  apiCall?: (endpoint: string, method: string, body?: any) => Promise<any>;
}

/**
 * Renderer Factory
 * 
 * ?�키마의 type???�라 ?�절???�더?��? ?�택?�여 ?�더링합?�다.
 * 
 * @param props - ?�더??props
 * @returns ?�더링된 컴포?�트
 */
export function SchemaRenderer({ schema, ...props }: SchemaRendererProps): React.ReactElement | null {
  switch (schema.type) {
    case 'form':
      return (
        <SchemaForm
          schema={schema as FormSchema}
          onSubmit={props.onSubmit}
          defaultValues={props.defaultValues}
          className={props.className}
          actionContext={props.actionContext}
          translations={props.translations}
        />
      );
    
    case 'table':
      return (
        <SchemaTable
          schema={schema as TableSchema}
          className={props.className}
          actionContext={props.actionContext}
          translations={props.translations}
          apiCall={props.apiCall}
        />
      );
    
    case 'detail':
      return (
        <SchemaDetail
          schema={schema as DetailSchema}
          className={props.className}
        />
      );
    
    case 'filter':
      return (
        <SchemaFilter
          schema={schema as FilterSchema}
          className={props.className}
          defaultValues={props.defaultValues}
        />
      );
    
    case 'widget':
      return (
        <SchemaWidget
          schema={schema as WidgetSchema}
          className={props.className}
        />
      );
    
    default:
      // ?�?�이 ?�거???????�는 경우
      console.error(`Unknown schema type: ${(schema as any).type}`);
      return (
        <div>
          <p>?????�는 ?�키�??�?�입?�다.</p>
        </div>
      );
  }
}

