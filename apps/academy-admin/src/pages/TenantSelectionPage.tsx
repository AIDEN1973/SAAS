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
import { useNavigate } from 'react-router-dom';
import { Container, Card, Button, useModal, useResponsiveMode } from '@ui-core/react';
import { useUserTenants, useSelectTenant } from '@hooks/use-auth';

export function TenantSelectionPage() {
  const navigate = useNavigate();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const { showAlert } = useModal();

  const { data: tenants, isLoading: tenantsLoading } = useUserTenants();
  const selectTenant = useSelectTenant();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  // 테넌트가 하나면 자동 선택
  useEffect(() => {
    if (tenants && tenants.length === 1) {
      handleSelectTenant(tenants[0].id);
    }
  }, [tenants]);

  const handleSelectTenant = async (tenantId: string) => {
    try {
      setSelectedTenantId(tenantId);
      await selectTenant.mutateAsync(tenantId);
      navigate('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : '테넌트 선택에 실패했습니다.';
      showAlert('오류', message);
      setSelectedTenantId(null);
    }
  };

  if (tenantsLoading) {
    return (
      <Container maxWidth="md" className="flex items-center justify-center min-h-screen">
        <Card className="w-full p-6">
          <p className="text-center">테넌트 목록을 불러오는 중..</p>
        </Card>
      </Container>
    );
  }

  if (!tenants || tenants.length === 0) {
    return (
      <Container maxWidth="md" className="flex items-center justify-center min-h-screen">
        <Card className="w-full p-6">
          <h1 className="text-2xl font-bold mb-4">테넌트 없음</h1>
          <p className="text-gray-500 mb-4">소속된 테넌트가 없습니다.</p>
          <Button onClick={() => navigate('/auth/signup')} variant="solid">
            회원가입
          </Button>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" className="flex items-center justify-center min-h-screen py-8">
      <Card className="w-full p-6 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center">테넌트 선택</h1>
        <p className="text-gray-600 mb-6 text-center">소속된 테넌트를 선택해주세요.</p>

        <div className="space-y-3">
          {tenants.map((tenant) => (
            <Button
              key={tenant.id}
              variant={selectedTenantId === tenant.id ? 'solid' : 'outline'}
              onClick={() => handleSelectTenant(tenant.id)}
              disabled={selectTenant.isPending}
              className="w-full justify-start p-4 h-auto"
            >
              <div className="text-left">
                <div className="font-semibold">{tenant.name}</div>
                <div className="text-sm text-gray-500">
                  {tenant.industry_type} · {tenant.role}
                </div>
              </div>
            </Button>
          ))}
        </div>

        {selectTenant.isPending && (
          <p className="mt-4 text-center text-gray-500">테넌트를 선택하는 중..</p>
        )}
      </Card>
    </Container>
  );
}
