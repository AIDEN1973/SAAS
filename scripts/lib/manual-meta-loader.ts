/**
 * 매뉴얼 메타데이터 로더 (SSOT 유틸리티)
 *
 * 모든 매뉴얼 관련 스크립트에서 공용으로 사용합니다.
 * data/manuals/index.ts의 manualPageMeta를 동적으로 파싱합니다.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface ManualPageMeta {
  routes: string[];
  sourceFiles: string[];
  koreanName: string;
  icon: string;
}

// 캐시된 메타데이터
let cachedMeta: Record<string, ManualPageMeta> | null = null;

/**
 * manualPageMeta를 파싱하여 반환합니다.
 *
 * @param academyAdminDir apps/academy-admin/src 경로
 * @returns 매뉴얼 ID별 메타데이터
 */
export function loadManualPageMeta(academyAdminDir: string): Record<string, ManualPageMeta> {
  // 캐시 반환
  if (cachedMeta) {
    return cachedMeta;
  }

  const indexPath = join(academyAdminDir, 'data/manuals/index.ts');
  if (!existsSync(indexPath)) {
    throw new Error(`매뉴얼 인덱스 파일을 찾을 수 없습니다: ${indexPath}`);
  }

  const content = readFileSync(indexPath, 'utf-8');

  // manualPageMeta 전체 블록 추출
  const metaStart = content.indexOf('export const manualPageMeta');
  if (metaStart === -1) {
    throw new Error('manualPageMeta를 찾을 수 없습니다.');
  }

  // = 기호 다음의 { 찾기 (Record<string, {...}>의 {가 아닌 실제 객체 시작)
  const equalSign = content.indexOf('=', metaStart);
  if (equalSign === -1) {
    throw new Error('manualPageMeta 할당 연산자를 찾을 수 없습니다.');
  }

  const startBrace = content.indexOf('{', equalSign);
  if (startBrace === -1) {
    throw new Error('manualPageMeta 시작 중괄호를 찾을 수 없습니다.');
  }

  // 중첩된 중괄호를 고려하여 블록 끝 찾기
  let braceCount = 0;
  let blockEnd = -1;

  for (let i = startBrace; i < content.length; i++) {
    if (content[i] === '{') {
      braceCount++;
    } else if (content[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        blockEnd = i;
        break;
      }
    }
  }

  if (blockEnd === -1) {
    throw new Error('manualPageMeta 블록 끝을 찾을 수 없습니다.');
  }

  const metaBlock = content.substring(startBrace, blockEnd + 1);
  const result: Record<string, ManualPageMeta> = {};

  // 각 최상위 엔트리 추출 (id: { ... } 패턴)
  // 최상위 레벨의 키만 추출 (중첩 객체 내부 키는 무시)
  let depth = 0;
  let currentKey = '';
  let entryStart = -1;

  for (let i = 1; i < metaBlock.length - 1; i++) {
    const char = metaBlock[i];

    if (char === '{') {
      if (depth === 0) {
        // 최상위 엔트리 시작
        // 이전 문자열에서 키 추출
        const beforeBrace = metaBlock.substring(entryStart === -1 ? 1 : entryStart, i);
        const keyMatch = beforeBrace.match(/(\w+)\s*:\s*$/);
        if (keyMatch) {
          currentKey = keyMatch[1];
          entryStart = i;
        }
      }
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && currentKey && entryStart !== -1) {
        // 최상위 엔트리 종료
        const entryContent = metaBlock.substring(entryStart, i + 1);

        // routes 배열 추출
        const routesMatch = entryContent.match(/routes:\s*\[([\s\S]*?)\]/);
        const routes = routesMatch
          ? Array.from(routesMatch[1].matchAll(/['"]([^'"]*)['"]/g), m => m[1])
          : [];

        // sourceFiles 배열 추출
        const filesMatch = entryContent.match(/sourceFiles:\s*\[([\s\S]*?)\]/);
        const sourceFiles = filesMatch
          ? Array.from(filesMatch[1].matchAll(/['"]([^'"]*)['"]/g), m => m[1])
          : [];

        // koreanName 추출
        const nameMatch = entryContent.match(/koreanName:\s*['"]([^'"]+)['"]/);
        const koreanName = nameMatch ? nameMatch[1] : currentKey;

        // icon 추출
        const iconMatch = entryContent.match(/icon:\s*['"]([^'"]+)['"]/);
        const icon = iconMatch ? iconMatch[1] : 'FileText';

        result[currentKey] = { routes, sourceFiles, koreanName, icon };

        // 다음 엔트리를 위해 리셋
        entryStart = i + 1;
        currentKey = '';
      }
    }
  }

  // 캐시에 저장
  cachedMeta = result;

  return result;
}

/**
 * 캐시 초기화 (테스트용)
 */
export function clearCache(): void {
  cachedMeta = null;
}
