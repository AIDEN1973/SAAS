/**
 * PopoverMenu Component
 *
 * Popover 내부에서 사용되는 메뉴 컴포넌트
 * Select 드롭다운과 동일한 스타일 적용
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 */

import React, { useState } from 'react';

export interface PopoverMenuItemProps {
  /** 메뉴 항목 라벨 */
  children: React.ReactNode;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 위험한 액션 여부 (빨간색 텍스트) */
  danger?: boolean;
  /** 아이콘 (좌측) */
  icon?: React.ReactNode;
}

/**
 * PopoverMenuItem 컴포넌트
 *
 * Select 드롭다운 옵션과 동일한 스타일
 */
export const PopoverMenuItem: React.FC<PopoverMenuItemProps> = ({
  children,
  onClick,
  disabled = false,
  danger = false,
  icon,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      role="menuitem"
      onClick={() => !disabled && onClick?.()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        // Select 드롭다운 옵션과 동일한 패딩
        paddingTop: 'var(--spacing-xs)',
        paddingBottom: 'var(--spacing-xs)',
        paddingLeft: 'var(--spacing-sm)',
        paddingRight: 'var(--spacing-lg)',
        borderRadius: 'var(--border-radius-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 'var(--font-size-base)',
        fontWeight: 'var(--font-weight-normal)',
        color: disabled
          ? 'var(--color-text-tertiary)'
          : danger
            ? 'var(--color-error)'
            : 'var(--color-text)',
        backgroundColor: isHovered && !disabled ? 'var(--color-primary-hover)' : 'transparent',
        transition: 'var(--transition-fast)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        whiteSpace: 'nowrap',
      }}
    >
      {icon && (
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {icon}
        </span>
      )}
      <span>{children}</span>
    </div>
  );
};

export interface PopoverMenuProps {
  /** 메뉴 항목들 */
  children: React.ReactNode;
  /** 추가 스타일 */
  style?: React.CSSProperties;
}

/**
 * PopoverMenu 컴포넌트
 *
 * Popover 내부에서 사용되는 메뉴 컨테이너
 * Select 드롭다운과 동일한 패딩 적용
 */
export const PopoverMenu: React.FC<PopoverMenuProps> = ({
  children,
  style,
}) => {
  return (
    <div
      role="menu"
      style={{
        padding: 'var(--spacing-xs)',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export interface PopoverMenuDividerProps {
  /** 추가 스타일 */
  style?: React.CSSProperties;
}

/**
 * PopoverMenuDivider 컴포넌트
 *
 * 메뉴 항목 사이 구분선
 */
export const PopoverMenuDivider: React.FC<PopoverMenuDividerProps> = ({ style }) => {
  return (
    <div
      style={{
        height: 'var(--divider-height, 1px)',
        backgroundColor: 'var(--color-gray-200)',
        margin: 'var(--spacing-xs) 0',
        ...style,
      }}
    />
  );
};
