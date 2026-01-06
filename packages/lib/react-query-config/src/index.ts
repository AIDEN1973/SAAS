/**
 * React Query 캐싱 전략 중앙 관리 (SSOT)
 *
 * [불변 규칙] 모든 앱에서 동일한 캐싱 전략 사용
 * [업종중립] 업종에 독립적인 캐싱 설정
 * [SSOT] 단일 진실 공급원
 */

import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';
import { logger } from '@lib/error-tracking';

/**
 * 캐싱 전략 상수 (SSOT)
 */
export const CACHE_CONFIG = {
  /**
   * staleTime: 데이터가 "신선한" 상태로 유지되는 시간
   * 이 시간 동안은 다시 fetch하지 않음
   */
  STALE_TIME: {
    // 거의 변하지 않는 데이터 (설정, 메타데이터 등)
    STATIC: 10 * 60 * 1000, // 10분
    // 자주 변하는 데이터 (학생 목록, 출석 등)
    DYNAMIC: 30 * 1000, // 30초
    // 실시간 데이터 (채팅, 알림 등)
    REALTIME: 0, // 항상 새로고침
    // 느리게 변하는 데이터 (통계, 분석 등)
    SLOW: 5 * 60 * 1000, // 5분
  },

  /**
   * cacheTime (gcTime): 사용되지 않는 캐시가 메모리에서 삭제되기까지의 시간
   */
  CACHE_TIME: {
    // 기본값 (5분)
    DEFAULT: 5 * 60 * 1000,
    // 긴 캐싱 (30분)
    LONG: 30 * 60 * 1000,
    // 짧은 캐싱 (1분)
    SHORT: 1 * 60 * 1000,
  },

  /**
   * 재시도 전략
   */
  RETRY: {
    // 기본 재시도 횟수
    DEFAULT: 1,
    // 중요한 API (3번 재시도)
    IMPORTANT: 3,
    // 재시도 안 함
    NO_RETRY: 0,
  },
} as const;

/**
 * Query Key 타입 (타입 안전성)
 */
export type QueryKeyType =
  | 'students'
  | 'classes'
  | 'teachers'
  | 'attendance'
  | 'billing'
  | 'notifications'
  | 'analytics'
  | 'settings'
  | 'auth'
  | 'tenant'
  | 'tags'
  | 'tasks';

/**
 * Query Key Factory (SSOT)
 * 모든 Query Key는 이 팩토리를 통해 생성
 */
export const queryKeys = {
  // 인증
  auth: {
    all: ['auth'] as const,
    session: () => ['auth', 'session'] as const,
    user: () => ['auth', 'user'] as const,
    role: () => ['auth', 'role'] as const,
  },

  // 테넌트
  tenant: {
    all: ['tenant'] as const,
    current: () => ['tenant', 'current'] as const,
    settings: () => ['tenant', 'settings'] as const,
  },

  // 학생
  students: {
    all: ['students'] as const,
    lists: () => ['students', 'list'] as const,
    list: (filters?: Record<string, unknown>) => ['students', 'list', filters] as const,
    detail: (id: string) => ['students', 'detail', id] as const,
    stats: () => ['students', 'stats'] as const,
  },

  // 수업
  classes: {
    all: ['classes'] as const,
    lists: () => ['classes', 'list'] as const,
    list: (filters?: Record<string, unknown>) => ['classes', 'list', filters] as const,
    detail: (id: string) => ['classes', 'detail', id] as const,
  },

  // 교사
  teachers: {
    all: ['teachers'] as const,
    lists: () => ['teachers', 'list'] as const,
    list: (filters?: Record<string, unknown>) => ['teachers', 'list', filters] as const,
    detail: (id: string) => ['teachers', 'detail', id] as const,
  },

  // 출석
  attendance: {
    all: ['attendance'] as const,
    lists: () => ['attendance', 'list'] as const,
    list: (filters?: Record<string, unknown>) => ['attendance', 'list', filters] as const,
    byStudent: (studentId: string) => ['attendance', 'student', studentId] as const,
    byClass: (classId: string) => ['attendance', 'class', classId] as const,
  },

  // 결제
  billing: {
    all: ['billing'] as const,
    lists: () => ['billing', 'list'] as const,
    list: (filters?: Record<string, unknown>) => ['billing', 'list', filters] as const,
    detail: (id: string) => ['billing', 'detail', id] as const,
    stats: () => ['billing', 'stats'] as const,
  },

  // 알림
  notifications: {
    all: ['notifications'] as const,
    lists: () => ['notifications', 'list'] as const,
    list: (filters?: Record<string, unknown>) => ['notifications', 'list', filters] as const,
    unread: () => ['notifications', 'unread'] as const,
  },

  // 분석
  analytics: {
    all: ['analytics'] as const,
    dashboard: () => ['analytics', 'dashboard'] as const,
    revenue: (period?: string) => ['analytics', 'revenue', period] as const,
    attendance: (period?: string) => ['analytics', 'attendance', period] as const,
  },

  // 설정
  settings: {
    all: ['settings'] as const,
    general: () => ['settings', 'general'] as const,
    automation: () => ['settings', 'automation'] as const,
    alimtalk: () => ['settings', 'alimtalk'] as const,
  },

  // 태그
  tags: {
    all: ['tags'] as const,
    lists: () => ['tags', 'list'] as const,
    list: (filters?: Record<string, unknown>) => ['tags', 'list', filters] as const,
  },

  // 작업
  tasks: {
    all: ['tasks'] as const,
    lists: () => ['tasks', 'list'] as const,
    list: (filters?: Record<string, unknown>) => ['tasks', 'list', filters] as const,
    detail: (id: string) => ['tasks', 'detail', id] as const,
  },
} as const;

