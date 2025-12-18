/**
 * Renderer Factory
 *
 * SDUI v1.1: 스키마의 타입에 따라 적절한 렌더러를 선택하는 팩토리
 *
 * 기술문서: SDUI 기술문서 v1.1 - 8. Renderer Factory
 */
import React from 'react';
import type { UISchema } from '../types';
import type { ActionContext } from '../core/actionEngine';
export interface SchemaRendererProps {
    schema: UISchema;
    onSubmit?: (data: Record<string, unknown>) => void | Promise<void>;
    defaultValues?: Record<string, unknown>;
    className?: string;
    actionContext?: Partial<ActionContext>;
    translations?: Record<string, string>;
    apiCall?: (endpoint: string, method: string, body?: unknown) => Promise<unknown>;
}
/**
 * Renderer Factory
 *
 * 스키마의 type에 따라 적절한 렌더러를 선택하여 렌더링합니다.
 *
 * @param props - 렌더러 props
 * @returns 렌더링된 컴포넌트
 */
export declare function SchemaRenderer({ schema, ...props }: SchemaRendererProps): React.ReactElement | null;
//# sourceMappingURL=factory.d.ts.map