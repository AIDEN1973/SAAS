/**
 * Select Component (Custom Dropdown)
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { createPortal } from 'react-dom';
import { Popover } from './Popover';

type SizeToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'children' | 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: SizeToken;
  fullWidth?: boolean;
  children?: React.ReactNode; // 기존 호환성을 위해 유지
  options?: SelectOption[]; // 새로운 옵션 방식
  multiple?: boolean;
  onChange?: (value: string | string[]) => void;
}

/**
 * Select 컴포넌트 (커스텀 드롭다운)
 */
export const Select: React.FC<SelectProps> = ({
  label,
  error,
  helperText,
  size = 'md',
  fullWidth = false,
  className,
  children,
  options: propsOptions,
  multiple = false,
  value,
  onChange,
  onFocus,
  onBlur,
  disabled,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const anchorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // children에서 options 추출 (기존 호환성)
  const optionsFromChildren = React.useMemo(() => {
    if (children) {
      const opts: SelectOption[] = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === 'option') {
          opts.push({
            value: child.props.value,
            label: child.props.children?.toString() || child.props.value?.toString() || '',
            disabled: child.props.disabled,
          });
        }
      });
      return opts;
    }
    return [];
  }, [children]);

  const options = propsOptions || optionsFromChildren;

  const sizeStyles: Record<SizeToken, React.CSSProperties> = {
    xs: {
      padding: 'var(--spacing-xs) var(--spacing-sm)',
    },
    sm: {
      padding: 'var(--spacing-xs) var(--spacing-sm)',
    },
    md: {
      padding: 'var(--spacing-sm) var(--spacing-md)',
    },
    lg: {
      padding: 'var(--spacing-md) var(--spacing-lg)',
    },
    xl: {
      padding: 'var(--spacing-lg) var(--spacing-xl)',
    },
  };

  const selectStyle: React.CSSProperties = {
    ...sizeStyles[size],
    border: `var(--border-width-thin) solid ${error ? 'var(--color-red-500)' : 'var(--color-gray-200)'}`, // styles.css 준수: border-width 토큰 사용
    borderRadius: 'var(--border-radius-sm)',
    backgroundColor: disabled ? 'var(--color-gray-100)' : 'var(--color-white)',
    color: disabled ? 'var(--color-text-tertiary)' : 'var(--color-text)',
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    transition: 'var(--transition-all)', // styles.css 준수: transition 토큰 사용
    fontFamily: 'var(--font-family)',
    fontSize: 'var(--font-size-base)', // Input과 동일한 폰트 사이즈 (일관성)
    lineHeight: 'var(--line-height)', // Input과 동일한 line-height (일관성)
    boxShadow: isOpen ? 'var(--shadow-md)' : 'var(--shadow-sm)',
    paddingRight: 'var(--spacing-xl)', // 화살표 공간 확보
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box', // Input과 동일한 box-sizing (일관성)
    // 높이는 fontSize * lineHeight + padding-top + padding-bottom + border로 자동 계산됨 (Input과 동일)
  };

  const handleToggle = useCallback(() => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setFocusedIndex(-1);
    }
  }, [disabled, isOpen]);

  const handleSelect = useCallback((optionValue: string | number) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const valueStr = String(optionValue);
      const newValues = currentValues.includes(valueStr)
        ? currentValues.filter((v) => v !== valueStr)
        : [...currentValues, valueStr];
      onChange?.(newValues);
    } else {
      onChange?.(String(optionValue));
      setIsOpen(false);
    }
  }, [multiple, value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen && focusedIndex >= 0 && options[focusedIndex]) {
          handleSelect(options[focusedIndex].value);
        } else {
          handleToggle();
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex((prev) => {
            const next = prev < options.length - 1 ? prev + 1 : 0;
            if (listRef.current && options[next]) {
              const element = listRef.current.children[next] as HTMLElement;
              element?.scrollIntoView({ block: 'nearest' });
            }
            return next;
          });
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setFocusedIndex((prev) => {
            const next = prev > 0 ? prev - 1 : options.length - 1;
            if (listRef.current && options[next]) {
              const element = listRef.current.children[next] as HTMLElement;
              element?.scrollIntoView({ block: 'nearest' });
            }
            return next;
          });
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        anchorRef.current?.focus();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  }, [disabled, isOpen, focusedIndex, options, handleSelect, handleToggle]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = error ? 'var(--color-red-500)' : 'var(--color-primary)';
    // styles.css 준수: focus-ring-width 토큰 사용 (2px)
    e.currentTarget.style.boxShadow = `0 0 0 var(--focus-ring-width) ${error ? 'var(--color-red-50)' : 'var(--color-primary-50)'}`;
    onFocus?.(e as unknown as React.FocusEvent<HTMLSelectElement>);
  }, [error, onFocus]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = error ? 'var(--color-red-500)' : 'var(--color-gray-200)';
    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
    onBlur?.(e as unknown as React.FocusEvent<HTMLSelectElement>);
  }, [error, onBlur]);

  // 선택된 값의 라벨 찾기
  const selectedLabels = React.useMemo(() => {
    if (multiple && Array.isArray(value)) {
      return options
        .filter((opt) => value.includes(String(opt.value)))
        .map((opt) => opt.label);
    } else if (value !== undefined && value !== null && value !== '') {
      const option = options.find((opt) => String(opt.value) === String(value));
      return option ? [option.label] : [];
    }
    return [];
  }, [options, value, multiple]);

  const displayText = multiple
    ? selectedLabels.length > 0
      ? `${selectedLabels.length}개 선택됨`
      : '선택하세요'
    : selectedLabels[0] || '선택하세요';

  // 포커스된 옵션으로 스크롤
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const element = listRef.current.children[focusedIndex] as HTMLElement;
      element?.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, focusedIndex]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      {label && (
        <label
          style={{
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text)',
            marginBottom: 'var(--spacing-xs)',
          }}
        >
          {label}
        </label>
      )}
      <div
        style={{
          position: 'relative',
          width: fullWidth ? '100%' : 'auto',
        }}
      >
        <div
          ref={anchorRef}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
        className={clsx(className)}
        style={selectStyle}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        >
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
      >
            {displayText}
          </span>
        <div
          style={{
            position: 'absolute',
            right: 'var(--spacing-sm)',
            top: '50%',
              transform: `translateY(-50%) ${isOpen ? 'rotate(180deg)' : ''}`, // translateY만 사용 (transform-center는 translate(-50%, -50%)이므로 부적합)
              transition: 'transform var(--transition-base)', // styles.css 준수: transition 토큰 사용
            pointerEvents: 'none',
            width: 0,
            height: 0,
              borderLeft: `var(--border-width-thick) solid transparent`,
              borderRight: `var(--border-width-thick) solid transparent`,
              borderTop: `var(--border-width-thick) solid ${error ? 'var(--color-red-500)' : 'var(--color-gray-500)'}`, // 화살표 높이는 border-width-thick 사용
            }}
          />
        </div>

        {isOpen &&
          anchorRef.current &&
          createPortal(
            <Popover
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              anchorEl={anchorRef.current}
              placement="bottom-start"
            >
              <div
                ref={listRef}
                role="listbox"
              style={{
                maxHeight: 'var(--height-chart)', // styles.css 준수: 차트 높이 토큰 사용
                overflowY: 'auto',
                padding: 'var(--spacing-xs)',
              }}
              >
                {options.map((option, index) => {
                  const isSelected = multiple
                    ? Array.isArray(value) && value.includes(String(option.value))
                    : String(value) === String(option.value);
                  const isFocused = index === focusedIndex;

                  return (
                    <div
                      key={option.value}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => !option.disabled && handleSelect(option.value)}
                      style={{
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        borderRadius: 'var(--border-radius-sm)',
                        cursor: option.disabled ? 'not-allowed' : 'pointer',
                        backgroundColor: isFocused
                          ? 'var(--color-primary-50)'
                          : isSelected
                          ? 'var(--color-primary-100)'
                          : 'transparent',
                        color: option.disabled
                          ? 'var(--color-text-tertiary)'
                          : isSelected
                          ? 'var(--color-primary-dark)'
                          : 'var(--color-text)',
                        fontWeight: isSelected ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
                        fontSize: 'var(--font-size-base)', // styles.css 준수: 기본 폰트 사이즈
                        transition: 'var(--transition-fast)', // styles.css 준수: transition 토큰 사용
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                      }}
                      onMouseEnter={() => setFocusedIndex(index)}
                      onMouseLeave={() => setFocusedIndex(-1)}
                    >
                      {multiple && (
                        <div
                          style={{
                            width: 'var(--spacing-md)', // styles.css 준수: 16px
                            height: 'var(--spacing-md)', // styles.css 준수: 16px
                            border: `var(--border-width-base) solid ${isSelected ? 'var(--color-primary)' : 'var(--color-gray-300)'}`,
                            borderRadius: 'var(--border-radius-sm)',
                            backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isSelected && (
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 10 10"
                              fill="none"
                              style={{ color: 'var(--color-white)' }}
                            >
                              <path
                                d="M8 2.5L3.5 7L2 5.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                      )}
                      <span>{option.label}</span>
                    </div>
                  );
                })}
                {options.length === 0 && (
                  <div
                    style={{
                      padding: 'var(--spacing-md)',
                      textAlign: 'center',
                      color: 'var(--color-text-secondary)',
          }}
                  >
                    옵션이 없습니다
                  </div>
                )}
              </div>
            </Popover>,
            document.body
          )}
      </div>
      {error && (
        <span
          style={{
            color: 'var(--color-red-500)',
            marginTop: 'var(--spacing-xs)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {error}
        </span>
      )}
      {helperText && !error && (
        <span
          style={{
            color: 'var(--color-text-secondary)',
            marginTop: 'var(--spacing-xs)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
};
