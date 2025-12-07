/**
 * ?Œë„Œ??? íƒ ?˜ì´ì§€
 * 
 * [ê¸°ìˆ ë¬¸ì„œ ?”êµ¬?¬í•­]
 * - ë¡œê·¸?????¬ëŸ¬ ?Œë„Œ?¸ê? ?ˆëŠ” ê²½ìš° ?Œë„Œ??? íƒ
 * - ?Œë„Œ??? íƒ ??JWT claim??tenant_id ?¬í•¨
 * 
 * [UI ë¬¸ì„œ ?”êµ¬?¬í•­]
 * - Zero-Trust ?ì¹™ ì¤€??
 * - ë°˜ì‘??ì§€??(xs, sm, md, lg, xl)
 * - Design System ? í° ?¬ìš©
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

  // ?Œë„Œ?¸ê? ?˜ë‚˜ë©??ë™ ? íƒ
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
      const message = error instanceof Error ? error.message : '?Œë„Œ??? íƒ???¤íŒ¨?ˆìŠµ?ˆë‹¤.';
      showAlert('?¤ë¥˜', message);
      setSelectedTenantId(null);
    }
  };

  if (tenantsLoading) {
    return (
      <Container maxWidth="md" className="flex items-center justify-center min-h-screen">
        <Card className="w-full p-6">
          <p className="text-center">?Œë„Œ??ëª©ë¡??ë¶ˆëŸ¬?¤ëŠ” ì¤?..</p>
        </Card>
      </Container>
    );
  }

  if (!tenants || tenants.length === 0) {
    return (
      <Container maxWidth="md" className="flex items-center justify-center min-h-screen">
        <Card className="w-full p-6">
          <h1 className="text-2xl font-bold mb-4">?Œë„Œ???†ìŒ</h1>
          <p className="text-gray-500 mb-4">?Œì†???Œë„Œ?¸ê? ?†ìŠµ?ˆë‹¤.</p>
          <Button onClick={() => navigate('/auth/signup')} variant="solid">
            ?Œì›ê°€??
          </Button>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" className="flex items-center justify-center min-h-screen py-8">
      <Card className="w-full p-6 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center">?Œë„Œ??? íƒ</h1>
        <p className="text-gray-600 mb-6 text-center">?‘ì†???Œë„Œ?¸ë? ? íƒ?´ì£¼?¸ìš”.</p>

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
                  {tenant.industry_type} Â· {tenant.role}
                </div>
              </div>
            </Button>
          ))}
        </div>

        {selectTenant.isPending && (
          <p className="mt-4 text-center text-gray-500">?Œë„Œ?¸ë? ? íƒ?˜ëŠ” ì¤?..</p>
        )}
      </Card>
    </Container>
  );
}
