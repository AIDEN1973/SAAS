/**
 * SDUI Renderer
 * 
 * [불변 규칙] 스키마를 UI 컴포넌트로 렌더링
 * [불변 규칙] Tailwind 클래스는 ui-core에서만 사용
 */

import React from 'react';
import { Button, Input, Card, Grid } from '@ui-core/react';
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
          <div className="mt-4">
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

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {table.columns.map((column) => (
              <th
                key={column.key}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                style={{ width: column.width }}
              >
                {column.label}
                {column.sortable && <span className="ml-1">⇅</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {/* 데이터는 외부에서 주입 */}
        </tbody>
      </table>
    </div>
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
  data?: any;
}

export const SchemaRenderer: React.FC<SchemaRendererProps> = ({ schema, data }) => {
  try {
    return renderSchema(schema);
  } catch (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">Schema 렌더링 오류: {error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }
};

