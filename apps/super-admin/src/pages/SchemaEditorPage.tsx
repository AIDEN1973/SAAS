/**
 * Schema Editor Page
 * 
 * [ë¶ˆë? ê·œì¹™] Super Admin ?„ìš© No-Code UI Builder
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: ëª¨ë“  ê¶Œí•œ ê²€ì¦ì? RLS?ì„œ ì²˜ë¦¬
 * [ë¶ˆë? ê·œì¹™] Dual Validation: Client-Side + Server-Side
 * 
 * ê¸°ìˆ ë¬¸ì„œ: docu/?¤í‚¤ë§ˆì—?”í„°.txt
 */

import { useState, useMemo, useEffect } from 'react';
import { ErrorBoundary, Container, Card, Button, useModal } from '@ui-core/react';
import { useIsSuperAdmin, useSchemaList, useActivateSchema, useDeleteSchema, type SchemaRegistryEntry } from '@hooks/use-schema-registry';
import type { FormSchema, UISchema } from '@schema/engine';
import { SchemaEditorForm } from '../components/schema-editor/SchemaEditorForm';
import { SchemaFieldEditor } from '../components/schema-editor/SchemaFieldEditor';
import { ValidationEditor } from '../components/schema-editor/ValidationEditor';
import { ConditionEditor } from '../components/schema-editor/ConditionEditor';
import { LayoutEditor } from '../components/schema-editor/LayoutEditor';
import { SchemaPreview } from '../components/schema-editor/SchemaPreview';
import { ImportExportPanel } from '../components/schema-editor/ImportExportPanel';

