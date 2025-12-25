/**
 * StudentTaskCard 렌더링 컴포넌트
 *
 * Hook 사용을 위해 별도 컴포넌트로 분리
 * react-refresh 규칙 준수: 컴포넌트만 export하는 파일
 * [P0-2 수정] SSOT: 네비게이션 보안 유틸리티 사용
 */

import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { StudentTaskCard } from './StudentTaskCard';
import type { StudentTaskCard as StudentTaskCardType } from '@hooks/use-student';
import { useStudentTaskCardAction } from '@hooks/use-student';
import { isSafeInternalPath } from '../utils/navigation-utils';

export function StudentTaskCardRenderer({ card, navigate }: { card: StudentTaskCardType; navigate: NavigateFunction }) {
  const handleCardAction = useStudentTaskCardAction();

  return (
    <StudentTaskCard
      key={card.id}
      card={card}
      onAction={(card) => {
        // ⚠️ 정본 규칙: 컴포넌트 레벨에서 navigate 호출 (Hook 내부 호출 금지)
        // [P0-2 수정] SSOT: isSafeInternalPath로 경로 검증 (서버에서 온 actionUrl 보호)
        const actionUrl = handleCardAction(card);
        if (actionUrl && isSafeInternalPath(actionUrl)) {
          navigate(actionUrl);
        }
        // 외부 URL 또는 잘못된 형식은 무시 (Fail Closed)
      }}
    />
  );
}

