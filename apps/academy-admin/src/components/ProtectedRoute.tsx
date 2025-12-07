/**
 * ?¸ì¦ ë³´í˜¸ ?¼ìš°??ì»´í¬?ŒíŠ¸
 * 
 * [ê¸°ìˆ ë¬¸ì„œ ?”êµ¬?¬í•­]
 * - ?¸ì¦?˜ì? ?Šì? ?¬ìš©?ëŠ” ë¡œê·¸???˜ì´ì§€ë¡?ë¦¬ë‹¤?´ë ‰??
 * - ?Œë„Œ?¸ê? ? íƒ?˜ì? ?Šì? ê²½ìš° ?Œë„Œ??? íƒ ?˜ì´ì§€ë¡?ë¦¬ë‹¤?´ë ‰??
 * 
 * [UI ë¬¸ì„œ ?”êµ¬?¬í•­]
 * - Zero-Trust ?ì¹™ ì¤€??
 */

import { useEffect, useState, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getApiContext, setApiContext } from '@api-sdk/core';
import { useSession, useUserTenants, useSelectTenant } from '@hooks/use-auth';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const { data: session, isLoading: sessionLoading } = useSession();
  const { data: tenants, isLoading: tenantsLoading } = useUserTenants();
  const selectTenant = useSelectTenant();
  const [tenantSelected, setTenantSelected] = useState(false);

  const context = getApiContext();
  const hasTenantId = !!context?.tenantId;

  // [ì¤‘ìš”] React Hooks ê·œì¹™: ëª¨ë“  Hook?€ ì¡°ê±´ë¶€ return ?´ì „???¸ì¶œ?˜ì–´????
  // ?Œë„Œ?¸ê? ?˜ë‚˜?´ê³  ?„ì§ ? íƒ?˜ì? ?Šì? ê²½ìš° ?ë™ ? íƒ
  useEffect(() => {
    if (tenants && tenants.length === 1 && !hasTenantId && !tenantSelected) {
      const autoSelectTenant = async () => {
        try {
          await selectTenant.mutateAsync(tenants[0].id);
          setApiContext({
            tenantId: tenants[0].id,
            industryType: tenants[0].industry_type as 'academy' | 'salon' | 'realestate' | 'gym' | 'ngo',
          });
          setTenantSelected(true);
        } catch (error) {
          console.error('?Œë„Œ???ë™ ? íƒ ?¤íŒ¨:', error);
          // ?ë™ ? íƒ ?¤íŒ¨ ???Œë„Œ??? íƒ ?˜ì´ì§€ë¡??´ë™
        }
      };
      autoSelectTenant();
    }
  }, [tenants, hasTenantId, tenantSelected, selectTenant]);

  // ?¸ì…˜ ë¡œë”© ì¤?
  if (sessionLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
          ë¡œë”© ì¤?..
        </p>
      </div>
    );
  }

  // ?¸ì…˜???†ëŠ” ê²½ìš° ë¡œê·¸???˜ì´ì§€ë¡?ë¦¬ë‹¤?´ë ‰??
  if (!session) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // ?Œë„Œ??ëª©ë¡ ë¡œë”© ì¤?
  if (tenantsLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
          ?Œë„Œ???•ë³´ë¥?ë¶ˆëŸ¬?¤ëŠ” ì¤?..
        </p>
      </div>
    );
  }

  // ?Œë„Œ?¸ê? ?†ëŠ” ê²½ìš° ?Œì›ê°€???˜ì´ì§€ë¡?ë¦¬ë‹¤?´ë ‰??
  if (!tenants || tenants.length === 0) {
    return <Navigate to="/auth/signup" replace />;
  }

  // ?Œë„Œ?¸ê? ?¬ëŸ¬ ê°œì´ê³?? íƒ?˜ì? ?Šì? ê²½ìš° ?Œë„Œ??? íƒ ?˜ì´ì§€ë¡?ë¦¬ë‹¤?´ë ‰??
  if (tenants.length > 1 && !hasTenantId && !tenantSelected) {
    return <Navigate to="/auth/tenant-selection" replace />;
  }

  // ?Œë„Œ?¸ê? ?˜ë‚˜?´ê³  ? íƒ ì¤‘ì¸ ê²½ìš° ë¡œë”© ?œì‹œ
  if (tenants.length === 1 && !hasTenantId && tenantSelected && selectTenant.isPending) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
          ?Œë„Œ?¸ë? ? íƒ?˜ëŠ” ì¤?..
        </p>
      </div>
    );
  }

  // ëª¨ë“  ì¡°ê±´??ë§Œì¡±??ê²½ìš° ?ì‹ ì»´í¬?ŒíŠ¸ ?Œë”ë§?
  return <>{children}</>;
}
