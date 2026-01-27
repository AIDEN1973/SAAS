import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ProactiveAlertTrigger {
  id: string;
  tenant_id: string;
  name: string;
  trigger_type: 'filter_tag_spike' | 'billing_overdue_spike' | 'attendance_drop' | 'churn_risk_increase';
  config: Record<string, unknown>;
  last_triggered_at: string | null;
  last_check_at: string | null;
}

interface AlertResult {
  trigger_id: string;
  should_alert: boolean;
  title?: string;
  message?: string;
  severity?: 'info' | 'warning' | 'critical';
  recommended_actions?: Array<{ action: string; label: string; params: Record<string, unknown> }>;
  detected_data?: Record<string, unknown>;
}

/**
 * Cron Job Edge Function: 선제적 알림 트리거 체크
 * 실행 주기: 매일 9AM (KST)
 * 목적: AI가 데이터 패턴을 분석하여 관리자에게 선제적 조치 권고
 */
serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    // Service Role Key로 Supabase Client 생성 (Cron Job은 인증 없이 실행)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 활성화된 모든 트리거 조회
    const { data: triggers, error: triggerError } = await supabase
      .from('proactive_alert_triggers')
      .select('*')
      .eq('is_active', true);

    if (triggerError) {
      console.error('Trigger query error:', triggerError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch triggers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!triggers || triggers.length === 0) {
      console.log('No active triggers found');
      return new Response(
        JSON.stringify({ message: 'No active triggers', checked: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking ${triggers.length} active triggers...`);

    const results: AlertResult[] = [];

    // 각 트리거 체크
    for (const trigger of triggers) {
      try {
        const result = await checkTrigger(supabase, trigger as ProactiveAlertTrigger);
        results.push(result);

        // 알림이 필요한 경우, DB에 저장
        if (result.should_alert) {
          await createProactiveAlert(supabase, trigger.tenant_id, result);
        }

        // last_check_at 업데이트
        await supabase
          .from('proactive_alert_triggers')
          .update({
            last_check_at: new Date().toISOString(),
            ...(result.should_alert && { last_triggered_at: new Date().toISOString() }),
          })
          .eq('id', trigger.id);
      } catch (error) {
        console.error(`Error checking trigger ${trigger.id}:`, error);
      }
    }

    const alertCount = results.filter((r) => r.should_alert).length;

    return new Response(
      JSON.stringify({
        message: 'Proactive alert check completed',
        checked: triggers.length,
        alerts_created: alertCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * 트리거 체크 로직
 */
async function checkTrigger(
  supabase: ReturnType<typeof createClient>,
  trigger: ProactiveAlertTrigger
): Promise<AlertResult> {
  switch (trigger.trigger_type) {
    case 'filter_tag_spike':
      return checkFilterTagSpike(supabase, trigger);
    case 'billing_overdue_spike':
      return checkBillingOverdueSpike(supabase, trigger);
    case 'attendance_drop':
      return checkAttendanceDrop(supabase, trigger);
    case 'churn_risk_increase':
      return checkChurnRiskIncrease(supabase, trigger);
    default:
      return { trigger_id: trigger.id, should_alert: false };
  }
}

/**
 * 필터 태그 급증 감지
 */
async function checkFilterTagSpike(
  supabase: ReturnType<typeof createClient>,
  trigger: ProactiveAlertTrigger
): Promise<AlertResult> {
  const config = trigger.config as {
    tag_ids?: string[];
    threshold_percent?: number;
    period_days?: number;
    min_change?: number;
  };

  const tagIds = config.tag_ids || [];
  const thresholdPercent = config.threshold_percent || 50;
  const periodDays = config.period_days || 7;
  const minChange = config.min_change || 3;

  if (tagIds.length === 0) {
    return { trigger_id: trigger.id, should_alert: false };
  }

  // 현재 시점 태그별 회원 수 조회 (간소화된 예시 - 실제로는 filter_tags 조건 기반 계산 필요)
  const { count: currentCount } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', trigger.tenant_id)
    .eq('status', 'active');

  // 과거 시점 태그별 회원 수 (간소화 - 실제로는 스냅샷 테이블 필요)
  const previousCount = Math.floor((currentCount || 0) * 0.7); // 예시 데이터

  const change = (currentCount || 0) - previousCount;
  const changePercent = previousCount > 0 ? (change / previousCount) * 100 : 0;

  if (change >= minChange && changePercent >= thresholdPercent) {
    return {
      trigger_id: trigger.id,
      should_alert: true,
      title: `필터 태그 급증 감지: ${trigger.name}`,
      message: `지난 ${periodDays}일간 해당 필터 태그에 속한 회원 수가 ${previousCount}명에서 ${currentCount}명으로 ${changePercent.toFixed(1)}% 증가했습니다.`,
      severity: changePercent >= 100 ? 'critical' : 'warning',
      recommended_actions: [
        {
          action: 'send_message',
          label: '해당 회원들에게 메시지 발송',
          params: { tag_ids: tagIds },
        },
        {
          action: 'review_filter',
          label: '필터 조건 검토',
          params: { filter_ids: tagIds },
        },
      ],
      detected_data: {
        tag_ids: tagIds,
        previous_count: previousCount,
        current_count: currentCount,
        change,
        change_percent: changePercent,
        period_days: periodDays,
      },
    };
  }

  return { trigger_id: trigger.id, should_alert: false };
}

/**
 * 결제 연체 급증 감지
 */
async function checkBillingOverdueSpike(
  supabase: ReturnType<typeof createClient>,
  trigger: ProactiveAlertTrigger
): Promise<AlertResult> {
  const config = trigger.config as {
    threshold_count?: number;
    period_days?: number;
  };

  const thresholdCount = config.threshold_count || 5;
  const periodDays = config.period_days || 7;

  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodDays);

  const { count: overdueCount } = await supabase
    .from('billing_records')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', trigger.tenant_id)
    .eq('status', 'overdue')
    .gte('created_at', periodStart.toISOString());

  if ((overdueCount || 0) >= thresholdCount) {
    return {
      trigger_id: trigger.id,
      should_alert: true,
      title: `결제 연체 급증 감지: ${trigger.name}`,
      message: `지난 ${periodDays}일간 ${overdueCount}명의 결제 연체가 발생했습니다.`,
      severity: (overdueCount || 0) >= 10 ? 'critical' : 'warning',
      recommended_actions: [
        {
          action: 'send_reminder',
          label: '연체자에게 리마인더 발송',
          params: {},
        },
      ],
      detected_data: {
        overdue_count: overdueCount,
        period_days: periodDays,
      },
    };
  }

  return { trigger_id: trigger.id, should_alert: false };
}

/**
 * 출석률 급감 감지
 */
async function checkAttendanceDrop(
  supabase: ReturnType<typeof createClient>,
  trigger: ProactiveAlertTrigger
): Promise<AlertResult> {
  // 간소화된 예시 - 실제로는 attendance_records 기반 계산 필요
  return { trigger_id: trigger.id, should_alert: false };
}

/**
 * 이탈 위험 증가 감지
 */
async function checkChurnRiskIncrease(
  supabase: ReturnType<typeof createClient>,
  trigger: ProactiveAlertTrigger
): Promise<AlertResult> {
  // 간소화된 예시 - 실제로는 복합 지표 분석 필요
  return { trigger_id: trigger.id, should_alert: false };
}

/**
 * 선제적 알림 생성
 */
async function createProactiveAlert(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  result: AlertResult
): Promise<void> {
  const { error } = await supabase.from('proactive_alerts').insert({
    tenant_id: tenantId,
    trigger_id: result.trigger_id,
    trigger_type: 'filter_tag_spike', // 실제로는 trigger에서 가져와야 함
    title: result.title || '',
    message: result.message || '',
    severity: result.severity || 'info',
    recommended_actions: result.recommended_actions || [],
    detected_data: result.detected_data || {},
    is_read: false,
    is_dismissed: false,
  });

  if (error) {
    console.error('Failed to create proactive alert:', error);
  }
}
