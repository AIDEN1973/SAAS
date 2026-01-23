/**
 * 매뉴얼 버튼 컴포넌트
 * 헤더에서 매뉴얼 페이지로 이동하는 버튼
 */
import React, { useState } from 'react';
import { BookOpen } from 'phosphor-react';
import { Tooltip } from '@ui-core/react';

interface ManualButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export const ManualButton: React.FC<ManualButtonProps> = ({ isOpen, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Tooltip content="매뉴얼" position="bottom">
      <button
        onClick={onClick}
        aria-label="매뉴얼 열기/닫기"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--spacing-sm)',
          backgroundColor: isHovered ? 'var(--color-primary-hover)' : 'transparent',
          border: 'none',
          borderRadius: 'var(--border-radius-md)',
          cursor: 'pointer',
          transition: 'var(--transition-all)',
        }}
      >
        <BookOpen
          weight={isOpen ? 'bold' : 'regular'}
          style={{
            width: 'var(--size-icon-xl)',
            height: 'var(--size-icon-xl)',
            color: isOpen ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
          }}
        />
      </button>
    </Tooltip>
  );
};
