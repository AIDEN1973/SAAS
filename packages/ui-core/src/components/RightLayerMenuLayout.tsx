/**
 * RightLayerMenuLayout Component
 *
 * 우측 레이어 메뉴와 함께 사용하는 레이아웃 래퍼
 * [불변 규칙] 1669px 초과: 레이어 메뉴 너비만큼 바디 너비가 줄어듭니다 (push 방식).
 * [불변 규칙] 1669px 이하: 레이어 메뉴가 바디 위에 오버레이됩니다 (overlay 방식).
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { RightLayerMenu, RightLayerMenuProps } from './RightLayerMenu';
import { getCSSVariableAsMs } from '../utils/css-variables';

// 레이어 메뉴 transition 상태를 전역으로 공유 (간단한 boolean)
let layerMenuTransitioning = false;
const transitionListeners: Set<(transitioning: boolean) => void> = new Set();

export const useLayerMenuTransition = () => {
  const [isTransitioning, setIsTransitioning] = useState(layerMenuTransitioning);

  useEffect(() => {
    const listener = (transitioning: boolean) => {
      setIsTransitioning(transitioning);
    };
    transitionListeners.add(listener);
    setIsTransitioning(layerMenuTransitioning);
    return () => { transitionListeners.delete(listener); };
  }, []);

  return isTransitioning;
};

const setLayerMenuTransitioning = (value: boolean) => {
  layerMenuTransitioning = value;
  transitionListeners.forEach(listener => listener(layerMenuTransitioning));
};

// 오버레이 모드 기준 너비 (1669px)
const OVERLAY_THRESHOLD_PX = 1669;

export interface RightLayerMenuLayoutProps {
  children: React.ReactNode;
  layerMenu: Omit<RightLayerMenuProps, 'isOpen' | 'onClose'> & {
    isOpen: boolean;
    onClose: () => void;
    /** @deprecated contentKey는 더 이상 사용되지 않습니다. 자동으로 무시됩니다. */
    contentKey?: string | number;
  };
  className?: string;
}

/**
 * RightLayerMenuLayout 컴포넌트
 *
 * 우측 레이어 메뉴와 함께 사용하는 레이아웃 래퍼
 * - 1669px 초과: 레이어 메뉴가 열리면 바디 너비가 자동으로 줄어듭니다 (push 방식)
 * - 1669px 이하: 레이어 메뉴가 바디 위에 오버레이됩니다 (overlay 방식)
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
  const [isExpanded, setIsExpanded] = useState(false);

  // 윈도우 너비 상태 (실시간 감지)
  const [windowWidth, setWindowWidth] = useState(() => {
    if (typeof window === 'undefined') return 1920; // SSR 기본값
    return window.innerWidth;
  });

  // 윈도우 리사이즈 실시간 감지 (항상 활성화)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: NodeJS.Timeout | null = null;

    const handleResize = () => {
      // 디바운싱
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        setWindowWidth(window.innerWidth);
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 오버레이 모드 계산 (윈도우 너비 기반)
  const useOverlayMode = useMemo(() => {
    // 모바일/태블릿은 항상 오버레이
    if (isMobile || isTablet) return true;
    // 1669px 이하면 오버레이 모드
    return windowWidth <= OVERLAY_THRESHOLD_PX;
  }, [isMobile, isTablet, windowWidth]);

  // 요구사항: 확장일 때는 오버레이 모드로 강제
  const effectiveUseOverlayMode = useMemo(() => {
    return useOverlayMode || isExpanded;
  }, [useOverlayMode, isExpanded]);

  // 레이어 메뉴 너비 계산 (CSS 변수에서 실제 픽셀 값 추출)
  const menuWidth = useMemo(() => {
    return layerMenu.width || (isMobile ? '100%' : isTablet ? 'var(--width-layer-menu-tablet)' : 'var(--width-layer-menu)');
  }, [layerMenu.width, isMobile, isTablet]);

  // 확장 시 너비
  const effectiveMenuWidth = useMemo(() => {
    if (isMobile) return menuWidth;
    return isExpanded ? 'var(--width-layer-menu-expanded)' : menuWidth;
  }, [menuWidth, isExpanded, isMobile]);

  // 메뉴가 닫히면 확장 상태 초기화
  const prevIsOpenRef = useRef(layerMenu.isOpen);
  useEffect(() => {
    if (prevIsOpenRef.current && !layerMenu.isOpen) {
      const timer = setTimeout(() => {
        if (isExpanded) {
          setIsExpanded(false);
        }
      }, getCSSVariableAsMs('--transition-layer-slide-duration', 300));
      prevIsOpenRef.current = layerMenu.isOpen;
      return () => clearTimeout(timer);
    }
    prevIsOpenRef.current = layerMenu.isOpen;
  }, [layerMenu.isOpen, isExpanded]);

  // 이전 isOpen 상태를 추적하여 transition 시작 감지
  const prevIsOpenForTransition = useRef(layerMenu.isOpen);
  useEffect(() => {
    // isOpen 상태가 변경되고 오버레이 모드가 아니면 transition 시작
    if (prevIsOpenForTransition.current !== layerMenu.isOpen && !effectiveUseOverlayMode) {
      setLayerMenuTransitioning(true);
    }
    prevIsOpenForTransition.current = layerMenu.isOpen;
  }, [layerMenu.isOpen, effectiveUseOverlayMode]);

  // Transition 종료 이벤트 핸들러
  const handleTransitionEnd = useCallback((e: React.TransitionEvent) => {
    if (e.propertyName === 'margin-right') {
      setLayerMenuTransitioning(false);
    }
  }, []);

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        width: '100%',
        position: 'relative',
        transition: 'var(--transition-layer-slide)',
      }}
    >
      {/* 바디 영역 */}
      <div
        ref={bodyRef}
        onTransitionEnd={handleTransitionEnd}
        style={{
          flex: 1,
          width: '100%',
          marginRight: layerMenu.isOpen && !effectiveUseOverlayMode ? effectiveMenuWidth : 0,
          transition: 'margin-right var(--transition-layer-slide)',
          overflowY: 'auto',
          overflowX: 'hidden',
          // Container의 paddingBottom과 동일하게 하단 여백 적용
          paddingBottom: 'var(--spacing-2xl)',
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
        expandable={!isMobile && !isTablet}
        isExpanded={isExpanded}
        onToggleExpand={() => setIsExpanded((v) => !v)}
        className={layerMenu.className}
        style={effectiveUseOverlayMode ? {
          zIndex: 'var(--z-modal-backdrop)',
        } : undefined}
      >
        {layerMenu.children}
      </RightLayerMenu>
    </div>
  );
};
