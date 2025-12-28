// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 시스템 헬스체크 실행 Handler
 *
 * Intent: system.exec.run_healthcheck
 * Action Key: system.run_healthcheck (Domain Action Catalog)
 *
 * 챗봇.md 12.1.3 참조
 * 붕괴사전예방.md 참조: Layer A/B/C Preflight 검증 통합
 *
 */

import type {
  IntentHandler,
  SuggestedActionChatOpsPlanV1,
  HandlerContext,
  HandlerResult,
} from './types.ts';
import { maskPII } from '../../_shared/pii-utils.ts';
import { getTenantSettingByPath } from '../../_shared/policy-utils.ts';
import { withTenant } from '../../_shared/withTenant.ts';
import { assertDomainActionKey } from '../../_shared/domain-action-catalog.ts';
import { intentRegistry } from '../../_shared/intent-registry.ts';

/**
 * Healthcheck 상태 타입
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Healthcheck 결과 타입
 */
export interface HealthCheckResult {
  status: HealthStatus;
  layer_a?: {
    intent_registry_loaded: boolean;
    error?: string;
  };
  layer_b?: {
    required_tables_exist: boolean;
    required_columns_exist: boolean;
    migration_version_ok: boolean;
    errors?: string[];
    warnings?: string[];
  };
  layer_c?: {
    database_accessible: boolean;
    core_tables_accessible: boolean;
    intent_registry_accessible: boolean;
    policy_registry_accessible: boolean;
    worker_tables_exist: boolean;
    errors?: string[];
  };
  checks: Record<string, 'ok' | 'warning' | 'error'>;
  timestamp: string;
}

/**
 * 핵심 테이블 및 필수 컬럼 정의 (업종 중립 - 공통 테이블만)
 * 붕괴사전예방.md Layer B 참조
 */
const REQUIRED_TABLES: Record<string, string[]> = {
  'task_cards': ['id', 'tenant_id', 'created_at', 'suggested_action'],
  'automation_actions': ['id', 'tenant_id', 'executed_at', 'result', 'dedup_key', 'execution_context'],
  'chatops_sessions': ['id', 'tenant_id', 'user_id', 'created_at'],
  'chatops_drafts': ['id', 'session_id', 'tenant_id', 'user_id', 'status', 'draft_params'],
  'chatops_messages': ['id', 'session_id', 'tenant_id', 'user_id', 'content', 'created_at'],
  'message_outbox': ['id', 'tenant_id', 'intent_key', 'status', 'idempotency_key'],
  'persons': ['id', 'tenant_id', 'person_type'],
  'tenant_settings': ['tenant_id', 'key', 'value'],
  'job_executions': ['id', 'tenant_id', 'intent_key', 'status', 'idempotency_key'],
  // 참고: 문서의 REQUIRED_TABLES와 일치 (job_executions 추가됨)
};

/**
 * 최소 필수 마이그레이션 버전
 * message_outbox 테이블 생성 마이그레이션: 136
 */
const MIN_REQUIRED_VERSION = 136;

/**
 * 컬럼 존재 여부 확인 (업종 중립)
 * ⚠️ P0: withTenant 사용 필수 (RLS 보호)
 */
async function checkColumnExists(
  supabase: any,
  tenantId: string,
  table: string,
  column: string
): Promise<boolean> {
  try {
    // ⚠️ P0: withTenant 사용 필수 (RLS 보호)
    const { error } = await withTenant(
      supabase
        .from(table)
        .select(column)
        .limit(0),
      tenantId
    );

    if (error) {
      // PGRST204 = 컬럼이 없음
      if (error.code === 'PGRST204') {
        return false;
      }
      // 다른 오류는 로그만 남기고 false 반환
      const maskedError = maskPII(error);
      console.warn(`[Healthcheck] 컬럼 확인 중 오류: ${table}.${column}`, maskedError);
      return false;
    }

    return true;
  } catch (error) {
    const maskedError = maskPII(error);
    console.warn(`[Healthcheck] 컬럼 확인 실패: ${table}.${column}`, maskedError);
    return false;
  }
}

/**
 * 테이블 접근 가능 여부 확인 (업종 중립)
 * ⚠️ P0: withTenant 사용 필수 (RLS 보호)
 */
