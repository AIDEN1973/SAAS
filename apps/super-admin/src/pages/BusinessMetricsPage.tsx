/**
 * 비즈니스 메트릭 대시보드 (Phase 2)
 *
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용 (CSS 변수)
 * [불변 규칙] Tailwind CSS 사용 금지 - SSOT 준수
 *
 * 플랫폼 전체 건강도 및 성장 지표
 * - 플랫폼 개요 (총 테넌트, 활성 테넌트, 신규, 위험)
 * - 플랜 분포
 * - 사용자 활동 (DAU, WAU, MAU)
 * - 테넌트 건강도 스코어
 */

import { useState, createElement } from 'react';
import { Card, ErrorBoundary } from '@ui-core/react';
import { useBusinessMetrics, useTenantHealthScores } from '../hooks/useBusinessMetrics';
import {
  SuperAdminLayout,
  PageHeader,
  Section,
  CardGrid,
  StatCard,
  LoadingSkeleton,
} from '../components/SuperAdminLayout';
import {
  BUSINESS_METRICS_SUB_MENU_ITEMS,
  DEFAULT_BUSINESS_METRICS_SUB_MENU,
  BUSINESS_METRICS_RELATED_MENUS,
  type BusinessMetricsSubMenuId,
} from '../constants/sub-sidebar-menus';
import { Building2, Users, Activity, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

export function BusinessMetricsPage() {
  const { data: metrics, isLoading: metricsLoading } = useBusinessMetrics();
  const { data: healthScores, isLoading: healthLoading } = useTenantHealthScores();
  const [selectedSubMenu, setSelectedSubMenu] = useState<BusinessMetricsSubMenuId>(
    DEFAULT_BUSINESS_METRICS_SUB_MENU
  );

  const isLoading = metricsLoading || healthLoading;

  // 콘텐츠 렌더링
  const renderContent = () => {
    if (isLoading) {
      return <LoadingSkeleton cardCount={4} showTable />;
    }

    return (
      <>
        {/* 핵심 지표 탭 */}
        {selectedSubMenu === 'overview' && metrics && (
          <>
            <PageHeader
              title="비즈니스 메트릭"
              subtitle={`마지막 업데이트: ${
                metrics.generated_at
                  ? new Date(metrics.generated_at).toLocaleString('ko-KR')
                  : '-'
              }`}
            />

            {/* 플랫폼 개요 */}
            <Section title="플랫폼 개요">
              <CardGrid>
                <StatCard
                  title="총 테넌트"
                  value={metrics.platform_overview.total_tenants}
                  suffix="개"
                  icon={createElement(Building2, { size: 20 })}
                  color="info"
                />
                <StatCard
                  title="활성 테넌트"
                  value={metrics.platform_overview.active_tenants}
                  suffix="개"
                  change={
                    (metrics.platform_overview.active_tenants /
                      metrics.platform_overview.total_tenants) *
                    100
                  }
                  changeLabel="활성률"
                  icon={createElement(Activity, { size: 20 })}
                  color="success"
                />
                <StatCard
                  title="신규 가입 (이번 달)"
                  value={metrics.platform_overview.new_tenants_this_month}
                  suffix="개"
                  icon={createElement(TrendingUp, { size: 20 })}
                  color="secondary"
                />
                <StatCard
                  title="이탈 위험"
                  value={metrics.platform_overview.at_risk_tenants}
                  suffix="개"
                  icon={createElement(AlertTriangle, { size: 20 })}
                  color={metrics.platform_overview.at_risk_tenants > 0 ? 'error' : 'success'}
                />
              </CardGrid>
            </Section>

            {/* 사용자 활동 */}
            <Section title="사용자 활동">
              <CardGrid>
                <StatCard
                  title="총 사용자"
                  value={metrics.user_activity.total_users}
                  suffix="명"
                  icon={createElement(Users, { size: 20 })}
                  color="primary"
                />
                <StatCard
                  title="DAU (일간 활성)"
                  value={metrics.user_activity.dau}
                  suffix="명"
                  change={
                    metrics.user_activity.total_users > 0
                      ? (metrics.user_activity.dau / metrics.user_activity.total_users) * 100
                      : 0
                  }
                  changeLabel="일간 활성률"
                  color="info"
                />
                <StatCard
                  title="WAU (주간 활성)"
                  value={metrics.user_activity.wau}
                  suffix="명"
                  change={
                    metrics.user_activity.total_users > 0
                      ? (metrics.user_activity.wau / metrics.user_activity.total_users) * 100
                      : 0
                  }
                  changeLabel="주간 활성률"
                  color="success"
                />
                <StatCard
                  title="MAU (월간 활성)"
                  value={metrics.user_activity.mau}
                  suffix="명"
                  change={
                    metrics.user_activity.total_users > 0
                      ? (metrics.user_activity.mau / metrics.user_activity.total_users) * 100
                      : 0
                  }
                  changeLabel="월간 활성률"
                  color="secondary"
                />
              </CardGrid>
            </Section>

            {/* 테넌트 건강도 */}
            <Section title="테넌트 건강도">
              <CardGrid minCardWidth="150px">
                <HealthCard status="healthy" count={metrics.health_summary.healthy} label="정상" />
                <HealthCard status="warning" count={metrics.health_summary.warning} label="주의" />
                <HealthCard
                  status="critical"
                  count={metrics.health_summary.critical}
                  label="위험"
                />
              </CardGrid>
            </Section>
          </>
        )}

        {/* 성장 추이 탭 */}
        {selectedSubMenu === 'growth' && metrics && (
          <>
            <PageHeader title="성장 추이" subtitle="테넌트 성장 및 활동 추이" />

            <Section title="신규 테넌트 현황">
              <CardGrid>
                <StatCard
                  title="이번 달 신규"
                  value={metrics.platform_overview.new_tenants_this_month}
                  suffix="개"
                  icon={createElement(TrendingUp, { size: 20 })}
                  color="success"
                />
                <StatCard
                  title="성장률"
                  value={
                    metrics.platform_overview.total_tenants > 0
                      ? (
                          (metrics.platform_overview.new_tenants_this_month /
                            (metrics.platform_overview.total_tenants -
                              metrics.platform_overview.new_tenants_this_month)) *
                          100
                        ).toFixed(1)
                      : 0
                  }
                  suffix="%"
                  icon={createElement(TrendingUp, { size: 20 })}
                  color="info"
                />
              </CardGrid>
            </Section>

            <Section title="플랜 분포">
              <Card padding="lg" variant="outlined">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(var(--width-metric-card-min), 1fr))',
                    gap: 'var(--spacing-lg)',
                  }}
                >
                  {Object.entries(metrics.plan_distribution || {}).map(([plan, count]) => (
                    <div key={plan} style={{ textAlign: 'center' }}>
                      <p
                        style={{
                          fontSize: 'var(--font-size-3xl)',
                          fontWeight: 'var(--font-weight-bold)',
                          color: 'var(--color-text)',
                          margin: 0,
                        }}
                      >
                        {count}
                      </p>
                      <p
                        style={{
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--color-text-secondary)',
                          textTransform: 'uppercase',
                          margin: 0,
                          marginTop: 'var(--spacing-xxs)',
                        }}
                      >
                        {plan}
                      </p>
                      <p
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-text-secondary)',
                          margin: 0,
                          marginTop: 'var(--spacing-xxs)',
                        }}
                      >
                        {((count / metrics.platform_overview.active_tenants) * 100).toFixed(1)}%
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </Section>
          </>
        )}

        {/* 사용자 활동 탭 */}
        {selectedSubMenu === 'engagement' && metrics && (
          <>
            <PageHeader title="사용자 활동" subtitle="사용자 참여도 및 활동 지표" />

            <Section title="활성 사용자 현황">
              <CardGrid>
                <StatCard
                  title="총 사용자"
                  value={metrics.user_activity.total_users}
                  suffix="명"
                  icon={createElement(Users, { size: 20 })}
                  color="primary"
                />
                <StatCard
                  title="DAU"
                  value={metrics.user_activity.dau}
                  suffix="명"
                  change={
                    metrics.user_activity.total_users > 0
                      ? (metrics.user_activity.dau / metrics.user_activity.total_users) * 100
                      : 0
                  }
                  changeLabel="활성률"
                  color="info"
                />
                <StatCard
                  title="WAU"
                  value={metrics.user_activity.wau}
                  suffix="명"
                  change={
                    metrics.user_activity.total_users > 0
                      ? (metrics.user_activity.wau / metrics.user_activity.total_users) * 100
                      : 0
                  }
                  changeLabel="활성률"
                  color="success"
                />
                <StatCard
                  title="MAU"
                  value={metrics.user_activity.mau}
                  suffix="명"
                  change={
                    metrics.user_activity.total_users > 0
                      ? (metrics.user_activity.mau / metrics.user_activity.total_users) * 100
                      : 0
                  }
                  changeLabel="활성률"
                  color="secondary"
                />
              </CardGrid>
            </Section>

            <Section title="참여율 분석">
              <CardGrid>
                <StatCard
                  title="일간/주간 전환율"
                  value={
                    metrics.user_activity.wau > 0
                      ? ((metrics.user_activity.dau / metrics.user_activity.wau) * 100).toFixed(1)
                      : 0
                  }
                  suffix="%"
                  color="info"
                />
                <StatCard
                  title="주간/월간 전환율"
                  value={
                    metrics.user_activity.mau > 0
                      ? ((metrics.user_activity.wau / metrics.user_activity.mau) * 100).toFixed(1)
                      : 0
                  }
                  suffix="%"
                  color="success"
                />
                <StatCard
                  title="평균 사용자/테넌트"
                  value={
                    metrics.platform_overview.total_tenants > 0
                      ? (
                          metrics.user_activity.total_users / metrics.platform_overview.total_tenants
                        ).toFixed(1)
                      : 0
                  }
                  suffix="명"
                  color="secondary"
                />
              </CardGrid>
            </Section>
          </>
        )}

        {/* 이탈 분석 탭 */}
        {selectedSubMenu === 'churn' && (
          <>
            <PageHeader title="이탈 분석" subtitle="테넌트 건강도 및 이탈 위험 분석" />

            {metrics && (
              <Section title="이탈 위험 현황">
                <CardGrid>
                  <StatCard
                    title="이탈 위험 테넌트"
                    value={metrics.platform_overview.at_risk_tenants}
                    suffix="개"
                    icon={createElement(AlertTriangle, { size: 20 })}
                    color={metrics.platform_overview.at_risk_tenants > 0 ? 'error' : 'success'}
                  />
                  <StatCard
                    title="위험율"
                    value={
                      metrics.platform_overview.total_tenants > 0
                        ? (
                            (metrics.platform_overview.at_risk_tenants /
                              metrics.platform_overview.total_tenants) *
                            100
                          ).toFixed(1)
                        : 0
                    }
                    suffix="%"
                    icon={createElement(TrendingDown, { size: 20 })}
                    color={metrics.platform_overview.at_risk_tenants > 0 ? 'warning' : 'success'}
                  />
                </CardGrid>
              </Section>
            )}

            {/* 건강도 상세 목록 */}
            {healthScores && healthScores.length > 0 && (
              <Section title="건강도 상세 목록">
                <Card padding="xs" variant="outlined" style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 'var(--font-size-sm)',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            backgroundColor: 'var(--color-gray-50)',
                            borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
                          }}
                        >
                          <th style={tableHeaderStyle}>테넌트</th>
                          <th style={tableHeaderStyle}>건강도 점수</th>
                          <th style={tableHeaderStyle}>마지막 로그인</th>
                          <th style={tableHeaderStyle}>사용자/학생</th>
                          <th style={tableHeaderStyle}>출결 (7일)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {healthScores.map((score) => (
                          <tr
                            key={score.out_tenant_id}
                            style={{
                              borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
                            }}
                          >
                            <td style={tableCellStyle}>
                              <span
                                style={{
                                  fontWeight: 'var(--font-weight-medium)',
                                  color: 'var(--color-text)',
                                }}
                              >
                                {score.out_tenant_name}
                              </span>
                            </td>
                            <td style={tableCellStyle}>
                              <HealthBadge
                                status={score.out_health_status}
                                score={score.out_health_score}
                              />
                            </td>
                            <td style={{ ...tableCellStyle, color: 'var(--color-text-secondary)' }}>
                              {score.out_days_since_login === 999
                                ? '없음'
                                : `${score.out_days_since_login}일 전`}
                            </td>
                            <td style={{ ...tableCellStyle, color: 'var(--color-text-secondary)' }}>
                              {score.out_user_count}명 / {score.out_student_count}명
                            </td>
                            <td style={{ ...tableCellStyle, color: 'var(--color-text-secondary)' }}>
                              {score.out_attendance_logs_7d}건
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </Section>
            )}
          </>
        )}
      </>
    );
  };

  return (
    <ErrorBoundary>
      <SuperAdminLayout
        title="비즈니스 메트릭"
        subMenuItems={BUSINESS_METRICS_SUB_MENU_ITEMS}
        defaultSubMenuId={DEFAULT_BUSINESS_METRICS_SUB_MENU}
        relatedMenus={BUSINESS_METRICS_RELATED_MENUS}
        selectedSubMenuId={selectedSubMenu}
        onSubMenuChange={setSelectedSubMenu}
      >
        {renderContent()}
      </SuperAdminLayout>
    </ErrorBoundary>
  );
}

