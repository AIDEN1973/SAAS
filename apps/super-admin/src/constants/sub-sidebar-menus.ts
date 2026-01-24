/**
 * Super Admin 서브 사이드바 메뉴 설정
 *
 * [불변 규칙] 각 페이지의 서브 사이드바 메뉴 항목을 SSOT로 관리
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용
 */

import { createElement } from 'react';
import type { SubSidebarMenuItem, RelatedMenuSection } from '@ui-core/react';
import {
  Database,
  Activity,
  Building2,
  BarChart3,
  CircleDollarSign,
  MapPin,
  List,
  FileJson,
  Layers,
  Settings,
  Server,
  Cpu,
  HardDrive,
  Zap,
  Lock,
  AlertTriangle,
  Users,
  TrendingUp,
  TrendingDown,
  PieChart,
  Calendar,
  DollarSign,
  Globe,
  Building,
} from 'lucide-react';

/** 아이콘 크기 (CSS 변수 참조) */
const ICON_SIZE = 16;

// ============================================================================
// 메인 네비게이션 메뉴 설정
// ============================================================================

/** 메인 네비게이션 메뉴 ID */
export type MainNavMenuId =
  | 'schemas'
  | 'performance'
  | 'tenants'
  | 'business-metrics'
  | 'revenue'
  | 'regional';

/** 메인 네비게이션 메뉴 항목 */
export interface MainNavMenuItem {
  id: MainNavMenuId;
  label: string;
  path: string;
  icon: React.ReactNode;
  ariaLabel: string;
}

/** 메인 네비게이션 메뉴 설정 */
export const MAIN_NAV_MENU_ITEMS: MainNavMenuItem[] = [
  {
    id: 'schemas',
    label: '스키마 에디터',
    path: '/schemas',
    icon: createElement(Database, { size: ICON_SIZE }),
    ariaLabel: '스키마 에디터 페이지로 이동',
  },
  {
    id: 'performance',
    label: '성능 모니터링',
    path: '/performance',
    icon: createElement(Activity, { size: ICON_SIZE }),
    ariaLabel: '성능 모니터링 페이지로 이동',
  },
  {
    id: 'tenants',
    label: '테넌트 관리',
    path: '/tenants',
    icon: createElement(Building2, { size: ICON_SIZE }),
    ariaLabel: '테넌트 관리 페이지로 이동',
  },
  {
    id: 'business-metrics',
    label: '비즈니스 메트릭',
    path: '/business-metrics',
    icon: createElement(BarChart3, { size: ICON_SIZE }),
    ariaLabel: '비즈니스 메트릭 페이지로 이동',
  },
  {
    id: 'revenue',
    label: '매출 분석',
    path: '/revenue',
    icon: createElement(CircleDollarSign, { size: ICON_SIZE }),
    ariaLabel: '매출 분석 페이지로 이동',
  },
  {
    id: 'regional',
    label: '지역별 분석',
    path: '/regional',
    icon: createElement(MapPin, { size: ICON_SIZE }),
    ariaLabel: '지역별 분석 페이지로 이동',
  },
];

// ============================================================================
// 스키마 에디터 페이지 서브 메뉴 설정
// ============================================================================

/** 스키마 에디터 서브 메뉴 ID */
export type SchemaEditorSubMenuId =
  | 'list'
  | 'editor'
  | 'layouts'
  | 'settings';

/** 스키마 에디터 서브 메뉴 설정 */
export const SCHEMA_EDITOR_SUB_MENU_ITEMS: SubSidebarMenuItem<SchemaEditorSubMenuId>[] = [
  {
    id: 'list',
    label: '스키마 목록',
    icon: createElement(List, { size: ICON_SIZE }),
    ariaLabel: '스키마 목록 화면으로 이동',
  },
  {
    id: 'editor',
    label: '스키마 편집',
    icon: createElement(FileJson, { size: ICON_SIZE }),
    ariaLabel: '스키마 편집 화면으로 이동',
  },
  {
    id: 'layouts',
    label: '레이아웃 설정',
    icon: createElement(Layers, { size: ICON_SIZE }),
    ariaLabel: '레이아웃 설정 화면으로 이동',
  },
  {
    id: 'settings',
    label: '스키마 설정',
    icon: createElement(Settings, { size: ICON_SIZE }),
    ariaLabel: '스키마 설정 화면으로 이동',
  },
];

/** 기본 스키마 에디터 서브 메뉴 ID */
export const DEFAULT_SCHEMA_EDITOR_SUB_MENU: SchemaEditorSubMenuId = 'list';

