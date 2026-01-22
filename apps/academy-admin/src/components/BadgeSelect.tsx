/**
 * BadgeSelect Component
 *
 * 배지 스타일을 적용한 Select 컴포넌트
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React, { useRef, useEffect, useState } from 'react';
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
  className,
  // fullWidth is defined in props but not yet implemented
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fullWidth = false,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLDivElement>(null);
  const [calculatedWidth, setCalculatedWidth] = useState<number | undefined>(undefined);

  // 옵션 텍스트 기반 너비 계산
  useEffect(() => {
    if (options.length === 0) return;

    // 임시 요소를 생성하여 텍스트 너비 측정
    const tempElement = document.createElement('span');
    tempElement.style.visibility = 'hidden';
    tempElement.style.position = 'absolute';
    tempElement.style.whiteSpace = 'nowrap';
    tempElement.style.pointerEvents = 'none';
    tempElement.style.top = '-9999px';
    tempElement.style.left = '-9999px';
    // BadgeSelect의 폰트 스타일 적용 - computed value로 변환
    const computedFontSize = getComputedStyle(document.documentElement).getPropertyValue('--font-size-sm').trim() || '14px';
    const computedFontWeight = getComputedStyle(document.documentElement).getPropertyValue('--font-weight-medium').trim() || '500';
    const computedFontFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-family').trim() || 'sans-serif';
    tempElement.style.fontSize = computedFontSize;
    tempElement.style.fontWeight = computedFontWeight;
    tempElement.style.fontFamily = computedFontFamily;
    document.body.appendChild(tempElement);

    let maxWidth = 0;
    options.forEach((option) => {
      tempElement.textContent = option.label;
      void tempElement.offsetWidth; // 강제 리플로우
      const textWidth = tempElement.getBoundingClientRect().width;
      maxWidth = Math.max(maxWidth, textWidth);
    });

    document.body.removeChild(tempElement);

    // CSS 변수에서 값 읽기
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
    const spacingXs = getCSSVariableAsPx('--spacing-xs', baseFontSize * 0.25);
    const iconSize = getCSSVariableAsPx('--size-icon-base', 16);

    // 필드 너비 계산: 텍스트 너비 + 좌우 패딩 + 화살표 아이콘 + 여유 공간
    const fieldWidth = maxWidth + spacingMd * 2 + iconSize + spacingXs * 2;

    // 드롭다운 너비 계산: 텍스트 너비 + 옵션 좌우 패딩 + 드롭다운 패딩 + 여유
    const dropdownWidth = maxWidth + spacingMd * 3 + spacingXs * 2;

    setCalculatedWidth(Math.max(fieldWidth, dropdownWidth));
  }, [options]);

  // Select 컴포넌트에 배지 스타일 적용
  useEffect(() => {
    if (selectRef.current) {
      const selectWrapper = selectRef.current.querySelector('[role="combobox"]')?.parentElement as HTMLElement;
      const selectElement = selectRef.current.querySelector('[role="combobox"]') as HTMLElement;
      const textSpan = selectRef.current.querySelector('span') as HTMLElement;
      const arrowContainer = selectRef.current.querySelector('[role="combobox"] > div') as HTMLElement;
      const arrowSvg = selectRef.current.querySelector('svg') as SVGSVGElement;

      // Wrapper도 투명하게 설정 (배지 배경색이 보이도록)
      if (selectWrapper) {
        selectWrapper.style.backgroundColor = 'transparent';
        selectWrapper.style.border = 'none';
      }

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
    const selectWrapper = selectElement?.parentElement as HTMLElement;
    if (!selectElement) return;

    // 스타일을 지속적으로 제거하는 함수
    const enforceTransparentStyle = () => {
      if (selectWrapper) {
        selectWrapper.style.setProperty('background-color', 'transparent', 'important');
        selectWrapper.style.setProperty('border', 'none', 'important');
      }
      if (selectElement) {
        selectElement.style.setProperty('background-color', 'transparent', 'important');
        selectElement.style.setProperty('border', 'none', 'important');
        selectElement.style.setProperty('border-bottom', 'none', 'important');
        selectElement.style.setProperty('box-shadow', 'none', 'important');
      }
    };

    // MutationObserver로 스타일 변경 감지
    const observer = new MutationObserver(() => {
      requestAnimationFrame(enforceTransparentStyle);
    });

    // 초기 스타일 제거
    enforceTransparentStyle();

    // 스타일 속성 변경 감지 (wrapper와 select element 모두)
    observer.observe(selectElement, {
      attributes: true,
      attributeFilter: ['style'],
    });
    if (selectWrapper) {
      observer.observe(selectWrapper, {
        attributes: true,
        attributeFilter: ['style'],
      });
    }

    // 짧은 간격으로 몇 번 확인 (Select 컴포넌트가 동적으로 스타일을 변경할 수 있음)
    const timeouts: NodeJS.Timeout[] = [];
    for (let i = 0; i < 5; i++) {
      timeouts.push(setTimeout(enforceTransparentStyle, i * 50));
    }

    return () => {
      observer.disconnect();
      timeouts.forEach(clearTimeout);
    };
  }, [value, size]);


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
        height: 'var(--height-control-sm)', // Button sm과 동일한 높이 토큰 사용
        // 동적 너비: 옵션 텍스트 기반으로 계산
        width: calculatedWidth ? `${calculatedWidth}px` : 'auto',
        minWidth: calculatedWidth ? `${calculatedWidth}px` : 'auto',
        paddingLeft: 'var(--spacing-xs)',
        paddingRight: 'var(--spacing-xs)',
        boxSizing: 'border-box',
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
          fullWidth={true}
          autoDropdownWidth={true}
          dropdownMinWidth={calculatedWidth}
        />
      </div>
    </div>
  );
};

