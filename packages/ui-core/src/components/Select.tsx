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
  /**
   * 값이 있을 때 좌측에 인라인 라벨(항목명)을 표시할지 여부
   * - 수정폼(편집 모드): true
   * - 필터/검색 UI: false
   */
  showInlineLabelWhenHasValue?: boolean;
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
  showInlineLabelWhenHasValue = true,
  onFocus,
  onBlur,
  disabled,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [dropdownWidth, setDropdownWidth] = useState<number | undefined>(undefined);
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
      paddingTop: 'var(--spacing-xs)',
      paddingBottom: 'var(--spacing-xs)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용 (화살표 공간 포함)
    },
    sm: {
      paddingTop: 'var(--spacing-xs)',
      paddingBottom: 'var(--spacing-xs)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용 (화살표 공간 포함)
    },
    md: {
      paddingTop: 'var(--spacing-sm)',
      paddingBottom: 'var(--spacing-sm)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용 (화살표 공간 포함)
    },
    lg: {
      paddingTop: 'var(--spacing-md)',
      paddingBottom: 'var(--spacing-md)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용 (화살표 공간 포함)
    },
    xl: {
      paddingTop: 'var(--spacing-lg)',
      paddingBottom: 'var(--spacing-lg)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용 (화살표 공간 포함)
    },
  };

  // 선택된 값이 있는지 확인 (스타일용)
  const selectedLabelsForStyle = React.useMemo(() => {
    if (multiple && Array.isArray(value)) {
      return options
        .filter((opt) => value.includes(String(opt.value)))
        .map((opt) => opt.label);
    } else if (!multiple && value !== undefined && value !== null && value !== '') {
      const option = options.find((opt) => String(opt.value) === String(value));
      return option ? [option.label] : [];
    }
    return [];
  }, [value, options, multiple]);

  const hasValue = selectedLabelsForStyle.length > 0;
  const showInlineLabel = showInlineLabelWhenHasValue && hasValue;

  const selectStyle: React.CSSProperties = {
    ...sizeStyles[size],
    border: 'none',
    borderBottom: `var(--border-width-form-bottom) solid transparent`, // styles.css 토큰: 레이아웃 유지를 위해 항상 2px, 색상은 투명
    borderRadius: 0,
    backgroundColor: disabled ? 'var(--color-form-disabled-bg)' : 'var(--color-white)', // styles.css 토큰: 폼 필드 배경색
    color: disabled ? 'var(--color-form-disabled-text)' : 'var(--color-text)', // styles.css 토큰: 폼 필드 텍스트 색상
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    transition: 'var(--transition-all)', // styles.css 토큰: transition
    fontFamily: 'var(--font-family)', // styles.css 토큰: 폰트 패밀리
    fontSize: 'var(--font-size-base)', // styles.css 토큰: 폼 필드 폰트 사이즈
    fontWeight: 'var(--font-weight-normal)', // styles.css 토큰: 폼 필드 폰트 웨이트
    lineHeight: 'var(--line-height)', // styles.css 토큰: 폼 필드 라인 높이
    // 요구사항: 수정모드(값이 있는 상태)에서도 기본(비포커스) 밑줄은 1px로 유지
    // 오픈/포커스 상태에서만 2px로 변경
    boxShadow: isOpen
      ? (error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)')
      : (error ? 'var(--shadow-form-bottom-default-error)' : 'var(--shadow-form-bottom-default)'),
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box', // styles.css 토큰: 폼 필드 box-sizing
    // 높이는 fontSize * lineHeight + padding-top + padding-bottom + border로 자동 계산됨
  };

  const handleToggle = useCallback((e?: React.MouseEvent) => {
    if (disabled) return;
    if (e) {
      e.stopPropagation(); // 이벤트 전파 방지 (상위 요소의 클릭 이벤트 트리거 방지)
    }
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setFocusedIndex(-1);
    }
    // 클릭 시 포커스 스타일 적용 (styles.css 토큰 사용)
    if (anchorRef.current) {
      anchorRef.current.style.borderBottomColor = 'transparent'; // styles.css 토큰: 항상 transparent 유지 (레이아웃 고정)
      anchorRef.current.style.boxShadow = error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)'; // styles.css 토큰: 포커스 시 시각적 2px 테두리
    }
  }, [disabled, isOpen, error]);

  const handleSelect = useCallback((optionValue: string | number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // 이벤트 전파 방지 (상위 요소의 클릭 이벤트 트리거 방지)
    }
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
    e.currentTarget.style.borderBottomColor = 'transparent'; // styles.css 토큰: 항상 transparent 유지 (레이아웃 고정)
    e.currentTarget.style.boxShadow = error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)'; // styles.css 토큰: 포커스 시 항상 시각적 2px 테두리
    onFocus?.(e as unknown as React.FocusEvent<HTMLSelectElement>);
  }, [error, onFocus]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderBottomColor = 'transparent'; // styles.css 토큰: 투명으로 변경
    // 요구사항: blur 시에는 값 유무와 관계없이 1px로 복원
    e.currentTarget.style.boxShadow = error
      ? 'var(--shadow-form-bottom-default-error)'
      : 'var(--shadow-form-bottom-default)';
    onBlur?.(e as unknown as React.FocusEvent<HTMLSelectElement>);
  }, [error, onBlur]);

  // 라벨을 플레이스홀더로 사용
  const placeholder = label || '선택하세요';

  // 플레이스홀더에서 키워드를 볼드 처리하는 함수
  const renderPlaceholderWithBold = React.useCallback((text: string) => {
    const keywords = ['이름', '학년', '클래스', '재원상태'];
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    keywords.forEach((keyword) => {
      const index = text.indexOf(keyword, lastIndex);
      if (index !== -1) {
        // 키워드 이전 텍스트 추가
        if (index > lastIndex) {
          parts.push(text.substring(lastIndex, index));
        }
        // 키워드를 볼드 처리
        parts.push(
          <strong key={`${keyword}-${index}`} style={{ fontWeight: 'var(--font-weight-extrabold)' }}>
            {keyword}
          </strong>
        );
        lastIndex = index + keyword.length;
      }
    });

    // 남은 텍스트 추가
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  }, []);

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
      : placeholder
    : selectedLabels[0] || placeholder;

  // 값 변경 시 스타일 업데이트 (값이 있으면 2px, 없으면 1px)
  useEffect(() => {
    if (anchorRef.current && !isOpen) {
      anchorRef.current.style.borderBottomColor = 'transparent';
      // 요구사항: 닫힌 상태에서는 값 유무와 관계없이 1px
      anchorRef.current.style.boxShadow = error
        ? 'var(--shadow-form-bottom-default-error)'
        : 'var(--shadow-form-bottom-default)';
    }
  }, [error, isOpen]);

  // 포커스된 옵션으로 스크롤
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const element = listRef.current.children[focusedIndex] as HTMLElement;
      element?.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, focusedIndex]);

  // 드롭다운 메뉴 너비를 셀렉트 박스 너비에 맞추기
  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const anchorWidth = anchorRef.current.getBoundingClientRect().width;
      setDropdownWidth(anchorWidth);
    } else {
      setDropdownWidth(undefined);
    }
  }, [isOpen]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
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
          onClick={(e) => handleToggle(e)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        >
          {/* 수정모드(값이 있을 때): 좌측에 인라인 라벨(항목명) 표시 */}
          {showInlineLabel && label && (
            <span
              style={{
                color: 'var(--color-form-inline-label)',
                marginRight: 'var(--spacing-form-inline-label-gap)',
                whiteSpace: 'nowrap',
                fontSize: 'var(--font-size-base)',
                fontFamily: 'var(--font-family)',
                fontWeight: 'var(--font-weight-normal)',
                lineHeight: 'var(--line-height)',
                flexShrink: 0,
                minWidth: 'var(--width-form-inline-label)', // 고정 너비로 결과값 세로 정렬
              }}
            >
              {label}
            </span>
          )}
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: (multiple ? selectedLabels.length > 0 : selectedLabels.length > 0) ? 'var(--color-text)' : 'var(--color-text-tertiary)',
              fontWeight: 'var(--font-weight-normal)', // styles.css 준수: 폰트 웨이트 토큰 사용
            }}
          >
            {(multiple ? selectedLabels.length > 0 : selectedLabels.length > 0) ? displayText : renderPlaceholderWithBold(displayText)}
          </span>
        <div
          style={{
            position: 'absolute',
            right: 'var(--spacing-sm)',
            top: '50%',
            transform: `translateY(-50%) ${isOpen ? 'rotate(180deg)' : ''}`,
            transition: 'transform var(--transition-base)', // styles.css 준수: transition 토큰 사용
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 'var(--spacing-md)', // 16px
            height: 'var(--spacing-md)', // 16px
          }}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              width: 'var(--size-icon-base)',
              height: 'var(--size-icon-base)',
              color: error ? 'var(--color-form-border-error)' : 'var(--color-text-tertiary)', // styles.css 토큰: 드롭다운 화살표 색상
              transition: 'color var(--transition-base), filter var(--transition-base)',
              filter: isOpen ? `drop-shadow(var(--shadow-icon))` : 'none',
            }}
          >
            <path
              d="M4.5 6.5L8 10L11.5 6.5"
              stroke="currentColor"
              strokeWidth="var(--stroke-width-icon)"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
        </div>

        {isOpen &&
          anchorRef.current &&
          createPortal(
            <Popover
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              anchorEl={anchorRef.current}
              placement="bottom-start"
              style={dropdownWidth ? { width: `${dropdownWidth}px`, minWidth: `${dropdownWidth}px` } : undefined}
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
                      onClick={(e) => !option.disabled && handleSelect(option.value, e)}
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
                          : 'var(--color-text)', // 기본 텍스트 색상 사용
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
                              viewBox="0 0 10 10"
                              fill="none"
                              style={{
                                width: 'var(--size-icon-sm)',
                                height: 'var(--size-icon-sm)',
                                color: 'var(--color-white)'
                              }}
                            >
                              <path
                                d="M8 2.5L3.5 7L2 5.5"
                                stroke="currentColor"
                                strokeWidth="var(--stroke-width-icon)"
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
            color: 'var(--color-form-error)', // styles.css 토큰: 폼 필드 에러 메시지 색상
            marginTop: 'var(--spacing-xs)',
            // 요구사항: 에러 메시지를 2pt 작게 표시 (공통 컴포넌트 기준)
            fontSize: 'calc(var(--font-size-sm) - 2px)',
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
