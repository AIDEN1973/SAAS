/**
 * 매뉴얼 페이지
 *
 * 온라인 매뉴얼을 표시하는 독립 페이지입니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 * [SSOT] 공용 SubSidebar 컴포넌트를 사용합니다.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SubSidebar } from '@ui-core/react';
import { ManualBody } from '../components/ManualBody';
import { getManualById, allManualPages } from '../data/manuals';
import { MANUAL_SUB_MENU_ITEMS, DEFAULT_MANUAL_SUB_MENU, getSubMenuFromUrl } from '../constants';
import type { ManualSubMenuId } from '../constants';

export function ManualPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

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
      // 섹션 파라미터 제거하고 id만 설정
      const searchParams = new URLSearchParams();
      if (id !== DEFAULT_MANUAL_SUB_MENU) {
        searchParams.set('id', id);
      }
      const queryString = searchParams.toString();
      const newUrl = queryString ? `?${queryString}` : window.location.pathname;
      navigate(newUrl, { replace: true });
    },
    [navigate]
  );

  // 매뉴얼 섹션 선택 핸들러
  const handleSelectSection = useCallback(
    (newSectionId: string) => {
      setCurrentSectionId(newSectionId);
      if (currentManual) {
        const searchParams = new URLSearchParams();
        if (currentManual.id !== DEFAULT_MANUAL_SUB_MENU) {
          searchParams.set('id', currentManual.id);
        }
        searchParams.set('section', newSectionId);
        const queryString = searchParams.toString();
        const newUrl = queryString ? `?${queryString}` : window.location.pathname;
        navigate(newUrl, { replace: true });
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
      <SubSidebar
        title="매뉴얼"
        items={MANUAL_SUB_MENU_ITEMS}
        selectedId={selectedManualId}
        onSelect={handleSelectManual}
        testId="manual-sub-sidebar"
      />
      <ManualBody
        manual={currentManual}
        currentSectionId={currentSectionId}
        onSelectSection={handleSelectSection}
      />
    </div>
  );
}
