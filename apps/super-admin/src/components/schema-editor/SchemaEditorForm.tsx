/**
 * SchemaEditorForm Component
 * 
 * [불변 규칙] 스키마 기본 정보 편집 (entity, version, industry_type 등)
 * [불변 규칙] Zero-Trust: 모든 검증은 서버에서 처리
 * 
 * 기술문서: docu/스키마에디터.txt 14. Schema Editor 기능
 */

import { useState, useEffect } from 'react';
import { Card, Input, Select, Button, useModal } from '@ui-core/react';
import type { FormSchema, UISchema } from '@schema-engine/types';
import type { SchemaRegistryEntry, CreateSchemaInput } from '@hooks/use-schema-registry';
import { useCreateSchema, useUpdateSchema } from '@hooks/use-schema-registry';
import { validateSchema } from '@schema-engine/validator';

export interface SchemaEditorFormProps {
  schema?: SchemaRegistryEntry | null;
  currentFormSchema?: FormSchema | null;
  onSave?: (schema: SchemaRegistryEntry) => void;
  onSchemaJsonChange?: (schemaJson: UISchema) => void;
  onCancel?: () => void;
}

export function SchemaEditorForm({ schema, currentFormSchema, onSave, onSchemaJsonChange, onCancel }: SchemaEditorFormProps) {
  const { showAlert } = useModal();
  const createSchema = useCreateSchema();
  const updateSchema = useUpdateSchema();

  const [formData, setFormData] = useState<CreateSchemaInput>(() => {
    const baseSchemaJson = currentFormSchema || schema?.schema_json || {
      version: '1.0.0',
      minSupportedClient: '1.0.0',
      entity: '',
      type: 'form',
      form: {
        layout: {
          columns: 2,
          columnGap: 'md',
          rowGap: 'md',
        },
        fields: [],
      },
    } as FormSchema;

    return {
      entity: schema?.entity || '',
      industry_type: schema?.industry_type || null,
      version: schema?.version || '1.0.0',
      minSupportedClient: schema?.min_supported_client || '1.0.0',
      schema_json: baseSchemaJson,
      migration_script: schema?.migration_script || null,
      status: 'draft',
    };
  });

  // currentFormSchema 변경 시 formData 업데이트
  useEffect(() => {
    if (currentFormSchema && currentFormSchema.type === 'form') {
      setFormData((prev) => ({
        ...prev,
        schema_json: currentFormSchema,
      }));
    }
  }, [currentFormSchema]);

  const handleFieldChange = (field: keyof CreateSchemaInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // handleSchemaJsonChange는 onSchemaJsonChange prop을 통해 외부에서 호출됨

  const handleSave = async () => {
    try {
      // currentFormSchema가 있으면 우선 사용 (최신 편집 내용)
      const schemaJsonToSave = currentFormSchema || formData.schema_json;
      
      // entity, version 등 기본 정보 업데이트
      const finalSchemaJson: UISchema = {
        ...schemaJsonToSave,
        entity: formData.entity,
        version: formData.version,
        minSupportedClient: formData.minSupportedClient,
      };

      // Client-Side Validation
      const validation = validateSchema(finalSchemaJson);
      if (!validation.valid) {
        showAlert('검증 실패', validation.errors?.message || '스키마 검증에 실패했습니다.', 'error');
        return;
      }

      if (schema) {
        // Update existing schema
        const result = await updateSchema.mutateAsync({
          id: schema.id,
          input: {
            schema_json: finalSchemaJson,
            migration_script: formData.migration_script,
            minSupportedClient: formData.minSupportedClient,
          },
          expectedUpdatedAt: schema.updated_at, // Optimistic Locking
        });
        onSave?.(result);
        showAlert('성공', '스키마가 저장되었습니다.', 'success');
      } else {
        // Create new schema
        const result = await createSchema.mutateAsync({
          ...formData,
          schema_json: finalSchemaJson,
        });
        onSave?.(result);
        showAlert('성공', '새 스키마가 생성되었습니다.', 'success');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '스키마 저장에 실패했습니다.';
      showAlert('오류', message, 'error');
    }
  };

  return (
    <Card padding="md" variant="default">
      <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
        기본 정보
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <Input
          label="엔티티 (entity)"
          value={formData.entity}
          onChange={(e) => handleFieldChange('entity', e.target.value)}
          placeholder="student, class, teacher 등"
          helperText="이 폼이 관리할 데이터의 종류를 나타냅니다. 예: 학생(student), 반(class), 강사(teacher)"
          required
        />

        <div>
          <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>
            업종 (industry_type)
          </label>
          <Select
            value={formData.industry_type || ''}
            onChange={(e) => handleFieldChange('industry_type', e.target.value || null)}
          >
            <option value="">공통 (null)</option>
            <option value="academy">학원 (academy)</option>
            <option value="salon">미용실 (salon)</option>
            <option value="realestate">부동산 (realestate)</option>
            <option value="gym">체육관 (gym)</option>
            <option value="ngo">NGO</option>
          </Select>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)', display: 'block' }}>
            이 폼을 사용할 업종을 선택하세요. "공통"을 선택하면 모든 업종에서 사용할 수 있습니다.
          </span>
        </div>

        <Input
          label="버전 (version)"
          value={formData.version}
          onChange={(e) => handleFieldChange('version', e.target.value)}
          placeholder="1.0.0"
          helperText="스키마의 버전 번호입니다. 변경할 때마다 버전을 올려주세요. (예: 1.0.0, 1.1.0, 2.0.0)"
          required
        />

        <Input
          label="최소 지원 클라이언트 버전"
          value={formData.minSupportedClient}
          onChange={(e) => handleFieldChange('minSupportedClient', e.target.value)}
          placeholder="1.0.0"
          helperText="이 스키마를 사용하려면 클라이언트 앱이 이 버전 이상이어야 합니다. 보통 스키마 버전과 동일하게 설정합니다."
          required
        />

        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
          <Button
            variant="solid"
            color="primary"
            onClick={handleSave}
            disabled={createSchema.isPending || updateSchema.isPending}
          >
            {schema ? '저장' : '생성'}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              취소
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

