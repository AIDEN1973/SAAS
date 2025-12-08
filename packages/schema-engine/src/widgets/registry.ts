/**
 * Custom Widget Registry
 *
 * SDUI v1.1: Custom Widget 컴포넌트를 등록하고 로드하는 레지스트리
 *
 * 기술문서: SDUI 기술문서 v1.1 - 22. 확장 전략
 */

import React from 'react';

export type WidgetLoader = () => Promise<React.ComponentType<any>>;

export interface WidgetRegistry {
  [componentType: string]: WidgetLoader;
}

/**
 * Global Widget Registry
 *
 * 전역에서 Custom Widget을 등록할 수 있는 레지스트리
 */
const globalWidgetRegistry: WidgetRegistry = {};

/**
 * Widget Registry에 Custom Widget 등록
 *
 * @param componentType - 컴포넌트 타입 (예: 'CreditCardInput')
 * @param loader - 동적 로더 함수
 */
export function registerWidget(
  componentType: string,
  loader: WidgetLoader
): void {
  globalWidgetRegistry[componentType] = loader;
}

/**
 * Widget Registry에서 Custom Widget 로드
 *
 * SDUI v1.1: Widget Not Found 처리 강화
 *
 * @param componentType - 컴포넌트 타입
 * @returns 로드된 컴포넌트 (실패 시 null)
 */
export async function loadWidget(
  componentType: string
): Promise<React.ComponentType<any> | null> {
  const loader = globalWidgetRegistry[componentType];

  if (!loader) {
    const registeredWidgets = Object.keys(globalWidgetRegistry);
    console.error(
      `[Schema Engine] Widget "${componentType}" not found in registry. ` +
      `Registered widgets: ${registeredWidgets.length > 0 ? registeredWidgets.join(', ') : 'none'}. ` +
      `Please register the widget using registerWidget() or check the componentType.`
    );
    return null;
  }

  try {
    const module = await loader();
    // default export 또는 named export 처리
    const Component = (module as any).default || module;

    if (!Component) {
      console.error(`[Schema Engine] Widget "${componentType}" loaded but no component found in module.`);
      return null;
    }

    return Component;
  } catch (error) {
    console.error(`[Schema Engine] Failed to load widget "${componentType}":`, error);
    return null;
  }
}

/**
 * Widget Registry 초기화
 *
 * 업종별 위젯을 등록합니다.
 *
 * @param widgets - 위젯 맵
 */
export function initializeWidgetRegistry(widgets: WidgetRegistry): void {
  Object.keys(widgets).forEach((componentType) => {
    registerWidget(componentType, widgets[componentType]);
  });
}

/**
 * 등록된 Widget 목록 조회
 */
export function getRegisteredWidgets(): string[] {
  return Object.keys(globalWidgetRegistry);
}
