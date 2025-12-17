/**
 * BadgeSelect Component
 *
 * 배지 스타일을 적용한 Select 컴포넌트
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React, { useRef, useEffect } from 'react';
import { Select, type SelectOption } from '@ui-core/react';

export interface BadgeSelectProps {
  value: string | number;
  onChange: (value: string | string[]) => void;
  options: SelectOption[];
  selectedColor?: string; // 선택된 상태의 배경색 (기본값: primary-dark)
  unselectedColor?: string; // 선택되지 않은 상태의 배경색 (기본값: text)
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  className?: string;
}

/**
 * BadgeSelect 컴포넌트
 *
 * 배지 스타일을 적용한 Select 드롭다운
 */
export const BadgeSelect: React.FC<BadgeSelectProps> = ({
  value,
  onChange,
  options,
  selectedColor = 'var(--color-primary-dark)',
  unselectedColor = 'var(--color-text)',
  size = 'sm',
  fullWidth = false,
  className,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLDivElement>(null);

  // Select 컴포넌트에 배지 스타일 적용
  useEffect(() => {
    if (selectRef.current) {
      const selectElement = selectRef.current.querySelector('[role="combobox"]') as HTMLElement;
      const textSpan = selectRef.current.querySelector('span') as HTMLElement;
      const arrowContainer = selectRef.current.querySelector('[role="combobox"] > div') as HTMLElement;
      const arrowSvg = selectRef.current.querySelector('svg') as SVGSVGElement;

      if (selectElement) {
        selectElement.style.backgroundColor = 'transparent';
        selectElement.style.borderBottom = 'none'; // CSS 키워드 사용
        selectElement.style.borderRadius = 'var(--border-radius-lg)'; // styles.css 준수: border-radius 토큰 사용
        selectElement.style.boxShadow = 'none'; // CSS 키워드 사용
        // padding은 유지하여 텍스트와 화살표가 겹치지 않도록 함
        // size에 따라 적절한 padding 적용
        if (size === 'xs' || size === 'sm') {
          selectElement.style.paddingTop = 'var(--spacing-xs)';
          selectElement.style.paddingBottom = 'var(--spacing-xs)';
          selectElement.style.paddingLeft = 'var(--spacing-xs)';
          selectElement.style.paddingRight = 'var(--spacing-form-horizontal-right)'; // 화살표 공간 확보
        } else {
          selectElement.style.paddingTop = 'var(--spacing-sm)';
          selectElement.style.paddingBottom = 'var(--spacing-sm)';
          selectElement.style.paddingLeft = 'var(--spacing-xs)';
          selectElement.style.paddingRight = 'var(--spacing-form-horizontal-right)'; // 화살표 공간 확보
        }
      }

      if (textSpan) {
        textSpan.style.color = 'var(--color-white)';
        textSpan.style.fontSize = 'var(--font-size-sm)';
        textSpan.style.fontWeight = 'var(--font-weight-medium)';
        // 텍스트가 화살표와 겹치지 않도록 flex: 1 유지
        textSpan.style.flex = '1';
        textSpan.style.minWidth = '0'; // ellipsis 작동을 위해
      }

      if (arrowContainer) {
        // 화살표 컨테이너 위치 조정
        arrowContainer.style.right = 'var(--spacing-xs)';
      }

      if (arrowSvg) {
        arrowSvg.style.color = 'var(--color-white)';
      }
    }
  }, [value, size]);

  // 드롭다운 열림 상태 감지하여 너비 조정
  useEffect(() => {
    if (!wrapperRef.current) return;

      const adjustDropdownWidth = () => {
        if (!wrapperRef.current) return;

        const wrapperWidth = wrapperRef.current.getBoundingClientRect().width;

        // CSS 변수에서 패딩 값 읽기
        const getCSSVariableAsPx = (varName: string, defaultValue: number): number => {
          if (typeof window === 'undefined') return defaultValue;
          const value = getComputedStyle(document.documentElement)
            .getPropertyValue(varName)
            .trim();
          if (!value) return defaultValue;
          // rem 단위를 px로 변환 (기본값 16px = 1rem)
          if (value.endsWith('rem')) {
            const remValue = parseFloat(value);
            return remValue * 16;
          }
          // px 단위인 경우
          if (value.endsWith('px')) {
            return parseFloat(value);
          }
          return defaultValue;
        };

        const spacingMd = getCSSVariableAsPx('--spacing-md', 16); // 기본값 16px
        const spacingXs = getCSSVariableAsPx('--spacing-xs', 4); // 기본값 4px

        // 임시 요소를 생성하여 텍스트 너비 측정
        const tempElement = document.createElement('span');
        tempElement.style.visibility = 'hidden';
        tempElement.style.position = 'absolute';
        tempElement.style.whiteSpace = 'nowrap';
        tempElement.style.fontSize = 'var(--font-size-base)';
        tempElement.style.fontWeight = 'var(--font-weight-normal)';
        tempElement.style.fontFamily = 'var(--font-family)';
        document.body.appendChild(tempElement);

        let maxWidth = 0;
        options.forEach((option) => {
          tempElement.textContent = option.label;
          const textWidth = tempElement.getBoundingClientRect().width;
          maxWidth = Math.max(maxWidth, textWidth);
        });

        document.body.removeChild(tempElement);

        // 패딩과 여백을 고려한 최종 너비 계산
        // 옵션의 좌우 패딩: var(--spacing-md) * 2 (Select 컴포넌트의 옵션 스타일 참고)
        // 드롭다운 메뉴의 좌우 패딩: var(--spacing-xs) * 2 (listbox의 padding)
        const optionHorizontalPadding = spacingMd * 2; // 옵션 좌우 패딩 (var(--spacing-md) * 2)
        const dropdownHorizontalPadding = spacingXs * 2; // 드롭다운 메뉴 좌우 패딩 (var(--spacing-xs) * 2)
        const totalPadding = optionHorizontalPadding + dropdownHorizontalPadding;

        // wrapper 너비와 옵션 텍스트 너비 + 패딩 중 더 큰 값 사용
        // 최소 너비를 보장하기 위해 추가 여유 공간 추가 (20px)
        const calculatedWidth = Math.max(wrapperWidth, maxWidth + totalPadding + 20);

        // Popover와 listbox를 찾아서 너비 조정 및 위치 조정
        const popover = document.querySelector('[role="listbox"]')?.closest('[style*="position: fixed"]') as HTMLElement;
        const listbox = document.querySelector('[role="listbox"]') as HTMLElement;

        if (popover && calculatedWidth > 0 && wrapperRef.current) {
          popover.style.width = `${calculatedWidth}px`;
          popover.style.minWidth = `${calculatedWidth}px`;
          popover.style.maxWidth = `${calculatedWidth}px`; // 최대 너비도 설정하여 줄바꿈 방지

          // 드롭다운 레이어 위치를 왼쪽으로 조정 (wrapper 위치 기준)
          const wrapperRect = wrapperRef.current.getBoundingClientRect();
          const popoverRect = popover.getBoundingClientRect();
          const leftOffset = getCSSVariableAsPx('--spacing-xs', 4); // CSS 변수에서 spacing-xs 값 읽기 (기본값 4px)
          const minMargin = getCSSVariableAsPx('--spacing-sm', 8); // 최소 여백 (기본값 8px)

          // wrapper의 left 위치를 기준으로 왼쪽으로 이동
          let newLeft = wrapperRect.left - leftOffset;

          // 화면 경계 체크: 최소 여백 보장
          if (newLeft < minMargin) {
            newLeft = minMargin;
          }

          // 화면 오른쪽 경계 체크
          const viewportWidth = window.innerWidth;
          if (newLeft + calculatedWidth > viewportWidth - minMargin) {
            newLeft = viewportWidth - calculatedWidth - minMargin;
          }

          popover.style.left = `${newLeft}px`;
        }

        // listbox 내부 옵션들에 whiteSpace: nowrap 적용
        if (listbox) {
          const optionElements = listbox.querySelectorAll('[role="option"]');
          optionElements.forEach((optionEl) => {
            const span = optionEl.querySelector('span');
            if (span) {
              span.style.whiteSpace = 'nowrap';
              span.style.overflow = 'hidden';
              span.style.textOverflow = 'ellipsis';
            }
          });
        }
      };

    // MutationObserver로 드롭다운 메뉴가 DOM에 추가될 때 감지
    let timeoutId: NodeJS.Timeout | null = null;
    const observer = new MutationObserver(() => {
      const listbox = document.querySelector('[role="listbox"]');
      if (listbox) {
        // 기존 timeout 취소
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        // 드롭다운이 열렸을 때 너비 조정 (약간의 지연을 두어 DOM이 완전히 렌더링된 후 실행)
        timeoutId = setTimeout(() => {
          requestAnimationFrame(() => {
            adjustDropdownWidth();
            // 추가로 한 번 더 실행하여 확실하게 적용
            setTimeout(() => {
              adjustDropdownWidth();
            }, 50);
          });
        }, 10);
      }
    });

    // document.body를 관찰하여 드롭다운 메뉴 추가 감지
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 클릭 이벤트로도 너비 조정 (즉시 반응)
    const handleClick = () => {
      setTimeout(() => {
        requestAnimationFrame(() => {
          adjustDropdownWidth();
        });
      }, 0);
    };

    if (selectRef.current) {
      selectRef.current.addEventListener('click', handleClick);
    }

    return () => {
      observer.disconnect();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (selectRef.current) {
        selectRef.current.removeEventListener('click', handleClick);
      }
    };
  }, [options]);

  // 선택된 값이 있는지 확인하여 배경색 결정
  const hasValue = value !== undefined && value !== null && value !== '';
  const backgroundColor = hasValue ? selectedColor : unselectedColor;

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        display: 'inline-flex',
        borderRadius: 'var(--border-radius-lg)',
        backgroundColor,
        overflow: 'visible', // 드롭다운이 보이도록 visible로 변경
        paddingLeft: 'var(--spacing-sm)', // 좌우 여백만 추가
        paddingRight: 'var(--spacing-xs)', // 좌우 여백만 추가
        fontSize: 'var(--font-size-sm)',
        fontWeight: 'var(--font-weight-medium)',
      }}
    >
      <div ref={selectRef} style={{ width: '100%' }}>
        <Select
          value={value}
          onChange={onChange}
          options={options}
          size={size}
          fullWidth={fullWidth}
        />
      </div>
    </div>
  );
};

