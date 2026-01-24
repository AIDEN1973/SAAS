/**
 * Performance Monitoring Page
 *
 * [불변 규칙] Super Admin 전용 성능 모니터링 대시보드
 * [불변 규칙] Zero-Trust: 모든 권한 검증은 RLS에서 처리
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 *
 * 기능:
 * - 시스템 상태 요약 (쿼리 수, 평균 응답 시간, 캐시 히트율, 연결 수)
 * - 가장 많이 호출된 쿼리 (Top Queries)
 * - 가장 느린 쿼리 (Slowest Queries)
 * - 가장 시간을 많이 소비하는 쿼리 (Most Time Consuming)
 * - 캐시 히트율 (Table/Index)
 * - 테이블 크기 정보
 * - 연결 상태
 */

import { useState } from 'react';
import { ErrorBoundary, Card, Button, useModal } from '@ui-core/react';
import { useIsSuperAdmin } from '@hooks/use-schema-registry';
import {
  useTopQueries,
  useSlowestQueries,
  useMostTimeConsumingQueries,
  useCacheHitRate,
  useTableSizes,
  useConnectionStats,
  useSystemHealth,
  useResetStats,
  useLockWaits,
  useLongRunningQueries,
  useUnusedIndexes,
  useAuthFailures,
  useOverallHealth,
  useEdgeFunctionStats,
  useRealtimeStats,
  useStorageStats,
  useFrontendErrors,
  type QueryStats,
  type CacheHitRate,
  type TableSize,
  type ConnectionStats,
  type SystemHealth,
  type LockWait,
  type LongRunningQuery,
  type UnusedIndex,
  type AuthFailure,
  type OverallHealth,
  type EdgeFunctionStats,
  type RealtimeStats,
  type StorageStats,
  type FrontendError,
} from '../hooks/usePerformanceMetrics';
import {
  SystemHealthCard,
  CacheHitRateCard,
  QueryStatsTable,
  TableSizesCard,
  ConnectionStatsCard,
  LockWaitsCard,
  LongRunningQueriesCard,
  UnusedIndexesCard,
  AuthFailuresCard,
  OverallHealthSummary,
  EdgeFunctionStatsCard,
  RealtimeStatsCard,
  StorageStatsCard,
  FrontendErrorsCard,
} from '../components/performance-monitoring';
import {
  SuperAdminLayout,
  PageHeader,
  Section,
  LoadingSkeleton,
} from '../components/SuperAdminLayout';
import {
  PERFORMANCE_SUB_MENU_ITEMS,
  DEFAULT_PERFORMANCE_SUB_MENU,
  PERFORMANCE_RELATED_MENUS,
  type PerformanceSubMenuId,
} from '../constants/sub-sidebar-menus';

// ============================================================================
// Main Component
// ============================================================================

