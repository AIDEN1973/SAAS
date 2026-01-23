/**
 * IconButtonGroup Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React, { useMemo } from 'react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import type { LucideIcon, LucideProps } from 'lucide-react';
import type { ColorToken } from '@design-system/core';

export interface IconButtonItem {
  icon: LucideIcon | React.ForwardRefExoticComponent<LucideProps & React.RefAttributes<SVGSVGElement>>;
  tooltip: string;
  onClick: () => void;
  variant?: 'solid' | 'outline' | 'ghost';
  color?: ColorToken;
  disabled?: boolean;
}

export interface IconButtonGroupProps {
  items: IconButtonItem[];
  className?: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * IconButtonGroup 컴포넌트
 *
 * 아이콘 버튼 그룹을 표시하는 공통 컴포넌트
 */
export const IconButtonGroup: React.FC<IconButtonGroupProps> = ({
  items,
  className,
  align = 'right',
}) => {
  const justifyContent = align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end';

  // CSS 변수에서 strokeWidth 읽기 (하드코딩 제거)
  const strokeWidth = useMemo(() => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--stroke-width-icon-medium')
        .trim();
      return value ? Number(value) : 2;
    }
    return 2;
  }, []);

  // CSS 변수에서 icon size 읽기 (lucide-react Icon은 숫자만 받음)
  const iconSize = useMemo(() => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--size-icon-base')
        .trim();
      // rem 단위를 px로 변환 (CSS 변수에서 기본 폰트 크기 읽기)
      if (value.endsWith('rem')) {
        const remValue = parseFloat(value);
        // ⚠️ 중요: 하드코딩 금지, CSS 변수에서 기본 폰트 크기 읽기
        // HARD-CODE-EXCEPTION: fallback 값 16은 브라우저 기본 폰트 크기 (브라우저 호환성용 상수)
        const baseFontSize = typeof window !== 'undefined'
          ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size-base').trim()) || 16
          : 16;
        return remValue * baseFontSize;
      }
      // px 단위인 경우
      if (value.endsWith('px')) {
        return parseFloat(value);
      }
      // 단위가 없는 경우 숫자로 변환
      return value ? Number(value) : 16;
    }
    return 16;
  }, []);

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: 'var(--spacing-xs)',
        justifyContent,
        flexWrap: 'wrap',
      }}
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        const hasColor = !!item.color;
        const useThemeColor = item.variant === 'solid' && item.color === 'primary';

        // 업로드, 다운로드, 양식받기 아이콘은 2포인트 작게, 선 가늘게
        const isSmallIcon = ['업로드', '다운로드', '양식받기'].includes(item.tooltip);
        const finalIconSize = isSmallIcon ? Math.max(iconSize - 2, 12) : Math.max(iconSize, 16);
        const finalStrokeWidth = isSmallIcon ? Math.max(strokeWidth - 0.5, 1) : Math.max(strokeWidth, 1.5);

        return (
          <Tooltip
            key={index}
            content={item.tooltip}
            position="top"
            useThemeColor={useThemeColor}
          >
            <Button
              variant={item.variant || 'outline'}
              color={item.color || 'primary'}
              onClick={item.onClick}
              disabled={item.disabled}
              aria-label={item.tooltip}
              style={{
                padding: 0,
                minWidth: 'auto',
                // [불변 규칙] Button sm과 동일한 높이 토큰 사용으로 일관성 보장
                width: 'var(--height-control-sm)',
                height: 'var(--height-control-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'visible', // 아이콘이 잘리지 않도록
                ...(item.variant === 'outline' && !hasColor && {
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-text)',
                }),
              }}
            >
              <Icon
                size={finalIconSize}
                strokeWidth={finalStrokeWidth}
              />
            </Button>
          </Tooltip>
        );
      })}
    </div>
  );
};

