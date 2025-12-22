/**
 * 자동화 안전성 체크 유틸리티
 *
 * [불변 규칙] 모든 Edge Function은 실행 전 Policy 조회 및 automation_safety_state 체크 필수
 * [문서 준수] docu/AI_자동화_기능_정리.md Section 10.4, docu/프론트 자동화.md Section 2.5.2
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withTenant } from './withTenant.ts';
import { getTenantSettingByPath } from './policy-utils.ts';

export interface SafetyCheckResult {
  canExecute: boolean;
  reason?: string;
}

/**
 * 자동화 안전성 체크 및 상태 업데이트
 *
 * @param supabase Supabase 클라이언트
 * @param tenantId 테넌트 ID
 * @param actionType 액션 타입 (예: 'send_notification', 'create_task', 'generate_billing')
 * @param kstTime KST 기준 현재 시간
 * @param maxAllowedPolicyPath Policy 경로 (max_allowed 값 조회용, 예: 'auto_notification.payment_due_reminder.throttle.daily_limit')
 * @param legacyMaxAllowedPolicyPath 레거시 Policy 경로 (fallback용, 선택적)
 * @returns SafetyCheckResult (canExecute: true면 실행 가능, false면 실행 불가)
 */
export async function checkAndUpdateAutomationSafety(
  supabase: SupabaseClient,
  tenantId: string,
  actionType: string,
  kstTime: Date,
  maxAllowedPolicyPath: string,
  legacyMaxAllowedPolicyPath?: string
): Promise<SafetyCheckResult> {
  // 오늘 날짜 윈도우 계산
  const todayStart = new Date(kstTime);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(kstTime);
  todayEnd.setHours(23, 59, 59, 999);

  // automation_safety_state 조회
  const { data: safetyState, error: safetyError } = await withTenant(
    supabase
      .from('automation_safety_state')
      .select('*')
      .eq('action_type', actionType)
      .gte('window_start', todayStart.toISOString())
      .lte('window_end', todayEnd.toISOString()),
    tenantId
  ).single();

  if (safetyError && safetyError.code !== 'PGRST116') {
    console.error(`[Automation Safety] Failed to check automation safety for tenant ${tenantId}:`, safetyError);
    // 에러가 발생해도 실행은 허용 (Fail Open, 단 로그 기록)
    return { canExecute: true };
  }

  // 기존 상태가 있는 경우
  if (safetyState) {
    // paused 상태면 실행 불가
    if (safetyState.state === 'paused') {
      console.warn(`[Automation Safety] Skipping ${actionType} for tenant ${tenantId} due to paused state.`);
      return { canExecute: false, reason: 'paused' };
    }

    // 실행 횟수가 제한을 초과하면 실행 불가 및 상태를 paused로 변경
    if (safetyState.executed_count >= safetyState.max_allowed) {
      await supabase
        .from('automation_safety_state')
        .update({ state: 'paused' })
        .eq('id', safetyState.id);
      console.warn(`[Automation Safety] Skipping ${actionType} for tenant ${tenantId} due to safety limits (${safetyState.executed_count}/${safetyState.max_allowed}).`);
      return { canExecute: false, reason: 'limit_exceeded' };
    }

    // 실행 카운트 증가
    await supabase
      .from('automation_safety_state')
      .update({
        executed_count: safetyState.executed_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', safetyState.id);

    return { canExecute: true };
  }

  // 기존 상태가 없는 경우: 초기 상태 생성
  // ⚠️ 중요: max_allowed는 Policy에서 조회 (Fail Closed)
  const maxAllowed = await getTenantSettingByPath(
    supabase,
    tenantId,
    maxAllowedPolicyPath,
    legacyMaxAllowedPolicyPath
  ) as number;

  if (!maxAllowed || typeof maxAllowed !== 'number') {
    // Policy가 없으면 실행하지 않음 (Fail Closed)
    console.log(`[Automation Safety] Max allowed policy not found for tenant ${tenantId}, action ${actionType}, path ${maxAllowedPolicyPath}`);
    return { canExecute: false, reason: 'policy_not_found' };
  }

  // 초기 상태 생성
  await supabase.from('automation_safety_state').insert({
    tenant_id: tenantId,
    action_type: actionType,
    window_start: todayStart.toISOString(),
    window_end: todayEnd.toISOString(),
    max_allowed: maxAllowed,
    state: 'normal',
  });

  return { canExecute: true };
}