export function PerformanceMonitoringPage() {
  const { data: isSuperAdmin, isLoading: isCheckingAuth } = useIsSuperAdmin();
  const { showAlert, showConfirm } = useModal();
  const [activeTab, setActiveTab] = useState<PerformanceSubMenuId>(DEFAULT_PERFORMANCE_SUB_MENU);

  // 성능 메트릭 훅
  const { data: topQueries, isLoading: isLoadingTopQueries } = useTopQueries();
  const { data: slowestQueries, isLoading: isLoadingSlowestQueries } = useSlowestQueries();
  const { data: mostTimeConsumingQueries, isLoading: isLoadingMostTimeConsuming } =
    useMostTimeConsumingQueries();
  const { data: cacheHitRates, isLoading: isLoadingCacheHitRate } = useCacheHitRate();
  const { data: tableSizes, isLoading: isLoadingTableSizes } = useTableSizes();
  const { data: connectionStats, isLoading: isLoadingConnectionStats } = useConnectionStats();
  const { data: systemHealth, isLoading: isLoadingSystemHealth } = useSystemHealth();
  const { data: lockWaits, isLoading: isLoadingLockWaits } = useLockWaits();
  const { data: longRunningQueries, isLoading: isLoadingLongRunning } = useLongRunningQueries();
  const { data: unusedIndexes, isLoading: isLoadingUnusedIndexes } = useUnusedIndexes();
  const { data: authFailures, isLoading: isLoadingAuthFailures } = useAuthFailures();
  const { data: overallHealth, isLoading: isLoadingOverallHealth } = useOverallHealth();
  const { data: edgeFunctionStats, isLoading: isLoadingEdgeFunctionStats } = useEdgeFunctionStats();
  const { data: realtimeStats, isLoading: isLoadingRealtimeStats } = useRealtimeStats();
  const { data: storageStats, isLoading: isLoadingStorageStats } = useStorageStats();
  const { data: frontendErrors, isLoading: isLoadingFrontendErrors } = useFrontendErrors();
  const resetStats = useResetStats();

  // 탭 변경 핸들러
  const handleTabChange = (id: PerformanceSubMenuId) => {
    setActiveTab(id);
  };

  // 통계 초기화 핸들러
  const handleResetStats = async () => {
    const confirmed = await showConfirm(
      '통계 초기화',
      'pg_stat_statements 통계를 초기화하시겠습니까? 모든 쿼리 통계가 삭제됩니다.'
    );

    if (!confirmed) return;

    try {
      await resetStats();
      showAlert('성공', '통계가 초기화되었습니다.');
    } catch (error) {
      showAlert('오류', error instanceof Error ? error.message : '통계 초기화에 실패했습니다.');
    }
  };

  // 권한 체크
  if (isCheckingAuth) {
    return (
      <SuperAdminLayout
        title="성능 모니터링"
        subMenuItems={PERFORMANCE_SUB_MENU_ITEMS}
        defaultSubMenuId={DEFAULT_PERFORMANCE_SUB_MENU}
      >
        <LoadingSkeleton cardCount={4} showTable />
      </SuperAdminLayout>
    );
  }

  if (!isSuperAdmin) {
    return (
      <SuperAdminLayout
        title="성능 모니터링"
        subMenuItems={PERFORMANCE_SUB_MENU_ITEMS}
        defaultSubMenuId={DEFAULT_PERFORMANCE_SUB_MENU}
      >
        <Card padding="md" variant="outlined">
          <h2 style={{ color: 'var(--color-error)', marginBottom: 'var(--spacing-md)' }}>
            접근 권한 없음
          </h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            이 페이지는 Super Admin만 접근할 수 있습니다.
          </p>
        </Card>
      </SuperAdminLayout>
    );
  }

  // 탭별 콘텐츠 렌더링
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewTab
            overallHealth={overallHealth}
            isLoadingOverallHealth={isLoadingOverallHealth}
            systemHealth={systemHealth}
            isLoadingSystemHealth={isLoadingSystemHealth}
            frontendErrors={frontendErrors}
            isLoadingFrontendErrors={isLoadingFrontendErrors}
            cacheHitRates={cacheHitRates}
            isLoadingCacheHitRate={isLoadingCacheHitRate}
            connectionStats={connectionStats}
            isLoadingConnectionStats={isLoadingConnectionStats}
            topQueries={topQueries}
            isLoadingTopQueries={isLoadingTopQueries}
            onNavigateToTab={setActiveTab}
            onResetStats={handleResetStats}
          />
        );
      case 'database':
        return (
          <DatabaseTab
            lockWaits={lockWaits}
            isLoadingLockWaits={isLoadingLockWaits}
            longRunningQueries={longRunningQueries}
            isLoadingLongRunning={isLoadingLongRunning}
            topQueries={topQueries}
            isLoadingTopQueries={isLoadingTopQueries}
            slowestQueries={slowestQueries}
            isLoadingSlowestQueries={isLoadingSlowestQueries}
            mostTimeConsumingQueries={mostTimeConsumingQueries}
            isLoadingMostTimeConsuming={isLoadingMostTimeConsuming}
          />
        );
      case 'edge-functions':
        return (
          <EdgeFunctionsTab
            edgeFunctionStats={edgeFunctionStats}
            isLoadingEdgeFunctionStats={isLoadingEdgeFunctionStats}
          />
        );
      case 'storage':
        return (
          <StorageTab
            storageStats={storageStats}
            isLoadingStorageStats={isLoadingStorageStats}
            cacheHitRates={cacheHitRates}
            isLoadingCacheHitRate={isLoadingCacheHitRate}
            tableSizes={tableSizes}
            isLoadingTableSizes={isLoadingTableSizes}
            unusedIndexes={unusedIndexes}
            isLoadingUnusedIndexes={isLoadingUnusedIndexes}
          />
        );
      case 'realtime':
        return (
          <RealtimeTab
            realtimeStats={realtimeStats}
            isLoadingRealtimeStats={isLoadingRealtimeStats}
          />
        );
      case 'auth':
        return (
          <AuthTab
            authFailures={authFailures}
            isLoadingAuthFailures={isLoadingAuthFailures}
          />
        );
      case 'errors':
        return (
          <ErrorsTab
            frontendErrors={frontendErrors}
            isLoadingFrontendErrors={isLoadingFrontendErrors}
          />
        );
      case 'optimization':
        return (
          <OptimizationTab
            connectionStats={connectionStats}
            isLoadingConnectionStats={isLoadingConnectionStats}
            unusedIndexes={unusedIndexes}
            isLoadingUnusedIndexes={isLoadingUnusedIndexes}
            cacheHitRates={cacheHitRates}
            isLoadingCacheHitRate={isLoadingCacheHitRate}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ErrorBoundary>
      <SuperAdminLayout
        title="성능 모니터링"
        subMenuItems={PERFORMANCE_SUB_MENU_ITEMS}
        defaultSubMenuId={DEFAULT_PERFORMANCE_SUB_MENU}
        relatedMenus={PERFORMANCE_RELATED_MENUS}
        selectedSubMenuId={activeTab}
        onSubMenuChange={handleTabChange}
      >
        {renderContent()}
      </SuperAdminLayout>
    </ErrorBoundary>
  );
}

