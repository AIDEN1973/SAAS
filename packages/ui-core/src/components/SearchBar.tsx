/**
 * SearchBar Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { Input } from './Input';
import { Button } from './Button';

export interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  onClear?: () => void;
  className?: string;
  fullWidth?: boolean;
}

/**
 * SearchBar 컴포넌트
 *
 * 검색 기능을 제공하는 입력 필드
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = '검색...',
  value: controlledValue,
  onChange,
  onSearch,
  onClear,
  className,
  fullWidth = false,
}) => {
  const [internalValue, setInternalValue] = useState('');
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  const handleSearch = () => {
    onSearch?.(value);
  };

  const handleClear = () => {
    if (controlledValue === undefined) {
      setInternalValue('');
    }
    onChange?.('');
    onClear?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange(e)}
        onKeyDown={handleKeyDown}
        fullWidth={fullWidth}
        style={{
          flex: 1,
        }}
      />
      {value && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          style={{
            minWidth: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
            minHeight: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
          }}
        >
          ✕
        </Button>
      )}
      <Button
        variant="solid"
        color="primary"
        size="md"
        onClick={handleSearch}
          style={{
            minWidth: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
            minHeight: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
          }}
      >
        검색
      </Button>
    </div>
  );
};

