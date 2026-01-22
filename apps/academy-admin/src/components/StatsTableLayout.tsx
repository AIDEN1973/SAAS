/**
 * StatsTableLayout Component
 *
 * [불변 규칙] 통계 대시보드 + 테이블 레이아웃 공통 컴포넌트
 * [불변 규칙] SSOT 준수, CSS 변수 사용, 업종 중립
 *
 * 사용처:
 * - 학생 목록 탭
 * - 상담관리 탭
 * - 태그 관리 탭 (향후)
 */

import React, { useState, useCallback } from 'react';
import { PageHeader, Tooltip } from '@ui-core/react';
import { ArrowUpDown } from 'lucide-react';
import { StatsDashboard } from './stats';
import type { StatsItem, ChartDataItem, PeriodFilter } from './stats';
import { SchemaTable, type TableSchema, type FilterSchema, type ActionContext } from '@schema-engine';

export interface StatsTableLayoutProps {
  /** 페이지 타이틀 (서브사이드바 메뉴명, 예: '상담관리', '학생관리') */
  title?: string;

  /** 엔티티 이름 (테이블 섹션 이름, 예: '학생목록', '상담목록', '태그') */
  entityName: string;

  /** 통계 카드 데이터 */
  statsItems: StatsItem[];

  /** 차트 데이터 */
  chartData: ChartDataItem[];

  /** 기간 필터 값 */
  period: PeriodFilter;

  /** 기간 필터 변경 핸들러 */
  onPeriodChange: (period: PeriodFilter) => void;

  /** 선택된 통계 카드 key */
  selectedStatsKey?: string;

  /** 통계 카드 클릭 핸들러 */
  onStatsCardClick?: (key: string) => void;

  /** 차트 툴팁 단위 (기본값: '명') */
  chartTooltipUnit?: string;

  /** 차트 툴팁 레이블 (기본값: '총 학생수') */
  chartTooltipLabel?: string;

  /** 테이블 스키마 (tableContent가 없을 때 필수) */
  tableSchema?: TableSchema;

  /** 테이블 데이터 (tableContent가 없을 때 필수) */
  tableData?: Record<string, unknown>[];

  /** 테이블 총 개수 (tableContent가 없을 때 필수) */
  totalCount?: number;

  /** 테이블 페이지 (tableContent가 없을 때 필수) */
  page?: number;

  /** 테이블 페이지 변경 핸들러 (tableContent가 없을 때 필수) */
  onPageChange?: (page: number) => void;

  /** 테이블 필터 */
  filters?: Record<string, unknown>;

  /** 액션 컨텍스트 */
  actionContext?: ActionContext;

  /** 테이블 행 클릭 핸들러 */
  onRowClick?: (row: Record<string, unknown>) => void;

  /** 필터 스키마 */
  filterSchema?: FilterSchema;

  /** 필터 변경 핸들러 */
  onFilterChange?: (filters: Record<string, unknown>) => void;

  /** 필터 기본값 */
  filterDefaultValues?: Record<string, unknown>;

  /** 커스텀 액션 버튼 */
  customActions?: React.ReactNode;

  /** 아이콘 크기 */
  iconSize?: number;

  /** 아이콘 stroke width */
  iconStrokeWidth?: number;

  /** 섹션 순서 localStorage 키 */
  sectionOrderKey: string;

  /** 테이블 앞에 표시할 컨텐츠 (예: 태그 필터) */
  beforeTable?: React.ReactNode;

  /** 타이틀 표시 여부 (기본값: true) - false면 타이틀과 토글 버튼 숨김 */
  showTitle?: boolean;

  /** 통계 대시보드 숨김 여부 (기본값: false) - true면 통계 카드와 차트 영역 숨김, 테이블만 표시 */
  hideStats?: boolean;

  /** 테이블 대신 표시할 커스텀 컨텐츠 (예: 준비 중 메시지) */
  tableContent?: React.ReactNode;
}

/**
 * StatsTableLayout 컴포넌트
 *
 * 통계 대시보드와 테이블을 포함하는 공통 레이아웃
 * 섹션 순서 변경 기능 포함
 */
