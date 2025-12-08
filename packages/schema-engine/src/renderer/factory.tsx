/**
 * Renderer Factory
 *
 * SDUI v1.1: 스키마의 타입에 따라 적절한 렌더러를 선택하는 팩토리
 *
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
  // SDUI v1.1: Action Engine 컨텍스트 (선택적)
  actionContext?: Partial<ActionContext>;
  // SDUI v1.1: i18n 번역 (선택적)
  translations?: Record<string, string>;
  // SDUI v1.1: API 호출 함수 (Table용 선택적)
  apiCall?: (endpoint: string, method: string, body?: any) => Promise<any>;
}

/**
 * Renderer Factory
 *
 * 스키마의 type에 따라 적절한 렌더러를 선택하여 렌더링합니다.
 *
 * @param props - 렌더러 props
 * @returns 렌더링된 컴포넌트
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
      // 알려지지 않은 타입인 경우
      console.error(`Unknown schema type: ${(schema as any).type}`);
      return (
        <div>
          <p>알 수 없는 스키마 타입입니다.</p>
        </div>
      );
  }
}
