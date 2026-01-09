// LAYER: UI_CORE_COMPONENT
/**
 * ExecutionAuditPanel Component
 *
 * Execution Audit (Run/Step) System UI 패널
 * [SSOT 준수] 액티비티.md 문서 기준 엄격히 준수
 * [불변 규칙] Execution Audit UI는 채팅이 아니다 (타임라인/리스트 기반)
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다
 * [업종 중립] 모든 업종(Academy/Salon/Nail 등)에서 공통으로 사용 가능합니다 (AI_자동화_기능_정리.md 145-158줄 참조)
 * [업종 중립] 업종별 차이는 prop을 통한 확장 포인트로 처리됩니다
 *
 * 참고 문서:
 * - SSOT: docu/액티비티.md (Execution Audit 시스템)
 * - SSOT: docu/챗봇.md (AI 대화형 기능 제어 시스템)
 * - SSOT: docu/AI_자동화_기능_정리.md (Automation & AI Industry-Neutral Rule)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { Button } from './Button';
import { Badge } from './Badge';
import { Spinner } from './Spinner';
import { Input } from './Input';
import { EmptyState } from './EmptyState';
import { Clock } from 'lucide-react';
import { toKST } from '@lib/date-utils';

/**
 * Run 상태 (액티비티.md 5.1 참조)
 */
export type ExecutionAuditRunStatus = 'success' | 'failed' | 'partial';

/**
 * Step 상태 (액티비티.md 5.2 참조)
 */
export type ExecutionAuditStepStatus = 'success' | 'failed';

/**
 * Source (액티비티.md 6.1 참조)
 */
export type ExecutionAuditSource = 'ai' | 'automation' | 'scheduler' | 'manual' | 'webhook';

/**
 * Execution Audit 필터 인터페이스 (액티비티.md 10.1, 11.2 참조)
 */
export interface ExecutionAuditFilters {
  status?: ExecutionAuditRunStatus | 'all';
  source?: ExecutionAuditSource | 'all';
  operation_type?: string | 'all';
  showFailedOnly?: boolean;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  searchQuery?: string;
}

/**
 * Execution Audit Run 인터페이스 (액티비티.md 8.1 참조)
 */
export interface ExecutionAuditRun {
  id: string;
  tenant_id: string;
  occurred_at: Date;
  created_at?: Date;
  operation_type: string;
  status: ExecutionAuditRunStatus;
  source: ExecutionAuditSource;
  actor_type: 'user' | 'system' | 'external';
  actor_id?: string;
  summary: string;
  details?: Record<string, unknown>;
  reference: {
    request_id?: string;
    task_id?: string;
    automation_id?: string;
    job_id?: string;
    entity_type?: string;
    entity_id?: string;
    source_event_id?: string;
    diagnostic_id?: string;
    retry_of_run_id?: string;
  };
  counts?: {
    success: number;
    failed: number;
  };
  error_code?: string;
  error_summary?: string;
  duration_ms?: number;
  version?: string;
}

/**
 * Execution Audit Step 인터페이스 (액티비티.md 8.2 참조)
 */
export interface ExecutionAuditStep {
  id: string;
  tenant_id: string;
  run_id: string;
  occurred_at: Date;
  created_at?: Date;
  status: ExecutionAuditStepStatus;
  target_type: string;
  target_id: string;
  summary: string;
  details?: Record<string, unknown>;
  error_code?: string;
  error_summary?: string;
}

export interface ExecutionAuditPanelProps {
  runs: ExecutionAuditRun[];
  isLoading?: boolean;
  onLoadMore?: (cursor?: string) => void;
  onLoadSteps?: (runId: string, cursor?: string) => void;
  stepsByRunId?: Record<string, ExecutionAuditStep[]>;
  stepsLoading?: Record<string, boolean>;
  hasMore?: boolean;
  nextCursor?: string;
  onViewRun?: (runId: string) => void;
  onRowClick?: (run: ExecutionAuditRun) => void; // 행 클릭 핸들러
  onFilterChange?: (filters: ExecutionAuditFilters) => void;
  initialFilters?: ExecutionAuditFilters;
  availableOperationTypes?: string[];
  className?: string;
}

