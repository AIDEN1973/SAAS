/**
 * Virtual List 컴포넌트
 *
 * [LAYER: UI_COMPONENT]
 * [성능 최적화] 대량 리스트 렌더링 최적화
 *
 * react-window를 사용한 가상 스크롤 구현
 * - 화면에 보이는 항목만 렌더링
 * - 스크롤 성능 대폭 개선 (1000개 이상 항목도 부드럽게 렌더링)
 */

import React from 'react';
// react-window exports FixedSizeList but has no built-in types
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { FixedSizeList } from 'react-window';
// react-virtualized-auto-sizer exports default export
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import AutoSizer from 'react-virtualized-auto-sizer';

/**
 * [SSOT] 가상 스크롤 기본 설정
 */
const VIRTUAL_LIST_CONFIG = {
  DEFAULT_ITEM_SIZE: 100,           // 기본 항목 높이
  OVERSCAN_COUNT: 3,                // 미리 렌더링할 항목 수
} as const;

export interface VirtualListProps<T> {
  /**
   * 렌더링할 데이터 배열
   */
  items: T[];

  /**
   * 각 항목을 렌더링하는 컴포넌트
   */
  renderItem: (item: T, index: number) => React.ReactNode;

  /**
   * 각 항목의 높이 (픽셀)
   * [HARD-CODE-EXCEPTION: react-window 라이브러리 요구값]
   */
  itemSize?: number;

  /**
   * 리스트 높이 (픽셀)
   * 지정하지 않으면 AutoSizer가 자동으로 계산
   * [HARD-CODE-EXCEPTION: react-window 라이브러리 요구값]
   */
  height?: number;

  /**
   * 미리 렌더링할 항목 수
   * 스크롤 시 깜빡임 방지
   */
  overscanCount?: number;

  /**
   * 빈 리스트 메시지
   */
  emptyMessage?: string;
}

/**
 * Virtual List 컴포넌트
 *
 * @example
 * ```tsx
 * <VirtualList
 *   items={students}
 *   renderItem={(student) => <StudentCard student={student} />}
 *   itemSize={120}
 * />
 * ```
 */
export function VirtualList<T>({
  items,
  renderItem,
  itemSize = VIRTUAL_LIST_CONFIG.DEFAULT_ITEM_SIZE,
  height,
  overscanCount = VIRTUAL_LIST_CONFIG.OVERSCAN_COUNT,
  emptyMessage = '데이터가 없습니다.',
}: VirtualListProps<T>) {
  // 빈 리스트 처리
  if (items.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: 'var(--spacing-xl)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  // 렌더 함수 타입 정의 (react-window 호환)
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      {renderItem(items[index], index)}
    </div>
  );

  // 높이가 지정된 경우
  if (height) {
    // react-window FixedSizeList 컴포넌트의 children prop 타입 호환성을 위한 타입 캐스팅
    const ListAny = FixedSizeList as any;
    return (
      <ListAny
        height={height}
        itemCount={items.length}
        itemSize={itemSize}
        width="100%"
        overscanCount={overscanCount}
      >
        {Row}
      </ListAny>
    );
  }

  // AutoSizer를 사용한 자동 높이 계산
  // react-window FixedSizeList 컴포넌트의 children prop 타입 호환성을 위한 타입 캐스팅
  const ListAny = FixedSizeList as any;
  return (
    <AutoSizer>
      {({ height: autoHeight, width }: { height: number; width: number }) => (
        <ListAny
          height={autoHeight}
          width={width}
          itemCount={items.length}
          itemSize={itemSize}
          overscanCount={overscanCount}
        >
          {Row}
        </ListAny>
      )}
    </AutoSizer>
  );
}
