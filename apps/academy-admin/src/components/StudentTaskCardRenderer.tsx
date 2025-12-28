/**
 * StudentTaskCard Renderer
 *
 * DashboardCard Renderer에서 사용하는 StudentTaskCard 래퍼 컴포넌트
 * navigate 함수를 onAction으로 변환하여 StudentTaskCard에 전달
 */

import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { StudentTaskCard as StudentTaskCardType } from '@hooks/use-student';
import { StudentTaskCard } from './StudentTaskCard';
import { handleCardClick } from '../utils/handleCardClick';

interface StudentTaskCardRendererProps {
  card: StudentTaskCardType;
  navigate: NavigateFunction;
}

export function StudentTaskCardRenderer({ card, navigate }: StudentTaskCardRendererProps) {
  // handleCardClick은 () => void를 반환하지만, StudentTaskCard의 onAction은 (card) => void를 기대함
  // 따라서 래퍼 함수를 만들어서 타입 호환성 확보
  const handleAction = (actionCard: StudentTaskCardType) => {
    // handleCardClick의 반환 함수를 호출
    const clickHandler = handleCardClick(actionCard, navigate);
    clickHandler();
  };

  return (
    <StudentTaskCard
      card={card}
      onAction={handleAction}
    />
  );
}

