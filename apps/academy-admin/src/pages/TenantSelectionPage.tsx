/**
 * 테넌트 선택 페이지
 *
 * [LAYER: UI_PAGE]
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

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Button, useModal, useResponsiveMode, isMobile } from '@ui-core/react';
import { useUserTenants, useSelectTenant } from '@hooks/use-auth';
import { createSafeNavigate } from '../utils';

export function TenantSelectionPage() {
  const navigate = useNavigate();
  // [P0-2 수정] SSOT: 네비게이션 보안 유틸리티 사용
  const safeNavigate = useMemo(
    () => createSafeNavigate(navigate),
    [navigate]
  );
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const { showAlert } = useModal();

  const { data: tenants, isLoading: tenantsLoading } = useUserTenants();
  const selectTenant = useSelectTenant();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const handleSelectTenant = useCallback(async (tenantId: string) => {
    try {
      setSelectedTenantId(tenantId);
      await selectTenant.mutateAsync(tenantId);
      safeNavigate('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : '테넌트 선택에 실패했습니다.';
      showAlert(message, '오류');
      setSelectedTenantId(null);
    }
  }, [selectTenant, showAlert, safeNavigate]);

  // 테넌트가 하나면 자동 선택
  useEffect(() => {
    if (tenants && tenants.length === 1) {
      void handleSelectTenant(tenants[0].id);
    }
  }, [tenants, handleSelectTenant]);

  if (tenantsLoading) {
    return (
      <Container
        maxWidth="md"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh'
        }}
      >
        <Card padding="lg" style={{ width: '100%' }}>
          <p style={{ textAlign: 'center' }}>테넌트 목록을 불러오는 중..</p>
        </Card>
      </Container>
    );
  }

  if (!tenants || tenants.length === 0) {
    return (
      <Container
        maxWidth="md"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh'
        }}
      >
        <Card padding="lg" style={{ width: '100%' }}>
          <h1 style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--spacing-md)'
          }}>
            테넌트 없음
          </h1>
          <p style={{
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--spacing-md)'
          }}>
            소속된 테넌트가 없습니다.
          </p>
          <Button onClick={() => safeNavigate('/auth/signup')} variant="solid">
            회원가입
          </Button>
        </Card>
      </Container>
    );
  }

  return (
    <Container
      maxWidth="md"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        paddingTop: 'var(--spacing-xl)',
        paddingBottom: 'var(--spacing-xl)'
      }}
    >
      <Card
        padding={isMobileMode ? 'lg' : 'xl'}
        style={{ width: '100%' }}
      >
        <h1 style={{
          fontSize: isMobileMode ? 'var(--font-size-2xl)' : 'var(--font-size-3xl)',
          fontWeight: 'var(--font-weight-bold)',
          marginBottom: 'var(--spacing-lg)',
          textAlign: 'center'
        }}>
          테넌트 선택
        </h1>
        <p style={{
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--spacing-lg)',
          textAlign: 'center'
        }}>
          소속된 테넌트를 선택해주세요.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {tenants.map((tenant) => (
            <Button
              key={tenant.id}
              variant={selectedTenantId === tenant.id ? 'solid' : 'outline'}
              onClick={() => handleSelectTenant(tenant.id)}
              disabled={selectTenant.isPending}
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                padding: 'var(--spacing-md)',
                height: 'auto'
              }}
            >
              <div style={{ textAlign: 'left', width: '100%' }}>
                <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{tenant.name}</div>
                <div style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)'
                }}>
                  {tenant.industry_type} · {tenant.role}
                </div>
              </div>
            </Button>
          ))}
        </div>

        {selectTenant.isPending && (
          <p style={{
            marginTop: 'var(--spacing-md)',
            textAlign: 'center',
            color: 'var(--color-text-secondary)'
          }}>
            테넌트를 선택하는 중..
          </p>
        )}
      </Card>
    </Container>
  );
}