export function SchemaEditorPage() {
  const { data: isSuperAdmin, isLoading: isCheckingAuth } = useIsSuperAdmin();
  const { data: schemas, isLoading: isLoadingSchemas } = useSchemaList();
  const { showAlert, showConfirm } = useModal();
  const activateSchema = useActivateSchema();
  const deleteSchema = useDeleteSchema();
  
  const [selectedSchema, setSelectedSchema] = useState<SchemaRegistryEntry | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [localFormSchema, setLocalFormSchema] = useState<FormSchema | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'fields' | 'preview' | 'import'>('fields');

  // ?„ì¬ ?¸ì§‘ ì¤‘ì¸ ?¤í‚¤ë§?(FormSchemaë¡?ë³€??
  const editingFormSchema = useMemo<FormSchema | null>(() => {
    if (localFormSchema) return localFormSchema;
    if (selectedSchema && selectedSchema.schema_json.type === 'form') {
      return selectedSchema.schema_json as FormSchema;
    }
    if (isCreating) {
      return {
        version: '1.0.0',
        minSupportedClient: '1.0.0',
        entity: '',
        type: 'form',
        form: {
          layout: { columns: 2, columnGap: 'md', rowGap: 'md' },
          fields: [],
        },
      } as FormSchema;
    }
    return null;
  }, [selectedSchema, isCreating, localFormSchema]);

  // selectedSchema ë³€ê²???localFormSchema ì´ˆê¸°??
  useEffect(() => {
    if (selectedSchema) {
      setLocalFormSchema(null);
    }
  }, [selectedSchema]);

  // ê¶Œí•œ ì²´í¬
  if (isCheckingAuth) {
    return (
      <Container maxWidth="xl" padding="lg">
        <Card padding="md">
          <p>ê¶Œí•œ ?•ì¸ ì¤?..</p>
        </Card>
      </Container>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Container maxWidth="xl" padding="lg">
        <Card padding="md" variant="outlined">
          <h2 style={{ color: 'var(--color-error)', marginBottom: 'var(--spacing-md)' }}>
            ?‘ê·¼ ê¶Œí•œ ?†ìŒ
          </h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            ???˜ì´ì§€??Super Adminë§??‘ê·¼?????ˆìŠµ?ˆë‹¤.
          </p>
        </Card>
      </Container>
    );
  }

  const handleCreateNew = () => {
    setIsCreating(true);
    setSelectedSchema(null);
    setEditingFieldIndex(null);
    setActiveTab('fields');
  };

  const handleSelectSchema = (schema: SchemaRegistryEntry) => {
    if (schema.status !== 'draft') {
      showAlert(
        '?Œë¦¼',
        'draft ?íƒœ???¤í‚¤ë§ˆë§Œ ?¸ì§‘?????ˆìŠµ?ˆë‹¤. ?˜ì •?˜ë ¤ë©???ë²„ì „???ì„±?˜ì„¸??',
        'info'
      );
      return;
    }
    setSelectedSchema(schema);
    setIsCreating(false);
    setEditingFieldIndex(null);
    setActiveTab('fields');
  };

  const handleSaveSchema = (savedSchema: SchemaRegistryEntry) => {
    setSelectedSchema(savedSchema);
    setIsCreating(false);
    setLocalFormSchema(null); // ?€????ë¡œì»¬ ?íƒœ ì´ˆê¸°??
  };

  const handleFieldsChange = (fields: FormSchema['form']['fields']) => {
    if (!editingFormSchema) return;
    
    const updated: FormSchema = {
      ...editingFormSchema,
      form: {
        ...editingFormSchema.form,
        fields,
      },
    };
    
    setLocalFormSchema(updated);
  };

  const handleFieldValidationChange = (index: number, validation: FormSchema['form']['fields'][0]['validation']) => {
    if (!editingFormSchema) return;
    
    const newFields = [...editingFormSchema.form.fields];
    newFields[index] = { ...newFields[index], validation };
    
    handleFieldsChange(newFields);
  };

  const handleFieldConditionChange = (
    index: number,
    condition: FormSchema['form']['fields'][0]['condition'],
    conditions: FormSchema['form']['fields'][0]['conditions']
  ) => {
    if (!editingFormSchema) return;
    
    const newFields = [...editingFormSchema.form.fields];
    newFields[index] = { ...newFields[index], condition, conditions };
    
    handleFieldsChange(newFields);
  };

  const handleLayoutChange = (layout: FormSchema['form']['layout']) => {
    if (!editingFormSchema) return;
    
    const updated: FormSchema = {
      ...editingFormSchema,
      form: {
        ...editingFormSchema.form,
        layout,
      },
    };
    
    setLocalFormSchema(updated);
  };

  const handleImport = (importedSchema: UISchema) => {
    if (importedSchema.type === 'form') {
      setLocalFormSchema(importedSchema as FormSchema);
    }
  };

  const handleActivate = async () => {
    if (!selectedSchema) return;
    
    const confirmed = await showConfirm(
      '?¤í‚¤ë§??œì„±??,
      `???¤í‚¤ë§ˆë? ?œì„±?”í•˜ë©?ê¸°ì¡´ active ?¤í‚¤ë§ˆëŠ” deprecatedë¡?ë³€ê²½ë©?ˆë‹¤. ê³„ì†?˜ì‹œê² ìŠµ?ˆê¹Œ?`
    );
    
    if (!confirmed) return;
    
    try {
      await activateSchema.mutateAsync(selectedSchema.id);
      showAlert('?±ê³µ', '?¤í‚¤ë§ˆê? ?œì„±?”ë˜?ˆìŠµ?ˆë‹¤.');
      // ëª©ë¡ ?ˆë¡œê³ ì¹¨
      window.location.reload();
    } catch (error) {
      showAlert('?¤ë¥˜', error instanceof Error ? error.message : '?¤í‚¤ë§??œì„±?”ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.');
    }
  };

  const handleDelete = async () => {
    if (!selectedSchema) return;
    
    const confirmed = await showConfirm(
      '?¤í‚¤ë§??? œ',
      '???¤í‚¤ë§ˆë? ?? œ?˜ì‹œê² ìŠµ?ˆê¹Œ? (draftë§??? œ ê°€??'
    );
    
    if (!confirmed) return;
    
    try {
      await deleteSchema.mutateAsync(selectedSchema.id);
      showAlert('?±ê³µ', '?¤í‚¤ë§ˆê? ?? œ?˜ì—ˆ?µë‹ˆ??');
      setSelectedSchema(null);
      // ëª©ë¡ ?ˆë¡œê³ ì¹¨
      window.location.reload();
    } catch (error) {
      showAlert('?¤ë¥˜', error instanceof Error ? error.message : '?¤í‚¤ë§??? œ???¤íŒ¨?ˆìŠµ?ˆë‹¤.');
    }
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="full" padding="lg">
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', height: 'calc(100vh - 120px)' }}>
          {/* ì¢Œì¸¡: ?¤í‚¤ë§?ëª©ë¡ */}
          <div style={{ width: '300px', flexShrink: 0 }}>
            <Card padding="md" variant="default">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                  ?¤í‚¤ë§?ëª©ë¡
                </h2>
                <Button
                  variant="solid"
                  color="primary"
                  size="sm"
                  onClick={handleCreateNew}
                >
                  ?ˆë¡œ ë§Œë“¤ê¸?
                </Button>
              </div>

              {isLoadingSchemas ? (
                <p style={{ color: 'var(--color-text-secondary)' }}>ë¡œë”© ì¤?..</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                  {schemas?.map((schema) => (
                    <Card
                      key={schema.id}
                      padding="sm"
                      variant={selectedSchema?.id === schema.id ? 'elevated' : 'outlined'}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: selectedSchema?.id === schema.id ? 'var(--color-primary-50)' : undefined,
                      }}
                      onClick={() => handleSelectSchema(schema)}
                    >
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                        {schema.entity}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {schema.industry_type || 'ê³µí†µ'} Â· v{schema.version} Â· {schema.status}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* ?°ì¸¡: ?¤í‚¤ë§??¸ì§‘ ?ì—­ */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {isCreating || selectedSchema ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {/* ê¸°ë³¸ ?•ë³´ */}
                <SchemaEditorForm
                  schema={selectedSchema || null}
                  currentFormSchema={editingFormSchema}
                  onSave={handleSaveSchema}
                  onSchemaJsonChange={(schemaJson) => {
                    if (schemaJson.type === 'form') {
                      setLocalFormSchema(schemaJson as FormSchema);
                    }
                  }}
                  onCancel={() => {
                    setIsCreating(false);
                    setSelectedSchema(null);
                    setLocalFormSchema(null);
                  }}
                />

                {/* ?¡ì…˜ ë²„íŠ¼ */}
                {selectedSchema && (
                  <Card padding="md" variant="default">
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                      <Button
                        variant="solid"
                        color="success"
                        onClick={handleActivate}
                        disabled={activateSchema.isPending || selectedSchema.status !== 'draft'}
                      >
                        ?œì„±??
                      </Button>
                      <Button
                        variant="outline"
                        color="error"
                        onClick={handleDelete}
                        disabled={deleteSchema.isPending || selectedSchema.status !== 'draft'}
                      >
                        ?? œ
                      </Button>
                    </div>
                  </Card>
                )}

                {/* ?? ?„ë“œ ?¸ì§‘ / ë¯¸ë¦¬ë³´ê¸° / Import */}
                {editingFormSchema && (
                  <Card padding="md" variant="default">
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                      <Button
                        variant={activeTab === 'fields' ? 'solid' : 'outline'}
                        size="sm"
                        onClick={() => setActiveTab('fields')}
                      >
                        ?„ë“œ ?¸ì§‘
                      </Button>
                      <Button
                        variant={activeTab === 'preview' ? 'solid' : 'outline'}
                        size="sm"
                        onClick={() => setActiveTab('preview')}
                      >
                        ë¯¸ë¦¬ë³´ê¸°
                      </Button>
                      <Button
                        variant={activeTab === 'import' ? 'solid' : 'outline'}
                        size="sm"
                        onClick={() => setActiveTab('import')}
                      >
                        Import/Export
                      </Button>
                    </div>

                    {activeTab === 'fields' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <LayoutEditor
                          layout={editingFormSchema.form.layout}
                          onChange={handleLayoutChange}
                        />
                        <SchemaFieldEditor
                          fields={editingFormSchema.form.fields}
                          onChange={handleFieldsChange}
                          onFieldSelect={setEditingFieldIndex}
                        />
                        {editingFieldIndex !== null && editingFormSchema.form.fields[editingFieldIndex] && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <ValidationEditor
                              field={editingFormSchema.form.fields[editingFieldIndex]}
                              onChange={(validation) => handleFieldValidationChange(editingFieldIndex, validation)}
                            />
                            <ConditionEditor
                              field={editingFormSchema.form.fields[editingFieldIndex]}
                              allFields={editingFormSchema.form.fields}
                              onChange={(condition, conditions) => {
                                // condition??MultiConditionRule??ê²½ìš°??ë¬´ì‹œ (conditionsë¡?ì²˜ë¦¬)
                                const singleCondition = condition && 'field' in condition ? condition : undefined;
                                handleFieldConditionChange(editingFieldIndex, singleCondition, conditions);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'preview' && editingFormSchema && (
                      <SchemaPreview schema={editingFormSchema} />
                    )}

                    {activeTab === 'import' && editingFormSchema && (
                      <ImportExportPanel
                        schema={editingFormSchema}
                        onImport={handleImport}
                      />
                    )}
                  </Card>
                )}
              </div>
            ) : (
              <Card padding="md" variant="outlined">
                <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                  ?¤í‚¤ë§ˆë? ? íƒ?˜ê±°???ˆë¡œ ë§Œë“œ?¸ìš”.
                </p>
              </Card>
            )}
          </div>
        </div>
      </Container>
    </ErrorBoundary>
  );
}
