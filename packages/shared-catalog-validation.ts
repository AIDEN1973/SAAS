/**
 * Shared Catalog 자동 검증 함수 (SSOT)
 *
 * Shared Catalog에 등록된 항목만 사용하도록 강제하는 검증 함수
 * 개발 환경에서만 실행하여 프로덕션 성능 영향 최소화
 *
 * @see packages/shared-catalog.ts
 * @see docu/체크리스트.md (P1-ARCH-3)
 */

import { sharedCatalog, type CatalogItem } from './shared-catalog';

/**
 * 개발 환경 여부 확인
 */
function isDevelopment(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.env &&
    process.env.NODE_ENV === 'development'
  );
}

/**
 * 경고 메시지 출력
 */
function warn(message: string): void {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(`[Shared Catalog Validation] ${message}`);
  }
}

/**
 * 에러 메시지 출력
 */
function error(message: string): void {
  if (typeof console !== 'undefined' && console.error) {
    console.error(`[Shared Catalog Validation] ${message}`);
  }
}

/**
 * Hook 등록 확인
 *
 * 개발 환경에서만 실행되며, 등록되지 않은 Hook 사용 시 경고 출력
 *
 * @param hookKey - Hook 키 (예: 'use-industry-terms')
 * @throws 등록되지 않은 Hook인 경우 에러 (Fail-Closed)
 *
 * @example
 * ```typescript
 * // 개발 환경에서만 검증
 * if (process.env.NODE_ENV === 'development') {
 *   assertRegisteredHook('use-industry-terms');
 * }
 * ```
 */
export function assertRegisteredHook(hookKey: string): void {
  if (!isDevelopment()) {
    return; // 프로덕션에서는 스킵
  }

  if (!sharedCatalog.hooks[hookKey]) {
    error(
      `등록되지 않은 Hook 사용: "${hookKey}"\n` +
      `  - Shared Catalog에 등록되지 않은 Hook입니다.\n` +
      `  - packages/shared-catalog.ts에 Hook을 등록하거나,\n` +
      `  - 기존 등록된 Hook을 사용하세요.\n` +
      `  - 등록된 Hook 목록: ${Object.keys(sharedCatalog.hooks).join(', ')}`
    );
    throw new Error(`Unregistered hook: ${hookKey}`);
  }
}

/**
 * Feature 등록 확인
 *
 * @param featureKey - Feature 키
 * @throws 등록되지 않은 Feature인 경우 에러 (Fail-Closed)
 */
export function assertRegisteredFeature(featureKey: string): void {
  if (!isDevelopment()) {
    return;
  }

  if (!sharedCatalog.features[featureKey]) {
    error(
      `등록되지 않은 Feature 사용: "${featureKey}"\n` +
      `  - Shared Catalog에 등록되지 않은 Feature입니다.\n` +
      `  - packages/shared-catalog.ts에 Feature를 등록하거나,\n` +
      `  - 기존 등록된 Feature를 사용하세요.\n` +
      `  - 등록된 Feature 목록: ${Object.keys(sharedCatalog.features).join(', ')}`
    );
    throw new Error(`Unregistered feature: ${featureKey}`);
  }
}

/**
 * Adapter 등록 확인
 *
 * @param adapterKey - Adapter 키
 * @throws 등록되지 않은 Adapter인 경우 에러 (Fail-Closed)
 */
export function assertRegisteredAdapter(adapterKey: string): void {
  if (!isDevelopment()) {
    return;
  }

  if (!sharedCatalog.adapters[adapterKey]) {
    error(
      `등록되지 않은 Adapter 사용: "${adapterKey}"\n` +
      `  - Shared Catalog에 등록되지 않은 Adapter입니다.\n` +
      `  - packages/shared-catalog.ts에 Adapter를 등록하거나,\n` +
      `  - 기존 등록된 Adapter를 사용하세요.\n` +
      `  - 등록된 Adapter 목록: ${Object.keys(sharedCatalog.adapters).join(', ')}`
    );
    throw new Error(`Unregistered adapter: ${adapterKey}`);
  }
}

/**
 * Component 등록 확인
 *
 * @param componentKey - Component 키
 * @throws 등록되지 않은 Component인 경우 에러 (Fail-Closed)
 */
export function assertRegisteredComponent(componentKey: string): void {
  if (!isDevelopment()) {
    return;
  }

  if (!sharedCatalog.components[componentKey]) {
    error(
      `등록되지 않은 Component 사용: "${componentKey}"\n` +
      `  - Shared Catalog에 등록되지 않은 Component입니다.\n` +
      `  - packages/shared-catalog.ts에 Component를 등록하거나,\n` +
      `  - 기존 등록된 Component를 사용하세요.\n` +
      `  - 등록된 Component 목록: ${Object.keys(sharedCatalog.components).join(', ')}`
    );
    throw new Error(`Unregistered component: ${componentKey}`);
  }
}