// ============================================================================
// Tab Components
// ============================================================================

interface OverviewTabProps {
  overallHealth: OverallHealth | undefined;
  isLoadingOverallHealth: boolean;
  systemHealth: SystemHealth | undefined;
  isLoadingSystemHealth: boolean;
  frontendErrors: FrontendError[] | undefined;
  isLoadingFrontendErrors: boolean;
  cacheHitRates: CacheHitRate[] | undefined;
  isLoadingCacheHitRate: boolean;
  connectionStats: ConnectionStats[] | undefined;
  isLoadingConnectionStats: boolean;
  topQueries: QueryStats[] | undefined;
  isLoadingTopQueries: boolean;
  onNavigateToTab: (tab: PerformanceSubMenuId) => void;
  onResetStats: () => void;
}

function OverviewTab({
  overallHealth,
  isLoadingOverallHealth,
  systemHealth,
  isLoadingSystemHealth,
  frontendErrors,
  isLoadingFrontendErrors,
  cacheHitRates,
  isLoadingCacheHitRate,
  connectionStats,
  isLoadingConnectionStats,
  topQueries,
  isLoadingTopQueries,
  onNavigateToTab,
  onResetStats,
}: OverviewTabProps) {
  return (
    <>
      <PageHeader
        title="전체 현황"
        subtitle="데이터베이스 성능 및 쿼리 통계 분석"
        actions={
          <Button variant="outline" color="warning" onClick={onResetStats}>
            통계 초기화
          </Button>
        }
      />

      {/* 종합 시스템 상태 */}
      <Section title="종합 시스템 상태" subtitle="실시간 시스템 건강 상태">
        <OverallHealthSummary
          health={overallHealth}
          isLoading={isLoadingOverallHealth}
          onNavigateToTab={onNavigateToTab}
        />
      </Section>

      {/* 시스템 상태 */}
      <Section title="시스템 헬스">
        <SystemHealthCard health={systemHealth} isLoading={isLoadingSystemHealth} />
      </Section>

      {/* 프론트엔드 에러 */}
      <Section title="프론트엔드 에러" subtitle="최근 발생한 클라이언트 에러">
        <FrontendErrorsCard errors={frontendErrors} isLoading={isLoadingFrontendErrors} />
      </Section>

      {/* 캐시 히트율 & 연결 상태 */}
      <Section title="리소스 현황">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(var(--width-card-min), 1fr))',
            gap: 'var(--spacing-lg)',
          }}
        >
          <CacheHitRateCard cacheRates={cacheHitRates} isLoading={isLoadingCacheHitRate} />
          <ConnectionStatsCard connections={connectionStats} isLoading={isLoadingConnectionStats} />
        </div>
      </Section>

      {/* Top 10 쿼리 요약 */}
      <Section title="Top 10 호출 쿼리" subtitle="가장 많이 호출된 상위 10개 쿼리">
        <QueryStatsTable
          title=""
          description=""
          queries={topQueries?.slice(0, 10)}
          isLoading={isLoadingTopQueries}
        />
      </Section>
    </>
  );
}