/** 스키마 에디터 관련 메뉴 */
export const SCHEMA_EDITOR_RELATED_MENUS: RelatedMenuSection = {
  title: '관련 메뉴',
  items: [
    {
      id: 'performance',
      label: '성능 모니터링',
      icon: createElement(Activity, { size: ICON_SIZE }),
      ariaLabel: '성능 모니터링 페이지로 이동',
      href: '/performance',
    },
    {
      id: 'tenants',
      label: '테넌트 관리',
      icon: createElement(Building2, { size: ICON_SIZE }),
      ariaLabel: '테넌트 관리 페이지로 이동',
      href: '/tenants',
    },
  ],
};

// ============================================================================
// 성능 모니터링 페이지 서브 메뉴 설정
// ============================================================================

/** 성능 모니터링 서브 메뉴 ID */
export type PerformanceSubMenuId =
  | 'overview'
  | 'database'
  | 'edge-functions'
  | 'storage'
  | 'realtime'
  | 'auth'
  | 'errors'
  | 'optimization';

/** 성능 모니터링 서브 메뉴 설정 */
export const PERFORMANCE_SUB_MENU_ITEMS: SubSidebarMenuItem<PerformanceSubMenuId>[] = [
  {
    id: 'overview',
    label: '전체 현황',
    icon: createElement(Activity, { size: ICON_SIZE }),
    ariaLabel: '전체 현황 화면으로 이동',
  },
  {
    id: 'database',
    label: '데이터베이스',
    icon: createElement(Database, { size: ICON_SIZE }),
    ariaLabel: '데이터베이스 화면으로 이동',
  },
  {
    id: 'edge-functions',
    label: 'Edge Functions',
    icon: createElement(Zap, { size: ICON_SIZE }),
    ariaLabel: 'Edge Functions 화면으로 이동',
  },
  {
    id: 'storage',
    label: '스토리지',
    icon: createElement(HardDrive, { size: ICON_SIZE }),
    ariaLabel: '스토리지 화면으로 이동',
  },
  {
    id: 'realtime',
    label: 'Realtime',
    icon: createElement(Server, { size: ICON_SIZE }),
    ariaLabel: 'Realtime 화면으로 이동',
  },
  {
    id: 'auth',
    label: '인증',
    icon: createElement(Lock, { size: ICON_SIZE }),
    ariaLabel: '인증 화면으로 이동',
  },
  {
    id: 'errors',
    label: '에러 로그',
    icon: createElement(AlertTriangle, { size: ICON_SIZE }),
    ariaLabel: '에러 로그 화면으로 이동',
  },
  {
    id: 'optimization',
    label: '최적화 제안',
    icon: createElement(Cpu, { size: ICON_SIZE }),
    ariaLabel: '최적화 제안 화면으로 이동',
  },
];

/** 기본 성능 모니터링 서브 메뉴 ID */
export const DEFAULT_PERFORMANCE_SUB_MENU: PerformanceSubMenuId = 'overview';

/** 성능 모니터링 관련 메뉴 */
export const PERFORMANCE_RELATED_MENUS: RelatedMenuSection = {
  title: '관련 메뉴',
  items: [
    {
      id: 'schemas',
      label: '스키마 에디터',
      icon: createElement(Database, { size: ICON_SIZE }),
      ariaLabel: '스키마 에디터 페이지로 이동',
      href: '/schemas',
    },
    {
      id: 'tenants',
      label: '테넌트 관리',
      icon: createElement(Building2, { size: ICON_SIZE }),
      ariaLabel: '테넌트 관리 페이지로 이동',
      href: '/tenants',
    },
  ],
};

// ============================================================================
// 테넌트 관리 페이지 서브 메뉴 설정
// ============================================================================

/** 테넌트 관리 서브 메뉴 ID */
export type TenantsSubMenuId =
  | 'list'
  | 'health'
  | 'activity'
  | 'plans';

/** 테넌트 관리 서브 메뉴 설정 */
export const TENANTS_SUB_MENU_ITEMS: SubSidebarMenuItem<TenantsSubMenuId>[] = [
  {
    id: 'list',
    label: '테넌트 목록',
    icon: createElement(List, { size: ICON_SIZE }),
    ariaLabel: '테넌트 목록 화면으로 이동',
  },
  {
    id: 'health',
    label: '건강도 현황',
    icon: createElement(Activity, { size: ICON_SIZE }),
    ariaLabel: '건강도 현황 화면으로 이동',
  },
  {
    id: 'activity',
    label: '활동 로그',
    icon: createElement(Users, { size: ICON_SIZE }),
    ariaLabel: '활동 로그 화면으로 이동',
  },
  {
    id: 'plans',
    label: '플랜 분포',
    icon: createElement(PieChart, { size: ICON_SIZE }),
    ariaLabel: '플랜 분포 화면으로 이동',
  },
];

