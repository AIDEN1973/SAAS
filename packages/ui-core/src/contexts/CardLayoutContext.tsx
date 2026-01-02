/**
 * Card Layout Context
 *
 * 카드의 variant를 자동으로 결정하기 위한 컨텍스트
 *
 * [불변 규칙] 그리드 내 카드는 elevated, 단독 카드는 outlined
 */

import React, { createContext, useContext } from 'react';

export type CardLayoutType = 'grid' | 'standalone';

const CardLayoutContext = createContext<CardLayoutType>('standalone');

export const useCardLayout = () => useContext(CardLayoutContext);

export const CardLayoutProvider: React.FC<{
  children: React.ReactNode;
  type: CardLayoutType;
}> = ({ children, type }) => {
  return (
    <CardLayoutContext.Provider value={type}>
      {children}
    </CardLayoutContext.Provider>
  );
};
