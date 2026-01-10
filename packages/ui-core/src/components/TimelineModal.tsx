// LAYER: UI_CORE_COMPONENT
/**
 * TimelineModal Component
 *
 * AI 액티비티 타임라인을 모달로 표시하는 컴포넌트
 * [SSOT 준수] 액티비티.md 문서 기준 엄격히 준수
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다
 * [업종 중립] 모든 업종에서 공통으로 사용 가능
 *
 * 참고 문서:
 * - SSOT: docu/액티비티.md (Execution Audit 시스템)
 */

import React, { useMemo, useCallback } from 'react';
import { Modal } from './Modal';
import { DataTable, DataTableColumn, DataTableFilter, DataTableFilterState } from './DataTable';
import { Badge } from './Badge';
import { ExecutionAuditRun, ExecutionAuditStep, ExecutionAuditFilters, ExecutionAuditRunStatus, ExecutionAuditSource } from './ExecutionAuditPanel';
import { toKST } from '@lib/date-utils';
import { Clock } from 'lucide-react';

export interface TimelineModalProps {
  isOpen: boolean;
  onClose: () => void;

  // Execution Audit Props
  executionAuditRuns?: ExecutionAuditRun[];
  executionAuditLoading?: boolean;
  executionAuditHasMore?: boolean;
  executionAuditNextCursor?: string;
  executionAuditStepsByRunId?: Record<string, ExecutionAuditStep[]>;
  executionAuditStepsLoading?: Record<string, boolean>;
  onExecutionAuditLoadMore?: (cursor?: string) => void;
  onExecutionAuditLoadSteps?: (runId: string, cursor?: string) => void;
  onExecutionAuditViewRun?: (runId: string) => void;
  onExecutionAuditRowClick?: (run: ExecutionAuditRun) => void;
  onExecutionAuditFilterChange?: (filters: ExecutionAuditFilters) => void;
  executionAuditInitialFilters?: ExecutionAuditFilters;
  executionAuditAvailableOperationTypes?: string[];
}

/**
 * 작업 타입별 한글 레이블 매핑 (업종 중립)
 */
