/**
 * RightLayerMenu Component
 *
 * 우측 레이어 메뉴 (슬라이딩 패널)
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 * [불변 규칙] 레이어 메뉴 너비만큼 바디 너비가 줄어듭니다 (push 방식).
 */

import React, { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { useIconSize, useIconStrokeWidth } from '../hooks/useIconSize';
import { Button } from './Button';
import { ArrowLeftFromLine, ArrowRightFromLine } from 'lucide-react';

export interface RightLayerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  children: React.ReactNode;
  width?: string; // 기본값: CSS 변수 사용 (--width-layer-menu 또는 --width-layer-menu-tablet)
  headerActions?: React.ReactNode; // 헤더에 추가 액션 버튼 등
  /** 헤더의 닫기(X) 버튼 좌측에 "확장/축소" 토글을 표시할지 여부 */
  expandable?: boolean;
  /** 확장 상태 */
  isExpanded?: boolean;
  /** 확장 토글 */
  onToggleExpand?: () => void;
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
  expandable = false,
  isExpanded = false,
  onToggleExpand,
  className,
  style,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const [isExpandHovered, setIsExpandHovered] = useState(false);

  // 요구사항: 기본 1px, 롤오버 2px (CSS 변수 기반, 하드코딩 금지)
  const iconSize = useIconSize('--size-icon-base', 16);
  const strokeWidthBase = useIconStrokeWidth('--stroke-width-icon-thin', 1);
  const strokeWidthHover = useIconStrokeWidth('--stroke-width-icon-medium', 2);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          {headerActions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              {headerActions}
            </div>
          )}

          {/* 요구사항: X 표시 좌측에 축소/확장 루시드 아이콘 */}
          {expandable && !isMobile && !isTablet && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              onMouseEnter={() => setIsExpandHovered(true)}
              onMouseLeave={() => setIsExpandHovered(false)}
              style={{
                // 요구사항: 아이콘 외부 감싸는 버튼 비지(여백) 제거
                padding: 0,
                minWidth: 'auto',
                minHeight: 'auto',
                width: 'auto',
                height: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 0,
              }}
              aria-label={isExpanded ? '레이어 메뉴 축소' : '레이어 메뉴 확장'}
            >
              {/* 아이콘 방향/의미: 확장(arrow-left-from-line), 축소(arrow-right-from-line) */}
              {isExpanded ? (
                <ArrowRightFromLine size={iconSize} strokeWidth={isExpandHovered ? strokeWidthHover : strokeWidthBase} />
              ) : (
                <ArrowLeftFromLine size={iconSize} strokeWidth={isExpandHovered ? strokeWidthHover : strokeWidthBase} />
              )}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            style={{
              // 요구사항: X 버튼도 비지(여백) 제거
              padding: 0,
              minWidth: 'auto',
              minHeight: 'auto',
              width: 'auto',
              height: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 0,
            }}
          >
            ✕
          </Button>
        </div>
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

