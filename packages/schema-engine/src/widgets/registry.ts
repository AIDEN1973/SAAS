/**
 * Custom Widget Registry
 * 
 * SDUI v1.1: Custom Widget ì»´í¬?ŒíŠ¸ë¥??±ë¡?˜ê³  ë¡œë“œ?˜ëŠ” ?ˆì??¤íŠ¸ë¦? * 
 * ê¸°ìˆ ë¬¸ì„œ: SDUI ê¸°ìˆ ë¬¸ì„œ v1.1 - 22. ?•ì¥ ?„ëµ
 */

import React from 'react';

export type WidgetLoader = () => Promise<React.ComponentType<any>>;

export interface WidgetRegistry {
  [componentType: string]: WidgetLoader;
}

/**
 * Global Widget Registry
 * 
 * ?±ì—??Custom Widget???±ë¡?????ˆëŠ” ?„ì—­ ?ˆì??¤íŠ¸ë¦? */
const globalWidgetRegistry: WidgetRegistry = {};

/**
 * Widget Registry??Custom Widget ?±ë¡
 * 
 * @param componentType - ì»´í¬?ŒíŠ¸ ?€??(?? 'CreditCardInput')
 * @param loader - ?™ì  ë¡œë” ?¨ìˆ˜
 */
export function registerWidget(
  componentType: string,
  loader: WidgetLoader
): void {
  globalWidgetRegistry[componentType] = loader;
}

/**
 * Widget Registry?ì„œ Custom Widget ë¡œë“œ
 * 
 * @param componentType - ì»´í¬?ŒíŠ¸ ?€?? * @returns ë¡œë“œ??ì»´í¬?ŒíŠ¸
 */
/**
 * Widget Registry?ì„œ Custom Widget ë¡œë“œ
 * 
 * SDUI v1.1: Widget Not Found ì²˜ë¦¬ ê°•í™”
 * 
 * @param componentType - ì»´í¬?ŒíŠ¸ ?€?? * @returns ë¡œë“œ??ì»´í¬?ŒíŠ¸ (?¤íŒ¨ ??null)
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
    // default export ?ëŠ” named export ì²˜ë¦¬
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
 * Widget Registry ì´ˆê¸°?? * 
 * ?…ì¢…ë³??„ì ¯???±ë¡?©ë‹ˆ??
 * 
 * @param widgets - ?„ì ¯ ë§? */
export function initializeWidgetRegistry(widgets: WidgetRegistry): void {
  Object.keys(widgets).forEach((componentType) => {
    registerWidget(componentType, widgets[componentType]);
  });
}

/**
 * ?±ë¡??Widget ëª©ë¡ ì¡°íšŒ
 */
export function getRegisteredWidgets(): string[] {
  return Object.keys(globalWidgetRegistry);
}

