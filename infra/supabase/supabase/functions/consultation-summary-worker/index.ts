/**
 * 상담일지 자동 요약 Worker Edge Function
 *
 * 프론트 자동화 문서 5.2.1 섹션 참조
 * 스케줄: 매 5분마다 실행 (Supabase cron 설정 필요)
 *
 * [불변 규칙] 큐 테이블(consultation_summary_jobs)에서 pending 작업을 읽어 처리
 * [불변 규칙] Service Role Key는 서버 환경변수에서만 가져옴
 * [불변 규칙] PII 마스킹: 상담일지 요약 시 개인정보 마스킹 필수
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { shouldUseAI } from '../_shared/policy-utils.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer, getPlatformAIEnabled } from '../_shared/env-registry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * PII 마스킹 함수
 * 아키텍처 문서 3.1.5, 898-950줄: 상담일지 요약 시 개인정보 마스킹 규칙
 */
function maskPIIInContent(content: string): string {
  let masked = content;

  // 1. 전화번호 마스킹: 010-1234-5678 → 010-****-****
  masked = masked.replace(/(\d{3})-(\d{4})-(\d{4})/g, '010-****-****');

  // 2. 학생 실명 마스킹: 2-4자 한글 이름 → [학생]
  masked = masked.replace(/(?:학생|아이|아동)\s*([가-힣]{2,4})(?:\s|\.|,|이|가|을|를|에게|의)/g, (match, name) => {
    return match.replace(name, '[학생]');
  });

  // 3. 학원명 마스킹: "XX학원", "XX아카데미", "XX교육원" → [학원명]
  masked = masked.replace(/([가-힣]+(?:학원|아카데미|교육원))/g, '[학원명]');

  // 4. 주소 마스킹: "XX시 XX구 XX동" → [주소]
  masked = masked.replace(/[가-힣]+시\s*[가-힣]+구\s*[가-힣]+동/g, '[주소]');

  // 5. 이메일 마스킹: user@example.com → u***@example.com
  masked = masked.replace(/([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (match, user, domain) => {
    const maskedUser = user.length > 1 ? user.charAt(0) + '***' : '***';
    return `${maskedUser}@${domain}`;
  });

  return masked;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // [불변 규칙] Edge Functions도 env-registry를 통해 환경변수 접근
    const supabase = createClient(envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY);

    console.log('[Consultation Summary Worker] Starting queue processing');

    // AI 기능 활성화 체크 (프론트 자동화 문서 "글로벌 헤더 AI 토글 — UX/정책 SSOT" 섹션 참조)
    const platformAIEnabled = getPlatformAIEnabled();
    if (!platformAIEnabled) {
      console.log('[Consultation Summary Worker] Platform AI is disabled, skipping');
      return new Response(
        JSON.stringify({ success: true, message: 'Platform AI disabled', processed_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 큐에서 pending 작업 조회 (최대 10개씩 처리)
    const { data: jobs, error: jobsError } = await supabase
      .from('consultation_summary_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (jobsError) {
      throw new Error(`Failed to fetch pending jobs: ${jobsError.message}`);
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending jobs', processed_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processedCount = 0;
    const maxRetries = 3;

    for (const job of jobs) {
      try {
        // ⚠️ 중요: AI 기능 활성화 여부 확인 (SSOT 기준, Fail Closed)
        // Automation Config First 원칙: 기본값 하드코딩 금지, Policy가 없으면 실행하지 않음
        if (!(await shouldUseAI(supabase, job.tenant_id))) {
          console.log(`[Consultation Summary Worker] AI disabled for tenant ${job.tenant_id}, skipping job ${job.id}`);

          // ⚠️ 중요: AI OFF 시 ai_decision_logs에 skipped_by_flag 기록 (SSOT 준수)
          await supabase.from('ai_decision_logs').insert({
            tenant_id: job.tenant_id,
            model: 'consultation_summary_worker',
            features: { job_id: job.id, consultation_id: job.consultation_id },
            reason: 'AI disabled (PLATFORM_AI_ENABLED or tenant_features disabled)',
            skipped_by_flag: true,
            created_at: new Date().toISOString(),
          }).catch((error) => {
            console.error(`[Consultation Summary Worker] Failed to log AI skip decision for job ${job.id}:`, error);
          });

          // 작업을 failed로 표시 (AI 비활성화로 인한 스킵)
          await supabase
            .from('consultation_summary_jobs')
            .update({
              status: 'failed',
              error_message: 'AI 기능이 비활성화되어 있습니다.',
              retry_count: job.retry_count || 0,
            })
            .eq('id', job.id);
          continue;
        }

        // 작업 상태를 processing으로 변경
        await supabase
          .from('consultation_summary_jobs')
          .update({
            status: 'processing',
            processed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        // PII 마스킹 적용
        const maskedContent = maskPIIInContent(job.content);

        // TODO: 실제 AI 요약 API 호출 (예: OpenAI, Claude 등)
        // 현재는 간단한 요약으로 대체
        const aiSummary = `상담 내용 요약: ${maskedContent.substring(0, 200)}${maskedContent.length > 200 ? '...' : ''}`;

        // 상담일지에 AI 요약 업데이트
        const { error: updateError } = await withTenant(
          supabase
          .from('student_consultations')
          .update({
            ai_summary: aiSummary,
            updated_at: new Date().toISOString(),
          })
            .eq('id', job.consultation_id),
          job.tenant_id
        );

        if (updateError) {
          throw new Error(`Failed to update consultation: ${updateError.message}`);
        }

        // 작업 상태를 completed로 변경
        await supabase
          .from('consultation_summary_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        processedCount += 1;
        console.log(`[Consultation Summary Worker] Processed job ${job.id} for consultation ${job.consultation_id}`);

      } catch (error) {
        console.error(`[Consultation Summary Worker] Error processing job ${job.id}:`, error);

        // 재시도 횟수 확인
        const retryCount = (job.retry_count || 0) + 1;

        if (retryCount >= maxRetries) {
          // 최대 재시도 횟수 초과 시 failed로 변경
          await supabase
            .from('consultation_summary_jobs')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : String(error),
              retry_count: retryCount,
            })
            .eq('id', job.id);
        } else {
          // 재시도 가능: pending으로 되돌림
          await supabase
            .from('consultation_summary_jobs')
            .update({
              status: 'pending',
              retry_count: retryCount,
              error_message: error instanceof Error ? error.message : String(error),
            })
            .eq('id', job.id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed_count: processedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Consultation Summary Worker] Fatal error:', error);
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

