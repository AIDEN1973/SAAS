/**
 * SchemaPreview Component
 * 
 * [불�? 규칙] ?�시�?미리보기 ?�더�?
 * [불�? 규칙] Mock Data ?�동 ?�성
 * [불�? 규칙] Condition Rule ?�용
 * 
 * 기술문서: docu/?�키마에?�터.txt 11. Preview Renderer
 */

import { useMemo } from 'react';
import { Card } from '@ui-core/react';
import { SchemaForm, validateSchema } from '@schema/engine';
import type { FormSchema } from '@schema/engine';

export interface SchemaPreviewProps {
  schema: FormSchema;
}

/**
 * Mock Data ?�성
 * 
 * 기술문서: docu/?�키마에?�터.txt 11. Preview Renderer
 */
function generateMockData(schema: FormSchema): Record<string, any> {
  const mockData: Record<string, any> = {};

  schema.form.fields.forEach((field) => {
    switch (field.kind) {
      case 'text':
      case 'email':
      case 'phone':
        mockData[field.name] = field.defaultValue || '?�시 ?�스??;
        break;
      case 'number':
        mockData[field.name] = field.defaultValue || 0;
        break;
      case 'date':
        mockData[field.name] = field.defaultValue || new Date().toISOString().split('T')[0];
        break;
      case 'datetime':
        mockData[field.name] = field.defaultValue || new Date().toISOString().slice(0, 16);
        break;
      case 'select':
      case 'radio':
        mockData[field.name] = field.defaultValue || (field.options?.[0]?.value || '');
        break;
      case 'multiselect':
        mockData[field.name] = field.defaultValue || [];
        break;
      case 'checkbox':
        mockData[field.name] = field.defaultValue || false;
        break;
      case 'textarea':
        mockData[field.name] = field.defaultValue || '?�시 ?�스???�역';
        break;
      default:
        mockData[field.name] = field.defaultValue || '';
    }
  });

  return mockData;
}

export function SchemaPreview({ schema }: SchemaPreviewProps) {
  // Client-Side Validation
  const validation = useMemo(() => validateSchema(schema), [schema]);

  // Mock Data ?�성
  const mockData = useMemo(() => generateMockData(schema), [schema]);

  if (!validation.valid) {
    return (
      <Card padding="md" variant="outlined">
        <div style={{ color: 'var(--color-error)' }}>
          <h4 style={{ marginBottom: 'var(--spacing-sm)' }}>미리보기 ?�류</h4>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>{validation.errors?.message}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md" variant="default">
      <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
        미리보기
      </h4>
      <SchemaForm
        schema={schema}
        defaultValues={mockData}
        onSubmit={(data: any) => {
          console.log('Preview Submit:', data);
        }}
      />
    </Card>
  );
}

