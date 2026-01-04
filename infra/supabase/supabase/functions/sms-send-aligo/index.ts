/**
 * 알리고(Aligo) SMS 발송 Edge Function
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 개발/프로덕션 모드 모두 지원 (ALIGO_TEST_MODE 환경변수)
 * [불변 규칙] EUC-KR 인코딩 주의 - 특수문자/이모지 물음표(?) 변환 가능
 *
 * ## 지원 작업
 * - send: 단건/동일 내용 다건 발송 (최대 1,000명)
 * - send_mass: 개별 내용 대량 발송 (최대 500명)
 * - list: 전송 내역 조회
 * - sms_list: 전송 결과 상세 조회
 * - remain: 발송 가능 건수 조회
 * - cancel: 예약 문자 취소
 *
 * 공식 문서: https://smartsms.aligo.in/admin/api/spec.html
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { envServer, getAligoCredentials, getAligoTestMode } from '../_shared/env-registry.ts';

// ============================================================================
// 타입 정의
// ============================================================================

/** 알리고 API 기본 URL */
const ALIGO_API_BASE_URL = 'https://apis.aligo.in';

/** SMS 바이트 한도 (EUC-KR 기준) */
const SMS_BYTE_LIMIT = 90;

/** 메시지 타입 */
type AligoMessageType = 'SMS' | 'LMS' | 'MMS';

/** API 요청 작업 유형 */
type AligoAction =
  | 'send'
  | 'send_mass'
  | 'list'
  | 'sms_list'
  | 'remain'
  | 'cancel';

/** 알리고 API 기본 응답 */
interface AligoBaseResponse {
  result_code: number;
  message: string;
}

/** 문자 발송 요청 */
interface SendRequest {
  action: 'send';
  receiver: string; // 컴마 구분, 최대 1000명
  msg: string;
  msg_type?: AligoMessageType;
  title?: string;
  destination?: string; // %고객명% 치환용
  rdate?: string; // YYYYMMDD
  rtime?: string; // HHMM
  testmode_yn?: 'Y' | 'N';
}

/** 대량 문자 발송 메시지 항목 */
interface MassMessageItem {
  receiver: string;
  msg: string;
}

/** 대량 문자 발송 요청 */
interface SendMassRequest {
  action: 'send_mass';
  messages: MassMessageItem[];
  msg_type: AligoMessageType;
  title?: string;
  rdate?: string;
  rtime?: string;
  testmode_yn?: 'Y' | 'N';
}

/** 전송 내역 조회 요청 */
interface ListRequest {
  action: 'list';
  page?: number;
  page_size?: number;
  start_date?: string;
  limit_day?: number;
}

/** 전송 결과 상세 조회 요청 */
interface SmsListRequest {
  action: 'sms_list';
  mid: number;
  page?: number;
  page_size?: number;
}

/** 잔여 건수 조회 요청 */
interface RemainRequest {
  action: 'remain';
}

/** 예약 취소 요청 */
interface CancelRequest {
  action: 'cancel';
  mid: number;
}

type AligoRequest =
  | SendRequest
  | SendMassRequest
  | ListRequest
  | SmsListRequest
  | RemainRequest
  | CancelRequest;

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * EUC-KR 바이트 수 계산
 */
function calculateEucKrBytes(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0x3131 && code <= 0x318e) ||
      (code >= 0x1100 && code <= 0x11ff)
    ) {
      bytes += 2;
    } else if (code <= 0x7f) {
      bytes += 1;
    } else {
      bytes += 2;
    }
  }
  return bytes;
}

/**
 * 메시지 타입 자동 결정
 */
function getAutoMessageType(msg: string): AligoMessageType {
  const bytes = calculateEucKrBytes(msg);
  return bytes > SMS_BYTE_LIMIT ? 'LMS' : 'SMS';
}

/**
 * 전화번호 정규화
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * 알리고 API 호출
 */
