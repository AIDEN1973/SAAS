/**
 * EntityCard Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 *
 * 개별 엔티티(수업, 자동화 설정 등)를 카드 형태로 표시하는 범용 컴포넌트
 */

import React from 'react';
import { Card } from './Card';
import { Badge } from './Badge';
import { ColorToken } from '@design-system/core';

export interface EntityCardProps {
  /** 상단 배지 설정 */
  badge?: {
    label: string;
    color?: ColorToken | 'blue' | 'gray' | 'green' | 'yellow';
  };
  /** 보조 레이블 (배지로 표시) */
  secondaryLabel?: string;
  /** 카드 제목 */
  title: string;
  /** 메인 값 (큰 숫자 또는 텍스트) */
  mainValue: string | number;
  /** 보조 값 (예: "/20" 정원, "건" 단위) */
  subValue?: string;
  /** 하단 설명 텍스트 */
  description?: string;
  /** 요일 (원형 배경 적용) */
  dayOfWeek?: string;
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
 * 요일 색상 결정 (토요일: 블루, 일요일: 레드, 나머지: 그레이)
 */
const getDayColor = (day: string): string => {
  if (day.includes('토') || day.toLowerCase().includes('sat')) return 'var(--color-primary)'; // 블루
  if (day.includes('일') || day.toLowerCase().includes('sun')) return 'var(--color-error)'; // 레드
  return 'var(--color-gray-400)'; // 그레이
};

/**
 * EntityCard 컴포넌트
 *
 * 개별 엔티티를 카드 형태로 표시하는 범용 컴포넌트
 * - 수업 카드: 과목 배지 + 학생수/정원 + 요일/시간
 * - 자동화 설정 카드: 카테고리 배지 + 실행 횟수 + 실행 주기
 */
export const EntityCard: React.FC<EntityCardProps> = ({
  badge,
  secondaryLabel,
  title,
  mainValue,
  subValue,
  description,
  dayOfWeek,
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
        justifyContent: 'center',
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
      {/* 상단: 주 배지 + 보조 배지 */}
      {(badge || secondaryLabel) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
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

      {/* 제목 + 메인값 (수업명 + 정원) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: badge || secondaryLabel ? 'var(--spacing-xs)' : 0,
        }}
      >
        <span
          style={{
            fontWeight: 'var(--font-weight-extrabold)',
            fontSize: 'var(--font-size-2xl)',
            color: 'var(--color-text)',
          }}
        >
          {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--spacing-xs)' }}>
          <span
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-extrabold)',
              color: 'var(--color-text)',
            }}
          >
            {mainValue}
          </span>
          {subValue && (
            <span
              style={{
                fontSize: 'var(--font-size-2xl)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {subValue}
            </span>
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

      {/* 설명 (요일 + 시간) */}
      {(dayOfWeek || description) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          {dayOfWeek && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 'var(--size-icon-xl)',
                height: 'var(--size-icon-xl)',
                borderRadius: '50%',
                backgroundColor: getDayColor(dayOfWeek),
                color: 'var(--color-white)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-medium)',
              }}
            >
              {dayOfWeek}
            </span>
          )}
          {description && (
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {description}
            </span>
          )}
        </div>
      )}
    </Card>
  );
};
