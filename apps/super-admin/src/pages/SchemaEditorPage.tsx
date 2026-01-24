/**
 * Schema Editor Page
 *
 * [불변 규칙] Super Admin 전용 No-Code UI Builder
 * [불변 규칙] Zero-Trust: 모든 권한 검증은 RLS에서 처리
 * [불변 규칙] Dual Validation: Client-Side + Server-Side
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 *
 * 기술문서: docu/스키마에디터.txt
 */

import { useState, useMemo, useEffect } from 'react';
import { ErrorBoundary, Card, Button, useModal } from '@ui-core/react';
import { useIsSuperAdmin, useSchemaList, useActivateSchema, useDeleteSchema, type SchemaRegistryEntry } from '@hooks/use-schema-registry';
import type { FormSchema, UISchema, ConditionRule, MultiConditionRule, FormFieldSchema } from '@schema-engine/types';
import type { UseMutationResult } from '@tanstack/react-query';
import { SchemaEditorForm } from '../components/schema-editor/SchemaEditorForm';
import { SchemaFieldEditor } from '../components/schema-editor/SchemaFieldEditor';
import { ValidationEditor } from '../components/schema-editor/ValidationEditor';
import { ConditionEditor } from '../components/schema-editor/ConditionEditor';
import { LayoutEditor } from '../components/schema-editor/LayoutEditor';
import { SchemaPreview } from '../components/schema-editor/SchemaPreview';
import { ImportExportPanel } from '../components/schema-editor/ImportExportPanel';
import {
  SuperAdminLayout,
  PageHeader,
  Section,
  StatCard,
  LoadingSkeleton,
} from '../components/SuperAdminLayout';
import {
  SCHEMA_EDITOR_SUB_MENU_ITEMS,
  DEFAULT_SCHEMA_EDITOR_SUB_MENU,
  SCHEMA_EDITOR_RELATED_MENUS,
  type SchemaEditorSubMenuId,
} from '../constants/sub-sidebar-menus';

