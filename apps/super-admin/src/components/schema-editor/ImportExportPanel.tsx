/**
 * ImportExportPanel Component
 * 
 * [ë¶ˆë? ê·œì¹™] JSON/YAML Import/Export
 * [ë¶ˆë? ê·œì¹™] Import ??ê²€ì¦??„ìˆ˜
 * 
 * ê¸°ìˆ ë¬¸ì„œ: docu/?¤í‚¤ë§ˆì—?”í„°.txt 14. Schema Editor ê¸°ëŠ¥
 */

import { useState } from 'react';
import { Card, Button, useModal } from '@ui-core/react';
import type { UISchema } from '@schema/engine';
import { validateSchema } from '@schema/engine/validator';

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
        showAlert('Import ?¤íŒ¨', validation.errors?.message || '?¤í‚¤ë§?ê²€ì¦ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.');
        return;
      }

      onImport(imported);
      setImportText('');
      showAlert('?±ê³µ', '?¤í‚¤ë§ˆê? Import?˜ì—ˆ?µë‹ˆ??');
    } catch (error) {
      showAlert('Import ?¤íŒ¨', error instanceof Error ? error.message : 'JSON ?Œì‹±???¤íŒ¨?ˆìŠµ?ˆë‹¤.');
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
            placeholder="JSON ?¤í‚¤ë§ˆë? ë¶™ì—¬?£ìœ¼?¸ìš”..."
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

