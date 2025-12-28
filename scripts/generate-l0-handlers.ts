// LAYER: BUILD_SCRIPT
/**
 * L0 Intent 핸들러 자동 생성 스크립트
 *
 * Registry에서 L0 Intent 목록을 추출하여 핸들러 스켈레톤 코드를 생성합니다.
 * 생성된 코드는 수동으로 완성해야 합니다.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface IntentRegistryItem {
  intent_key: string;
  description: string;
  automation_level: 'L0' | 'L1' | 'L2';
  paramsSchema: any;
  responseSchema?: any;
}

function extractL0Intents(registryPath: string): IntentRegistryItem[] {
  const content = readFileSync(registryPath, 'utf-8');
  const intents: IntentRegistryItem[] = [];

  // 간단한 파싱 (실제로는 AST 파서 사용 권장)
  const intentMatches = content.matchAll(/['"]([^'"]+\.query\.|['"][^'"]+\.draft\.|['"][^'"]+\.preview\.|['"][^'"]+\.summarize\.|['"][^'"]+\.generate\.|['"][^'"]+\.export\.)[^'"]+['"]:\s*\{/g);

  // 실제 구현은 Registry 파일을 직접 파싱하거나
  // packages/chatops-intents에서 export된 함수 사용
  return intents;
}

function generateHandlerCode(intent: IntentRegistryItem): string {
  const handlerName = intent.intent_key.replace(/\./g, '').replace(/([A-Z])/g, '$1').replace(/^[a-z]/, (c) => c.toUpperCase()) + 'Handler';
  const intentKey = intent.intent_key;

  return `
/**
 * ${intent.description}
 * Intent: ${intentKey}
 */
export const ${handlerName}: L0IntentHandler = {
  intent_key: '${intentKey}',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;

      // TODO: 파라미터 추출 및 검증
      // TODO: 데이터 조회 로직 구현
      // TODO: responseSchema에 맞춰 응답 형식 변환

      return {
        success: true,
        data: {
          // TODO: responseSchema에 맞춰 데이터 구성
        },
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[${handlerName}] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};
`;
}

// 스크립트 실행
const registryPath = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');
const outputPath = join(process.cwd(), 'infra/supabase/functions/_shared/l0-handlers-generated.ts');

console.log('L0 Intent 핸들러 생성 스크립트');
console.log('Registry 경로:', registryPath);
console.log('출력 경로:', outputPath);

// TODO: 실제 구현