// ============================================================================
// Main Component
// ============================================================================

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
  const [activeTab, setActiveTab] = useState<SchemaEditorSubMenuId>(DEFAULT_SCHEMA_EDITOR_SUB_MENU);

  // 현재 편집 중인 스키마 (FormSchema로 변환)
  const editingFormSchema = useMemo<FormSchema | null>(() => {
    if (localFormSchema) return localFormSchema;
    if (selectedSchema && selectedSchema.schema_json.type === 'form') {
      return selectedSchema.schema_json;
    }
    if (isCreating) {
      return {
        version: '1.0.0',
        minClient: '1.0.0',
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

  // 탭 변경 핸들러
  const handleTabChange = (id: SchemaEditorSubMenuId) => {
    setActiveTab(id);
  };

  // 권한 체크
  if (isCheckingAuth) {
    return (
      <SuperAdminLayout
        title="스키마 에디터"
        subMenuItems={SCHEMA_EDITOR_SUB_MENU_ITEMS}
        defaultSubMenuId={DEFAULT_SCHEMA_EDITOR_SUB_MENU}
      >
        <LoadingSkeleton cardCount={4} showTable />
      </SuperAdminLayout>
    );
  }

  if (!isSuperAdmin) {
    return (
      <SuperAdminLayout
        title="스키마 에디터"
        subMenuItems={SCHEMA_EDITOR_SUB_MENU_ITEMS}
        defaultSubMenuId={DEFAULT_SCHEMA_EDITOR_SUB_MENU}
      >
        <Card padding="md" variant="outlined">
          <h2 style={{ color: 'var(--color-error)', marginBottom: 'var(--spacing-md)' }}>
            접근 권한 없음
          </h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            이 페이지는 Super Admin만 접근할 수 있습니다.
          </p>
        </Card>
      </SuperAdminLayout>
    );
  }

  const handleCreateNew = () => {
    setIsCreating(true);
    setSelectedSchema(null);
    setEditingFieldIndex(null);
    setActiveTab('editor');
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
    setActiveTab('editor');
  };

  const handleSaveSchema = (savedSchema: SchemaRegistryEntry) => {
    setSelectedSchema(savedSchema);
    setIsCreating(false);
    setLocalFormSchema(null);
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
      setLocalFormSchema(importedSchema);
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
      window.location.reload();
    } catch (error) {
      showAlert('오류', error instanceof Error ? error.message : '스키마 삭제에 실패했습니다.');
    }
  };

  // 탭별 콘텐츠 렌더링
  const renderContent = () => {
    switch (activeTab) {
      case 'list':
        return (
          <SchemaListTab
            schemas={schemas}
            isLoadingSchemas={isLoadingSchemas}
            selectedSchema={selectedSchema}
            onSelectSchema={handleSelectSchema}
            onCreateNew={handleCreateNew}
          />
        );
      case 'editor':
        return (
          <EditorTab
            isCreating={isCreating}
            selectedSchema={selectedSchema}
            editingFormSchema={editingFormSchema}
            editingFieldIndex={editingFieldIndex}
            activateSchema={activateSchema}
            deleteSchema={deleteSchema}
            onSave={handleSaveSchema}
            onCancel={() => {
              setIsCreating(false);
              setSelectedSchema(null);
              setLocalFormSchema(null);
              setActiveTab('list');
            }}
            onSchemaJsonChange={(schemaJson) => {
              if (schemaJson.type === 'form') {
                setLocalFormSchema(schemaJson);
              }
            }}
            onActivate={handleActivate}
            onDelete={handleDelete}
            onFieldsChange={handleFieldsChange}
            onFieldSelect={setEditingFieldIndex}
            onFieldValidationChange={handleFieldValidationChange}
            onFieldConditionChange={handleFieldConditionChange}
          />
        );
      case 'layouts':
        return (
          <LayoutsTab
            editingFormSchema={editingFormSchema}
            onLayoutChange={handleLayoutChange}
          />
        );
      case 'settings':
        return (
          <SettingsTab
            editingFormSchema={editingFormSchema}
            onImport={handleImport}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ErrorBoundary>
      <SuperAdminLayout
        title="스키마 에디터"
        subMenuItems={SCHEMA_EDITOR_SUB_MENU_ITEMS}
        defaultSubMenuId={DEFAULT_SCHEMA_EDITOR_SUB_MENU}
        relatedMenus={SCHEMA_EDITOR_RELATED_MENUS}
        selectedSubMenuId={activeTab}
        onSubMenuChange={handleTabChange}
      >
        {renderContent()}
      </SuperAdminLayout>
    </ErrorBoundary>
  );
}

// ============================================================================
// Tab Components
// ============================================================================

interface SchemaListTabProps {
  schemas: SchemaRegistryEntry[] | undefined;
  isLoadingSchemas: boolean;
  selectedSchema: SchemaRegistryEntry | null;
  onSelectSchema: (schema: SchemaRegistryEntry) => void;
  onCreateNew: () => void;
}

function SchemaListTab({
  schemas,
  isLoadingSchemas,
  selectedSchema,
  onSelectSchema,
  onCreateNew,
}: SchemaListTabProps) {
  // 스키마 그룹화 (entity별)
  const groupedSchemas = useMemo(() => {
    if (!schemas) return {};
    return schemas.reduce((acc, schema) => {
      const key = schema.entity;
      if (!acc[key]) acc[key] = [];
      acc[key].push(schema);
      return acc;
    }, {} as Record<string, SchemaRegistryEntry[]>);
  }, [schemas]);

  // 상태별 카운트
  const statusCounts = useMemo(() => {
    if (!schemas) return { draft: 0, active: 0, deprecated: 0 };
    return schemas.reduce(
      (acc, schema) => {
        acc[schema.status as keyof typeof acc]++;
        return acc;
      },
      { draft: 0, active: 0, deprecated: 0 }
    );
  }, [schemas]);

  return (
    <>
      <PageHeader
        title="스키마 목록"
        subtitle="등록된 UI 스키마 관리"
        actions={
          <Button variant="solid" color="primary" onClick={onCreateNew}>
            새로 만들기
          </Button>
        }
      />

      {/* 스키마 통계 */}
      <Section title="스키마 현황">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(var(--width-metric-card-min), 1fr))',
            gap: 'var(--spacing-md)',
          }}
        >
          <StatCard
            title="전체 스키마"
            value={schemas?.length || 0}
            suffix="개"
            color="info"
          />
          <StatCard
            title="Draft"
            value={statusCounts.draft}
            suffix="개"
            color="warning"
          />
          <StatCard
            title="Active"
            value={statusCounts.active}
            suffix="개"
            color="success"
          />
          <StatCard
            title="Deprecated"
            value={statusCounts.deprecated}
            suffix="개"
            color="default"
          />
        </div>
      </Section>

      {/* 스키마 목록 */}
      <Section title="스키마 목록">
        {isLoadingSchemas ? (
          <LoadingSkeleton cardCount={4} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {Object.entries(groupedSchemas).map(([entity, entitySchemas]) => (
              <Card key={entity} padding="md" variant="outlined">
                <h3
                  style={{
                    fontSize: 'var(--font-size-base)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-text)',
                    margin: 0,
                    marginBottom: 'var(--spacing-sm)',
                  }}
                >
                  {entity}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                  {entitySchemas.map((schema) => (
                    <div
                      key={schema.id}
                      onClick={() => onSelectSchema(schema)}
                      style={{
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        borderRadius: 'var(--border-radius-sm)',
                        border: `var(--border-width-thin) solid ${
                          selectedSchema?.id === schema.id
                            ? 'var(--color-primary)'
                            : 'var(--color-gray-200)'
                        }`,
                        backgroundColor:
                          selectedSchema?.id === schema.id
                            ? 'var(--color-primary-50)'
                            : 'var(--color-surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 'var(--font-weight-medium)',
                            color: 'var(--color-text)',
                          }}
                        >
                          v{schema.version}
                        </span>
                        <span
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-secondary)',
                            marginLeft: 'var(--spacing-sm)',
                          }}
                        >
                          {schema.industry_type || '공통'}
                        </span>
                      </div>
                      <StatusBadge status={schema.status} />
                    </div>
                  ))}
                </div>
              </Card>
            ))}
            {(!schemas || schemas.length === 0) && (
              <Card padding="xl" variant="outlined">
                <p
                  style={{
                    textAlign: 'center',
                    color: 'var(--color-text-secondary)',
                    margin: 0,
                  }}
                >
                  등록된 스키마가 없습니다. '새로 만들기' 버튼을 클릭하여 스키마를 생성하세요.
                </p>
              </Card>
            )}
          </div>
        )}
      </Section>
    </>
  );
}

