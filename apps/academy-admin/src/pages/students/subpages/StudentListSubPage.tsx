/**
 * 학생 목록 SubPage
 *
 * [LAYER: UI_PAGE - SubPage]
 *
 * StudentsPage의 '학생 목록' 탭(list)을 담당하는 SubPage 컴포넌트
 * 통계 대시보드, 태그 필터, 학생 테이블을 포함
 */

import React from 'react';
import { Card, Button } from '@ui-core/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DataTableActionButtons, StatsTableLayout } from '../../../components';
import type { StatsItem, ChartDataItem, PeriodFilter } from '../../../components/stats';
import type { TableSchema, FilterSchema } from '@schema-engine';

export interface StudentListSubPageProps {
  // 로딩/에러 상태
  isLoading: boolean;
  error: Error | null;

  // 통계 데이터
  statsItems: StatsItem[];
  chartData: ChartDataItem[];
  statsPeriod: PeriodFilter;
  onStatsPeriodChange: (period: PeriodFilter) => void;
  selectedStatsKey: string;
  onStatsCardClick: (key: string) => void;

  // 테이블 데이터
  effectiveTableSchema?: TableSchema;
  students: Record<string, unknown>[];
  totalCount: number;
  tablePage: number;
  onTablePageChange: (page: number) => void;
  tableFilters: Record<string, unknown>;
  actionContext: { navigate: (path: string) => void };
  onRowClick: (row: Record<string, unknown>) => void;

  // 필터
  effectiveFilterSchema?: FilterSchema;
  onFilterChange: (filters: Record<string, unknown>) => void;
  filterDefaultValues: {
    search: string;
    status: string | string[];
    grade: string;
    class_id: string;
  };

  // 태그 필터
  tags: { id: string; name: string; color: string }[] | null | undefined;
  filter: { tag_ids?: string[] };
  onTagFilter: (tagId: string) => void;
  isTagListExpanded: boolean;
  showTagListToggle: boolean;
  tagListCollapsedHeight: number | null;
  tagListRef: React.RefObject<HTMLDivElement>;
  onTagListExpandToggle: (expanded: boolean) => void;

  // 액션
  onCreateClick: () => void;
  onUploadClick: () => void;
  onDownload: () => void;
  onDownloadTemplate: () => void;
  uploadDisabled: boolean;

  // UI 설정
  iconSize: number;
  iconStrokeWidth: number;
  currentSubMenuLabel: string;

  // 업종 중립 라벨
  terms: {
    PERSON_LABEL_PRIMARY: string;
    TAG_LABEL: string;
    MESSAGES: {
      LOADING: string;
      ERROR: string;
      SAVE_ERROR: string;
    };
  };
}

