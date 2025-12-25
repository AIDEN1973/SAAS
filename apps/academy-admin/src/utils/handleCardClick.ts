/**
 * DashboardCard 클릭 핸들러 유틸 함수
 *
 * [불변 규칙] HomePage와 AllCardsPage에서 공통 사용
 * [불변 규칙] SSOT 원칙 준수: 핸들러 로직은 이 파일에만 존재
 * [P0-2 수정] SSOT: 네비게이션 보안 유틸리티 사용
 */

import type { NavigateFunction } from 'react-router-dom';
import type { DashboardCard } from '../types/dashboardCard';
import { isSafeInternalPath } from './navigation-utils';

/**
 * DashboardCard 클릭 핸들러
 *
 * action_url이 있는 경우 해당 URL로 이동
 * [P0-2 수정] SSOT: isSafeInternalPath로 경로 검증 (오픈 리다이렉트 방지)
 *
 * @param card - 클릭된 카드 (클로저로 캡처됨)
 * @param navigate - React Router navigate 함수
 * @returns 카드 클릭 핸들러 함수 (onAction prop과 타입 호환을 위해 card 파라미터를 받지만 무시함)
 */
export function handleCardClick(card: DashboardCard, navigate: NavigateFunction) {
  return () => {
    // onAction prop의 타입 시그니처 (card: CardType) => void와 호환되도록 함수 반환
    if ('action_url' in card && card.action_url) {
      // [P0-2 수정] SSOT: isSafeInternalPath로 경로 검증 (서버/DB에서 온 action_url 보호)
      if (isSafeInternalPath(card.action_url)) {
        navigate(card.action_url);
      }
      // 외부 URL 또는 잘못된 형식은 무시 (Fail Closed)
    }
  };
}