// ============================================================================
// Styles
// ============================================================================

const tableHeaderStyle: React.CSSProperties = {
  padding: 'var(--spacing-sm) var(--spacing-md)',
  textAlign: 'left',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--letter-spacing-table-header)',
};

const tableCellStyle: React.CSSProperties = {
  padding: 'var(--spacing-md)',
  whiteSpace: 'nowrap',
};

// ============================================================================
// UI Components
// ============================================================================

interface HealthCardProps {
  status: 'healthy' | 'warning' | 'critical';
  count: number;
  label: string;
}

function HealthCard({ status, count, label }: HealthCardProps) {
  const statusStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    healthy: {
      bg: 'var(--color-success-50)',
      border: 'var(--color-success)',
      text: 'var(--color-success)',
      icon: '✓',
    },
    warning: {
      bg: 'var(--color-warning-50)',
      border: 'var(--color-warning)',
      text: 'var(--color-warning)',
      icon: '⚠',
    },
    critical: {
      bg: 'var(--color-error-50)',
      border: 'var(--color-error)',
      text: 'var(--color-error)',
      icon: '✗',
    },
  };

  const style = statusStyles[status];

  return (
    <div
      style={{
        borderRadius: 'var(--border-radius-md)',
        border: `var(--border-width-thin) solid ${style.border}`,
        padding: 'var(--spacing-lg)',
        backgroundColor: style.bg,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--spacing-xs)',
        }}
      >
        <span style={{ fontSize: 'var(--font-size-2xl)' }}>{style.icon}</span>
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            color: style.text,
          }}
        >
          {label}
        </span>
      </div>
      <p
        style={{
          fontSize: 'var(--font-size-3xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: style.text,
          margin: 0,
        }}
      >
        {count}
      </p>
    </div>
  );
}

interface HealthBadgeProps {
  status: 'healthy' | 'warning' | 'critical';
  score: number;
}

function HealthBadge({ status, score }: HealthBadgeProps) {
  const statusStyles: Record<string, { bg: string; text: string }> = {
    healthy: { bg: 'var(--color-success-50)', text: 'var(--color-success)' },
    warning: { bg: 'var(--color-warning-50)', text: 'var(--color-warning)' },
    critical: { bg: 'var(--color-error-50)', text: 'var(--color-error)' },
  };

  const style = statusStyles[status];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: 'var(--spacing-xxs) var(--spacing-sm)',
        borderRadius: 'var(--border-radius-full)',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-medium)',
        backgroundColor: style.bg,
        color: style.text,
      }}
    >
      {score}점
    </span>
  );
}
