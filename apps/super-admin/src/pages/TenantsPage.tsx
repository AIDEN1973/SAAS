/**
 * 테넌트 목록 페이지 (Phase 1)
 *
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용 (CSS 변수)
 * [불변 규칙] Tailwind CSS 사용 금지 - SSOT 준수
 *
 * 모든 테넌트를 카드 형식으로 표시
 * - 테넌트명, 업종, 플랜, 상태
 * - 사용자 수, 마지막 로그인
 * - 건강도 지표 (학생 수, 출결 활동)
 */

import { useState, createElement } from 'react';
import { Card, ErrorBoundary } from '@ui-core/react';
import { useTenants, useTenantDetail, type TenantWithStats } from '../hooks/useBusinessMetrics';
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
  TENANTS_SUB_MENU_ITEMS,
  DEFAULT_TENANTS_SUB_MENU,
  TENANTS_RELATED_MENUS,
  type TenantsSubMenuId,
} from '../constants/sub-sidebar-menus';
import { Building2, Users, Activity, AlertTriangle } from 'lucide-react';

export function TenantsPage() {
  const { data: tenants, isLoading, error } = useTenants();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [selectedSubMenu, setSelectedSubMenu] = useState<TenantsSubMenuId>(DEFAULT_TENANTS_SUB_MENU);

  // 통계 계산
  const totalTenants = tenants?.length || 0;
  const activeTenants = tenants?.filter((t) => t.out_status === 'active').length || 0;
  const totalUsers = tenants?.reduce((sum, t) => sum + Number(t.out_user_count || 0), 0) || 0;
  const riskTenants = tenants?.filter((t) => {
    const daysSinceLogin = t.out_last_login_at
      ? Math.floor((Date.now() - new Date(t.out_last_login_at).getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    return daysSinceLogin > 30;
  }).length || 0;

  // 플랜별 분포
  const planDistribution = tenants?.reduce((acc, t) => {
    const plan = t.out_plan || 'unknown';
    acc[plan] = (acc[plan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // 레이어 메뉴 설정 (테넌트 상세)
  const layerMenuConfig = selectedTenantId
    ? {
        isOpen: true,
        onClose: () => setSelectedTenantId(null),
        title: '테넌트 상세',
        contentKey: selectedTenantId,
        children: <TenantDetailContent tenantId={selectedTenantId} />,
      }
    : undefined;

  // 콘텐츠 렌더링
  const renderContent = () => {
    if (isLoading) {
      return <LoadingSkeleton cardCount={4} showTable />;
    }

    if (error) {
      return (
        <Card padding="md" variant="outlined">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
            }}
          >
            {createElement(AlertTriangle, { size: 20, color: 'var(--color-error)' })}
            <div>
              <h3
                style={{
                  color: 'var(--color-error)',
                  fontWeight: 'var(--font-weight-semibold)',
                  margin: 0,
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                데이터 로드 실패
              </h3>
              <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                {error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'}
              </p>
            </div>
          </div>
        </Card>
      );
    }

    if (!tenants || tenants.length === 0) {
      return (
        <EmptyState
          title="등록된 테넌트가 없습니다"
          description="테넌트가 생성되면 이 곳에 표시됩니다."
          icon={createElement(Building2, { size: 48 })}
        />
      );
    }

    return (
      <>
        {/* 서브 메뉴별 콘텐츠 */}
        {selectedSubMenu === 'list' && (
          <>
            <PageHeader
              title="테넌트 관리"
              subtitle={`전체 ${totalTenants}개 테넌트`}
            />

            {/* 요약 통계 */}
            <Section title="전체 현황">
              <CardGrid>
                <StatCard
                  title="전체 테넌트"
                  value={totalTenants}
                  suffix="개"
                  icon={createElement(Building2, { size: 20 })}
                  color="primary"
                />
                <StatCard
                  title="활성 테넌트"
                  value={activeTenants}
                  suffix="개"
                  change={totalTenants > 0 ? (activeTenants / totalTenants) * 100 : 0}
                  changeLabel="활성률"
                  icon={createElement(Activity, { size: 20 })}
                  color="success"
                />
                <StatCard
                  title="전체 사용자"
                  value={totalUsers}
                  suffix="명"
                  icon={createElement(Users, { size: 20 })}
                  color="info"
                />
                <StatCard
                  title="이탈 위험"
                  value={riskTenants}
                  suffix="개"
                  icon={createElement(AlertTriangle, { size: 20 })}
                  color={riskTenants > 0 ? 'warning' : 'success'}
                />
              </CardGrid>
            </Section>

            {/* 테넌트 카드 그리드 */}
            <Section title="테넌트 목록">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(var(--width-card-min), 1fr))',
                  gap: 'var(--spacing-lg)',
                }}
              >
                {tenants.map((tenant) => (
                  <TenantCard
                    key={tenant.out_tenant_id}
                    tenant={tenant}
                    onClick={() => setSelectedTenantId(tenant.out_tenant_id)}
                  />
                ))}
              </div>
            </Section>
          </>
        )}

        {selectedSubMenu === 'health' && (
          <>
            <PageHeader
              title="건강도 현황"
              subtitle="테넌트별 활동 및 건강도 지표"
            />
            <Section title="건강도 지표">
              <CardGrid>
                <StatCard
                  title="정상 (7일 이내 접속)"
                  value={tenants.filter((t) => {
                    const days = t.out_last_login_at
                      ? Math.floor((Date.now() - new Date(t.out_last_login_at).getTime()) / (1000 * 60 * 60 * 24))
                      : 999;
                    return days <= 7;
                  }).length}
                  suffix="개"
                  color="success"
                />
                <StatCard
                  title="주의 (7~30일)"
                  value={tenants.filter((t) => {
                    const days = t.out_last_login_at
                      ? Math.floor((Date.now() - new Date(t.out_last_login_at).getTime()) / (1000 * 60 * 60 * 24))
                      : 999;
                    return days > 7 && days <= 30;
                  }).length}
                  suffix="개"
                  color="warning"
                />
                <StatCard
                  title="위험 (30일 이상)"
                  value={riskTenants}
                  suffix="개"
                  color="error"
                />
              </CardGrid>
            </Section>

            {/* 위험 테넌트 목록 */}
            {riskTenants > 0 && (
              <Section title="이탈 위험 테넌트">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(var(--width-card-min), 1fr))',
                    gap: 'var(--spacing-lg)',
                  }}
                >
                  {tenants
                    .filter((t) => {
                      const days = t.out_last_login_at
                        ? Math.floor((Date.now() - new Date(t.out_last_login_at).getTime()) / (1000 * 60 * 60 * 24))
                        : 999;
                      return days > 30;
                    })
                    .map((tenant) => (
                      <TenantCard
                        key={tenant.out_tenant_id}
                        tenant={tenant}
                        onClick={() => setSelectedTenantId(tenant.out_tenant_id)}
                      />
                    ))}
                </div>
              </Section>
            )}
          </>
        )}

        {selectedSubMenu === 'activity' && (
          <>
            <PageHeader
              title="활동 로그"
              subtitle="최근 테넌트 활동 현황"
            />
            <Section title="최근 활동 테넌트">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(var(--width-card-min), 1fr))',
                  gap: 'var(--spacing-lg)',
                }}
              >
                {[...tenants]
                  .sort((a, b) => {
                    const aDate = a.out_last_login_at ? new Date(a.out_last_login_at).getTime() : 0;
                    const bDate = b.out_last_login_at ? new Date(b.out_last_login_at).getTime() : 0;
                    return bDate - aDate;
                  })
                  .map((tenant) => (
                    <TenantCard
                      key={tenant.out_tenant_id}
                      tenant={tenant}
                      onClick={() => setSelectedTenantId(tenant.out_tenant_id)}
                    />
                  ))}
              </div>
            </Section>
          </>
        )}

        {selectedSubMenu === 'plans' && (
          <>
            <PageHeader
              title="플랜 분포"
              subtitle="테넌트별 구독 플랜 현황"
            />
            <Section title="플랜별 테넌트 수">
              <CardGrid>
                {Object.entries(planDistribution).map(([plan, count]) => (
                  <StatCard
                    key={plan}
                    title={plan.toUpperCase()}
                    value={count}
                    suffix="개"
                    change={totalTenants > 0 ? (count / totalTenants) * 100 : 0}
                    changeLabel="점유율"
                    color={
                      plan === 'enterprise'
                        ? 'primary'
                        : plan === 'premium'
                        ? 'secondary'
                        : 'info'
                    }
                  />
                ))}
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
        title="테넌트 관리"
        subMenuItems={TENANTS_SUB_MENU_ITEMS}
        defaultSubMenuId={DEFAULT_TENANTS_SUB_MENU}
        relatedMenus={TENANTS_RELATED_MENUS}
        selectedSubMenuId={selectedSubMenu}
        onSubMenuChange={setSelectedSubMenu}
        layerMenu={layerMenuConfig}
      >
        {renderContent()}
      </SuperAdminLayout>
    </ErrorBoundary>
  );
}

// ============================================================================
// 테넌트 카드
// ============================================================================

function TenantCard({ tenant, onClick }: { tenant: TenantWithStats; onClick: () => void }) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    active: { bg: 'var(--color-success-50)', text: 'var(--color-success)' },
    paused: { bg: 'var(--color-warning-50)', text: 'var(--color-warning)' },
    closed: { bg: 'var(--color-gray-100)', text: 'var(--color-gray-600)' },
    deleting: { bg: 'var(--color-error-50)', text: 'var(--color-error)' },
  };

  const planColors: Record<string, { bg: string; text: string }> = {
    basic: { bg: 'var(--color-info-50)', text: 'var(--color-info)' },
    premium: { bg: 'var(--color-secondary-50)', text: 'var(--color-secondary)' },
    enterprise: { bg: 'var(--color-primary-100)', text: 'var(--color-primary)' },
  };

  const daysSinceLogin = tenant.out_last_login_at
    ? Math.floor((Date.now() - new Date(tenant.out_last_login_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const healthColor =
    daysSinceLogin <= 7
      ? 'var(--color-success)'
      : daysSinceLogin <= 30
      ? 'var(--color-warning)'
      : 'var(--color-error)';

  const statusStyle = statusColors[tenant.out_status] || { bg: 'var(--color-gray-100)', text: 'var(--color-gray-600)' };
  const planStyle = planColors[tenant.out_plan] || { bg: 'var(--color-gray-100)', text: 'var(--color-gray-600)' };

  return (
    <Card
      padding="md"
      variant="outlined"
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--spacing-sm)',
        }}
      >
        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text)',
              fontSize: 'var(--font-size-lg)',
              margin: 0,
            }}
          >
            {tenant.out_tenant_name}
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
            {tenant.out_industry_type}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xxs)' }}>
          <span
            style={{
              padding: 'var(--spacing-xxs) var(--spacing-xs)',
              borderRadius: 'var(--border-radius-xs)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-medium)',
              backgroundColor: planStyle.bg,
              color: planStyle.text,
              textTransform: 'uppercase',
            }}
          >
            {tenant.out_plan || 'N/A'}
          </span>
          <span
            style={{
              padding: 'var(--spacing-xxs) var(--spacing-xs)',
              borderRadius: 'var(--border-radius-xs)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-medium)',
              backgroundColor: statusStyle.bg,
              color: statusStyle.text,
            }}
          >
            {tenant.out_status || 'unknown'}
          </span>
        </div>
      </div>

      {/* 통계 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-xs)',
          borderTop: 'var(--border-width-thin) solid var(--color-gray-200)',
          paddingTop: 'var(--spacing-sm)',
        }}
      >
        <StatRow label="사용자" value={`${tenant.out_user_count}명`} />
        <StatRow label="학생" value={`${tenant.out_student_count}명`} />
        <StatRow label="출결 (7일)" value={`${tenant.out_attendance_count_7d}건`} />
      </div>

      {/* 마지막 로그인 */}
      <div
        style={{
          marginTop: 'var(--spacing-sm)',
          paddingTop: 'var(--spacing-sm)',
          borderTop: 'var(--border-width-thin) solid var(--color-gray-200)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 'var(--font-size-xs)',
          }}
        >
          <span style={{ color: 'var(--color-text-secondary)' }}>마지막 로그인</span>
          <span style={{ fontWeight: 'var(--font-weight-medium)', color: healthColor }}>
            {tenant.out_last_login_at
              ? daysSinceLogin === 0
                ? '오늘'
                : `${daysSinceLogin}일 전`
              : '없음'}
          </span>
        </div>
      </div>
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 'var(--font-size-sm)',
      }}
    >
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)' }}>
        {value}
      </span>
    </div>
  );
}

