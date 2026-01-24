/**
 * useBusinessMetrics
 *
 * 비즈니스 메트릭 관리 Hook
 * Phase 1-3 모든 메트릭 조회 통합
 */

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@lib/supabase-client';

// Supabase 클라이언트 싱글톤
const supabase = createClient();

// ============================================================================
// Types
// ============================================================================

export interface TenantWithStats {
  out_tenant_id: string;
  out_tenant_name: string;
  out_industry_type: 'academy' | 'salon' | 'real_estate' | 'gym' | 'ngo';
  out_plan: 'basic' | 'premium' | 'enterprise';
  out_status: 'active' | 'paused' | 'closed' | 'deleting';
  out_created_at: string;
  out_user_count: number;
  out_last_login_at: string | null;
  out_student_count: number;
  out_attendance_count_7d: number;
}

export interface TenantDetail {
  tenant: {
    id: string;
    name: string;
    industry_type: string;
    plan: string;
    status: string;
    created_at: string;
  };
  users: {
    total_users: number;
    by_role: Record<string, number>;
  };
  activity: {
    last_login: string | null;
    active_users_7d: number;
    active_users_30d: number;
  };
}

export interface BusinessMetrics {
  platform_overview: {
    total_tenants: number;
    active_tenants: number;
    new_tenants_this_month: number;
    at_risk_tenants: number;
  };
  plan_distribution: Record<string, number>;
  user_activity: {
    total_users: number;
    dau: number;
    wau: number;
    mau: number;
  };
  health_summary: {
    healthy: number;
    warning: number;
    critical: number;
  };
  generated_at: string;
}

export interface TenantHealthScore {
  out_tenant_id: string;
  out_tenant_name: string;
  out_health_score: number;
  out_health_status: 'healthy' | 'warning' | 'critical';
  out_days_since_login: number;
  out_user_count: number;
  out_student_count: number;
  out_attendance_logs_7d: number;
}

export interface RevenueAnalytics {
  mrr_current: number;
  mrr_previous: number;
  mrr_growth: number;
  arr: number;
  churn_rate: number;
  monthly_revenue: Array<{
    month: string;
    revenue: number;
    new_subscriptions: number;
    cancellations: number;
  }>;
}

export interface RegionalAnalytics {
  out_region: string;
  out_tenant_count: number;
  out_total_students: number;
  out_avg_students: number;
  out_total_revenue: number;
  out_market_share: number;
}

// ============================================================================
// Phase 1: 테넌트 목록 & 상세
// ============================================================================

/**
 * 테넌트 목록 + 기본 통계
 */
export function useTenants() {
  return useQuery<TenantWithStats[]>({
    queryKey: ['tenants', 'with-stats'],
    queryFn: async () => {
      const result = await supabase.rpc('get_tenants_with_stats');

      if (result.error) throw result.error;
      return result.data as TenantWithStats[];
    },
    staleTime: 30 * 1000, // 30초
    gcTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * 테넌트 상세 정보
 */
export function useTenantDetail(tenantId: string | null) {
  return useQuery<TenantDetail>({
    queryKey: ['tenant-detail', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('tenant_id required');

      const result = await supabase.rpc('get_tenant_detail', {
        p_tenant_id: tenantId,
      });

      if (result.error) throw result.error;
      return result.data as TenantDetail;
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Phase 2: 비즈니스 메트릭 대시보드
// ============================================================================

/**
 * 전체 비즈니스 메트릭
 */
export function useBusinessMetrics() {
  return useQuery<BusinessMetrics>({
    queryKey: ['business-metrics'],
    queryFn: async () => {
      const result = await supabase.rpc('get_business_metrics');

      if (result.error) throw result.error;
      return result.data as BusinessMetrics;
    },
    staleTime: 60 * 1000, // 1분
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000, // 1분마다 자동 갱신
  });
}

/**
 * 테넌트 건강도 스코어
 */
export function useTenantHealthScores() {
  return useQuery<TenantHealthScore[]>({
    queryKey: ['tenant-health-scores'],
    queryFn: async () => {
      const result = await supabase.rpc('get_tenant_health_scores');

      if (result.error) throw result.error;
      return result.data as TenantHealthScore[];
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Phase 3: 매출 & 지역 분석
// ============================================================================

/**
 * 매출 분석
 */
export function useRevenueAnalytics(
  startDate?: Date,
  endDate?: Date
) {
  return useQuery<RevenueAnalytics>({
    queryKey: ['revenue-analytics', startDate, endDate],
    queryFn: async () => {
      const result = await supabase.rpc('get_revenue_analytics', {
        p_start_date: startDate?.toISOString().split('T')[0],
        p_end_date: endDate?.toISOString().split('T')[0],
      });

      if (result.error) throw result.error;
      return result.data as RevenueAnalytics;
    },
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * 지역별 분석
 */
export function useRegionalAnalytics() {
  return useQuery<RegionalAnalytics[]>({
    queryKey: ['regional-analytics'],
    queryFn: async () => {
      const result = await supabase.rpc('get_regional_analytics');

      if (result.error) throw result.error;
      return result.data as RegionalAnalytics[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}
