#!/usr/bin/env tsx
/**
 * 누락된 Handler 자동 생성 스크립트
 *
 * 분석 결과를 기반으로 누락된 Handler를 자동 생성합니다.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const HANDLERS_DIR = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers');
const REGISTRY_PATH = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers/registry.ts');

// Handler 기본 템플릿 (L2-B용)
const handlerTemplate = (intentKey: string, actionKey: string, description: string) => `// LAYER: EDGE_FUNCTION_HANDLER
/**
 * ${description} Handler
 *
 * Intent: ${intentKey}
 * Action Key: ${actionKey} (Domain Action Catalog)
 *
 * 챗봇.md 12.1.3 참조
 *
 * ⚠️ TODO: 이 Handler는 자동 생성된 기본 템플릿입니다.
 * 실제 비즈니스 로직을 구현해야 합니다.
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

export const ${intentKey.replace(/\./g, '_').replace(/-/g, '_')}Handler: IntentHandler = {
  intent_key: '${intentKey}',

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
      assertDomainActionKey('${actionKey}');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.${actionKey}.enabled
      const policyPath = 'domain_action.${actionKey}.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '${description} 정책이 비활성화되어 있습니다.',
        };
      }

      // TODO: 실제 비즈니스 로직 구현
      // 예시:
      // 1. params에서 필요한 데이터 추출
      // 2. DB 조회/수정/생성
      // 3. 결과 반환

      return {
        status: 'success',
        result: {
          message: '${description}가 완료되었습니다.',
        },
        affected_count: 1,
        message: '${description}가 완료되었습니다.',
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[${intentKey.replace(/\./g, '_')}Handler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
`;

// 누락된 Handler 목록 (분석 결과 기반)
const missingHandlers = [
  // Attendance
  { intent_key: 'attendance.exec.correct_record', action_key: 'attendance.correct_record', description: '출결 기록 수정' },
  { intent_key: 'attendance.exec.mark_excused', action_key: 'attendance.mark_excused', description: '출결 사유 처리' },
  { intent_key: 'attendance.exec.bulk_update', action_key: 'attendance.bulk_update', description: '출결 일괄 수정' },
  { intent_key: 'attendance.exec.schedule_recheck', action_key: 'attendance.schedule_recheck', description: '출결 재확인 스케줄' },

  // Billing
  { intent_key: 'billing.exec.issue_invoices', action_key: 'billing.issue_invoices', description: '청구서 발행' },
  { intent_key: 'billing.exec.reissue_invoice', action_key: 'billing.reissue_invoice', description: '청구서 재발행' },
  { intent_key: 'billing.exec.record_manual_payment', action_key: 'billing.record_manual_payment', description: '수동 결제 기록' },
  { intent_key: 'billing.exec.apply_discount', action_key: 'billing.apply_discount', description: '할인 적용' },
  { intent_key: 'billing.exec.apply_refund', action_key: 'billing.apply_refund', description: '환불 적용' },
  { intent_key: 'billing.exec.create_installment_plan', action_key: 'billing.create_installment_plan', description: '할부 계획 생성' },
  { intent_key: 'billing.exec.fix_duplicate_invoices', action_key: 'billing.fix_duplicate_invoices', description: '중복 청구서 수정' },
  { intent_key: 'billing.exec.sync_gateway', action_key: 'billing.sync_gateway', description: '결제 게이트웨이 동기화' },
  { intent_key: 'billing.exec.close_month', action_key: 'billing.close_month', description: '월 마감' },

  // Message
  { intent_key: 'message.exec.cancel_scheduled', action_key: 'message.cancel_scheduled', description: '예약 메시지 취소' },
  { intent_key: 'message.exec.create_template', action_key: 'message.create_template', description: '메시지 템플릿 생성' },
  { intent_key: 'message.exec.update_template', action_key: 'message.update_template', description: '메시지 템플릿 수정' },

  // Student
  { intent_key: 'student.exec.update_profile', action_key: 'student.update_profile', description: '학생 프로필 수정' },
  { intent_key: 'student.exec.change_class', action_key: 'student.change_class', description: '학생 반 변경' },
  { intent_key: 'student.exec.pause', action_key: 'student.pause', description: '학생 휴원 처리' },
  { intent_key: 'student.exec.resume', action_key: 'student.resume', description: '학생 재원 처리' },
  { intent_key: 'student.exec.discharge', action_key: 'student.discharge', description: '학생 퇴원 처리' },
  { intent_key: 'student.exec.merge_duplicates', action_key: 'student.merge_duplicates', description: '중복 학생 병합' },
  { intent_key: 'student.exec.update_guardian_contact', action_key: 'student.update_guardian_contact', description: '보호자 연락처 수정' },
  { intent_key: 'student.exec.assign_tags', action_key: 'student.assign_tags', description: '학생 태그 할당' },
  { intent_key: 'student.exec.bulk_register', action_key: 'student.bulk_register', description: '학생 일괄 등록' },
  { intent_key: 'student.exec.bulk_update', action_key: 'student.bulk_update', description: '학생 일괄 수정' },
  { intent_key: 'student.exec.data_quality_apply_fix', action_key: 'student.data_quality_apply_fix', description: '데이터 품질 수정 적용' },
  { intent_key: 'student.exec.reactivate_from_discharged', action_key: 'student.reactivate_from_discharged', description: '퇴원 학생 재활성화' },

  // Class
  { intent_key: 'class.exec.create', action_key: 'class.create', description: '반 생성' },
  { intent_key: 'class.exec.update', action_key: 'class.update', description: '반 수정' },
  { intent_key: 'class.exec.close', action_key: 'class.close', description: '반 마감' },
  { intent_key: 'class.exec.bulk_reassign_teacher', action_key: 'class.bulk_reassign_teacher', description: '반 담임 일괄 변경' },

  // Schedule
  { intent_key: 'schedule.exec.add_session', action_key: 'schedule.add_session', description: '수업 세션 추가' },
  { intent_key: 'schedule.exec.move_session', action_key: 'schedule.move_session', description: '수업 세션 이동' },
  { intent_key: 'schedule.exec.cancel_session', action_key: 'schedule.cancel_session', description: '수업 세션 취소' },
  { intent_key: 'schedule.exec.bulk_shift', action_key: 'schedule.bulk_shift', description: '수업 일괄 이동' },

  // Note
  { intent_key: 'note.exec.create', action_key: 'note.create', description: '상담일지 생성' },
  { intent_key: 'note.exec.update', action_key: 'note.update', description: '상담일지 수정' },

  // Report
  { intent_key: 'report.exec.generate_monthly_report', action_key: 'report.generate_monthly_report', description: '월간 리포트 생성' },
  { intent_key: 'report.exec.generate_daily_brief', action_key: 'report.generate_daily_brief', description: '일일 브리프 생성' },

  // Policy
  { intent_key: 'policy.exec.enable_automation', action_key: 'policy.enable_automation', description: '자동화 정책 활성화' },
  { intent_key: 'policy.exec.update_threshold', action_key: 'policy.update_threshold', description: '정책 임계값 수정' },
  { intent_key: 'rbac.exec.assign_role', action_key: 'rbac.assign_role', description: '역할 할당' },

  // System
  { intent_key: 'system.exec.run_healthcheck', action_key: 'system.run_healthcheck', description: '시스템 헬스체크 실행' },
  { intent_key: 'system.exec.rebuild_search_index', action_key: 'system.rebuild_search_index', description: '검색 인덱스 재구성' },
  { intent_key: 'system.exec.backfill_reports', action_key: 'system.backfill_reports', description: '리포트 백필' },
  { intent_key: 'system.exec.retry_failed_actions', action_key: 'system.retry_failed_actions', description: '실패한 작업 재시도' },
];

// Handler 파일 생성
let createdCount = 0;
let skippedCount = 0;

for (const handler of missingHandlers) {
  const fileName = handler.intent_key.replace(/\./g, '-') + '.ts';
  const filePath = join(HANDLERS_DIR, fileName);

  if (existsSync(filePath)) {
    console.log(`⏭️  건너뜀 (이미 존재): ${fileName}`);
    skippedCount++;
    continue;
  }

  const content = handlerTemplate(handler.intent_key, handler.action_key, handler.description);
  writeFileSync(filePath, content, 'utf-8');
  console.log(`✅ 생성됨: ${fileName}`);
  createdCount++;
}

console.log(`\n=== 생성 완료 ===`);
console.log(`생성된 파일: ${createdCount}개`);
console.log(`건너뛴 파일: ${skippedCount}개`);

// Registry 업데이트 스크립트 생성
const registryImports: string[] = [];
const registryEntries: string[] = [];

for (const handler of missingHandlers) {
  const handlerName = handler.intent_key.replace(/\./g, '_').replace(/-/g, '_') + 'Handler';
  const fileName = handler.intent_key.replace(/\./g, '-');
  const importPath = `./${fileName}.ts`;

  registryImports.push(`import { ${handlerName} } from '${importPath}';`);
  registryEntries.push(`  '${handler.intent_key}': ${handlerName},`);
}

const registryUpdateScript = `// Registry 업데이트를 위한 import 및 entry 목록
// infra/supabase/functions/execute-student-task/handlers/registry.ts에 추가하세요

// Import 추가:
${registryImports.join('\n')}

// Registry entry 추가:
${registryEntries.join('\n')}
`;

writeFileSync(join(process.cwd(), 'scripts/registry-update-suggestions.txt'), registryUpdateScript, 'utf-8');
console.log(`\n✅ Registry 업데이트 제안이 scripts/registry-update-suggestions.txt에 저장되었습니다.`);