/** 기본 테넌트 관리 서브 메뉴 ID */
export const DEFAULT_TENANTS_SUB_MENU: TenantsSubMenuId = 'list';

/** 테넌트 관리 관련 메뉴 */
export const TENANTS_RELATED_MENUS: RelatedMenuSection = {
  title: '관련 메뉴',
  items: [
    {
      id: 'business-metrics',
      label: '비즈니스 메트릭',
      icon: createElement(BarChart3, { size: ICON_SIZE }),
      ariaLabel: '비즈니스 메트릭 페이지로 이동',
      href: '/business-metrics',
    },
    {
      id: 'performance',
      label: '성능 모니터링',
      icon: createElement(Activity, { size: ICON_SIZE }),
      ariaLabel: '성능 모니터링 페이지로 이동',
      href: '/performance',
    },
  ],
};

// ============================================================================
// 비즈니스 메트릭 페이지 서브 메뉴 설정
// ============================================================================

/** 비즈니스 메트릭 서브 메뉴 ID */
export type BusinessMetricsSubMenuId =
  | 'overview'
  | 'growth'
  | 'engagement'
  | 'churn';

/** 비즈니스 메트릭 서브 메뉴 설정 */
export const BUSINESS_METRICS_SUB_MENU_ITEMS: SubSidebarMenuItem<BusinessMetricsSubMenuId>[] = [
  {
    id: 'overview',
    label: '핵심 지표',
    icon: createElement(BarChart3, { size: ICON_SIZE }),
    ariaLabel: '핵심 지표 화면으로 이동',
  },
  {
    id: 'growth',
    label: '성장 추이',
    icon: createElement(TrendingUp, { size: ICON_SIZE }),
    ariaLabel: '성장 추이 화면으로 이동',
  },
  {
    id: 'engagement',
    label: '사용자 활동',
    icon: createElement(Users, { size: ICON_SIZE }),
    ariaLabel: '사용자 활동 화면으로 이동',
  },
  {
    id: 'churn',
    label: '이탈 분석',
    icon: createElement(TrendingDown, { size: ICON_SIZE }),
    ariaLabel: '이탈 분석 화면으로 이동',
  },
];

/** 기본 비즈니스 메트릭 서브 메뉴 ID */
export const DEFAULT_BUSINESS_METRICS_SUB_MENU: BusinessMetricsSubMenuId = 'overview';

/** 비즈니스 메트릭 관련 메뉴 */
export const BUSINESS_METRICS_RELATED_MENUS: RelatedMenuSection = {
  title: '관련 메뉴',
  items: [
    {
      id: 'revenue',
      label: '매출 분석',
      icon: createElement(CircleDollarSign, { size: ICON_SIZE }),
      ariaLabel: '매출 분석 페이지로 이동',
      href: '/revenue',
    },
    {
      id: 'regional',
      label: '지역별 분석',
      icon: createElement(MapPin, { size: ICON_SIZE }),
      ariaLabel: '지역별 분석 페이지로 이동',
      href: '/regional',
    },
    {
      id: 'tenants',
      label: '테넌트 관리',
      icon: createElement(Building2, { size: ICON_SIZE }),
      ariaLabel: '테넌트 관리 페이지로 이동',
      href: '/tenants',
    },
  ],
};

// ============================================================================
// 매출 분석 페이지 서브 메뉴 설정
// ============================================================================

/** 매출 분석 서브 메뉴 ID */
export type RevenueSubMenuId =
  | 'overview'
  | 'monthly'
  | 'subscriptions'
  | 'forecast';

/** 매출 분석 서브 메뉴 설정 */
export const REVENUE_SUB_MENU_ITEMS: SubSidebarMenuItem<RevenueSubMenuId>[] = [
  {
    id: 'overview',
    label: '매출 현황',
    icon: createElement(DollarSign, { size: ICON_SIZE }),
    ariaLabel: '매출 현황 화면으로 이동',
  },
  {
    id: 'monthly',
    label: '월별 추이',
    icon: createElement(Calendar, { size: ICON_SIZE }),
    ariaLabel: '월별 추이 화면으로 이동',
  },
  {
    id: 'subscriptions',
    label: '구독 현황',
    icon: createElement(Users, { size: ICON_SIZE }),
    ariaLabel: '구독 현황 화면으로 이동',
  },
  {
    id: 'forecast',
    label: '매출 예측',
    icon: createElement(TrendingUp, { size: ICON_SIZE }),
    ariaLabel: '매출 예측 화면으로 이동',
  },
];