interface DatabaseTabProps {
  lockWaits: LockWait[] | undefined;
  isLoadingLockWaits: boolean;
  longRunningQueries: LongRunningQuery[] | undefined;
  isLoadingLongRunning: boolean;
  topQueries: QueryStats[] | undefined;
  isLoadingTopQueries: boolean;
  slowestQueries: QueryStats[] | undefined;
  isLoadingSlowestQueries: boolean;
  mostTimeConsumingQueries: QueryStats[] | undefined;
  isLoadingMostTimeConsuming: boolean;
}

function DatabaseTab({
  lockWaits,
  isLoadingLockWaits,
  longRunningQueries,
  isLoadingLongRunning,
  topQueries,
  isLoadingTopQueries,
  slowestQueries,
  isLoadingSlowestQueries,
  mostTimeConsumingQueries,
  isLoadingMostTimeConsuming,
}: DatabaseTabProps) {
  return (
    <>
      <PageHeader title="데이터베이스" subtitle="데이터베이스 쿼리 분석 및 실시간 모니터링" />

      {/* 실시간 알림 배너 */}
      <Section title="실시간 모니터링" subtitle="10초마다 자동 갱신됩니다">
        <div
          style={{
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-gray-50)',
            borderRadius: 'var(--border-radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          <span style={{ fontSize: 'var(--font-size-lg)' }}>🔴</span>
          <div>
            <p style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)', margin: 0 }}>
              실시간 모니터링 활성화
            </p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
              락 대기나 장기 실행 쿼리가 있으면 즉시 표시됩니다.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <LockWaitsCard lockWaits={lockWaits} isLoading={isLoadingLockWaits} />
          <LongRunningQueriesCard queries={longRunningQueries} isLoading={isLoadingLongRunning} />
        </div>
      </Section>

      {/* 쿼리 분석 */}
      <Section title="쿼리 분석">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <QueryStatsTable
            title="가장 많이 호출된 쿼리"
            description="호출 횟수가 많은 쿼리 목록. 최적화 시 영향도가 가장 큽니다."
            queries={topQueries}
            isLoading={isLoadingTopQueries}
          />
          <QueryStatsTable
            title="가장 느린 쿼리"
            description="최대 실행 시간 기준. 개별 쿼리의 성능 병목을 확인합니다."
            queries={slowestQueries}
            isLoading={isLoadingSlowestQueries}
          />
          <QueryStatsTable
            title="시간 소비 상위 쿼리"
            description="총 실행 시간 기준. 전체 시스템 부하에 영향이 큰 쿼리입니다."
            queries={mostTimeConsumingQueries}
            isLoading={isLoadingMostTimeConsuming}
          />
        </div>
      </Section>
    </>
  );
}

interface EdgeFunctionsTabProps {
  edgeFunctionStats: EdgeFunctionStats[] | undefined;
  isLoadingEdgeFunctionStats: boolean;
}

function EdgeFunctionsTab({ edgeFunctionStats, isLoadingEdgeFunctionStats }: EdgeFunctionsTabProps) {
  return (
    <>
      <PageHeader title="Edge Functions" subtitle="Edge Function 성능 및 에러율 모니터링" />

      {/* Edge Function 통계 */}
      <Section title="Edge Function 통계">
        <EdgeFunctionStatsCard stats={edgeFunctionStats} isLoading={isLoadingEdgeFunctionStats} />
      </Section>

      {/* Edge Function 가이드 */}
      <Section title="모니터링 가이드">
        <Card padding="md" variant="outlined">
          <ul style={guideListStyle}>
            <li>
              <strong>에러율 10% 이상</strong>: 함수 로직 또는 외부 API 연동 문제 확인 필요
            </li>
            <li>
              <strong>에러율 30% 이상</strong>: 즉각적인 조치 필요. 핵심 기능 장애 가능성
            </li>
            <li>
              <strong>응답 시간 5초 이상</strong>: 성능 최적화 또는 타임아웃 설정 검토
            </li>
            <li>
              <strong>503 에러</strong>: 서버 과부하 또는 Cold Start 문제. 웜업 전략 고려
            </li>
            <li>
              Supabase Dashboard에서 Edge Function 로그를 상세히 확인할 수 있습니다.
            </li>
          </ul>
        </Card>
      </Section>
    </>
  );
}

interface StorageTabProps {
  storageStats: StorageStats | null | undefined;
  isLoadingStorageStats: boolean;
  cacheHitRates: CacheHitRate[] | undefined;
  isLoadingCacheHitRate: boolean;
  tableSizes: TableSize[] | undefined;
  isLoadingTableSizes: boolean;
  unusedIndexes: UnusedIndex[] | undefined;
  isLoadingUnusedIndexes: boolean;
}

