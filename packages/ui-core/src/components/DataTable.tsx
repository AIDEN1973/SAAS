/**
 * DataTable Component
 *
 * [불변 규칙] 모든 환경에서 테이블 구조를 유지하며 표시
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모바일(xs, sm): 1열 세로 배치, 데스크톱(lg, xl): 가로 테이블
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { CaretUp, CaretDown, X, Funnel } from 'phosphor-react';
import { Database, LucideIcon } from 'lucide-react';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { EmptyState } from './EmptyState';
import { Select } from './Select';
import { DatePicker } from './DatePicker';
import { Input } from './Input';
import { Grid } from './Layout';
import { Button } from './Button';
import { SearchInput } from './SearchInput';

/**
 * 필터 타입 정의
 */
export type DataTableFilterType = 'text' | 'select' | 'dateRange';

/**
 * 필터 설정 인터페이스
 */
export interface DataTableFilter {
  /** 필터 타입 */
  type: DataTableFilterType;
  /** 필터가 적용될 컬럼 키 */
  columnKey: string;
  /** 필터 레이블 (선택적) */
  label?: string;
  /** 필터 placeholder */
  placeholder?: string;
  /** select 타입일 때 옵션 목록 */
  options?: Array<{ value: string; label: string }>;
}

/**
 * 필터 값 인터페이스
 */
export interface DataTableFilterValue {
  /** 텍스트 검색 값 */
  text?: string;
  /** 선택된 값 (select) */
  selected?: string;
  /** 날짜 범위 (dateRange) */
  dateRange?: {
    start?: string;
    end?: string;
  };
}

/**
 * 필터 상태 타입 (컬럼 키 -> 필터 값)
 */
export type DataTableFilterState = Record<string, DataTableFilterValue>;

export interface DataTableColumn<T = unknown> {
  key: string;
  label: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  sortable?: boolean; // 기본값: true (모든 테이블에 정렬 기능 기본 활성화)
  onSortChange?: (columnKey: string, direction: 'asc' | 'desc' | null) => void;
  filterable?: boolean; // 필터 아이콘 표시 여부 (클릭 시 정렬 기능 동작)
}

export interface DataTableProps<T = unknown> {
  data: T[];
  columns: DataTableColumn<T>[];
  keyExtractor?: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  emptyIcon?: LucideIcon;
  className?: string;
  stickyHeader?: boolean;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  itemsPerPage?: number;
  /** 내장 필터 설정 */
  filters?: DataTableFilter[];
  /** 필터 값 변경 콜백 (서버사이드 필터링용) */
  onFilterChange?: (filterState: DataTableFilterState) => void;
  /** 초기 필터 값 */
  initialFilterState?: DataTableFilterState;
  /** 클라이언트 사이드 필터링 활성화 (기본: true) */
  enableClientSideFiltering?: boolean;
  /** 로딩 상태 */
  loading?: boolean;
  /** 에러 메시지 */
  error?: string | null;
  /** 페이지당 항목 수 변경 핸들러 */
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  /** 필터 컨트롤 영역 숨기기 (SchemaTable 등에서 자체 필터 컨트롤을 사용할 때) */
  hideFilterControls?: boolean;
  /** 페이지당 항목 수 선택 옵션 (기본값: [20, 40, 60, 80]) */
  itemsPerPageOptions?: number[];
  /** 검색어 */
  searchValue?: string;
  /** 검색어 변경 핸들러 */
  onSearchChange?: (value: string) => void;
  /** 검색 플레이스홀더 (기본값: "검색...") */
  searchPlaceholder?: string;
}

/**
 * DataTable 컴포넌트
 *
 * 데스크톱 환경에서 테이블 데이터를 테이블 형식으로 표시
 */