/** 기본 매출 분석 서브 메뉴 ID */
export const DEFAULT_REVENUE_SUB_MENU: RevenueSubMenuId = 'overview';

/** 매출 분석 관련 메뉴 */
export const REVENUE_RELATED_MENUS: RelatedMenuSection = {
  title: '관련 메뉴',
  items: [
    {
      id: 'business-metrics',
      label: '비즈니스 메트릭',
      icon: createElement(BarChart3, { size: ICON_SIZE }),
      ariaLabel: '비즈니스 메트릭 페이지로 이동',
      href: '/business-metrics',
    },
    {
      id: 'regional',
      label: '지역별 분석',
      icon: createElement(MapPin, { size: ICON_SIZE }),
      ariaLabel: '지역별 분석 페이지로 이동',
      href: '/regional',
    },
  ],
};

// ============================================================================
// 지역별 분석 페이지 서브 메뉴 설정
// ============================================================================

/** 지역별 분석 서브 메뉴 ID */
export type RegionalSubMenuId =
  | 'overview'
  | 'tenants'
  | 'revenue'
  | 'market-share';

/** 지역별 분석 서브 메뉴 설정 */
export const REGIONAL_SUB_MENU_ITEMS: SubSidebarMenuItem<RegionalSubMenuId>[] = [
  {
    id: 'overview',
    label: '지역 현황',
    icon: createElement(Globe, { size: ICON_SIZE }),
    ariaLabel: '지역 현황 화면으로 이동',
  },
  {
    id: 'tenants',
    label: '지역별 테넌트',
    icon: createElement(Building, { size: ICON_SIZE }),
    ariaLabel: '지역별 테넌트 화면으로 이동',
  },
  {
    id: 'revenue',
    label: '지역별 매출',
    icon: createElement(CircleDollarSign, { size: ICON_SIZE }),
    ariaLabel: '지역별 매출 화면으로 이동',
  },
  {
    id: 'market-share',
    label: '시장 점유율',
    icon: createElement(PieChart, { size: ICON_SIZE }),
    ariaLabel: '시장 점유율 화면으로 이동',
  },
];

/** 기본 지역별 분석 서브 메뉴 ID */
export const DEFAULT_REGIONAL_SUB_MENU: RegionalSubMenuId = 'overview';

/** 지역별 분석 관련 메뉴 */
export const REGIONAL_RELATED_MENUS: RelatedMenuSection = {
  title: '관련 메뉴',
  items: [
    {
      id: 'tenants',
      label: '테넌트 관리',
      icon: createElement(Building2, { size: ICON_SIZE }),
      ariaLabel: '테넌트 관리 페이지로 이동',
      href: '/tenants',
    },
    {
      id: 'revenue',
      label: '매출 분석',
      icon: createElement(CircleDollarSign, { size: ICON_SIZE }),
      ariaLabel: '매출 분석 페이지로 이동',
      href: '/revenue',
    },
  ],
};

// ============================================================================
// 공통 유틸리티
// ============================================================================

/** URL 쿼리 파라미터 키 (tab) */
export const SUB_MENU_QUERY_PARAM = 'tab';

/**
 * URL 쿼리 파라미터에서 서브 메뉴 ID 추출
 * @param searchParams - URLSearchParams 객체
 * @param validIds - 유효한 ID 목록
 * @param defaultId - 기본 ID
 */
export function getSubMenuFromUrl<T extends string>(
  searchParams: URLSearchParams,
  validIds: readonly T[],
  defaultId: T
): T {
  const tabParam = searchParams.get(SUB_MENU_QUERY_PARAM);
  if (tabParam && validIds.includes(tabParam as T)) {
    return tabParam as T;
  }
  return defaultId;
}

/**
 * 서브 메뉴 ID를 URL 쿼리 파라미터로 설정
 * @param id - 서브 메뉴 ID
 * @param defaultId - 기본 ID (기본값이면 파라미터 제거)
 */
export function setSubMenuToUrl<T extends string>(
  id: T,
  defaultId: T
): string {
  const searchParams = new URLSearchParams(window.location.search);
  if (id === defaultId) {
    searchParams.delete(SUB_MENU_QUERY_PARAM);
  } else {
    searchParams.set(SUB_MENU_QUERY_PARAM, id);
  }
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : window.location.pathname;
}