/**
 * React Query 기본 설정 (SSOT)
 */
export const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // 기본 staleTime: 동적 데이터 (30초)
      staleTime: CACHE_CONFIG.STALE_TIME.DYNAMIC,

      // 기본 cacheTime: 5분
      gcTime: CACHE_CONFIG.CACHE_TIME.DEFAULT,

      // 윈도우 포커스 시 자동 재검증 비활성화
      // (필요한 경우 개별 쿼리에서 활성화)
      refetchOnWindowFocus: false,

      // 마운트 시 재검증 비활성화
      refetchOnMount: false,

      // 재연결 시 자동 재검증
      refetchOnReconnect: true,

      // 기본 재시도 횟수
      retry: CACHE_CONFIG.RETRY.DEFAULT,

      // 재시도 지연 (지수 백오프)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // 에러 핸들링
      onError: (error) => {
        logger.error('ReactQuery', 'Query failed', error);
      },
    },

    mutations: {
      // Mutation 에러 핸들링
      onError: (error) => {
        logger.error('ReactQuery', 'Mutation failed', error);
      },

      // Mutation 성공 시 관련 쿼리 무효화
      // (개별 Mutation에서 설정)
    },
  },
};

/**
 * QueryClient 인스턴스 생성 함수 (SSOT)
 */
export function createQueryClient(): QueryClient {
  return new QueryClient(queryClientConfig);
}

/**
 * 개발 도구 설정
 */
export const devToolsConfig = {
  initialIsOpen: false,
  position: 'bottom-right' as const,
};

/**
 * 캐시 무효화 헬퍼 함수
 */
export const cacheInvalidation = {
  /**
   * 특정 리소스의 모든 캐시 무효화
   */
  invalidateAll: (queryClient: QueryClient, resource: QueryKeyType) => {
    const key = queryKeys[resource]?.all;
    if (key) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  },

  /**
   * 특정 리소스의 리스트 캐시 무효화
   */
  invalidateLists: (queryClient: QueryClient, resource: QueryKeyType) => {
    const key = queryKeys[resource]?.lists?.();
    if (key) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  },

  /**
   * 특정 리소스의 상세 캐시 무효화
   */
  invalidateDetail: (queryClient: QueryClient, resource: QueryKeyType, id: string) => {
    const keyFactory = queryKeys[resource]?.detail;
    if (keyFactory && typeof keyFactory === 'function') {
      queryClient.invalidateQueries({ queryKey: keyFactory(id) });
    }
  },

  /**
   * 여러 리소스 동시 무효화
   */
  invalidateMultiple: (queryClient: QueryClient, resources: QueryKeyType[]) => {
    resources.forEach((resource) => {
      cacheInvalidation.invalidateAll(queryClient, resource);
    });
  },
};

/**
 * Prefetch 헬퍼 함수
 */
export const prefetchHelpers = {
  /**
   * 리스트 페이지 prefetch
   */
  prefetchList: async (
    queryClient: QueryClient,
    resource: QueryKeyType,
    fetcher: () => Promise<unknown>,
    filters?: Record<string, unknown>
  ) => {
    const keyFactory = queryKeys[resource]?.list;
    if (keyFactory && typeof keyFactory === 'function') {
      await queryClient.prefetchQuery({
        queryKey: keyFactory(filters),
        queryFn: fetcher,
      });
    }
  },

  /**
   * 상세 페이지 prefetch
   */
  prefetchDetail: async (
    queryClient: QueryClient,
    resource: QueryKeyType,
    id: string,
    fetcher: () => Promise<unknown>
  ) => {
    const keyFactory = queryKeys[resource]?.detail;
    if (keyFactory && typeof keyFactory === 'function') {
      await queryClient.prefetchQuery({
        queryKey: keyFactory(id),
        queryFn: fetcher,
      });
    }
  },
};
