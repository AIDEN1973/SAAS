/**
 * Button Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { ColorToken, SizeToken } from '@design-system/core';
import { Save, X, Edit, Trash2, Plus, Check, Download, Upload, RefreshCw, Send, Sparkles } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'ghost' | 'destructive';
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
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'solid',
  color = 'primary',
  size = 'md',
  fullWidth = false,
  selected = false,
  className,
  children,
  ...props
}, ref) => {
  // hover 상태 관리 (inline style 직접 조작 대신 state 사용)
  const [isHovered, setIsHovered] = React.useState(false);

  // 버튼 텍스트에 따라 아이콘 매핑 (성능 최적화: useCallback + useMemo)
  const getIconByText = React.useCallback((text: React.ReactNode): React.ReactNode | null => {
    if (typeof text !== 'string') return null;

    const lowerText = text.toLowerCase().trim();

    // 저장 관련
    if (lowerText.includes('저장') || lowerText.includes('save')) {
      return <Save size={14} strokeWidth={1.5} />;
    }
    // 수정 관련
    if (lowerText.includes('수정') || lowerText.includes('edit')) {
      return <Edit size={14} strokeWidth={1.5} />;
    }
    // 삭제 관련
    if (lowerText.includes('삭제') || lowerText.includes('delete') || lowerText.includes('remove')) {
      return <Trash2 size={14} strokeWidth={1.5} />;
    }
    // 추가/등록 관련
    if (lowerText.includes('추가') || lowerText.includes('등록') || lowerText.includes('add') || lowerText.includes('new')) {
      return <Plus size={14} strokeWidth={1.5} />;
    }
    // 확인 관련
    if (lowerText.includes('확인') || lowerText.includes('완료') || lowerText.includes('confirm') || lowerText.includes('ok')) {
      return <Check size={14} strokeWidth={1.5} />;
    }
    // 취소/닫기 관련
    if (lowerText.includes('취소') || lowerText.includes('닫기') || lowerText.includes('cancel') || lowerText.includes('close')) {
      return <X size={14} strokeWidth={1.5} />;
    }
    // 다운로드 관련
    if (lowerText.includes('다운로드') || lowerText.includes('download') || lowerText.includes('export')) {
      return <Download size={14} strokeWidth={1.5} />;
    }
    // 업로드 관련
    if (lowerText.includes('업로드') || lowerText.includes('upload') || lowerText.includes('import')) {
      return <Upload size={14} strokeWidth={1.5} />;
    }
    // 새로고침/재시도 관련
    if (lowerText.includes('새로고침') || lowerText.includes('재시도') || lowerText.includes('refresh') || lowerText.includes('retry')) {
      return <RefreshCw size={14} strokeWidth={1.5} />;
    }
    // 전송/보내기 관련
    if (lowerText.includes('전송') || lowerText.includes('보내기') || lowerText.includes('send') || lowerText.includes('submit')) {
      return <Send size={14} strokeWidth={1.5} />;
    }
    // AI 요약 관련
    if (lowerText.includes('요약') || lowerText.includes('ai') || lowerText.includes('summary')) {
      return <Sparkles size={14} strokeWidth={1.5} />;
    }

    return null;
  }, []);

  const icon = React.useMemo(() => getIconByText(children), [getIconByText, children]);

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

  // Size를 CSS Variables로 매핑 (Select 컴포넌트와 높이 일치)
  const sizeStyles: Record<SizeToken, React.CSSProperties> = {
    xs: {
      padding: 'var(--spacing-xs) var(--spacing-xs)',
    },
    sm: {
      padding: 'calc(var(--spacing-xs) + var(--spacing-xs) / 2) var(--spacing-sm)',
    },
    md: {
      padding: 'var(--spacing-sm) var(--spacing-sm)', // Select md와 동일한 높이
    },
    lg: {
      padding: 'var(--spacing-md) var(--spacing-md)', // Select lg와 동일한 높이
    },
    xl: {
      padding: 'var(--spacing-lg) var(--spacing-lg)', // Select xl와 동일한 높이
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
    fontFamily: 'var(--font-family)', // Select와 동일한 폰트
    fontSize: 'var(--font-size-base)', // Select와 동일한 폰트 크기
    // 버튼 높이 일관성을 위해 tight lineHeight 적용 (styles.css 준수)
    lineHeight: 'var(--line-height-tight)',
    ...sizeStyles[size],
    ...(fullWidth && { width: '100%' }),
  };

  // 기본 버튼은 텍스트 기본 색상 사용, 선택된 버튼은 인더스트리 테마 색상 사용
  const defaultTextColor = selected ? colorVars.main : 'var(--color-text)';

  // hover 상태에 따른 배경색 계산 함수
  const getBackgroundColor = (v: 'solid' | 'outline' | 'ghost'): string => {
    if (v === 'solid') {
      return isHovered
        ? (colorVars.dark || 'var(--color-gray-200)')
        : (colorVars.main || 'var(--color-white)');
    } else if (v === 'outline') {
      if (isHovered) return 'var(--color-primary-hover)';
      return selected ? 'var(--color-primary-selected)' : 'var(--color-white)';
    } else {
      // ghost
      if (isHovered) return 'var(--color-primary-hover)';
      return selected ? 'var(--color-primary-selected)' : 'transparent';
    }
  };

  const variantStyles: Record<'solid' | 'outline' | 'ghost' | 'destructive', React.CSSProperties> = {
    solid: {
      backgroundColor: getBackgroundColor('solid'),
      color: 'var(--color-white)',
      boxShadow: isHovered ? 'var(--shadow-md)' : 'none',
      // baseStyle에서 테두리 적용됨 (선택: primary 색상, 미선택: 투명)
    },
    outline: {
      backgroundColor: getBackgroundColor('outline'),
      color: defaultTextColor || 'var(--color-text)', // 색상 없으면 기본 텍스트 색상
      // baseStyle에서 테두리 적용됨 (선택: primary 색상, 미선택: 투명)
      // outline variant는 미선택 시 gray-200 테두리로 오버라이드 (SchemaTable 기준)
      ...(selected ? {} : { border: `var(--border-width-thin) solid var(--color-gray-200)` }),
    },
    ghost: {
      backgroundColor: getBackgroundColor('ghost'),
      color: defaultTextColor || 'var(--color-text)', // 색상 없으면 기본 텍스트 색상
      // baseStyle에서 테두리 적용됨 (선택: primary 색상, 미선택: 투명)
    },
    destructive: {
      backgroundColor: isHovered ? colorMap.error.dark : colorMap.error.main,
      color: 'var(--color-white)',
      border: `var(--border-width-thin) solid transparent`,
      boxShadow: isHovered ? 'var(--shadow-md)' : 'none',
    },
  };

  const style: React.CSSProperties = {
    ...baseStyle,
    ...variantStyles[variant],
    ...props.style, // 외부에서 전달된 style prop을 마지막에 병합하여 오버라이드 허용
  };

  // style prop을 제거하여 중복 전달 방지
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { style: _unusedStyle, ...restProps } = props;

  return (
    <button
      ref={ref}
      className={clsx(className)}
      style={{
        ...style,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...restProps}
    >
      {icon && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            marginRight: 'var(--spacing-xs)',
          }}
        >
          {icon}
        </span>
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
