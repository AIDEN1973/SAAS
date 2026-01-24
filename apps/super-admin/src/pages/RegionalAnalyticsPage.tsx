/**
 * 지역별 분석 페이지 (Phase 3)
 *
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용 (CSS 변수)
 * [불변 규칙] Tailwind CSS 사용 금지 - SSOT 준수
 *
 * daily_region_metrics 데이터 시각화
 * - 지역별 테넌트 수
 * - 지역별 학생 수 & 평균
 * - 지역별 매출 & 시장 점유율
 */

import { useState } from 'react';
import { Card, ErrorBoundary } from '@ui-core/react';
import { useRegionalAnalytics } from '../hooks/useBusinessMetrics';
import {
  SuperAdminLayout,
  PageHeader,
  Section,
  StatCard,
  CardGrid,
  EmptyState,
  LoadingSkeleton,
} from '../components/SuperAdminLayout';
import {
  REGIONAL_SUB_MENU_ITEMS,
  REGIONAL_RELATED_MENUS,
  DEFAULT_REGIONAL_SUB_MENU,
  type RegionalSubMenuId,
} from '../constants/sub-sidebar-menus';

// ============================================================================
// Main Component
// ============================================================================

export function RegionalAnalyticsPage() {
  const { data: regions, isLoading } = useRegionalAnalytics();
  const [selectedTab, setSelectedTab] = useState<RegionalSubMenuId>(DEFAULT_REGIONAL_SUB_MENU);

  // 전국 집계 데이터
  const totalTenants = regions?.reduce((sum, r) => sum + Number(r.out_tenant_count), 0) || 0;
  const totalStudents = regions?.reduce((sum, r) => sum + Number(r.out_total_students), 0) || 0;
  const totalRevenue = regions?.reduce((sum, r) => sum + Number(r.out_total_revenue), 0) || 0;

  // 탭 변경 핸들러
  const handleTabChange = (id: RegionalSubMenuId) => {
    setSelectedTab(id);
  };

  // 탭별 콘텐츠 렌더링
  const renderContent = () => {
    if (isLoading) {
      return <LoadingSkeleton cardCount={3} showTable />;
    }

    switch (selectedTab) {
      case 'overview':
        return (
          <OverviewTab
            regions={regions}
            totalTenants={totalTenants}
            totalStudents={totalStudents}
            totalRevenue={totalRevenue}
          />
        );
      case 'tenants':
        return <TenantsTab regions={regions} totalTenants={totalTenants} />;
      case 'revenue':
        return <RevenueTab regions={regions} totalRevenue={totalRevenue} />;
      case 'market-share':
        return <MarketShareTab regions={regions} />;
      default:
        return (
          <OverviewTab
            regions={regions}
            totalTenants={totalTenants}
            totalStudents={totalStudents}
            totalRevenue={totalRevenue}
          />
        );
    }
  };

  return (
    <ErrorBoundary>
      <SuperAdminLayout
        title="지역별 분석"
        subMenuItems={REGIONAL_SUB_MENU_ITEMS}
        defaultSubMenuId={DEFAULT_REGIONAL_SUB_MENU}
        relatedMenus={REGIONAL_RELATED_MENUS}
        selectedSubMenuId={selectedTab}
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

interface RegionData {
  out_region: string;
  out_tenant_count: number;
  out_total_students: number;
  out_avg_students: number;
  out_total_revenue: number;
  out_market_share: number;
}

interface OverviewTabProps {
  regions: RegionData[] | undefined;
  totalTenants: number;
  totalStudents: number;
  totalRevenue: number;
}

function OverviewTab({ regions, totalTenants, totalStudents, totalRevenue }: OverviewTabProps) {
  return (
    <>
      <PageHeader title="지역 현황" subtitle="전국 지역별 사업 현황 종합" />

      {/* 전국 요약 통계 */}
      <Section title="전국 요약">
        <CardGrid>
          <StatCard title="총 테넌트" value={totalTenants} suffix="개" color="info" />
          <StatCard title="총 학생" value={totalStudents} suffix="명" color="success" />
          <StatCard title="총 매출" value={totalRevenue} prefix="₩" color="secondary" />
          <StatCard
            title="평균 학생/테넌트"
            value={totalTenants > 0 ? (totalStudents / totalTenants).toFixed(1) : '0'}
            suffix="명"
            color="primary"
          />
        </CardGrid>
      </Section>

      {/* 지역별 상세 테이블 */}
      {regions && regions.length > 0 ? (
        <Section title="지역별 상세">
          <RegionTable regions={regions} totalTenants={totalTenants} totalStudents={totalStudents} totalRevenue={totalRevenue} />
        </Section>
      ) : (
        <EmptyState
          title="⚠️ 지역별 데이터가 없습니다"
          description="daily_region_metrics 테이블에 데이터가 수집되면 표시됩니다."
        />
      )}
    </>
  );
}

interface TenantsTabProps {
  regions: RegionData[] | undefined;
  totalTenants: number;
}

function TenantsTab({ regions, totalTenants }: TenantsTabProps) {
  // 테넌트 수 기준 정렬
  const sortedRegions = [...(regions || [])].sort(
    (a, b) => Number(b.out_tenant_count) - Number(a.out_tenant_count)
  );

  return (
    <>
      <PageHeader title="지역별 테넌트" subtitle="지역별 테넌트 분포 현황" />

      {/* 상위 지역 요약 */}
      <Section title="테넌트 분포 요약">
        <CardGrid>
          <StatCard title="전체 지역 수" value={regions?.length || 0} suffix="개 지역" color="info" />
          <StatCard title="총 테넌트" value={totalTenants} suffix="개" color="primary" />
          <StatCard
            title="평균 테넌트/지역"
            value={regions?.length ? (totalTenants / regions.length).toFixed(1) : '0'}
            suffix="개"
            color="success"
          />
          <StatCard
            title="최다 지역"
            value={sortedRegions[0]?.out_region || '-'}
            suffix={sortedRegions[0] ? `(${Number(sortedRegions[0].out_tenant_count)}개)` : ''}
            color="secondary"
          />
        </CardGrid>
      </Section>

      {/* 지역별 테넌트 카드 */}
      {regions && regions.length > 0 ? (
        <Section title="지역별 테넌트 분포">
          <CardGrid>
            {sortedRegions.map((region) => (
              <RegionCard
                key={region.out_region}
                region={region.out_region}
                count={Number(region.out_tenant_count)}
                percentage={(Number(region.out_tenant_count) / totalTenants) * 100}
                label="테넌트"
              />
            ))}
          </CardGrid>
        </Section>
      ) : (
        <EmptyState
          title="⚠️ 테넌트 데이터가 없습니다"
          description="지역별 테넌트 데이터를 확인할 수 없습니다."
        />
      )}
    </>
  );
}

interface RevenueTabProps {
  regions: RegionData[] | undefined;
  totalRevenue: number;
}

function RevenueTab({ regions, totalRevenue }: RevenueTabProps) {
  // 매출 기준 정렬
  const sortedRegions = [...(regions || [])].sort(
    (a, b) => Number(b.out_total_revenue) - Number(a.out_total_revenue)
  );

  return (
    <>
      <PageHeader title="지역별 매출" subtitle="지역별 매출 분석" />

      {/* 매출 요약 */}
      <Section title="매출 요약">
        <CardGrid>
          <StatCard title="총 매출" value={totalRevenue} prefix="₩" color="secondary" />
          <StatCard
            title="평균 매출/지역"
            value={regions?.length ? Math.round(totalRevenue / regions.length) : 0}
            prefix="₩"
            color="info"
          />
          <StatCard
            title="최대 매출 지역"
            value={sortedRegions[0]?.out_region || '-'}
            color="success"
          />
          <StatCard
            title="최대 매출액"
            value={sortedRegions[0] ? Number(sortedRegions[0].out_total_revenue) : 0}
            prefix="₩"
            color="primary"
          />
        </CardGrid>
      </Section>

      {/* 지역별 매출 테이블 */}
      {regions && regions.length > 0 ? (
        <Section title="지역별 매출 순위">
          <Card padding="xs" variant="outlined" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyles.table}>
                <thead>
                  <tr style={tableStyles.headerRow}>
                    <th style={tableStyles.headerCell}>순위</th>
                    <th style={tableStyles.headerCell}>지역</th>
                    <th style={{ ...tableStyles.headerCell, textAlign: 'right' }}>매출</th>
                    <th style={{ ...tableStyles.headerCell, textAlign: 'right' }}>점유율</th>
                    <th style={{ ...tableStyles.headerCell, textAlign: 'right' }}>학생 수</th>
                    <th style={{ ...tableStyles.headerCell, textAlign: 'right' }}>학생당 매출</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRegions.map((region, index) => {
                    const students = Number(region.out_total_students);
                    const revenue = Number(region.out_total_revenue);
                    const revenuePerStudent = students > 0 ? revenue / students : 0;

                    return (
                      <tr key={region.out_region} style={tableStyles.row}>
                        <td style={tableStyles.cell}>
                          <RankBadge rank={index + 1} />
                        </td>
                        <td style={{ ...tableStyles.cell, fontWeight: 'var(--font-weight-medium)' }}>
                          {region.out_region}
                        </td>
                        <td style={{ ...tableStyles.cell, textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>
                          ₩{revenue.toLocaleString()}
                        </td>
                        <td style={{ ...tableStyles.cell, textAlign: 'right' }}>
                          <MarketShareBadge percentage={Number(region.out_market_share)} />
                        </td>
                        <td style={{ ...tableStyles.cell, textAlign: 'right' }}>
                          {students.toLocaleString()}명
                        </td>
                        <td style={{ ...tableStyles.cell, textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                          ₩{Math.round(revenuePerStudent).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </Section>
      ) : (
        <EmptyState
          title="⚠️ 매출 데이터가 없습니다"
          description="지역별 매출 데이터를 확인할 수 없습니다."
        />
      )}
    </>
  );
}

interface MarketShareTabProps {
  regions: RegionData[] | undefined;
}

function MarketShareTab({ regions }: MarketShareTabProps) {
  // 시장 점유율 기준 정렬
  const sortedRegions = [...(regions || [])].sort(
    (a, b) => Number(b.out_market_share) - Number(a.out_market_share)
  );

  // 점유율 그룹 계산
  const highShare = sortedRegions.filter((r) => Number(r.out_market_share) >= 20);
  const mediumShare = sortedRegions.filter((r) => Number(r.out_market_share) >= 10 && Number(r.out_market_share) < 20);
  const lowShare = sortedRegions.filter((r) => Number(r.out_market_share) < 10);

  return (
    <>
      <PageHeader title="시장 점유율" subtitle="지역별 시장 점유율 분석" />

      {/* 점유율 그룹 요약 */}
      <Section title="점유율 분포">
        <CardGrid>
          <StatCard
            title="고점유 지역 (20%+)"
            value={highShare.length}
            suffix="개 지역"
            color="secondary"
          />
          <StatCard
            title="중간 점유 (10-20%)"
            value={mediumShare.length}
            suffix="개 지역"
            color="info"
          />
          <StatCard
            title="저점유 지역 (<10%)"
            value={lowShare.length}
            suffix="개 지역"
            color="warning"
          />
          <StatCard
            title="최대 점유율"
            value={sortedRegions[0] ? Number(sortedRegions[0].out_market_share).toFixed(1) : '0'}
            suffix="%"
            color="success"
          />
        </CardGrid>
      </Section>

      {/* 시장 점유율 차트 (막대 형태) */}
      {regions && regions.length > 0 ? (
        <Section title="지역별 시장 점유율">
          <Card padding="lg" variant="outlined">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {sortedRegions.map((region) => (
                <MarketShareBar
                  key={region.out_region}
                  region={region.out_region}
                  percentage={Number(region.out_market_share)}
                  revenue={Number(region.out_total_revenue)}
                />
              ))}
            </div>
          </Card>
        </Section>
      ) : (
        <EmptyState
          title="⚠️ 시장 점유율 데이터가 없습니다"
          description="지역별 시장 점유율 데이터를 확인할 수 없습니다."
        />
      )}
    </>
  );
}

// ============================================================================
// Shared Components
// ============================================================================

interface RegionTableProps {
  regions: RegionData[];
  totalTenants: number;
  totalStudents: number;
  totalRevenue: number;
}

function RegionTable({ regions, totalTenants, totalStudents, totalRevenue }: RegionTableProps) {
  return (
    <Card padding="xs" variant="outlined" style={{ padding: 0 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyles.table}>
          <thead>
            <tr style={tableStyles.headerRow}>
              <th style={tableStyles.headerCell}>지역</th>
              <th style={{ ...tableStyles.headerCell, textAlign: 'right' }}>테넌트 수</th>
              <th style={{ ...tableStyles.headerCell, textAlign: 'right' }}>학생 수</th>
              <th style={{ ...tableStyles.headerCell, textAlign: 'right' }}>평균 학생/테넌트</th>
              <th style={{ ...tableStyles.headerCell, textAlign: 'right' }}>매출</th>
              <th style={{ ...tableStyles.headerCell, textAlign: 'right' }}>시장 점유율</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((region) => (
              <tr key={region.out_region} style={tableStyles.row}>
                <td style={{ ...tableStyles.cell, fontWeight: 'var(--font-weight-medium)' }}>
                  {region.out_region}
                </td>
                <td style={{ ...tableStyles.cell, textAlign: 'right' }}>
                  {Number(region.out_tenant_count).toLocaleString()}개
                </td>
                <td style={{ ...tableStyles.cell, textAlign: 'right' }}>
                  {Number(region.out_total_students).toLocaleString()}명
                </td>
                <td style={{ ...tableStyles.cell, textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                  {Number(region.out_avg_students).toFixed(1)}명
                </td>
                <td style={{ ...tableStyles.cell, textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>
                  ₩{Number(region.out_total_revenue).toLocaleString()}
                </td>
                <td style={{ ...tableStyles.cell, textAlign: 'right' }}>
                  <MarketShareBadge percentage={Number(region.out_market_share)} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: 'var(--color-gray-50)' }}>
              <td style={{ ...tableStyles.cell, fontWeight: 'var(--font-weight-semibold)' }}>전체</td>
              <td style={{ ...tableStyles.cell, textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>
                {totalTenants.toLocaleString()}개
              </td>
              <td style={{ ...tableStyles.cell, textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>
                {totalStudents.toLocaleString()}명
              </td>
              <td style={{ ...tableStyles.cell, textAlign: 'right', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-secondary)' }}>
                {totalTenants > 0 ? (totalStudents / totalTenants).toFixed(1) : 0}명
              </td>
              <td style={{ ...tableStyles.cell, textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>
                ₩{totalRevenue.toLocaleString()}
              </td>
              <td style={{ ...tableStyles.cell, textAlign: 'right', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-secondary)' }}>
                100%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

interface RegionCardProps {
  region: string;
  count: number;
  percentage: number;
  label?: string;
}

function RegionCard({ region, count, percentage, label = '테넌트' }: RegionCardProps) {
  return (
    <Card padding="md" variant="outlined">
      <p
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          margin: 0,
        }}
      >
        {region}
      </p>
      <p
        style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text)',
          margin: 0,
        }}
      >
        {count}
        <span style={{ fontSize: 'var(--font-size-sm)', marginLeft: 'var(--spacing-xxs)' }}>
          {label}
        </span>
      </p>
      <div style={{ marginTop: 'var(--spacing-xs)' }}>
        <div
          style={{
            width: '100%',
            backgroundColor: 'var(--color-gray-200)',
            borderRadius: 'var(--border-radius-full)',
            height: '0.5rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-primary)',
              height: '0.5rem',
              borderRadius: 'var(--border-radius-full)',
              width: `${Math.min(percentage, 100)}%`,
              transition: 'width var(--transition-base)',
            }}
          />
        </div>
        <p
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            margin: 0,
            marginTop: 'var(--spacing-xxs)',
          }}
        >
          {percentage.toFixed(1)}%
        </p>
      </div>
    </Card>
  );
}

interface MarketShareBadgeProps {
  percentage: number;
}

function MarketShareBadge({ percentage }: MarketShareBadgeProps) {
  const getColor = (pct: number): { bg: string; text: string } => {
    if (pct >= 20) return { bg: 'var(--color-secondary-50)', text: 'var(--color-secondary)' };
    if (pct >= 10) return { bg: 'var(--color-info-50)', text: 'var(--color-info)' };
    if (pct >= 5) return { bg: 'var(--color-success-50)', text: 'var(--color-success)' };
    return { bg: 'var(--color-gray-100)', text: 'var(--color-text-secondary)' };
  };

  const style = getColor(percentage);

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
      {percentage.toFixed(1)}%
    </span>
  );
}

interface RankBadgeProps {
  rank: number;
}

function RankBadge({ rank }: RankBadgeProps) {
  const getColor = (r: number): { bg: string; text: string } => {
    if (r === 1) return { bg: 'var(--color-warning-100)', text: 'var(--color-warning)' };
    if (r === 2) return { bg: 'var(--color-gray-200)', text: 'var(--color-text-secondary)' };
    if (r === 3) return { bg: 'var(--color-warning-50)', text: 'var(--color-warning)' };
    return { bg: 'var(--color-gray-100)', text: 'var(--color-text-secondary)' };
  };

  const style = getColor(rank);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '1.75rem',
        height: '1.75rem',
        borderRadius: 'var(--border-radius-full)',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-bold)',
        backgroundColor: style.bg,
        color: style.text,
      }}
    >
      {rank}
    </span>
  );
}

interface MarketShareBarProps {
  region: string;
  percentage: number;
  revenue: number;
}

function MarketShareBar({ region, percentage, revenue }: MarketShareBarProps) {
  const getBarColor = (pct: number): string => {
    if (pct >= 20) return 'var(--color-secondary)';
    if (pct >= 10) return 'var(--color-info)';
    if (pct >= 5) return 'var(--color-success)';
    return 'var(--color-gray-400)';
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
      <div style={{ width: '80px', flexShrink: 0 }}>
        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text)',
            margin: 0,
          }}
        >
          {region}
        </p>
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            width: '100%',
            backgroundColor: 'var(--color-gray-100)',
            borderRadius: 'var(--border-radius-sm)',
            height: '1.5rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              backgroundColor: getBarColor(percentage),
              height: '100%',
              borderRadius: 'var(--border-radius-sm)',
              width: `${Math.min(percentage * 2, 100)}%`,
              transition: 'width var(--transition-base)',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 'var(--spacing-sm)',
            }}
          >
            {percentage >= 10 && (
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-white)',
                }}
              >
                {percentage.toFixed(1)}%
              </span>
            )}
          </div>
          {percentage < 10 && (
            <span
              style={{
                position: 'absolute',
                left: `${Math.max(percentage * 2 + 2, 4)}%`,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {percentage.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      <div style={{ width: '120px', textAlign: 'right', flexShrink: 0 }}>
        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            margin: 0,
          }}
        >
          ₩{revenue.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const tableStyles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 'var(--font-size-sm)',
  },
  headerRow: {
    backgroundColor: 'var(--color-gray-50)',
    borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
  },
  headerCell: {
    padding: 'var(--spacing-sm) var(--spacing-md)',
    textAlign: 'left' as const,
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: 'var(--letter-spacing-table-header)',
  },
  row: {
    borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
  },
  cell: {
    padding: 'var(--spacing-md)',
    whiteSpace: 'nowrap' as const,
    color: 'var(--color-text)',
  },
};
