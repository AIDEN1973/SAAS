/**
 * SemanticDiffViewer Component
 * 
 * [Î∂àÎ? Í∑úÏπô] Î≤ÑÏ†Ñ Í∞?Ï∞®Ïù¥Î•?Semantic DiffÎ°??úÏãú
 * [Î∂àÎ? Í∑úÏπô] JSON Diff?Ä Semantic Diff Î™®Îëê ?úÍ≥µ
 * 
 * Í∏∞Ïà†Î¨∏ÏÑú: docu/?§ÌÇ§ÎßàÏóê?îÌÑ∞.txt 15. Diff & History
 */

import { Card } from '@ui-core/react';
import type { SchemaRegistryEntry } from '@hooks/use-schema-registry';
import type { FormSchema, FormFieldSchema } from '@schema/engine';

export interface SemanticDiffViewerProps {
  oldSchema: SchemaRegistryEntry;
  newSchema: SchemaRegistryEntry;
}

/**
 * ?ÑÎìú Ï∞®Ïù¥ Î∂ÑÏÑù
 */
function analyzeFieldDiff(
  oldFields: FormFieldSchema[],
  newFields: FormFieldSchema[]
): Array<{ type: 'added' | 'removed' | 'modified'; field: string; changes?: string[] }> {
  const diff: Array<{ type: 'added' | 'removed' | 'modified'; field: string; changes?: string[] }> = [];
  const oldFieldMap = new Map(oldFields.map((f) => [f.name, f]));
  const newFieldMap = new Map(newFields.map((f) => [f.name, f]));

  // Ï∂îÍ????ÑÎìú
  newFields.forEach((field) => {
    if (!oldFieldMap.has(field.name)) {
      diff.push({ type: 'added', field: field.name });
    }
  });

  // ??†ú???ÑÎìú
  oldFields.forEach((field) => {
    if (!newFieldMap.has(field.name)) {
      diff.push({ type: 'removed', field: field.name });
    }
  });

  // ?òÏ†ï???ÑÎìú
  newFields.forEach((newField) => {
    const oldField = oldFieldMap.get(newField.name);
    if (oldField) {
      const changes: string[] = [];
      if (oldField.kind !== newField.kind) {
        changes.push(`kind: ${oldField.kind} ??${newField.kind}`);
      }
      if (oldField.ui?.label !== newField.ui?.label) {
        changes.push(`label: "${oldField.ui?.label || ''}" ??"${newField.ui?.label || ''}"`);
      }
      if (oldField.ui?.colSpan !== newField.ui?.colSpan) {
        changes.push(`colSpan: ${oldField.ui?.colSpan || 1} ??${newField.ui?.colSpan || 1}`);
      }
      if (JSON.stringify(oldField.validation?.required) !== JSON.stringify(newField.validation?.required)) {
        changes.push(`required: ${oldField.validation?.required || false} ??${newField.validation?.required || false}`);
      }
      if (changes.length > 0) {
        diff.push({ type: 'modified', field: newField.name, changes });
      }
    }
  });

  return diff;
}

export function SemanticDiffViewer({ oldSchema, newSchema }: SemanticDiffViewerProps) {
  const oldFormSchema = oldSchema.schema_json as FormSchema;
  const newFormSchema = newSchema.schema_json as FormSchema;

  const fieldDiff = analyzeFieldDiff(
    oldFormSchema.form?.fields || [],
    newFormSchema.form?.fields || []
  );

  return (
    <Card padding="md" variant="default">
      <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
        Î≤ÑÏ†Ñ ÎπÑÍµê: v{oldSchema.version} ??v{newSchema.version}
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {/* Í∏∞Î≥∏ ?ïÎ≥¥ Ï∞®Ïù¥ */}
        <div>
          <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)' }}>
            Í∏∞Î≥∏ ?ïÎ≥¥
          </h5>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {oldSchema.entity !== newSchema.entity && (
              <div>entity: {oldSchema.entity} ??{newSchema.entity}</div>
            )}
            {oldSchema.industry_type !== newSchema.industry_type && (
              <div>industry_type: {oldSchema.industry_type || 'null'} ??{newSchema.industry_type || 'null'}</div>
            )}
            {oldSchema.min_supported_client !== newSchema.min_supported_client && (
              <div>minSupportedClient: {oldSchema.min_supported_client} ??{newSchema.min_supported_client}</div>
            )}
          </div>
        </div>

        {/* ?ÑÎìú Ï∞®Ïù¥ */}
        <div>
          <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)' }}>
            ?ÑÎìú Î≥ÄÍ≤ΩÏÇ¨??
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            {fieldDiff.map((item, index) => (
              <div
                key={index}
                style={{
                  padding: 'var(--spacing-xs)',
                  backgroundColor:
                    item.type === 'added'
                      ? 'var(--color-green-50)'
                      : item.type === 'removed'
                      ? 'var(--color-red-50)'
                      : 'var(--color-yellow-50)',
                  borderRadius: 'var(--border-radius-sm)',
                }}
              >
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                  {item.type === 'added' && '??Ï∂îÍ?: '}
                  {item.type === 'removed' && '????†ú: '}
                  {item.type === 'modified' && '?èÔ∏è ?òÏ†ï: '}
                  {item.field}
                </div>
                {item.changes && (
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)', marginLeft: 'var(--spacing-md)' }}>
                    {item.changes.map((change, idx) => (
                      <div key={idx}>- {change}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {fieldDiff.length === 0 && (
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                ?ÑÎìú Î≥ÄÍ≤ΩÏÇ¨??ù¥ ?ÜÏäµ?àÎã§.
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

