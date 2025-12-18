/**
 * SDUI Renderer
 *
 * [불변 규칙] 스키마를 UI 컴포넌트로 렌더링
 * [불변 규칙] Tailwind 클래스는 ui-core에서만 사용
 */
import React from 'react';
import { FormSchema, TableSchema, UISchema } from './types';
/**
 * Form Renderer (Deprecated)
 *
 * ⚠️ 이 함수는 더 이상 사용되지 않습니다. SchemaForm 컴포넌트를 사용하세요.
 *
 * @deprecated Use SchemaForm component instead
 */
export declare function renderForm(schema: FormSchema): React.ReactElement;
/**
 * Table Renderer (기본 구조)
 */
export declare function renderTable(schema: TableSchema): React.ReactElement;
/**
 * Universal Schema Renderer
 */
export declare function renderSchema(schema: UISchema): React.ReactElement;
/**
 * Schema Renderer Component
 */
export interface SchemaRendererProps {
    schema: UISchema;
    data?: unknown;
}
export declare const SchemaRenderer: React.FC<SchemaRendererProps>;
//# sourceMappingURL=renderer.d.ts.map