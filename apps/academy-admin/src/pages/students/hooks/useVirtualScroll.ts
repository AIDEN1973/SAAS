/**
 * Virtual Scroll Hook
 *
 * 대량 데이터 렌더링 성능 최적화
 * [성능] 화면에 보이는 항목만 렌더링
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, import/no-unresolved */
import { useRef, useMemo } from 'react';
// @ts-expect-error - @tanstack/react-virtual module not available in type-check environment
import { useVirtualizer } from '@tanstack/react-virtual';

export interface UseVirtualScrollOptions {
  /**
   * 전체 아이템 수
   */
  count: number;
  /**
   * 각 아이템의 예상 높이 (픽셀)
   */
  estimateSize?: number;
  /**
   * 오버스캔 아이템 수 (스크롤 시 미리 렌더링할 항목 수)
   */
  overscan?: number;
}

/**
 * 가상 스크롤 Hook
 *
 * @example
 * const virtualizer = useVirtualScroll({
 *   count: tags.length,
 *   estimateSize: 35,
 *   overscan: 5,
 * });
 *
 * <div ref={virtualizer.parentRef} style={{ height: '400px', overflow: 'auto' }}>
 *   <div style={{ height: virtualizer.totalSize, position: 'relative' }}>
 *     {virtualizer.virtualItems.map(virtualItem => (
 *       <div
 *         key={virtualItem.index}
 *         style={{
 *           position: 'absolute',
 *           top: 0,
 *           left: 0,
 *           transform: `translateY(${virtualItem.start}px)`,
 *         }}
 *       >
 *         {items[virtualItem.index]}
 *       </div>
 *     ))}
 *   </div>
 * </div>
 */
export function useVirtualScroll(options: UseVirtualScrollOptions) {
  const { count, estimateSize = 35, overscan = 5 } = options;

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  return useMemo(
    () => ({
      parentRef,
      virtualizer,
      virtualItems: virtualizer.getVirtualItems(),
      totalSize: virtualizer.getTotalSize(),
    }),
    [virtualizer, parentRef]
  );
}
