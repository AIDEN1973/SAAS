/**
 * SchemaFilter Component
 *
 * SDUI v1.1: Filter Schema 렌더러(Table 상단 검색 조건)
 *
 * 기술문서: SDUI 기술문서 v1.1 - 15. Filter Engine
 *
 * [성능 최적화]
 * - 검색 필드(search, query 등): 디바운싱 적용 (기본 300ms)
 * - 다른 필터(select, date 등): 즉시 적용
 * - 일반 필터와 검색 필드를 분리하여 각각 최적화된 타이밍에 처리
 */
import React from 'react';
import type { FilterSchema } from '../types';
export interface SchemaFilterProps {
    schema: FilterSchema;
    onFilterChange?: (filters: Record<string, unknown>) => void;
    defaultValues?: Record<string, unknown>;
    className?: string;
    /** 검색 필드 디바운스 지연 시간 (밀리초, 기본값: 300ms) */
    searchDebounceDelay?: number;
}
/**
 * SchemaFilter 컴포넌트
 *
 * FilterSchema를 렌더링합니다.
 * FormFieldSchema를 사용하되 submit이 아닌 "필터 변경 이벤트"를 발생시킵니다.
 *
 * [성능 최적화]
 * - 검색 필드: 디바운싱 적용 (기본 300ms)
 * - 일반 필터: 즉시 적용
 * - 얕은 비교를 통한 불필요한 재렌더링 방지
 */
export declare const SchemaFilter: React.FC<SchemaFilterProps>;
//# sourceMappingURL=SchemaFilter.d.ts.map