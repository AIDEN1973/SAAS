/**
 * SearchBar Component
 * 
 * [Î∂àÎ? Í∑úÏπô] ?§ÌÇ§ÎßàÏóê??Tailwind ?¥Îûò?§Î? ÏßÅÏ†ë ?¨Ïö©?òÏ? ?äÎäî??
 * [Î∂àÎ? Í∑úÏπô] Î™®Îì† ?§Ì??ºÏ? design-system ?†ÌÅ∞???¨Ïö©?úÎã§.
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
 * SearchBar Ïª¥Ìè¨?åÌä∏
 * 
 * Í≤Ä??Í∏∞Îä•???úÍ≥µ?òÎäî ?ÖÎ†• Î∞?
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Í≤Ä??..',
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
        onChange={handleChange as any}
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
            minWidth: '44px',
            minHeight: '44px',
          }}
        >
          ??
        </Button>
      )}
      <Button
        variant="solid"
        color="primary"
        size="md"
        onClick={handleSearch}
        style={{
          minWidth: '44px',
          minHeight: '44px',
        }}
      >
        Í≤Ä??
      </Button>
    </div>
  );
};

