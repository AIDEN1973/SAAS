/**
 * 에이전트 버튼 컴포넌트
 * 헤더에서 AI 에이전트 페이지로 이동하는 버튼
 */
import React, { useState } from 'react';
import { ChatsCircle } from 'phosphor-react';
import { Tooltip } from '@ui-core/react';

interface AgentButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export const AgentButton: React.FC<AgentButtonProps> = ({ isOpen, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Tooltip content="에이전트" position="bottom">
      <button
        onClick={onClick}
        aria-label="에이전트 열기/닫기"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--spacing-sm)',
          backgroundColor: isHovered ? 'var(--color-primary-40)' : 'transparent',
          border: 'none',
          borderRadius: 'var(--border-radius-md)',
          cursor: 'pointer',
          transition: 'var(--transition-all)',
        }}
      >
        <ChatsCircle
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
