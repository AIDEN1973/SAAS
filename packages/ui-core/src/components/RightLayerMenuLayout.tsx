/**
 * RightLayerMenuLayout Component
 *
 * 우측 레이어 메뉴와 함께 사용하는 레이아웃 래퍼
 * [불변 규칙] 레이어 메뉴 너비만큼 바디 너비가 줄어듭니다 (push 방식).
 * [불변 규칙] 바디 너비가 태블릿 브레이크포인트 이하로 내려가면 오버레이 모드로 전환됩니다.
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { RightLayerMenu, RightLayerMenuProps } from './RightLayerMenu';
import { getCSSVariableAsPx, getCSSVariableAsMs, parseWidthToPx } from '../utils/css-variables';

export interface RightLayerMenuLayoutProps {
  children: React.ReactNode;
  layerMenu: Omit<RightLayerMenuProps, 'isOpen' | 'onClose'> & {
    isOpen: boolean;
    onClose: () => void;
  };
  className?: string;
}

/**
 * RightLayerMenuLayout 컴포넌트
 *
 * 우측 레이어 메뉴와 함께 사용하는 레이아웃 래퍼
 * 레이어 메뉴가 열리면 바디 너비가 자동으로 줄어듭니다.
 * 바디 너비가 태블릿 브레이크포인트(768px) 이하로 내려가면 오버레이 모드로 전환됩니다.
 */
