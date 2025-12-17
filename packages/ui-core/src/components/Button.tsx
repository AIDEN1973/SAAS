/**
 * Button Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { ColorToken, SizeToken } from '@design-system/core';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'ghost';
  color?: ColorToken;
  size?: SizeToken;
  fullWidth?: boolean;
  selected?: boolean;
  children: React.ReactNode;
}

/**
 * Button 컴포넌트
 *
 * 스키마에서의 사용 예:
 * {
 *   "type": "button",
 *   "variant": "solid",
 *   "color": "primary",
 *   "size": "md"
 * }
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'solid',
  color = 'primary',
  size = 'md',
  fullWidth = false,
  selected = false,
  className,
  children,
  ...props
}) => {
  // Color token을 CSS Variable로 매핑
  const colorMap: Record<ColorToken, {
    main: string;
    light: string;
    dark: string;
    bg50: string;
  }> = {
    primary: {
      main: 'var(--color-primary)',
      light: 'var(--color-primary-light)',
      dark: 'var(--color-primary-dark)',
      bg50: 'var(--color-primary-50)',
    },
    secondary: {
      main: 'var(--color-secondary)',
      light: 'var(--color-secondary-light)',
      dark: 'var(--color-secondary-dark)',
      bg50: 'var(--color-secondary-50)',
    },
    success: {
      main: 'var(--color-success)',
      light: 'var(--color-success-light)',
      dark: 'var(--color-success-dark)',
      bg50: 'var(--color-success-50)',
    },
    warning: {
      main: 'var(--color-warning)',
      light: 'var(--color-warning-light)',
      dark: 'var(--color-warning-dark)',
      bg50: 'var(--color-warning-50)',
    },
    error: {
      main: 'var(--color-error)',
      light: 'var(--color-error-light)',
      dark: 'var(--color-error-dark)',
      bg50: 'var(--color-error-50)',
    },
    info: {
      main: 'var(--color-info)',
      light: 'var(--color-info-light)',
      dark: 'var(--color-info-dark)',
      bg50: 'var(--color-info-50)',
    },
  };

  // 선택된 버튼은 인더스트리 테마(primary) 적용, 기본 버튼은 기본 색상(text) 적용
  const effectiveColor: ColorToken = selected ? 'primary' : color;
  const colorVars = colorMap[effectiveColor];

  // Size를 CSS Variables로 매핑 (세로 패딩 한 포인트 올림)
  const sizeStyles: Record<SizeToken, React.CSSProperties> = {
    xs: {
      padding: 'var(--spacing-sm) var(--spacing-xs)',
    },
    sm: {
      padding: 'var(--spacing-sm) var(--spacing-sm)',
    },
    md: {
      padding: 'var(--spacing-sm) var(--spacing-sm)',
    },
    lg: {
      padding: 'var(--spacing-md) var(--spacing-md)',
    },
    xl: {
      padding: 'var(--spacing-lg) var(--spacing-lg)',
    },
  };

  const baseStyle: React.CSSProperties = {
    fontWeight: selected ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
    borderRadius: 'var(--border-radius-xs)', // styles.css 준수: border-radius 토큰 사용
    // 선택된 버튼은 primary 색상 테두리, 미선택 버튼은 투명 테두리로 크기 일치 유지
    border: selected
      ? `var(--border-width-thin) solid ${colorVars.main}`
      : `var(--border-width-thin) solid transparent`,
    cursor: 'pointer',
    transition: 'var(--transition-all)',
    outline: 'none',
    boxSizing: 'border-box', // 테두리 포함 크기 계산
    ...sizeStyles[size],
    ...(fullWidth && { width: '100%' }),
  };

  // 기본 버튼은 텍스트 기본 색상 사용, 선택된 버튼은 인더스트리 테마 색상 사용
  const defaultTextColor = selected ? colorVars.main : 'var(--color-text)';

  const variantStyles: Record<'solid' | 'outline' | 'ghost', React.CSSProperties> = {
    solid: {
      backgroundColor: colorVars.main,
      color: 'var(--color-white)',
      // baseStyle에서 테두리 적용됨 (선택: primary 색상, 미선택: 투명)
    },
    outline: {
      backgroundColor: 'var(--color-white)',
      color: defaultTextColor,
      // baseStyle에서 테두리 적용됨 (선택: primary 색상, 미선택: 투명)
      // outline variant는 미선택 시 텍스트 색상 테두리로 오버라이드
      ...(selected ? {} : { border: `var(--border-width-thin) solid ${defaultTextColor}` }),
    },
    ghost: {
      backgroundColor: 'transparent',
      color: defaultTextColor,
      // baseStyle에서 테두리 적용됨 (선택: primary 색상, 미선택: 투명)
    },
  };

  const style: React.CSSProperties = {
    ...baseStyle,
    ...variantStyles[variant],
    ...props.style, // 외부에서 전달된 style prop을 마지막에 병합하여 오버라이드 허용
  };

  // style prop을 제거하여 중복 전달 방지
  const { style: _, ...restProps } = props;

  return (
    <button
      className={clsx(className)}
      style={style}
      onMouseEnter={(e) => {
        if (variant === 'solid') {
          e.currentTarget.style.backgroundColor = colorVars.dark;
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        } else if (variant === 'outline') {
          const hoverBgColor = selected ? colorVars.bg50 : 'var(--color-gray-50)';
          e.currentTarget.style.backgroundColor = hoverBgColor;
        } else if (variant === 'ghost') {
          const hoverBgColor = selected ? colorVars.bg50 : 'var(--color-gray-50)';
          e.currentTarget.style.backgroundColor = hoverBgColor;
        }
      }}
      onMouseLeave={(e) => {
        if (variant === 'solid') {
          e.currentTarget.style.backgroundColor = colorVars.main;
          e.currentTarget.style.boxShadow = 'none';
        } else if (variant === 'outline') {
          e.currentTarget.style.backgroundColor = 'var(--color-white)';
        } else if (variant === 'ghost') {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
      onFocus={(e) => {
        // 포커스 링 제거: 버튼 클릭 시 테두리 굵어지는 효과 제거 (유아이 문서 준수)
        // 키보드 접근성은 styles.css의 button:focus-visible에서 처리
      }}
      onBlur={(e) => {
        // 포커스 링 제거: 버튼 클릭 시 테두리 굵어지는 효과 제거 (유아이 문서 준수)
      }}
      {...restProps}
    >
      {children}
    </button>
  );
};
