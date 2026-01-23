/**
 * ProfileEntityCard Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 *
 * 프로필 이미지가 포함된 엔티티 카드 (강사, 직원 등 인물 정보 표시용)
 * - 좌측: 원형 프로필 이미지
 * - 우측 상단: 배지 + 이름
 * - 구분선
 * - 우측 하단: 연락처 + 통계 정보
 */

import React from 'react';
import { Card } from './Card';
import { Badge } from './Badge';
import { Avatar } from './Avatar';
import { ColorToken } from '@design-system/core';

export interface ProfileEntityCardProps {
  /** 프로필 이미지 URL */
  profileImageUrl?: string | null;
  /** 상단 배지 설정 */
  badge?: {
    label: string;
    color?: ColorToken | 'blue' | 'gray' | 'green' | 'yellow';
  };
  /** 보조 레이블 (배지로 표시) */
  secondaryLabel?: string;
  /** 카드 제목 (이름) */
  title: string;
  /** 하단 왼쪽 설명 텍스트 (전화번호, 이메일 등) */
  description?: string;
  /** 하단 오른쪽 통계 정보 (예: "3개 / 15명") */
  statsText?: string;
  /** 클릭 이벤트 핸들러 */
  onClick?: () => void;
  /** 선택 상태 */
  selected?: boolean;
  /** 비활성화 상태 */
  disabled?: boolean;
  /** 추가 스타일 */
  style?: React.CSSProperties;
}

/**
 * ProfileEntityCard 컴포넌트
 *
 * 프로필 이미지가 포함된 엔티티를 카드 형태로 표시하는 컴포넌트
 * - 강사 카드: 프로필 이미지 + 전문분야 배지 + 이름 + 연락처 + 담당 수업/학생 수
 * - 직원 카드: 프로필 이미지 + 부서 배지 + 이름 + 연락처 + 담당 업무
 */
export const ProfileEntityCard: React.FC<ProfileEntityCardProps> = ({
  profileImageUrl,
  badge,
  secondaryLabel,
  title,
  description,
  statsText,
  onClick,
  selected,
  disabled,
  style,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <Card
      padding="md"
      variant="outlined"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-sm)',
        cursor: onClick ? 'pointer' : 'default',
        opacity: disabled ? 'var(--opacity-disabled)' : 1,
        borderColor: selected ? 'var(--color-primary)' : 'var(--color-gray-200)',
        backgroundColor: isHovered ? 'var(--color-gray-50)' : 'var(--color-white)',
        transition: 'background-color var(--transition-fast)',
        paddingTop: 'var(--spacing-lg)',
        paddingBottom: 'var(--spacing-lg)',
        ...style,
      }}
    >
      {/* 상단: 배지/이름 + 프로필 이미지 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--spacing-md)',
        }}
      >
        {/* 배지 + 이름 (좌측) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 배지 영역 */}
          {(badge || secondaryLabel) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-xs)' }}>
              {badge && (
                <Badge color={badge.color} size="sm">
                  {badge.label}
                </Badge>
              )}
              {secondaryLabel && (
                <Badge color="gray" size="sm" style={{ backgroundColor: 'var(--color-gray-100)', color: 'var(--color-text)' }}>
                  {secondaryLabel}
                </Badge>
              )}
            </div>
          )}
          {/* 이름 */}
          <span
            style={{
              fontWeight: 'var(--font-weight-extrabold)',
              fontSize: 'var(--font-size-2xl)',
              color: 'var(--color-text)',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
        </div>

        {/* 프로필 이미지 (원형, 테두리) - 우측 */}
        <div
          style={{
            flexShrink: 0,
            width: 'var(--size-avatar-xl)',
            height: 'var(--size-avatar-xl)',
            borderRadius: 'var(--border-radius-full)',
            border: 'var(--border-width-medium) solid var(--color-gray-200)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--color-gray-100)',
          }}
        >
          {profileImageUrl ? (
            <img
              src={profileImageUrl}
              alt={title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <Avatar
              name={title}
              size="lg"
            />
          )}
        </div>
      </div>

      {/* 구분선 */}
      <div
        style={{
          borderTop: 'var(--border-width-thin) solid var(--color-gray-200)',
          marginTop: 'var(--spacing-xs)',
          paddingTop: 'var(--spacing-xs)',
        }}
      />

      {/* 하단: 연락처 + 통계 정보 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--spacing-sm)',
        }}
      >
        {/* 연락처 (왼쪽) */}
        {description && (
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {description}
          </span>
        )}
        {/* 통계 정보 (오른쪽) */}
        {statsText && (
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              fontWeight: 'var(--font-weight-medium)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {statsText}
          </span>
        )}
      </div>
    </Card>
  );
};