/**
 * ExecutionAuditPanel 컴포넌트
 *
 * Execution Audit UI 패널
 * 타임라인/리스트 기반으로 Run을 표시하고, 클릭 시 Step을 확장합니다.
 */
export const ExecutionAuditPanel: React.FC<ExecutionAuditPanelProps> = ({
  runs,
  isLoading = false,
  onLoadMore,
  onLoadSteps,
  stepsByRunId = {},
  stepsLoading = {},
  hasMore = false,
  nextCursor,
  onViewRun,
  onRowClick,
  onFilterChange,
  initialFilters,
  availableOperationTypes = [],
  className,
}) => {
  const [dateFrom, setDateFrom] = useState<Date | null>(initialFilters?.dateFrom || null);
  const [dateTo, setDateTo] = useState<Date | null>(initialFilters?.dateTo || null);
  const [searchQuery, setSearchQuery] = useState(initialFilters?.searchQuery || '');

  // initialFilters prop 변경 시 state 동기화
  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.dateFrom !== undefined) setDateFrom(initialFilters.dateFrom);
      if (initialFilters.dateTo !== undefined) setDateTo(initialFilters.dateTo);
      if (initialFilters.searchQuery !== undefined) setSearchQuery(initialFilters.searchQuery);
    }
  }, [initialFilters]);

  // 필터 변경 핸들러 (서버 필터링 지원)
  const handleFilterChange = useCallback((newFilters: Partial<ExecutionAuditFilters>) => {
    const updatedFilters: ExecutionAuditFilters = {
      dateFrom,
      dateTo,
      searchQuery,
      ...newFilters,
    };
    if (onFilterChange) {
      onFilterChange(updatedFilters);
    }
  }, [dateFrom, dateTo, searchQuery, onFilterChange]);

  // 필터링된 Runs
  // 서버 필터링이 활성화된 경우(onFilterChange가 있으면): runs prop이 이미 필터링된 데이터이므로 클라이언트 필터링 스킵
  // 클라이언트 필터링만 사용하는 경우(onFilterChange가 없으면): runs prop을 클라이언트에서 필터링
  const filteredRuns = onFilterChange
    ? runs // 서버 필터링 활성화: runs prop이 이미 필터링된 데이터
    : runs.filter((run) => {
        // 클라이언트 필터링: 로컬 state 기반 필터링
        if (dateFrom && run.occurred_at < dateFrom) return false;
        if (dateTo && run.occurred_at > dateTo) return false;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            run.summary.toLowerCase().includes(query) ||
            run.error_summary?.toLowerCase().includes(query) ||
            run.reference.request_id?.toLowerCase().includes(query) ||
            run.reference.task_id?.toLowerCase().includes(query) ||
            run.reference.entity_id?.toLowerCase().includes(query)
          );
        }
        return true;
      });

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--color-background)',
      }}
    >
      {/* 필터 영역 - 최소화 (액티비티.md 11.2 참조) */}
      <div
        style={{
          borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
          padding: 'var(--spacing-md) var(--spacing-xl)',
          backgroundColor: 'var(--color-white)',
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* 기간 필터만 표시 */}
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const todayKst = toKST().startOf('day').toDate();
                const tomorrowKst = toKST().add(1, 'day').startOf('day').toDate();
                setDateFrom(todayKst);
                setDateTo(tomorrowKst);
                handleFilterChange({ dateFrom: todayKst, dateTo: tomorrowKst });
              }}
              style={{ whiteSpace: 'nowrap' }}
            >
              오늘
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const todayKst = toKST().startOf('day');
                const dayOfWeek = todayKst.day();
                const startOfWeek = todayKst.subtract(dayOfWeek, 'day').toDate();
                const endOfWeek = todayKst.add(7 - dayOfWeek, 'day').startOf('day').toDate();
                setDateFrom(startOfWeek);
                setDateTo(endOfWeek);
                handleFilterChange({ dateFrom: startOfWeek, dateTo: endOfWeek });
              }}
              style={{ whiteSpace: 'nowrap' }}
            >
              이번주
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDateFrom(null);
                setDateTo(null);
                handleFilterChange({ dateFrom: null, dateTo: null });
              }}
              style={{ whiteSpace: 'nowrap' }}
            >
              전체
            </Button>
          </div>

          {/* 검색 */}
          <Input
            value={searchQuery}
            onChange={(e) => {
              const newQuery = e.target.value;
              setSearchQuery(newQuery);
              handleFilterChange({ searchQuery: newQuery });
            }}
            placeholder="검색"
            style={{ width: 'var(--width-student-info-min)' }}
            aria-label="검색 입력"
          />
        </div>
      </div>

      {/* Runs 목록 (타임라인/리스트 기반, 액티비티.md 11.2 참조) */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
        className="ui-core-hiddenScrollbar"
      >
        {isLoading && runs.length === 0 ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <Spinner size="md" />
          </div>
        ) : filteredRuns.length === 0 ? (
            <EmptyState icon={Clock} message="실행 기록이 없습니다." />
        ) : (
          <>
            {/* 리스트 아이템 */}
            {filteredRuns.map((run) => {
              const isClickable = onRowClick && run.reference.entity_type && run.reference.entity_id;

              // 카테고리 라벨 생성
              const getCategoryLabel = (source: ExecutionAuditSource): string => {
                switch (source) {
                  case 'ai':
                    return 'AI';
                  case 'automation':
                  case 'scheduler':
                    return '자동';
                  case 'manual':
                    return '수동';
                  case 'webhook':
                    return '웹훅';
                  default:
                    return source;
                }
              };

              // 카테고리 배지 색상 결정
              const getCategoryColor = (source: ExecutionAuditSource): 'primary' | 'success' | 'gray' | 'info' => {
                switch (source) {
                  case 'ai':
                    return 'primary';
                  case 'automation':
                  case 'scheduler':
                    return 'success';
                  case 'manual':
                    return 'gray';
                  case 'webhook':
                    return 'info';
                  default:
                    return 'gray';
                }
              };

              return (
                <div
                  key={run.id}
                  onClick={() => isClickable && onRowClick(run)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'var(--grid-col-narrow) var(--grid-col-medium) 1fr',
                    gap: 'var(--spacing-lg)',
                    padding: 'var(--spacing-md) var(--spacing-xl)',
                    alignItems: 'center',
                    position: 'relative',
                    borderBottom: 'var(--border-width-thin) solid var(--color-gray-100)',
                    backgroundColor: 'var(--color-white)',
                    transition: 'background-color 0.15s ease',
                    cursor: isClickable ? 'pointer' : 'default',
                  }}
                  onMouseEnter={(e) => {
                    if (isClickable) {
                      e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-white)';
                  }}
                >
                  {/* 카테고리 */}
                  <div>
                    <Badge variant="outline" color={getCategoryColor(run.source)}>
                      {getCategoryLabel(run.source)}
                    </Badge>
                  </div>

                  {/* 시간 */}
                  <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                    {toKST(run.occurred_at).format('MM/DD HH:mm')}
                  </div>

                  {/* 작업 내용 */}
                  <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text)' }}>
                    {run.summary}
                  </div>
                </div>
              );
            })}

            {/* 더 보기 버튼 (cursor 기반 페이징, 액티비티.md 10.1 참조) */}
            {hasMore && onLoadMore && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--spacing-md)' }}>
                <Button
                  variant="outline"
                  onClick={() => onLoadMore(nextCursor)}
                  disabled={isLoading}
                >
                  {isLoading ? '로딩 중...' : '더 보기'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
