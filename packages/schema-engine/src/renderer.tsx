/**
 * SDUI Renderer
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§ˆë? UI ì»´í¬?ŒíŠ¸ë¡??Œë”ë§? * [ë¶ˆë? ê·œì¹™] Tailwind ?´ë˜?¤ëŠ” ui-core?ì„œë§??¬ìš©
 */

import React from 'react';
import { Button, Input, Card, Grid, Container } from '@ui-core/react';
import { FormSchema, TableSchema, UISchema } from './types';
import { validateSchema } from './validator';
import { SchemaForm } from './react/SchemaForm';

/**
 * Form Renderer (Deprecated)
 * 
 * ? ï¸ ???¨ìˆ˜???ˆê±°?œì…?ˆë‹¤. SchemaForm ì»´í¬?ŒíŠ¸ë¥??¬ìš©?˜ì„¸??
 * 
 * @deprecated Use SchemaForm component instead
 */

export function renderForm(schema: FormSchema): React.ReactElement {
  const validation = validateSchema(schema);
  
  if (!validation.valid) {
    throw new Error(`Invalid form schema: ${validation.errors?.message}`);
  }

  // SchemaForm ì»´í¬?ŒíŠ¸ë¥??¬ìš©?˜ë„ë¡?ë³€ê²?  // ???¨ìˆ˜???˜ìœ„ ?¸í™˜?±ì„ ?„í•´ ? ì??˜ì?ë§? ?´ë??ìœ¼ë¡?SchemaForm???¬ìš©?©ë‹ˆ??
  return React.createElement(SchemaForm, { schema });
}

/**
 * Table Renderer (ê¸°ë³¸ êµ¬ì¡°)
 */
export function renderTable(schema: TableSchema): React.ReactElement {
  const validation = validateSchema(schema);
  
  if (!validation.valid) {
    throw new Error(`Invalid table schema: ${validation.errors?.message}`);
  }

  const { table } = schema;

  // TODO: Table ì»´í¬?ŒíŠ¸ë¥?ui-core??ì¶”ê??˜ì—¬ Tailwind ì§ì ‘ ?¬ìš© ?œê±°
  // ?„ì¬??ê¸°ë³¸ HTML table ?¬ìš© (?¥í›„ ui-core/Table ì»´í¬?ŒíŠ¸ë¡?êµì²´ ?ˆì •)
  return (
    <Container maxWidth="full" padding="xs">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          minWidth: '100%',
          borderCollapse: 'collapse',
        }}>
          <thead style={{ backgroundColor: 'var(--color-gray-50)' }}>
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    textAlign: 'left',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    width: column.width,
                  }}
                >
                  {column.label}
                  {column.sortable && <span style={{ marginLeft: 'var(--spacing-xs)' }}>??/span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ backgroundColor: 'var(--color-white)' }}>
            {/* ?°ì´?°ëŠ” ?¸ë??ì„œ ì£¼ì… */}
          </tbody>
        </table>
      </div>
    </Container>
  );
}

/**
 * Universal Schema Renderer
 */
export function renderSchema(schema: UISchema): React.ReactElement {
  if ('form' in schema) {
    return renderForm(schema);
  } else if ('table' in schema) {
    return renderTable(schema);
  }
  
  throw new Error('Unknown schema type');
}

/**
 * Schema Renderer Component
 */
export interface SchemaRendererProps {
  schema: UISchema;
  data?: unknown;
}

export const SchemaRenderer: React.FC<SchemaRendererProps> = ({ schema, data }) => {
  try {
    return renderSchema(schema);
  } catch (error) {
    return (
      <Card 
        padding="md" 
        variant="outlined"
        style={{
          backgroundColor: 'var(--color-red-50)',
          borderColor: 'var(--color-red-200)',
        }}
      >
        <p style={{ color: 'var(--color-red-800)' }}>
          Schema ?Œë”ë§??¤ë¥˜: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </Card>
    );
  }
};

