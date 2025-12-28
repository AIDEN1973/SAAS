/**
 * Intent Parser for Edge Functions
 *
 * 챗봇.md 참조
 * 목적: ChatGPT 응답에서 Intent 정보를 추출하고 검증
 *
 * [불변 규칙] Intent Registry와의 일관성 검증 필수
 * [불변 규칙] params 기본 타입 검증 필수 (Zod 스키마 검증은 서버 측에서 수행)
 * [불변 규칙] automation_level과 execution_class 관계 검증 필수
 * [불변 규칙] 파싱 실패는 치명적 오류가 아니므로 로그만 남기고 계속 진행
 *
 * 주의: Edge Function은 Deno 환경이므로, Intent Registry는 별도로 import해야 합니다.
 * 이 파일은 parser 로직만 제공하며, registry는 외부에서 주입받습니다.
 */

/**
 * 파싱된 Intent 정보
 */
export interface ParsedIntent {
  intent_key: string;
  automation_level: 'L0' | 'L1' | 'L2';
  execution_class?: 'A' | 'B'; // L2일 때만 존재
  params: Record<string, unknown>;
}

/**
 * Intent 파싱 결과
 */
export interface ParseIntentResult {
  success: boolean;
  intent?: ParsedIntent;
  error?: {
    code: ParseErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * 파싱 에러 코드
 */
export enum ParseErrorCode {
  NO_JSON_FOUND = 'NO_JSON_FOUND',
  INVALID_JSON = 'INVALID_JSON',
  MISSING_FIELDS = 'MISSING_FIELDS',
  INVALID_AUTOMATION_LEVEL = 'INVALID_AUTOMATION_LEVEL',
  INTENT_NOT_FOUND = 'INTENT_NOT_FOUND',
  INVALID_EXECUTION_CLASS = 'INVALID_EXECUTION_CLASS',
  INVALID_PARAMS = 'INVALID_PARAMS',
  SCHEMA_VALIDATION_FAILED = 'SCHEMA_VALIDATION_FAILED',
}

/**
 * Intent Registry Item (간소화된 버전, Edge Function용)
 *
 * [SSOT] 이 타입은 packages/chatops-intents/src/registry.ts의 IntentRegistryItem에서
 * 파생된 간소화된 버전입니다. SSOT는 packages/chatops-intents/src/registry.ts입니다.
 *
 * Edge Function은 Deno 환경이므로 npm 패키지를 직접 import하기 어려워
 * 간소화된 타입을 사용합니다. 새로운 필드를 추가할 때는 SSOT와의 호환성을 유지해야 합니다.
 */
export interface IntentRegistryItem {
  intent_key: string;
  automation_level: 'L0' | 'L1' | 'L2';
  execution_class?: 'A' | 'B'; // L2일 때만 존재
  description?: string; // Intent 설명 (후보 추출용)
  examples?: string[]; // 발화 예시 (후보 추출용, 우선순위 높음)
  // params 스키마 검증은 Edge Function에서 zod를 사용하기 어려우므로,
  // 기본적인 타입 검증만 수행
  // 실제 스키마 검증은 서버 측에서 수행
}

/**
 * 파서 성능 및 보안 제한 상수
 *
 * [SSOT] 이 상수는 packages/chatops-intents/src/parser.ts의 PARSER_LIMITS와
 * 동일한 값을 유지해야 합니다. 환경 차이로 인한 필수 중복입니다.
 *
 * 기술적 제한값: 비즈니스 로직이 아닌 성능/보안을 위한 기술적 제한값
 * Automation Config와는 무관한 파서 내부 제한값
 */
const PARSER_LIMITS = {
  /** 최대 텍스트 길이 (50MB) - 매우 긴 텍스트 처리 방지 */
  MAX_TEXT_LENGTH: 50 * 1024 * 1024,
  /** 최대 JSON 문자열 길이 (10MB) - JSON 파싱 시 메모리 보호 */
  MAX_JSON_STRING_LENGTH: 10 * 1024 * 1024,
  /** 최대 스캔 길이 (1MB) - 중괄호 매칭 시 스캔 범위 제한 */
  MAX_SCAN_LENGTH: 1024 * 1024,
  /** 최대 마크다운 코드 블록 수 (100개) - 정규식 성능 보호 */
  MAX_MARKDOWN_BLOCKS: 100,
  /** 최대 intent_key 패턴 매칭 수 (1000개) - 정규식 성능 보호 */
  MAX_INTENT_KEY_MATCHES: 1000,
  /** 최대 JSON 블록 시도 수 (10개) - 무한 루프 방지 */
  MAX_JSON_BLOCKS_TO_TRY: 10,
  /** 최대 중괄호 깊이 (1000) - 매우 깊은 중첩 방지 */
  MAX_BRACE_DEPTH: 1000,
  /** 최대 intent_key 위치 찾기 수 (100개) - removeIntentJsonFromResponse 성능 보호 */
  MAX_INTENT_KEY_POSITIONS: 100,
  /** 최대 에러 상세 정보 수 (5개) - 로그 성능 보호 */
  MAX_ERROR_DETAILS: 5,
} as const;

/**
 * JSON 블록 추출 옵션
 */
interface ExtractJsonOptions {
  /**
   * 마크다운 코드 블록에서도 JSON 추출 시도
   * @default true
   */
  allowMarkdownCodeBlock?: boolean;
  /**
   * 여러 JSON 블록이 있을 때 모두 시도
   * @default true
   */
  tryMultipleBlocks?: boolean;
}

/**
 * ChatGPT 응답에서 JSON 블록 추출
 *
 * 지원 형식:
 * 1. 일반 JSON 블록: { "intent_key": "...", ... }
 * 2. 마크다운 코드 블록: ```json\n{ "intent_key": "...", ... }\n```
 * 3. 여러 JSON 블록이 있을 경우 모두 시도
 *
 * @param text ChatGPT 응답 텍스트
 * @param options 추출 옵션
 * @returns 추출된 JSON 문자열 배열 (실패 시 빈 배열)
 */
function extractJsonBlocks(
  text: string,
  options: ExtractJsonOptions = {}
): string[] {
  const { allowMarkdownCodeBlock = true, tryMultipleBlocks = true } = options;
  //  성능 최적화: 최대 텍스트 길이 제한
  if (text.length > PARSER_LIMITS.MAX_TEXT_LENGTH) {
    return [];
  }
  const jsonBlocks: string[] = [];
  //  중복 방지: 이미 추출한 JSON 블록의 위치를 추적
  const extractedRanges: Array<{ start: number; end: number }> = [];

  // 1. 마크다운 코드 블록에서 JSON 추출 (```json ... ```)
  if (allowMarkdownCodeBlock) {
    const markdownJsonRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g;
    //  중요: 정규식의 lastIndex를 리셋하여 무한 루프 방지
    markdownJsonRegex.lastIndex = 0;
    let match;
    //  성능 최적화: 최대 마크다운 코드 블록 수 제한
    let markdownMatchCount = 0;
    const maxMarkdownMatches = PARSER_LIMITS.MAX_MARKDOWN_BLOCKS;
    while ((match = markdownJsonRegex.exec(text)) !== null && markdownMatchCount < maxMarkdownMatches) {
      markdownMatchCount++;
      const jsonContent = match[1].trim();
      //  개선: 빈 문자열 및 빈 JSON 객체 체크
      if (jsonContent.length === 0 || jsonContent === '{}') {
        continue;
      }
      //  개선: intent_key 포함 여부와 함께 기본 JSON 구조 검증
      if (jsonContent.startsWith('{') && jsonContent.includes('intent_key')) {
        // 중괄호 매칭 확인 (불완전한 JSON 방지)
        const openBraces = (jsonContent.match(/{/g) || []).length;
        const closeBraces = (jsonContent.match(/}/g) || []).length;
        if (openBraces === closeBraces && openBraces > 0) {
          //  개선: 공백 정규화를 통한 중복 제거
          const normalizedContent = jsonContent.replace(/\s+/g, ' ');
          const isDuplicate = jsonBlocks.some((block) => block.replace(/\s+/g, ' ') === normalizedContent);
          if (!isDuplicate) {
            jsonBlocks.push(jsonContent);
            // 마크다운 코드 블록의 위치도 추적 (일반 JSON 블록과 중복 방지)
            //  타입 안정성: match.index는 null이 아닐 때 항상 number이지만, 명시적으로 체크
            const blockStart = match.index ?? 0;
            const blockEnd = blockStart + (match[0]?.length ?? 0);
            extractedRanges.push({ start: blockStart, end: blockEnd });
          }
        }
      }
    }
  }

  // 2. 일반 JSON 블록 추출 (중첩된 JSON도 처리)
  //  개선: 중괄호 매칭을 통한 완전한 JSON 블록 추출
  // intent_key가 포함된 모든 위치를 찾고, 각 위치에서 시작하는 완전한 JSON 객체를 추출
  const intentKeyPattern = /"intent_key"\s*:/g;
  //  중요: 정규식의 lastIndex를 리셋하여 무한 루프 방지
  intentKeyPattern.lastIndex = 0;
  let match;
    //  성능 최적화: 최대 intent_key 패턴 매칭 수 제한
    let intentKeyMatchCount = 0;
    const maxIntentKeyMatches = PARSER_LIMITS.MAX_INTENT_KEY_MATCHES;
  while ((match = intentKeyPattern.exec(text)) !== null && intentKeyMatchCount < maxIntentKeyMatches) {
    intentKeyMatchCount++;
    //  타입 안정성: match.index는 null이 아닐 때 항상 number이지만, 명시적으로 체크
    const startPos = match.index ?? -1;
    if (startPos < 0) {
      continue;
    }

    // intent_key 앞에서 가장 가까운 { 찾기
    //  수정: braceStart === 0일 때도 체크하도록 조건 변경
    let braceStart = startPos;
    while (braceStart >= 0 && text[braceStart] !== '{') {
      braceStart--;
    }

    if (braceStart < 0 || text[braceStart] !== '{') {
      continue; // 시작 중괄호를 찾지 못함
    }

    // 중괄호 매칭을 통해 완전한 JSON 객체 추출
    let braceCount = 0;
    let braceEnd = braceStart;
    let inString = false;
    let escapeNext = false;
    //  성능 최적화: 최대 스캔 길이 제한
    const maxScanLength = Math.min(braceStart + PARSER_LIMITS.MAX_SCAN_LENGTH, text.length);
    //  안전장치: 최대 중괄호 깊이 제한
    const maxBraceDepth = PARSER_LIMITS.MAX_BRACE_DEPTH;

    for (let i = braceStart; i < maxScanLength; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === '{') {
        braceCount++;
        //  안전장치: 최대 중괄호 깊이 초과 시 중단
        if (braceCount > maxBraceDepth) {
          break;
        }
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          braceEnd = i;
          break;
        }
        //  안전장치: 중괄호 카운트가 음수가 되면 잘못된 JSON
        if (braceCount < 0) {
          break;
        }
      }
    }

    //  개선: 중괄호 매칭이 완료되지 않았으면 건너뛰기
    if (braceCount !== 0) {
      continue;
    }

    if (braceEnd > braceStart) {
      //  개선: 이미 추출한 범위와 겹치는지 확인 (중복 방지)
      const isOverlapping = extractedRanges.some(
        (range) => !(braceEnd < range.start || braceStart > range.end)
      );
      if (isOverlapping) {
        continue; // 이미 추출한 범위와 겹치면 건너뛰기
      }

      const jsonContent = text.substring(braceStart, braceEnd + 1).trim();
      //  개선: 빈 JSON 객체 체크 (intent_key가 없으면 건너뛰기)
      if (jsonContent.length === 0 || jsonContent === '{}') {
        continue;
      }
      //  개선: 공백 정규화를 통한 중복 제거 (공백 차이로 인한 중복 방지)
      const normalizedContent = jsonContent.replace(/\s+/g, ' ');
      const isDuplicate = jsonBlocks.some((block) => block.replace(/\s+/g, ' ') === normalizedContent);
      if (!isDuplicate) {
        jsonBlocks.push(jsonContent);
        extractedRanges.push({ start: braceStart, end: braceEnd + 1 });
      }
    }
  }

