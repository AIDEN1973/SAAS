/**
 * SSOT 파일 동기화 검증 스크립트
 *
 * 이 스크립트는 다음 SSOT 파일들의 동기화 상태를 검증합니다:
 * 1. automation-event-catalog.ts (3개 파일, re-export 포함)
 * 2. env-registry.ts (Edge Function 래퍼와 packages/env-registry 스키마 일치성)
 * 3. 문서와 코드 간 일치성 (문서에 명시된 파일 경로 존재 여부)
 *
 * 사용법:
 * ```bash
 * pnpm tsx scripts/verify-ssot-sync.ts
 * ```
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  success: boolean;
  errors: string[];
}

/**
 * automation-event-catalog.ts 파일 동기화 검증
 */
function validateAutomationEventCatalogSync(): ValidationResult {
  const errors: string[] = [];
  const catalogFiles = [
    'packages/core/core-automation/src/automation-event-catalog.ts',
    'infra/supabase/functions/_shared/automation-event-catalog.ts',
    'infra/supabase/supabase/functions/_shared/automation-event-catalog.ts',
  ];

  // 정본 파일에서 AUTOMATION_EVENT_CATALOG 추출
  const mainFile = readFileSync(
    join(process.cwd(), catalogFiles[0]),
    'utf-8'
  );
  const mainMatch = mainFile.match(/export const AUTOMATION_EVENT_CATALOG = \[([\s\S]*?)\];/);
  if (!mainMatch) {
    errors.push(`[Catalog Sync] Failed to extract AUTOMATION_EVENT_CATALOG from ${catalogFiles[0]}`);
    return { success: false, errors };
  }

  const mainCatalog = mainMatch[1]
    .split(',')
    .map((s) => s.trim().replace(/['"]/g, ''))
    .filter((s) => s && !s.startsWith('//'))
    .sort();

  // 다른 파일들과 비교
  for (let i = 1; i < catalogFiles.length; i++) {
    const filePath = catalogFiles[i];
    try {
      const fileContent = readFileSync(join(process.cwd(), filePath), 'utf-8');

      // re-export인 경우 스킵 (infra/supabase/supabase/functions/_shared/automation-event-catalog.ts)
      if (fileContent.includes('from \'../../functions/_shared/automation-event-catalog.ts\'')) {
        continue;
      }

      const match = fileContent.match(/export const AUTOMATION_EVENT_CATALOG = \[([\s\S]*?)\];/);
      if (!match) {
        errors.push(`[Catalog Sync] Failed to extract AUTOMATION_EVENT_CATALOG from ${filePath}`);
        continue;
      }

      const catalog = match[1]
        .split(',')
        .map((s) => s.trim().replace(/['"]/g, ''))
        .filter((s) => s && !s.startsWith('//'))
        .sort();

      if (catalog.length !== mainCatalog.length) {
        errors.push(
          `[Catalog Sync] Length mismatch: ${catalogFiles[0]} has ${mainCatalog.length} items, ` +
          `${filePath} has ${catalog.length} items`
        );
      }

      const mainSet = new Set(mainCatalog);
      const otherSet = new Set(catalog);

      for (const item of mainCatalog) {
        if (!otherSet.has(item)) {
          errors.push(`[Catalog Sync] Missing item in ${filePath}: "${item}"`);
        }
      }

      for (const item of catalog) {
        if (!mainSet.has(item)) {
          errors.push(`[Catalog Sync] Extra item in ${filePath}: "${item}"`);
        }
      }
    } catch (err) {
      errors.push(`[Catalog Sync] Failed to read ${filePath}: ${err}`);
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * 문서-코드 일치성 검증
 *
 * 문서에 명시된 파일 경로가 실제로 존재하는지 확인
 */
function validateDocumentCodeConsistency(): ValidationResult {
  const errors: string[] = [];
  const { readFileSync, existsSync } = require('fs');
  const { join } = require('path');

  // 문서에서 언급된 파일 경로들
  const documentedPaths = [
    'packages/core/core-automation/src/automation-event-catalog.ts',
    'infra/supabase/functions/_shared/automation-event-catalog.ts',
    'infra/supabase/supabase/functions/_shared/automation-event-catalog.ts',
    'apps/academy-admin/src/utils/policy-registry.ts',
    'apps/academy-admin/src/utils/policy-utils.ts',
    'packages/shared-catalog.ts',
    'infra/supabase/functions/_shared/env-registry.ts',
    'infra/supabase/supabase/functions/_shared/env-registry.ts',
    'packages/env-registry/src/schema.ts',
  ];

  for (const filePath of documentedPaths) {
    const fullPath = join(process.cwd(), filePath);
    if (!existsSync(fullPath)) {
      errors.push(`[Document-Code] Documented file does not exist: ${filePath}`);
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * env-registry 스키마 동기화 검증
 *
 * Edge Function env-registry와 packages/env-registry 스키마 일치성 확인
 */
function validateEnvRegistrySync(): ValidationResult {
  const errors: string[] = [];
  const { readFileSync } = require('fs');
  const { join } = require('path');

  try {
    // packages/env-registry/src/schema.ts에서 필드 추출
    const schemaFile = readFileSync(
      join(process.cwd(), 'packages/env-registry/src/schema.ts'),
      'utf-8'
    );

    // envServerSchema 필드 추출 (정확한 파싱)
    // ⚠️ 중요: z.object({ ... }) 내부의 필드만 추출하고, 주석과 다른 z. 사용은 제외합니다.
    const schemaFields: string[] = [];

    // z.object({ ... }) 블록 찾기
    const objectMatch = schemaFile.match(/export const envServerSchema = z\.object\(\{([\s\S]*?)\}\);/);
    if (!objectMatch) {
      errors.push('[Env Registry Sync] Failed to find envServerSchema in schema.ts');
      return { success: false, errors };
    }

    const objectContent = objectMatch[1];
    const lines = objectContent.split('\n');

    for (const line of lines) {
      // 주석 라인 제외
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) {
        continue;
      }

      // 필드명: z. 패턴 매칭 (더 정확한 정규식)
      // 예: SUPABASE_URL: z.string().url(),
      // 예: SERVICE_ROLE_KEY: z.string().min(1),  // 주석
      const fieldMatch = trimmedLine.match(/^([A-Z_][A-Z0-9_]*)\s*:\s*z\./);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        // envServerSchema 내부 필드만 추출 (envClientSchema, envCommonSchema 제외)
        if (fieldName && !schemaFields.includes(fieldName)) {
          schemaFields.push(fieldName);
        }
      }
    }

    // Edge Function env-registry.ts에서 getter 추출
    const edgeRegistryFile = readFileSync(
      join(process.cwd(), 'infra/supabase/functions/_shared/env-registry.ts'),
      'utf-8'
    );

    const getterMatches = edgeRegistryFile.matchAll(/get\s+(\w+)\(\):/g);
    const edgeGetters: string[] = [];
    for (const match of getterMatches) {
      edgeGetters.push(match[1]);
    }

    // 필드 비교 (대소문자 무시)
    const schemaFieldsUpper = new Set(schemaFields.map(f => f.toUpperCase()));
    const edgeGettersUpper = new Set(edgeGetters.map(g => g.toUpperCase()));

    for (const field of schemaFields) {
      if (!edgeGettersUpper.has(field.toUpperCase())) {
        errors.push(
          `[Env Registry Sync] Missing field in Edge Function envServer: "${field}"`
        );
      }
    }

    for (const getter of edgeGetters) {
      if (!schemaFieldsUpper.has(getter.toUpperCase())) {
        errors.push(
          `[Env Registry Sync] Extra field in Edge Function envServer (not in schema): "${getter}"`
        );
      }
    }
  } catch (err) {
    errors.push(`[Env Registry Sync] Failed to validate: ${err}`);
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * 메인 검증 함수
 */
function main() {
  console.log('🔍 SSOT 파일 동기화 검증 시작...\n');

  const catalogResult = validateAutomationEventCatalogSync();
  const documentResult = validateDocumentCodeConsistency();
  const envRegistryResult = validateEnvRegistrySync();

  const allErrors = [...catalogResult.errors, ...documentResult.errors, ...envRegistryResult.errors];
  const success = catalogResult.success && documentResult.success && envRegistryResult.success;

  if (success) {
    console.log('✅ 모든 SSOT 파일이 동기화되어 있습니다.');
    process.exit(0);
  } else {
    console.error('❌ SSOT 파일 동기화 검증 실패:\n');
    allErrors.forEach((error) => {
      console.error(`  - ${error}`);
    });
    console.error(`\n총 ${allErrors.length}개의 오류가 발견되었습니다.`);
    process.exit(1);
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  main();
}

export { validateAutomationEventCatalogSync, validateDocumentCodeConsistency, validateEnvRegistrySync };

