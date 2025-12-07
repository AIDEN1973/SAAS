/**
 * SchemaDetail Component
 * 
 * SDUI v1.1: Detail Schema ?Œë”??(?½ê¸° ?„ìš© ?•ë³´ ?”ë©´)
 * 
 * ê¸°ìˆ ë¬¸ì„œ: SDUI ê¸°ìˆ ë¬¸ì„œ v1.1 - 15. Detail Engine
 */

import React from 'react';
import { Grid } from '@ui-core/react';
import type { DetailSchema } from '../types';
import { SchemaField } from './SchemaField';
// TODO: useForm ?€???½ê¸° ?„ìš© ?°ì´???¬ìš©

export interface SchemaDetailProps {
  schema: DetailSchema;
  data?: Record<string, any>;
  className?: string;
}

/**
 * SchemaDetail ì»´í¬?ŒíŠ¸
 * 
 * DetailSchemaë¥??½ê¸° ?„ìš©?¼ë¡œ ?Œë”ë§í•©?ˆë‹¤.
 * FormFieldSchemaë¥??¬ì‚¬?©í•˜???…ë ¥ ë¶ˆê? ?íƒœë¡??œì‹œ?©ë‹ˆ??
 */
export const SchemaDetail: React.FC<SchemaDetailProps> = ({
  schema,
  data = {},
  className,
}) => {
  const layout = schema.detail.layout;
  
  // TODO: ?½ê¸° ?„ìš© ?„ë“œ ?Œë”ë§?
  // SchemaFieldë¥??¬ì‚¬?©í•˜??disabled={true} ?ëŠ” readonly ëª¨ë“œë¡??œì‹œ
  
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