  // 3. 여러 JSON 블록이 있을 때 모두 시도하지 않는 경우, 첫 번째만 반환
  if (!tryMultipleBlocks && jsonBlocks.length > 0) {
    return [jsonBlocks[0]];
  }

  return jsonBlocks;
}

/**
 * JSON 문자열을 파싱하고 기본 구조 검증
 *
 * @param jsonString JSON 문자열
 * @returns 파싱된 객체 또는 null
 */
function parseJsonSafely(jsonString: string): Record<string, unknown> | null {
  try {
    //  성능 최적화: 최대 JSON 문자열 길이 제한
    if (jsonString.length > PARSER_LIMITS.MAX_JSON_STRING_LENGTH) {
      return null;
    }
    const parsed = JSON.parse(jsonString);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    //  개선: 에러 정보를 로깅하지 않음 (PII 보호 및 성능)
    return null;
  }
}

/**
 * automation_level과 execution_class 관계 검증
 *
 * @param automation_level automation_level 값
 * @param execution_class execution_class 값 (선택)
 * @returns 검증 성공 여부
 */
function validateAutomationLevelAndExecutionClass(
  automation_level: unknown,
  execution_class: unknown
): boolean {
  // automation_level 검증
  if (automation_level !== 'L0' && automation_level !== 'L1' && automation_level !== 'L2') {
    return false;
  }

  // L2일 때 execution_class 필수
  if (automation_level === 'L2') {
    if (execution_class !== 'A' && execution_class !== 'B') {
      return false;
    }
  }

  // L0/L1일 때 execution_class는 존재하면 안 됨
  if (automation_level === 'L0' || automation_level === 'L1') {
    if (execution_class !== undefined && execution_class !== null) {
      return false;
    }
  }

  return true;
}