interface EditorTabProps {
  isCreating: boolean;
  selectedSchema: SchemaRegistryEntry | null;
  editingFormSchema: FormSchema | null;
  editingFieldIndex: number | null;
  activateSchema: UseMutationResult<SchemaRegistryEntry, Error, string>;
  deleteSchema: UseMutationResult<void, Error, string>;
  onSave: (schema: SchemaRegistryEntry) => void;
  onCancel: () => void;
  onSchemaJsonChange: (schema: UISchema) => void;
  onActivate: () => void;
  onDelete: () => void;
  onFieldsChange: (fields: FormSchema['form']['fields']) => void;
  onFieldSelect: (index: number | null) => void;
  onFieldValidationChange: (index: number, validation: FormFieldSchema['validation']) => void;
  onFieldConditionChange: (index: number, condition: ConditionRule | undefined, conditions: MultiConditionRule | undefined) => void;
}

function EditorTab({
  isCreating,
  selectedSchema,
  editingFormSchema,
  editingFieldIndex,
  activateSchema,
  deleteSchema,
  onSave,
  onCancel,
  onSchemaJsonChange,
  onActivate,
  onDelete,
  onFieldsChange,
  onFieldSelect,
  onFieldValidationChange,
  onFieldConditionChange,
}: EditorTabProps) {
  if (!isCreating && !selectedSchema) {
    return (
      <>
        <PageHeader title="스키마 편집" subtitle="스키마를 선택하거나 새로 만드세요" />
        <Card padding="xl" variant="outlined">
          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                margin: 0,
                marginBottom: 'var(--spacing-md)',
              }}
            >
              '스키마 목록' 탭에서 스키마를 선택하거나 새로 만드세요.
            </p>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={isCreating ? '새 스키마 생성' : `스키마 편집: ${selectedSchema?.entity}`}
        subtitle={isCreating ? '새로운 UI 스키마를 생성합니다' : `버전 ${selectedSchema?.version}`}
      />

      {/* 기본 정보 */}
      <Section title="기본 정보">
        <SchemaEditorForm
          schema={selectedSchema || null}
          currentFormSchema={editingFormSchema}
          onSave={onSave}
          onSchemaJsonChange={onSchemaJsonChange}
          onCancel={onCancel}
        />
      </Section>

      {/* 액션 버튼 */}
      {selectedSchema && (
        <Section title="스키마 액션">
          <Card padding="md" variant="outlined">
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <Button
                variant="solid"
                color="success"
                onClick={onActivate}
                disabled={activateSchema.isPending || selectedSchema.status !== 'draft'}
              >
                활성화
              </Button>
              <Button
                variant="outline"
                color="error"
                onClick={onDelete}
                disabled={deleteSchema.isPending || selectedSchema.status !== 'draft'}
              >
                삭제
              </Button>
            </div>
            <p
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                margin: 0,
                marginTop: 'var(--spacing-sm)',
              }}
            >
              draft 상태의 스키마만 활성화하거나 삭제할 수 있습니다.
            </p>
          </Card>
        </Section>
      )}

      {/* 필드 편집 */}
      {editingFormSchema && (
        <Section title="필드 편집">
          <SchemaFieldEditor
            fields={editingFormSchema.form.fields}
            onChange={onFieldsChange}
            onFieldSelect={onFieldSelect}
          />

          {editingFieldIndex !== null && editingFormSchema.form.fields[editingFieldIndex] && (
            <div
              style={{
                marginTop: 'var(--spacing-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-md)',
              }}
            >
              <ValidationEditor
                field={editingFormSchema.form.fields[editingFieldIndex]}
                onChange={(validation) => onFieldValidationChange(editingFieldIndex, validation)}
              />
              <ConditionEditor
                field={editingFormSchema.form.fields[editingFieldIndex]}
                allFields={editingFormSchema.form.fields}
                onChange={(condition, conditions) => {
                  const singleCondition = condition && 'field' in condition ? condition : undefined;
                  onFieldConditionChange(editingFieldIndex, singleCondition, conditions);
                }}
              />
            </div>
          )}
        </Section>
      )}

      {/* 미리보기 */}
      {editingFormSchema && (
        <Section title="폼 미리보기">
          <SchemaPreview schema={editingFormSchema} />
        </Section>
      )}
    </>
  );
}

