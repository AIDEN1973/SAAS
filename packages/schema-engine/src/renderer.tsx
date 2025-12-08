/**
 * SDUI Renderer
 * 
 * [불�? 규칙] ?�키마�? UI 컴포?�트�??�더�? * [불�? 규칙] Tailwind ?�래?�는 ui-core?�서�??�용
 */

import React from 'react';
import { Button, Input, Card, Grid, Container } from '@ui-core/react';
import { FormSchema, TableSchema, UISchema } from './types';
import { validateSchema } from './validator';
import { SchemaForm } from './react/SchemaForm';

/**
 * Form Renderer (Deprecated)
 * 
 * ?�️ ???�수???�거?�입?�다. SchemaForm 컴포?�트�??�용?�세??
 * 
 * @deprecated Use SchemaForm component instead
 */

export function renderForm(schema: FormSchema): React.ReactElement {
  const validation = validateSchema(schema);
  
  if (!validation.valid) {
    throw new Error(`Invalid form schema: ${validation.errors?.message}`);
  }

  // SchemaForm 컴포?�트�??�용?�도�?변�?  // ???�수???�위 ?�환?�을 ?�해 ?��??��?�? ?��??�으�?SchemaForm???�용?�니??
  return React.createElement(SchemaForm, { schema });
}

/**
 * Table Renderer (기본 구조)
 */
export function renderTable(schema: TableSchema): React.ReactElement {
  const validation = validateSchema(schema);
  
  if (!validation.valid) {
    throw new Error(`Invalid table schema: ${validation.errors?.message}`);
  }

  const { table } = schema;

  // TODO: Table 컴포?�트�?ui-core??추�??�여 Tailwind 직접 ?�용 ?�거
  // ?�재??기본 HTML table ?�용 (?�후 ui-core/Table 컴포?�트�?교체 ?�정)
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
                  {column.sortable && <span style={{ marginLeft: 'var(--spacing-xs)' }}>↕</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ backgroundColor: 'var(--color-white)' }}>
            {/* ?�이?�는 ?��??�서 주입 */}
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
          Schema ?�더�??�류: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </Card>
    );
  }
};