/**
 * ChatGPT 응답에서 Intent 정보 추출 및 검증
 *
 * @param aiResponse ChatGPT 응답 텍스트
 * @param registry Intent Registry (intent_key로 조회 가능한 Map 또는 Record)
 * @param options 파싱 옵션
 * @returns 파싱 결과
 */
export function parseIntentFromResponse(
  aiResponse: string,
  registry: Record<string, IntentRegistryItem> | Map<string, IntentRegistryItem>,
  options: ExtractJsonOptions = {}
): ParseIntentResult {
  if (!aiResponse || typeof aiResponse !== 'string' || aiResponse.trim().length === 0) {
    return {
      success: false,
      error: {
        code: ParseErrorCode.NO_JSON_FOUND,
        message: 'AI 응답이 비어있습니다.',
      },
    };
  }

  // JSON 블록 추출
  const jsonBlocks = extractJsonBlocks(aiResponse, options);

  if (jsonBlocks.length === 0) {
    return {
      success: false,
      error: {
        code: ParseErrorCode.NO_JSON_FOUND,
        message: 'AI 응답에서 JSON 블록을 찾을 수 없습니다.',
      },
    };
  }

  // 여러 JSON 블록이 있을 경우 모두 시도
  //  성능 최적화: 최대 JSON 블록 시도 수 제한
  const maxBlocks = PARSER_LIMITS.MAX_JSON_BLOCKS_TO_TRY;
  const blocksToTry = jsonBlocks.slice(0, maxBlocks);
  const errors: Array<{ code: ParseErrorCode; message: string; details?: unknown }> = [];

  for (const jsonBlock of blocksToTry) {
    // JSON 파싱
    const parsed = parseJsonSafely(jsonBlock);
    if (!parsed) {
      errors.push({
        code: ParseErrorCode.INVALID_JSON,
        message: 'JSON 파싱에 실패했습니다.',
        details: { jsonBlock: jsonBlock.substring(0, 200) }, // PII 보호를 위해 일부만
      });
      continue;
    }

    // 필수 필드 검증
    if (!parsed.intent_key || typeof parsed.intent_key !== 'string') {
      errors.push({
        code: ParseErrorCode.MISSING_FIELDS,
        message: 'intent_key가 없거나 유효하지 않습니다.',
      });
      continue;
    }

    if (!parsed.automation_level) {
      errors.push({
        code: ParseErrorCode.MISSING_FIELDS,
        message: 'automation_level이 없습니다.',
      });
      continue;
    }

    // automation_level과 execution_class 관계 검증
    if (
      !validateAutomationLevelAndExecutionClass(
        parsed.automation_level,
        parsed.execution_class
      )
    ) {
      errors.push({
        code: ParseErrorCode.INVALID_EXECUTION_CLASS,
        message: `automation_level과 execution_class 관계가 유효하지 않습니다. (automation_level: ${parsed.automation_level}, execution_class: ${parsed.execution_class})`,
      });
      continue;
    }

    // Intent Registry에서 Intent 존재 확인
    const intentKey = parsed.intent_key as string;
    let intent: IntentRegistryItem | undefined;

    if (registry instanceof Map) {
      intent = registry.get(intentKey);
    } else {
      intent = registry[intentKey];
    }

    if (!intent) {
      errors.push({
        code: ParseErrorCode.INTENT_NOT_FOUND,
        message: `Intent가 Registry에 등록되어 있지 않습니다: ${intentKey}`,
      });
      continue;
    }

    // automation_level 일치 검증
    if (intent.automation_level !== parsed.automation_level) {
      errors.push({
        code: ParseErrorCode.INVALID_AUTOMATION_LEVEL,
        message: `Registry의 automation_level(${intent.automation_level})과 파싱된 automation_level(${parsed.automation_level})이 일치하지 않습니다.`,
      });
      continue;
    }

    // L2일 때 execution_class 검증 강화
    if (intent.automation_level === 'L2') {
      //  개선: execution_class가 없으면 에러 (L2는 필수)
      if (!parsed.execution_class) {
        errors.push({
          code: ParseErrorCode.INVALID_EXECUTION_CLASS,
          message: 'L2 Intent는 execution_class가 필수입니다.',
        });
        continue;
      }
      // execution_class 일치 검증
      if (intent.execution_class !== parsed.execution_class) {
        errors.push({
          code: ParseErrorCode.INVALID_EXECUTION_CLASS,
          message: `Registry의 execution_class(${intent.execution_class})과 파싱된 execution_class(${parsed.execution_class})이 일치하지 않습니다.`,
        });
        continue;
      }
    }

    // params 추출 및 기본 검증
    const params = parsed.params || {};
    if (typeof params !== 'object' || params === null || Array.isArray(params)) {
      errors.push({
        code: ParseErrorCode.INVALID_PARAMS,
        message: 'params가 유효한 객체가 아닙니다.',
      });
      continue;
    }

    //  주의: Edge Function에서는 Zod 스키마 검증을 수행하기 어려우므로,
    // 기본적인 타입 검증만 수행합니다.
    // 실제 스키마 검증은 서버 측(Planner 등)에서 수행해야 합니다.

    // 모든 검증 통과 - 성공
    const parsedIntent: ParsedIntent = {
      intent_key: parsed.intent_key,
      automation_level: parsed.automation_level as 'L0' | 'L1' | 'L2',
      ...(intent.automation_level === 'L2' && {
        execution_class: parsed.execution_class as 'A' | 'B',
      }),
      params: params as Record<string, unknown>,
    };

    return {
      success: true,
      intent: parsedIntent,
    };
  }

  // 모든 JSON 블록 시도 실패
  return {
    success: false,
    error: {
      code: errors[0]?.code || ParseErrorCode.INVALID_JSON,
      message: `모든 JSON 블록 파싱 실패. 첫 번째 오류: ${errors[0]?.message || '알 수 없는 오류'}`,
      details: {
        totalBlocks: jsonBlocks.length,
        triedBlocks: blocksToTry.length,
        errors: errors.slice(0, PARSER_LIMITS.MAX_ERROR_DETAILS).map((e) => ({ code: e.code, message: e.message })),
      },
    },
  };
}

