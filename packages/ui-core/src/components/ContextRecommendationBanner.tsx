/**
 * Context Recommendation Banner Component
 *
 * 프론트 자동화 문서 1.3.1 섹션 참조
 * ⚠️ 정본: "Adaptive Navigation Banner" → "Context Recommendation Banner"로 변경
 *
 * [불변 규칙] 배너는 (1) 추천 표시 + (2) 사용자 클릭 시 이동만
 * [불변 규칙] 카운트다운/자동 실행/자동 승인 표현은 전부 삭제
 * [불변 규칙] 배너는 사용자 클릭 시에만 이동한다. 자동 이동/자동 실행은 없다.
 */

import React from 'react';
import { Info, X } from 'lucide-react';
import { Button } from './Button';
import { useIconSize, useIconStrokeWidth } from '../hooks/useIconSize';

export interface ContextRecommendation {
  id: string;
  trigger_type: 'time_based' | 'event_based' | 'pattern_based';
  condition: {
    time_range?: { start: string; end: string };
    day_of_week?: string[];
    class_id?: string;
    minutes_before?: number;
    minutes_after?: number;
  };
  action: {
    type: 'show_banner' | 'highlight_card' | 'adjust_priority';
    target: string;
    priority: number;
    require_confirmation?: boolean;
  };
  enabled: boolean;
}

export interface ContextRecommendationBannerProps {
  recommendation: ContextRecommendation;
  onNavigate: () => void; // 정본: onExecute → onNavigate (실행 암시 제거)
  onDismiss: () => void;
  className?: string;
}

/**
 * Context Recommendation Banner 컴포넌트
 *
 * 상황 기반 추천을 상단 배너로 표시
 * 사용자 클릭 시 이동 (추천만, 자동 실행 없음)
 */
export const ContextRecommendationBanner: React.FC<ContextRecommendationBannerProps> = ({
  recommendation,
  onNavigate,
  onDismiss,
  className,
}) => {
  const iconSize = useIconSize('--size-icon-base', 16);
  const iconStrokeWidth = useIconStrokeWidth('--stroke-width-icon', 1.5);

  // 배너 메시지 생성
  const getBannerMessage = (): string => {
    if (recommendation.trigger_type === 'time_based') {
      if (recommendation.condition.minutes_before) {
        return `수업 시작 ${recommendation.condition.minutes_before}분 전입니다. 출석부를 확인하세요.`;
      }
      if (recommendation.condition.minutes_after !== undefined) {
        return '수업이 종료되었습니다. 상담일지를 작성하세요.';
      }
    }
    return '추천 액션이 있습니다.';
  };

  const bannerStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    backgroundColor: 'var(--color-info-light)',
    borderBottom: 'var(--border-width-thin) solid var(--color-info)',
    padding: 'var(--spacing-md)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-md)',
    boxShadow: 'var(--shadow-sm)',
  };

  return (
    <div className={className} style={bannerStyle}>
      <Info
        size={iconSize}
        strokeWidth={iconStrokeWidth}
        style={{ color: 'var(--color-info)', flexShrink: 0 }}
      />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text)' }}>
          {getBannerMessage()}
        </span>
        <Button
          variant="outline"
          color="info"
          size="sm"
          onClick={onNavigate}
          style={{ marginLeft: 'var(--spacing-sm)' }}
        >
          이동하기
        </Button>
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 'var(--spacing-xs)',
          display: 'flex',
          alignItems: 'center',
          color: 'var(--color-text-secondary)',
          transition: 'var(--transition-all)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-text)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-secondary)';
        }}
        aria-label="배너 닫기"
      >
        <X size={iconSize} strokeWidth={iconStrokeWidth} />
      </button>
    </div>
  );
};