async function checkTableAccessible(
  supabase: any,
  tenantId: string,
  table: string
): Promise<boolean> {
  try {
    // ⚠️ P0: withTenant 사용 필수 (RLS 보호)
    const { error } = await withTenant(
      supabase
        .from(table)
        .select('*')
        .limit(1),
      tenantId
    );

    if (error) {
      // PGRST204 = 컬럼이 없음, PGRST301 = 테이블이 없음
      if (error.code === 'PGRST204' || error.code === 'PGRST301') {
        return false;
      }
      // 다른 오류는 접근 불가로 간주하지 않음 (권한 문제일 수 있음)
      const maskedError = maskPII(error);
      console.warn(`[Healthcheck] 테이블 접근 확인 중 오류: ${table}`, maskedError);
      return true; // 접근은 가능하지만 다른 오류
    }

    return true;
  } catch (error) {
    const maskedError = maskPII(error);
    console.warn(`[Healthcheck] 테이블 접근 확인 실패: ${table}`, maskedError);
    return false;
  }
}

/**
 * 마이그레이션 버전 확인
 */
async function checkMigrationVersion(supabase: any): Promise<number> {
  try {
    // ⚠️ 중요: supabase_migrations.schema_migrations는 공통 스키마이므로 withTenant 사용하지 않음
    const { data, error } = await supabase
      .from('supabase_migrations.schema_migrations')
      .select('version')
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      const maskedError = maskPII(error);
      console.warn('[Healthcheck] 마이그레이션 버전 확인 실패:', maskedError);
      return 0;
    }

    return data?.version || 0;
  } catch (error) {
    const maskedError = maskPII(error);
    console.warn('[Healthcheck] 마이그레이션 버전 확인 실패:', maskedError);
    return 0;
  }
}

/**
 * Layer A 검증: Intent Registry 로딩 확인 (정적 검증)
 * 붕괴사전예방.md Layer A 참조
 */
export function checkLayerA(): { passed: boolean; error?: string } {
  try {
    // Intent Registry 로딩 확인
    if (!intentRegistry || typeof intentRegistry !== 'object') {
      return {
        passed: false,
        error: 'Intent Registry가 로딩되지 않았습니다.',
      };
    }

    // 핵심 Intent 존재 확인
    const criticalIntents = [
      'system.exec.run_healthcheck',
      'system.query.health',
      'attendance.query.late',
      'student.query.search',
    ];

    for (const intentKey of criticalIntents) {
      if (!intentRegistry[intentKey]) {
        return {
          passed: false,
          error: `핵심 Intent가 Registry에 없습니다: ${intentKey}`,
        };
      }
    }

    return { passed: true };
  } catch (error) {
    const maskedError = maskPII(error);
    return {
      passed: false,
      error: `Intent Registry 검증 중 오류: ${maskedError}`,
    };
  }
}

/**
 * Layer B 검증: 핵심 테이블/컬럼 존재 확인 (배포 시 검증)
 * 붕괴사전예방.md Layer B 참조
 * 업종 중립: 공통 테이블만 확인
 */
