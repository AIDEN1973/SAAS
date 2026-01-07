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
import { Tooltip } from './Tooltip';
import { useTenantFeature, useUpdateTenantFeature } from '@hooks/use-tenant-feature';
import { useUserRole } from '@hooks/use-auth';
import { useModal } from '../hooks/useModal';
import { Robot } from 'phosphor-react';

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
      showAlert('AI 기능 토글은 원장/관리자만 변경할 수 있습니다.', '권한 없음');
      return;
    }

    try {
      await updateFeature.mutateAsync(checked);
      // 성공 시 캐시 무효화는 hook에서 처리
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 기능 토글 변경에 실패했습니다.';
      showAlert(message, '오류');
    }
  };

  // 플랫폼 레벨 AI 비활성화 체크 (프론트에서는 읽기 전용, 서버에서만 확인)
  // TODO: 플랫폼 레벨 체크는 서버 API를 통해 확인해야 함
  // 현재는 테넌트 레벨만 체크

  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <Tooltip
      content={
        !canToggle
          ? 'AI 기능 토글은 원장/관리자만 변경할 수 있습니다.'
          : enabled
          ? 'AI 활성화'
          : 'AI 비활성화'
      }
      position="bottom"
    >
      <button
        className={className}
        onClick={() => handleToggle(!enabled)}
        disabled={!canToggle || isLoading || updateFeature.isPending}
        aria-label={enabled ? 'AI 비활성화' : 'AI 활성화'}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--spacing-sm)',
          backgroundColor: isHovered && !(!canToggle || isLoading || updateFeature.isPending) ? 'var(--color-primary-40)' : 'transparent',
          border: 'none',
          borderRadius: 'var(--border-radius-md)',
          cursor: !canToggle || isLoading || updateFeature.isPending ? 'not-allowed' : 'pointer',
          opacity: !canToggle || isLoading || updateFeature.isPending ? 0.5 : 1,
          transition: 'var(--transition-all)',
        }}
      >
        <Robot
          weight={enabled ? 'bold' : 'regular'}
          style={{
            width: 'var(--size-icon-xl)',
            height: 'var(--size-icon-xl)',
            color: enabled ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
          }}
        />
      </button>
    </Tooltip>
  );
};

