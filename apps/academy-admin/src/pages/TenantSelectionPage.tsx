/**
 * 테넌트 선택 페이지
 * 
 * [기술문서 요구사항]
 * - 로그인 후 여러 테넌트가 있는 경우 테넌트 선택
 * - 테넌트 선택 시 JWT claim에 tenant_id 포함
 * 
 * [UI 문서 요구사항]
 * - Zero-Trust 원칙 준수
 * - 반응형 지원 (xs, sm, md, lg, xl)
 * - Design System 토큰 사용
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Container, Card, Button, useModal, useResponsiveMode } from '@ui-core/react';
import { useSelectTenant, useUserTenants } from '@hooks/use-auth';
import { setApiContext } from '@api-sdk/core';

export function TenantSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const { showAlert } = useModal();

  const [loading, setLoading] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  // location.state에서 tenants 가져오기 (로그인 후 리다이렉트된 경우)
  const tenantsFromState = (location.state as any)?.tenants;
  const { data: tenantsData } = useUserTenants();
  const tenants = tenantsFromState || tenantsData || [];

  const selectTenant = useSelectTenant();

  useEffect(() => {
    // 테넌트가 없는 경우 회원가입 페이지로 이동
    if (tenants.length === 0) {
      navigate('/auth/signup');
    }
    // 테넌트가 1개인 경우 자동 선택
    else if (tenants.length === 1) {
      handleSelectTenant(tenants[0].id);
    }
  }, [tenants]);

  const handleSelectTenant = async (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setLoading(true);

    try {
      const result = await selectTenant.mutateAsync(tenantId);

      // API Context 설정
      const tenant = tenants.find((t) => t.id === tenantId);
      if (tenant) {
        setApiContext({
          tenantId: tenant.id,
          industryType: tenant.industry_type,
          authToken: result.access_token,
        });
      }

      // 메인 페이지로 이동
      navigate('/');
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : '테넌트 선택에 실패했습니다.',
        '테넌트 선택 실패',
        'error'
      );
      setSelectedTenantId(null);
    } finally {
      setLoading(false);
    }
  };

  if (tenants.length === 0) {
    return null; // useEffect에서 리다이렉트 처리
  }

  if (tenants.length === 1) {
    return null; // useEffect에서 자동 선택 처리
  }

  return (
    <Container
      maxWidth="md"
      padding="lg"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <Card
        padding="xl"
        variant="elevated"
        style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : '600px',
        }}
      >
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h1
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
              marginBottom: 'var(--spacing-xs)',
              color: 'var(--color-text)',
              textAlign: 'center',
            }}
          >
            테넌트 선택
          </h1>
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              textAlign: 'center',
            }}
          >
            접근할 테넌트를 선택해주세요
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          {tenants.map((tenant) => (
            <Card
              key={tenant.id}
              padding="lg"
              variant="outlined"
              onClick={() => handleSelectTenant(tenant.id)}
              style={{
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading && selectedTenantId !== tenant.id ? 0.5 : 1,
                border: selectedTenantId === tenant.id ? '2px solid var(--color-primary)' : undefined,
                transition: 'all 0.2s',
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 'var(--font-weight-semibold)',
                    marginBottom: 'var(--spacing-xs)',
                    color: 'var(--color-text)',
                  }}
                >
                  {tenant.name}
                </h3>
                <p
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                >
                  업종: {tenant.industry_type === 'academy' ? '학원' : tenant.industry_type}
                </p>
                <p
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  권한: {tenant.role}
                </p>
              </div>
            </Card>
          ))}
        </div>

        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => navigate('/auth/logout')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            다른 계정으로 로그인
          </button>
        </div>
      </Card>
    </Container>
  );
}

