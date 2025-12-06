/**
 * SDUI Renderer
 * 
 * [불변 규칙] 스키마를 UI 컴포넌트로 렌더링
 * [불변 규칙] Tailwind 클래스는 ui-core에서만 사용
 */

import React from 'react';
import { Button, Input, Card, Grid, Container } from '@ui-core/react';
import { FormSchema, TableSchema, UISchema } from './types';
import { validateSchema } from './validator';

/**
 * Form Renderer
 */
export function renderForm(schema: FormSchema): React.ReactElement {
  const validation = validateSchema(schema);
  
  if (!validation.valid) {
    throw new Error(`Invalid form schema: ${validation.errors?.message}`);
  }

  const { form } = schema;

  return (
    <Card padding={form.layout?.columnGap || 'md'}>
      <form>
        <Grid
          columns={form.layout?.columns || 1}
          gap={form.layout?.columnGap || 'md'}
        >
          {form.fields.map((field) => (
            <Input
              key={field.name}
              type={field.type}
              name={field.name}
              label={field.label}
              placeholder={field.placeholder}
              required={field.required}
              size={field.size}
              fullWidth
            />
          ))}
        </Grid>
        {form.submit && (
          <div style={{ marginTop: 'var(--spacing-md)' }}>
            <Button
              type="submit"
              variant={form.submit.variant}
              color={form.submit.color}
              size={form.submit.size}
            >
              {form.submit.label}
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
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

  // TODO: Table 컴포넌트를 ui-core에 추가하여 Tailwind 직접 사용 제거
  // 현재는 기본 HTML table 사용 (향후 ui-core/Table 컴포넌트로 교체 예정)
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
                  {column.sortable && <span style={{ marginLeft: 'var(--spacing-xs)' }}>⇅</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ backgroundColor: 'var(--color-white)' }}>
            {/* 데이터는 외부에서 주입 */}
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
          Schema 렌더링 오류: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </Card>
    );
  }
};

