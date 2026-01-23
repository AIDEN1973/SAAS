/**
 * 타임라인 버튼 컴포넌트
 * 헤더에서 타임라인 모달을 여는 버튼
 */
import React, { useState } from 'react';
import { ClockCounterClockwise } from 'phosphor-react';
import { Tooltip } from '@ui-core/react';

interface TimelineButtonProps {
  onClick: () => void;
}

export const TimelineButton: React.FC<TimelineButtonProps> = ({ onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Tooltip content="타임라인" position="bottom">
      <button
        onClick={onClick}
        aria-label="타임라인 열기"
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
        <ClockCounterClockwise
          weight="regular"
          style={{
            width: 'var(--size-icon-xl)',
            height: 'var(--size-icon-xl)',
            color: 'var(--color-text-tertiary)',
          }}
        />
      </button>
    </Tooltip>
  );
};
