// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 청구서 발행 Handler
 *
 * Intent: billing.exec.issue_invoices
 * Action Key: billing.issue_invoices (Domain Action Catalog)
 *
 * 챗봇.md 12.1.3 참조
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
import { getTenantTableName } from '../../_shared/industry-adapter.ts';

export const billing_exec_issue_invoicesHandler: IntentHandler = {
  intent_key: 'billing.exec.issue_invoices',

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
      assertDomainActionKey('billing.issue_invoices');

      // ⚠️ P0: Policy 재평가 (실행 시점)
      // Domain Action 정책 경로: domain_action.billing.issue_invoices.enabled
      const policyPath = 'domain_action.billing.issue_invoices.enabled';
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      if (!policyEnabled || policyEnabled !== true) {
        return {
          status: 'failed',
          error_code: 'POLICY_DISABLED',
          message: '청구서 발행 정책이 비활성화되어 있습니다.',
        };
      }

      const month = params.month as string;
      const studentIds = params.student_ids as string[] | undefined;
      const pricingRuleId = params.pricing_rule_id as string | undefined;

      if (!month || typeof month !== 'string') {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          message: '월(YYYY-MM)이 필요합니다.',
        };
      }

      // 월의 시작일과 종료일 계산
      const [year, monthNum] = month.split('-').map(Number);
      const periodStart = `${month}-01`;
      const lastDay = new Date(year, monthNum, 0).getDate();
      const periodEnd = `${month}-${String(lastDay).padStart(2, '0')}`;
      const dueDate = periodEnd; // 기한은 월말

      // Industry Adapter: 업종별 학생 테이블명 동적 조회
      const studentTableName = await getTenantTableName(context.supabase, context.tenant_id, 'student');

      // 활성 학생 조회
      let studentsQuery = withTenant(
        context.supabase
          .from(studentTableName || 'academy_students') // Fallback
          .select('person_id')
          .eq('status', 'active'),
        context.tenant_id
      );

      if (studentIds && studentIds.length > 0) {
        studentsQuery = studentsQuery.in('person_id', studentIds);
      }

      const { data: students, error: studentsError } = await studentsQuery;

      if (studentsError) {
        const maskedError = maskPII(studentsError);
        console.error('[billing_exec_issue_invoicesHandler] Failed to query students:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '학생 조회에 실패했습니다.',
        };
      }

      if (!students || students.length === 0) {
        return {
          status: 'failed',
          error_code: 'NOT_FOUND',
          message: '발행할 학생이 없습니다.',
        };
      }

      // 이미 생성된 청구서 확인
      const { data: existingInvoices, error: invoicesError } = await withTenant(
        context.supabase
          .from('invoices')
          .select('payer_id')
          .gte('period_start', periodStart)
          .lte('period_start', periodEnd),
        context.tenant_id
      );

      if (invoicesError) {
        const maskedError = maskPII(invoicesError);
        console.error('[billing_exec_issue_invoicesHandler] Failed to check existing invoices:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '기존 청구서 확인에 실패했습니다.',
        };
      }

      const existingPayerIds = new Set((existingInvoices || []).map((inv: { payer_id?: string }) => inv.payer_id));

      // 청구서가 없는 학생들에 대해 청구서 생성
      const studentsToBill = students.filter((student: { person_id: string }) => !existingPayerIds.has(student.person_id));

      if (studentsToBill.length === 0) {
        return {
          status: 'success',
          result: {
            month,
            created_count: 0,
            message: '모든 학생에 대해 이미 청구서가 발행되었습니다.',
          },
          affected_count: 0,
          message: '모든 학생에 대해 이미 청구서가 발행되었습니다.',
        };
      }

      // 테넌트 정보 조회 (industry_type 확인)
      const { data: tenant, error: tenantError } = await withTenant(
        context.supabase
          .from('tenants')
          .select('industry_type')
          .eq('id', context.tenant_id)
          .single(),
        context.tenant_id
      );

      if (tenantError || !tenant) {
        const maskedError = maskPII(tenantError);
        console.error('[billing_exec_issue_invoicesHandler] Failed to query tenant:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '테넌트 정보 조회에 실패했습니다.',
        };
      }

      // 청구서 생성
      // ⚠️ 참고: billing_plans 테이블이 구현되면 실제 금액을 조회하여 설정해야 함
      // 현재는 amount=0으로 생성하며, 이후 수동으로 금액을 설정하거나 billing_plans 연동 필요
      const invoices = studentsToBill.map((student: { person_id: string }) => ({
        tenant_id: context.tenant_id,
        payer_id: student.person_id,
        amount: 0, // ⚠️ 향후 billing_plans에서 실제 금액 조회 필요
        period_start: periodStart,
        period_end: periodEnd,
        due_date: dueDate,
        status: 'draft',
        industry_type: tenant.industry_type,
      }));

      const { error: insertError } = await withTenant(
        context.supabase
          .from('invoices')
          .insert(invoices),
        context.tenant_id
      );

      if (insertError) {
        const maskedError = maskPII(insertError);
        console.error('[billing_exec_issue_invoicesHandler] Failed to create invoices:', maskedError);
        return {
          status: 'failed',
          error_code: 'EXECUTION_FAILED',
          message: '청구서 생성에 실패했습니다.',
        };
      }

      return {
        status: 'success',
        result: {
          month,
          created_count: invoices.length,
          total_students: students.length,
        },
        affected_count: invoices.length,
        message: `${invoices.length}개 청구서가 발행되었습니다.`,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billing_exec_issue_invoicesHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
