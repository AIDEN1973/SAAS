// 🔧 FIX: P0-RES - name→id 해소에서 동명이인(ambiguous) 구조 지원
// ⚠️ 주의: 아래는 "추가/확장" 중심 패치다. 기존 normalizeParams 로직은 유지하고,
//         name 기반 해소가 있는 지점에만 ambiguous/fail 구조를 통일해서 붙인다.
// LAYER: EDGE_FUNCTION_SHARED
/**
 * 파라미터 정규화 (범용)
 *
 * AI가 추출한 파라미터를 Handler가 기대하는 형식으로 변환합니다.
 * - name → student_id (학생 이름으로 조회)
 * - class_name → class_id (수업 이름으로 조회)
 * - 기타 일반적인 변환 규칙 적용
 *
 * 이 함수는 모든 Intent에 일관되게 적용되며, 케이스별 로직을 피합니다.
 */

import { withTenant } from './withTenant.ts';
import { toKSTDate } from './date-utils.ts';
import { maskPII } from './pii-utils.ts';
import { getTenantTableName } from './industry-adapter.ts';
import type { IntentRegistryItem } from './intent-parser.ts';
import { INVALID_NAME_KEYWORDS, containsInvalidKeyword } from './keyword-filter.ts';
import { intentRegistry } from './intent-registry.ts';

/**
 * 🔧 FIX: P0-1 - Legacy Resolver Allowlist (opt-in 정책)
 * meta가 없는 legacy Intent 중 정말 resolver가 필요한 경우만 추가
 * 원칙: meta를 붙일 수 있으면 meta로 해결, allowlist는 최소화
 */
const legacyResolverAllowList = new Set<string>([
  // 초기에는 빈 Set. 운영 중 문제가 발생하는 legacy intent만 추가
]);

export type ResolveFailed = {
  field: string;
  original_value: string;
  reason: string;
};

export type ResolveAmbiguousCandidate = {
  id: string;
  display?: string;
};

export type ResolveAmbiguous = {
  field: string;
  original_value: string;
  reason: string;
  candidates: ResolveAmbiguousCandidate[];
};

/** 파라미터에 resolve 결과를 주입하기 위한 확장 타입 */
interface ResolveExtendedParams extends Record<string, unknown> {
  _resolve_failed?: ResolveFailed;
  _resolve_ambiguous?: ResolveAmbiguous;
}

/** 사람(persons) 테이블 조회 결과 행 */
interface PersonRow {
  id: string;
  name: string;
  phone: string | null;
}

/** Supabase 쿼리 에러 타입 */
interface SupabaseQueryError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