const getOperationTypeLabel = (operationType: string): string => {
  // 점(.)으로 구분된 작업 타입을 한글로 변환
  const labelMap: Record<string, string> = {
    // 에이전트 관련
    'chatops-message': '에이전트 처리',
    'chatops.message': '에이전트 처리',
    'ai.process': '에이전트 처리',
    'ai.execute': '에이전트 실행',

    // 학생/회원 관련
    'student.register': '학생 등록',
    'student.update': '학생 정보 수정',
    'student.delete': '학생 삭제',
    'student.create': '학생 생성',
    'member.register': '회원 등록',
    'member.update': '회원 정보 수정',
    'member.delete': '회원 삭제',
    'member.create': '회원 생성',

    // 보호자 관련
    'guardian.register': '보호자 등록',
    'guardian.update': '보호자 정보 수정',
    'guardian.delete': '보호자 삭제',
    'guardian.create': '보호자 생성',

    // 설정 관련
    'config.update': '설정 수정',
    'config.create': '설정 생성',
    'config.delete': '설정 삭제',

    // 출석 관련
    'attendance.record': '출석 기록',
    'attendance.update': '출석 수정',
    'attendance.create': '출석 생성',
    'attendance.delete': '출석 삭제',

    // SMS 관련
    'sms.send': 'SMS 발송',
    'sms.create': 'SMS 생성',
    'sms.schedule': 'SMS 예약',

    // 결제 관련
    'payment.create': '결제 등록',
    'payment.update': '결제 수정',
    'payment.delete': '결제 삭제',
    'payment.cancel': '결제 취소',
    'payment.refund': '결제 환불',

    // 일정 관련
    'schedule.create': '일정 등록',
    'schedule.update': '일정 수정',
    'schedule.delete': '일정 삭제',

    // 과제 관련
    'task.create': '과제 생성',
    'task.update': '과제 수정',
    'task.delete': '과제 삭제',
    'task.complete': '과제 완료',

    // 예약 관련
    'reservation.create': '예약 생성',
    'reservation.update': '예약 수정',
    'reservation.delete': '예약 삭제',
    'reservation.cancel': '예약 취소',

    // 상담 관련
    'consultation.create': '상담 생성',
    'consultation.update': '상담 수정',
    'consultation.delete': '상담 삭제',

    // 수업/서비스 관련
    'class.create': '수업 생성',
    'class.update': '수업 수정',
    'class.delete': '수업 삭제',
    'service.create': '서비스 생성',
    'service.update': '서비스 수정',
    'service.delete': '서비스 삭제',
  };

  // 매핑된 값이 있으면 반환, 없으면 원본을 변환
  if (labelMap[operationType]) {
    return labelMap[operationType];
  }

  // 매핑되지 않은 경우 자동 변환 시도
  // 예: "user.register" → "사용자 등록"
  const parts = operationType.split('.');
  if (parts.length === 2) {
    const [entity, action] = parts;

    // 엔티티명 한글 매핑
    const entityMap: Record<string, string> = {
      'guardian': '보호자',
      'config': '설정',
      'user': '사용자',
      'student': '학생',
      'member': '회원',
      'teacher': '강사',
      'staff': '직원',
      'course': '과정',
      'lesson': '수업',
      'chatops': '에이전트',
      'ai': '에이전트',
    };

    // 액션명 한글 매핑
    const actionMap: Record<string, string> = {
      'register': '등록',
      'create': '생성',
      'update': '수정',
      'delete': '삭제',
      'cancel': '취소',
      'complete': '완료',
      'send': '발송',
      'schedule': '예약',
      'record': '기록',
      'refund': '환불',
      'message': '처리',
      'process': '처리',
      'execute': '실행',
    };

    const entityKorean = entityMap[entity.toLowerCase()] || entity;
    const actionKorean = actionMap[action] || action;

    return `${entityKorean} ${actionKorean}`;
  }

  // 하이픈으로 연결된 경우 처리 (예: chatops-message)
  if (operationType.includes('-')) {
    const parts = operationType.split('-');
    if (parts[0] === 'chatops' || parts[0] === 'ai') {
      return '에이전트 처리';
    }
  }

  // 변환 불가능한 경우 원본 반환
  return operationType;
};

/**
 * 상태별 Badge 색상 매핑
 */
const getStatusColor = (status: ExecutionAuditRunStatus): 'success' | 'warning' | 'error' => {
  switch (status) {
    case 'success':
      return 'success';
    case 'partial':
      return 'warning';
    case 'failed':
      return 'error';
    default:
      return 'warning';
  }
};

/**
 * Source별 레이블 매핑 (업종 중립)
 */
const getSourceLabel = (source: ExecutionAuditSource): string => {
  switch (source) {
    case 'ai':
      return 'AI';
    case 'automation':
      return '자동화';
    case 'scheduler':
      return '스케줄러';
    case 'manual':
      return '수동';
    case 'webhook':
      return '웹훅';
    default:
      return source;
  }
};

/**
 * TimelineModal 컴포넌트
 *
 * AI 액티비티 타임라인을 테이블 형식으로 표시
 */
