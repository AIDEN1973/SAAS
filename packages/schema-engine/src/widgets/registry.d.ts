/**
 * Custom Widget Registry
 *
 * SDUI v1.1: Custom Widget 컴포넌트를 등록하고 로드하는 레지스트리
 *
 * 기술문서: SDUI 기술문서 v1.1 - 22. 확장 전략
 */
import React from 'react';
export type WidgetLoader = () => Promise<React.ComponentType<Record<string, unknown>>>;
export interface WidgetRegistry {
    [componentType: string]: WidgetLoader;
}
/**
 * Widget Registry에 Custom Widget 등록
 *
 * @param componentType - 컴포넌트 타입 (예: 'CreditCardInput')
 * @param loader - 동적 로더 함수
 */
export declare function registerWidget(componentType: string, loader: WidgetLoader): void;
/**
 * Widget Registry에서 Custom Widget 로드
 *
 * SDUI v1.1: Widget Not Found 처리 강화
 *
 * @param componentType - 컴포넌트 타입
 * @returns 로드된 컴포넌트 (실패 시 null)
 */
export declare function loadWidget(componentType: string): Promise<React.ComponentType<Record<string, unknown>> | null>;
/**
 * Widget Registry 초기화
 *
 * 업종별 위젯을 등록합니다.
 *
 * @param widgets - 위젯 맵
 */
export declare function initializeWidgetRegistry(widgets: WidgetRegistry): void;
/**
 * 등록된 Widget 목록 조회
 */
export declare function getRegisteredWidgets(): string[];
//# sourceMappingURL=registry.d.ts.map