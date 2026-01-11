/**
 * 매뉴얼 페이지
 *
 * 온라인 매뉴얼을 표시하는 독립 페이지입니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ManualSidebar } from '../components/ManualSidebar';
import { ManualBody } from '../components/ManualBody';
import type { ManualPage as ManualPageType } from '../types/manual';
import { getManualById, allManualPages } from '../data/manuals';

export function ManualPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL에서 매뉴얼 ID와 섹션 ID 가져오기
  const manualId = searchParams.get('id');
  const sectionId = searchParams.get('section');

  // 현재 선택된 매뉴얼
  const [currentManual, setCurrentManual] = useState<ManualPageType | null>(() => {
    if (manualId) {
      return getManualById(manualId) || allManualPages[0] || null;
    }
    return allManualPages[0] || null;
  });

  // 현재 선택된 섹션 ID (URL에 section 파라미터가 있을 때만 설정, 없으면 null로 최상단 표시)
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(() => {
    return sectionId || null;
  });

  // 페이지 진입 시 최상단으로 스크롤
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // URL 파라미터 변경 시 매뉴얼 업데이트
  useEffect(() => {
    if (manualId) {
      const manual = getManualById(manualId);
      if (manual) {
        setCurrentManual(manual);
        // URL에 section 파라미터가 있을 때만 해당 섹션으로 설정
        setCurrentSectionId(sectionId || null);
      }
    }
  }, [manualId, sectionId]);

  // 매뉴얼 페이지 선택 핸들러 (선택 시 최상단으로 스크롤)
  const handleSelectManual = useCallback(
    (manual: ManualPageType) => {
      setCurrentManual(manual);
      setCurrentSectionId(null); // 최상단 표시
      setSearchParams({ id: manual.id });
    },
    [setSearchParams]
  );

  // 매뉴얼 섹션 선택 핸들러
  const handleSelectSection = useCallback(
    (newSectionId: string) => {
      setCurrentSectionId(newSectionId);
      if (currentManual) {
        setSearchParams({ id: currentManual.id, section: newSectionId });
      }
    },
    [currentManual, setSearchParams]
  );

  // 닫기 핸들러 (항상 홈으로 이동)
  const handleClose = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        backgroundColor: 'var(--color-background)',
      }}
    >
      <ManualSidebar
        currentManual={currentManual}
        currentSectionId={currentSectionId}
        onSelectManual={handleSelectManual}
        onSelectSection={handleSelectSection}
        onClose={handleClose}
      />
      <ManualBody
        manual={currentManual}
        currentSectionId={currentSectionId}
        onSelectSection={handleSelectSection}
      />
    </div>
  );
}
