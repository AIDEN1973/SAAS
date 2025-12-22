/**
 * DashboardCard 클릭 핸들러 유틸 함수
 *
 * [불변 규칙] HomePage와 AllCardsPage에서 공통 사용
 * [불변 규칙] SSOT 원칙 준수: 핸들러 로직은 이 파일에만 존재
 */

import type { NavigateFunction } from 'react-router-dom';
import type { DashboardCard } from '../types/dashboardCard';

/**
 * DashboardCard 클릭 핸들러
 *
 * action_url이 있는 경우 해당 URL로 이동
 *
 * @param card - 클릭된 카드 (클로저로 캡처됨)
 * @param navigate - React Router navigate 함수
 * @returns 카드 클릭 핸들러 함수 (onAction prop과 타입 호환을 위해 card 파라미터를 받지만 무시함)
 */
export function handleCardClick(card: DashboardCard, navigate: NavigateFunction) {
  return (_card?: DashboardCard) => {
    // _card 파라미터는 무시 (클로저로 card를 캡처하므로)
    // onAction prop의 타입 시그니처 (card: CardType) => void와 호환되도록 파라미터를 받음
    if ('action_url' in card && card.action_url) {
      navigate(card.action_url);
    }
  };
}

