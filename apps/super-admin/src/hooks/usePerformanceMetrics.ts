/**
 * Performance Metrics Hook
 *
 * [불변 규칙] Super Admin 전용 성능 모니터링 훅
 * [불변 규칙] Zero-Trust: Supabase RLS를 통한 권한 검증
 *
 * 성능 메트릭 수집:
 * - pg_stat_statements: 쿼리 실행 통계
 * - pg_statio_user_tables: 테이블 캐시 히트율
 * - pg_statio_user_indexes: 인덱스 캐시 히트율
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@lib/supabase-client';

// Supabase 클라이언트 싱글톤
const supabase = createClient();

/** 쿼리 통계 */
export interface QueryStats {
  query: string;
  calls: number;
  total_time: number;
  mean_time: number;
  max_time: number;
  min_time: number;
  avg_rows: number;
  prop_total_time: string;
}

/** 캐시 히트율 */
export interface CacheHitRate {
  name: string;
  ratio: number;
}

/** 테이블 크기 정보 */
export interface TableSize {
  table_name: string;
  total_size: string;
  table_size: string;
  index_size: string;
  row_estimate: number;
}

/** 연결 통계 */
export interface ConnectionStats {
  state: string;
  count: number;
}

/** 시스템 상태 요약 */
export interface SystemHealth {
  totalQueries: number;
  avgQueryTime: number;
  cacheHitRate: number;
  activeConnections: number;
  idleConnections: number;
}

/** 락 대기 정보 */
export interface LockWait {
  blocked_pid: number;
  blocked_user: string;
  blocked_query: string;
  blocked_duration: string;
  blocking_pid: number;
  blocking_user: string;
  blocking_query: string;
}

/** 장기 실행 쿼리 */
export interface LongRunningQuery {
  pid: number;
  user: string;
  database: string;
  duration: string;
  duration_seconds: number;
  state: string;
  query: string;
  wait_event: string | null;
}

/** 미사용 인덱스 */
export interface UnusedIndex {
  schema_name: string;
  table_name: string;
  index_name: string;
  index_size: string;
  index_scans: number;
}

/** 인덱스 블로트 정보 */
export interface IndexBloat {
  schema_name: string;
  table_name: string;
  index_name: string;
  index_size: string;
  bloat_ratio: number;
  bloat_size: string;
}

/** 인증 실패 로그 */
export interface AuthFailure {
  id: string;
  created_at: string;
  ip_address: string;
  user_agent: string;
  error_code: string;
  error_message: string;
  email: string | null;
}

/** 전체 시스템 상태 요약 (종합) */
export interface OverallHealth {
  database: 'healthy' | 'warning' | 'critical';
  cache: 'healthy' | 'warning' | 'critical';
  connections: 'healthy' | 'warning' | 'critical';
  security: 'healthy' | 'warning' | 'critical';
  storage: 'healthy' | 'warning' | 'critical';
  edgeFunctions: 'healthy' | 'warning' | 'critical';
  realtime: 'healthy' | 'warning' | 'critical';
  overall: 'healthy' | 'warning' | 'critical';
  issues: string[];
}

/** Edge Function 로그 항목 */
export interface EdgeFunctionLog {
  id: string;
  function_id: string;
  function_name: string;
  deployment_id: string;
  event_message: string;
  execution_time_ms: number;
  method: string;
  status_code: number;
  timestamp: string;
  version: string;
}

/** Edge Function 통계 */
export interface EdgeFunctionStats {
  function_name: string;
  total_calls: number;
  error_count: number;
  error_rate: number;
  avg_execution_time: number;
  max_execution_time: number;
  last_error: string | null;
  last_error_time: string | null;
}

/** Realtime 연결 로그 */
export interface RealtimeLog {
  id: string;
  event_type: string;
  channel: string;
  timestamp: string;
  message: string;
  error: string | null;
}

/** Realtime 통계 */
export interface RealtimeStats {
  active_connections: number;
  total_messages_24h: number;
  error_count_24h: number;
  channels: {
    name: string;
    subscribers: number;
    messages: number;
  }[];
}

/** Storage 사용량 */
export interface StorageUsage {
  bucket_name: string;
  total_size_bytes: number;
  total_size_formatted: string;
  file_count: number;
  last_updated: string;
}

/** Storage 전체 통계 */
export interface StorageStats {
  total_usage_bytes: number;
  total_usage_formatted: string;
  total_files: number;
  buckets: StorageUsage[];
  usage_percentage: number;
  limit_bytes: number;
}

