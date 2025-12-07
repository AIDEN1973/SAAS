/**
 * Renderer Factory
 * 
 * SDUI v1.1: ?¤í‚¤ë§??€?…ì— ?°ë¼ ?ì ˆ???Œë”?¬ë? ? íƒ?˜ëŠ” ?©í† ë¦? * 
 * ê¸°ìˆ ë¬¸ì„œ: SDUI ê¸°ìˆ ë¬¸ì„œ v1.1 - 8. Renderer Factory
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
  // SDUI v1.1: Action Engine ì»¨í…?¤íŠ¸ (? íƒ??
  actionContext?: Partial<ActionContext>;
  // SDUI v1.1: i18n ë²ˆì—­ (? íƒ??
  translations?: Record<string, string>;
  // SDUI v1.1: API ?¸ì¶œ ?¨ìˆ˜ (Table?? ? íƒ??
  apiCall?: (endpoint: string, method: string, body?: any) => Promise<any>;
}

/**
 * Renderer Factory
 * 
 * ?¤í‚¤ë§ˆì˜ type???°ë¼ ?ì ˆ???Œë”?¬ë? ? íƒ?˜ì—¬ ?Œë”ë§í•©?ˆë‹¤.
 * 
 * @param props - ?Œë”??props
 * @returns ?Œë”ë§ëœ ì»´í¬?ŒíŠ¸
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
      // ?€?…ì´ ?†ê±°???????†ëŠ” ê²½ìš°
      console.error(`Unknown schema type: ${(schema as any).type}`);
      return (
        <div>
          <p>?????†ëŠ” ?¤í‚¤ë§??€?…ì…?ˆë‹¤.</p>
        </div>
      );
  }
}

