/**
 * Schema Editor Page
 * 
 * [불변 규칙] Super Admin 전용 No-Code UI Builder
 * [불변 규칙] Zero-Trust: 모든 권한 검증은 RLS에서 처리
 * [불변 규칙] Dual Validation: Client-Side + Server-Side
 * 
 * 기술문서: docu/스키마에디터.txt
 */

import { useState, useMemo, useEffect } from 'react';
import { ErrorBoundary, Container, Card, Button, useModal } from '@ui-core/react';
import { useIsSuperAdmin, useSchemaList, useActivateSchema, useDeleteSchema, type SchemaRegistryEntry } from '@hooks/use-schema-registry';
import type { FormSchema, UISchema } from '@schema-engine/types';
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

  // 현재 편집 중인 스키마 (FormSchema로 변환)
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

  // selectedSchema 변경 시 localFormSchema 초기화
  useEffect(() => {
    if (selectedSchema) {
      setLocalFormSchema(null);
    }
  }, [selectedSchema]);

  // 권한 체크
  if (isCheckingAuth) {
    return (
      <Container maxWidth="xl" padding="lg">
        <Card padding="md">
          <p>권한 확인 중...</p>
        </Card>
      </Container>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Container maxWidth="xl" padding="lg">
        <Card padding="md" variant="outlined">
          <h2 style={{ color: 'var(--color-error)', marginBottom: 'var(--spacing-md)' }}>
            접근 권한 없음
          </h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            이 페이지는 Super Admin만 접근할 수 있습니다.
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
        '알림',
        'draft 상태의 스키마만 편집할 수 있습니다. 수정하려면 새 버전을 생성하세요.',
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
    setLocalFormSchema(null); // 저장 후 로컬 상태 초기화
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
      '스키마 활성화',
      `이 스키마를 활성화하면 기존 active 스키마는 deprecated로 변경됩니다. 계속하시겠습니까?`
    );
    
    if (!confirmed) return;
    
    try {
      await activateSchema.mutateAsync(selectedSchema.id);
      showAlert('성공', '스키마가 활성화되었습니다.');
      // 목록 새로고침
      window.location.reload();
    } catch (error) {
      showAlert('오류', error instanceof Error ? error.message : '스키마 활성화에 실패했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!selectedSchema) return;
    
    const confirmed = await showConfirm(
      '스키마 삭제',
      '이 스키마를 삭제하시겠습니까? (draft만 삭제 가능)'
    );
    
    if (!confirmed) return;
    
    try {
      await deleteSchema.mutateAsync(selectedSchema.id);
      showAlert('성공', '스키마가 삭제되었습니다.');
      setSelectedSchema(null);
      // 목록 새로고침
      window.location.reload();
    } catch (error) {
      showAlert('오류', error instanceof Error ? error.message : '스키마 삭제에 실패했습니다.');
    }
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="full" padding="lg">
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', height: 'calc(100vh - 120px)' }}>
          {/* 좌측: 스키마 목록 */}
          <div style={{ width: '300px', flexShrink: 0 }}>
            <Card padding="md" variant="default">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                  스키마 목록
                </h2>
                <Button
                  variant="solid"
                  color="primary"
                  size="sm"
                  onClick={handleCreateNew}
                >
                  새로 만들기
                </Button>
              </div>

              {isLoadingSchemas ? (
                <p style={{ color: 'var(--color-text-secondary)' }}>로딩 중...</p>
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
                        {schema.industry_type || '공통'} · v{schema.version} · {schema.status}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* 우측: 스키마 편집 영역 */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {isCreating || selectedSchema ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {/* 기본 정보 */}
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

                {/* 액션 버튼 */}
                {selectedSchema && (
                  <Card padding="md" variant="default">
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                      <Button
                        variant="solid"
                        color="success"
                        onClick={handleActivate}
                        disabled={activateSchema.isPending || selectedSchema.status !== 'draft'}
                      >
                        활성화
                      </Button>
                      <Button
                        variant="outline"
                        color="error"
                        onClick={handleDelete}
                        disabled={deleteSchema.isPending || selectedSchema.status !== 'draft'}
                      >
                        삭제
                      </Button>
                    </div>
                  </Card>
                )}

                {/* 탭: 필드 편집 / 미리보기 / Import */}
                {editingFormSchema && (
                  <Card padding="md" variant="default">
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                      <Button
                        variant={activeTab === 'fields' ? 'solid' : 'outline'}
                        size="sm"
                        onClick={() => setActiveTab('fields')}
                      >
                        필드 편집
                      </Button>
                      <Button
                        variant={activeTab === 'preview' ? 'solid' : 'outline'}
                        size="sm"
                        onClick={() => setActiveTab('preview')}
                      >
                        미리보기
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
                                // condition이 MultiConditionRule인 경우는 무시 (conditions로 처리)
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
                  스키마를 선택하거나 새로 만드세요.
                </p>
              </Card>
            )}
          </div>
        </div>
      </Container>
    </ErrorBoundary>
  );
}
