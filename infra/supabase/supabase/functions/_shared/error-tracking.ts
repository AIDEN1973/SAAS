/**
 * Edge Function Error Tracking Utility
 *
 * [불변 규칙] P0-2: 모든 Edge Function 에러를 체계적으로 추적
 * [요구사항] error_logs 테이블에 에러 정보 저장
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ErrorLogEntry {
  tenant_id?: string;
  function_name: string;
  error_type: string;
  error_message: string;
  stack_trace?: string;
  context?: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Edge Function에서 발생한 에러를 error_logs 테이블에 기록
 *
 * @param supabase Supabase 클라이언트
 * @param entry 에러 로그 정보
 */
export async function logError(
  supabase: SupabaseClient,
  entry: ErrorLogEntry
): Promise<void> {
  try {
    const { error } = await supabase.from('error_logs').insert({
      tenant_id: entry.tenant_id || null,
      function_name: entry.function_name,
      error_type: entry.error_type,
      error_message: entry.error_message.substring(0, 1000), // 최대 1000자로 제한
      stack_trace: entry.stack_trace?.substring(0, 5000), // 최대 5000자로 제한
      context: entry.context || {},
      severity: entry.severity,
      created_at: new Date().toISOString(),
    });

    if (error) {
      // error_logs 테이블 삽입 실패 시 콘솔에만 출력 (무한 재귀 방지)
      console.error('[Error Tracking] Failed to log error:', error);
    }
  } catch (loggingError) {
    // 에러 로깅 자체가 실패해도 함수 실행은 계속되어야 함
    console.error('[Error Tracking] Exception in logError:', loggingError);
  }
}

/**
 * Error 객체를 ErrorLogEntry로 변환하는 헬퍼 함수
 *
 * @param error Error 객체
 * @param functionName Edge Function 이름
 * @param tenantId 테넌트 ID (선택)
 * @param context 추가 컨텍스트 정보 (선택)
 * @param severity 심각도 (기본값: 'error')
 * @returns ErrorLogEntry
 */
export function createErrorLogEntry(
  error: unknown,
  functionName: string,
  tenantId?: string,
  context?: Record<string, unknown>,
  severity: ErrorLogEntry['severity'] = 'error'
): ErrorLogEntry {
  const isError = error instanceof Error;

  return {
    tenant_id: tenantId,
    function_name: functionName,
    error_type: isError ? error.constructor.name : 'UnknownError',
    error_message: isError ? error.message : String(error),
    stack_trace: isError ? error.stack : undefined,
    context,
    severity,
  };
}

/**
 * 에러를 로깅하고 Response 객체를 반환하는 헬퍼 함수
 *
 * @param supabase Supabase 클라이언트
 * @param error Error 객체
 * @param functionName Edge Function 이름
 * @param tenantId 테넌트 ID (선택)
 * @param statusCode HTTP 상태 코드 (기본값: 500)
 * @returns Response 객체
 */
export async function logErrorAndRespond(
  supabase: SupabaseClient,
  error: unknown,
  functionName: string,
  tenantId?: string,
  statusCode = 500
): Promise<Response> {
  const entry = createErrorLogEntry(error, functionName, tenantId);
  await logError(supabase, entry);

  return new Response(
    JSON.stringify({
      success: false,
      error: entry.error_message,
    }),
    {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
