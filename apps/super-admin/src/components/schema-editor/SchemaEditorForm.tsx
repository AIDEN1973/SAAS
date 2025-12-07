/**
 * SchemaEditorForm Component
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§?ê¸°ë³¸ ?•ë³´ ?¸ì§‘ (entity, version, industry_type ??
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: ëª¨ë“  ê²€ì¦ì? ?œë²„?ì„œ ì²˜ë¦¬
 * 
 * ê¸°ìˆ ë¬¸ì„œ: docu/?¤í‚¤ë§ˆì—?”í„°.txt 14. Schema Editor ê¸°ëŠ¥
 */

import { useState, useEffect } from 'react';
import { Card, Input, Select, Button, useModal } from '@ui-core/react';
import type { FormSchema, UISchema } from '@schema/engine';
import type { SchemaRegistryEntry, CreateSchemaInput } from '@hooks/use-schema-registry';
import { useCreateSchema, useUpdateSchema } from '@hooks/use-schema-registry';
import { validateSchema } from '@schema/engine/validator';

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

  // currentFormSchema ë³€ê²???formData ?…ë°?´íŠ¸
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

  // handleSchemaJsonChange??onSchemaJsonChange prop???µí•´ ?¸ë??ì„œ ?¸ì¶œ??

  const handleSave = async () => {
    try {
      // currentFormSchemaê°€ ?ˆìœ¼ë©??°ì„  ?¬ìš© (ìµœì‹  ?¸ì§‘ ?´ìš©)
      const schemaJsonToSave = currentFormSchema || formData.schema_json;
      
      // entity, version ??ê¸°ë³¸ ?•ë³´ ?…ë°?´íŠ¸
      const finalSchemaJson: UISchema = {
        ...schemaJsonToSave,
        entity: formData.entity,
        version: formData.version,
        minSupportedClient: formData.minSupportedClient,
      };

      // Client-Side Validation
      const validation = validateSchema(finalSchemaJson);
      if (!validation.valid) {
        showAlert('ê²€ì¦??¤íŒ¨', validation.errors?.message || '?¤í‚¤ë§?ê²€ì¦ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.', 'error');
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
        showAlert('?±ê³µ', '?¤í‚¤ë§ˆê? ?€?¥ë˜?ˆìŠµ?ˆë‹¤.', 'success');
      } else {
        // Create new schema
        const result = await createSchema.mutateAsync({
          ...formData,
          schema_json: finalSchemaJson,
        });
        onSave?.(result);
        showAlert('?±ê³µ', '???¤í‚¤ë§ˆê? ?ì„±?˜ì—ˆ?µë‹ˆ??', 'success');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '?¤í‚¤ë§??€?¥ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.';
      showAlert('?¤ë¥˜', message, 'error');
    }
  };

  return (
    <Card padding="md" variant="default">
      <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
        ê¸°ë³¸ ?•ë³´
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <Input
          label="?”í‹°??(entity)"
          value={formData.entity}
          onChange={(e) => handleFieldChange('entity', e.target.value)}
          placeholder="student, class, teacher ??
          helperText="???¼ì´ ê´€ë¦¬í•  ?°ì´?°ì˜ ì¢…ë¥˜ë¥??˜í??…ë‹ˆ?? ?? ?™ìƒ(student), ë°?class), ê°•ì‚¬(teacher)"
          required
        />

        <div>
          <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>
            ?…ì¢… (industry_type)
          </label>
          <Select
            value={formData.industry_type || ''}
            onChange={(e) => handleFieldChange('industry_type', e.target.value || null)}
          >
            <option value="">ê³µí†µ (null)</option>
            <option value="academy">?™ì› (academy)</option>
            <option value="salon">ë¯¸ìš©??(salon)</option>
            <option value="realestate">ë¶€?™ì‚° (realestate)</option>
            <option value="gym">ì²´ìœ¡ê´€ (gym)</option>
            <option value="ngo">NGO</option>
          </Select>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)', display: 'block' }}>
            ???¼ì„ ?¬ìš©???…ì¢…??? íƒ?˜ì„¸?? "ê³µí†µ"??? íƒ?˜ë©´ ëª¨ë“  ?…ì¢…?ì„œ ?¬ìš©?????ˆìŠµ?ˆë‹¤.
          </span>
        </div>

        <Input
          label="ë²„ì „ (version)"
          value={formData.version}
          onChange={(e) => handleFieldChange('version', e.target.value)}
          placeholder="1.0.0"
          helperText="?¤í‚¤ë§ˆì˜ ë²„ì „ ë²ˆí˜¸?…ë‹ˆ?? ë³€ê²½í•  ?Œë§ˆ??ë²„ì „???¬ë ¤ì£¼ì„¸?? (?? 1.0.0, 1.1.0, 2.0.0)"
          required
        />

        <Input
          label="ìµœì†Œ ì§€???´ë¼?´ì–¸??ë²„ì „"
          value={formData.minSupportedClient}
          onChange={(e) => handleFieldChange('minSupportedClient', e.target.value)}
          placeholder="1.0.0"
          helperText="???¤í‚¤ë§ˆë? ?¬ìš©?˜ë ¤ë©??´ë¼?´ì–¸???±ì´ ??ë²„ì „ ?´ìƒ?´ì–´???©ë‹ˆ?? ë³´í†µ ?¤í‚¤ë§?ë²„ì „ê³??™ì¼?˜ê²Œ ?¤ì •?©ë‹ˆ??"
          required
        />

        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
          <Button
            variant="solid"
            color="primary"
            onClick={handleSave}
            disabled={createSchema.isPending || updateSchema.isPending}
          >
            {schema ? '?€?? : '?ì„±'}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              ì·¨ì†Œ
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

