/**
 * TableCardView Component
 *
 * [불변 규칙] 모바일 환경에서 테이블을 카드 UI로 자동 변환
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모바일(xs, sm)에서 사용
 */
import React from 'react';
export interface TableCardViewColumn<T = unknown> {
    key: string;
    label: string;
    render?: (value: unknown, row: T) => React.ReactNode;
    className?: string;
}
export interface TableCardViewProps<T = unknown> {
    data: T[];
    columns: TableCardViewColumn<T>[];
    keyExtractor?: (row: T) => string | number;
    onRowClick?: (row: T) => void;
    emptyMessage?: string;
    className?: string;
}
/**
 * TableCardView 컴포넌트
 *
 * 모바일 환경에서 테이블 데이터를 카드 형태로 표시
 */
export declare function TableCardView<T = unknown>({ data, columns, keyExtractor, onRowClick, emptyMessage, className, }: TableCardViewProps<T>): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=TableCardView.d.ts.map