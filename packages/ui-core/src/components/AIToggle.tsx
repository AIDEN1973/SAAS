/**
 * AI Toggle Component
 *
 * 글로벌 헤더 AI 온오프 토글 스위치
 * SSOT: 프론트 자동화 문서 "글로벌 헤더 AI 토글 — UX/정책 SSOT" 섹션 참조
 *
 * [불변 규칙] 글로벌 헤더에만 위치
 * [불변 규칙] owner/admin만 토글 변경 가능
 * [불변 규칙] UI 숨김 금지: AI OFF 상태에서도 토글은 표시 유지
 */

import React from 'react';
import { Switch } from './Switch';
import { Tooltip } from './Tooltip';
import { useTenantFeature, useUpdateTenantFeature } from '@hooks/use-tenant-feature';
import { useUserRole } from '@hooks/use-auth';
import { useModal } from '../hooks/useModal';

export interface AIToggleProps {
  className?: string;
}

/**
 * AI 토글 컴포넌트
 *
 * SSOT 규칙:
 * - 플랫폼 스위치: PLATFORM_AI_ENABLED (env-registry/server, 프론트에서는 읽기 전용)
 * - 테넌트 스위치: tenant_features(feature_key='ai').enabled (SSOT)
 * - 최종 유효값: effective_ai_enabled = PLATFORM_AI_ENABLED && tenant_features['ai'].enabled
 */
export const AIToggle: React.FC<AIToggleProps> = ({ className }) => {
  const { data: aiFeature, isLoading } = useTenantFeature('ai');
  const updateFeature = useUpdateTenantFeature('ai');
  const { data: userRole } = useUserRole();
  const { showAlert } = useModal();

  // 기본값: enabled = true (활성화)
  const enabled = aiFeature?.enabled ?? true;

  // 권한 체크: owner/admin만 토글 변경 가능
  const canToggle = userRole === 'owner' || userRole === 'admin' || userRole === 'super_admin';

  const handleToggle = async (checked: boolean) => {
    if (!canToggle) {
      showAlert('권한 없음', 'AI 기능 토글은 원장/관리자만 변경할 수 있습니다.');
      return;
    }

    try {
      await updateFeature.mutateAsync(checked);
      // 성공 시 캐시 무효화는 hook에서 처리
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 기능 토글 변경에 실패했습니다.';
      showAlert('오류', message);
    }
  };

  // 플랫폼 레벨 AI 비활성화 체크 (프론트에서는 읽기 전용, 서버에서만 확인)
  // TODO: 플랫폼 레벨 체크는 서버 API를 통해 확인해야 함
  // 현재는 테넌트 레벨만 체크

  return (
    <Tooltip
      content={
        !canToggle
          ? 'AI 기능 토글은 원장/관리자만 변경할 수 있습니다.'
          : enabled
          ? 'AI 기능이 켜져 있습니다. 클릭하여 끄세요.'
          : 'AI 기능이 꺼져 있습니다. 클릭하여 켜세요.'
      }
    >
      <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          AI
        </span>
        <Switch
          checked={enabled}
          onChange={(e) => handleToggle(e.target.checked)}
          disabled={!canToggle || isLoading || updateFeature.isPending}
          aria-label="AI 기능 온오프"
        />
      </div>
    </Tooltip>
  );
};