function isUuid(s: unknown): boolean {
  if (typeof s !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/**
 * 🔧 FIX: P0-RES - 공통 실패 구조 주입
 * 🔧 FIX: P0-6 - 충돌 정책: ambiguous > failed (사용자 선택 가능하면 우선)
 */
function attachResolveFailed(params: ResolveExtendedParams, failed: ResolveFailed) {
  // ambiguous가 이미 있으면 failed는 덮어쓰지 않음 (우선순위: ambiguous > failed)
  if (params._resolve_ambiguous) {
    return;
  }
  params._resolve_failed = failed;
  delete params._resolve_ambiguous;
}

/**
 * 🔧 FIX: P0-RES - 공통 ambiguous 구조 주입
 */
function attachResolveAmbiguous(params: ResolveExtendedParams, amb: ResolveAmbiguous) {
  params._resolve_ambiguous = amb;
  delete params._resolve_failed;
}

/**
 * 🔧 FIX: P0-3 - 조회 전략 공통 함수 (중복 제거)
 * 각 단계에서 결과가 0이면 다음 단계, 1이면 즉시 확정, 2+이면 many로 반환
 */
async function queryPersonsByName(
  supabase: any,
  tenantId: string,
  pattern: string,
  mode: 'eq' | 'ilike' | 'ilike_contains'
): Promise<{ data: PersonRow[] | null; error: SupabaseQueryError | null }> {
  let query = supabase
    .from('persons')
    .select('id, name, phone')
    .eq('tenant_id', tenantId)
    .eq('person_type', 'student');

  if (mode === 'eq') {
    query = query.eq('name', pattern);
  } else if (mode === 'ilike') {
    query = query.ilike('name', pattern);
  } else {
    query = query.ilike('name', `%${pattern}%`);
  }

  const result = await query.limit(20);
  return { data: result.data, error: result.error };
}

/**
 * 🔧 FIX: P0-3 - name → student_id 해소 (조회 전략 순서 고정)
 * - 0건: _resolve_failed
 * - 1건: student_id 확정
 * - 2건+: _resolve_ambiguous (선택 질문 유도용)
 *
 * 조회 전략 (순서 고정):
 * 1) eq('name', trimmed) - 정확 일치
 * 2) ilike('name', trimmed) - 대소문자 무시 일치
 * 3) ilike('name', normalizedName) - 공백 제거 일치
 * 4) ilike('name', `%${trimmed}%`) - 포함 검색
 * 5) ilike('name', `%${normalizedName}%`) - 공백 제거 포함 검색
 */
async function resolveStudentIdByName(
  supabase: any,
  tenantId: string,
  name: string,
  maxCandidates: number = 5
): Promise<
  | { kind: 'not_found' }
  | { kind: 'one'; id: string }
  | { kind: 'many'; candidates: ResolveAmbiguousCandidate[] }
> {
  const trimmed = String(name || '').trim();
  if (!trimmed) return { kind: 'not_found' };

  // 정규화: 연속 공백 제거, "박 소 영" → "박소영"
  const normalizedName = trimmed.replace(/\s+/g, '');

  // 🔧 FIX: P0-5 - Core Party SSOT: persons는 Core Party 단일 테이블
  // Industry Adapter 사용하지 않음 (persons는 업종과 무관한 Core Party)

  // 조회 전략 순서 고정: 각 단계에서 결과가 0이면 다음 단계, 1이면 즉시 확정, 2+이면 many로 반환
  const strategies: Array<{ pattern: string; mode: 'eq' | 'ilike' | 'ilike_contains' }> = [
    { pattern: trimmed, mode: 'eq' }, // 1) 정확 일치
    { pattern: trimmed, mode: 'ilike' }, // 2) 대소문자 무시 일치
  ];

  // normalizedName이 다를 때만 공백 제거 전략 추가
  if (normalizedName !== trimmed) {
    strategies.push(
      { pattern: normalizedName, mode: 'ilike' }, // 3) 공백 제거 일치
      { pattern: trimmed, mode: 'ilike_contains' }, // 4) 포함 검색
      { pattern: normalizedName, mode: 'ilike_contains' } // 5) 공백 제거 포함 검색
    );
  } else {
    strategies.push({ pattern: trimmed, mode: 'ilike_contains' }); // 4) 포함 검색
  }

  let data: PersonRow[] | null = null;
  let error: SupabaseQueryError | null = null;

  for (const strategy of strategies) {
    const result = await queryPersonsByName(supabase, tenantId, strategy.pattern, strategy.mode);
    if (result.error) {
      error = result.error;
      continue;
    }
    if (result.data && result.data.length > 0) {
      data = result.data;
      error = null;
      break; // 결과가 있으면 즉시 중단
    }
  }

  if (error || !data || data.length === 0) return { kind: 'not_found' };
  if (data.length === 1) return { kind: 'one', id: data[0].id };

  // 🔧 FIX: P0-4 - maxCandidates meta 실제 적용
  // 🔧 FIX: P0-GATE - 후보 힌트 생성 (PII 최소화: 전화번호 끝 4자리)
  const candidates: ResolveAmbiguousCandidate[] = data.slice(0, maxCandidates).map((r: PersonRow) => {
    const phoneHint = r.phone && typeof r.phone === 'string' && r.phone.length >= 4
      ? `전화끝4자리: ${r.phone.slice(-4)}`
      : '';
    return {
      id: r.id,
      display: phoneHint ? `${r.name} (${phoneHint})` : String(r.name),
    };
  });
  return { kind: 'many', candidates };
}

export async function normalizeParams(
  params: Record<string, unknown>,
  intentKey: string,
  supabase: any,
  tenantId: string
): Promise<Record<string, unknown>> {
  const normalized = { ...params };

  // 🔧 FIX: P0-GATE - Intent Registry에서 resolver 메타 조회
  const intent = intentRegistry[intentKey] as IntentRegistryItem | undefined;
  const resolverMeta = intent?.resolver;
  const ambiguityMeta = intent?.ambiguity;
  const maxCandidates = ambiguityMeta?.max_candidates || 5;

  // student_id가 없거나 UUID 형식이 아닌 경우: name으로 student_id 조회
  // ⚠️ P0: AI가 student_id에 이름을 넣는 경우 방지
  // 🔧 FIX: P0-GATE - meta 기반 해소 (resolver.kind === 'student'인 경우)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const hasValidStudentId = normalized.student_id && typeof normalized.student_id === 'string' && uuidRegex.test(normalized.student_id);

  // 🔧 FIX: P0-1 - Fail-Closed opt-in 정책: meta가 없으면 resolver 실행 금지
  // legacy allowlist에 있는 경우만 예외 허용 (최소화)
  const shouldResolveStudent = resolverMeta
    ? (resolverMeta.kind === 'student' && resolverMeta.required.includes('student_id'))
    : legacyResolverAllowList.has(intentKey); // meta가 없으면 allowlist에만 허용

  // 🔧 FIX: P0-1 - 로그: meta 없는 intent에서 resolver 미실행 확인용
  if (!hasValidStudentId && !shouldResolveStudent) {
    console.log('[ChatOps:Normalize] Resolver 스킵 (meta 없음, allowlist 없음):', {
      intent_key: intentKey,
      has_resolver_meta: !!resolverMeta,
      in_allowlist: legacyResolverAllowList.has(intentKey),
    });
  }

  // student_id가 없거나 유효하지 않은 경우, name으로 변환 시도
  // 🔧 FIX: P0-RES - ambiguous 구조 사용
  // 🔧 FIX: P0-GATE - meta 기반 해소 (shouldResolveStudent가 true인 경우에만)
  const p = normalized as ResolveExtendedParams;
  if (!hasValidStudentId && shouldResolveStudent) {
    // name이 있으면 name 사용, 없으면 student_id를 name으로 간주 (AI가 잘못 넣은 경우)
    const studentName = (normalized.name && typeof normalized.name === 'string')
      ? normalized.name.trim()
      : (normalized.student_id && typeof normalized.student_id === 'string' && !uuidRegex.test(normalized.student_id))
        ? normalized.student_id.trim() // student_id에 이름이 들어간 경우
        : null;

    // 🔧 FIX: P0-PARAM - 키워드 필터링 (업종 중립)
    // 🔧 FIX: P1-ARCH-1 - invalidKeywords SSOT 단일화 (keyword-filter.ts에서 import)
    if (studentName && typeof studentName === 'string' && studentName.trim() && !isUuid(normalized.student_id)) {
      // 키워드 체크 (SSOT 사용)
      const isKeyword = containsInvalidKeyword(studentName);
      if (isKeyword) {
        console.log('[ChatOps:Normalize] Resolver 스킵 (키워드 감지):', {
          student_name: maskPII(studentName),
          reason: 'contains_keyword',
        });
        attachResolveFailed(p, {
          field: 'student_id',
          original_value: String(studentName),
          reason: 'invalid_name_format',
        });
        // 잘못된 student_id 값 제거
        if (normalized.student_id === studentName) {
          delete normalized.student_id;
        }
        return normalized;
      }

      const r = await resolveStudentIdByName(supabase, tenantId, studentName, maxCandidates);
      if (r.kind === 'not_found') {
        attachResolveFailed(p, {
          field: 'student_id',
          original_value: String(studentName),
          reason: 'not_found_by_name',
        });
        // 잘못된 student_id 값 제거
        if (normalized.student_id === studentName) {
          delete normalized.student_id;
        }
      } else if (r.kind === 'many') {
        attachResolveAmbiguous(p, {
          field: 'student_id',
          original_value: String(studentName),
          reason: 'multiple_matches',
          candidates: r.candidates,
        });
        // 잘못된 student_id 값 제거
        if (normalized.student_id === studentName) {
          delete normalized.student_id;
        }
      } else {
        // one - 정상 해소
        normalized.student_id = r.id;
        console.log('[ChatOps:Normalize] name → student_id 변환 성공:', {
          name: maskPII(studentName),
          student_id: r.id.substring(0, 8) + '...',
        });
      }
    }
  }

  // class_name → class_id 변환
  if (normalized.class_name && typeof normalized.class_name === 'string' && !normalized.class_id) {
    try {
      const className = normalized.class_name.trim();
      // ⚠️ 중요: Industry Adapter 사용 (업종 중립성)
      const classTableName = await getTenantTableName(supabase, tenantId, 'class');
      if (classTableName) {
        const { data: classes, error: classError } = await withTenant(
          supabase
            .from(classTableName)
            .select('id, name')
            .eq('name', className)
            .limit(1),
          tenantId
        );

        if (!classError && classes && classes.length > 0) {
          normalized.class_id = classes[0].id;
          console.log('[ChatOps:Normalize] class_name → class_id 변환 성공:', {
            class_name: maskPII(className),
            class_id: classes[0].id.substring(0, 8) + '...',
          });
        } else {
          console.log('[ChatOps:Normalize] class_name → class_id 변환 실패:', {
            class_name: maskPII(className),
            error: classError ? maskPII(classError) : '수업을 찾을 수 없음',
          });
          // 🔧 FIX: P0-6 - attachResolveFailed() 사용 (직접 대입 금지)
          attachResolveFailed(p, {
            field: 'class_id',
            original_value: className,
            reason: classError ? '수업을 찾을 수 없습니다' : '수업을 찾을 수 없음',
          });
        }
      }
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[ChatOps:Normalize] class_name → class_id 변환 중 오류:', maskedError);
    }
  }

  // 날짜 형식 정규화 (YYYY-MM-DD)
  // ⚠️ P1: 날짜 처리 - toKSTDate() 사용 (체크리스트 준수)
  // ChatOps_계약_붕괴_방지_체계_분석.md 3.1 참조: 자연어 상대시간 서버 측 재확인
  if (normalized.date && typeof normalized.date === 'string') {
    // "오늘", "어제", "내일" 같은 상대시간 표현 처리 (서버에서 KST 기준으로 재확인)
    const relativeTimeMap: Record<string, string> = {
      '오늘': toKSTDate(new Date()),
      '어제': toKSTDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      '내일': toKSTDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      'today': toKSTDate(new Date()),
      'yesterday': toKSTDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      'tomorrow': toKSTDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    };

    const lowerDate = normalized.date.toLowerCase().trim();
    if (relativeTimeMap[lowerDate]) {
      normalized.date = relativeTimeMap[lowerDate];
      console.log('[ChatOps:Normalize] 상대시간 표현 변환:', {
        original: normalized.date,
        normalized: relativeTimeMap[lowerDate],
      });
    }

    // 이미 YYYY-MM-DD 형식인지 확인
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (normalized.date && typeof normalized.date === 'string' && !dateRegex.test(normalized.date)) {
      try {
        const date = new Date(normalized.date as string);
        if (!isNaN(date.getTime())) {
          // ⚠️ P1: toISOString().split('T')[0] 직접 사용 금지, toKSTDate() 사용
          normalized.date = toKSTDate(date);
          console.log('[ChatOps:Normalize] 날짜 형식 정규화:', {
            original: normalized.date,
            normalized: normalized.date,
          });
        }
      } catch (error) {
        // 날짜 파싱 실패는 무시
      }
    }
  }

  return normalized;
}

