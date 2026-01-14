/**
 * RightLayerMenu Component
 *
 * 우측 레이어 메뉴 (슬라이딩 패널)
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 * [불변 규칙] 레이어 메뉴 너비만큼 바디 너비가 줄어듭니다 (push 방식).
 * [불변 규칙] 콘텐츠는 항상 렌더링되며, 슬라이드 애니메이션 중에도 표시됩니다.
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
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
  /** 내용 변경 감지용 키 (예: studentId). 이 값이 변경되면 페이드 아웃/인 애니메이션 실행 */
  contentKey?: string | number;
}

/**
 * RightLayerMenu 컴포넌트
 *
 * 우측에서 슬라이딩으로 나타나는 레이어 메뉴
 * 레이어 메뉴가 열리면 바디 너비가 자동으로 줄어듭니다.
 *
 * [변경] 슬라이드/확장 애니메이션 중에도 콘텐츠가 항상 표시됩니다.
 * - 깜빡임 및 중복 로딩 문제 해결
 * - CSS transform으로 슬라이딩 애니메이션만 적용
 * - 닫힘 애니메이션 중 이전 콘텐츠 유지 (캐싱)
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

  // ============================================================================
  // 닫힘 애니메이션 중 콘텐츠 유지를 위한 캐싱
  // ============================================================================

  // 이전 콘텐츠 캐싱 (닫힘 애니메이션 중 표시용)
  const cachedChildrenRef = useRef<React.ReactNode>(children);
  const cachedTitleRef = useRef<React.ReactNode>(title);

  // 열림 상태일 때만 캐시 업데이트
  useEffect(() => {
    if (isOpen && children) {
      cachedChildrenRef.current = children;
    }
    if (isOpen && title) {
      cachedTitleRef.current = title;
    }
  }, [isOpen, children, title]);

  // 표시할 콘텐츠: 열림 상태면 현재 children, 닫힘 상태면 캐시된 children
  const displayChildren = isOpen ? children : cachedChildrenRef.current;
  const displayTitle = isOpen ? title : cachedTitleRef.current;

  return (
    <div
        className={clsx('student-detail-layer', className)}
        style={{
          position: 'fixed',
          // 글로벌 헤더 하단에서 시작 (모바일은 전체 화면)
          top: isMobile ? 0 : 'var(--height-header)',
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
          // SubSidebar와 동일한 paddingTop으로 타이틀 수평 정렬 (Container paddingTop과 동일)
          paddingTop: 'var(--spacing-xl)',
          // 슬라이딩 애니메이션: transform으로 우측에서 들어옴
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform var(--transition-layer-slide), width var(--transition-layer-slide)',
          boxSizing: 'border-box', // 패딩과 보더를 포함한 너비 계산
          overflow: 'hidden', // 내용이 넘치지 않도록
          // 닫혔을 때 포인터 이벤트 차단 (화면 밖에 있지만 클릭 방지)
          pointerEvents: isOpen ? 'auto' : 'none',
          ...style, // 추가 스타일 병합
        }}
      >
      {/* 레이어 메뉴 헤더 - SubSidebar와 동일한 구조로 타이틀 수평 정렬 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          // SubSidebar 헤더와 동일한 레이아웃
          marginBottom: 0,
          gap: 'var(--spacing-md)',
          paddingLeft: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-lg)',
          paddingRight: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-lg)', // 타이틀 좌측 여백과 동일
          minHeight: 'var(--touch-target-min)', // PageHeader/SubSidebar와 동일한 높이
        }}
      >
        {/* 타이틀 - SubSidebar/PageHeader와 동일한 스타일 */}
        <span
          style={{
            fontSize: 'var(--font-size-3xl)',
            fontWeight: 'var(--font-weight-extrabold)',
            margin: 0,
            lineHeight: 'var(--line-height-tight)',
            color: 'var(--color-text)',
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            minWidth: 0, // flex item이 축소될 수 있도록
          }}
        >
          {displayTitle}
        </span>
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

      {/* 레이어 메뉴 내용 - 항상 표시 (닫힘 애니메이션 중 캐시된 콘텐츠 표시) */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--spacing-lg)',
        }}
      >
        {displayChildren}
      </div>
    </div>
  );
};