// ============================================================================
// 테넌트 상세 콘텐츠 (레이어 메뉴용)
// ============================================================================

function TenantDetailContent({ tenantId }: { tenantId: string }) {
  const { data: detail, isLoading } = useTenantDetail(tenantId);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', padding: 'var(--spacing-md)' }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: '1rem',
              backgroundColor: 'var(--color-gray-200)',
              borderRadius: 'var(--border-radius-sm)',
              width: i === 1 ? '75%' : i === 2 ? '50%' : '66%',
            }}
          />
        ))}
      </div>
    );
  }

  if (!detail) {
    return (
      <p
        style={{
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
          padding: 'var(--spacing-xl)',
        }}
      >
        데이터를 불러올 수 없습니다.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)', padding: 'var(--spacing-md)' }}>
      {/* 기본 정보 */}
      <section>
        <h3
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-secondary)',
            margin: 0,
          }}
        >
          기본 정보
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--spacing-sm)',
            marginTop: 'var(--spacing-sm)',
          }}
        >
          <DetailItem label="테넌트명" value={detail.tenant.name} />
          <DetailItem label="업종" value={detail.tenant.industry_type} />
          <DetailItem label="플랜" value={detail.tenant.plan} />
          <DetailItem label="상태" value={detail.tenant.status} />
          <DetailItem
            label="생성일"
            value={new Date(detail.tenant.created_at).toLocaleDateString('ko-KR')}
            fullWidth
          />
        </div>
      </section>

      {/* 사용자 정보 */}
      <section>
        <h3
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-secondary)',
            margin: 0,
          }}
        >
          사용자 정보
        </h3>
        <div
          style={{
            backgroundColor: 'var(--color-gray-50)',
            borderRadius: 'var(--border-radius-md)',
            padding: 'var(--spacing-md)',
            marginTop: 'var(--spacing-sm)',
          }}
        >
          <p
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text)',
              margin: 0,
            }}
          >
            {detail.users.total_users}명
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)' }}>
            {Object.entries(detail.users.by_role || {}).map(([role, count]) => (
              <StatRow key={role} label={role} value={`${count}명`} />
            ))}
          </div>
        </div>
      </section>

      {/* 활동 지표 */}
      <section>
        <h3
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-secondary)',
            margin: 0,
          }}
        >
          활동 지표
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--spacing-sm)',
            marginTop: 'var(--spacing-sm)',
          }}
        >
          <ActivityCard
            label="마지막 로그인"
            value={
              detail.activity.last_login
                ? new Date(detail.activity.last_login).toLocaleDateString('ko-KR')
                : '없음'
            }
            color="info"
          />
          <ActivityCard
            label="활성 (7일)"
            value={`${detail.activity.active_users_7d}명`}
            color="success"
          />
          <ActivityCard
            label="활성 (30일)"
            value={`${detail.activity.active_users_30d}명`}
            color="secondary"
          />
        </div>
      </section>
    </div>
  );
}

function DetailItem({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div style={fullWidth ? { gridColumn: 'span 2' } : undefined}>
      <dt
        style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--spacing-xxs)',
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--color-text)',
          margin: 0,
        }}
      >
        {value}
      </dd>
    </div>
  );
}

function ActivityCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'info' | 'success' | 'secondary';
}) {
  const colorMap = {
    info: { bg: 'var(--color-info-50)', text: 'var(--color-info)' },
    success: { bg: 'var(--color-success-50)', text: 'var(--color-success)' },
    secondary: { bg: 'var(--color-secondary-50)', text: 'var(--color-secondary)' },
  };

  const style = colorMap[color];

  return (
    <div
      style={{
        backgroundColor: style.bg,
        borderRadius: 'var(--border-radius-md)',
        padding: 'var(--spacing-sm)',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontSize: 'var(--font-size-xs)',
          color: style.text,
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-semibold)',
          color: style.text,
          margin: 0,
          marginTop: 'var(--spacing-xxs)',
        }}
      >
        {value}
      </p>
    </div>
  );
}
