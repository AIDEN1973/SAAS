/**
 * 알림톡 발송 Edge Function
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 알림톡 기본, SMS 폴백 지원
 *
 * ## 요청 형식
 * POST /alimtalk-send
 * {
 *   "template_code": "TEMPLATE_CODE",
 *   "recipients": [
 *     { "receiver": "01012345678", "recvname": "홍길동", "variables": { "고객명": "홍길동" } }
 *   ],
 *   "use_fallback": true,
 *   "fallback_message": "SMS 대체 메시지",
 *   "scheduled_at": "2024-01-15T10:00:00Z"
 * }
 */

// @ts-ignore - Deno 환경
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno 환경
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { envServer } from '../_shared/env-registry.ts';
import {
  sendUnifiedMessageBulk,
  getAvailableChannels,
} from '../_shared/unified-message-sender.ts';

/**
 * CORS 헤더
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 템플릿 변수 치환
 */
function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`#\\{${key}\\}`, 'g'), value);
  }
  return result;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 인증 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: '인증이 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supabase 클라이언트 생성
    const supabase = createClient(
      envServer.SUPABASE_URL,
      envServer.SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // 사용자 확인
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: '인증되지 않은 사용자입니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 요청 파싱
    const body = await req.json();
    const {
      template_code,
      recipients,
      use_fallback = true,
      fallback_message,
      scheduled_at,
    } = body;

    // 필수 파라미터 검증
    if (!template_code || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'template_code와 recipients가 필요합니다.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 채널 확인
    const channels = getAvailableChannels();
    if (!channels.any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '알림톡 또는 SMS 설정이 필요합니다. 환경변수를 확인하세요.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 템플릿 조회 (실제 구현에서는 DB 또는 캐시에서 조회)
    // 여기서는 간단하게 메시지를 그대로 사용
    const templateContent = '#{message}'; // 실제로는 템플릿 내용 조회

    // 수신자별 메시지 생성
    const processedRecipients = recipients.map((r: any) => {
      const variables = r.variables || {};
      // 실제 템플릿 내용이 있다면 치환
      const alimtalkMessage = r.message || replaceTemplateVariables(templateContent, variables);
      const smsMessage = fallback_message || alimtalkMessage;

      return {
        receiver: r.receiver,
        recvname: r.recvname,
        alimtalkMessage,
        smsMessage: use_fallback ? smsMessage : undefined,
      };
    });

    // 예약 시간 변환
    let senddate: string | undefined;
    if (scheduled_at) {
      const date = new Date(scheduled_at);
      // YYYYMMDDHHmmss 형식으로 변환
      senddate = date.toISOString()
        .replace(/[-:T]/g, '')
        .substring(0, 14);
    }

    // 통합 메시지 발송
    const result = await sendUnifiedMessageBulk({
      templateCode: template_code,
      recipients: processedRecipients,
      channel: use_fallback ? 'auto' : 'alimtalk',
      senddate,
    });

    return new Response(
      JSON.stringify({
        success: result.success,
        used_channel: result.usedChannel,
        used_fallback: result.usedFallback,
        success_count: result.successCount,
        error_count: result.errorCount,
        mid: result.alimtalkResult?.mid || result.smsResult?.msgId?.toString(),
        error_message: result.errorMessage,
        test_mode: result.testMode,
      }),
      {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[alimtalk-send] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
