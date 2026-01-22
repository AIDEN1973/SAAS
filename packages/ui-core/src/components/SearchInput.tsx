/**
 * SearchInput Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React from 'react';
import { Search } from 'lucide-react';
import { SizeToken } from '@design-system/core';

export interface SearchInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  size?: SizeToken;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * SearchInput 컴포넌트
 *
 * 검색 아이콘이 포함된 검색 입력 필드
 * Button, Select와 높이가 일치하도록 설계됨
 */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(({
  value = '',
  onChange,
  placeholder = '검색...',
  size = 'sm',
  disabled = false,
  className,
  style,
}, ref) => {
  // Size를 CSS Variables로 매핑 (Button, Select와 동일한 높이 보장)
  // [불변 규칙] 명시적 height 사용으로 Button/Select와 높이 일관성 유지
  const sizeStyles: Record<SizeToken, React.CSSProperties> = {
    xs: {
      height: 'var(--height-control-xs)',
    },
    sm: {
      height: 'var(--height-control-sm)',
    },
    md: {
      height: 'var(--height-control-md)',
    },
    lg: {
      height: 'var(--height-control-lg)',
    },
    xl: {
      height: 'var(--height-control-xl)',
    },
  };

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        minWidth: '240px',
        flex: 1,
        maxWidth: '400px',
        ...style,
      }}
    >
      <Search
        size={16}
        style={{
          position: 'absolute',
          left: 'var(--spacing-sm)',
          top: '50%',
          transform: 'translateY(-50%)',
          color: disabled ? 'var(--color-text-disabled)' : 'var(--color-text-tertiary)',
          pointerEvents: 'none',
        }}
      />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%',
          paddingLeft: 'calc(var(--spacing-sm) * 2 + 16px)', // 아이콘 너비 + 좌측 패딩
          paddingRight: 'var(--spacing-sm)',
          fontSize: 'var(--font-size-base)',
          fontFamily: 'var(--font-family)',
          // [불변 규칙] lineHeight: 1로 설정하여 height 기반 정렬
          lineHeight: 1,
          border: 'var(--border-width-thin) solid var(--color-gray-200)',
          borderRadius: 'var(--border-radius-xs)',
          backgroundColor: disabled ? 'var(--color-background-disabled)' : 'var(--color-white)',
          color: disabled ? 'var(--color-text-disabled)' : 'var(--color-text)',
          outline: 'none',
          transition: 'var(--transition-all)',
          boxSizing: 'border-box',
          cursor: disabled ? 'not-allowed' : 'text',
          ...sizeStyles[size],
        }}
        onFocus={(e) => {
          if (!disabled) {
            e.currentTarget.style.borderColor = 'var(--color-primary)';
            e.currentTarget.style.boxShadow = '0 0 0 var(--border-width-thin) var(--color-primary-50)';
          }
        }}
        onBlur={(e) => {
          if (!disabled) {
            e.currentTarget.style.borderColor = 'var(--color-gray-200)';
            e.currentTarget.style.boxShadow = 'none';
          }
        }}
      />
    </div>
  );
});

SearchInput.displayName = 'SearchInput';
