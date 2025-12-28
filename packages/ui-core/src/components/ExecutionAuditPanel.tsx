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
import { Card } from './Card';
import { Badge } from './Badge';
import { Spinner } from './Spinner';
import { Select } from './Select';
import { DatePicker } from './DatePicker';
import { Input } from './Input';
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
  onFilterChange,
  initialFilters,
  availableOperationTypes = [],
  className,
}) => {
  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<ExecutionAuditRunStatus | 'all'>(initialFilters?.status || 'all');
  const [filterSource, setFilterSource] = useState<ExecutionAuditSource | 'all'>(initialFilters?.source || 'all');
  const [filterOperationType, setFilterOperationType] = useState<string | 'all'>(initialFilters?.operation_type || 'all');
  const [showFailedOnly, setShowFailedOnly] = useState(initialFilters?.showFailedOnly || false);
  const [dateFrom, setDateFrom] = useState<Date | null>(initialFilters?.dateFrom || null);
  const [dateTo, setDateTo] = useState<Date | null>(initialFilters?.dateTo || null);
  const [searchQuery, setSearchQuery] = useState(initialFilters?.searchQuery || '');

  // initialFilters prop 변경 시 state 동기화
  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.status !== undefined) setFilterStatus(initialFilters.status);
      if (initialFilters.source !== undefined) setFilterSource(initialFilters.source);
      if (initialFilters.operation_type !== undefined) setFilterOperationType(initialFilters.operation_type);
      if (initialFilters.showFailedOnly !== undefined) setShowFailedOnly(initialFilters.showFailedOnly);
      if (initialFilters.dateFrom !== undefined) setDateFrom(initialFilters.dateFrom);
      if (initialFilters.dateTo !== undefined) setDateTo(initialFilters.dateTo);
      if (initialFilters.searchQuery !== undefined) setSearchQuery(initialFilters.searchQuery);
    }
  }, [initialFilters]);

  // 필터 변경 핸들러 (서버 필터링 지원)
  const handleFilterChange = useCallback((newFilters: Partial<ExecutionAuditFilters>) => {
    const updatedFilters: ExecutionAuditFilters = {
      status: filterStatus,
      source: filterSource,
      operation_type: filterOperationType,
      showFailedOnly,
      dateFrom,
      dateTo,
      searchQuery,
      ...newFilters,
    };
    if (onFilterChange) {
      onFilterChange(updatedFilters);
    }
  }, [filterStatus, filterSource, filterOperationType, showFailedOnly, dateFrom, dateTo, searchQuery, onFilterChange]);

  // 필터링된 Runs
  // 서버 필터링이 활성화된 경우(onFilterChange가 있으면): runs prop이 이미 필터링된 데이터이므로 클라이언트 필터링 스킵
  // 클라이언트 필터링만 사용하는 경우(onFilterChange가 없으면): runs prop을 클라이언트에서 필터링
  const filteredRuns = onFilterChange
    ? runs // 서버 필터링 활성화: runs prop이 이미 필터링된 데이터
    : runs.filter((run) => {
        // 클라이언트 필터링: 로컬 state 기반 필터링
        if (filterStatus !== 'all' && run.status !== filterStatus) return false;
        if (filterSource !== 'all' && run.source !== filterSource) return false;
        if (filterOperationType !== 'all' && run.operation_type !== filterOperationType) return false;
        if (showFailedOnly && run.status !== 'failed') return false;
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

  const handleToggleExpand = (runId: string) => {
    const newExpanded = new Set(expandedRunIds);
    if (newExpanded.has(runId)) {
      newExpanded.delete(runId);
    } else {
      newExpanded.add(runId);
      // Step 로드 (지연 로딩, 액티비티.md 4.2 참조)
      if (onLoadSteps && !stepsByRunId[runId]) {
        onLoadSteps(runId);
      }
    }
    setExpandedRunIds(newExpanded);
  };

  const getStatusBadge = (status: ExecutionAuditRunStatus) => {
    const colorMap: Record<ExecutionAuditRunStatus, 'success' | 'error' | 'warning'> = {
      success: 'success',
      failed: 'error',
      partial: 'warning',
    };
    return (
      <Badge variant="outline" color={colorMap[status]}>
        {status === 'success' ? '성공' : status === 'failed' ? '실패' : '부분 성공'}
      </Badge>
    );
  };

  const getSourceLabel = (source: ExecutionAuditSource) => {
    const labelMap: Record<ExecutionAuditSource, string> = {
      ai: 'AI',
      automation: '자동화',
      scheduler: '스케줄러',
      manual: '수동',
      webhook: '웹훅',
    };
    return labelMap[source];
  };

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
      {/* 필터 영역 (액티비티.md 11.2 참조) */}
      <div
        style={{
          borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
          padding: 'var(--spacing-md)',
          backgroundColor: 'var(--color-white)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {/* 검색 */}
          {/* ⚠️ 성능 고려: 서버 필터링 시 정확 일치/prefix match 우선 적용 (액티비티.md 10.3 참조)
              - 정확 일치: reference->>'request_id' = q OR reference->>'task_id' = q
              - prefix match: reference->>'request_id' LIKE q || '%' OR reference->>'task_id' LIKE q || '%'
              - summary/error_summary: ILIKE '%' || q || '%' (제한적 부분일치, 인덱스 기반)
              - 무제한 부분일치(partial LIKE) 검색은 금지 (P0 성능) */}
          <Input
            value={searchQuery}
            onChange={(e) => {
              const newQuery = e.target.value;
              setSearchQuery(newQuery);
              handleFilterChange({ searchQuery: newQuery });
            }}
            placeholder="검색 (request_id, task_id, summary 등)"
            style={{ width: '100%' }}
            aria-label="검색 입력"
          />

          {/* 필터 그룹 */}
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            <Select
              value={filterStatus}
              onChange={(value) => {
                const newStatus = (Array.isArray(value) ? value[0] : value) as ExecutionAuditRunStatus | 'all';
                setFilterStatus(newStatus);
                handleFilterChange({ status: newStatus });
              }}
              // HARD-CODE-EXCEPTION: 컴포넌트 최소 너비 지정 (레이아웃용 특수 값)
              style={{ minWidth: '120px' }}
              aria-label="상태 필터"
            >
              <option value="all">모든 상태</option>
              <option value="success">성공</option>
              <option value="failed">실패</option>
              <option value="partial">부분 성공</option>
            </Select>

            <Select
              value={filterSource}
              onChange={(value) => {
                const newSource = (Array.isArray(value) ? value[0] : value) as ExecutionAuditSource | 'all';
                setFilterSource(newSource);
                handleFilterChange({ source: newSource });
              }}
              // HARD-CODE-EXCEPTION: 컴포넌트 최소 너비 지정 (레이아웃용 특수 값)
              style={{ minWidth: '120px' }}
              aria-label="소스 필터"
            >
              <option value="all">모든 소스</option>
              <option value="ai">AI</option>
              <option value="automation">자동화</option>
              <option value="scheduler">스케줄러</option>
              <option value="manual">수동</option>
              <option value="webhook">웹훅</option>
            </Select>

            <Select
              value={filterOperationType}
              onChange={(value) => {
                const newOperationType = Array.isArray(value) ? value[0] : value;
                setFilterOperationType(newOperationType);
                handleFilterChange({ operation_type: newOperationType });
              }}
              // HARD-CODE-EXCEPTION: 컴포넌트 최소 너비 지정 (레이아웃용 특수 값)
              style={{ minWidth: '150px' }}
              aria-label="작업 유형 필터"
            >
              <option value="all">모든 작업 유형</option>
              {availableOperationTypes.map((opType) => (
                <option key={opType} value={opType}>
                  {opType}
                </option>
              ))}
            </Select>

            <Button
              variant={showFailedOnly ? 'solid' : 'outline'}
              size="sm"
              onClick={() => {
                const newShowFailedOnly = !showFailedOnly;
                setShowFailedOnly(newShowFailedOnly);
                handleFilterChange({ showFailedOnly: newShowFailedOnly });
              }}
              aria-label="실패만 보기"
            >
              실패만 보기
            </Button>
          </div>

          {/* 날짜 필터 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {/* 빠른 선택 버튼 (액티비티.md 11.2 참조) */}
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // P1: 날짜 필터 설정은 KST 기준으로 처리 (체크리스트.md 5. 날짜 및 시간 처리)
                  // toKST()를 사용하여 KST 기준 오늘 0시 계산
                  const todayKst = toKST().startOf('day').toDate();
                  const tomorrowKst = toKST().add(1, 'day').startOf('day').toDate();
                  setDateFrom(todayKst);
                  setDateTo(tomorrowKst);
                  handleFilterChange({ dateFrom: todayKst, dateTo: tomorrowKst });
                }}
                aria-label="오늘"
              >
                오늘
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // P1: 날짜 필터 설정은 KST 기준으로 처리 (체크리스트.md 5. 날짜 및 시간 처리)
                  // toKST()를 사용하여 KST 기준 이번주 계산
                  const todayKst = toKST().startOf('day');
                  const dayOfWeek = todayKst.day(); // dayjs는 0(일요일) ~ 6(토요일)
                  const startOfWeek = todayKst.subtract(dayOfWeek, 'day').toDate();
                  const endOfWeek = todayKst.add(7 - dayOfWeek, 'day').startOf('day').toDate();
                  setDateFrom(startOfWeek);
                  setDateTo(endOfWeek);
                  handleFilterChange({ dateFrom: startOfWeek, dateTo: endOfWeek });
                }}
                aria-label="이번주"
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
                aria-label="기간 초기화"
              >
                초기화
              </Button>
            </div>
            {/* 커스텀 날짜 선택 */}
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
              <DatePicker
                value={dateFrom ? toKST(dateFrom).format('YYYY-MM-DD') : undefined}
                onChange={(value) => {
                  const newDateFrom = value ? new Date(value) : null;
                  setDateFrom(newDateFrom);
                  handleFilterChange({ dateFrom: newDateFrom });
                }}
                placeholder="시작일"
                style={{ flex: 1 }}
                aria-label="시작일 필터"
              />
              <span style={{ color: 'var(--color-text-secondary)' }}>~</span>
              <DatePicker
                value={dateTo ? toKST(dateTo).format('YYYY-MM-DD') : undefined}
                onChange={(value) => {
                  const newDateTo = value ? new Date(value) : null;
                  setDateTo(newDateTo);
                  handleFilterChange({ dateTo: newDateTo });
                }}
                placeholder="종료일"
                style={{ flex: 1 }}
                aria-label="종료일 필터"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Runs 목록 (타임라인/리스트 기반, 액티비티.md 11.2 참조) */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--spacing-lg)',
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
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--color-text-secondary)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>
                실행 기록이 없습니다
              </div>
            </div>
        ) : (
          <>
            {filteredRuns.map((run) => {
              const isExpanded = expandedRunIds.has(run.id);
              const steps = stepsByRunId[run.id] || [];
              const stepsLoadingForRun = stepsLoading[run.id] || false;

              return (
                <Card
                  key={run.id}
                  padding="md"
                  variant="default"
                  style={{
                    marginBottom: 'var(--spacing-md)',
                    cursor: 'pointer',
                    borderLeft: `var(--border-width-thick) solid ${
                      run.status === 'success'
                        ? 'var(--color-success)'
                        : run.status === 'failed'
                        ? 'var(--color-error)'
                        : 'var(--color-warning)'
                    }`,
                  }}
                  onClick={() => handleToggleExpand(run.id)}
                >
                  {/* Run 헤더 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-xs)' }}>
                        {getStatusBadge(run.status)}
                        <Badge variant="outline" size="sm">
                          {getSourceLabel(run.source)}
                        </Badge>
                        <Badge variant="outline" size="sm">
                          {run.operation_type}
                        </Badge>
                      </div>
                      <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                        {run.summary}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        {toKST(run.occurred_at).format('YYYY-MM-DD HH:mm:ss')}
                      </div>
                      {run.counts && (
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
                          성공: {run.counts.success}, 실패: {run.counts.failed}
                        </div>
                      )}
                      {run.error_code && (
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-error)', marginTop: 'var(--spacing-xs)' }}>
                          {run.error_code}: {run.error_summary}
                        </div>
                      )}
                      {run.reference.request_id && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--spacing-xs)' }}>
                          request_id: {run.reference.request_id}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleExpand(run.id);
                      }}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </Button>
                  </div>

                  {/* Step 목록 (확장 시 표시, 액티비티.md 4.2 참조) */}
                  {isExpanded && (
                    <div style={{ marginTop: 'var(--spacing-md)', borderTop: 'var(--border-width-thin) solid var(--color-gray-200)', paddingTop: 'var(--spacing-md)' }}>
                      {stepsLoadingForRun ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--spacing-md)' }}>
                          <Spinner size="sm" />
                        </div>
                      ) : steps.length === 0 ? (
                        <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--spacing-md)' }}>
                          <div style={{ marginBottom: 'var(--spacing-xs)' }}>
                            세부 실행 단계가 없습니다
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                            {run.status === 'success'
                              ? '단건 실행이므로 세부 단계 없이 실행 결과만 기록되었습니다.'
                              : run.error_code
                                ? `실행이 시작되지 않았습니다 (${run.error_code})`
                                : '실행 시도는 했으나 세부 실행 단계가 발생하지 않았습니다.'}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                          {steps.map((step) => (
                            <Card
                              key={step.id}
                              padding="sm"
                              variant="default"
                              style={{
                                backgroundColor: 'var(--color-gray-50)',
                                borderLeft: `var(--border-width-thin) solid ${
                                  step.status === 'success' ? 'var(--color-success)' : 'var(--color-error)'
                                }`,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-xs)' }}>
                                <Badge variant="outline" color={step.status === 'success' ? 'success' : 'error'} size="sm">
                                  {step.status === 'success' ? '성공' : '실패'}
                                </Badge>
                                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>
                                  {step.summary}
                                </span>
                              </div>
                              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                {step.target_type}: {step.target_id}
                              </div>
                              {step.error_code && (
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', marginTop: 'var(--spacing-xs)' }}>
                                  {step.error_code}: {step.error_summary}
                                </div>
                              )}
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
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
