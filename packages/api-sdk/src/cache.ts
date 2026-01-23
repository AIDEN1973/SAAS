/**
 * API SDK Cache Layer
 *
 * 클라이언트 사이드 캐싱 전략
 * - React Query와 함께 사용
 * - stale-while-revalidate 패턴
 * - 자동 캐시 무효화
 *
 * [불변 규칙] React Query의 캐싱과 중복되지 않도록 주의
 * [불변 규칙] 이 캐시는 React Query 외부에서 필요한 경우만 사용
 */

/**
 * 캐시 TTL 상수 (밀리초)
 * React Query의 staleTime과 동기화 권장
 */
export const CACHE_TTL = {
  /** 빈번하게 변경되는 데이터 */
  SHORT: 30 * 1000, // 30초
  /** 일반 데이터 */
  MEDIUM: 5 * 60 * 1000, // 5분
  /** 설정/메타데이터 */
  LONG: 15 * 60 * 1000, // 15분
  /** 스키마 레지스트리 */
  SCHEMA: 60 * 60 * 1000, // 1시간
} as const;

/**
 * React Query 쿼리 키 팩토리
 * 일관된 쿼리 키 생성을 위한 SSOT
 */
export const queryKeys = {
  // 학생 관련
  students: {
    all: (tenantId: string) => ['students', tenantId] as const,
    list: (tenantId: string, filters?: Record<string, unknown>) =>
      ['students', tenantId, 'list', filters] as const,
    detail: (tenantId: string, studentId: string) =>
      ['students', tenantId, 'detail', studentId] as const,
    stats: (tenantId: string) => ['students', tenantId, 'stats'] as const,
  },

  // 수업 관련
  classes: {
    all: (tenantId: string) => ['classes', tenantId] as const,
    list: (tenantId: string, filters?: Record<string, unknown>) =>
      ['classes', tenantId, 'list', filters] as const,
    detail: (tenantId: string, classId: string) =>
      ['classes', tenantId, 'detail', classId] as const,
  },

  // 출결 관련
  attendance: {
    all: (tenantId: string) => ['attendance', tenantId] as const,
    daily: (tenantId: string, date: string) =>
      ['attendance', tenantId, 'daily', date] as const,
    stats: (tenantId: string, date: string) =>
      ['attendance', tenantId, 'stats', date] as const,
  },

  // 대시보드 관련
  dashboard: {
    all: (tenantId: string) => ['dashboard', tenantId] as const,
    stats: (tenantId: string) => ['dashboard', tenantId, 'stats'] as const,
    alerts: (tenantId: string) => ['dashboard', tenantId, 'alerts'] as const,
    activities: (tenantId: string) =>
      ['dashboard', tenantId, 'activities'] as const,
  },

  // 설정 관련
  settings: {
    all: (tenantId: string) => ['settings', tenantId] as const,
    automation: (tenantId: string) =>
      ['settings', tenantId, 'automation'] as const,
    notifications: (tenantId: string) =>
      ['settings', tenantId, 'notifications'] as const,
  },

  // 스키마 관련
  schema: {
    all: () => ['schema'] as const,
    entity: (entity: string, industryType: string, type: string) =>
      ['schema', entity, industryType, type] as const,
  },

  // 분석 관련
  analytics: {
    all: (tenantId: string) => ['analytics', tenantId] as const,
    regional: (tenantId: string, dateRange: string) =>
      ['analytics', tenantId, 'regional', dateRange] as const,
    store: (tenantId: string, dateRange: string) =>
      ['analytics', tenantId, 'store', dateRange] as const,
  },
} as const;

/**
 * 캐시 무효화 헬퍼
 * React Query의 queryClient.invalidateQueries와 함께 사용
 *
 * @example
 * // 학생 추가 후
 * queryClient.invalidateQueries({
 *   queryKey: getCacheInvalidationKeys.onStudentChange(tenantId)
 * });
 */
export const getCacheInvalidationKeys = {
  /** 학생 변경 시 무효화할 쿼리 키들 */
  onStudentChange: (tenantId: string) => [
    queryKeys.students.all(tenantId),
    queryKeys.dashboard.stats(tenantId),
    queryKeys.analytics.all(tenantId),
  ],

  /** 수업 변경 시 무효화할 쿼리 키들 */
  onClassChange: (tenantId: string) => [
    queryKeys.classes.all(tenantId),
    queryKeys.students.all(tenantId), // 학생-수업 관계
    queryKeys.dashboard.stats(tenantId),
  ],

  /** 출결 변경 시 무효화할 쿼리 키들 */
  onAttendanceChange: (tenantId: string, date: string) => [
    queryKeys.attendance.all(tenantId),
    queryKeys.attendance.daily(tenantId, date),
    queryKeys.dashboard.stats(tenantId),
    queryKeys.analytics.all(tenantId),
  ],

  /** 설정 변경 시 무효화할 쿼리 키들 */
  onSettingsChange: (tenantId: string) => [
    queryKeys.settings.all(tenantId),
    queryKeys.dashboard.all(tenantId), // 설정이 대시보드에 영향
  ],
};

/**
 * React Query 기본 옵션
 * 앱 전체에서 일관된 캐싱 동작을 위한 SSOT
 */
export const defaultQueryOptions = {
  /** 빈번하게 변경되는 데이터 (출결, 알림) */
  realtime: {
    staleTime: CACHE_TTL.SHORT,
    gcTime: CACHE_TTL.MEDIUM, // cacheTime -> gcTime (v5)
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  },

  /** 일반 데이터 (학생, 수업 목록) */
  standard: {
    staleTime: CACHE_TTL.MEDIUM,
    gcTime: CACHE_TTL.LONG,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always' as const,
  },

  /** 느리게 변경되는 데이터 (설정) */
  static: {
    staleTime: CACHE_TTL.LONG,
    gcTime: CACHE_TTL.SCHEMA,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  },

  /** 스키마/메타데이터 */
  schema: {
    staleTime: CACHE_TTL.SCHEMA,
    gcTime: 24 * 60 * 60 * 1000, // 24시간
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  },
} as const;