function StorageTab({
  storageStats,
  isLoadingStorageStats,
  cacheHitRates,
  isLoadingCacheHitRate,
  tableSizes,
  isLoadingTableSizes,
  unusedIndexes,
  isLoadingUnusedIndexes,
}: StorageTabProps) {
  return (
    <>
      <PageHeader title="스토리지" subtitle="파일 스토리지 및 데이터베이스 용량 모니터링" />

      {/* 파일 스토리지 사용량 */}
      <Section title="파일 스토리지 사용량">
        <StorageStatsCard stats={storageStats} isLoading={isLoadingStorageStats} />
      </Section>

      {/* 캐시 히트율 */}
      <Section title="캐시 히트율">
        <CacheHitRateCard cacheRates={cacheHitRates} isLoading={isLoadingCacheHitRate} />
      </Section>

      {/* 테이블 크기 */}
      <Section title="테이블 크기">
        <TableSizesCard tables={tableSizes} isLoading={isLoadingTableSizes} />
      </Section>

      {/* 미사용 인덱스 */}
      <Section title="미사용 인덱스" subtitle="삭제를 고려할 수 있는 인덱스 목록">
        <UnusedIndexesCard indexes={unusedIndexes} isLoading={isLoadingUnusedIndexes} />
      </Section>
    </>
  );
}

interface RealtimeTabProps {
  realtimeStats: RealtimeStats | null | undefined;
  isLoadingRealtimeStats: boolean;
}

function RealtimeTab({ realtimeStats, isLoadingRealtimeStats }: RealtimeTabProps) {
  return (
    <>
      <PageHeader title="Realtime" subtitle="Supabase Realtime 연결 및 메시지 모니터링" />

      {/* Realtime 통계 */}
      <Section title="Realtime 통계">
        <RealtimeStatsCard stats={realtimeStats} isLoading={isLoadingRealtimeStats} />
      </Section>

      {/* Realtime 가이드 */}
      <Section title="모니터링 가이드">
        <Card padding="md" variant="outlined">
          <ul style={guideListStyle}>
            <li>
              <strong>활성 연결</strong>: 현재 Realtime 채널에 연결된 클라이언트 수
            </li>
            <li>
              <strong>메시지 수</strong>: 24시간 동안 전송된 Realtime 메시지 총 개수
            </li>
            <li>
              <strong>에러 20건 이상</strong>: 네트워크 문제 또는 클라이언트 연결 불안정
            </li>
            <li>
              <strong>에러 100건 이상</strong>: 심각한 연결 문제. 서버 상태 확인 필요
            </li>
            <li>
              Supabase의 Realtime은 PostgreSQL의 변경 사항을 WebSocket으로 스트리밍합니다.
            </li>
          </ul>
        </Card>
      </Section>
    </>
  );
}

interface AuthTabProps {
  authFailures: AuthFailure[] | undefined;
  isLoadingAuthFailures: boolean;
}

function AuthTab({ authFailures, isLoadingAuthFailures }: AuthTabProps) {
  return (
    <>
      <PageHeader title="인증" subtitle="인증 실패 및 보안 이벤트 모니터링" />

      {/* 인증 실패 모니터링 */}
      <Section title="인증 실패 모니터링">
        <AuthFailuresCard failures={authFailures} isLoading={isLoadingAuthFailures} />
      </Section>

      {/* 보안 가이드 */}
      <Section title="보안 모니터링 가이드">
        <Card padding="md" variant="outlined">
          <ul style={guideListStyle}>
            <li>
              <strong>반복 실패</strong>: 동일 IP에서 5회 이상 실패 시 브루트포스 공격 의심
            </li>
            <li>
              <strong>다수 계정 시도</strong>: 하나의 IP에서 여러 이메일 시도 시 크리덴셜 스터핑 의심
            </li>
            <li>
              <strong>대응 방법</strong>: 의심스러운 IP는 Supabase Auth 설정에서 차단 가능
            </li>
            <li>
              Supabase Dashboard에서 Leaked Password Protection을 활성화하면 유출된 비밀번호 사용을 차단할 수
              있습니다.
            </li>
          </ul>
        </Card>
      </Section>
    </>
  );
}

interface ErrorsTabProps {
  frontendErrors: FrontendError[] | undefined;
  isLoadingFrontendErrors: boolean;
}