export function DataTable<T = unknown>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = '데이터가 없습니다.',
  emptyIcon,
  className,
  stickyHeader = true,
  pagination,
  itemsPerPage = 20,
  filters,
  onFilterChange,
  initialFilterState = {},
  enableClientSideFiltering = true,
  loading = false,
  error = null,
  onItemsPerPageChange,
  itemsPerPageOptions = [20, 40, 60, 80],
  hideFilterControls = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = '검색...',
}: DataTableProps<T>) {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  // React Hooks 규칙 준수: 모든 Hook은 조건부 return 이전에 호출되어야 함
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  // 모바일: 행 펼침 상태 관리 (각 행의 키를 키로 사용)
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());

  // 필터 상태 관리
  const [filterState, setFilterState] = useState<DataTableFilterState>(initialFilterState);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const filterToggleRef = useRef<HTMLButtonElement>(null);

  // 페이지당 항목 수 내부 상태 관리 (외부 제어는 선택적)
  const [internalItemsPerPage, setInternalItemsPerPage] = useState(itemsPerPage);
  // 내부 상태를 우선 사용 (외부에서 명시적으로 제어하지 않는 한)
  const effectiveItemsPerPage = internalItemsPerPage;

  // 검색어 내부 상태 관리 (외부 제어는 선택적)
  const [internalSearchValue, setInternalSearchValue] = useState(searchValue);
  // 외부에서 searchValue가 전달되면 외부 값 사용, 아니면 내부 상태 사용
  const effectiveSearchValue = onSearchChange ? searchValue : internalSearchValue;
  const handleSearchChange = useCallback((value: string) => {
    if (onSearchChange) {
      onSearchChange(value);
    } else {
      setInternalSearchValue(value);
    }
  }, [onSearchChange]);

  // 필터 값 변경 핸들러
  const handleFilterValueChange = useCallback((columnKey: string, value: DataTableFilterValue) => {
    setFilterState((prev) => {
      const newState = { ...prev, [columnKey]: value };
      onFilterChange?.(newState);
      return newState;
    });
  }, [onFilterChange]);

  // 필터 초기화 핸들러
  const handleClearFilters = useCallback(() => {
    setFilterState({});
    onFilterChange?.({});
  }, [onFilterChange]);

  // 활성 필터 개수 계산
  const activeFilterCount = useMemo(() => {
    return Object.values(filterState).filter((v) => {
      if (v.text && v.text.trim()) return true;
      if (v.selected && v.selected !== 'all') return true;
      if (v.dateRange && (v.dateRange.start || v.dateRange.end)) return true;
      return false;
    }).length;
  }, [filterState]);

  const handleSortClick = (e: React.MouseEvent, columnKey: string) => {
    e.stopPropagation();
    const column = columns.find((col) => col.key === columnKey);
    // 기본값: sortable이 명시되지 않으면 true로 간주 (모든 테이블에 정렬 기능 기본 활성화)
    const isSortable = column?.sortable !== false;
    if (!isSortable) return;

    if (sortColumn === columnKey) {
      // 같은 컬럼 클릭 시: 오름차순 -> 내림차순 -> 정렬 해제
      if (sortDirection === 'asc') {
        setSortDirection('desc');
        column?.onSortChange?.(columnKey, 'desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
        column?.onSortChange?.(columnKey, null);
      }
    } else {
      // 다른 컬럼 클릭 시: 오름차순으로 시작
      setSortColumn(columnKey);
      setSortDirection('asc');
      column?.onSortChange?.(columnKey, 'asc');
    }
  };

  const handleFilterClick = (e: React.MouseEvent, columnKey: string) => {
    e.stopPropagation();
    // 필터 아이콘 클릭 시 필터 패널 토글
    setShowFilterPanel((prev) => !prev);
  };

  // 클라이언트 사이드 필터링 로직 (검색 + 필터)
  const filteredData = useMemo(() => {
    let result = data;

    // 1. 검색어 필터링 (모든 컬럼에서 검색)
    const searchText = effectiveSearchValue.trim().toLowerCase();
    if (searchText) {
      result = result.filter((row) => {
        const rowData = row as Record<string, unknown>;
        // 모든 컬럼에서 검색어 포함 여부 확인
        return columns.some((column) => {
          const cellValue = rowData[column.key];
          const cellStr = String(cellValue ?? '').toLowerCase();
          return cellStr.includes(searchText);
        });
      });
    }

    // 2. 필터 적용
    if (!enableClientSideFiltering || !filters || filters.length === 0) {
      return result;
    }

    return result.filter((row) => {
      const rowData = row as Record<string, unknown>;

      return filters.every((filter) => {
        const filterValue = filterState[filter.columnKey];
        if (!filterValue) return true;

        const cellValue = rowData[filter.columnKey];

        switch (filter.type) {
          case 'text': {
            const searchText = filterValue.text?.trim().toLowerCase();
            if (!searchText) return true;
            const cellStr = String(cellValue ?? '').toLowerCase();
            return cellStr.includes(searchText);
          }
          case 'select': {
            const selectedValue = filterValue.selected;
            if (!selectedValue || selectedValue === 'all') return true;
            return String(cellValue) === selectedValue;
          }
          case 'dateRange': {
            const { start, end } = filterValue.dateRange || {};
            if (!start && !end) return true;

            const cellDate = cellValue instanceof Date
              ? cellValue
              : new Date(String(cellValue));

            if (isNaN(cellDate.getTime())) return true;

            if (start) {
              const startDate = new Date(start);
              startDate.setHours(0, 0, 0, 0);
              if (cellDate < startDate) return false;
            }

            if (end) {
              const endDate = new Date(end);
              endDate.setHours(23, 59, 59, 999);
              if (cellDate > endDate) return false;
            }

            return true;
          }
          default:
            return true;
        }
      });
    });
  }, [data, filters, filterState, enableClientSideFiltering, effectiveSearchValue, columns]);

  // 정렬된 데이터 계산
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return filteredData;
    }

    const column = columns.find((col) => col.key === sortColumn);
    if (!column) {
      return filteredData;
    }

    return [...filteredData].sort((a, b) => {
      const aValue = (a as Record<string, unknown>)[sortColumn];
      const bValue = (b as Record<string, unknown>)[sortColumn];

      // null/undefined 처리: 항상 마지막으로 정렬
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // 숫자 비교
      const aNum = Number(aValue);
      const bNum = Number(bValue);
      if (!isNaN(aNum) && !isNaN(bNum) && String(aValue) === String(aNum) && String(bValue) === String(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // 날짜 비교
      const aDate = new Date(aValue as string | number | Date);
      const bDate = new Date(bValue as string | number | Date);
      if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
        return sortDirection === 'asc' ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
      }

      // 문자열 비교 (대소문자 구분 없음)
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      if (aStr < bStr) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aStr > bStr) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredData, sortColumn, sortDirection, columns]);

  // 페이지네이션 적용된 데이터 계산
  const paginatedData = useMemo(() => {
    if (!pagination) {
      return sortedData;
    }

    const startIndex = (pagination.currentPage - 1) * effectiveItemsPerPage;
    const endIndex = startIndex + effectiveItemsPerPage;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, pagination, effectiveItemsPerPage]);

  // 로딩 상태 렌더링
  if (loading) {
    return (
      <div
        className={clsx(className)}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 'var(--height-chart)',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-base)',
        }}
      >
        로딩 중...
      </div>
    );
  }

  // 에러 상태 렌더링
  if (error) {
    return (
      <div
        className={clsx(className)}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 'var(--height-chart)',
          color: 'var(--color-error)',
          fontSize: 'var(--font-size-base)',
        }}
      >
        {error}
      </div>
    );
  }

  // 필터 UI 렌더링 함수
  const renderFilterPanel = useCallback(() => {
    if (!filters || filters.length === 0) return null;

    // text 필터 제외한 필터 목록
    const nonTextFilters = filters.filter((filter) => filter.type !== 'text');

    if (nonTextFilters.length === 0) return null;

    // dateRange 필터는 2칸 차지하므로 실제 차지하는 컬럼 수 계산
    const totalColumnSpan = nonTextFilters.reduce((sum, filter) => {
      return sum + (filter.type === 'dateRange' ? 2 : 1);
    }, 0);

    // 필터가 차지하는 총 컬럼 수에 따른 columns 결정 (최대 4개)
    const effectiveColumns = Math.min(totalColumnSpan, 4) as 1 | 2 | 3 | 4;

    return (
      <div
        style={{
          width: '100%',
          marginBottom: 'var(--spacing-lg)', // SchemaFilter 기준: 필터 영역 하단 여백
          backgroundColor: 'var(--color-primary-40)', // 인더스트리 타입 40
          borderRadius: 'var(--border-radius-md)',
          padding: 'var(--spacing-md)',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Grid columns={effectiveColumns} gap="md" style={{ width: '100%' }}>
          {nonTextFilters.map((filter) => {
              const currentValue = filterState[filter.columnKey] || {};
              const column = columns.find((c) => c.key === filter.columnKey);
              const label = filter.label || column?.label || filter.columnKey;

              switch (filter.type) {
                case 'select':
                  return (
                    <Select
                      key={filter.columnKey}
                      value={currentValue.selected || 'all'}
                      onChange={(val) => handleFilterValueChange(filter.columnKey, { ...currentValue, selected: typeof val === 'string' ? val : val[0] })}
                      options={[
                        { value: 'all', label: filter.placeholder || '전체' },
                        ...(filter.options || []),
                      ]}
                      fullWidth
                      size="md"
                      showInlineLabelWhenHasValue={false}
                    />
                  );

                case 'dateRange':
                  // 로컬 시간 기준 YYYY-MM-DD 형식 변환 함수 (KST 대응)
                  const formatLocalDate = (date: Date): string => {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                  };

                  // 프리셋과 현재 날짜 범위 일치 여부 확인 함수
                  const isPresetSelected = (presetDays: number): boolean => {
                    if (!currentValue.dateRange?.start || !currentValue.dateRange?.end) return false;

                    const today = new Date();
                    let expectedStart: string;
                    let expectedEnd: string;

                    if (presetDays === 0) {
                      // 오늘
                      expectedStart = formatLocalDate(today);
                      expectedEnd = formatLocalDate(today);
                    } else if (presetDays === 1) {
                      // 어제
                      const yesterday = new Date(today);
                      yesterday.setDate(yesterday.getDate() - 1);
                      expectedStart = formatLocalDate(yesterday);
                      expectedEnd = formatLocalDate(yesterday);
                    } else {
                      // 일주일, 한달
                      const startDate = new Date(today);
                      startDate.setDate(startDate.getDate() - presetDays + 1);
                      expectedStart = formatLocalDate(startDate);
                      expectedEnd = formatLocalDate(today);
                    }

                    return currentValue.dateRange.start === expectedStart && currentValue.dateRange.end === expectedEnd;
                  };

                  return (
                    <div key={filter.columnKey} style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', gridColumn: 'span 2' }}>
                      {/* 기간 프리셋 버튼 */}
                      <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexShrink: 0 }}>
                        {[
                          { label: '오늘', days: 0 },
                          { label: '어제', days: 1 },
                          { label: '일주일', days: 7 },
                          { label: '한달', days: 30 },
                        ].map((preset) => (
                          <Button
                            key={preset.label}
                            type="button"
                            variant="outline"
                            size="md"
                            selected={isPresetSelected(preset.days)}
                            onClick={() => {
                              // 이미 선택된 프리셋을 다시 클릭하면 선택 해제
                              if (isPresetSelected(preset.days)) {
                                handleFilterValueChange(filter.columnKey, {
                                  ...currentValue,
                                  dateRange: { start: '', end: '' },
                                });
                                return;
                              }

                              const today = new Date();
                              let startDate: Date;
                              let endDate: Date;

                              if (preset.days === 0) {
                                // 오늘
                                startDate = today;
                                endDate = today;
                              } else if (preset.days === 1) {
                                // 어제
                                const yesterday = new Date(today);
                                yesterday.setDate(yesterday.getDate() - 1);
                                startDate = yesterday;
                                endDate = yesterday;
                              } else {
                                // 일주일, 한달
                                const start = new Date(today);
                                start.setDate(start.getDate() - preset.days + 1);
                                startDate = start;
                                endDate = today;
                              }

                              handleFilterValueChange(filter.columnKey, {
                                ...currentValue,
                                dateRange: {
                                  start: formatLocalDate(startDate),
                                  end: formatLocalDate(endDate),
                                },
                              });
                            }}
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                      {/* 날짜 선택 */}
                      <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center', flex: 1, minWidth: 'var(--width-daterange-container)' }}>
                        <div style={{ flex: 1, minWidth: 'var(--width-datepicker-input)' }}>
                          <DatePicker
                            value={currentValue.dateRange?.start || ''}
                            onChange={(val) =>
                              handleFilterValueChange(filter.columnKey, {
                                ...currentValue,
                                dateRange: { ...currentValue.dateRange, start: val },
                              })
                            }
                            label="시작일"
                            fullWidth
                            size="md"
                            showInlineLabelWhenHasValue={false}
                          />
                        </div>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>~</span>
                        <div style={{ flex: 1, minWidth: 'var(--width-datepicker-input)' }}>
                          <DatePicker
                            value={currentValue.dateRange?.end || ''}
                            onChange={(val) =>
                              handleFilterValueChange(filter.columnKey, {
                                ...currentValue,
                                dateRange: { ...currentValue.dateRange, end: val },
                              })
                            }
                            label="종료일"
                            fullWidth
                            size="md"
                            showInlineLabelWhenHasValue={false}
                          />
                        </div>
                      </div>
                    </div>
                  );

                default:
                  return null;
              }
            })}
        </Grid>
      </div>
    );
  }, [filters, filterState, columns, handleFilterValueChange]);

  // 페이지당 항목 수 변경 핸들러
  const handleItemsPerPageChange = useCallback((value: string | string[]) => {
    const valueStr = Array.isArray(value) ? value[0] : value;
    const newValue = Number(valueStr);
    setInternalItemsPerPage(newValue);
    onItemsPerPageChange?.(newValue);
  }, [onItemsPerPageChange]);

  // 필터 토글 버튼 및 페이지당 항목 수 선택 렌더링
  const renderFilterControls = useCallback(() => {
    // hideFilterControls가 true이면 아무것도 렌더링하지 않음
    if (hideFilterControls) {
      return null;
    }

    const hasFilters = filters && filters.length > 0;
    // 항상 검색창과 itemsPerPage 선택기 표시 (내부 상태 관리)
    const showItemsPerPage = true;
    const showSearch = true; // 검색창 항상 표시

    if (!hasFilters && !showItemsPerPage && !showSearch) {
      return null;
    }

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 'var(--spacing-sm)',
        }}
      >
        {/* 검색 입력창 (항상 표시) */}
        <SearchInput
          value={effectiveSearchValue}
          onChange={handleSearchChange}
          placeholder={searchPlaceholder}
          size="md"
        />

        {/* 필터 버튼 */}
        {hasFilters && (
          <Button
            ref={filterToggleRef}
            type="button"
            onClick={() => setShowFilterPanel((prev) => !prev)}
            variant="outline"
            size="md"
            selected={showFilterPanel || activeFilterCount > 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
            }}
          >
            <Funnel size={16} weight={showFilterPanel || activeFilterCount > 0 ? 'fill' : 'regular'} />
            필터
            {activeFilterCount > 0 && (
              <span
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-white)',
                  borderRadius: 'var(--border-radius-full)',
                  padding: '0 var(--spacing-xs)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-medium)',
                  minWidth: 'var(--spacing-md)', // 16px - 배지 최소 너비
                  textAlign: 'center',
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </Button>
        )}

        {/* 페이지당 항목 수 선택 (항상 표시) */}
        {showItemsPerPage && (
          <Select
            value={String(effectiveItemsPerPage)}
            onChange={handleItemsPerPageChange}
            dropdownAlign="center"
            options={itemsPerPageOptions.map((option) => ({
              value: String(option),
              label: `${option}개`,
            }))}
            size="md"
            autoDropdownWidth={true}
            dropdownMinWidth={80}
            style={{
              minWidth: 'var(--width-items-per-page)',
            }}
          />
        )}
      </div>
    );
  }, [hideFilterControls, filters, showFilterPanel, activeFilterCount, effectiveItemsPerPage, handleItemsPerPageChange, itemsPerPageOptions]);

  // 모바일: 1열 세로 배치 테이블 구조 (테이블 구조 유지)
  if (isMobile) {
    return (
      <div className={clsx(className)} style={{ width: '100%' }}>
        {/* 필터 및 페이지당 항목 수 선택 (모바일) - hideFilterControls가 true면 렌더링하지 않음 */}
        {!hideFilterControls && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 'var(--spacing-md)',
            }}
          >
            {renderFilterControls()}
          </div>
        )}

        {/* 필터 패널 (모바일) */}
        {showFilterPanel && renderFilterPanel()}

        {/* 빈 상태 */}
        {paginatedData.length === 0 ? (
          <div
            style={{
              padding: 'var(--spacing-3xl)',
              backgroundColor: 'var(--color-white)',
              border: 'var(--border-width-thin) solid var(--color-text)',
            }}
          >
            <EmptyState icon={emptyIcon || Database} message={emptyMessage} />
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}
          >
            {paginatedData.map((row, index) => {
          const key = keyExtractor ? keyExtractor(row) : index;
          const isExpanded = expandedRows.has(key);
          const visibleColumns = isExpanded ? columns : columns.slice(0, 2);
          const hasMoreColumns = columns.length > 2;
          const isLastRow = index === paginatedData.length - 1;

          const handleRowClick = () => {
            if (hasMoreColumns) {
              setExpandedRows((prev) => {
                const newSet = new Set(prev);
                if (newSet.has(key)) {
                  newSet.delete(key);
                } else {
                  newSet.add(key);
                }
                return newSet;
              });
            }
            if (onRowClick) {
              onRowClick(row);
            }
          };

          return (
            <div
              key={key}
              onClick={handleRowClick}
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--color-white)',
                borderTop: index === 0 ? 'var(--border-width-thin) solid var(--color-text)' : 'none',
                borderBottom: isLastRow ? 'none' : 'var(--border-width-thin) solid var(--color-text)', // 마지막 행은 하단 구분선 제거
                borderLeft: 'none',
                borderRight: 'none',
                cursor: hasMoreColumns || onRowClick ? 'pointer' : 'default',
              }}
            >
              {/* 모바일 행 데이터: 각 컬럼을 세로로 배치 (테이블 구조 유지) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0,
                }}
              >
                {visibleColumns.map((column, colIndex) => {
                  const value = (row as Record<string, unknown>)[column.key];

                  return (
                    <div
                      key={column.key}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0,
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'var(--width-table-mobile-label) auto 1fr',
                          gap: 'var(--spacing-sm)',
                          padding: 'var(--spacing-md) var(--spacing-md)',
                          paddingTop: colIndex > 0 ? 'var(--spacing-sm)' : 'var(--spacing-md)',
                          paddingBottom: colIndex < visibleColumns.length - 1 ? 'var(--spacing-sm)' : 'var(--spacing-md)',
                          alignItems: 'center',
                          position: 'relative',
                        }}
                      >
                        {/* 컬럼 헤더 (1열) */}
                        <div
                          style={{
                            fontWeight: 'var(--font-weight-normal)', // styles.css 준수: 노말 웨이트 적용
                            fontSize: 'var(--font-size-base)',
                            color: 'var(--color-text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: 'var(--letter-spacing-table-header)',
                            userSelect: 'none',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {column.label}
                        </div>
                        {/* 열간 구분선 (세로 높이 행 높이의 60%, 고정 위치) */}
                        <div
                          style={{
                            width: 'var(--border-width-thin)',
                            height: '60%',
                            backgroundColor: 'var(--color-table-row-border)',
                            alignSelf: 'center',
                            flexShrink: 0,
                          }}
                        />
                        {/* 컬럼 값 (2열) */}
                        <div
                          style={{
                            color: 'var(--color-text)',
                            fontSize: 'var(--font-size-base)',
                            textAlign: column.align || 'left',
                            lineHeight: 'var(--line-height-tight)',
                            fontWeight: column.key === 'name' ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)', // styles.css 준수: 이름 열만 볼드 처리
                          }}
                        >
                          {column.render ? column.render(value, row) : String(value ?? '')}
                        </div>
                      </div>
                      {/* 행간 테두리 (항목명의 좌우 여백과 동일하게 적용) */}
                      {colIndex < visibleColumns.length - 1 && (
                        <div
                          style={{
                            width: 'calc(100% - var(--spacing-md) * 2)', // 좌우 여백을 제외한 너비
                            height: 0,
                            marginLeft: 'var(--spacing-md)', // 항목명의 좌측 여백과 동일
                            marginRight: 'var(--spacing-md)', // 항목명의 우측 여백과 동일
                            borderBottom: 'var(--border-width-thin) solid var(--color-table-row-border)',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={clsx(className)} style={{ width: '100%' }}>
      {/* 필터 및 페이지당 항목 수 선택 - hideFilterControls가 true면 렌더링하지 않음 */}
      {!hideFilterControls && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 'var(--spacing-md)',
          }}
        >
          {renderFilterControls()}
        </div>
      )}

      {/* 필터 패널 */}
      {showFilterPanel && renderFilterPanel()}

      {/* 테이블 */}
      <div
        style={{
          width: '100%',
          overflowX: 'auto',
          borderTop: 'var(--border-width-thin) solid var(--color-text)', // 상단 테두리 (폰트 기본색)
          borderBottom: 'var(--border-width-thin) solid var(--color-text)', // 하단 테두리 (폰트 기본색)
          borderLeft: 'none', // 좌측 테두리 제거
          borderRight: 'none', // 우측 테두리 제거
          backgroundColor: 'var(--color-white)',
          overflow: 'hidden',
          borderRadius: 0, // 라운드 제거
        }}
      >
        <table
        style={{
          width: '100%',
          borderCollapse: 'collapse', // styles.css 준수: 행간 테두리 표시를 위해 collapse 사용
          borderSpacing: 0,
          minWidth: '100%',
        }}
      >
        {/* Header */}
        <thead
          style={{
            backgroundColor: 'transparent', // 헤더 배경 제거
            position: stickyHeader ? 'sticky' : 'static',
            top: 0,
            zIndex: 'var(--z-sticky-header)',
          }}
        >
          <tr>
            {columns.map((column, index) => {
              // 기본값: sortable이 명시되지 않으면 true로 간주 (모든 테이블에 정렬 기능 기본 활성화)
              const isSortable = column.sortable !== false;

              return (
                <th
                  key={column.key}
                  style={{
                    padding: 'var(--spacing-md) var(--spacing-md)',
                    textAlign: 'center', // 헤더 가운데 정렬
                    fontWeight: 'var(--font-weight-bold)', // 볼드 적용
                    fontSize: 'var(--font-size-base)', // 기본 폰트 사이즈 적용
                    color: 'var(--color-text)', // 기본 텍스트 색상
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--letter-spacing-table-header)', // 테이블 헤더 글자 간격 토큰 사용
                    borderBottom: 'var(--border-width-thin) solid var(--color-text)', // 헤더 하단 테두리 (폰트 기본색)
                    whiteSpace: 'nowrap',
                    width: column.width,
                    backgroundColor: 'rgba(0, 0, 0, 0.03)', // 그레이 30 (3% 투명도)
                    cursor: isSortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    ...(index === 0 && {
                      paddingLeft: 'var(--spacing-lg)',
                    }),
                    ...(index === columns.length - 1 && {
                      paddingRight: 'var(--spacing-lg)',
                    }),
                  }}
                  onClick={isSortable ? (e) => handleSortClick(e, column.key) : undefined}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-xs)',
                      justifyContent: 'center', // 헤더 가운데 정렬
                    }}
                  >
                    <span
                      style={{
                        color: sortColumn === column.key ? 'var(--color-primary)' : 'var(--color-text)',
                        transition: 'var(--transition-all)',
                      }}
                    >
                      {column.label}
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        marginLeft: 'var(--spacing-xs)',
                      }}
                    >
                      {column.filterable && (
                        <button
                          type="button"
                          onClick={(e) => handleFilterClick(e, column.key)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 'var(--spacing-xs)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--color-text)',
                            opacity: sortColumn === column.key ? 'var(--opacity-full)' : 'var(--opacity-secondary)',
                            transition: 'var(--transition-all)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = 'var(--opacity-full)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = sortColumn === column.key ? 'var(--opacity-full)' : 'var(--opacity-secondary)';
                          }}
                        >
                          <svg
                            viewBox="0 0 16 16"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{
                              width: 'var(--size-icon-md)',
                              height: 'var(--size-icon-md)',
                              color: sortColumn === column.key ? 'var(--color-primary)' : 'var(--color-text)',
                              transition: 'var(--transition-all)',
                            }}
                          >
                            <path
                              d="M2 4h12M4 8h8M6 12h4"
                              stroke="currentColor"
                              strokeWidth="var(--stroke-width-icon-bold)"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      )}
                      {isSortable && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'var(--transition-all)',
                          }}
                        >
                          {sortColumn === column.key && sortDirection === 'asc' ? (
                            <CaretUp
                              weight="fill"
                              style={{
                                width: 'var(--size-icon-md)',
                                height: 'var(--size-icon-md)',
                                color: 'var(--color-primary)',
                                opacity: 'var(--opacity-full)',
                                transition: 'var(--transition-all)',
                              }}
                            />
                          ) : (
                            <CaretDown
                              weight={sortColumn === column.key && sortDirection === 'desc' ? 'fill' : 'regular'}
                              style={{
                                width: 'var(--size-icon-md)',
                                height: 'var(--size-icon-md)',
                                color: sortColumn === column.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                opacity: sortColumn === column.key ? 'var(--opacity-full)' : 'var(--opacity-inactive)',
                                transition: 'var(--transition-all)',
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: 'var(--spacing-3xl)',
                }}
              >
                <EmptyState icon={emptyIcon || Database} message={emptyMessage} />
              </td>
            </tr>
          ) : (
            paginatedData.map((row, index) => {
              const key = keyExtractor ? keyExtractor(row) : index;
              const isLastRow = index === paginatedData.length - 1;
              return (
                <React.Fragment key={key}>
                  <tr
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    style={{
                      cursor: onRowClick ? 'pointer' : 'default',
                      transition: 'var(--transition-all)',
                      backgroundColor: 'var(--color-white)',
                    }}
                    onMouseEnter={(e) => {
                      if (onRowClick) {
                        e.currentTarget.style.backgroundColor = 'var(--color-primary-40)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-white)';
                    }}
                  >
                    {columns.map((column, colIndex) => {
                      const value = (row as Record<string, unknown>)[column.key];
                      return (
                        <td
                          key={column.key}
                          style={{
                            padding: 'var(--spacing-md) var(--spacing-md)', // styles.css 준수: 행 높이 최소화
                            textAlign: column.align || 'center',
                            color: 'var(--color-text)',
                            fontSize: 'var(--font-size-base)', // styles.css 준수: 기본 폰트 사이즈 적용
                            fontWeight: column.key === 'name' ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)', // styles.css 준수: 이름 열만 볼드 처리
                            borderBottom: 'none', // 행간 구분선은 별도 tr로 처리
                            ...(colIndex === 0 && {
                              paddingLeft: 'var(--spacing-lg)',
                            }),
                            ...(colIndex === columns.length - 1 && {
                              paddingRight: 'var(--spacing-lg)',
                            }),
                          }}
                        >
                          {column.render ? column.render(value, row) : String(value ?? '')}
                        </td>
                      );
                    })}
                  </tr>
                  {/* 행간 구분선 (좌우 여백 포함, 마지막 행 제외) */}
                  {!isLastRow && (
                    <tr>
                      <td
                        colSpan={columns.length}
                        style={{
                          padding: 0,
                          height: 0,
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: 0,
                            borderBottom: 'var(--border-width-thin) solid var(--color-table-row-border)',
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