export const TimelineModal: React.FC<TimelineModalProps> = ({
  isOpen,
  onClose,
  executionAuditRuns = [],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  executionAuditLoading = false,
  onExecutionAuditRowClick,
  onExecutionAuditFilterChange,
  executionAuditInitialFilters,
  executionAuditAvailableOperationTypes = [],
}) => {
  // DataTable 내장 필터 설정
  const filters = useMemo<DataTableFilter[]>(() => {
    const baseFilters: DataTableFilter[] = [
      {
        type: 'dateRange',
        columnKey: 'occurred_at',
        label: '기간',
      },
      {
        type: 'text',
        columnKey: 'summary',
        label: '요약',
        placeholder: '요약 검색...',
      },
      {
        type: 'select',
        columnKey: 'status',
        label: '상태',
        placeholder: '모든 상태',
        options: [
          { value: 'success', label: '성공' },
          { value: 'partial', label: '부분 성공' },
          { value: 'failed', label: '실패' },
        ],
      },
      {
        type: 'select',
        columnKey: 'source',
        label: '소스',
        placeholder: '모든 소스',
        options: [
          { value: 'ai', label: 'AI' },
          { value: 'automation', label: '자동화' },
          { value: 'scheduler', label: '스케줄러' },
          { value: 'manual', label: '수동' },
          { value: 'webhook', label: '웹훅' },
        ],
      },
    ];

    // 작업 타입 필터 (옵션이 있는 경우에만 추가)
    if (executionAuditAvailableOperationTypes.length > 0) {
      baseFilters.push({
        type: 'select',
        columnKey: 'operation_type',
        label: '작업',
        placeholder: '모든 작업',
        options: executionAuditAvailableOperationTypes.map((type) => ({
          value: type,
          label: getOperationTypeLabel(type),
        })),
      });
    }

    return baseFilters;
  }, [executionAuditAvailableOperationTypes]);

  // 초기 필터 상태
  const initialFilterState = useMemo<DataTableFilterState>(() => {
    const state: DataTableFilterState = {};
    if (executionAuditInitialFilters?.status && executionAuditInitialFilters.status !== 'all') {
      state.status = { selected: executionAuditInitialFilters.status };
    }
    if (executionAuditInitialFilters?.source && executionAuditInitialFilters.source !== 'all') {
      state.source = { selected: executionAuditInitialFilters.source };
    }
    if (executionAuditInitialFilters?.operation_type && executionAuditInitialFilters.operation_type !== 'all') {
      state.operation_type = { selected: executionAuditInitialFilters.operation_type };
    }
    return state;
  }, [executionAuditInitialFilters]);

  // 필터 변경 핸들러 (DataTable → 외부 콜백 변환)
  const handleFilterChange = useCallback((filterState: DataTableFilterState) => {
    if (!onExecutionAuditFilterChange) return;

    const newFilters: ExecutionAuditFilters = {
      status: (filterState.status?.selected || 'all') as ExecutionAuditRunStatus | 'all',
      source: (filterState.source?.selected || 'all') as ExecutionAuditSource | 'all',
      operation_type: filterState.operation_type?.selected || 'all',
    };

    onExecutionAuditFilterChange(newFilters);
  }, [onExecutionAuditFilterChange]);

  // 테이블 컬럼 정의
  const columns = useMemo<DataTableColumn<ExecutionAuditRun>[]>(
    () => [
      {
        key: 'occurred_at',
        label: '시간',
        width: '140px',
        render: (_value, run) => (
          <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
            {toKST(run.occurred_at).format('YYYY-MM-DD HH:mm')}
          </span>
        ),
      },
      {
        key: 'operation_type',
        label: '작업',
        width: '150px',
        render: (_value, run) => (
          <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-medium)' }}>
            {getOperationTypeLabel(run.operation_type)}
          </span>
        ),
      },
      {
        key: 'summary',
        label: '요약',
        render: (_value, run) => (
          <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
            {run.summary}
          </span>
        ),
      },
      {
        key: 'source',
        label: '소스',
        width: '100px',
        render: (_value, run) => (
          <Badge size="sm" variant="outline">
            {getSourceLabel(run.source)}
          </Badge>
        ),
      },
      {
        key: 'status',
        label: '상태',
        width: '100px',
        render: (_value, run) => (
          <Badge size="sm" color={getStatusColor(run.status)}>
            {run.status === 'success' ? '성공' : run.status === 'partial' ? '부분 성공' : '실패'}
          </Badge>
        ),
      },
    ],
    []
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="타임라인"
      size="xl"
      className="timeline-modal"
      style={{
        width: '85vw',
        maxWidth: 'var(--width-modal-2xl)',
      }}
    >
      {/* 테이블 영역 (내장 필터 사용) - 검색 시 높이 변동 방지를 위해 minHeight 설정 */}
      <div style={{ minHeight: 'var(--height-modal-content-min)' }}>
        <DataTable
          data={executionAuditRuns}
          columns={columns}
          onRowClick={onExecutionAuditRowClick}
          emptyMessage="액티비티가 없습니다."
          emptyIcon={Clock}
          filters={filters}
          onFilterChange={handleFilterChange}
          initialFilterState={initialFilterState}
          enableClientSideFiltering={true}
        />
      </div>
    </Modal>
  );
};
