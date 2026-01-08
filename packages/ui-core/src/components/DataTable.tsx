/**
 * DataTable Component
 *
 * [불변 규칙] 모든 환경에서 테이블 구조를 유지하며 표시
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모바일(xs, sm): 1열 세로 배치, 데스크톱(lg, xl): 가로 테이블
 */

import React, { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { CaretUp, CaretDown } from 'phosphor-react';
import { useResponsiveMode } from '../hooks/useResponsiveMode';

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
export function DataTable<T = unknown>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = '데이터가 없습니다.',
  className,
  stickyHeader = true,
  pagination,
  itemsPerPage = 10,
}: DataTableProps<T>) {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  // React Hooks 규칙 준수: 모든 Hook은 조건부 return 이전에 호출되어야 함
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  // 모바일: 행 펼침 상태 관리 (각 행의 키를 키로 사용)
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());

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
    // 필터 아이콘 클릭 시 정렬 기능 동작
    handleSortClick(e, columnKey);
  };

  // 정렬된 데이터 계산
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return data;
    }

    const column = columns.find((col) => col.key === sortColumn);
    if (!column) {
      return data;
    }

    return [...data].sort((a, b) => {
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
  }, [data, sortColumn, sortDirection, columns]);

  // 페이지네이션 적용된 데이터 계산
  const paginatedData = useMemo(() => {
    if (!pagination) {
      return sortedData;
    }

    const startIndex = (pagination.currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, pagination, itemsPerPage]);

  // 모바일: 1열 세로 배치 테이블 구조 (테이블 구조 유지)
  if (isMobile) {
    if (paginatedData.length === 0) {
      return (
        <div
          className={clsx(className)}
          style={{
            padding: 'var(--spacing-3xl)',
            textAlign: 'center',
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-base)',
            backgroundColor: 'var(--color-white)',
            border: 'var(--border-width-thin) solid var(--color-text)',
          }}
        >
          {emptyMessage}
        </div>
      );
    }

    return (
      <div
        className={clsx(className)}
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
    );
  }

  return (
    <div
      className={clsx(className)}
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
                    backgroundColor: 'transparent', // 배경 제거
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
                  textAlign: 'center',
                  color: 'var(--color-text-tertiary)',
                  fontSize: 'var(--font-size-base)', // styles.css 준수: 기본 폰트 사이즈 적용
                }}
              >
                {emptyMessage}
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
  );
}

