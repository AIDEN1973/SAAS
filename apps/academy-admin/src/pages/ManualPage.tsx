/**
 * 매뉴얼 페이지
 *
 * 온라인 매뉴얼을 표시하는 독립 페이지입니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 * [SSOT] 공용 SubSidebar 컴포넌트를 사용합니다.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SubSidebar, useResponsiveMode, isMobile, isTablet } from '@ui-core/react';
import { ManualBody } from '../components/ManualBody';
import { getManualById, allManualPages } from '../data/manuals';
import { MANUAL_SUB_MENU_ITEMS, DEFAULT_MANUAL_SUB_MENU, getSubMenuFromUrl, setSubMenuToUrl } from '../constants';
import type { ManualSubMenuId } from '../constants';

export function ManualPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // 반응형 모드 감지
  const mode = useResponsiveMode();
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);
  // 서브사이드바 축소 상태 (태블릿 모드 기본값, 사용자 토글 가능)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isTabletMode);
  // 태블릿 모드 변경 시 축소 상태 동기화
  useEffect(() => {
    setSidebarCollapsed(isTabletMode);
  }, [isTabletMode]);

  // URL에서 매뉴얼 ID와 섹션 ID 가져오기
  const sectionId = searchParams.get('section');

  // 현재 선택된 매뉴얼 ID (URL 기반, SSOT 헬퍼 함수 사용)
  const validIds = MANUAL_SUB_MENU_ITEMS.map(item => item.id) as readonly ManualSubMenuId[];
  const selectedManualId = getSubMenuFromUrl(searchParams, validIds, DEFAULT_MANUAL_SUB_MENU);

  // 현재 선택된 매뉴얼 데이터
  const currentManual = useMemo(() => {
    return getManualById(selectedManualId) || allManualPages[0] || null;
  }, [selectedManualId]);

  // 현재 선택된 섹션 ID (URL에 section 파라미터가 있을 때만 설정, 없으면 null로 최상단 표시)
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(() => {
    return sectionId || null;
  });

  // 페이지 진입 시 최상단으로 스크롤
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // URL section 파라미터 변경 시 섹션 업데이트
  useEffect(() => {
    setCurrentSectionId(sectionId || null);
  }, [sectionId]);

  // 매뉴얼 페이지 선택 핸들러 (SubSidebar에서 호출)
  const handleSelectManual = useCallback(
    (id: ManualSubMenuId) => {
      // SSOT 헬퍼 함수 사용하여 URL 생성
      const newUrl = setSubMenuToUrl(id, DEFAULT_MANUAL_SUB_MENU);
      navigate(newUrl);
    },
    [navigate]
  );

  // 매뉴얼 섹션 선택 핸들러
  const handleSelectSection = useCallback(
    (newSectionId: string) => {
      setCurrentSectionId(newSectionId);
      if (currentManual) {
        const searchParams = new URLSearchParams(window.location.search);
        searchParams.set('section', newSectionId);
        navigate(`?${searchParams.toString()}`);
      }
    },
    [currentManual, navigate]
  );

  return (
    <div
      style={{
        display: 'flex',
        height: 'var(--height-full)',
        backgroundColor: 'var(--color-background)',
      }}
    >
      {/* 서브 사이드바 (모바일에서는 숨김, 태블릿에서는 축소) */}
      {!isMobileMode && (
        <SubSidebar
          title="매뉴얼"
          items={MANUAL_SUB_MENU_ITEMS}
          selectedId={selectedManualId}
          onSelect={handleSelectManual}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          testId="manual-sub-sidebar"
        />
      )}
      <ManualBody
        manual={currentManual}
        currentSectionId={currentSectionId}
        onSelectSection={handleSelectSection}
      />
    </div>
  );
}
