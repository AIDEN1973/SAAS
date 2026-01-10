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
import { registerOpenDropdown, unregisterDropdown } from '../hooks/useDropdownManager';

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
  /**
   * 드롭다운 최소 너비 (px)
   * 지정 시 anchor 너비 대신 옵션 텍스트 기반 동적 너비 계산
   */
  dropdownMinWidth?: number;
  /**
   * 드롭다운 너비를 옵션 텍스트에 맞게 동적으로 계산할지 여부
   * true일 경우 가장 긴 옵션 텍스트 너비를 기준으로 설정
   */
  autoDropdownWidth?: boolean;
  /**
   * 드롭다운 정렬 방식
   * - 'start': 버튼 왼쪽 정렬 (기본값)
   * - 'center': 버튼 가로 중앙 정렬
   * - 'end': 버튼 오른쪽 정렬
   */
  dropdownAlign?: 'start' | 'center' | 'end';
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
  dropdownMinWidth,
  autoDropdownWidth = false,
  dropdownAlign = 'start',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          const value = child.props.value;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          const label = child.props.children?.toString() || child.props.value?.toString() || '';
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          const disabled = child.props.disabled;
          opts.push({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            value,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            label,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            disabled,
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
      paddingTop: 'calc(var(--spacing-xs) + var(--spacing-xs) / 2)', // Button 컴포넌트와 동일한 높이 유지
      paddingBottom: 'calc(var(--spacing-xs) + var(--spacing-xs) / 2)', // Button 컴포넌트와 동일한 높이 유지
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const showInlineLabel = showInlineLabelWhenHasValue && hasValue;

  const selectStyle: React.CSSProperties = {
    ...sizeStyles[size],
    border: 'none',
    borderRadius: 'var(--border-radius-xs)',
    backgroundColor: disabled ? 'var(--color-form-disabled-bg)' : 'var(--color-white)',
    color: disabled ? 'var(--color-form-disabled-text)' : 'var(--color-text)',
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    transition: 'var(--transition-all)',
    fontFamily: 'var(--font-family)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 'var(--font-weight-normal)',
    lineHeight: 'var(--line-height)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
  };

  // 래퍼 스타일: select를 감싸고 사방 테두리 적용 (카드 스타일과 동일)
  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: fullWidth ? '100%' : 'auto',
    backgroundColor: disabled ? 'var(--color-form-disabled-bg)' : 'var(--color-white)',
    border: isOpen
      ? (error ? 'var(--border-width-thin) solid var(--color-form-error)' : 'var(--border-width-thin) solid var(--color-primary)')
      : (error ? 'var(--border-width-thin) solid var(--color-form-error)' : 'var(--border-width-thin) solid var(--color-gray-200)'),
    borderRadius: 'var(--border-radius-xs)',
    boxSizing: 'border-box',
    transition: 'var(--transition-all)',
  };

  const handleToggle = useCallback((e?: React.MouseEvent) => {
    if (disabled) return;
    if (e) {
      e.stopPropagation();
    }
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setFocusedIndex(-1);
    }
    // 클릭 시 래퍼에 포커스 스타일 적용
    if (anchorRef.current?.parentElement) {
      anchorRef.current.parentElement.style.borderColor = error ? 'var(--color-form-error)' : 'var(--color-primary)';
    }
  }, [disabled, isOpen, error]);

  const handleSelect = useCallback((optionValue: string | number, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault(); // 기본 동작 방지
      e.stopPropagation(); // 이벤트 전파 방지 (상위 요소의 클릭 이벤트 트리거 방지)
    }
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const valueStr = String(optionValue);
      const newValues = currentValues.includes(valueStr)
        ? currentValues.filter((v) => v !== valueStr)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        : [...currentValues, valueStr];
      onChange?.(newValues);
    } else {
      // 단일 선택: 값 변경 후 드롭다운 닫기
      onChange?.(String(optionValue));
      // requestAnimationFrame을 사용하여 onChange가 완료된 후 드롭다운 닫기
      requestAnimationFrame(() => {
        setIsOpen(false);
      });
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
    onFocus?.(e as unknown as React.FocusEvent<HTMLSelectElement>);
  }, [onFocus]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    onBlur?.(e as unknown as React.FocusEvent<HTMLSelectElement>);
  }, [onBlur]);

  // 라벨을 플레이스홀더로 사용 (label이 명시적으로 빈 문자열이면 빈 문자열 사용)
  const placeholder = label !== undefined ? label : '선택하세요';


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

  // 드롭다운 닫기 콜백 (전역 매니저용)
  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  // 드롭다운 열릴 때 전역 매니저에 등록, 닫힐 때 해제
  useEffect(() => {
    if (isOpen) {
      registerOpenDropdown(closeDropdown);
    } else {
      unregisterDropdown(closeDropdown);
    }
    return () => {
      unregisterDropdown(closeDropdown);
    };
  }, [isOpen, closeDropdown]);

  // 드롭다운 닫을 때 래퍼 테두리 색상 복원
  useEffect(() => {
    if (anchorRef.current?.parentElement && !isOpen) {
      anchorRef.current.parentElement.style.borderColor = error ? 'var(--color-form-error)' : 'var(--color-gray-200)';
    }
  }, [error, isOpen]);

  // 포커스된 옵션으로 스크롤
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const element = listRef.current.children[focusedIndex] as HTMLElement;
      element?.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, focusedIndex]);

  // 드롭다운 메뉴 너비를 셀렉트 박스 너비에 맞추기 (또는 옵션 텍스트 기반 동적 계산)
  useEffect(() => {
    if (isOpen && anchorRef.current) {
      // autoDropdownWidth가 true이거나 dropdownMinWidth가 지정된 경우 옵션 텍스트 기반 동적 계산
      if (autoDropdownWidth || dropdownMinWidth) {
        // 임시 요소를 생성하여 텍스트 너비 측정
        const tempElement = document.createElement('span');
        tempElement.style.visibility = 'hidden';
        tempElement.style.position = 'absolute';
        tempElement.style.whiteSpace = 'nowrap';
        tempElement.style.pointerEvents = 'none';
        tempElement.style.top = '-9999px';
        tempElement.style.left = '-9999px';
        // CSS 변수를 computed style로 변환하여 실제 값 적용
        const computedFontSize = getComputedStyle(document.documentElement).getPropertyValue('--font-size-base').trim() || '16px';
        const computedFontWeight = getComputedStyle(document.documentElement).getPropertyValue('--font-weight-normal').trim() || '400';
        const computedFontFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-family').trim() || 'sans-serif';
        tempElement.style.fontSize = computedFontSize;
        tempElement.style.fontWeight = computedFontWeight;
        tempElement.style.fontFamily = computedFontFamily;
        document.body.appendChild(tempElement);

        let maxWidth = 0;
        options.forEach((option) => {
          tempElement.textContent = option.label;
          // DOM에 추가된 후 강제 리플로우
          void tempElement.offsetWidth;
          const textWidth = tempElement.getBoundingClientRect().width;
          maxWidth = Math.max(maxWidth, textWidth);
        });

        document.body.removeChild(tempElement);

        // CSS 변수에서 패딩 값 읽기
        const getCSSVariableAsPx = (varName: string, defaultValue: number): number => {
          if (typeof window === 'undefined') return defaultValue;
          const cssValue = getComputedStyle(document.documentElement)
            .getPropertyValue(varName)
            .trim();
          if (!cssValue) return defaultValue;
          if (cssValue.endsWith('rem')) {
            const remValue = parseFloat(cssValue);
            const baseFontSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size-base').trim()) || 16;
            return remValue * baseFontSize;
          }
          if (cssValue.endsWith('px')) {
            return parseFloat(cssValue);
          }
          return defaultValue;
        };

        const baseFontSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size-base').trim()) || 16;
        const spacingMd = getCSSVariableAsPx('--spacing-md', baseFontSize);
        const spacingLg = getCSSVariableAsPx('--spacing-lg', baseFontSize * 1.5);
        const spacingXs = getCSSVariableAsPx('--spacing-xs', baseFontSize * 0.25);

        // 패딩과 여백을 고려한 최종 너비 계산 (좌측 md + 우측 lg)
        const optionHorizontalPadding = spacingMd + spacingLg; // 옵션 좌우 패딩
        const dropdownHorizontalPadding = spacingXs * 2; // 드롭다운 메뉴 좌우 패딩
        const totalPadding = optionHorizontalPadding + dropdownHorizontalPadding;
        const contentWidth = maxWidth + totalPadding + spacingMd; // 여유 공간

        // 최소 너비와 비교하여 최종 너비 결정
        const minWidth = dropdownMinWidth || 120; // 기본 최소 너비 120px
        const calculatedWidth = Math.max(contentWidth, minWidth);

        setDropdownWidth(calculatedWidth);
      } else {
        // 기본 동작: anchor 너비에 맞추기
        const anchorWidth = anchorRef.current.getBoundingClientRect().width;
        setDropdownWidth(anchorWidth);
      }
    } else {
      setDropdownWidth(undefined);
    }
  }, [isOpen, autoDropdownWidth, dropdownMinWidth, options]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      <div style={wrapperStyle}>
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
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: (multiple ? selectedLabels.length > 0 : selectedLabels.length > 0) ? 'var(--color-text)' : 'var(--color-text-tertiary)',
              fontWeight: 'var(--font-weight-normal)',
              marginRight: 'var(--spacing-xs)', // 텍스트와 화살표 아이콘 사이 간격
            }}
          >
            {displayText}
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
              placement={dropdownAlign === 'center' ? 'bottom' : dropdownAlign === 'end' ? 'bottom-end' : 'bottom-start'}
              style={dropdownWidth ? { width: `${dropdownWidth}px`, minWidth: `${dropdownWidth}px` } : undefined}
            >
              <div
                ref={listRef}
                role="listbox"
              style={{
                padding: 'var(--spacing-xs)',
                width: '100%', // 부모(Popover) 너비에 맞춤
                boxSizing: 'border-box',
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
                        paddingTop: 'var(--spacing-sm)',
                        paddingBottom: 'var(--spacing-sm)',
                        paddingLeft: 'var(--spacing-md)',
                        paddingRight: 'var(--spacing-lg)', // 우측 여백 증가
                        borderRadius: 'var(--border-radius-sm)',
                        cursor: option.disabled ? 'not-allowed' : 'pointer',
                        backgroundColor: isSelected
                          ? 'var(--color-primary-selected)'
                          : isFocused
                          ? 'var(--color-primary-hover)'
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
                        whiteSpace: 'nowrap', // 텍스트 줄바꿈 방지
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
            fontSize: 'var(--font-size-xxs)', // 11px - 에러 메시지
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
