// LAYER: EDGE_FUNCTION_SHARED
/**
 * Inline Execution 로직 (Draft 상태 머신)
 *
 * ChatOps Inline Execution에서 필드 수집 및 실행 전 상태 관리
 * SSOT: 서버(DB)가 정본
 */

import type { IntentRegistryItem } from './intent-parser.ts';
import { computeMissingRequired } from './compute-missing-required.ts';
import { maskPII } from './pii-utils.ts';
import { normalizeParams } from './normalize-params.ts';

export interface DraftState {
  id: string;
  session_id: string;
  tenant_id: string;
  user_id: string;
  intent_key: string;
  status: 'collecting' | 'ready' | 'executed' | 'cancelled';
  draft_params: Record<string, unknown>;
  missing_required: string[];
}

export interface InlineExecutionResult {
  draft_id?: string;
  draft_status: 'collecting' | 'ready' | 'executed' | 'cancelled';
  missing_required: string[];
  next_question?: string;
  summary?: string;
  confirm_required: boolean;
  response: string;
}

/**
 * Draft 생성 또는 조회
 */
export async function getOrCreateDraft(
  supabase: any,
  session_id: string,
  tenant_id: string,
  user_id: string,
  intent_key: string,
  resolve_snapshot?: Array<{ intent_key: string; score: number; reason: string }> | null
): Promise<DraftState | null> {
  try {
    // 기존 Draft 조회 (collecting 또는 ready 상태)
    const { data: existingDraft, error: fetchError } = await supabase
      .from('chatops_drafts')
      .select('*')
      .eq('session_id', session_id)
      .eq('tenant_id', tenant_id)
      .eq('user_id', user_id)
      .eq('intent_key', intent_key)
      .in('status', ['collecting', 'ready'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (existingDraft) {
      // 기존 Draft가 있으면 resolve_snapshot이 없을 때만 업데이트
      if (resolve_snapshot && !existingDraft.resolve_snapshot) {
        await supabase
          .from('chatops_drafts')
          .update({ resolve_snapshot: resolve_snapshot })
          .eq('id', existingDraft.id);
      }
      return {
        id: existingDraft.id,
        session_id: existingDraft.session_id,
        tenant_id: existingDraft.tenant_id,
        user_id: existingDraft.user_id,
        intent_key: existingDraft.intent_key,
        status: existingDraft.status,
        draft_params: existingDraft.draft_params || {},
        missing_required: existingDraft.missing_required || [],
      };
    }

    // 새 Draft 생성
    const { data: newDraft, error: createError } = await supabase
      .from('chatops_drafts')
      .insert({
        session_id,
        tenant_id,
        user_id,
        intent_key,
        status: 'collecting',
        draft_params: {},
        missing_required: [],
        resolve_snapshot: resolve_snapshot || null,
      })
      .select('*')
      .single();

    if (createError) {
      throw createError;
    }

    return {
      id: newDraft.id,
      session_id: newDraft.session_id,
      tenant_id: newDraft.tenant_id,
      user_id: newDraft.user_id,
      intent_key: newDraft.intent_key,
      status: newDraft.status,
      draft_params: newDraft.draft_params || {},
      missing_required: newDraft.missing_required || [],
    };
  } catch (error) {
    const maskedError = maskPII(error);
    console.error('[InlineExecution] Failed to get or create draft:', maskedError);
    return null;
  }
}

/**
 * Draft 파라미터 업데이트
 */
export async function updateDraftParams(
  supabase: any,
  draft_id: string,
  tenant_id: string,
  user_id: string,
  params: Record<string, unknown>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chatops_drafts')
      .update({
        draft_params: params,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draft_id)
      .eq('tenant_id', tenant_id)
      .eq('user_id', user_id);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    const maskedError = maskPII(error);
    console.error('[InlineExecution] Failed to update draft params:', maskedError);
    return false;
  }
}

/**
 * Inline Execution 플로우 처리
 */
export async function processInlineExecution(
  supabase: any,
  session_id: string,
  tenant_id: string,
  user_id: string,
  intent: IntentRegistryItem,
  draft_params: Record<string, unknown>,
  action: 'start' | 'apply' | 'confirm' | 'cancel',
  resolve_snapshot?: Array<{ intent_key: string; score: number; reason: string }> | null
): Promise<InlineExecutionResult> {
  // Draft 조회 또는 생성
  const draft = await getOrCreateDraft(supabase, session_id, tenant_id, user_id, intent.intent_key, resolve_snapshot);
  if (!draft) {
    return {
      draft_status: 'cancelled',
      missing_required: [],
      confirm_required: false,
      response: 'Draft 생성에 실패했습니다.',
    };
  }

  // cancel 액션 처리
  if (action === 'cancel') {
    await supabase
      .from('chatops_drafts')
      .update({ status: 'cancelled' })
      .eq('id', draft.id);
    return {
      draft_id: draft.id,
      draft_status: 'cancelled',
      missing_required: [],
      confirm_required: false,
      response: '등록이 취소되었습니다.',
    };
  }

  // apply 액션: 파라미터 업데이트 및 정규화
  let currentParams = { ...draft.draft_params };
  if (action === 'apply' && draft_params) {
    currentParams = { ...currentParams, ...draft_params };

    // ⚠️ P0: Resolver Gate - 파라미터 정규화 (name → student_id 등)
    // ChatOps_계약_붕괴_방지_체계_분석.md 2.2.2 참조: Query→ID 해소 없으면 Apply 진입 금지
    try {
      console.log('[InlineExecution] 파라미터 정규화 시작:', {
        intent_key: intent.intent_key,
        params_keys: Object.keys(currentParams),
        has_name: !!currentParams.name,
        has_student_id: !!currentParams.student_id,
      });

      currentParams = await normalizeParams(
        currentParams,
        intent.intent_key,
        supabase,
        tenant_id
      );

      console.log('[InlineExecution] 파라미터 정규화 완료:', {
        has_student_id: !!currentParams.student_id,
        has_resolve_failed: !!currentParams._resolve_failed,
      });

      // _resolve_failed 필드 제거 (Draft에 저장하지 않음, draft_confirm 단계에서 검증)
      if (currentParams._resolve_failed) {
        delete currentParams._resolve_failed;
      }
    } catch (normalizeError) {
      const maskedError = maskPII(normalizeError);
      console.error('[InlineExecution] 파라미터 정규화 중 오류:', maskedError);
      // 정규화 실패해도 계속 진행 (draft_confirm 단계에서 검증)
    }

    await updateDraftParams(supabase, draft.id, tenant_id, user_id, currentParams);
  }

  // 필수 필드 판정
  // ⚠️ Edge Function의 간소화된 Intent Registry에는 paramsSchema가 없으므로,
  // Intent별 하드코딩된 필수 필드 목록 사용
  let missingResult: { missing_required: string[]; satisfied: boolean; reason?: string };

  // student.exec.register의 경우: form_values.name이 필수
  if (intent.intent_key === 'student.exec.register') {
    const formValues = currentParams.form_values as Record<string, unknown> || {};
    const missing: string[] = [];
    if (!formValues.name || formValues.name === '') {
      missing.push('form_values.name');
    }
    missingResult = {
      missing_required: missing,
      satisfied: missing.length === 0,
      reason: missing.length > 0 ? `필수 필드 누락: ${missing.join(', ')}` : '모든 필수 필드가 충족되었습니다.',
    };
  } else if (intent.intent_key === 'student.exec.discharge') {
    // student.exec.discharge의 경우: student_id와 date가 필수
    const missing: string[] = [];
    if (!currentParams.student_id || currentParams.student_id === '') {
      missing.push('student_id');
    }
    if (!currentParams.date || currentParams.date === '') {
      missing.push('date');
    }
    missingResult = {
      missing_required: missing,
      satisfied: missing.length === 0,
      reason: missing.length > 0 ? `필수 필드 누락: ${missing.join(', ')}` : '모든 필수 필드가 충족되었습니다.',
    };
  } else {
    // 기본: 모든 필드가 선택
    missingResult = {
      missing_required: [],
      satisfied: true,
      reason: '모든 필수 필드가 충족되었습니다.',
    };
  }

  // missing_required 업데이트
  await supabase
    .from('chatops_drafts')
    .update({
      missing_required: missingResult.missing_required,
      status: missingResult.satisfied ? 'ready' : 'collecting',
    })
    .eq('id', draft.id);

  // 질문 생성
  let nextQuestion: string | undefined;
  if (!missingResult.satisfied && missingResult.missing_required.length > 0) {
    const firstMissing = missingResult.missing_required[0];
    // 간단한 질문 템플릿 (실제로는 Intent Registry의 필드 라벨 사용 가능)
    nextQuestion = `${firstMissing}을(를) 입력해주세요.`;
  }

  // ready 상태일 때 요약 생성
  let summary: string | undefined;
  if (missingResult.satisfied) {
    summary = `${intent.description} 실행 준비가 완료되었습니다.`;
  }

  return {
    draft_id: draft.id,
    draft_status: missingResult.satisfied ? 'ready' : 'collecting',
    missing_required: missingResult.missing_required,
    next_question: nextQuestion,
    summary,
    confirm_required: true, // 기본값: 확인 필요 (intent.requires_confirmation는 Edge Function registry에 없음)
    response: missingResult.satisfied
      ? `${summary}\n\n실행하시겠습니까?`
      : nextQuestion || '추가 정보가 필요합니다.',
  };
}

