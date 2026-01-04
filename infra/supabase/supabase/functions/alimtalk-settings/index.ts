/**
 * 알림톡 설정 관리 Edge Function
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 채널 인증, 템플릿 CRUD, 발송 내역, 잔여 포인트 조회
 *
 * ## 요청 형식
 * POST /alimtalk-settings
 * {
 *   "action": "getProfiles" | "getTemplates" | "addTemplate" | "modifyTemplate" |
 *             "deleteTemplate" | "requestReview" | "getHistory" | "getHistoryDetail" |
 *             "getRemain" | "cancelScheduled" | "getCategories" | "requestProfileAuth",
 *   "params": { ... }
 * }
 */

// @ts-ignore - Deno 환경
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno 환경
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { envServer } from '../_shared/env-registry.ts';
import {
  getProfiles,
  getTemplates,
  addTemplate,
  modifyTemplate,
  deleteTemplate,
  requestTemplateReview,
  getHistory,
  getHistoryDetail,
  getRemain,
  cancelScheduled,
  getCategories,
  requestProfileAuth,
  isAlimtalkConfigured,
  getKakaoAligoTestMode,
} from '../_shared/alimtalk-sender.ts';

/**
 * CORS 헤더
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 응답 헬퍼
 */
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * 에러 응답 헬퍼
 */
function errorResponse(message: string, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
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
      return errorResponse('인증이 필요합니다.', 401);
    }

    // Supabase 클라이언트 생성 (SERVICE_ROLE_KEY 사용)
    const supabase = createClient(
      envServer.SUPABASE_URL,
      envServer.SERVICE_ROLE_KEY
    );

    // JWT 토큰에서 사용자 정보 추출 (execute-student-task 패턴 준수)
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return errorResponse('인증되지 않은 사용자입니다.', 401);
    }

    // 요청 파싱
    const body = await req.json();
    const { action, params = {} } = body;

    if (!action) {
      return errorResponse('action이 필요합니다.');
    }

    // 액션별 처리
    switch (action) {
      // 설정 상태 확인
      case 'getStatus': {
        return jsonResponse({
          success: true,
          configured: isAlimtalkConfigured(),
          testMode: getKakaoAligoTestMode(),
        });
      }

      // 채널 인증 요청
      case 'requestProfileAuth': {
        const { plusid, phonenumber } = params;
        if (!plusid || !phonenumber) {
          return errorResponse('plusid와 phonenumber가 필요합니다.');
        }
        const result = await requestProfileAuth({ plusid, phonenumber });
        return jsonResponse(result);
      }

      // 카테고리 목록 조회
      case 'getCategories': {
        const { groupCode } = params;
        const result = await getCategories(groupCode);
        return jsonResponse(result);
      }

      // 채널 목록 조회
      case 'getProfiles': {
        const result = await getProfiles();
        return jsonResponse(result);
      }

      // 템플릿 목록 조회
      case 'getTemplates': {
        const { tplCode } = params;
        const result = await getTemplates(tplCode);
        return jsonResponse(result);
      }

      // 템플릿 등록
      case 'addTemplate': {
        const { tpl_name, tpl_content, ...rest } = params;
        if (!tpl_name || !tpl_content) {
          return errorResponse('tpl_name과 tpl_content가 필요합니다.');
        }
        const result = await addTemplate({ tpl_name, tpl_content, ...rest });
        return jsonResponse(result);
      }

      // 템플릿 수정
      case 'modifyTemplate': {
        const { tpl_code, tpl_name, tpl_content, ...rest } = params;
        if (!tpl_code || !tpl_name || !tpl_content) {
          return errorResponse('tpl_code, tpl_name, tpl_content가 필요합니다.');
        }
        const result = await modifyTemplate({ tpl_code, tpl_name, tpl_content, ...rest });
        return jsonResponse(result);
      }

      // 템플릿 삭제
      case 'deleteTemplate': {
        const { tpl_code } = params;
        if (!tpl_code) {
          return errorResponse('tpl_code가 필요합니다.');
        }
        const result = await deleteTemplate({ tpl_code });
        return jsonResponse(result);
      }

      // 템플릿 검수 요청
      case 'requestReview': {
        const { tpl_code } = params;
        if (!tpl_code) {
          return errorResponse('tpl_code가 필요합니다.');
        }
        const result = await requestTemplateReview({ tpl_code });
        return jsonResponse(result);
      }

      // 발송 내역 조회
      case 'getHistory': {
        const { page, limit, startdate, enddate } = params;
        const result = await getHistory({ page, limit, startdate, enddate });
        return jsonResponse(result);
      }

      // 발송 상세 조회
      case 'getHistoryDetail': {
        const { mid, page, limit } = params;
        if (!mid) {
          return errorResponse('mid가 필요합니다.');
        }
        const result = await getHistoryDetail({ mid, page, limit });
        return jsonResponse(result);
      }

      // 잔여 포인트 조회
      case 'getRemain': {
        const result = await getRemain();
        return jsonResponse(result);
      }

      // 예약 발송 취소
      case 'cancelScheduled': {
        const { mid } = params;
        if (!mid) {
          return errorResponse('mid가 필요합니다.');
        }
        const result = await cancelScheduled(mid);
        return jsonResponse(result);
      }

      default:
        return errorResponse(`알 수 없는 action: ${action}`);
    }
  } catch (error) {
    console.error('[alimtalk-settings] Error:', error);
    return errorResponse(
      error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      500
    );
  }
});