/** Frontend 에러 */
export interface FrontendError {
  id: string;
  message: string;
  component: string;
  operation: string;
  count: number;
  lastSeen: string;
  level: 'error' | 'warning' | 'info';
}

/**
 * 가장 많이 호출된 쿼리 조회
 */
export function useTopQueries(limit = 20) {
  return useQuery({
    queryKey: ['performance', 'top-queries', limit],
    queryFn: async (): Promise<QueryStats[]> => {
      const result = await supabase.rpc('get_top_queries', { query_limit: limit });

      if (result.error) {
        // pg_stat_statements가 없을 경우 빈 배열 반환
        console.warn('Failed to fetch top queries:', result.error.message);
        return [];
      }

      return (result.data as QueryStats[]) || [];
    },
    staleTime: 30000, // 30초
    refetchInterval: 60000, // 1분마다 자동 갱신
  });
}

/**
 * 가장 느린 쿼리 조회
 */
export function useSlowestQueries(limit = 20) {
  return useQuery({
    queryKey: ['performance', 'slowest-queries', limit],
    queryFn: async (): Promise<QueryStats[]> => {
      const result = await supabase.rpc('get_slowest_queries', { query_limit: limit });

      if (result.error) {
        console.warn('Failed to fetch slowest queries:', result.error.message);
        return [];
      }

      return (result.data as QueryStats[]) || [];
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

/**
 * 가장 시간을 많이 소비하는 쿼리 조회
 */
export function useMostTimeConsumingQueries(limit = 20) {
  return useQuery({
    queryKey: ['performance', 'most-time-consuming', limit],
    queryFn: async (): Promise<QueryStats[]> => {
      const result = await supabase.rpc('get_most_time_consuming_queries', { query_limit: limit });

      if (result.error) {
        console.warn('Failed to fetch most time consuming queries:', result.error.message);
        return [];
      }

      return (result.data as QueryStats[]) || [];
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

/**
 * 캐시 히트율 조회
 */
export function useCacheHitRate() {
  return useQuery({
    queryKey: ['performance', 'cache-hit-rate'],
    queryFn: async (): Promise<CacheHitRate[]> => {
      const result = await supabase.rpc('get_cache_hit_rate');

      if (result.error) {
        console.warn('Failed to fetch cache hit rate:', result.error.message);
        return [];
      }

      return (result.data as CacheHitRate[]) || [];
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

/**
 * 테이블 크기 정보 조회
 */
export function useTableSizes(limit = 20) {
  return useQuery({
    queryKey: ['performance', 'table-sizes', limit],
    queryFn: async (): Promise<TableSize[]> => {
      const result = await supabase.rpc('get_table_sizes', { table_limit: limit });

      if (result.error) {
        console.warn('Failed to fetch table sizes:', result.error.message);
        return [];
      }

      return (result.data as TableSize[]) || [];
    },
    staleTime: 60000, // 1분
    refetchInterval: 300000, // 5분마다
  });
}

/**
 * 연결 통계 조회
 */
export function useConnectionStats() {
  return useQuery({
    queryKey: ['performance', 'connection-stats'],
    queryFn: async (): Promise<ConnectionStats[]> => {
      const result = await supabase.rpc('get_connection_stats');

      if (result.error) {
        console.warn('Failed to fetch connection stats:', result.error.message);
        return [];
      }

      return (result.data as ConnectionStats[]) || [];
    },
    staleTime: 10000, // 10초
    refetchInterval: 30000, // 30초마다
  });
}

/**
 * 시스템 상태 요약 조회
 */
export function useSystemHealth() {
  const { data: topQueries } = useTopQueries(100);
  const { data: cacheHitRates } = useCacheHitRate();
  const { data: connections } = useConnectionStats();

  return useQuery({
    queryKey: ['performance', 'system-health', topQueries, cacheHitRates, connections],
    queryFn: (): SystemHealth => {
      const totalQueries = topQueries?.reduce((sum, q) => sum + q.calls, 0) || 0;
      const avgQueryTime = topQueries?.length
        ? topQueries.reduce((sum, q) => sum + q.mean_time, 0) / topQueries.length
        : 0;

      const tableHitRate = cacheHitRates?.find(c => c.name === 'table hit rate');
      const cacheHitRate = tableHitRate?.ratio || 0;

      const activeConnections = connections?.find(c => c.state === 'active')?.count || 0;
      const idleConnections = connections?.find(c => c.state === 'idle')?.count || 0;

      return {
        totalQueries,
        avgQueryTime,
        cacheHitRate,
        activeConnections,
        idleConnections,
      };
    },
    enabled: !!topQueries && !!cacheHitRates && !!connections,
    staleTime: 30000,
  });
}

/**
 * 통계 리셋
 */
export function useResetStats() {
  const queryClient = useQueryClient();

  return async () => {
    const result = await supabase.rpc('reset_pg_stat_statements');

    if (result.error) {
      throw new Error(`Failed to reset stats: ${result.error.message}`);
    }

    // 모든 성능 쿼리 무효화
    await queryClient.invalidateQueries({ queryKey: ['performance'] });
  };
}

/**
 * 락 대기 상황 조회
 * - 데드락 위험 및 병목 지점 파악
 */
export function useLockWaits() {
  return useQuery({
    queryKey: ['performance', 'lock-waits'],
    queryFn: async (): Promise<LockWait[]> => {
      const result = await supabase.rpc('get_lock_waits');

      if (result.error) {
        console.warn('Failed to fetch lock waits:', result.error.message);
        return [];
      }

      return (result.data as LockWait[]) || [];
    },
    staleTime: 5000, // 5초 - 실시간 모니터링
    refetchInterval: 10000, // 10초마다
  });
}

/**
 * 장기 실행 쿼리 조회
 * - 5초 이상 실행 중인 쿼리
 */
export function useLongRunningQueries(thresholdSeconds = 5) {
  return useQuery({
    queryKey: ['performance', 'long-running-queries', thresholdSeconds],
    queryFn: async (): Promise<LongRunningQuery[]> => {
      const result = await supabase.rpc('get_long_running_queries', {
        threshold_seconds: thresholdSeconds,
      });

      if (result.error) {
        console.warn('Failed to fetch long running queries:', result.error.message);
        return [];
      }

      return (result.data as LongRunningQuery[]) || [];
    },
    staleTime: 5000,
    refetchInterval: 10000,
  });
}

/**
 * 미사용 인덱스 조회
 * - 스캔 횟수가 0인 인덱스
 */
export function useUnusedIndexes() {
  return useQuery({
    queryKey: ['performance', 'unused-indexes'],
    queryFn: async (): Promise<UnusedIndex[]> => {
      const result = await supabase.rpc('get_unused_indexes');

      if (result.error) {
        console.warn('Failed to fetch unused indexes:', result.error.message);
        return [];
      }

      return (result.data as UnusedIndex[]) || [];
    },
    staleTime: 300000, // 5분
    refetchInterval: 600000, // 10분마다
  });
}

/**
 * 인덱스 블로트 조회
 * - 20% 이상 블로트된 인덱스
 */
export function useIndexBloat() {
  return useQuery({
    queryKey: ['performance', 'index-bloat'],
    queryFn: async (): Promise<IndexBloat[]> => {
      const result = await supabase.rpc('get_index_bloat');

      if (result.error) {
        console.warn('Failed to fetch index bloat:', result.error.message);
        return [];
      }

      return (result.data as IndexBloat[]) || [];
    },
    staleTime: 300000, // 5분
    refetchInterval: 600000, // 10분마다
  });
}

/**
 * 인증 실패 로그 조회
 * - 최근 24시간 인증 실패 로그
 * - 보안 위협 탐지 및 로그인 문제 파악
 */
export function useAuthFailures(hoursAgo = 24, limit = 50) {
  return useQuery({
    queryKey: ['performance', 'auth-failures', hoursAgo, limit],
    queryFn: async (): Promise<AuthFailure[]> => {
      const result = await supabase.rpc('get_auth_failures', {
        hours_ago: hoursAgo,
        failure_limit: limit,
      });

      if (result.error) {
        console.warn('Failed to fetch auth failures:', result.error.message);
        return [];
      }

      return (result.data as AuthFailure[]) || [];
    },
    staleTime: 30000, // 30초
    refetchInterval: 60000, // 1분마다
  });
}

/**
 * Edge Function 로그 및 통계 조회
 * - 최근 24시간 Edge Function 실행 로그
 * - 함수별 에러율 및 성능 분석
 */
export function useEdgeFunctionStats() {
  return useQuery({
    queryKey: ['performance', 'edge-function-stats'],
    queryFn: async (): Promise<EdgeFunctionStats[]> => {
      const result = await supabase.rpc('get_edge_function_stats');

      if (result.error) {
        console.warn('Failed to fetch edge function stats:', result.error.message);
        return [];
      }

      return (result.data as EdgeFunctionStats[]) || [];
    },
    staleTime: 30000, // 30초
    refetchInterval: 60000, // 1분마다
  });
}

/**
 * Realtime 연결 통계 조회
 * - 활성 연결 수 및 채널별 통계
 */
export function useRealtimeStats() {
  return useQuery({
    queryKey: ['performance', 'realtime-stats'],
    queryFn: async (): Promise<RealtimeStats | null> => {
      const result = await supabase.rpc('get_realtime_stats');

      if (result.error) {
        console.warn('Failed to fetch realtime stats:', result.error.message);
        return null;
      }

      return (result.data as RealtimeStats) || null;
    },
    staleTime: 10000, // 10초
    refetchInterval: 30000, // 30초마다
  });
}

/**
 * Storage 사용량 조회
 * - 버킷별 사용량 및 전체 통계
 */
export function useStorageStats() {
  return useQuery({
    queryKey: ['performance', 'storage-stats'],
    queryFn: async (): Promise<StorageStats | null> => {
      const result = await supabase.rpc('get_storage_stats');

      if (result.error) {
        console.warn('Failed to fetch storage stats:', result.error.message);
        return null;
      }

      return (result.data as StorageStats) || null;
    },
    staleTime: 60000, // 1분
    refetchInterval: 300000, // 5분마다
  });
}

/**
 * 프론트엔드 에러 조회
 * - Sentry에서 수집된 에러 정보
 * - 최근 24시간 에러 목록
 *
 * ✅ 백엔드 RPC 함수를 통해 frontend_error_logs 테이블에서 조회
 * ✅ sync-sentry-errors Cron Job이 5분마다 Sentry API에서 동기화
 */
export function useFrontendErrors() {
  return useQuery({
    queryKey: ['performance', 'frontend-errors'],
    queryFn: async (): Promise<FrontendError[]> => {
      const result = await supabase.rpc('get_frontend_errors');

      if (result.error) {
        console.warn('Failed to fetch frontend errors:', result.error.message);
        return [];
      }

      return (result.data as FrontendError[]) || [];
    },
    staleTime: 30000, // 30초
    refetchInterval: 60000, // 1분마다
  });
}

/**
 * 종합 시스템 상태 조회
 * - 모든 지표를 종합한 "시스템 상태" 평가
 * - 비전문가도 이해할 수 있는 단순화된 상태
 */
export function useOverallHealth() {
  const { data: systemHealth } = useSystemHealth();
  const { data: lockWaits } = useLockWaits();
  const { data: longRunningQueries } = useLongRunningQueries();
  const { data: unusedIndexes } = useUnusedIndexes();
  const { data: authFailures } = useAuthFailures();
  const { data: edgeFunctionStats } = useEdgeFunctionStats();
  const { data: realtimeStats } = useRealtimeStats();
  const { data: storageStats } = useStorageStats();

  return useQuery({
    queryKey: [
      'performance',
      'overall-health',
      systemHealth,
      lockWaits,
      longRunningQueries,
      unusedIndexes,
      authFailures,
      edgeFunctionStats,
      realtimeStats,
      storageStats,
    ],
    queryFn: (): OverallHealth => {
      const issues: string[] = [];

      // 데이터베이스 상태 평가
      let database: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (systemHealth) {
        if (systemHealth.avgQueryTime > 100) {
          database = 'critical';
          issues.push('평균 쿼리 시간이 100ms를 초과합니다');
        } else if (systemHealth.avgQueryTime > 50) {
          database = 'warning';
          issues.push('평균 쿼리 시간이 50ms를 초과합니다');
        }

        if (lockWaits && lockWaits.length > 0) {
          database = 'critical';
          issues.push(`${lockWaits.length}개의 락 대기가 발생 중입니다`);
        }

        if (longRunningQueries && longRunningQueries.length > 0) {
          const criticalQueries = longRunningQueries.filter(q => q.duration_seconds > 30);
          if (criticalQueries.length > 0) {
            database = 'critical';
            issues.push(`${criticalQueries.length}개의 쿼리가 30초 이상 실행 중입니다`);
          } else if (database !== 'critical') {
            database = 'warning';
            issues.push(`${longRunningQueries.length}개의 장기 실행 쿼리가 있습니다`);
          }
        }
      }

      // 캐시 상태 평가
      let cache: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (systemHealth) {
        if (systemHealth.cacheHitRate < 90) {
          cache = 'critical';
          issues.push(`캐시 히트율이 ${systemHealth.cacheHitRate.toFixed(1)}%로 낮습니다`);
        } else if (systemHealth.cacheHitRate < 95) {
          cache = 'warning';
          issues.push(`캐시 히트율이 ${systemHealth.cacheHitRate.toFixed(1)}%입니다`);
        }
      }

      // 연결 상태 평가
      let connections: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (systemHealth) {
        const totalConnections = systemHealth.activeConnections + systemHealth.idleConnections;
        if (totalConnections > 80) {
          connections = 'critical';
          issues.push(`연결 수가 ${totalConnections}개로 풀 포화 상태입니다`);
        } else if (totalConnections > 50) {
          connections = 'warning';
          issues.push(`연결 수가 ${totalConnections}개로 높습니다`);
        }
      }

      // 보안 상태 평가
      let security: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (authFailures && authFailures.length > 0) {
        // 최근 1시간 내 동일 IP에서 5회 이상 실패
        const recentFailures = authFailures.filter(f => {
          const failureTime = new Date(f.created_at);
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          return failureTime > oneHourAgo;
        });

        const ipCounts: Record<string, number> = {};
        recentFailures.forEach(f => {
          ipCounts[f.ip_address] = (ipCounts[f.ip_address] || 0) + 1;
        });

        const suspiciousIps = Object.entries(ipCounts).filter(([, count]) => count >= 5);
        if (suspiciousIps.length > 0) {
          security = 'critical';
          issues.push(`${suspiciousIps.length}개 IP에서 반복적인 인증 실패가 감지되었습니다`);
        } else if (recentFailures.length > 10) {
          security = 'warning';
          issues.push(`최근 1시간 내 ${recentFailures.length}건의 인증 실패가 있습니다`);
        }
      }

      // 스토리지 상태 평가
      let storage: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (unusedIndexes && unusedIndexes.length > 5) {
        storage = 'warning';
        issues.push(`${unusedIndexes.length}개의 미사용 인덱스가 있습니다`);
      }
      if (storageStats) {
        if (storageStats.usage_percentage > 90) {
          storage = 'critical';
          issues.push(`스토리지 사용량이 ${storageStats.usage_percentage.toFixed(1)}%로 거의 가득 찼습니다`);
        } else if (storageStats.usage_percentage > 70 && storage === 'healthy') {
          storage = 'warning';
          issues.push(`스토리지 사용량이 ${storageStats.usage_percentage.toFixed(1)}%입니다`);
        }
      }

      // Edge Function 상태 평가
      let edgeFunctions: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (edgeFunctionStats && edgeFunctionStats.length > 0) {
        const highErrorFunctions = edgeFunctionStats.filter(f => f.error_rate > 10);
        const criticalErrorFunctions = edgeFunctionStats.filter(f => f.error_rate > 30);

        if (criticalErrorFunctions.length > 0) {
          edgeFunctions = 'critical';
          issues.push(`${criticalErrorFunctions.length}개 Edge Function의 에러율이 30%를 초과합니다`);
        } else if (highErrorFunctions.length > 0) {
          edgeFunctions = 'warning';
          issues.push(`${highErrorFunctions.length}개 Edge Function의 에러율이 높습니다`);
        }

        // 느린 함수 체크
        const slowFunctions = edgeFunctionStats.filter(f => f.avg_execution_time > 5000);
        if (slowFunctions.length > 0) {
          if (edgeFunctions !== 'critical') edgeFunctions = 'warning';
          issues.push(`${slowFunctions.length}개 Edge Function의 평균 응답 시간이 5초를 초과합니다`);
        }
      }

      // Realtime 상태 평가
      let realtime: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (realtimeStats) {
        if (realtimeStats.error_count_24h > 100) {
          realtime = 'critical';
          issues.push(`Realtime 에러가 24시간 내 ${realtimeStats.error_count_24h}건 발생했습니다`);
        } else if (realtimeStats.error_count_24h > 20) {
          realtime = 'warning';
          issues.push(`Realtime 에러가 24시간 내 ${realtimeStats.error_count_24h}건 발생했습니다`);
        }
      }

      // 전체 상태 결정
      const statuses = [database, cache, connections, security, storage, edgeFunctions, realtime];
      let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (statuses.some(s => s === 'critical')) {
        overall = 'critical';
      } else if (statuses.some(s => s === 'warning')) {
        overall = 'warning';
      }

      return {
        database,
        cache,
        connections,
        security,
        storage,
        edgeFunctions,
        realtime,
        overall,
        issues,
      };
    },
    enabled:
      systemHealth !== undefined &&
      lockWaits !== undefined &&
      longRunningQueries !== undefined &&
      unusedIndexes !== undefined,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