/**
 * ChatGPT 응답에서 Intent JSON 블록 제거 (사용자에게는 자연어 응답만 표시)
 *
 * @param aiResponse ChatGPT 응답 텍스트
 * @returns Intent JSON 블록이 제거된 깨끗한 응답
 */
export function removeIntentJsonFromResponse(aiResponse: string): string {
  if (!aiResponse || typeof aiResponse !== 'string') {
    return aiResponse;
  }

  //  성능 최적화: 최대 텍스트 길이 제한
  if (aiResponse.length > PARSER_LIMITS.MAX_TEXT_LENGTH) {
    return aiResponse;
  }

  let cleanResponse = aiResponse;

  // 1. 마크다운 코드 블록에서 JSON 제거 (```json ... ```)
  cleanResponse = cleanResponse.replace(/```(?:json)?\s*\n?([\s\S]*?)\n?```/g, (match, content) => {
    const trimmedContent = content.trim();
    // intent_key가 포함된 JSON 블록만 제거
    if (trimmedContent.startsWith('{') && trimmedContent.includes('intent_key')) {
      return '';
    }
    return match; // 다른 코드 블록은 유지
  });

  // 2. 일반 JSON 블록 제거 (중괄호 매칭을 통한 완전한 JSON 객체 제거)
  // intent_key가 포함된 모든 JSON 객체를 찾아 제거
  const intentKeyPattern = /"intent_key"\s*:/g;
  //  중요: 정규식의 lastIndex를 리셋하여 무한 루프 방지
  intentKeyPattern.lastIndex = 0;
  const matches: Array<{ start: number; end: number }> = [];
  let match;
    //  성능 최적화: 최대 intent_key 위치 찾기 수 제한
    let matchCount = 0;
    const maxMatches = PARSER_LIMITS.MAX_INTENT_KEY_POSITIONS;

  // 모든 intent_key 위치 찾기
  while ((match = intentKeyPattern.exec(cleanResponse)) !== null && matchCount < maxMatches) {
    matchCount++;
    //  타입 안정성: match.index는 null이 아닐 때 항상 number이지만, 명시적으로 체크
    const startPos = match.index ?? -1;
    if (startPos < 0) {
      continue;
    }

    // intent_key 앞에서 가장 가까운 { 찾기
    //  수정: braceStart === 0일 때도 체크하도록 조건 변경
    let braceStart = startPos;
    while (braceStart >= 0 && cleanResponse[braceStart] !== '{') {
      braceStart--;
    }

    if (braceStart < 0 || cleanResponse[braceStart] !== '{') {
      continue;
    }

    // 중괄호 매칭을 통해 완전한 JSON 객체 찾기
    let braceCount = 0;
    let braceEnd = braceStart;
    let inString = false;
    let escapeNext = false;
    //  성능 최적화: 최대 스캔 길이 제한
    const maxScanLength = Math.min(braceStart + PARSER_LIMITS.MAX_SCAN_LENGTH, cleanResponse.length);
    //  안전장치: 최대 중괄호 깊이 제한
    const maxBraceDepth = PARSER_LIMITS.MAX_BRACE_DEPTH;

    for (let i = braceStart; i < maxScanLength; i++) {
      const char = cleanResponse[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === '{') {
        braceCount++;
        //  안전장치: 최대 중괄호 깊이 초과 시 중단
        if (braceCount > maxBraceDepth) {
          break;
        }
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          braceEnd = i;
          break;
        }
        //  안전장치: 중괄호 카운트가 음수가 되면 잘못된 JSON
        if (braceCount < 0) {
          break;
        }
      }
    }

    //  개선: 중괄호 매칭이 완료되지 않았으면 건너뛰기
    if (braceCount !== 0) {
      continue;
    }

    if (braceEnd > braceStart) {
      //  개선: 중복 범위 제거 (겹치는 범위는 하나만 유지)
      const isOverlapping = matches.some(
        (m) => !(braceEnd < m.start || braceStart > m.end)
      );
      if (!isOverlapping) {
        matches.push({ start: braceStart, end: braceEnd + 1 });
      }
    }
  }

  //  개선: 범위를 정렬하고 겹치는 범위 병합
  matches.sort((a, b) => a.start - b.start);
  const mergedMatches: Array<{ start: number; end: number }> = [];
  for (const match of matches) {
    if (mergedMatches.length === 0) {
      mergedMatches.push(match);
    } else {
      const last = mergedMatches[mergedMatches.length - 1];
      if (match.start <= last.end) {
        // 겹치는 경우 병합
        last.end = Math.max(last.end, match.end);
      } else {
        mergedMatches.push(match);
      }
    }
  }

  // 뒤에서부터 제거 (인덱스 변경 방지)
  for (let i = mergedMatches.length - 1; i >= 0; i--) {
    const { start, end } = mergedMatches[i];
    cleanResponse = cleanResponse.substring(0, start) + cleanResponse.substring(end);
  }

  // 3. 연속된 공백 정리
  cleanResponse = cleanResponse.replace(/\n{3,}/g, '\n\n').trim();

  return cleanResponse;
}
