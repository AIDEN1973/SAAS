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
import { useForm } from 'react-hook-form';
import { Grid } from '@ui-core/react';
import { useDebounce } from '@hooks/use-debounce';
import type { FilterSchema } from '../types';
import { SchemaField } from './SchemaField';

export interface SchemaFilterProps {
  schema: FilterSchema;
  onFilterChange?: (filters: Record<string, unknown>) => void;
  defaultValues?: Record<string, unknown>;
  className?: string;
  /** 검색 필드 디바운스 지연 시간 (밀리초, 기본값: 300ms) */
  searchDebounceDelay?: number;
}

/**
 * 검색 필드 이름 패턴 (디바운싱 적용 대상)
 */
const SEARCH_FIELD_NAMES = ['search', 'query', 'keyword', 'q', 'term'];

/**
 * 검색 필드인지 확인
 */
function isSearchField(fieldName: string, fieldKind: string): boolean {
  return (
    SEARCH_FIELD_NAMES.includes(fieldName.toLowerCase()) ||
    (fieldKind === 'text' && fieldName.toLowerCase().includes('search'))
  );
}

/**
 * 객체의 얕은 비교 (성능 최적화)
 */
function shallowEqual(obj1: Record<string, unknown>, obj2: Record<string, unknown>): boolean {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }

  return true;
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
export const SchemaFilter: React.FC<SchemaFilterProps> = ({
  schema,
  onFilterChange,
  defaultValues,
  className,
  searchDebounceDelay = 300,
}) => {
  const form = useForm({
    defaultValues,
  });

  const { register, control, watch, formState: { errors } } = form;

  // 필터 값 변경 감시
  const watchedValues = watch();

  // 검색 필드 목록 (스키마가 변경될 때만 재계산)
  const searchFields = React.useMemo(() => {
    return schema.filter.fields
      .filter(field => isSearchField(field.name, field.kind))
      .map(field => field.name);
  }, [schema.filter.fields]);

  // 검색 필드 값 추출
  const searchValues = React.useMemo(() => {
    const result: Record<string, unknown> = {};
    for (const fieldName of searchFields) {
      if (fieldName in watchedValues) {
        result[fieldName] = watchedValues[fieldName];
      }
    }
    return result;
  }, [watchedValues, searchFields]);

  // 검색 필드 디바운싱
  const debouncedSearchValues = useDebounce(searchValues, searchDebounceDelay);

  // 일반 필터 값 추출 (검색 필드 제외)
  const nonSearchValues = React.useMemo(() => {
    const result: Record<string, unknown> = {};
    for (const key in watchedValues) {
      if (!searchFields.includes(key)) {
        result[key] = watchedValues[key];
      }
    }
    return result;
  }, [watchedValues, searchFields]);

  // 이전 값 추적 (변경 감지용)
  const prevNonSearchRef = React.useRef<Record<string, unknown>>({});
  const prevSearchRef = React.useRef<Record<string, unknown>>({});
  const isInitialMountRef = React.useRef(true);

  // onFilterChange를 useCallback으로 메모이제이션하여 불필요한 재실행 방지
  const handleFilterChange = React.useCallback((mergedValues: Record<string, unknown>) => {
    if (onFilterChange) {
      onFilterChange(mergedValues);
    }
  }, [onFilterChange]);

  // 일반 필터 변경 즉시 반영
  React.useEffect(() => {
    if (!onFilterChange) return;

    // 초기 마운트 시에는 검색 필드와 함께 처리하도록 스킵
    if (isInitialMountRef.current) return;

    // 일반 필터 변경 감지 (얕은 비교로 성능 최적화)
    if (!shallowEqual(nonSearchValues, prevNonSearchRef.current)) {
      prevNonSearchRef.current = nonSearchValues;

      // 일반 필터는 즉시 반영, 검색 필드는 현재 디바운싱된 값 사용
      const mergedValues = { ...nonSearchValues, ...debouncedSearchValues };
      handleFilterChange(mergedValues);
    }
  }, [nonSearchValues, debouncedSearchValues, handleFilterChange]);

  // 검색 필드 변경 처리 (디바운싱 적용)
  React.useEffect(() => {
    if (!onFilterChange) return;

    const mergedValues = { ...nonSearchValues, ...debouncedSearchValues };

    // 초기 마운트 시
    if (isInitialMountRef.current) {
      prevNonSearchRef.current = nonSearchValues;
      prevSearchRef.current = debouncedSearchValues;
      isInitialMountRef.current = false;
      handleFilterChange(mergedValues);
      return;
    }

    // 검색 필드 변경 감지 (얕은 비교로 성능 최적화)
    if (!shallowEqual(debouncedSearchValues, prevSearchRef.current)) {
      prevSearchRef.current = debouncedSearchValues;
      handleFilterChange(mergedValues);
    }
  }, [debouncedSearchValues, nonSearchValues, handleFilterChange]);

  const layout = schema.filter.layout;

  // text 필드 제외한 필터 필드 목록
  const filterFields = schema.filter.fields.filter((field) => field.kind !== 'text');
  const filterCount = filterFields.length;

  // 필터 개수에 따른 columns 결정 (최대 4개까지, 필터 개수보다 크지 않음)
  const layoutColumns = typeof layout?.columns === 'number' ? layout.columns : 4;
  const effectiveColumns = Math.min(filterCount, layoutColumns) as 1 | 2 | 3 | 4;

  return (
    <div
      className={className}
      style={{
        width: '100%',
        marginBottom: 'var(--spacing-lg)', // styles.css 준수: 필터 영역 하단 여백 공통 적용
        backgroundColor: 'var(--color-primary-40)', // 인더스트리 타입 40
        borderRadius: 'var(--border-radius-md)',
        padding: 'var(--spacing-md)',
      }}
    >
      <Grid
        columns={effectiveColumns}
        gap={layout?.columnGap || 'md'}
        style={{ width: '100%' }}
      >
        {filterFields.map((field) => (
          <SchemaField
            key={field.name}
            field={field}
            register={register}
            errors={errors}
            control={control}
            // 필터 UI에서는 값 입력/선택 시 placeholder가 제거되어야 하므로 인라인 라벨 비활성화
            showInlineLabelWhenHasValue={false}
          />
        ))}
      </Grid>
    </div>
  );
};
