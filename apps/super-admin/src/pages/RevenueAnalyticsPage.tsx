/**
 * 매출 분석 페이지 (Phase 3)
 *
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용 (CSS 변수)
 * [불변 규칙] Tailwind CSS 사용 금지 - SSOT 준수
 *
 * subscriptions + billing_events 데이터 분석
 * - MRR (Monthly Recurring Revenue)
 * - ARR (Annual Recurring Revenue)
 * - Churn Rate
 * - 월별 매출 추이
 */

import { useState, createElement } from 'react';
import { Card, ErrorBoundary } from '@ui-core/react';
import { useRevenueAnalytics } from '../hooks/useBusinessMetrics';
import {
  SuperAdminLayout,
  PageHeader,
  Section,
  CardGrid,
  StatCard,
  LoadingSkeleton,
  EmptyState,
} from '../components/SuperAdminLayout';
import {
  REVENUE_SUB_MENU_ITEMS,
  DEFAULT_REVENUE_SUB_MENU,
  REVENUE_RELATED_MENUS,
  type RevenueSubMenuId,
} from '../constants/sub-sidebar-menus';
import { DollarSign, TrendingUp, TrendingDown, Users, Calendar, AlertTriangle } from 'lucide-react';

export function RevenueAnalyticsPage() {
  const [dateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 12)),
    end: new Date(),
  });
  const [selectedSubMenu, setSelectedSubMenu] = useState<RevenueSubMenuId>(DEFAULT_REVENUE_SUB_MENU);

  const { data: revenue, isLoading } = useRevenueAnalytics(dateRange.start, dateRange.end);

  // 데이터 없음 처리
  const hasData = revenue && (revenue.mrr_current > 0 || revenue.monthly_revenue?.length > 0);

  // 콘텐츠 렌더링
  const renderContent = () => {
    if (isLoading) {
      return <LoadingSkeleton cardCount={4} showTable />;
    }

    if (!hasData) {
      return (
        <>
          <PageHeader
            title="매출 분석"
            dateRange={dateRange}
          />
          <EmptyState
            title="매출 데이터가 없습니다"
            description="구독이 생성되고 과금 이벤트가 발생하면 데이터가 표시됩니다."
            icon={createElement(DollarSign, { size: 48 })}
          />
        </>
      );
    }

    return (
      <>
        {/* 매출 현황 탭 */}
        {selectedSubMenu === 'overview' && (
          <>
            <PageHeader
              title="매출 분석"
              dateRange={dateRange}
            />

            {/* 핵심 KPI */}
            <Section title="핵심 지표">
              <CardGrid>
                <RevenueCard
                  title="MRR (월간 반복 매출)"
                  value={revenue.mrr_current}
                  previousValue={revenue.mrr_previous}
                  growth={revenue.mrr_growth}
                  currency
                />
                <StatCard
                  title="ARR (연간 반복 매출)"
                  value={revenue.arr}
                  prefix="₩"
                  icon={createElement(Calendar, { size: 20 })}
                  color="info"
                />
                <StatCard
                  title="MRR 성장률"
                  value={revenue.mrr_growth}
                  suffix="%"
                  icon={createElement(
                    revenue.mrr_growth >= 0 ? TrendingUp : TrendingDown,
                    { size: 20 }
                  )}
                  color={revenue.mrr_growth > 0 ? 'success' : revenue.mrr_growth < 0 ? 'error' : 'default'}
                />
                <StatCard
                  title="Churn Rate (해지율)"
                  value={revenue.churn_rate}
                  suffix="%"
                  icon={createElement(AlertTriangle, { size: 20 })}
                  color={
                    revenue.churn_rate > 5
                      ? 'error'
                      : revenue.churn_rate > 2
                      ? 'warning'
                      : 'success'
                  }
                />
              </CardGrid>
            </Section>

            {/* 월별 요약 */}
            {revenue.monthly_revenue && revenue.monthly_revenue.length > 0 && (
              <Section title="월별 매출 요약">
                <CardGrid minCardWidth="200px">
                  <StatCard
                    title="총 매출"
                    value={revenue.monthly_revenue.reduce((sum, m) => sum + Number(m.revenue), 0)}
                    prefix="₩"
                    icon={createElement(DollarSign, { size: 20 })}
                    color="primary"
                  />
                  <StatCard
                    title="총 신규 구독"
                    value={revenue.monthly_revenue.reduce((sum, m) => sum + m.new_subscriptions, 0)}
                    suffix="건"
                    icon={createElement(TrendingUp, { size: 20 })}
                    color="success"
                  />
                  <StatCard
                    title="총 해지"
                    value={revenue.monthly_revenue.reduce((sum, m) => sum + m.cancellations, 0)}
                    suffix="건"
                    icon={createElement(TrendingDown, { size: 20 })}
                    color="error"
                  />
                </CardGrid>
              </Section>
            )}
          </>
        )}

        {/* 월별 추이 탭 */}
        {selectedSubMenu === 'monthly' && (
          <>
            <PageHeader
              title="월별 추이"
              subtitle="월별 매출 및 구독 변동 현황"
            />

            {revenue.monthly_revenue && revenue.monthly_revenue.length > 0 && (
              <Section title="월별 매출 추이">
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
                          <th style={tableHeaderStyle}>월</th>
                          <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>매출</th>
                          <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>신규 구독</th>
                          <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>해지</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenue.monthly_revenue.map((month) => (
                          <tr
                            key={month.month}
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
                                {new Date(month.month).toLocaleDateString('ko-KR', {
                                  year: 'numeric',
                                  month: 'long',
                                })}
                              </span>
                            </td>
                            <td
                              style={{
                                ...tableCellStyle,
                                textAlign: 'right',
                                fontWeight: 'var(--font-weight-semibold)',
                                color: 'var(--color-text)',
                              }}
                            >
                              ₩{Number(month.revenue).toLocaleString()}
                            </td>
                            <td
                              style={{
                                ...tableCellStyle,
                                textAlign: 'right',
                                color: 'var(--color-success)',
                              }}
                            >
                              +{month.new_subscriptions}
                            </td>
                            <td
                              style={{
                                ...tableCellStyle,
                                textAlign: 'right',
                                color:
                                  month.cancellations > 0
                                    ? 'var(--color-error)'
                                    : 'var(--color-text-secondary)',
                              }}
                            >
                              {month.cancellations > 0 ? `-${month.cancellations}` : '0'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr
                          style={{
                            backgroundColor: 'var(--color-gray-50)',
                          }}
                        >
                          <td
                            style={{
                              ...tableCellStyle,
                              fontWeight: 'var(--font-weight-semibold)',
                              color: 'var(--color-text)',
                            }}
                          >
                            합계
                          </td>
                          <td
                            style={{
                              ...tableCellStyle,
                              textAlign: 'right',
                              fontWeight: 'var(--font-weight-bold)',
                              color: 'var(--color-text)',
                            }}
                          >
                            ₩
                            {revenue.monthly_revenue
                              .reduce((sum, m) => sum + Number(m.revenue), 0)
                              .toLocaleString()}
                          </td>
                          <td
                            style={{
                              ...tableCellStyle,
                              textAlign: 'right',
                              fontWeight: 'var(--font-weight-semibold)',
                              color: 'var(--color-success)',
                            }}
                          >
                            +
                            {revenue.monthly_revenue.reduce(
                              (sum, m) => sum + m.new_subscriptions,
                              0
                            )}
                          </td>
                          <td
                            style={{
                              ...tableCellStyle,
                              textAlign: 'right',
                              fontWeight: 'var(--font-weight-semibold)',
                              color: 'var(--color-error)',
                            }}
                          >
                            -
                            {revenue.monthly_revenue.reduce(
                              (sum, m) => sum + m.cancellations,
                              0
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              </Section>
            )}
          </>
        )}

        {/* 구독 현황 탭 */}
        {selectedSubMenu === 'subscriptions' && (
          <>
            <PageHeader
              title="구독 현황"
              subtitle="구독 현황 및 변동 분석"
            />

            <Section title="구독 지표">
              <CardGrid>
                <StatCard
                  title="신규 구독 (총)"
                  value={
                    revenue.monthly_revenue?.reduce((sum, m) => sum + m.new_subscriptions, 0) || 0
                  }
                  suffix="건"
                  icon={createElement(Users, { size: 20 })}
                  color="success"
                />
                <StatCard
                  title="해지 (총)"
                  value={
                    revenue.monthly_revenue?.reduce((sum, m) => sum + m.cancellations, 0) || 0
                  }
                  suffix="건"
                  icon={createElement(TrendingDown, { size: 20 })}
                  color="error"
                />
                <StatCard
                  title="순증감"
                  value={
                    (revenue.monthly_revenue?.reduce((sum, m) => sum + m.new_subscriptions, 0) ||
                      0) -
                    (revenue.monthly_revenue?.reduce((sum, m) => sum + m.cancellations, 0) || 0)
                  }
                  suffix="건"
                  icon={createElement(TrendingUp, { size: 20 })}
                  color={
                    (revenue.monthly_revenue?.reduce((sum, m) => sum + m.new_subscriptions, 0) ||
                      0) >=
                    (revenue.monthly_revenue?.reduce((sum, m) => sum + m.cancellations, 0) || 0)
                      ? 'success'
                      : 'error'
                  }
                />
                <StatCard
                  title="해지율"
                  value={revenue.churn_rate}
                  suffix="%"
                  icon={createElement(AlertTriangle, { size: 20 })}
                  color={
                    revenue.churn_rate > 5
                      ? 'error'
                      : revenue.churn_rate > 2
                      ? 'warning'
                      : 'success'
                  }
                />
              </CardGrid>
            </Section>
          </>
        )}

        {/* 매출 예측 탭 */}
        {selectedSubMenu === 'forecast' && (
          <>
            <PageHeader
              title="매출 예측"
              subtitle="향후 매출 예측 및 성장 전망"
            />

            <Section title="예측 지표">
              <CardGrid>
                <StatCard
                  title="현재 MRR"
                  value={revenue.mrr_current}
                  prefix="₩"
                  icon={createElement(DollarSign, { size: 20 })}
                  color="primary"
                />
                <StatCard
                  title="예상 ARR"
                  value={revenue.arr}
                  prefix="₩"
                  icon={createElement(Calendar, { size: 20 })}
                  color="info"
                />
                <StatCard
                  title="3개월 예측"
                  value={Math.round(revenue.mrr_current * 3 * (1 + revenue.mrr_growth / 100))}
                  prefix="₩"
                  icon={createElement(TrendingUp, { size: 20 })}
                  color="success"
                />
                <StatCard
                  title="12개월 예측"
                  value={Math.round(
                    revenue.mrr_current *
                      12 *
                      Math.pow(1 + revenue.mrr_growth / 100 / 12, 12)
                  )}
                  prefix="₩"
                  icon={createElement(TrendingUp, { size: 20 })}
                  color="secondary"
                />
              </CardGrid>
            </Section>

            <Section title="성장률 분석">
              <CardGrid>
                <StatCard
                  title="월간 성장률"
                  value={revenue.mrr_growth}
                  suffix="%"
                  icon={createElement(TrendingUp, { size: 20 })}
                  color={revenue.mrr_growth > 0 ? 'success' : 'error'}
                />
                <StatCard
                  title="예상 연간 성장률"
                  value={(Math.pow(1 + revenue.mrr_growth / 100, 12) - 1) * 100}
                  suffix="%"
                  icon={createElement(TrendingUp, { size: 20 })}
                  color="info"
                />
              </CardGrid>
            </Section>
          </>
        )}
      </>
    );
  };

  return (
    <ErrorBoundary>
      <SuperAdminLayout
        title="매출 분석"
        subMenuItems={REVENUE_SUB_MENU_ITEMS}
        defaultSubMenuId={DEFAULT_REVENUE_SUB_MENU}
        relatedMenus={REVENUE_RELATED_MENUS}
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

interface RevenueCardProps {
  title: string;
  value: number;
  previousValue?: number;
  growth?: number;
  currency?: boolean;
}

function RevenueCard({ title, value, previousValue, growth, currency }: RevenueCardProps) {
  // 색상 결정
  let textColor = 'var(--color-text)';
  let bgColor = 'var(--color-surface)';

  if (growth !== undefined) {
    if (growth > 0) {
      textColor = 'var(--color-success)';
      bgColor = 'var(--color-success-50)';
    } else if (growth < 0) {
      textColor = 'var(--color-error)';
      bgColor = 'var(--color-error-50)';
    } else {
      textColor = 'var(--color-text-secondary)';
      bgColor = 'var(--color-gray-50)';
    }
  }

  return (
    <div
      style={{
        borderRadius: 'var(--border-radius-md)',
        border: 'var(--border-width-thin) solid var(--color-gray-200)',
        padding: 'var(--spacing-lg)',
        backgroundColor: bgColor,
      }}
    >
      <p
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          margin: 0,
        }}
      >
        {title}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-xs)' }}>
        <p
          style={{
            fontSize: 'var(--font-size-3xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: textColor,
            margin: 0,
          }}
        >
          {currency && '₩'}
          {value.toLocaleString()}
        </p>
      </div>

      {/* 성장률 표시 */}
      {growth !== undefined && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            marginTop: 'var(--spacing-xs)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color:
                growth > 0
                  ? 'var(--color-success)'
                  : growth < 0
                  ? 'var(--color-error)'
                  : 'var(--color-text-secondary)',
            }}
          >
            {growth > 0 ? '↑' : growth < 0 ? '↓' : '→'} {Math.abs(growth).toFixed(1)}%
          </span>
          {previousValue !== undefined && (
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
              }}
            >
              전월 대비
            </span>
          )}
        </div>
      )}
    </div>
  );
}
