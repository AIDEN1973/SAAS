/**
 * Popover Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 *
 * 드롭다운, 달력 등 포털 기반 UI를 위한 공통 컴포넌트
 */

import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

export interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  children: React.ReactNode;
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  offset?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Popover 컴포넌트
 *
 * 앵커 요소 기준으로 위치를 계산하여 포털로 렌더링합니다.
 */
export const Popover: React.FC<PopoverProps> = ({
  isOpen,
  onClose,
  anchorEl,
  children,
  placement = 'bottom-start',
  offset = 4,
  className,
  style,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isPositioned, setIsPositioned] = useState(false);

  useEffect(() => {
    if (!isOpen || !anchorEl) {
      setIsPositioned(false);
      return;
    }

    // 위치 계산을 requestAnimationFrame으로 지연하여 DOM이 완전히 렌더링된 후 계산
    const updatePosition = () => {
      if (!popoverRef.current) {
        // 아직 DOM에 마운트되지 않았으면 다음 프레임에서 재시도
        requestAnimationFrame(updatePosition);
        return;
      }

      const anchorRect = anchorEl.getBoundingClientRect();
      const popoverRect = popoverRef.current.getBoundingClientRect();

      // fixed positioning은 viewport 기준이므로 scroll 값을 더하지 않음
      let top = 0;
      let left = 0;

      switch (placement) {
        case 'bottom-start':
          top = anchorRect.bottom + offset;
          left = anchorRect.left;
          break;
        case 'bottom-end':
          top = anchorRect.bottom + offset;
          left = anchorRect.right - popoverRect.width;
          break;
        case 'top-start':
          top = anchorRect.top - popoverRect.height - offset;
          left = anchorRect.left;
          break;
        case 'top-end':
          top = anchorRect.top - popoverRect.height - offset;
          left = anchorRect.right - popoverRect.width;
          break;
      }

      // 화면 경계 체크 및 조정
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // 화면 경계 체크: 최소 여백은 spacing-sm (8px) 사용
      const minMargin = 8; // var(--spacing-sm) = 8px (JavaScript 계산에서는 숫자 사용)
      if (left + popoverRect.width > viewportWidth) {
        left = viewportWidth - popoverRect.width - minMargin;
      }
      if (left < minMargin) {
        left = minMargin;
      }

      if (top + popoverRect.height > viewportHeight) {
        top = anchorRect.top - popoverRect.height - offset;
      }
      if (top < minMargin) {
        top = minMargin;
      }

      setPosition({ top, left });
      setIsPositioned(true);
    };

    // requestAnimationFrame을 사용하여 DOM 렌더링 완료 후 위치 계산
    requestAnimationFrame(() => {
      requestAnimationFrame(updatePosition);
    });

    // 리사이즈 및 스크롤 이벤트 리스너
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, anchorEl, placement, offset]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorEl &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // 약간의 지연을 두어 현재 클릭 이벤트가 처리되도록 함
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, anchorEl]);

  if (!isOpen || !anchorEl) return null;

  // style prop에 width가 있으면 minWidth를 설정하지 않음 (셀렉트 박스 너비에 맞추기 위함)
  // 그렇지 않으면 기본 minWidth 적용
  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    top: `${position.top}px`,
    left: `${position.left}px`,
    zIndex: 'var(--z-popover)',
    backgroundColor: 'var(--color-white)',
    borderRadius: 'var(--border-radius-md)',
    boxShadow: 'var(--shadow-lg)',
    border: 'var(--border-width-thin) solid var(--color-gray-200)',
    padding: 'var(--spacing-xs)',
    // style에 width가 없을 때만 minWidth 적용
    ...(style?.width ? {} : { minWidth: 'var(--width-card-min)' }), // styles.css 준수: 카드 최소 너비
    maxWidth: 'var(--width-content-max)', // styles.css 준수: 콘텐츠 최대 너비
    // overflow와 maxHeight는 자식 컴포넌트에서 처리 (이중 스크롤 방지)
    overflow: 'visible',
    // 위치 계산 완료 전까지 숨김 (번쩍이는 현상 방지)
    opacity: isPositioned ? 1 : 0,
    visibility: isPositioned ? 'visible' : 'hidden', // visibility로 레이아웃 계산은 유지하되 보이지 않게
    transition: isPositioned ? 'opacity var(--transition-fast)' : 'none',
    // style prop을 마지막에 적용하여 width 등이 우선 적용되도록 함
    ...(style || {}),
  };

  return (
    <div
      ref={popoverRef}
      className={clsx(className)}
      style={popoverStyle}
    >
      {children}
    </div>
  );
};
