/**
 * ActionButtonGroup Component
 *
 * [불변 규칙] Tailwind 클래스 사용 금지
 * [불변 규칙] 모든 스타일은 design-system CSS 변수 토큰만 사용
 *
 * 목적:
 * - 페이지/폼의 하단 액션(삭제/취소/저장, 삭제/수정 등)을 일관된 레이아웃으로 재사용
 */

import React from 'react';
import type { ColorToken, SizeToken } from '@design-system/core';
import { Button } from './Button';

export interface ActionButtonItem {
  key: string;
  label: string;
  /**
   * 루시드 아이콘 요소를 전달하세요. (예: icon: <Trash2 />)
   * ActionButtonGroup이 IconButtonGroup과 동일한 기준(CSS 변수)으로 size/strokeWidth를 적용합니다.
   */
  icon?: React.ReactNode;
  onClick?: () => void | Promise<void>;
  type?: 'button' | 'submit';
  variant?: 'solid' | 'outline' | 'ghost';
  color?: ColorToken;
  size?: SizeToken;
  disabled?: boolean;
}

export interface ActionButtonGroupProps {
  items: ActionButtonItem[];
  /** 기본값: sm (SchemaForm/StudentsPage 일관) */
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** 기본값: md (SchemaForm 버튼 영역과 정합) */
  marginTop?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'none';
  /**
   * 아이콘 크기 정책
   * - default: 토큰(--size-icon-base, --stroke-width-icon-medium) 그대로 적용
   * - small: IconButtonGroup의 "업로드/다운로드/양식받기"와 동일하게 2pt 작게/선 얇게
   */
  iconVariant?: 'default' | 'small';
}

const spacingVar: Record<Exclude<ActionButtonGroupProps['gap'], undefined>, string> = {
  xs: 'var(--spacing-xs)',
  sm: 'var(--spacing-sm)',
  md: 'var(--spacing-md)',
  lg: 'var(--spacing-lg)',
  xl: 'var(--spacing-xl)',
};

const marginTopVar: Record<Exclude<ActionButtonGroupProps['marginTop'], undefined>, string> = {
  none: 'var(--spacing-none)',
  xs: 'var(--spacing-xs)',
  sm: 'var(--spacing-sm)',
  md: 'var(--spacing-md)',
  lg: 'var(--spacing-lg)',
  xl: 'var(--spacing-xl)',
};

export const ActionButtonGroup: React.FC<ActionButtonGroupProps> = ({
  items,
  gap = 'sm',
  marginTop = 'md',
  iconVariant = 'default',
}) => {
  // IconButtonGroup과 "완전히 동일한" 기준으로 아이콘 크기/선 두께 적용
  // (문서 준수: CSS 변수 기반, 하드코딩 최소화)
  const strokeWidth = React.useMemo(() => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--stroke-width-icon-medium')
        .trim();
      const parsed = value ? Number(value) : 2;
      return Number.isFinite(parsed) ? parsed : 2;
    }
    return 2;
  }, []);

  const iconSize = React.useMemo(() => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--size-icon-base')
        .trim();
      if (value.endsWith('rem')) {
        const remValue = parseFloat(value);
        // ⚠️ 중요: 하드코딩 금지, CSS 변수 사용
        // 기본 폰트 크기는 CSS 변수에서 읽어야 하지만, fallback으로 16px 사용
        // 실제로는 var(--font-size-base)를 사용하는 것이 권장됨
        // HARD-CODE-EXCEPTION: fallback 값 16은 브라우저 기본 폰트 크기 (브라우저 호환성용 상수)
        const baseFontSize = typeof window !== 'undefined'
          ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size-base').trim()) || 16
          : 16;
        return remValue * baseFontSize;
      }
      if (value.endsWith('px')) {
        return parseFloat(value);
      }
      const parsed = value ? Number(value) : 16;
      return Number.isFinite(parsed) ? parsed : 16;
    }
    return 16;
  }, []);

  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;

  const renderIcon = (icon: React.ReactNode) => {
    if (!icon) return null;
    const finalIconSize = iconVariant === 'small' ? Math.max(iconSize - 2, 12) : iconSize;
    const finalStrokeWidth = iconVariant === 'small' ? Math.max(strokeWidth - 0.5, 1) : strokeWidth;
    // lucide-react 아이콘은 ReactElement이며 size/strokeWidth props를 받음
    if (React.isValidElement(icon)) {
      // 아이콘에 이미 size prop이 있으면 그것을 우선 사용 (사용자 지정 크기)
      const existingSize = (icon as React.ReactElement<any>).props?.size;
      const existingStrokeWidth = (icon as React.ReactElement<any>).props?.strokeWidth;
      return React.cloneElement(icon as React.ReactElement<any>, {
        size: existingSize !== undefined ? existingSize : finalIconSize,
        strokeWidth: existingStrokeWidth !== undefined ? existingStrokeWidth : finalStrokeWidth,
      });
    }
    return icon;
  };

  return (
    <div style={{ width: '100%', marginTop: marginTopVar[marginTop] }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(visible.length, 3)}, minmax(0, 1fr))`,
          gap: spacingVar[gap],
          width: '100%',
        }}
      >
        {visible.map((item) => (
          <Button
            key={item.key}
            type={item.type || 'button'}
            variant={item.variant || 'outline'}
            color={item.color}
            size={item.size || 'sm'}
            fullWidth
            disabled={item.disabled}
            onClick={item.onClick as any}
          >
            {item.icon ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                {renderIcon(item.icon)}
                <span>{item.label}</span>
              </span>
            ) : (
              item.label
            )}
          </Button>
        ))}
      </div>
    </div>
  );
};


