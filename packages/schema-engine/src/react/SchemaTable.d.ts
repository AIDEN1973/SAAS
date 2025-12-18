/**
 * SchemaTable Component
 *
 * SDUI v1.1: Table Schema 렌더러
 *
 * 기술문서: SDUI 기술문서 v1.1 - 14. Table Engine
 */
import React from 'react';
import type { TableSchema } from '../types';
import { type ActionContext } from '../core/actionEngine';
export interface SchemaTableProps {
    schema: TableSchema;
    className?: string;
    actionContext?: Partial<ActionContext>;
    translations?: Record<string, string>;
    data?: Record<string, unknown>[];
    /**
     * 서버 페이지네이션 모드에서 전체 건수
     * - data는 "현재 페이지 데이터"만 주입
     */
    totalCount?: number;
    /** 서버 페이지네이션 모드에서 현재 페이지(1-base) */
    page?: number;
    /** 서버 페이지네이션 모드에서 페이지 변경 콜백 */
    onPageChange?: (page: number) => void;
    apiCall?: (endpoint: string, method: string, body?: unknown) => Promise<unknown>;
    filters?: Record<string, unknown>;
    onRowClick?: (row: Record<string, unknown>) => void;
}
/**
 * SchemaTable 컴포넌트
 *
 * TableSchema를 렌더링합니다.
 * API 기반 데이터 소스, 행 액션, 벌크 액션 등을 지원합니다.
 */
export declare const SchemaTable: React.FC<SchemaTableProps>;
//# sourceMappingURL=SchemaTable.d.ts.map