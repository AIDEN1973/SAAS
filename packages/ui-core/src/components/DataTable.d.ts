/**
 * DataTable Component
 *
 * [불변 규칙] 모든 환경에서 테이블 구조를 유지하며 표시
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모바일(xs, sm): 1열 세로 배치, 데스크톱(lg, xl): 가로 테이블
 */
import React from 'react';
export interface DataTableColumn<T = unknown> {
    key: string;
    label: string;
    render?: (value: unknown, row: T) => React.ReactNode;
    width?: string;
    align?: 'left' | 'center' | 'right';
    className?: string;
    sortable?: boolean;
    onSortChange?: (columnKey: string, direction: 'asc' | 'desc' | null) => void;
    filterable?: boolean;
}
export interface DataTableProps<T = unknown> {
    data: T[];
    columns: DataTableColumn<T>[];
    keyExtractor?: (row: T) => string | number;
    onRowClick?: (row: T) => void;
    emptyMessage?: string;
    className?: string;
    stickyHeader?: boolean;
    pagination?: {
        currentPage: number;
        totalPages: number;
        onPageChange: (page: number) => void;
    };
    itemsPerPage?: number;
}
/**
 * DataTable 컴포넌트
 *
 * 데스크톱 환경에서 테이블 데이터를 테이블 형식으로 표시
 */
export declare function DataTable<T = unknown>({ data, columns, keyExtractor, onRowClick, emptyMessage, className, stickyHeader, pagination, itemsPerPage, }: DataTableProps<T>): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=DataTable.d.ts.map