export function StudentListSubPage({
  isLoading,
  error,
  statsItems,
  chartData,
  statsPeriod,
  onStatsPeriodChange,
  selectedStatsKey,
  onStatsCardClick,
  effectiveTableSchema,
  students,
  totalCount,
  tablePage,
  onTablePageChange,
  tableFilters,
  actionContext,
  onRowClick,
  effectiveFilterSchema,
  onFilterChange,
  filterDefaultValues,
  tags,
  filter,
  onTagFilter,
  isTagListExpanded,
  showTagListToggle,
  tagListCollapsedHeight,
  tagListRef,
  onTagListExpandToggle,
  onCreateClick,
  onUploadClick,
  onDownload,
  onDownloadTemplate,
  uploadDisabled,
  iconSize,
  iconStrokeWidth,
  currentSubMenuLabel,
  terms,
}: StudentListSubPageProps) {
  return (
    <>
      {/* 로딩 상태 */}
      {isLoading && (
        <Card padding="lg" variant="default">
          <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            {terms.PERSON_LABEL_PRIMARY} 목록 {terms.MESSAGES.LOADING}
          </div>
        </Card>
      )}

      {/* 에러 상태 (로딩 완료 후에만 표시) */}
      {!isLoading && error && (
        <Card padding="md" variant="outlined">
          <div style={{ color: 'var(--color-error)' }}>
            {terms.MESSAGES.ERROR}: {error instanceof Error ? error.message : `${terms.PERSON_LABEL_PRIMARY} 목록 불러오기 ${terms.MESSAGES.SAVE_ERROR}`}
          </div>
        </Card>
      )}

      {/* 학생 목록 (로딩 완료 후, 에러 없을 때만 표시) */}
      {!isLoading && !error && effectiveTableSchema && (
        <StatsTableLayout
          title={currentSubMenuLabel}
          entityName={`${terms.PERSON_LABEL_PRIMARY}목록`}
          statsItems={statsItems}
          chartData={chartData}
          period={statsPeriod}
          onPeriodChange={onStatsPeriodChange}
          selectedStatsKey={selectedStatsKey}
          onStatsCardClick={onStatsCardClick}
          chartTooltipUnit="명"
          chartTooltipLabel={`총 ${terms.PERSON_LABEL_PRIMARY}수`}
          tableSchema={effectiveTableSchema}
          tableData={students}
          totalCount={totalCount}
          page={tablePage}
          onPageChange={onTablePageChange}
          filters={tableFilters}
          actionContext={actionContext}
          onRowClick={onRowClick}
          filterSchema={effectiveFilterSchema}
          onFilterChange={onFilterChange}
          filterDefaultValues={filterDefaultValues}
          customActions={
            <DataTableActionButtons
              align="right"
              onCreate={onCreateClick}
              onUpload={onUploadClick}
              onDownload={onDownload}
              onDownloadTemplate={onDownloadTemplate}
              uploadDisabled={uploadDisabled}
              createTooltip={`${terms.PERSON_LABEL_PRIMARY}등록`}
            />
          }
          iconSize={iconSize}
          iconStrokeWidth={iconStrokeWidth}
          sectionOrderKey="students-section-order-list"
          showTitle={true}
          beforeTable={
            tags && tags.length > 0 ? (
              <div style={{ position: 'relative', marginBottom: 'var(--spacing-md)' }}>
                <div
                  ref={tagListRef}
                  style={{
                    display: 'flex',
                    gap: 'var(--spacing-xs)',
                    flexWrap: 'wrap',
                    paddingRight: showTagListToggle
                      ? 'calc(var(--spacing-sm) + var(--size-icon-base) + var(--spacing-xs))'
                      : undefined,
                    maxHeight: !isTagListExpanded && tagListCollapsedHeight ? `${tagListCollapsedHeight}px` : undefined,
                    overflow: !isTagListExpanded && showTagListToggle ? 'hidden' : undefined,
                    transition: 'max-height var(--transition-fast)',
                  }}
                >
                  {/* 태그 라벨 배지 */}
                  <div
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-bold)',
                      fontFamily: 'var(--font-family)',
                      lineHeight: 'var(--line-height)',
                      borderRadius: 'var(--border-radius-xs)',
                      border: 'var(--border-width-thin) solid var(--color-text)',
                      color: 'var(--color-white)',
                      backgroundColor: 'var(--color-text)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {terms.TAG_LABEL}
                  </div>
                  {tags.map((tag) => (
                    <Button
                      key={tag.id}
                      variant={filter.tag_ids?.includes(tag.id) ? 'solid' : 'outline'}
                      size="sm"
                      onClick={() => onTagFilter(tag.id)}
                      style={{
                        fontSize: 'calc(var(--font-size-sm) - var(--spacing-xxs))',
                        backgroundColor: filter.tag_ids?.includes(tag.id) ? tag.color : 'var(--color-white)',
                        color: filter.tag_ids?.includes(tag.id) ? 'var(--color-white)' : undefined,
                      }}
                    >
                      {tag.name}
                    </Button>
                  ))}
                </div>

                {/* 태그 목록 펼치기/접기 버튼 */}
                {showTagListToggle && (
                  <button
                    type="button"
                    aria-label={isTagListExpanded ? `${terms.TAG_LABEL} 목록 접기` : `${terms.TAG_LABEL} 목록 펼치기`}
                    onClick={() => onTagListExpandToggle(!isTagListExpanded)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      height: tagListCollapsedHeight ? `${tagListCollapsedHeight}px` : 'var(--size-pagination-button)',
                      width: 'calc(var(--spacing-sm) + var(--size-icon-base) + var(--spacing-xs))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {isTagListExpanded
                      ? <ChevronUp size={iconSize} strokeWidth={iconStrokeWidth} />
                      : <ChevronDown size={iconSize} strokeWidth={iconStrokeWidth} />}
                  </button>
                )}
              </div>
            ) : undefined
          }
        />
      )}
    </>
  );
}
