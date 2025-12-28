/**
 * 카드 그리드 레이아웃 컴포넌트
 *
 * HomePage, StudentsHomePage, AnalyticsPage 등에서 공통으로 사용하는 카드 그리드 레이아웃
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React from 'react';
import { useResponsiveMode, isDesktop, isTablet } from '@ui-core/react';

export interface CardGridLayoutProps {
  /** 카드 배열 */
  cards: React.ReactNode[];
  /** 데스크탑 컬럼 수 (기본값: 3) */
  desktopColumns?: number;
  /** 태블릿 컬럼 수 (기본값: 2) */
  tabletColumns?: number;
  /** 모바일 컬럼 수 (기본값: 1) */
  mobileColumns?: number;
}

/**
 * 카드 그리드 레이아웃 컴포넌트
 *
 * 행당 3열 (데스크탑), 상단/하단 테두리, 행 사이 구분선, 카드 사이 세로 구분선 포함
 */
export function CardGridLayout({
  cards,
  desktopColumns = 3,
  tabletColumns = 2,
  mobileColumns = 1,
}: CardGridLayoutProps) {
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isDesktopMode = isDesktop(modeUpper);
  const isTabletMode = isTablet(modeUpper);

  const columnsPerRow = isDesktopMode ? desktopColumns : isTabletMode ? tabletColumns : mobileColumns;
  // 그리드 형태(여러 열)로 출력될 때 상단 테두리 표시
  const showTopBorder = columnsPerRow > 1;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isDesktopMode
          ? `repeat(${desktopColumns}, 1fr)`
          : isTabletMode
            ? `repeat(${tabletColumns}, 1fr)`
            : `repeat(${mobileColumns}, 1fr)`,
        ...(showTopBorder && {
          borderTop: 'var(--border-width-thin) solid var(--color-text)',
        }),
        borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
        overflow: 'hidden', // 구분선이 컨테이너 밖으로 나가지 않도록
      }}
    >
      {cards.map((card, cardIndex) => {
        const rowIndex = Math.floor(cardIndex / columnsPerRow);
        const colIndex = cardIndex % columnsPerRow;
        const totalRows = Math.ceil(cards.length / columnsPerRow);
        const isLastRow = rowIndex === totalRows - 1;
        const isLastCard = cardIndex === cards.length - 1;
        const isLastColumn = colIndex === columnsPerRow - 1;

        // 구분선 표시 조건: 마지막 카드가 아니고, 마지막 컬럼이 아닌 경우에만 표시
        const shouldShowDivider = !isLastCard && !isLastColumn;

        return (
          <div
            key={cardIndex}
            style={{
              gridColumn: colIndex + 1,
              gridRow: rowIndex + 1,
              position: 'relative',
              borderBottom: !isLastRow ? 'var(--border-width-thin) solid var(--color-gray-200)' : 'none',
              paddingRight: shouldShowDivider ? 'var(--spacing-md)' : 0,
              paddingLeft: colIndex > 0 ? 'var(--spacing-md)' : 0,
              paddingTop: 'var(--spacing-lg)', // 행 내부 상단 여백
              paddingBottom: 'var(--spacing-lg)', // 행 내부 하단 여백
              overflow: 'hidden', // 구분선이 카드 밖으로 나가지 않도록
            }}
          >
            {card}
            {/* 세로 구분선: 높이 40%, 세로 중앙 정렬 (CSS 변수 사용) - 마지막 카드 또는 마지막 컬럼 이후에는 표시 안 함 */}
            {shouldShowDivider && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 'var(--border-width-thin)',
                  height: 'var(--height-divider-vertical)',
                  backgroundColor: 'var(--color-gray-200)',
                  // HARD-CODE-EXCEPTION: zIndex 1은 레이어 순서를 위한 특수 값 (레이아웃용 특수 값)
                  zIndex: 1,
                  pointerEvents: 'none', // 클릭 이벤트 방지
                }}
              />
            )}
          </div>
        );
      })}
      {/* 빈 셀 채우기 (마지막 행이 컬럼 수 미만인 경우) - 구분선 없음 */}
      {(() => {
        const lastRowStartIndex = Math.floor((cards.length - 1) / columnsPerRow) * columnsPerRow;
        const lastRowCards = cards.slice(lastRowStartIndex);
        const emptyCells = columnsPerRow - lastRowCards.length;

        if (emptyCells > 0 && isDesktopMode) {
          // 데스크탑에서만 빈 셀 표시 (태블릿/모바일에서는 불필요)
          return Array.from({ length: emptyCells }).map((_, emptyIndex) => {
            const colIndex = lastRowCards.length + emptyIndex;
            const rowIndex = Math.floor(cards.length / columnsPerRow);
            return (
              <div
                key={`empty-${emptyIndex}`}
                style={{
                  gridColumn: colIndex + 1,
                  gridRow: rowIndex + 1,
                  // 빈 셀에는 구분선 표시 안 함 (마지막 카드 이후이므로)
                  borderRight: 'none',
                }}
              />
            );
          });
        }
        return null;
      })()}
    </div>
  );
}
