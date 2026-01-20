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
  /** 요일 (원형 배경 적용) - 단일 문자열 또는 배열 지원 */
  dayOfWeek?: string | string[];
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
 * 요일 배지 배경색 결정 (토요일: 블루, 일요일: 레드, 나머지: 연한 그레이)
 */
const getDayBgColor = (day: string): string => {
  if (!day) return 'var(--color-gray-200)';
  const lowerDay = day.toLowerCase();
  if (day.includes('토') || lowerDay.includes('sat') || lowerDay === 'saturday') return 'var(--color-primary)'; // 블루
  if (day.includes('일') || lowerDay.includes('sun') || lowerDay === 'sunday') return 'var(--color-error)'; // 레드
  return 'var(--color-gray-200)'; // 연한 그레이
};

/**
 * 요일 배지 텍스트 색상 결정 (토/일: 흰색, 나머지: 진한 그레이)
 */
const getDayTextColor = (day: string): string => {
  if (!day) return 'var(--color-gray-600)';
  const lowerDay = day.toLowerCase();
  if (day.includes('토') || lowerDay.includes('sat') || lowerDay === 'saturday') return 'var(--color-white)';
  if (day.includes('일') || lowerDay.includes('sun') || lowerDay === 'sunday') return 'var(--color-white)';
  return 'var(--color-gray-600)'; // 진한 그레이 텍스트
};

/** 요일 영문→한글 약자 매핑 */
const DAY_SHORT_LABELS: Record<string, string> = {
  monday: '월',
  tuesday: '화',
  wednesday: '수',
  thursday: '목',
  friday: '금',
  saturday: '토',
  sunday: '일',
};

/** 요일 정렬 순서 (월~일) */
const DAY_ORDER: string[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * 요일 문자열을 한 글자 약자로 변환
 * "monday" → "월", "월요일" → "월", "월" → "월"
 */
const getDayShortLabel = (day: string): string => {
  const lowerDay = day.toLowerCase();
  // 영문 요일인 경우
  if (DAY_SHORT_LABELS[lowerDay]) return DAY_SHORT_LABELS[lowerDay];
  // 한글 요일인 경우 첫 글자만 반환 (월요일 → 월)
  if (day.length > 0) return day.charAt(0);
  return day;
};

/**
 * 요일 배열을 월~일 순서로 정렬
 */
const sortDays = (days: string[]): string[] => {
  return [...days].sort((a, b) => {
    const aIndex = DAY_ORDER.indexOf(a.toLowerCase());
    const bIndex = DAY_ORDER.indexOf(b.toLowerCase());
    // 매핑되지 않은 요일은 뒤로 보냄
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
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
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                fontWeight: 'var(--font-weight-medium)',
              }}
            >
              {Array.isArray(dayOfWeek)
                ? sortDays(dayOfWeek).map(getDayShortLabel).join(', ')
                : getDayShortLabel(dayOfWeek)}
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