export const RightLayerMenuLayout: React.FC<RightLayerMenuLayoutProps> = ({
  children,
  layerMenu,
  className,
}) => {
  const mode = useResponsiveMode();
  const isTablet = mode === 'md';
  const isMobile = mode === 'xs' || mode === 'sm';
  const bodyRef = useRef<HTMLDivElement>(null);
  const [useOverlayMode, setUseOverlayMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const overlayModeRef = useRef(false); // 이전 상태를 추적하여 불필요한 업데이트 방지
  const initialBodyWidthRef = useRef<number | null>(null); // 레이어 메뉴가 열리기 전의 바디 너비 저장

  // 오버레이 모드 전환 조건 계산 함수 (중복 제거)
  const calculateShouldUseOverlay = useCallback((
    bodyWidthWithoutMenu: number,
    windowWidth: number
  ): boolean => {
    // ⚠️ 중요: 하드코딩 금지, CSS 변수 사용 (fallback은 계산된 값)
    const breakpointTabletPx = getCSSVariableAsPx('--breakpoint-tablet', 48 * 16); // 기본값: 48rem = 768px (fallback)
    const overlayThresholdPx = getCSSVariableAsPx('--width-overlay-threshold', 90 * 16); // 기본값: 90rem = 1440px (fallback)

    // 1440px 이상인 경우 반드시 push 모드(바디 축소) 사용 보장
    if (windowWidth >= overlayThresholdPx) {
      return false; // push 모드 강제
    }

    // 오버레이 모드 전환 조건:
    // 1. 모바일/태블릿 모드일 때는 항상 오버레이 모드
    // 2. 레이어 메뉴를 제외한 바디 너비가 태블릿 브레이크포인트 이하일 때
    // 3. 전체 화면 너비가 1440px 미만일 때
    return isMobile || isTablet || bodyWidthWithoutMenu <= breakpointTabletPx;
  }, [isMobile, isTablet]);

  // 레이어 메뉴 너비 계산 (CSS 변수에서 실제 픽셀 값 추출)
  // 모바일: 전체 너비, 태블릿: 태블릿 너비, 데스크톱: 기본 너비
  const menuWidth = useMemo(() => {
    return layerMenu.width || (isMobile ? '100%' : isTablet ? 'var(--width-layer-menu-tablet)' : 'var(--width-layer-menu)');
  }, [layerMenu.width, isMobile, isTablet]);

  // CSS 변수를 픽셀 값으로 변환 (메모이제이션)
  const menuWidthPx = useMemo(() => {
    return parseWidthToPx(menuWidth, isMobile, isTablet);
  }, [menuWidth, isMobile, isTablet]);

  // 확장 시 너비는 전체 화면의 60% (토큰 기반, 우측 고정이므로 좌측으로 확장됨)
  const effectiveMenuWidth = useMemo(() => {
    if (isMobile) return menuWidth;
    return isExpanded ? 'var(--width-layer-menu-expanded)' : menuWidth;
  }, [menuWidth, isExpanded, isMobile]);

  const effectiveMenuWidthPx = useMemo(() => {
    if (isMobile) return menuWidthPx;
    // 60vw는 런타임 뷰포트에 의존하므로, 오버레이 강제 상태(isExpanded)에서는 px 계산이
    // push 모드 판단/바디 margin 계산에 사용되지 않도록(이미 오버레이 강제) 기본값을 반환한다.
    return menuWidthPx;
  }, [menuWidthPx, isExpanded, isMobile]);

  // 요구사항: 확장일 때는 오버레이 모드로 강제
  const effectiveUseOverlayMode = useMemo(() => {
    if (isMobile || isTablet) return true; // 기존 규칙 유지(모바일/태블릿은 항상 오버레이)
    return useOverlayMode || isExpanded;
  }, [isMobile, isTablet, useOverlayMode, isExpanded]);

  // 메뉴가 닫히면 확장 상태 초기화 (다음 오픈 시 일관성)
  useEffect(() => {
    if (!layerMenu.isOpen && isExpanded) {
      setIsExpanded(false);
    }
  }, [layerMenu.isOpen, isExpanded]);

  // 레이어 메뉴가 열리기 전의 바디 너비 저장
  // 레이어 메뉴가 열리기 직전의 바디 너비를 저장하여, 레이어 메뉴가 열린 후의 예상 바디 너비를 계산
  useEffect(() => {
    if (!layerMenu.isOpen) {
      // 레이어 메뉴가 닫혔을 때 초기 바디 너비 저장 (다음에 열릴 때를 대비)
      if (bodyRef.current) {
        initialBodyWidthRef.current = bodyRef.current.offsetWidth;
      }
    } else {
      // 레이어 메뉴가 열릴 때 초기 바디 너비가 없으면 현재 너비 저장
      if (initialBodyWidthRef.current === null && bodyRef.current) {
        initialBodyWidthRef.current = bodyRef.current.offsetWidth;
      }
    }
  }, [layerMenu.isOpen]);

  // 레이어 메뉴가 열렸을 때 바디 너비를 계산하고 오버레이 모드 결정
  useLayoutEffect(() => {
    if (!layerMenu.isOpen) {
      if (overlayModeRef.current !== false) {
        overlayModeRef.current = false;
        setUseOverlayMode(false);
      }
      return;
    }

    // 레이어 메뉴가 열리기 직전의 바디 너비가 없으면 현재 너비 저장
    // (useEffect에서 이미 처리했지만, 동기적으로도 확인)
    if (initialBodyWidthRef.current === null && bodyRef.current) {
      initialBodyWidthRef.current = bodyRef.current.offsetWidth;
    }

    // requestAnimationFrame을 사용하여 DOM 렌더링 완료 후 계산
    if (typeof window === 'undefined') {
      return; // SSR 환경에서는 실행하지 않음
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const windowWidth = window.innerWidth;
        // 레이어 메뉴가 열리기 전의 바디 너비 (저장된 값 또는 window 너비)
        const initialBodyWidth = initialBodyWidthRef.current || windowWidth;

        // 레이어 메뉴를 제외한 바디 너비 계산 (push 모드 가정)
        // push 모드일 때는 marginRight가 적용되므로 실제 사용 가능한 너비는 initialBodyWidth - menuWidthPx
        const bodyWidthWithoutMenu = Math.max(0, initialBodyWidth - menuWidthPx); // 음수 방지

        // 오버레이 모드 전환 조건 계산
        const shouldUseOverlay = calculateShouldUseOverlay(bodyWidthWithoutMenu, windowWidth);

        // 이전 상태와 다를 때만 업데이트 (무한 루프 방지)
        if (shouldUseOverlay !== overlayModeRef.current) {
          overlayModeRef.current = shouldUseOverlay;
          setUseOverlayMode(shouldUseOverlay);
        }
      });
    });
  }, [layerMenu.isOpen, effectiveMenuWidthPx, calculateShouldUseOverlay]);

  // 윈도우 리사이즈 및 바디 너비 변경 감지
  useEffect(() => {
    if (!layerMenu.isOpen) {
      return;
    }

    let timeoutId: NodeJS.Timeout | null = null;

    const checkOverlayMode = () => {
      // 디바운싱으로 너무 자주 호출되는 것을 방지
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        if (typeof window === 'undefined') {
          return; // SSR 환경에서는 실행하지 않음
        }

        const windowWidth = window.innerWidth;
        const initialBodyWidth = initialBodyWidthRef.current || windowWidth;

        // 레이어 메뉴를 제외한 바디 너비 계산 (push 모드 가정)
        const bodyWidthWithoutMenu = Math.max(0, initialBodyWidth - menuWidthPx); // 음수 방지

        // 오버레이 모드 전환 조건 계산
        const shouldUseOverlay = calculateShouldUseOverlay(bodyWidthWithoutMenu, windowWidth);

        // 이전 상태와 다를 때만 업데이트
        if (shouldUseOverlay !== overlayModeRef.current) {
          overlayModeRef.current = shouldUseOverlay;
          setUseOverlayMode(shouldUseOverlay);
        }
      }, getCSSVariableAsMs('--transition-debounce', 150)); // CSS 변수에서 디바운싱 시간 사용 (기본값: 150ms)
    };

    // 윈도우 리사이즈 이벤트 감지 (SSR 안전성 체크)
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkOverlayMode);
    }

    // ResizeObserver는 사용하지 않음 (바디 너비 변경이 오버레이 모드 변경을 유발하고, 그것이 다시 바디 너비를 변경하는 무한 루프 방지)
    // 대신 window.innerWidth만 감지하여 실제 화면 크기 변경만 감지

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', checkOverlayMode);
      }
    };
  }, [layerMenu.isOpen, effectiveMenuWidthPx, calculateShouldUseOverlay]);

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        width: '100%',
        position: 'relative',
        transition: 'var(--transition-all)',
      }}
    >
      {/* 바디 영역 (레이어 메뉴 너비만큼 줄어듦, 오버레이 모드일 때는 줄어들지 않음) */}
      <div
        ref={bodyRef}
        style={{
          flex: 1,
          width: '100%',
          marginRight: layerMenu.isOpen && !effectiveUseOverlayMode ? effectiveMenuWidth : 0, // 오버레이 모드일 때는 margin 제거
          transition: 'var(--transition-all)',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>

      {/* 우측 레이어 메뉴 */}
      <RightLayerMenu
        isOpen={layerMenu.isOpen}
        onClose={layerMenu.onClose}
        title={layerMenu.title}
        width={effectiveMenuWidth}
        headerActions={layerMenu.headerActions}
        // 요구사항: 태블릿/모바일에서는 확장/축소 버튼 숨김
        expandable={!isMobile && !isTablet}
        isExpanded={isExpanded}
        onToggleExpand={() => setIsExpanded((v) => !v)}
        className={layerMenu.className}
        style={effectiveUseOverlayMode ? {
          // 오버레이 모드일 때는 z-index를 높여서 바디 위에 표시
          zIndex: 'var(--z-modal-backdrop)',
        } : undefined}
      >
        {layerMenu.children}
      </RightLayerMenu>
    </div>
  );
};