export function StatsTableLayout({
  title,
  entityName,
  statsItems,
  chartData,
  period,
  onPeriodChange,
  selectedStatsKey,
  onStatsCardClick,
  chartTooltipUnit = '명',
  chartTooltipLabel = '총 학생수',
  tableSchema,
  tableData,
  totalCount,
  page,
  onPageChange,
  filters,
  actionContext,
  onRowClick,
  filterSchema,
  onFilterChange,
  filterDefaultValues,
  customActions,
  iconSize = 16,
  iconStrokeWidth = 1.5,
  sectionOrderKey,
  beforeTable,
  showTitle = true,
  hideStats = false,
  tableContent,
}: StatsTableLayoutProps) {
  // 섹션 순서 상태 (localStorage에 저장)
  const [sectionOrder, setSectionOrder] = useState<'stats-first' | 'table-first'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(sectionOrderKey);
      if (saved === 'table-first') return 'table-first';
    }
    return 'stats-first';
  });

  // 애니메이션 상태
  const [isAnimating, setIsAnimating] = useState(false);

  // 한국어 조사 처리 함수 (받침 여부에 따라 '이/가' 선택)
  const getParticle = useCallback((word: string) => {
    const lastChar = word.charAt(word.length - 1);
    const lastCharCode = lastChar.charCodeAt(0);
    // 한글 유니코드 범위 체크 (가-힣: 0xAC00-0xD7A3)
    if (lastCharCode >= 0xAC00 && lastCharCode <= 0xD7A3) {
      // 받침 있으면 '이', 없으면 '가'
      return (lastCharCode - 0xAC00) % 28 > 0 ? '이' : '가';
    }
    // 한글이 아니면 '가' 사용
    return '가';
  }, []);

  // 섹션 순서 토글 핸들러
  const handleToggleSectionOrder = useCallback(() => {
    // 페이드 아웃 시작
    setIsAnimating(true);

    // 페이드 아웃 완료 후 상태 변경
    setTimeout(() => {
      setSectionOrder((prev) => {
        const next = prev === 'stats-first' ? 'table-first' : 'stats-first';
        if (typeof window !== 'undefined') {
          localStorage.setItem(sectionOrderKey, next);
        }
        return next;
      });

      // 페이드 인 시작
      setTimeout(() => {
        setIsAnimating(false);
      }, 50);
    }, 200);
  }, [sectionOrderKey]);

  return (
    <>
      {/* 타이틀과 섹션 순서 토글 버튼 */}
      {showTitle && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          marginBottom: 'var(--spacing-xl)',
        }}>
          <PageHeader
            title={title || entityName}
            style={{ marginBottom: 0 }}
          />
          {/* hideStats가 false이고 statsItems가 있을 때만 토글 버튼 표시 */}
          {!hideStats && statsItems.length > 0 && (
            <Tooltip
              content={
                sectionOrder === 'stats-first'
                  ? `${entityName}${getParticle(entityName)} 위로`
                  : `${entityName}${getParticle(entityName)} 아래로`
              }
              position="top"
            >
              <button
                type="button"
                onClick={handleToggleSectionOrder}
                aria-label={sectionOrder === 'stats-first' ? '테이블을 위로 이동' : '통계를 위로 이동'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--spacing-xs)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  borderRadius: 'var(--border-radius-sm)',
                  transition: 'color var(--transition-fast), background-color var(--transition-fast)',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text)';
                  e.currentTarget.style.backgroundColor = 'var(--color-primary-40)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <ArrowUpDown size={iconSize} strokeWidth={iconStrokeWidth} />
              </button>
            </Tooltip>
          )}
        </div>
      )}

      {/* 애니메이션 컨테이너 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        opacity: isAnimating ? 0 : 1,
        transition: 'opacity 0.2s ease-in-out',
        contain: 'layout style',
      }}>
        {/* 통계 대시보드 - 순서에 따라 위치 변경 (hideStats가 false일 때만 표시) */}
        {!hideStats && sectionOrder === 'stats-first' && statsItems.length > 0 && (
          <div style={{ marginBottom: 'calc(var(--spacing-xl) * 2)', contain: 'layout style' }}>
            <StatsDashboard
              statsItems={statsItems}
              chartData={chartData}
              period={period}
              onPeriodChange={onPeriodChange}
              selectedStatsKey={selectedStatsKey}
              onStatsCardClick={onStatsCardClick}
              chartTooltipUnit={chartTooltipUnit}
              chartTooltipLabel={chartTooltipLabel}
            />
          </div>
        )}

        {/* 테이블 섹션 또는 커스텀 컨텐츠 */}
        <div>
          {/* 테이블 앞에 표시할 컨텐츠 (예: 태그 필터) */}
          {beforeTable}

          {/* tableContent가 있으면 커스텀 컨텐츠, 없으면 SchemaTable 표시 */}
          {tableContent ? (
            tableContent
          ) : tableSchema ? (
            <SchemaTable
              schema={tableSchema}
              data={tableData ?? []}
              totalCount={totalCount ?? 0}
              page={page ?? 1}
              onPageChange={onPageChange ?? (() => {})}
              filters={filters}
              actionContext={actionContext}
              onRowClick={onRowClick}
              filterSchema={filterSchema}
              onFilterChange={onFilterChange}
              filterDefaultValues={filterDefaultValues}
              customActions={customActions}
            />
          ) : null}
        </div>

        {/* table-first일 때 통계 대시보드를 아래에 표시 (hideStats가 false일 때만) */}
        {!hideStats && sectionOrder === 'table-first' && statsItems.length > 0 && (
          <div style={{ marginTop: 'calc(var(--spacing-xl) * 2)', contain: 'layout style' }}>
            <StatsDashboard
              statsItems={statsItems}
              chartData={chartData}
              period={period}
              onPeriodChange={onPeriodChange}
              selectedStatsKey={selectedStatsKey}
              onStatsCardClick={onStatsCardClick}
              chartTooltipUnit={chartTooltipUnit}
              chartTooltipLabel={chartTooltipLabel}
            />
          </div>
        )}
      </div>
    </>
  );
}
