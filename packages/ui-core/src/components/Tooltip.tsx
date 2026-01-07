/**
 * Tooltip Component
 *
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용한다.
 */

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';

export interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
  useThemeColor?: boolean; // 인더스트리 테마 색상 사용 여부
}

/**
 * Tooltip 컴포넌트
 *
 * 호버 시 설명말을 표시하는 툴팁
 */
export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  delay = 200, // 기본 지연 시간 (ms) - 접근성을 위한 최소값
  className,
  useThemeColor = false, // 기본값: false (기존 스타일 유지)
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>();

  // CSS 변수에서 값을 px로 변환하는 헬퍼 함수
  const getCssVarPx = useCallback((varName: string, defaultValue: number): number => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();
      if (value.endsWith('rem')) {
        // ⚠️ 중요: 하드코딩 금지, CSS 변수에서 기본 폰트 크기 읽기
        // HARD-CODE-EXCEPTION: fallback 값 16은 브라우저 기본 폰트 크기 (브라우저 호환성용 상수)
        const baseFontSize = typeof window !== 'undefined'
          ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size-base').trim()) || 16
          : 16;
        return parseFloat(value) * baseFontSize; // rem을 px로 변환
      } else if (value.endsWith('px')) {
        return parseFloat(value);
      } else if (value) {
        return Number(value);
      }
    }
    return defaultValue;
  }, []);

  // offset 계산용 - CSS 변수에서 읽기 (하드코딩 제거)
  // 툴팁과 버튼 사이 간격을 더 넓게 조정 (8px)
  const offsetPx = useMemo(() => getCssVarPx('--spacing-tooltip-offset', 8), [getCssVarPx]);

  // 화살표 크기 - CSS 변수에서 읽기 (하드코딩 제거)
  const arrowInnerSize = useMemo(() => getCssVarPx('--size-tooltip-arrow-inner', 4), [getCssVarPx]);

  // 정밀한 위치 계산 함수
  const calculatePosition = useCallback(() => {
    if (!tooltipRef.current || !triggerRef.current) return;

    // 여러 프레임에 걸쳐 정확한 크기 측정
    const measureAndPosition = () => {
      if (!tooltipRef.current || !triggerRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // 툴팁이 아직 렌더링되지 않았거나 크기가 0이면 다시 시도
      if (tooltipRect.width === 0 || tooltipRect.height === 0) {
        requestAnimationFrame(measureAndPosition);
        return;
      }

      let top = 0;
      let left = 0;

      switch (position) {
        case 'top': {
          // 버튼의 정확한 중앙점 계산 (픽셀 단위)
          const triggerCenterX = triggerRect.left + triggerRect.width / 2;
          top = triggerRect.top - tooltipRect.height - offsetPx;
          // 툴팁의 중앙점이 버튼의 중앙점과 정확히 일치하도록 설정
          left = triggerCenterX;
          break;
        }
        case 'bottom': {
          const triggerCenterXBottom = triggerRect.left + triggerRect.width / 2;
          top = triggerRect.bottom + offsetPx;
          left = triggerCenterXBottom;
          break;
        }
        case 'left': {
          const triggerCenterYLeft = triggerRect.top + triggerRect.height / 2;
          top = triggerCenterYLeft;
          left = triggerRect.left - tooltipRect.width - offsetPx;
          break;
        }
        case 'right': {
          const triggerCenterYRight = triggerRect.top + triggerRect.height / 2;
          top = triggerCenterYRight;
          left = triggerRect.right + offsetPx;
          break;
        }
      }

      setTooltipStyle({
        position: 'fixed' as const,
        top: `${Math.round(top * 100) / 100}px`, // 소수점 둘째 자리까지 정밀도
        left: `${Math.round(left * 100) / 100}px`,
        transform: position === 'top' || position === 'bottom' ? 'translateX(-50%)' : 'translateY(-50%)',
        zIndex: 'var(--z-tooltip)', // styles.css 준수: z-index 토큰 사용
      });
    };

    // 즉시 한 번 실행하고, 다음 프레임에서도 확인
    measureAndPosition();
    requestAnimationFrame(() => {
      requestAnimationFrame(measureAndPosition);
    });
  }, [position, offsetPx]);

  // ref 콜백 - Portal이 마운트될 때 호출됨
  const tooltipRefCallback = useCallback((node: HTMLDivElement | null) => {
    tooltipRef.current = node;
    if (node) {
      // DOM에 마운트된 후 위치 계산
      calculatePosition();
    }
  }, [calculatePosition]);

  // isVisible이 변경될 때마다 위치 재계산
  useLayoutEffect(() => {
    if (isVisible) {
      calculatePosition();
    }
  }, [isVisible, calculatePosition]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        className={clsx(className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          display: 'inline-block',
        }}
      >
        {children}
      </div>
      {isVisible &&
        createPortal(
          <div
            ref={tooltipRefCallback}
            style={{
              ...tooltipStyle,
              position: 'fixed', // tooltipStyle에서 이미 설정되지만 명시적으로 유지
              maxWidth: 'var(--size-tooltip-max-width)', // styles.css 준수: 툴팁 최대 너비 토큰 사용
              pointerEvents: 'none',
              color: 'var(--color-white)', // 항상 흰색 텍스트
              backgroundColor: useThemeColor ? 'var(--color-primary)' : 'var(--color-text)', // 기본 텍스트 색상 배경
              padding: 'var(--spacing-sm)',
              borderRadius: 'var(--border-radius-sm)',
              boxShadow: 'var(--shadow-lg)',
              border: 'none', // 어두운 배경이므로 테두리 제거
              fontSize: 'var(--font-size-sm)', // styles.css 준수: 툴팁 폰트 사이즈
              whiteSpace: 'nowrap', // 한 줄로 표시
              overflow: 'visible', // 화살표가 잘리지 않도록
            }}
          >
            {/* 상단 삼각형 (position이 'bottom'일 때 표시, 버튼 쪽을 가리킴) */}
            {position === 'bottom' && (
              <div
                style={{
                  position: 'absolute',
                  top: -arrowInnerSize,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeftWidth: arrowInnerSize,
                  borderLeftStyle: 'solid',
                  borderLeftColor: 'transparent',
                  borderRightWidth: arrowInnerSize,
                  borderRightStyle: 'solid',
                  borderRightColor: 'transparent',
                  borderBottomWidth: arrowInnerSize,
                  borderBottomStyle: 'solid',
                  borderBottomColor: useThemeColor ? 'var(--color-primary)' : 'var(--color-text)',
                  zIndex: 1,
                }}
              />
            )}
            {/* 왼쪽 삼각형 (position이 'right'일 때 표시, 아이콘 쪽을 가리킴) */}
            {position === 'right' && (
              <div
                style={{
                  position: 'absolute',
                  left: -arrowInnerSize,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 0,
                  height: 0,
                  borderTopWidth: arrowInnerSize,
                  borderTopStyle: 'solid',
                  borderTopColor: 'transparent',
                  borderBottomWidth: arrowInnerSize,
                  borderBottomStyle: 'solid',
                  borderBottomColor: 'transparent',
                  borderRightWidth: arrowInnerSize,
                  borderRightStyle: 'solid',
                  borderRightColor: useThemeColor ? 'var(--color-primary)' : 'var(--color-text)',
                  zIndex: 1,
                }}
              />
            )}
            {content}
          </div>,
          document.body
        )}
    </>
  );
};
