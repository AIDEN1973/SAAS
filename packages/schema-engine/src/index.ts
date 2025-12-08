/**
 * Schema Engine Core
 *
 * SDUI 엔진 + Meta-Schema + Versioning + Condition Rule
 * SDUI v1.1 추가 기능 확장
 *
 * 기술문서:
 * - docu/스키마엔진.txt (기존)
 * - SDUI 기술문서 v1.1 (추가 기능 확장)
 */

export * from './types';
export * from './validator';
export { checkSchemaVersion } from './validator';
export * from './renderer';
export { SchemaRenderer } from './renderer';
export type { SchemaRendererProps } from './renderer';

// SDUI v1.1: Renderer Factory
export { SchemaRenderer as SchemaRendererFactory } from './renderer/factory';
export type { SchemaRendererProps as SchemaRendererFactoryProps } from './renderer/factory';

// Core exports (Condition Rule)
export { evaluateConditionRule, evaluateMultiConditionRule, getConditionalActions } from './core/conditionEvaluator';
export { buildValidationRules } from './core/validation';

// SDUI v1.1: Schema Loader
export { loadSchema, SchemaLoadError } from './loader';
export type { SchemaLoadOptions, SchemaLoadResult } from './loader';
export { migrateSchema } from './loader/migration';
export type { MigrationRule } from './loader/migration';
export { bindI18n } from './loader/i18n';
export type { I18nBindingOptions, I18nTranslations } from './loader/i18n';

// SDUI v1.1: Action Engine
export { executeAction, executeActionsForEvent } from './core/actionEngine';
export type { ActionContext } from './core/actionEngine';
export type { ActionDefinition, ActionType } from './types';

// SDUI v1.1: Custom Widget Registry
export {
  registerWidget,
  loadWidget,
  initializeWidgetRegistry,
  getRegisteredWidgets
} from './widgets/registry';
export type { WidgetRegistry, WidgetLoader } from './widgets/registry';

// Registry exports
export { SchemaRegistryClient } from './registry/client';
export type { SchemaRegistryClientOptions, SchemaRegistryEntry } from './registry/client';

// React exports (SchemaField, SchemaForm)
export { SchemaField } from './react/SchemaField';
export type { SchemaFieldProps } from './react/SchemaField';
export { SchemaForm, SchemaFormWithMethods } from './react/SchemaForm';
export type { SchemaFormProps, SchemaFormWithMethodsProps } from './react/SchemaForm';

// SDUI v1.1: 추가 렌더러들
export { SchemaTable } from './react/SchemaTable';
export type { SchemaTableProps } from './react/SchemaTable';
export { SchemaDetail } from './react/SchemaDetail';
export type { SchemaDetailProps } from './react/SchemaDetail';
export { SchemaFilter } from './react/SchemaFilter';
export type { SchemaFilterProps } from './react/SchemaFilter';
export { SchemaWidget } from './react/SchemaWidget';
export type { SchemaWidgetProps } from './react/SchemaWidget';