interface LayoutsTabProps {
  editingFormSchema: FormSchema | null;
  onLayoutChange: (layout: FormSchema['form']['layout']) => void;
}

function LayoutsTab({ editingFormSchema, onLayoutChange }: LayoutsTabProps) {
  if (!editingFormSchema) {
    return (
      <>
        <PageHeader title="레이아웃 설정" subtitle="스키마를 선택한 후 레이아웃을 설정하세요" />
        <Card padding="xl" variant="outlined">
          <p
            style={{
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}
          >
            '스키마 목록' 탭에서 스키마를 선택하거나 새로 만드세요.
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="레이아웃 설정" subtitle="폼 레이아웃 및 그리드 설정" />

      <Section title="그리드 레이아웃">
        <LayoutEditor
          layout={editingFormSchema.form.layout}
          onChange={onLayoutChange}
        />
      </Section>

      <Section title="미리보기">
        <SchemaPreview schema={editingFormSchema} />
      </Section>
    </>
  );
}

interface SettingsTabProps {
  editingFormSchema: FormSchema | null;
  onImport: (schema: UISchema) => void;
}

function SettingsTab({ editingFormSchema, onImport }: SettingsTabProps) {
  return (
    <>
      <PageHeader title="스키마 설정" subtitle="Import/Export 및 고급 설정" />

      <Section title="Import / Export">
        {editingFormSchema ? (
          <ImportExportPanel
            schema={editingFormSchema}
            onImport={onImport}
          />
        ) : (
          <Card padding="xl" variant="outlined">
            <p
              style={{
                textAlign: 'center',
                color: 'var(--color-text-secondary)',
                margin: 0,
              }}
            >
              스키마를 선택한 후 Import/Export 기능을 사용할 수 있습니다.
            </p>
          </Card>
        )}
      </Section>

      <Section title="JSON 스키마 가이드">
        <Card padding="md" variant="outlined">
          <ul style={guideListStyle}>
            <li>
              <strong>Export</strong>: 현재 스키마를 JSON 파일로 다운로드합니다.
            </li>
            <li>
              <strong>Import</strong>: JSON 파일을 불러와 스키마를 수정합니다.
            </li>
            <li>
              <strong>버전 관리</strong>: 동일 entity의 스키마는 version으로 구분됩니다.
            </li>
            <li>
              <strong>활성화</strong>: draft → active 전환 시 기존 active는 deprecated로 변경됩니다.
            </li>
          </ul>
        </Card>
      </Section>
    </>
  );
}

// ============================================================================
// UI Components
// ============================================================================

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusStyle = (s: string): { bg: string; text: string } => {
    switch (s) {
      case 'draft':
        return { bg: 'var(--color-warning-50)', text: 'var(--color-warning)' };
      case 'active':
        return { bg: 'var(--color-success-50)', text: 'var(--color-success)' };
      case 'deprecated':
        return { bg: 'var(--color-gray-100)', text: 'var(--color-text-secondary)' };
      default:
        return { bg: 'var(--color-gray-100)', text: 'var(--color-text-secondary)' };
    }
  };

  const style = getStatusStyle(status);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: 'var(--spacing-xxs) var(--spacing-sm)',
        borderRadius: 'var(--border-radius-full)',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-medium)',
        backgroundColor: style.bg,
        color: style.text,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  );
}

// ============================================================================
// Styles
// ============================================================================

const guideListStyle: React.CSSProperties = {
  paddingLeft: 'var(--spacing-lg)',
  color: 'var(--color-text-secondary)',
  fontSize: 'var(--font-size-base)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-sm)',
  margin: 0,
};
