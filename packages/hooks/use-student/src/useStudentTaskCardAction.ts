/**
 * StudentTaskCard onAction 핸들러 Hook
 *
 * 정본 규칙: Hook 내부에서 navigate() 호출 금지
 * 이 Hook은 action_url에 cardId를 쿼리 파라미터로 추가한 URL을 반환만 합니다.
 * 실제 이동은 컴포넌트의 onClick 핸들러에서 navigate()를 호출해야 합니다.
 *
 * [불변 규칙] 모든 StudentTaskCard 클릭 시 이 Hook 사용
 * [불변 규칙] HomePage, AllCardsPage, StudentsHomePage, StudentTasksPage에서 공통 사용
 */

import { useCallback } from 'react';
import type { StudentTaskCard } from './useStudentTaskCard';

/**
 * StudentTaskCard onAction 핸들러 Hook
 *
 * 정본 규칙 준수: Hook 내부에서 navigate() 호출 금지
 *
 * 카드 클릭 시 action_url에 cardId를 쿼리 파라미터로 추가한 URL을 반환합니다.
 * 실제 이동은 컴포넌트의 onClick 핸들러에서 navigate()를 호출해야 합니다.
 *
 * 사용 예시:
 * ```tsx
 * const handleAction = useStudentTaskCardAction();
 * const navigate = useNavigate();
 *
 * <StudentTaskCard
 *   card={card}
 *   onAction={(card) => {
 *     const url = handleAction(card);
 *     if (url) navigate(url);
 *   }}
 * />
 * ```
 */
export function useStudentTaskCardAction() {
  return useCallback(
    (card: StudentTaskCard): string | null => {
      // 정본 규칙: Hook 내부에서 navigate() 호출 금지
      // action_url에 cardId를 쿼리 파라미터로 추가한 URL만 반환
      if (card.action_url) {
        return card.action_url.includes('?')
          ? `${card.action_url}&cardId=${card.id}`
          : `${card.action_url}?cardId=${card.id}`;
      }
      return null;
    },
    []
  );
}

