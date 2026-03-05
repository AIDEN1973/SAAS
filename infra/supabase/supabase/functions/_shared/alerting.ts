/**
 * Edge Function Alerting Utility
 *
 * [Phase 3] 임계값 기반 알림 체계
 * [불변 규칙] 에러 로그 기반으로 동일 에러 빈도를 측정하여 알림 발생
 *
 * 알림 채널: console.error (즉시) + error_logs 테이블 (추적)
 * 향후 확장: Sentry, Slack webhook
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AlertOptions {
  /** Edge Function 이름 */
  functionName: string;
  /** 에러 타입 (분류용) */
  errorType: string;
  /** 알림 심각도 */
  severity: AlertSeverity;
  /** 임계값: 동일 에러 반복 횟수 (기본값: 5) */
  threshold?: number;
  /** 임계값 판단 윈도우 (분 단위, 기본값: 10) */
  windowMinutes?: number;
  /** 추가 컨텍스트 정보 */
  context?: Record<string, unknown>;
  /** 테넌트 ID (선택) */
  tenantId?: string;
}

export interface BatchAlertOptions {
  /** Edge Function 이름 */
  functionName: string;
  /** 전체 처리 건수 */
  totalCount: number;
  /** 성공 건수 */
  successCount: number;
  /** 실패 건수 */
  failedCount: number;
  /** 실패율 임계값 % (기본값: 10) */
  failureRateThreshold?: number;
  /** 추가 컨텍스트 */
  context?: Record<string, unknown>;
}

/**
 * 임계값 기반 알림 발생
 *
 * error_logs 테이블에서 최근 N분 이내 동일 에러 빈도를 조회하여
 * 임계값 초과 시 critical 알림을 발생시킵니다.
 *
 * @returns true: 임계값 초과로 알림 발생, false: 임계값 미달
 */
export async function alertIfThresholdExceeded(
  supabase: SupabaseClient,
  options: AlertOptions
): Promise<boolean> {
  const {
    functionName,
    errorType,
    severity,
    threshold = 5,
    windowMinutes = 10,
    context,
    tenantId,
  } = options;

  try {
    // 최근 windowMinutes 이내 동일 에러 건수 조회
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    const { count, error: countError } = await supabase
      .from('error_logs')
      .select('*', { count: 'exact', head: true })
      .eq('function_name', functionName)
      .eq('error_type', errorType)
      .gte('created_at', windowStart);

    if (countError) {
      console.warn('[Alerting] Failed to check error threshold:', countError.message);
      // 임계값 체크 실패 시 안전하게 알림 발생 (fail-open for alerting)
      await sendAlert(supabase, {
        functionName,
        errorType,
        severity,
        message: `임계값 체크 실패 - 안전 알림 발생 (${errorType})`,
        context: { ...context, threshold_check_error: countError.message },
        tenantId,
      });
      return true;
    }

    const errorCount = count || 0;

    if (errorCount >= threshold) {
      await sendAlert(supabase, {
        functionName,
        errorType,
        severity: 'critical', // 임계값 초과 시 항상 critical
        message: `[임계값 초과] ${functionName}/${errorType}: ${windowMinutes}분 내 ${errorCount}건 (임계값: ${threshold})`,
        context: {
          ...context,
          error_count: errorCount,
          threshold,
          window_minutes: windowMinutes,
        },
        tenantId,
      });
      return true;
    }

    return false;
  } catch (e) {
    console.error('[Alerting] Exception in alertIfThresholdExceeded:', e instanceof Error ? e.message : String(e));
    return false;
  }
}

/**
 * 배치 작업 실패율 기반 알림
 *
 * 배치 작업의 실패율이 임계값을 초과하면 알림을 발생시킵니다.
 */
export async function alertOnBatchFailure(
  supabase: SupabaseClient,
  options: BatchAlertOptions
): Promise<void> {
  const {
    functionName,
    totalCount,
    successCount,
    failedCount,
    failureRateThreshold = 10,
    context,
  } = options;

  if (totalCount === 0) return;

  const failureRate = (failedCount / totalCount) * 100;

  // 전체 실패 (100%)
  if (failedCount === totalCount) {
    await sendAlert(supabase, {
      functionName,
      errorType: 'batch_total_failure',
      severity: 'critical',
      message: `[전체 실패] ${functionName}: ${totalCount}건 전체 실패`,
      context: { ...context, total: totalCount, success: successCount, failed: failedCount },
    });
    return;
  }

  // 실패율 임계값 초과
  if (failureRate >= failureRateThreshold) {
    const severity: AlertSeverity = failureRate >= 50 ? 'critical' : 'warning';
    await sendAlert(supabase, {
      functionName,
      errorType: 'batch_partial_failure',
      severity,
      message: `[실패율 ${failureRate.toFixed(1)}%] ${functionName}: ${totalCount}건 중 ${failedCount}건 실패`,
      context: { ...context, total: totalCount, success: successCount, failed: failedCount, failure_rate: failureRate },
    });
  }
}

/**
 * 즉시 알림 발송 (임계값 체크 없이)
 *
 * 결제 웹훅 실패 등 즉시 알림이 필요한 경우 사용
 */
export async function sendImmediateAlert(
  supabase: SupabaseClient,
  options: {
    functionName: string;
    errorType: string;
    severity: AlertSeverity;
    message: string;
    context?: Record<string, unknown>;
    tenantId?: string;
  }
): Promise<void> {
  await sendAlert(supabase, options);
}

/**
 * 내부 알림 발송 함수
 *
 * 현재: console.error + error_logs 테이블 기록
 * 향후: Sentry, Slack webhook 등 확장
 */
async function sendAlert(
  supabase: SupabaseClient,
  options: {
    functionName: string;
    errorType: string;
    severity: AlertSeverity;
    message: string;
    context?: Record<string, unknown>;
    tenantId?: string;
  }
): Promise<void> {
  const { functionName, errorType, severity, message, context, tenantId } = options;

  // 1. 콘솔 출력 (즉시)
  const logPrefix = `[ALERT:${severity.toUpperCase()}]`;
  if (severity === 'critical' || severity === 'error') {
    console.error(logPrefix, message, context || '');
  } else {
    console.warn(logPrefix, message, context || '');
  }

  // 2. error_logs 테이블에 알림 기록 (추적용)
  try {
    await supabase.from('error_logs').insert({
      tenant_id: tenantId || null,
      function_name: functionName,
      error_type: `alert:${errorType}`,
      error_message: message.substring(0, 1000),
      context: {
        ...context,
        alert_severity: severity,
        alert_type: errorType,
      },
      severity,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[Alerting] Failed to log alert to DB:', e instanceof Error ? e.message : String(e));
  }
}
