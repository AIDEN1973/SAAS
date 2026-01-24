/**
 * 통합 설정 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음
 *
 * 통합 구조:
 * - 매장 정보 (store): 기본 정보 + 브랜딩
 * - 자동화 (automation): 기존 AutomationSettingsPage 콘텐츠
 * - 권한 관리 (permissions): 기존 SettingsPermissionsPage 콘텐츠
 *
 * NOTE: 알림톡 설정은 super-admin으로 이동됨
 */

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ErrorBoundary,
  Container,
  PageHeader,
  SubSidebar,
  useResponsiveMode,
  isMobile,
  isTablet,
  Spinner,
} from '@ui-core/react';
import {
  SETTINGS_SUB_MENU_ITEMS,
  DEFAULT_SETTINGS_SUB_MENU,
  getSubMenuFromUrl,
} from '../constants';
import type { SettingsSubMenuId } from '../constants';

// 섹션 컴포넌트 Lazy Loading
const StoreSettingsSection = lazy(() => import('./settings/StoreSettingsSection'));
const AutomationSettingsSection = lazy(() => import('./settings/AutomationSettingsSection'));
const PermissionsSettingsSection = lazy(() => import('./settings/PermissionsSettingsSection'));

// 로딩 컴포넌트
const SectionLoader: React.FC = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
    <Spinner size="md" />
  </div>
);

export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const mode = useResponsiveMode();
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);

  // 서브사이드바 축소 상태
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isTabletMode);

  // 태블릿 모드 변경 시 축소 상태 동기화
  useEffect(() => {
    setSidebarCollapsed(isTabletMode);
  }, [isTabletMode]);

  // URL 경로에서 서브메뉴 결정 (하위 호환)
  // /settings/automation → automation
  // /settings/permissions → permissions
  // /settings 또는 /settings/store → store
  // NOTE: 알림톡 설정은 super-admin으로 이동됨
  const getSubMenuFromPath = useCallback((): SettingsSubMenuId => {
    const path = location.pathname;
    if (path.includes('/settings/automation')) return 'automation';
    if (path.includes('/settings/permissions')) return 'permissions';
    if (path.includes('/settings/store')) return 'store';

    // URL 쿼리 파라미터에서 확인
    const validIds = SETTINGS_SUB_MENU_ITEMS.map(item => item.id) as readonly SettingsSubMenuId[];
    return getSubMenuFromUrl(searchParams, validIds, DEFAULT_SETTINGS_SUB_MENU);
  }, [location.pathname, searchParams]);

  const selectedSubMenu = getSubMenuFromPath();

  const handleSubMenuChange = useCallback((id: SettingsSubMenuId) => {
    // 경로 기반 네비게이션 (하위 호환 유지)
    if (id === 'store') {
      navigate('/settings');
    } else {
      navigate(`/settings/${id}`);
    }
  }, [navigate]);

  // 섹션 제목 매핑
  const sectionTitles: Record<SettingsSubMenuId, string> = {
    store: '매장 정보',
    automation: '자동화 설정',
    permissions: '권한 관리',
  };

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', minHeight: 'var(--height-full)' }}>
        {/* 서브 사이드바 (모바일에서는 숨김) */}
        {!isMobileMode && (
          <SubSidebar
            title="설정"
            items={SETTINGS_SUB_MENU_ITEMS}
            selectedId={selectedSubMenu}
            onSelect={handleSubMenuChange}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            testId="settings-sub-sidebar"
          />
        )}

        {/* 메인 콘텐츠 */}
        <Container maxWidth="xl" padding="lg" style={{ flex: 1 }}>
          <PageHeader title={sectionTitles[selectedSubMenu]} />

          <Suspense fallback={<SectionLoader />}>
            {selectedSubMenu === 'store' && <StoreSettingsSection />}
            {selectedSubMenu === 'automation' && <AutomationSettingsSection />}
            {selectedSubMenu === 'permissions' && <PermissionsSettingsSection />}
          </Suspense>
        </Container>
      </div>
    </ErrorBoundary>
  );
}

export default SettingsPage;