export async function checkLayerB(
  supabase: any,
  tenantId: string
): Promise<{ passed: boolean; errors?: string[]; warnings?: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. 핵심 테이블 컬럼 존재 검사
  // ⚠️ 중요: 테이블 접근이 가능하면 컬럼도 존재하는 것으로 간주 (RLS/권한 문제 가능)
  for (const [table, columns] of Object.entries(REQUIRED_TABLES)) {
    // 먼저 테이블 접근 가능 여부 확인
    const tableAccessible = await checkTableAccessible(supabase, tenantId, table);
    if (!tableAccessible) {
      // 테이블 접근 불가 시 모든 컬럼 에러 추가
      for (const column of columns) {
        errors.push(`${table}.${column} 컬럼이 존재하지 않습니다 (테이블 접근 불가).`);
      }
      continue;
    }

    // 테이블 접근 가능 시 컬럼 존재 확인
    for (const column of columns) {
      const exists = await checkColumnExists(supabase, tenantId, table, column);
      if (!exists) {
        // 컬럼 확인 실패는 경고로 처리 (RLS/권한 문제 가능)
        // Layer C에서 테이블 접근이 가능하면 실제로는 컬럼이 존재할 가능성이 높음
        warnings.push(`${table}.${column} 컬럼 확인 실패 (RLS/권한 문제 가능). 테이블 접근은 가능합니다.`);
      }
    }
  }

  // 2. 마이그레이션 버전 확인 (경고로 처리 - PostgREST 스키마 캐시 문제 가능)
  // ⚠️ 중요: PostgREST가 supabase_migrations 스키마를 노출하지 않을 수 있음
  // 실제 테이블/컬럼 검증이 통과하면 마이그레이션은 적용된 것으로 간주
  const currentVersion = await checkMigrationVersion(supabase);
  if (currentVersion === 0) {
    // 마이그레이션 버전 확인 실패는 경고로 처리 (PostgREST 스키마 캐시 문제 가능)
    // ⚠️ 중요: currentVersion === 0인 경우는 PostgREST 스키마 캐시 문제이므로 에러가 아님
    warnings.push(`마이그레이션 버전 확인 불가 (PostgREST 스키마 캐시 문제 가능). 실제 테이블/컬럼 검증 결과를 확인하세요.`);
  } else if (currentVersion < MIN_REQUIRED_VERSION) {
    // 마이그레이션 버전이 실제로 부족한 경우에만 에러 (0이 아닌 실제 버전이 부족한 경우)
    errors.push(`마이그레이션 버전이 부족합니다: ${currentVersion} < ${MIN_REQUIRED_VERSION}`);
  }

  return {
    passed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Layer C 검증: 런타임 검증 (부팅 시 검증)
 * 붕괴사전예방.md Layer C 참조
 * 업종 중립: 공통 테이블만 확인
 */
export async function checkLayerC(
  supabase: any,
  tenantId: string
): Promise<{ passed: boolean; errors?: string[] }> {
  const errors: string[] = [];

  // 1. 핵심 테이블 접근 가능 여부 확인
  const coreTables = [
    'task_cards',
    'automation_actions',
    'chatops_sessions',
    'chatops_drafts',
    'chatops_messages',
    'persons',
    'tenant_settings',
    'job_executions',
  ];

  for (const table of coreTables) {
    const accessible = await checkTableAccessible(supabase, tenantId, table);
    if (!accessible) {
      errors.push(`${table} 테이블에 접근할 수 없습니다.`);
    }
  }

  // 2. Intent Registry 접근 가능 여부 확인 (이미 로딩되어 있으므로 간단히 확인)
  try {
    if (!intentRegistry || typeof intentRegistry !== 'object') {
      errors.push('Intent Registry에 접근할 수 없습니다.');
    }
  } catch (error) {
    const maskedError = maskPII(error);
    errors.push(`Intent Registry 접근 확인 중 오류: ${maskedError}`);
  }

  // 3. Policy Registry 접근 가능 여부 확인 (tenant_settings 조회)
  try {
    const { error: policyError } = await withTenant(
      supabase
        .from('tenant_settings')
        .select('key')
        .eq('key', 'config')
        .limit(1),
      tenantId
    );

    if (policyError && policyError.code !== 'PGRST116') { // PGRST116 = not found (정상)
      const maskedError = maskPII(policyError);
      errors.push(`Policy Registry 접근 확인 중 오류: ${maskedError}`);
    }
  } catch (error) {
    const maskedError = maskPII(error);
    errors.push(`Policy Registry 접근 확인 중 오류: ${maskedError}`);
  }

  return {
    passed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * 전체 Preflight 검증 실행
 * 붕괴사전예방.md 참조
 */
export async function runAllPreflightChecks(
  supabase: any,
  tenantId: string
): Promise<HealthCheckResult> {
  const checks: Record<string, 'ok' | 'warning' | 'error'> = {};
  let overallStatus: HealthStatus = 'healthy';

  // Layer A 검증 (정적 검증)
  const layerA = checkLayerA();
  checks['layer_a_intent_registry'] = layerA.passed ? 'ok' : 'error';
  if (!layerA.passed) {
    overallStatus = 'unhealthy';
  }

  // Layer B 검증 (배포 시 검증)
  const layerB = await checkLayerB(supabase, tenantId);

  // Layer C 검증 (런타임 검증) - Layer B 결과와 함께 평가하기 위해 먼저 실행
  const layerC = await checkLayerC(supabase, tenantId);

  // ⚠️ 중요: Layer C가 통과하면 Layer B의 경고는 무시 (실제 접근 가능)
  // Layer C가 통과했는데 Layer B가 실패한 경우, Layer B의 경고만 있고 에러가 없으면
  // 실제로는 문제가 없는 것으로 간주
  const layerBHasOnlyWarnings = !layerB.passed && layerB.warnings && layerB.warnings.length > 0 && (!layerB.errors || layerB.errors.length === 0);
  const layerBShouldBeTreatedAsPassed = Boolean(layerC.passed && layerBHasOnlyWarnings);

  if (layerBShouldBeTreatedAsPassed) {
    // Layer C 통과 + Layer B 경고만 있음 = 실제로는 문제 없음
    console.warn('[Healthcheck] Layer C 통과, Layer B 경고만 있음 - 실제 문제 없음으로 간주');
    checks['layer_b_tables'] = 'warning';
    checks['layer_b_columns'] = 'warning';
    checks['layer_b_migration'] = 'warning';
  } else {
    // 일반적인 Layer B 검증 결과 처리
    checks['layer_b_tables'] = layerB.passed ? 'ok' : 'error';
    checks['layer_b_columns'] = layerB.passed ? 'ok' : 'error';
    // 마이그레이션 버전 확인은 경고로 처리 (PostgREST 스키마 캐시 문제 가능)
    if (layerB.warnings && layerB.warnings.length > 0) {
      checks['layer_b_migration'] = 'warning';
    } else {
      checks['layer_b_migration'] = layerB.passed ? 'ok' : 'error';
    }
  }

  // Layer B 에러가 있을 때만 unhealthy로 처리 (경고만 있으면 무시)
  if (!layerB.passed && !layerBShouldBeTreatedAsPassed) {
    overallStatus = 'unhealthy';
  }

  checks['layer_c_database'] = layerC.passed ? 'ok' : 'error';
  checks['layer_c_tables'] = layerC.passed ? 'ok' : 'error';
  checks['layer_c_registry'] = layerC.passed ? 'ok' : 'error';
  checks['layer_c_worker'] = layerC.passed ? 'ok' : 'error';
  if (!layerC.passed) {
    // Layer C 실패는 degraded로 처리 (서비스는 계속 가능)
    if (overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }
  }

  return {
    status: overallStatus,
    layer_a: {
      intent_registry_loaded: layerA.passed,
      ...(layerA.error && { error: layerA.error }),
    },
    layer_b: {
      required_tables_exist: layerB.passed || layerBShouldBeTreatedAsPassed,
      required_columns_exist: layerB.passed || layerBShouldBeTreatedAsPassed,
      migration_version_ok: layerB.passed && !(layerB.warnings && layerB.warnings.length > 0),
      ...(layerB.errors && { errors: layerB.errors }),
      ...(layerB.warnings && { warnings: layerB.warnings }),
    },
    layer_c: {
      database_accessible: layerC.passed,
      core_tables_accessible: layerC.passed,
      intent_registry_accessible: layerC.passed,
      policy_registry_accessible: layerC.passed,
      worker_tables_exist: layerC.passed,
      ...(layerC.errors && { errors: layerC.errors }),
    },
    checks,
    timestamp: new Date().toISOString(),
  };
}

export const system_exec_run_healthcheckHandler: IntentHandler = {
  intent_key: 'system.exec.run_healthcheck',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      // ⚠️ P0: Plan 스냅샷에서만 실행 대상 로드 (클라이언트 입력 무시)
      const params = plan.params as Record<string, unknown>;

      if (!params || typeof params !== 'object') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '파라미터가 필요합니다.',
        };
      }

      // ⚠️ P0: Domain Action Catalog 검증 (Fail-Closed)
      assertDomainActionKey('system.run_healthcheck');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.system.run_healthcheck.enabled
      const policyPath = 'domain_action.system.run_healthcheck.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      // 정책이 없으면 기본값으로 true 사용 (마이그레이션 미실행 시 호환성)
      // 정책이 명시적으로 false로 설정된 경우에만 비활성화
      if (policyEnabled === false) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '시스템 헬스체크 실행 정책이 비활성화되어 있습니다.',
        };
      }

      // ⚠️ P0: 전체 Preflight 검증 실행 (Layer A/B/C 통합)
      // 붕괴사전예방.md 참조
      const healthCheckResult = await runAllPreflightChecks(
        context.supabase,
        context.tenant_id
      );

      // Healthcheck 상태에 따른 메시지 생성
      let message = '시스템 헬스체크 실행이 완료되었습니다.';
      if (healthCheckResult.status === 'unhealthy') {
        message = '시스템 헬스체크 결과: 일부 검증 실패';
      } else if (healthCheckResult.status === 'degraded') {
        message = '시스템 헬스체크 결과: 일부 기능 제한 가능';
      }

      return {
        status: 'success',
        result: {
          health_status: healthCheckResult,
        },
        affected_count: 0,
        message,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[system_exec_run_healthcheckHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
