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
        selectElement.style.border = 'none'; // 모든 테두리 제거
        selectElement.style.borderBottom = 'none'; // 하단 테두리 제거
        selectElement.style.borderRadius = 'var(--border-radius-xs)'; // styles.css 준수: border-radius 토큰 사용 (Button과 동일)
        selectElement.style.boxShadow = 'none !important'; // 하단 테두리 효과 제거 (중요도 높임)
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

  // Select 컴포넌트의 스타일이 재적용되는 것을 방지하기 위한 MutationObserver
  useEffect(() => {
    if (!selectRef.current) return;

    const selectElement = selectRef.current.querySelector('[role="combobox"]') as HTMLElement;
    if (!selectElement) return;

    // 스타일을 지속적으로 제거하는 함수
    const removeBottomBorder = () => {
      if (selectElement) {
        selectElement.style.setProperty('border', 'none', 'important');
        selectElement.style.setProperty('border-bottom', 'none', 'important');
        selectElement.style.setProperty('box-shadow', 'none', 'important');
      }
    };

    // MutationObserver로 스타일 변경 감지
    const observer = new MutationObserver(() => {
      requestAnimationFrame(removeBottomBorder);
    });

    // 초기 스타일 제거
    removeBottomBorder();

    // 스타일 속성 변경 감지
    observer.observe(selectElement, {
      attributes: true,
      attributeFilter: ['style'],
    });

    // 짧은 간격으로 몇 번 확인 (Select 컴포넌트가 동적으로 스타일을 변경할 수 있음)
    const timeouts: NodeJS.Timeout[] = [];
    for (let i = 0; i < 5; i++) {
      timeouts.push(setTimeout(removeBottomBorder, i * 50));
    }

    return () => {
      observer.disconnect();
      timeouts.forEach(clearTimeout);
    };
  }, [value, size]);

  // 드롭다운 열림 상태 감지하여 너비 조정
  useEffect(() => {
    if (!wrapperRef.current) return;

      const adjustDropdownWidth = () => {
        if (!wrapperRef.current) return;

        // 다른 Select의 드롭다운이 열렸을 때(또는 본 컴포넌트가 닫혀 있을 때)
        // 전역 listbox를 잘못 조작하지 않도록, "내 Select가 열려 있는 경우"에만 동작
        const selectElement = selectRef.current?.querySelector('[role="combobox"]') as HTMLElement | null;
        const isThisSelectOpen = selectElement?.getAttribute('aria-expanded') === 'true';
        if (!isThisSelectOpen) return;

        const wrapperWidth = wrapperRef.current.getBoundingClientRect().width;

        // CSS 변수에서 패딩 값 읽기
        const getCSSVariableAsPx = (varName: string, defaultValue: number): number => {
          if (typeof window === 'undefined') return defaultValue;
          const value = getComputedStyle(document.documentElement)
            .getPropertyValue(varName)
            .trim();
          if (!value) return defaultValue;
          // rem 단위를 px로 변환 (CSS 변수에서 기본 폰트 크기 읽기)
          if (value.endsWith('rem')) {
            const remValue = parseFloat(value);
            // ⚠️ 중요: 하드코딩 금지, CSS 변수에서 기본 폰트 크기 읽기
            const baseFontSize = typeof window !== 'undefined'
              ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size-base').trim()) || 16
              : 16;
            return remValue * baseFontSize;
          }
          // px 단위인 경우
          if (value.endsWith('px')) {
            return parseFloat(value);
          }
          return defaultValue;
        };

        // ⚠️ 중요: 하드코딩 금지, CSS 변수에서 기본 폰트 크기 읽기
        const baseFontSize = typeof window !== 'undefined'
          ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size-base').trim()) || 16
          : 16;
        const spacingMd = getCSSVariableAsPx('--spacing-md', baseFontSize); // 기본값: baseFontSize (16px)
        const spacingXs = getCSSVariableAsPx('--spacing-xs', baseFontSize * 0.25); // 기본값: baseFontSize * 0.25 (4px)

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
        // 최소 너비를 보장하기 위해 추가 여유 공간(= spacing-md)을 더함 (하드코딩 금지)
        const calculatedWidth = Math.max(wrapperWidth, maxWidth + totalPadding + spacingMd);

        // [정합성] 전역 listbox를 조작하지 않고, "내 Select"에 대응하는 listbox만 찾아서 조작
        // - ui-core Select는 포털로 listbox를 렌더링하므로 wrapper 내부에서 직접 찾을 수 없음
        // - 대신 wrapperRect 기준으로 "가장 가까운 listbox"를 선택 (다른 필터/레이어 메뉴와 충돌 방지)
        const wrapperRect = wrapperRef.current.getBoundingClientRect();
        const expectedTop = wrapperRect.bottom + spacingXs;
        const expectedLeft = wrapperRect.left;

        const listboxes = Array.from(document.querySelectorAll('[role="listbox"]')) as HTMLElement[];
        const pickClosestListbox = () => {
          let best: { el: HTMLElement; score: number } | null = null;
          for (const el of listboxes) {
            const r = el.getBoundingClientRect();
            // 너무 멀리 떨어진 listbox는 제외 (다른 Select 가능성)
            const dx = Math.abs(r.left - expectedLeft);
            const dy = Math.abs(r.top - expectedTop);
            const score = dx + dy;
            if (!best || score < best.score) best = { el, score };
          }
          return best?.el || null;
        };

        const listbox = pickClosestListbox();
        const popover = listbox?.closest('[style*="position: fixed"]') as HTMLElement | null;

        if (popover && listbox && calculatedWidth > 0) {
          popover.style.width = `${calculatedWidth}px`;
          popover.style.minWidth = `${calculatedWidth}px`;
          popover.style.maxWidth = `${calculatedWidth}px`; // 최대 너비도 설정하여 줄바꿈 방지

          // 드롭다운 레이어 위치를 wrapper 아래에 배치
          // ⚠️ 중요: 하드코딩 금지, CSS 변수에서 기본 폰트 크기 읽기
          const baseFontSize = typeof window !== 'undefined'
            ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size-base').trim()) || 16
            : 16;
          const minMargin = getCSSVariableAsPx('--spacing-sm', baseFontSize * 0.5); // 최소 여백 (기본값: baseFontSize * 0.5 = 8px)

          // wrapper의 left 위치를 기준으로 정렬
          let newLeft = wrapperRect.left;

          // 화면 경계 체크: 최소 여백 보장
          if (newLeft < minMargin) {
            newLeft = minMargin;
          }

          // 화면 오른쪽 경계 체크
          const viewportWidth = window.innerWidth;
          if (newLeft + calculatedWidth > viewportWidth - minMargin) {
            newLeft = viewportWidth - calculatedWidth - minMargin;
          }

          // wrapper 아래에 배치 (top 위치 설정)
          const newTop = expectedTop;

          popover.style.left = `${newLeft}px`;
          popover.style.top = `${newTop}px`;
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
      const selectElement = selectRef.current?.querySelector('[role="combobox"]') as HTMLElement | null;
      const isThisSelectOpen = selectElement?.getAttribute('aria-expanded') === 'true';
      if (!isThisSelectOpen) return;
      // DOM 변화는 많으므로, 내 Select가 열려 있을 때만 조정 스케줄
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        requestAnimationFrame(() => {
          adjustDropdownWidth();
          setTimeout(() => {
            adjustDropdownWidth();
          }, 50);
        });
      }, 10);
    });

    // document.body를 관찰하여 드롭다운 메뉴 추가 감지
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 클릭 이벤트로도 너비 조정 (즉시 반응)
    const handleClick = (e: Event) => {
      // BadgeSelect 자신의 요소만 처리 (다른 Select 컴포넌트의 클릭은 무시)
      const target = e.target as HTMLElement;
      if (!selectRef.current || !selectRef.current.contains(target)) {
        return;
      }
      setTimeout(() => {
        requestAnimationFrame(() => {
          adjustDropdownWidth();
        });
      }, 0);
    };

    const selectEl = selectRef.current;
    if (selectEl) {
      selectEl.addEventListener('click', handleClick);
    }

    return () => {
      observer.disconnect();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (selectEl) {
        selectEl.removeEventListener('click', handleClick);
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
        alignItems: 'center',
        borderRadius: 'var(--border-radius-xs)',
        backgroundColor,
        overflow: 'visible', // 드롭다운이 보이도록 visible로 변경
        height: 'var(--size-pagination-button)', // IconButtonGroup과 동일한 높이
        paddingLeft: 'var(--spacing-sm)',
        paddingRight: 'var(--spacing-xs)',
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