async function callAligoApi<T extends AligoBaseResponse>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  credentials: { key: string; user_id: string; sender: string },
  testMode: boolean
): Promise<T> {
  const url = `${ALIGO_API_BASE_URL}${endpoint}`;

  const formData = new URLSearchParams();
  formData.append('key', credentials.key);
  formData.append('user_id', credentials.user_id);
  formData.append('sender', credentials.sender);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  }

  if (testMode) {
    formData.append('testmode_yn', 'Y');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error(`HTTP 오류: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as T;

  if (data.result_code < 0) {
    throw new Error(data.message || `알리고 API 오류: ${data.result_code}`);
  }

  return data;
}

// ============================================================================
// 핸들러 함수
// ============================================================================

/**
 * 단건/동일 내용 다건 발송
 */
async function handleSend(
  request: SendRequest,
  credentials: { key: string; user_id: string; sender: string },
  testMode: boolean
) {
  const receivers = request.receiver
    .split(',')
    .map((r) => normalizePhone(r.trim()));

  if (receivers.length > 1000) {
    throw new Error('수신자 수가 최대 1,000명을 초과합니다.');
  }

  const msgType = request.msg_type || getAutoMessageType(request.msg);

  // 테스트 모드 오버라이드
  const finalTestMode = request.testmode_yn === 'Y' ? true : testMode;

  const params: Record<string, string | number | undefined> = {
    receiver: receivers.join(','),
    msg: request.msg,
    msg_type: msgType,
    title: request.title,
    destination: request.destination,
    rdate: request.rdate,
    rtime: request.rtime,
  };

  return callAligoApi('/send/', params, credentials, finalTestMode);
}

/**
 * 개별 내용 대량 발송
 */
async function handleSendMass(
  request: SendMassRequest,
  credentials: { key: string; user_id: string; sender: string },
  testMode: boolean
) {
  if (request.messages.length > 500) {
    throw new Error('발송 건수가 최대 500건을 초과합니다.');
  }

  if (request.messages.length === 0) {
    throw new Error('발송할 메시지가 없습니다.');
  }

  const finalTestMode = request.testmode_yn === 'Y' ? true : testMode;

  const params: Record<string, string | number | undefined> = {
    msg_type: request.msg_type,
    cnt: request.messages.length,
    title: request.title,
    rdate: request.rdate,
    rtime: request.rtime,
  };

  // 개별 메시지 추가
  request.messages.forEach((item, index) => {
    const num = index + 1;
    params[`rec_${num}`] = normalizePhone(item.receiver);
    params[`msg_${num}`] = item.msg;
  });

  return callAligoApi('/send_mass/', params, credentials, finalTestMode);
}

/**
 * 전송 내역 조회
 */
async function handleList(
  request: ListRequest,
  credentials: { key: string; user_id: string; sender: string },
  testMode: boolean
) {
  const params: Record<string, string | number | undefined> = {
    page: request.page ?? 1,
    page_size: request.page_size ?? 30,
    start_date: request.start_date,
    limit_day: request.limit_day,
  };

  return callAligoApi('/list/', params, credentials, testMode);
}

/**
 * 전송 결과 상세 조회
 */
async function handleSmsList(
  request: SmsListRequest,
  credentials: { key: string; user_id: string; sender: string },
  testMode: boolean
) {
  const params: Record<string, string | number | undefined> = {
    mid: request.mid,
    page: request.page ?? 1,
    page_size: request.page_size ?? 30,
  };

  return callAligoApi('/sms_list/', params, credentials, testMode);
}

/**
 * 발송 가능 건수 조회
 */
async function handleRemain(
  credentials: { key: string; user_id: string; sender: string },
  testMode: boolean
) {
  return callAligoApi('/remain/', {}, credentials, testMode);
}

/**
 * 예약 문자 취소
 */
async function handleCancel(
  request: CancelRequest,
  credentials: { key: string; user_id: string; sender: string },
  testMode: boolean
) {
  const params: Record<string, string | number | undefined> = {
    mid: request.mid,
  };

  return callAligoApi('/cancel/', params, credentials, testMode);
}

// ============================================================================
// 메인 핸들러
// ============================================================================

serve(async (req: Request) => {
  // CORS 헤더
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 인증 확인 (JWT 토큰)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '인증이 필요합니다.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Supabase 클라이언트 생성
    const supabase = createClient(
      envServer.SUPABASE_URL,
      envServer.SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 사용자 인증 검증
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '인증에 실패했습니다.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 요청 본문 파싱
    const body = (await req.json()) as AligoRequest;

    if (!body.action) {
      return new Response(
        JSON.stringify({ error: 'action 필드가 필요합니다.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 알리고 인증 정보 조회
    const credentials = getAligoCredentials();
    const testMode = getAligoTestMode();

    let result: AligoBaseResponse;

    switch (body.action) {
      case 'send':
        result = await handleSend(body, credentials, testMode);
        break;
      case 'send_mass':
        result = await handleSendMass(body, credentials, testMode);
        break;
      case 'list':
        result = await handleList(body, credentials, testMode);
        break;
      case 'sms_list':
        result = await handleSmsList(body, credentials, testMode);
        break;
      case 'remain':
        result = await handleRemain(credentials, testMode);
        break;
      case 'cancel':
        result = await handleCancel(body, credentials, testMode);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `지원하지 않는 action입니다: ${(body as any).action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
    }

    // 성공 응답
    return new Response(
      JSON.stringify({
        success: true,
        test_mode: testMode,
        data: result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[sms-send-aligo] Error:', error);

    const errorMessage =
      error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
