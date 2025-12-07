/**
 * ImportExportPanel Component
 * 
 * [불변 규칙] JSON/YAML Import/Export
 * [불변 규칙] Import 시 검증 필수
 * 
 * 기술문서: docu/스키마에디터.txt 14. Schema Editor 기능
 */

import { useState } from 'react';
import { Card, Button, useModal } from '@ui-core/react';
import type { UISchema } from '@schema-engine/types';
import { validateSchema } from '@schema-engine/validator';

export interface ImportExportPanelProps {
  schema: UISchema;
  onImport: (schema: UISchema) => void;
}

export function ImportExportPanel({ schema, onImport }: ImportExportPanelProps) {
  const { showAlert } = useModal();
  const [importText, setImportText] = useState('');

  const handleExport = () => {
    const json = JSON.stringify(schema, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema-${schema.entity}-${schema.version || '1.0.0'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      const imported = JSON.parse(importText) as UISchema;

      // Client-Side Validation
      const validation = validateSchema(imported);
      if (!validation.valid) {
        showAlert('Import 실패', validation.errors?.message || '스키마 검증에 실패했습니다.');
        return;
      }

      onImport(imported);
      setImportText('');
      showAlert('성공', '스키마가 Import되었습니다.');
    } catch (error) {
      showAlert('Import 실패', error instanceof Error ? error.message : 'JSON 파싱에 실패했습니다.');
    }
  };

  return (
    <Card padding="md" variant="default">
      <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
        Import/Export
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <div>
          <Button variant="outline" onClick={handleExport}>
            Export JSON
          </Button>
        </div>

        <div>
          <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>
            Import JSON
          </label>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="JSON 스키마를 붙여넣으세요..."
            style={{
              width: '100%',
              minHeight: '200px',
              padding: 'var(--spacing-sm)',
              border: '1px solid var(--color-gray-200)',
              borderRadius: 'var(--border-radius-md)',
              fontFamily: 'monospace',
              fontSize: 'var(--font-size-sm)',
            }}
          />
          <Button variant="solid" color="primary" onClick={handleImport} style={{ marginTop: 'var(--spacing-sm)' }}>
            Import
          </Button>
        </div>
      </div>
    </Card>
  );
}

