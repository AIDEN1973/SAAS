/**
 * SemanticDiffViewer Component
 *
 * [불변 규칙] 버전 간 차이를 Semantic Diff로 표시
 * [불변 규칙] JSON Diff와 Semantic Diff 모두 제공
 *
 * 기술문서: docu/스키마에디터.txt 15. Diff & History
 */

import { Card } from '@ui-core/react';
import type { SchemaRegistryEntry } from '@hooks/use-schema-registry';
import type { FormSchema, FormFieldSchema } from '@schema-engine/types';

export interface SemanticDiffViewerProps {
  oldSchema: SchemaRegistryEntry;
  newSchema: SchemaRegistryEntry;
}

/**
 * 필드 차이 분석
 */
function analyzeFieldDiff(
  oldFields: FormFieldSchema[],
  newFields: FormFieldSchema[]
): Array<{ type: 'added' | 'removed' | 'modified'; field: string; changes?: string[] }> {
  const diff: Array<{ type: 'added' | 'removed' | 'modified'; field: string; changes?: string[] }> = [];
  const oldFieldMap = new Map(oldFields.map((f) => [f.name, f]));
  const newFieldMap = new Map(newFields.map((f) => [f.name, f]));

  // 추가된 필드
  newFields.forEach((field) => {
    if (!oldFieldMap.has(field.name)) {
      diff.push({ type: 'added', field: field.name });
    }
  });

  // 삭제된 필드
  oldFields.forEach((field) => {
    if (!newFieldMap.has(field.name)) {
      diff.push({ type: 'removed', field: field.name });
    }
  });

  // 수정된 필드
  newFields.forEach((newField) => {
    const oldField = oldFieldMap.get(newField.name);
    if (oldField) {
      const changes: string[] = [];
      if (oldField.kind !== newField.kind) {
        changes.push(`kind: ${oldField.kind} → ${newField.kind}`);
      }
      if (oldField.ui?.label !== newField.ui?.label) {
        changes.push(`label: "${oldField.ui?.label || ''}" → "${newField.ui?.label || ''}"`);
      }
      if (oldField.ui?.colSpan !== newField.ui?.colSpan) {
        changes.push(`colSpan: ${oldField.ui?.colSpan || 1} → ${newField.ui?.colSpan || 1}`);
      }
      if (JSON.stringify(oldField.validation?.required) !== JSON.stringify(newField.validation?.required)) {
        changes.push(`required: ${oldField.validation?.required || false} → ${newField.validation?.required || false}`);
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
        버전 비교: v{oldSchema.version} → v{newSchema.version}
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {/* 기본 정보 차이 */}
        <div>
          <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)' }}>
            기본 정보
          </h5>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {oldSchema.entity !== newSchema.entity && (
              <div>entity: {oldSchema.entity} → {newSchema.entity}</div>
            )}
            {/* NOTE(Super Admin Only):
                This UI compares schema differences across industry_type for administrative inspection.
                It is not used for tenant inference in end-user apps and does not violate Zero-Trust UI rules. */}
            {oldSchema.industry_type !== newSchema.industry_type && (
              <div>industry_type: {oldSchema.industry_type || 'null'} → {newSchema.industry_type || 'null'}</div>
            )}
            {oldSchema.min_client !== newSchema.min_client && (
              <div>minClient: {oldSchema.min_client || 'null'} → {newSchema.min_client || 'null'}</div>
            )}
            {oldSchema.min_supported_client !== newSchema.min_supported_client && (
              <div>minSupportedClient: {oldSchema.min_supported_client} → {newSchema.min_supported_client}</div>
            )}
          </div>
        </div>

        {/* 필드 차이 */}
        <div>
          <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)' }}>
            필드 변경사항
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
                  {item.type === 'added' && '➕ 추가: '}
                  {item.type === 'removed' && '➖ 삭제: '}
                  {item.type === 'modified' && '✏️ 수정: '}
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
              <div style={{ color: 'var(--color-text-secondary)' }}>
                필드 변경사항이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