/**
 * 카탈로그 항목 가져오기 (타입 안전)
 *
 * @param category - 카테고리 ('hooks' | 'features' | 'adapters' | 'components')
 * @param key - 항목 키
 * @returns 카탈로그 항목 또는 undefined
 */
export function getCatalogItem(
  category: 'hooks' | 'features' | 'adapters' | 'components',
  key: string
): CatalogItem | undefined {
  return sharedCatalog[category][key];
}

/**
 * 카탈로그 항목 검색
 *
 * useWhen 또는 path로 항목 검색
 *
 * @param searchTerm - 검색어
 * @returns 일치하는 카탈로그 항목 목록
 */
export function searchCatalog(searchTerm: string): Array<{
  category: 'hooks' | 'features' | 'adapters' | 'components';
  key: string;
  item: CatalogItem;
}> {
  const results: Array<{
    category: 'hooks' | 'features' | 'adapters' | 'components';
    key: string;
    item: CatalogItem;
  }> = [];

  const categories = ['hooks', 'features', 'adapters', 'components'] as const;

  for (const category of categories) {
    const items = sharedCatalog[category];
    for (const [key, item] of Object.entries(items)) {
      if (
        key.includes(searchTerm) ||
        item.path.includes(searchTerm) ||
        item.useWhen.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        results.push({ category, key, item });
      }
    }
  }

  return results;
}

/**
 * Shared Catalog 전체 검증
 *
 * related 필드 참조 검증, 중복 path 검증 등
 *
 * @returns 검증 결과 { valid: boolean, errors: string[] }
 */
export function validateSharedCatalog(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. related 필드 참조 검증
  const categories = ['hooks', 'features', 'adapters', 'components'] as const;

  for (const category of categories) {
    const items = sharedCatalog[category];
    for (const [key, item] of Object.entries(items)) {
      if (item.related) {
        if (item.related.hook && !sharedCatalog.hooks[item.related.hook]) {
          errors.push(
            `${category}/${key}: related.hook "${item.related.hook}" not found in catalog`
          );
        }
        if (item.related.feature && !sharedCatalog.features[item.related.feature]) {
          errors.push(
            `${category}/${key}: related.feature "${item.related.feature}" not found in catalog`
          );
        }
        if (item.related.adapter && !sharedCatalog.adapters[item.related.adapter]) {
          errors.push(
            `${category}/${key}: related.adapter "${item.related.adapter}" not found in catalog`
          );
        }
      }
    }
  }

  // 2. 중복 path 검증
  const pathMap = new Map<string, { category: string; key: string }>();

  for (const category of categories) {
    const items = sharedCatalog[category];
    for (const [key, item] of Object.entries(items)) {
      const existing = pathMap.get(item.path);
      if (existing) {
        errors.push(
          `Duplicate path "${item.path}" in ${category}/${key} and ${existing.category}/${existing.key}`
        );
      } else {
        pathMap.set(item.path, { category, key });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 카탈로그 통계
 *
 * @returns 카탈로그 항목 수 통계
 */
export function getCatalogStats(): {
  hooks: number;
  features: number;
  adapters: number;
  components: number;
  total: number;
} {
  return {
    hooks: Object.keys(sharedCatalog.hooks).length,
    features: Object.keys(sharedCatalog.features).length,
    adapters: Object.keys(sharedCatalog.adapters).length,
    components: Object.keys(sharedCatalog.components).length,
    total:
      Object.keys(sharedCatalog.hooks).length +
      Object.keys(sharedCatalog.features).length +
      Object.keys(sharedCatalog.adapters).length +
      Object.keys(sharedCatalog.components).length,
  };
}

/**
 * 카탈로그 전체 목록 출력 (디버깅용)
 */
export function printCatalog(): void {
  if (!isDevelopment()) {
    return;
  }

  console.log('\n========================================');
  console.log('  Shared Catalog');
  console.log('========================================\n');

  const stats = getCatalogStats();
  console.log(`Total: ${stats.total} items`);
  console.log(`  Hooks: ${stats.hooks}`);
  console.log(`  Features: ${stats.features}`);
  console.log(`  Adapters: ${stats.adapters}`);
  console.log(`  Components: ${stats.components}\n`);

  console.log('--- Hooks ---');
  Object.keys(sharedCatalog.hooks).forEach((key) => {
    console.log(`  - ${key}`);
  });

  console.log('\n--- Features ---');
  Object.keys(sharedCatalog.features).forEach((key) => {
    console.log(`  - ${key}`);
  });

  console.log('\n--- Adapters ---');
  Object.keys(sharedCatalog.adapters).forEach((key) => {
    console.log(`  - ${key}`);
  });

  console.log('\n--- Components ---');
  Object.keys(sharedCatalog.components).forEach((key) => {
    console.log(`  - ${key}`);
  });

  console.log('\n========================================\n');
}