function ErrorsTab({ frontendErrors, isLoadingFrontendErrors }: ErrorsTabProps) {
  return (
    <>
      <PageHeader title="에러 로그" subtitle="프론트엔드 및 백엔드 에러 모니터링" />

      {/* 프론트엔드 에러 */}
      <Section title="프론트엔드 에러" subtitle="최근 발생한 클라이언트 에러">
        <FrontendErrorsCard errors={frontendErrors} isLoading={isLoadingFrontendErrors} />
      </Section>

      {/* 에러 해결 가이드 */}
      <Section title="에러 해결 가이드">
        <Card padding="md" variant="outlined">
          <ul style={guideListStyle}>
            <li>
              <strong>400 Bad Request</strong>: 클라이언트 요청 형식 오류. 입력 검증 확인
            </li>
            <li>
              <strong>401 Unauthorized</strong>: 인증 토큰 만료 또는 누락
            </li>
            <li>
              <strong>403 Forbidden</strong>: RLS 정책 또는 권한 문제
            </li>
            <li>
              <strong>500 Internal Server Error</strong>: 서버 측 오류. 로그 확인 필요
            </li>
            <li>
              에러 발생 시 브라우저 콘솔과 네트워크 탭을 함께 확인하세요.
            </li>
          </ul>
        </Card>
      </Section>
    </>
  );
}

interface OptimizationTabProps {
  connectionStats: ConnectionStats[] | undefined;
  isLoadingConnectionStats: boolean;
  unusedIndexes: UnusedIndex[] | undefined;
  isLoadingUnusedIndexes: boolean;
  cacheHitRates: CacheHitRate[] | undefined;
  isLoadingCacheHitRate: boolean;
}

function OptimizationTab({
  connectionStats,
  isLoadingConnectionStats,
  unusedIndexes,
  isLoadingUnusedIndexes,
  cacheHitRates,
  isLoadingCacheHitRate,
}: OptimizationTabProps) {
  return (
    <>
      <PageHeader title="최적화 제안" subtitle="성능 개선을 위한 권장 사항" />

      {/* 연결 상태 */}
      <Section title="연결 상태">
        <ConnectionStatsCard connections={connectionStats} isLoading={isLoadingConnectionStats} />
      </Section>

      {/* 연결 관리 팁 */}
      <Section title="연결 관리 팁">
        <Card padding="md" variant="outlined">
          <ul style={guideListStyle}>
            <li>
              <strong>활성 연결</strong>: 현재 쿼리를 실행 중인 연결
            </li>
            <li>
              <strong>유휴 연결</strong>: 대기 중인 연결. 너무 많으면 풀링 설정 검토 필요
            </li>
            <li>
              <strong>트랜잭션 대기</strong>: 트랜잭션 내에서 대기 중. 장시간 지속 시 문제 가능
            </li>
            <li>
              PgBouncer Transaction Pooling을 사용 중이면 연결 수가 적게 표시될 수 있습니다.
            </li>
          </ul>
        </Card>
      </Section>

      {/* 미사용 인덱스 */}
      <Section title="미사용 인덱스" subtitle="삭제를 고려할 수 있는 인덱스">
        <UnusedIndexesCard indexes={unusedIndexes} isLoading={isLoadingUnusedIndexes} />
      </Section>

      {/* 캐시 최적화 */}
      <Section title="캐시 최적화">
        <CacheHitRateCard cacheRates={cacheHitRates} isLoading={isLoadingCacheHitRate} />
        <Card padding="md" variant="outlined" style={{ marginTop: 'var(--spacing-md)' }}>
          <ul style={guideListStyle}>
            <li>
              <strong>캐시 히트율 95% 이상</strong>: 최적의 성능 상태
            </li>
            <li>
              <strong>캐시 히트율 90% 미만</strong>: shared_buffers 증가 검토
            </li>
            <li>
              <strong>인덱스 캐시율 낮음</strong>: 자주 사용되는 쿼리에 인덱스 추가 고려
            </li>
            <li>
              VACUUM ANALYZE를 정기적으로 실행하여 테이블 통계를 최신 상태로 유지하세요.
            </li>
          </ul>
        </Card>
      </Section>
    </>
  );
}

// ============================================================================
// Styles
// ============================================================================

const guideListStyle: React.CSSProperties = {
  paddingLeft: 'var(--spacing-lg)',
  color: 'var(--color-text-secondary)',
  fontSize: 'var(--font-size-base)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-sm)',
  margin: 0,
};
