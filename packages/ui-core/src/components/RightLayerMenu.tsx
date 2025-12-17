/**
 * RightLayerMenu Component
 *
 * 우측 레이어 메뉴 (슬라이딩 패널)
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 * [불변 규칙] 레이어 메뉴 너비만큼 바디 너비가 줄어듭니다 (push 방식).
 */

import React, { useMemo } from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { Button } from './Button';

export interface RightLayerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  children: React.ReactNode;
  width?: string; // 기본값: CSS 변수 사용 (--width-layer-menu 또는 --width-layer-menu-tablet)
  headerActions?: React.ReactNode; // 헤더에 추가 액션 버튼 등
  className?: string;
  style?: React.CSSProperties; // 추가 스타일 (오버레이 모드 등에서 사용)
}

/**
 * RightLayerMenu 컴포넌트
 *
 * 우측에서 슬라이딩으로 나타나는 레이어 메뉴
 * 레이어 메뉴가 열리면 바디 너비가 자동으로 줄어듭니다.
 */
export const RightLayerMenu: React.FC<RightLayerMenuProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width,
  headerActions,
  className,
  style,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';

  // 너비 계산: width prop이 없으면 반응형 모드에 따라 자동 조정 (메모이제이션)
  // 모바일: 전체 너비, 태블릿: 태블릿 너비, 데스크톱: 기본 너비
  const menuWidth = useMemo(() => {
    return width || (isMobile ? '100%' : isTablet ? 'var(--width-layer-menu-tablet)' : 'var(--width-layer-menu)');
  }, [width, isMobile, isTablet]);

  if (!isOpen) return null;

  return (
    <div
        className={clsx(className)}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: isMobile ? 0 : 'auto', // 모바일: 전체 화면을 위해 left도 0
          width: menuWidth,
          maxWidth: isMobile ? '100vw' : 'none', // 모바일: 뷰포트 너비를 넘지 않도록
          backgroundColor: 'var(--color-white)',
          borderLeft: isMobile ? 'none' : 'var(--border-width-thin) solid var(--color-gray-200)', // 모바일: 좌측 보더 제거
          boxShadow: 'var(--shadow-xl)',
          zIndex: 'var(--z-sticky)',
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'var(--transition-transform)',
          boxSizing: 'border-box', // 패딩과 보더를 포함한 너비 계산
          overflow: 'hidden', // 내용이 넘치지 않도록
          ...style, // 추가 스타일 병합
        }}
      >
      {/* 레이어 메뉴 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          // 글로벌 헤더와 동일한 패딩: 모바일(xs, sm): 상하 var(--padding-header-vertical), 좌우 var(--spacing-lg), 태블릿 이상(md+): 상하 var(--padding-header-vertical), 좌우 var(--spacing-xl)
          padding: isMobile
            ? 'var(--padding-header-vertical) var(--spacing-lg)' // 모바일: 상하 패딩 CSS 변수 사용, 좌우 CSS 변수 사용
            : 'var(--padding-header-vertical) var(--spacing-xl)', // 태블릿 이상: 상하 패딩 CSS 변수 사용, 좌우 CSS 변수 사용
          borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
          backgroundColor: 'var(--color-gray-50)',
          minHeight: 'var(--height-header)', // 글로벌 헤더 높이와 동일하게 설정
        }}
      >
        <h2
          style={{
            fontWeight: 'var(--font-weight-bold)',
            fontSize: 'var(--font-size-lg)',
            margin: 0,
            color: 'var(--color-text)',
            letterSpacing: 'var(--letter-spacing-title)', // styles.css 준수: 타이틀 글자 간격 토큰 사용
            flex: 1,
          }}
        >
          {title}
        </h2>
        {headerActions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginRight: 'var(--spacing-sm)' }}>
            {headerActions}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          style={{
            minWidth: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
            minHeight: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
          }}
        >
          ✕
        </Button>
      </div>

      {/* 레이어 메뉴 내용 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--spacing-lg)',
        }}
      >
        {children}
      </div>
    </div>
  );
};

