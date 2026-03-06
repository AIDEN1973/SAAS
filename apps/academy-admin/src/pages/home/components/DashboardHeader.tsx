/**
 * 대시보드 헤더 컴포넌트
 *
 * [LAYER: UI_PAGE]
 */

import { PageHeader, ContextRecommendationBanner } from '@ui-core/react';
import type { ContextRecommendation } from '@ui-core/react';
import { useIndustryTerms } from '@hooks/use-industry-terms';

interface DashboardHeaderProps {
  adaptiveNav: {
    currentRecommendation: ContextRecommendation | null;
    dismissRecommendation: () => void;
  };
  isSafeInternalTarget: (raw: string) => boolean;
  safeNavigate: (path: string) => void;
}

export function DashboardHeader({ adaptiveNav, isSafeInternalTarget, safeNavigate }: DashboardHeaderProps) {
  const terms = useIndustryTerms();

  return (
    <>
      <PageHeader title="홈 대시보드" />

      <div style={{
        marginBottom: 'var(--spacing-xl)',
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-gray-50)',
        borderRadius: 'var(--border-radius-md)',
        fontSize: 'var(--font-size-base)',
        color: 'var(--color-text-secondary)',
        lineHeight: 'var(--line-height-relaxed)',
      }}>
        <p style={{ margin: 0 }}>
          이 대시보드에서는 <strong style={{ color: 'var(--color-text)' }}>긴급 알림, AI 브리핑, {terms.PERSON_LABEL_PRIMARY} 업무, {terms.ATTENDANCE_LABEL} 통계, 매출 현황</strong> 등 운영에 필요한 핵심 정보를 한눈에 확인할 수 있습니다.
          긴급 알림을 통해 즉시 대응이 필요한 사항을 파악하고, AI 브리핑으로 {terms.PERSON_LABEL_PLURAL}의 상태와 트렌드를 분석하며,
          실시간 통계를 통해 {terms.ATTENDANCE_LABEL}률과 매출을 모니터링하여 더욱 효율적으로 운영하세요.
        </p>
      </div>

      {adaptiveNav.currentRecommendation && (
        <ContextRecommendationBanner
          recommendation={adaptiveNav.currentRecommendation}
          onNavigate={() => {
            const target = adaptiveNav.currentRecommendation?.action.target ?? '';
            if (!isSafeInternalTarget(target)) return;
            safeNavigate(target);
          }}
          onDismiss={adaptiveNav.dismissRecommendation}
        />
      )}
    </>
  );
}
