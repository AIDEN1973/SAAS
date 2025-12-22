/**
 * Daily Automation Digest 생성 Edge Function
 *
 * 프론트 자동화 문서 3.1 섹션 참조
 * 스케줄: 매일 23:00 KST (Supabase cron 설정 필요)
 *
 * [불변 규칙] Zero-Management: 자동화 실행 결과의 사용자 인지
 * [불변 규칙] AI 인사이트 엔티티 단일화: ai_insights 테이블 사용 (insight_type: 'daily_automation_digest')
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';
import { toKSTDate, toKST } from '../_shared/date-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // [불변 규칙] Edge Functions도 env-registry를 통해 환경변수 접근
    const supabase = createClient(envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY);

    // 기술문서 19-1-2: KST 기준 날짜 처리
    // [불변 규칙] 파일명 생성 시 날짜 형식은 반드시 KST 기준을 사용합니다.
    const kstTime = toKST();
    const today = toKSTDate(); // YYYY-MM-DD
    const todayStart = `${today}T00:00:00`;
    const todayEnd = `${today}T23:59:59`;

    console.log(`[Daily Automation Digest] Starting generation for ${today}`);

    // 모든 활성 테넌트 조회
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id')
      .eq('status', 'active');

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    if (!tenants || tenants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active tenants', generated_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalGenerated = 0;

    for (const tenant of tenants) {
      try {
        // ⚠️ 중요: Daily Automation Digest Policy 확인 (Fail Closed)
        // SSOT 경로: auto_notification.daily_automation_digest.enabled
        // 레거시 fallback: 신규 경로가 없고 기존 값이 있을 때만 제한적 fallback (읽기만 허용, 쓰기 금지)
        const dailyDigestPolicy = await getTenantSettingByPath(
          supabase,
          tenant.id,
          'auto_notification.daily_automation_digest.enabled',
          'auto_digest.enabled' // 레거시 fallback
        );
        if (!dailyDigestPolicy || dailyDigestPolicy !== true) {
          // Policy가 없거나 비활성화되어 있으면 실행하지 않음 (Fail Closed)
          console.log(`[Daily Automation Digest] Daily digest disabled for tenant ${tenant.id}, skipping`);
          continue;
        }

        // 오늘 자동화 실행 결과 집계 (automation_actions 테이블에서 조회)
        const { data: todayActions, error: actionsError } = await withTenant(
          supabase
          .from('automation_actions')
          .select('action_type, executed_at')
          .gte('executed_at', todayStart)
            .lte('executed_at', todayEnd),
          tenant.id
        );

        if (actionsError) {
          console.error(`[Daily Automation Digest] Failed to fetch automation actions for tenant ${tenant.id}:`, actionsError);
          continue;
        }

        // 집계 계산
        const summary = {
          consultation_summaries: 0,
          overdue_notifications: 0,
          risk_detections: 0,
          auto_billing: 0,
          message_drafts: 0,
        };

        if (todayActions) {
          todayActions.forEach((action: { action_type: string }) => {
            if (action.action_type === 'consultation_summary') {
              summary.consultation_summaries += 1;
            } else if (action.action_type === 'overdue_notification') {
              summary.overdue_notifications += 1;
            } else if (action.action_type === 'risk_detection') {
              summary.risk_detections += 1;
            } else if (action.action_type === 'auto_billing') {
              summary.auto_billing += 1;
            } else if (action.action_type === 'message_draft') {
              summary.message_drafts += 1;
            }
          });
        }

        // 요약 텍스트 생성
        const summaryText = `오늘 자동 처리 요약:
- 상담 요약 ${summary.consultation_summaries}건 생성
- 미납 알림 ${summary.overdue_notifications}건 발송
- 출결 이상 학생 ${summary.risk_detections}명 감지
- 자동 청구 ${summary.auto_billing}건 생성
- 메시지 초안 ${summary.message_drafts}건 생성`;

        // ⚠️ 중요: AI 인사이트 엔티티 단일화
        // - UI 표기: "AI_BRIEFING" (사용자에게 보이는 라벨)
        // - DB 엔티티: ai_insights 테이블 (정본, 단일 진실 원천)
        // - insight_type 컬럼으로 구분 (daily_automation_digest, proactive_recommendation 등)
        const { error: insertError } = await supabase
          .from('ai_insights')
          .insert({
            tenant_id: tenant.id,
            student_id: null, // 테넌트 레벨 요약이므로 student_id는 null
            insight_type: 'daily_automation_digest',
            title: `${today} 자동 처리 요약`,
            summary: summaryText,
            details: todayActions || [], // JSON.stringify 없이 jsonb로 직접 저장
            related_entity_type: 'automation_digest',
            related_entity_id: null,
            status: 'active',
            created_at: toKST().toISOString(),
          } as any);

        if (!insertError) {
          totalGenerated += 1;
          console.log(`[Daily Automation Digest] Generated digest for tenant ${tenant.id}`);
        } else {
          console.error(`[Daily Automation Digest] Failed to generate digest for tenant ${tenant.id}:`, insertError);
        }

      } catch (error) {
        console.error(`[Daily Automation Digest] Error processing tenant ${tenant.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated_count: totalGenerated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Daily Automation Digest] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

