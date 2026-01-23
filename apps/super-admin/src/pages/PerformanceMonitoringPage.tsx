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
import { ErrorBoundary, Container, Card, Button, useModal } from '@ui-core/react';
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
import type { TabType } from '../types/performance';

export function PerformanceMonitoringPage() {
  const { data: isSuperAdmin, isLoading: isCheckingAuth } = useIsSuperAdmin();
  const { showAlert, showConfirm } = useModal();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

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

  // 권한 체크
  if (isCheckingAuth) {
    return (
      <Container maxWidth="xl" padding="lg">
        <Card padding="md">
          <p>권한 확인 중...</p>
        </Card>
      </Container>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Container maxWidth="xl" padding="lg">
        <Card padding="md" variant="outlined">
          <h2 style={{ color: 'var(--color-error)', marginBottom: 'var(--spacing-md)' }}>
            접근 권한 없음
          </h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            이 페이지는 Super Admin만 접근할 수 있습니다.
          </p>
        </Card>
      </Container>
    );
  }

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

  // Edge Function 에러 카운트
  const edgeFunctionErrorCount = edgeFunctionStats?.filter(s => s.error_rate > 10).length || 0;

  const tabs: { key: TabType; label: string; badge?: number }[] = [
    { key: 'overview', label: '개요' },
    {
      key: 'realtime',
      label: '실시간',
      badge: ((lockWaits?.length || 0) + (longRunningQueries?.length || 0)) > 0
        ? (lockWaits?.length || 0) + (longRunningQueries?.length || 0)
        : undefined
    },
    { key: 'queries', label: '쿼리 분석' },
    {
      key: 'storage',
      label: '스토리지',
      badge: (unusedIndexes?.length || 0) > 0 ? unusedIndexes?.length : undefined
    },
    { key: 'connections', label: '연결' },
    {
      key: 'security',
      label: '보안',
      badge: (authFailures?.length || 0) > 0 ? authFailures?.length : undefined
    },
    {
      key: 'edge-functions',
      label: 'Edge Functions',
      badge: edgeFunctionErrorCount > 0 ? edgeFunctionErrorCount : undefined
    },
    {
      key: 'realtime-monitoring',
      label: 'Realtime',
      badge: (realtimeStats?.error_count_24h && realtimeStats.error_count_24h > 20)
        ? realtimeStats.error_count_24h
        : undefined
    },
  ];

  return (
    <ErrorBoundary>
      <Container maxWidth="full" padding="lg">
        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              성능 모니터링
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
              데이터베이스 성능 및 쿼리 통계 분석
            </p>
          </div>
          <Button variant="outline" color="warning" onClick={handleResetStats}>
            통계 초기화
          </Button>
        </div>

        {/* 탭 네비게이션 */}
        <nav
          role="tablist"
          aria-label="성능 모니터링 탭"
          style={{
            display: 'flex',
            gap: 'var(--spacing-sm)',
            marginBottom: 'var(--spacing-lg)',
            borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
            paddingBottom: 'var(--spacing-sm)',
          }}
        >
          {tabs.map((tab, index) => (
            <Button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`tabpanel-${tab.key}`}
              id={`tab-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              variant={activeTab === tab.key ? 'solid' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  const nextIndex = (index + 1) % tabs.length;
                  setActiveTab(tabs[nextIndex].key);
                  document.getElementById(`tab-${tabs[nextIndex].key}`)?.focus();
                } else if (e.key === 'ArrowLeft') {
                  const prevIndex = (index - 1 + tabs.length) % tabs.length;
                  setActiveTab(tabs[prevIndex].key);
                  document.getElementById(`tab-${tabs[prevIndex].key}`)?.focus();
                } else if (e.key === 'Home') {
                  setActiveTab(tabs[0].key);
                  document.getElementById(`tab-${tabs[0].key}`)?.focus();
                } else if (e.key === 'End') {
                  setActiveTab(tabs[tabs.length - 1].key);
                  document.getElementById(`tab-${tabs[tabs.length - 1].key}`)?.focus();
                }
              }}
              style={{ position: 'relative' }}
            >
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span
                  aria-label={`${tab.badge}개의 알림`}
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    minWidth: 'var(--spacing-md)',
                    height: 'var(--spacing-md)',
                    borderRadius: 'var(--border-radius-full)',
                    backgroundColor: 'var(--color-error)',
                    color: 'white',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 'var(--font-weight-bold)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 var(--spacing-xs)',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </Button>
          ))}
        </nav>

        {/* 탭 콘텐츠 */}
        {activeTab === 'overview' && (
          <div
            role="tabpanel"
            id="tabpanel-overview"
            aria-labelledby="tab-overview"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}
          >
            {/* 종합 시스템 상태 */}
            <OverallHealthSummary
              health={overallHealth}
              isLoading={isLoadingOverallHealth}
              onNavigateToTab={setActiveTab}
            />

            {/* 시스템 상태 */}
            <SystemHealthCard health={systemHealth} isLoading={isLoadingSystemHealth} />

            {/* 프론트엔드 에러 */}
            <FrontendErrorsCard errors={frontendErrors} isLoading={isLoadingFrontendErrors} />

            {/* 캐시 히트율 & 연결 상태 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(var(--width-card-min), 1fr))', /* 300px */
                gap: 'var(--spacing-lg)',
              }}
            >
              <CacheHitRateCard cacheRates={cacheHitRates} isLoading={isLoadingCacheHitRate} />
              <ConnectionStatsCard connections={connectionStats} isLoading={isLoadingConnectionStats} />
            </div>

            {/* Top 10 쿼리 요약 */}
            <QueryStatsTable
              title="Top 10 호출 쿼리"
              description="가장 많이 호출된 상위 10개 쿼리"
              queries={topQueries?.slice(0, 10)}
              isLoading={isLoadingTopQueries}
            />
          </div>
        )}

        {activeTab === 'realtime' && (
          <div
            role="tabpanel"
            id="tabpanel-realtime"
            aria-labelledby="tab-realtime"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}
          >
            {/* 실시간 알림 배너 */}
            <div
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-gray-50)',
                borderRadius: 'var(--border-radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-md)',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-lg)' }}>🔴</span>
              <div>
                <p style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)' }}>
                  실시간 모니터링
                </p>
                <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                  10초마다 자동 갱신됩니다. 락 대기나 장기 실행 쿼리가 있으면 즉시 표시됩니다.
                </p>
              </div>
            </div>

            {/* 락 대기 현황 */}
            <LockWaitsCard lockWaits={lockWaits} isLoading={isLoadingLockWaits} />

            {/* 장기 실행 쿼리 */}
            <LongRunningQueriesCard queries={longRunningQueries} isLoading={isLoadingLongRunning} />
          </div>
        )}

        {activeTab === 'queries' && (
          <div
            role="tabpanel"
            id="tabpanel-queries"
            aria-labelledby="tab-queries"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}
          >
            {/* 가장 많이 호출된 쿼리 */}
            <QueryStatsTable
              title="가장 많이 호출된 쿼리"
              description="호출 횟수가 많은 쿼리 목록. 최적화 시 영향도가 가장 큽니다."
              queries={topQueries}
              isLoading={isLoadingTopQueries}
            />

            {/* 가장 느린 쿼리 */}
            <QueryStatsTable
              title="가장 느린 쿼리"
              description="최대 실행 시간 기준. 개별 쿼리의 성능 병목을 확인합니다."
              queries={slowestQueries}
              isLoading={isLoadingSlowestQueries}
            />

            {/* 시간 소비 쿼리 */}
            <QueryStatsTable
              title="시간 소비 상위 쿼리"
              description="총 실행 시간 기준. 전체 시스템 부하에 영향이 큰 쿼리입니다."
              queries={mostTimeConsumingQueries}
              isLoading={isLoadingMostTimeConsuming}
            />
          </div>
        )}

        {activeTab === 'storage' && (
          <div
            role="tabpanel"
            id="tabpanel-storage"
            aria-labelledby="tab-storage"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}
          >
            {/* 파일 스토리지 사용량 */}
            <StorageStatsCard stats={storageStats} isLoading={isLoadingStorageStats} />

            {/* 캐시 히트율 */}
            <CacheHitRateCard cacheRates={cacheHitRates} isLoading={isLoadingCacheHitRate} />

            {/* 테이블 크기 */}
            <TableSizesCard tables={tableSizes} isLoading={isLoadingTableSizes} />

            {/* 미사용 인덱스 */}
            <UnusedIndexesCard indexes={unusedIndexes} isLoading={isLoadingUnusedIndexes} />
          </div>
        )}

        {activeTab === 'connections' && (
          <div
            role="tabpanel"
            id="tabpanel-connections"
            aria-labelledby="tab-connections"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}
          >
            {/* 연결 상태 */}
            <ConnectionStatsCard connections={connectionStats} isLoading={isLoadingConnectionStats} />

            {/* 추가 정보 */}
            <Card padding="md" variant="outlined">
              <h3
                style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  marginBottom: 'var(--spacing-md)',
                  color: 'var(--color-text)',
                }}
              >
                연결 관리 팁
              </h3>
              <ul
                style={{
                  paddingLeft: 'var(--spacing-lg)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-base)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-sm)',
                }}
              >
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
          </div>
        )}

        {activeTab === 'security' && (
          <div
            role="tabpanel"
            id="tabpanel-security"
            aria-labelledby="tab-security"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}
          >
            {/* 인증 실패 모니터링 */}
            <AuthFailuresCard failures={authFailures} isLoading={isLoadingAuthFailures} />

            {/* 보안 가이드 */}
            <Card padding="md" variant="outlined">
              <h3
                style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  marginBottom: 'var(--spacing-md)',
                  color: 'var(--color-text)',
                }}
              >
                보안 모니터링 가이드
              </h3>
              <ul
                style={{
                  paddingLeft: 'var(--spacing-lg)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-base)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-sm)',
                }}
              >
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
          </div>
        )}

        {activeTab === 'edge-functions' && (
          <div
            role="tabpanel"
            id="tabpanel-edge-functions"
            aria-labelledby="tab-edge-functions"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}
          >
            {/* Edge Function 통계 */}
            <EdgeFunctionStatsCard stats={edgeFunctionStats} isLoading={isLoadingEdgeFunctionStats} />

            {/* Edge Function 가이드 */}
            <Card padding="md" variant="outlined">
              <h3
                style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  marginBottom: 'var(--spacing-md)',
                  color: 'var(--color-text)',
                }}
              >
                Edge Function 모니터링 가이드
              </h3>
              <ul
                style={{
                  paddingLeft: 'var(--spacing-lg)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-base)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-sm)',
                }}
              >
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
          </div>
        )}

        {activeTab === 'realtime-monitoring' && (
          <div
            role="tabpanel"
            id="tabpanel-realtime-monitoring"
            aria-labelledby="tab-realtime-monitoring"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}
          >
            {/* Realtime 통계 */}
            <RealtimeStatsCard stats={realtimeStats} isLoading={isLoadingRealtimeStats} />

            {/* Realtime 가이드 */}
            <Card padding="md" variant="outlined">
              <h3
                style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  marginBottom: 'var(--spacing-md)',
                  color: 'var(--color-text)',
                }}
              >
                Realtime 모니터링 가이드
              </h3>
              <ul
                style={{
                  paddingLeft: 'var(--spacing-lg)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-base)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-sm)',
                }}
              >
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
          </div>
        )}
      </Container>
    </ErrorBoundary>
  );
}
