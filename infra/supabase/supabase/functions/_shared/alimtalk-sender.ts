/**
 * 카카오 알림톡 발송 유틸리티 - Edge Function 공유 모듈
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] Provider 추상화 - 현재는 알리고 카카오 API만 지원, 향후 확장 가능
 * [불변 규칙] 개발/프로덕션 모드 모두 지원 (KAKAO_ALIGO_TEST_MODE 환경변수)
 *
 * ## 사용 예시
 *
 * ```typescript
 * import { sendAlimtalk, sendAlimtalkBulk, isAlimtalkConfigured } from '../_shared/alimtalk-sender.ts';
 *
 * // 단건 알림톡 발송
 * const result = await sendAlimtalk({
 *   templateCode: 'WELCOME_MSG',
 *   receiver: '01011112222',
 *   message: '홍길동님, 가입을 환영합니다!',
 *   variables: { 고객명: '홍길동' },
 * });
 *
 * // 대량 알림톡 발송
 * const bulkResult = await sendAlimtalkBulk({
 *   templateCode: 'SCHEDULE_NOTIFY',
 *   recipients: [
 *     { receiver: '01011112222', message: '홍길동님, 오늘 수업이 있습니다.', recvname: '홍길동' },
 *     { receiver: '01022223333', message: '김철수님, 오늘 수업이 있습니다.', recvname: '김철수' },
 *   ],
 * });
 * ```
 */

import {
  getKakaoAligoCredentials,
  getKakaoAligoTestMode,
  isKakaoAligoConfigured,
  envServer,
} from './env-registry.ts';

// ============================================================================
// 타입 정의
// ============================================================================

/** 카카오 API 기본 URL */
const KAKAO_API_BASE_URL = 'https://kakaoapi.aligo.in';

/** 대량 발송 최대 건수 */
const BULK_SEND_MAX_COUNT = 500;

/**
 * 알림톡 발송 요청
 */
export interface AlimtalkSendRequest {
  /** 템플릿 코드 */
  templateCode: string;
  /** 수신자 전화번호 */
  receiver: string;
  /** 수신자 이름 */
  recvname?: string;
  /** 메시지 내용 (템플릿 변수 치환 후) */
  message: string;
  /** 버튼 정보 (JSON 문자열) */
  button?: string;
  /** SMS 대체발송 여부 */
  failover?: boolean;
  /** 대체발송 제목 */
  failoverSubject?: string;
  /** 대체발송 내용 */
  failoverMessage?: string;
  /** 예약 일시 (YYYYMMDDHHmmss) */
  senddate?: string;
}

/**
 * 알림톡 대량 발송 수신자
 */
export interface AlimtalkBulkRecipient {
  /** 수신자 전화번호 */
  receiver: string;
  /** 수신자 이름 */
  recvname?: string;
  /** 메시지 내용 */
  message: string;
  /** 버튼 정보 (JSON 문자열) */
  button?: string;
  /** SMS 대체발송 여부 */
  failover?: boolean;
  /** 대체발송 제목 */
  failoverSubject?: string;
  /** 대체발송 내용 */
  failoverMessage?: string;
}

/**
 * 알림톡 대량 발송 요청
 */
export interface AlimtalkBulkSendRequest {
  /** 템플릿 코드 */
  templateCode: string;
  /** 수신자 목록 (최대 500명) */
  recipients: AlimtalkBulkRecipient[];
  /** 예약 일시 (YYYYMMDDHHmmss) */
  senddate?: string;
}

/**
 * 알림톡 발송 결과
 */
export interface AlimtalkSendResult {
  /** 성공 여부 */
  success: boolean;
  /** 메시지 ID */
  mid?: string;
  /** 발송 건수 */
  count: number;
  /** 에러 메시지 (실패 시) */
  errorMessage?: string;
  /** 에러 코드 (실패 시) */
  errorCode?: number;
  /** 테스트 모드 여부 */
  testMode: boolean;
}

/**
 * 카카오 API 기본 응답
 */
interface KakaoBaseResponse {
  code: number;
  message: string;
}

/**
 * 알림톡 발송 응답
 */
interface AlimtalkApiResponse extends KakaoBaseResponse {
  info?: {
    type: string;
    mid: string;
    cnt: number;
    current?: string;
    unit?: number;
    total?: number;
  };
}

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 전화번호 정규화 (하이픈 제거)
 */
function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * 카카오 API 요청 전송
 */
async function requestKakaoApi<T extends KakaoBaseResponse>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  timeout = 30000
): Promise<T> {
  const credentials = getKakaoAligoCredentials();
  const testMode = getKakaoAligoTestMode();
  const url = `${KAKAO_API_BASE_URL}${endpoint}`;

  // FormData 생성
  const formData = new URLSearchParams();
  formData.append('apikey', credentials.apikey);
  formData.append('userid', credentials.userid);
  formData.append('senderkey', credentials.senderkey);

  if (credentials.token) {
    formData.append('token', credentials.token);
  }

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  }

  // 테스트 모드 설정
  if (testMode) {
    formData.append('testMode', 'Y');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP 오류: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as T;

    // API 응답 코드 확인 (0이 아니면 실패)
    if (data.code !== 0) {
      throw new Error(data.message || '알 수 없는 오류');
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('요청 타임아웃');
    }

    throw error;
  }
}

// ============================================================================
// 알림톡 발송 함수
// ============================================================================

/**
 * 알림톡 설정 여부 확인
 */
export function isAlimtalkConfigured(): boolean {
  return isKakaoAligoConfigured();
}

/**
 * SMS 발신자 번호 조회 (대체발송용)
 */
function getSmsSender(): string | undefined {
  return envServer.ALIGO_SENDER;
}

/**
 * 단건 알림톡 발송
 *
 * @param request 발송 요청
 * @returns 발송 결과
 */
export async function sendAlimtalk(request: AlimtalkSendRequest): Promise<AlimtalkSendResult> {
  const testMode = getKakaoAligoTestMode();

  if (!isAlimtalkConfigured()) {
    return {
      success: false,
      count: 0,
      errorMessage: '카카오 알림톡 설정이 완료되지 않았습니다. (KAKAO_ALIGO_API_KEY, KAKAO_ALIGO_USER_ID, KAKAO_ALIGO_SENDER_KEY)',
      errorCode: -900,
      testMode,
    };
  }

  try {
    const credentials = getKakaoAligoCredentials();
    const params: Record<string, string | number | undefined> = {
      senderkey: credentials.senderkey,
      tpl_code: request.templateCode,
      sender: getSmsSender(), // SMS 대체발송용
      msg_1: request.message,
      receiver_1: normalizePhoneNumber(request.receiver),
      recvname_1: request.recvname,
      button_1: request.button,
      senddate: request.senddate,
    };

    // SMS 대체발송 설정
    if (request.failover) {
      params.failover = 'Y';
      if (request.failoverSubject) params.fsubject_1 = request.failoverSubject;
      if (request.failoverMessage) params.fmessage_1 = request.failoverMessage;
    }

    const response = await requestKakaoApi<AlimtalkApiResponse>('/akv10/alimtalk/send/', params);

    return {
      success: true,
      mid: response.info?.mid,
      count: response.info?.cnt ?? 1,
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      count: 0,
      errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -999,
      testMode,
    };
  }
}

/**
 * 대량 알림톡 발송
 *
 * - 최대 500명까지 동시 발송 가능
 *
 * @param request 발송 요청
 * @returns 발송 결과
 */
export async function sendAlimtalkBulk(request: AlimtalkBulkSendRequest): Promise<AlimtalkSendResult> {
  const testMode = getKakaoAligoTestMode();

  if (!isAlimtalkConfigured()) {
    return {
      success: false,
      count: 0,
      errorMessage: '카카오 알림톡 설정이 완료되지 않았습니다.',
      errorCode: -900,
      testMode,
    };
  }

  if (request.recipients.length === 0) {
    return {
      success: false,
      count: 0,
      errorMessage: '수신자가 없습니다.',
      errorCode: -901,
      testMode,
    };
  }

  if (request.recipients.length > BULK_SEND_MAX_COUNT) {
    return {
      success: false,
      count: 0,
      errorMessage: `수신자 수가 최대 ${BULK_SEND_MAX_COUNT}명을 초과합니다.`,
      errorCode: -902,
      testMode,
    };
  }

  try {
    const credentials = getKakaoAligoCredentials();
    const params: Record<string, string | number | undefined> = {
      senderkey: credentials.senderkey,
      tpl_code: request.templateCode,
      sender: getSmsSender(),
      senddate: request.senddate,
      cnt: request.recipients.length,
    };

    // 개별 수신자 정보 추가
    request.recipients.forEach((recipient, index) => {
      const num = index + 1;
      params[`receiver_${num}`] = normalizePhoneNumber(recipient.receiver);
      params[`msg_${num}`] = recipient.message;
      if (recipient.recvname) params[`recvname_${num}`] = recipient.recvname;
      if (recipient.button) params[`button_${num}`] = recipient.button;
      if (recipient.failover) {
        params[`failover_${num}`] = 'Y';
        if (recipient.failoverSubject) params[`fsubject_${num}`] = recipient.failoverSubject;
        if (recipient.failoverMessage) params[`fmessage_${num}`] = recipient.failoverMessage;
      }
    });

    const response = await requestKakaoApi<AlimtalkApiResponse>('/akv10/alimtalk/send/', params);

    return {
      success: true,
      mid: response.info?.mid,
      count: response.info?.cnt ?? request.recipients.length,
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      count: 0,
      errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -999,
      testMode,
    };
  }
}

/**
 * 500건 이상의 대량 발송을 위한 배치 처리
 *
 * - 500건 단위로 분할하여 순차 발송
 * - 전체 결과 집계
 * - 부분 성공 지원: 일부 배치 실패해도 다른 배치는 계속 처리
 *
 * @param request 발송 요청
 * @returns 발송 결과
 */
export async function sendAlimtalkBulkBatched(request: AlimtalkBulkSendRequest): Promise<AlimtalkSendResult> {
  const recipients = request.recipients;

  if (recipients.length <= BULK_SEND_MAX_COUNT) {
    return sendAlimtalkBulk(request);
  }

  let totalSuccessCount = 0;
  let totalErrorCount = 0;
  let lastMid: string | undefined;
  let lastError: string | undefined;
  const testMode = getKakaoAligoTestMode();

  // 배치 단위로 분할
  for (let i = 0; i < recipients.length; i += BULK_SEND_MAX_COUNT) {
    const batch = recipients.slice(i, i + BULK_SEND_MAX_COUNT);

    const result = await sendAlimtalkBulk({
      ...request,
      recipients: batch,
    });

    if (result.success) {
      totalSuccessCount += result.count;
      if (result.mid) {
        lastMid = result.mid;
      }
    } else {
      // 실패한 배치의 건수를 에러로 집계
      totalErrorCount += batch.length;
      lastError = result.errorMessage;
    }

    // 배치 간 짧은 딜레이 (rate limiting 방지)
    if (i + BULK_SEND_MAX_COUNT < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // 부분 성공: 하나라도 성공했으면 success = true
  const hasAnySuccess = totalSuccessCount > 0;

  return {
    success: hasAnySuccess,
    mid: lastMid,
    count: totalSuccessCount,
    errorMessage: totalErrorCount > 0 ? lastError : undefined,
    errorCode: totalErrorCount > 0 && !hasAnySuccess ? -999 : undefined,
    testMode,
  };
}

// ============================================================================
// 채널/프로필 관리 API
// ============================================================================

/**
 * 프로필 인증 요청
 */
export interface ProfileAuthRequest {
  /** 카카오채널 ID (@로 시작) */
  plusid: string;
  /** 인증받을 전화번호 */
  phonenumber: string;
}

/**
 * 프로필 인증 결과
 */
export interface ProfileAuthResult {
  success: boolean;
  message?: string;
  errorCode?: number;
  testMode: boolean;
}

/**
 * 카카오채널 인증 요청
 *
 * 알림톡 및 친구톡을 전송하기 위해서는 반드시 카카오채널을 인증해야 합니다.
 * 인증 요청 시 카카오톡을 통해 인증 메시지가 전송됩니다.
 *
 * @param request 인증 요청
 * @returns 인증 요청 결과
 */
export async function requestProfileAuth(request: ProfileAuthRequest): Promise<ProfileAuthResult> {
  const testMode = getKakaoAligoTestMode();

  if (!envServer.KAKAO_ALIGO_API_KEY || !envServer.KAKAO_ALIGO_USER_ID) {
    return {
      success: false,
      message: '카카오 알림톡 API 설정이 완료되지 않았습니다.',
      errorCode: -900,
      testMode,
    };
  }

  try {
    const params: Record<string, string | number | undefined> = {
      plusid: request.plusid,
      phonenumber: normalizePhoneNumber(request.phonenumber),
    };

    const response = await requestKakaoApiWithoutSenderKey<KakaoBaseResponse>(
      '/akv10/profile/auth/',
      params
    );

    return {
      success: true,
      message: response.message || '인증 요청이 전송되었습니다. 카카오톡에서 인증을 완료해주세요.',
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -999,
      testMode,
    };
  }
}

// ============================================================================
// 카테고리 조회 API
// ============================================================================

/**
 * 카테고리 항목
 */
export interface CategoryItem {
  code: string;
  name: string;
  groupCode?: string;
}

/**
 * 카테고리 조회 결과
 */
export interface CategoryListResult {
  success: boolean;
  categories?: CategoryItem[];
  errorMessage?: string;
  errorCode?: number;
  testMode: boolean;
}

interface CategoryApiResponse extends KakaoBaseResponse {
  list?: Array<{
    code: string;
    name: string;
    groupCode?: string;
  }>;
}

/**
 * 카테고리 목록 조회
 *
 * 발신 프로필 등록 시 필요한 카테고리 목록을 조회합니다.
 *
 * @param groupCode 그룹 코드 (하위 카테고리 조회 시)
 * @returns 카테고리 목록
 */
export async function getCategories(groupCode?: string): Promise<CategoryListResult> {
  const testMode = getKakaoAligoTestMode();

  if (!envServer.KAKAO_ALIGO_API_KEY || !envServer.KAKAO_ALIGO_USER_ID) {
    return {
      success: false,
      errorMessage: '카카오 알림톡 API 설정이 완료되지 않았습니다.',
      errorCode: -900,
      testMode,
    };
  }

  try {
    const params: Record<string, string | number | undefined> = {};
    if (groupCode) {
      params.groupcode = groupCode;
    }

    const response = await requestKakaoApiWithoutSenderKey<CategoryApiResponse>(
      '/akv10/category/',
      params
    );

    return {
      success: true,
      categories: response.list?.map((item) => ({
        code: item.code,
        name: item.name,
        groupCode: item.groupCode,
      })),
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -999,
      testMode,
    };
  }
}

// ============================================================================
// 채널 목록 조회 API
// ============================================================================

/**
 * 프로필 정보
 */
export interface ProfileInfo {
  senderKey: string;
  categoryCode: string;
  channelName?: string;
  status: string;
  regDate?: string;
  alimUseYn?: string;
  profileStat?: string;
}

/**
 * 프로필 목록 결과
 */
export interface ProfileListResult {
  success: boolean;
  profiles?: ProfileInfo[];
  errorMessage?: string;
  errorCode?: number;
  testMode: boolean;
}

interface ProfileApiResponse extends KakaoBaseResponse {
  list?: Array<{
    senderKey: string;
    catCode?: string;
    name?: string;
    status?: string;
    regDate?: string;
    alimUseYn?: string;
    profileStat?: string;
  }>;
}

/**
 * 등록된 채널 목록 조회
 *
 * 인증된 카카오채널 목록과 각 채널의 senderkey를 조회합니다.
 *
 * @returns 프로필 목록
 */
export async function getProfiles(): Promise<ProfileListResult> {
  const testMode = getKakaoAligoTestMode();

  if (!envServer.KAKAO_ALIGO_API_KEY || !envServer.KAKAO_ALIGO_USER_ID) {
    return {
      success: false,
      errorMessage: '카카오 알림톡 API 설정이 완료되지 않았습니다.',
      errorCode: -900,
      testMode,
    };
  }

  try {
    const response = await requestKakaoApiWithoutSenderKey<ProfileApiResponse>(
      '/akv10/profile/list/',
      {}
    );

    return {
      success: true,
      profiles: response.list?.map((item) => ({
        senderKey: item.senderKey,
        categoryCode: item.catCode || '',
        channelName: item.name,
        status: item.status || '',
        regDate: item.regDate,
        alimUseYn: item.alimUseYn,
        profileStat: item.profileStat,
      })),
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -999,
      testMode,
    };
  }
}

// ============================================================================
// 템플릿 관리 API
// ============================================================================

/**
 * 버튼 타입
 */
export type ButtonType = 'WL' | 'AL' | 'DS' | 'BK' | 'MD' | 'BC' | 'BT' | 'AC' | 'P1' | 'P2' | 'P3';

/**
 * 템플릿 메시지 타입
 */
export type TemplateMessageType = 'BA' | 'EX' | 'AD' | 'MI';

/**
 * 강조 표기 타입
 */
export type EmphasisType = 'TEXT' | 'IMAGE' | 'ITEM_LIST' | 'NONE';

/**
 * 템플릿 버튼
 */
export interface TemplateButton {
  type: ButtonType;
  name: string;
  url_mobile?: string;
  url_pc?: string;
  scheme_android?: string;
  scheme_ios?: string;
}

/**
 * 템플릿 정보
 */
export interface TemplateInfo {
  templtCode: string;
  templtName: string;
  templtContent: string;
  status: string;
  inspStatus?: string;
  templateMessageType?: TemplateMessageType;
  templateEmphasisType?: EmphasisType;
  emphasisTitle?: string;
  emphasisSubTitle?: string;
  extra?: string;
  ad?: string;
  buttons?: TemplateButton[];
  cdate?: string;
  categoryCode?: string;
  securityFlag?: string;
}

/**
 * 템플릿 목록 결과
 */
export interface TemplateListResult {
  success: boolean;
  templates?: TemplateInfo[];
  errorMessage?: string;
  errorCode?: number;
  testMode: boolean;
}

interface TemplateApiResponse extends KakaoBaseResponse {
  list?: TemplateInfo[];
}

/**
 * 템플릿 목록 조회
 *
 * 등록된 템플릿 목록을 조회합니다.
 * 템플릿 코드가 D나 P로 시작하는 경우 공유 템플릿이므로 삭제 불가능합니다.
 *
 * @param tplCode 특정 템플릿 코드 (선택)
 * @returns 템플릿 목록
 */
export async function getTemplates(tplCode?: string): Promise<TemplateListResult> {
  const testMode = getKakaoAligoTestMode();

  if (!isAlimtalkConfigured()) {
    return {
      success: false,
      errorMessage: '카카오 알림톡 설정이 완료되지 않았습니다.',
      errorCode: -900,
      testMode,
    };
  }

  try {
    const params: Record<string, string | number | undefined> = {};
    if (tplCode) {
      params.tpl_code = tplCode;
    }

    const response = await requestKakaoApi<TemplateApiResponse>(
      '/akv10/template/list/',
      params
    );

    return {
      success: true,
      templates: response.list,
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -999,
      testMode,
    };
  }
}

/**
 * 템플릿 등록 요청
 */
export interface TemplateAddRequest {
  /** 템플릿 이름 (최대 150자) */
  tpl_name: string;
  /** 템플릿 내용 (최대 1000자) */
  tpl_content: string;
  /** 템플릿 메시지 타입 */
  tpl_message_type?: TemplateMessageType;
  /** 강조 표기 타입 */
  tpl_emphasis_type?: EmphasisType;
  /** 강조 제목 */
  emphasis_title?: string;
  /** 강조 부제목 */
  emphasis_subtitle?: string;
  /** 부가정보 */
  tpl_extra?: string;
  /** 광고 문구 */
  tpl_ad?: string;
  /** 버튼 목록 */
  tpl_button?: TemplateButton[];
  /** 카테고리 코드 */
  category_code?: string;
  /** 보안 템플릿 여부 */
  security_flag?: 'Y' | 'N';
}

/**
 * 템플릿 등록 결과
 */
export interface TemplateAddResult {
  success: boolean;
  templtCode?: string;
  errorMessage?: string;
  errorCode?: number;
  testMode: boolean;
}

interface TemplateAddApiResponse extends KakaoBaseResponse {
  data?: {
    templtCode?: string;
  };
}

/**
 * 템플릿 등록
 *
 * 알림톡 발송을 위한 템플릿을 등록합니다.
 * 등록 후 검수 요청을 해야 사용할 수 있습니다.
 *
 * @param request 템플릿 등록 요청
 * @returns 등록 결과
 */
export async function addTemplate(request: TemplateAddRequest): Promise<TemplateAddResult> {
  const testMode = getKakaoAligoTestMode();

  if (!isAlimtalkConfigured()) {
    return {
      success: false,
      errorMessage: '카카오 알림톡 설정이 완료되지 않았습니다.',
      errorCode: -900,
      testMode,
    };
  }

  try {
    const params: Record<string, string | number | undefined> = {
      tpl_name: request.tpl_name,
      tpl_content: request.tpl_content,
      tpl_message_type: request.tpl_message_type,
      tpl_emphasis_type: request.tpl_emphasis_type,
      emphasis_title: request.emphasis_title,
      emphasis_subtitle: request.emphasis_subtitle,
      tpl_extra: request.tpl_extra,
      tpl_ad: request.tpl_ad,
      tpl_button: request.tpl_button ? JSON.stringify({ button: request.tpl_button }) : undefined,
      category_code: request.category_code,
      security_flag: request.security_flag,
    };

    const response = await requestKakaoApi<TemplateAddApiResponse>(
      '/akv10/template/add/',
      params
    );

    return {
      success: true,
      templtCode: response.data?.templtCode,
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -999,
      testMode,
    };
  }
}

/**
 * 템플릿 수정 요청
 */
export interface TemplateModifyRequest extends TemplateAddRequest {
  /** 수정할 템플릿 코드 */
  tpl_code: string;
}

/**
 * 공통 작업 결과
 */
export interface OperationResult {
  success: boolean;
  message?: string;
  errorCode?: number;
  testMode: boolean;
}

/**
 * 템플릿 수정
 *
 * 등록된 템플릿의 내용을 수정합니다.
 * 수정 후 다시 검수 요청을 해야 합니다.
 *
 * @param request 템플릿 수정 요청
 * @returns 수정 결과
 */
export async function modifyTemplate(request: TemplateModifyRequest): Promise<OperationResult> {
  const testMode = getKakaoAligoTestMode();

  if (!isAlimtalkConfigured()) {
    return {
      success: false,
      message: '카카오 알림톡 설정이 완료되지 않았습니다.',
      errorCode: -900,
      testMode,
    };
  }

  try {
    const params: Record<string, string | number | undefined> = {
      tpl_code: request.tpl_code,
      tpl_name: request.tpl_name,
      tpl_content: request.tpl_content,
      tpl_message_type: request.tpl_message_type,
      tpl_emphasis_type: request.tpl_emphasis_type,
      emphasis_title: request.emphasis_title,
      emphasis_subtitle: request.emphasis_subtitle,
      tpl_extra: request.tpl_extra,
      tpl_ad: request.tpl_ad,
      tpl_button: request.tpl_button ? JSON.stringify({ button: request.tpl_button }) : undefined,
      category_code: request.category_code,
      security_flag: request.security_flag,
    };

    const response = await requestKakaoApi<KakaoBaseResponse>(
      '/akv10/template/modify/',
      params
    );

    return {
      success: true,
      message: response.message || '템플릿이 수정되었습니다.',
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -999,
      testMode,
    };
  }
}

/**
 * 템플릿 삭제 요청
 */
export interface TemplateDeleteRequest {
  tpl_code: string;
}

/**
 * 템플릿 삭제
 *
 * 등록된 템플릿을 삭제합니다.
 * 템플릿 코드가 D나 P로 시작하는 공유 템플릿은 삭제할 수 없습니다.
 *
 * @param request 템플릿 삭제 요청
 * @returns 삭제 결과
 */
export async function deleteTemplate(request: TemplateDeleteRequest): Promise<OperationResult> {
  const testMode = getKakaoAligoTestMode();

  if (!isAlimtalkConfigured()) {
    return {
      success: false,
      message: '카카오 알림톡 설정이 완료되지 않았습니다.',
      errorCode: -900,
      testMode,
    };
  }

  try {
    const params: Record<string, string | number | undefined> = {
      tpl_code: request.tpl_code,
    };

    const response = await requestKakaoApi<KakaoBaseResponse>(
      '/akv10/template/del/',
      params
    );

    return {
      success: true,
      message: response.message || '템플릿이 삭제되었습니다.',
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -999,
      testMode,
    };
  }
}

/**
 * 템플릿 검수 요청
 */
export interface TemplateReviewRequest {
  tpl_code: string;
}

/**
 * 템플릿 검수 요청
 *
 * 등록된 템플릿에 대해 카카오 검수를 요청합니다.
 * 검수는 4-5일 정도 소요되며, 거부 시 재작성이 필요할 수 있습니다.
 *
 * @param request 검수 요청
 * @returns 검수 요청 결과
 */
export async function requestTemplateReview(request: TemplateReviewRequest): Promise<OperationResult> {
  const testMode = getKakaoAligoTestMode();

  if (!isAlimtalkConfigured()) {
    return {
      success: false,
      message: '카카오 알림톡 설정이 완료되지 않았습니다.',
      errorCode: -900,
      testMode,
    };
  }

  try {
    const params: Record<string, string | number | undefined> = {
      tpl_code: request.tpl_code,
    };

    const response = await requestKakaoApi<KakaoBaseResponse>(
      '/akv10/template/request/',
      params
    );

    return {
      success: true,
      message: response.message || '템플릿 검수 요청이 완료되었습니다.',
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -999,
      testMode,
    };
  }
}

// ============================================================================
// 친구톡 발송 API
// ============================================================================

/**
 * 친구톡 발송 요청
 */
export interface FriendtalkSendRequest {
  /** 수신자 전화번호 */
  receiver: string;
  /** 수신자 이름 */
  recvname?: string;
  /** 메시지 내용 */
  message: string;
  /** 광고 여부 */
  adFlag?: boolean;
  /** 이미지 URL */
  imageUrl?: string;
  /** 와이드 이미지 사용 여부 */
  wideImage?: boolean;
  /** 버튼 정보 (JSON 문자열) */
  button?: string;
  /** SMS 대체발송 여부 */
  failover?: boolean;
  /** 대체발송 제목 */
  failoverSubject?: string;
  /** 대체발송 내용 */
  failoverMessage?: string;
  /** 예약 일시 (YYYYMMDDHHmmss) */
  senddate?: string;
}

/**
 * 친구톡 발송 결과
 */
export interface FriendtalkSendResult {
  success: boolean;
  mid?: string;
  count: number;
  errorMessage?: string;
  errorCode?: number;
  testMode: boolean;
}

/**
 * 친구톡 발송
 *
 * 카카오톡 친구에게 친구톡을 발송합니다.
 * 친구톡은 채널 친구에게만 발송할 수 있습니다.
 *
 * @param request 발송 요청
 * @returns 발송 결과
 */
export async function sendFriendtalk(request: FriendtalkSendRequest): Promise<FriendtalkSendResult> {
  const testMode = getKakaoAligoTestMode();

  if (!isAlimtalkConfigured()) {
    return {
      success: false,
      count: 0,
      errorMessage: '카카오 알림톡 설정이 완료되지 않았습니다.',
      errorCode: -900,
      testMode,
    };
  }

  try {
    const credentials = getKakaoAligoCredentials();
    const params: Record<string, string | number | undefined> = {
      senderkey: credentials.senderkey,
      adFlag: request.adFlag ? 'Y' : 'N',
      sender: getSmsSender(),
      msg_1: request.message,
      receiver_1: normalizePhoneNumber(request.receiver),
      recvname_1: request.recvname,
      image_1: request.imageUrl,
      image_type: request.wideImage ? 'W' : 'S',
      button_1: request.button,
      senddate: request.senddate,
    };

    if (request.failover) {
      params.failover = 'Y';
      if (request.failoverSubject) params.fsubject_1 = request.failoverSubject;
      if (request.failoverMessage) params.fmessage_1 = request.failoverMessage;
    }

    const response = await requestKakaoApi<AlimtalkApiResponse>('/akv10/friend/send/', params);

    return {
      success: true,
      mid: response.info?.mid,
      count: response.info?.cnt ?? 1,
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      count: 0,
      errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -999,
      testMode,
    };
  }
}

// ============================================================================
// 발송 내역 조회 API
// ============================================================================

/**
 * 발송 내역 조회 요청
 */
export interface HistoryListRequest {
  page?: number;
  limit?: number;
  startdate?: string;
  enddate?: string;
}

/**
 * 발송 내역 항목
 */
export interface HistoryItem {
  mid: string;
  type: string;
  sender: string;
  cnt: string;
  state: string;
  reserve: string;
  regdate: string;
}

/**
 * 발송 내역 결과
 */
export interface HistoryListResult {
  success: boolean;
  items?: HistoryItem[];
  currentPage?: number;
  totalPage?: number;
  errorMessage?: string;
  errorCode?: number;
  testMode: boolean;
}

interface HistoryApiResponse extends KakaoBaseResponse {
  list?: HistoryItem[];
  currentPage?: number;
  totalPage?: number;
}

/**
 * 발송 내역 목록 조회
 *
 * 알림톡/친구톡 발송 내역을 조회합니다.
 *
 * @param request 조회 요청
 * @returns 발송 내역 목록
 */
export async function getHistory(request?: HistoryListRequest): Promise<HistoryListResult> {
  const testMode = getKakaoAligoTestMode();

  if (!isAlimtalkConfigured()) {
    return {
      success: false,
      errorMessage: '카카오 알림톡 설정이 완료되지 않았습니다.',
      errorCode: -900,
      testMode,
    };
  }

  try {
    const params: Record<string, string | number | undefined> = {
      page: request?.page ?? 1,
      limit: request?.limit ?? 30,
      startdate: request?.startdate,
      enddate: request?.enddate,
    };

    const response = await requestKakaoApi<HistoryApiResponse>(
      '/akv10/history/list/',
      params
    );

    return {
      success: true,
      items: response.list,
      currentPage: response.currentPage,
      totalPage: response.totalPage,
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -999,
      testMode,
    };
  }
}

/**
 * 발송 상세 조회 요청
 */
export interface HistoryDetailRequest {
  mid: number;
  page?: number;
  limit?: number;
}

/**
 * 발송 상세 항목
 */
export interface HistoryDetailItem {
  receiver: string;
  status: string;
  code: string;
  senddate: string;
  reportdate?: string;
}

/**
 * 발송 상세 결과
 */
export interface HistoryDetailResult {
  success: boolean;
  items?: HistoryDetailItem[];
  currentPage?: number;
  totalPage?: number;
  errorMessage?: string;
  errorCode?: number;
  testMode: boolean;
}

interface HistoryDetailApiResponse extends KakaoBaseResponse {
  list?: HistoryDetailItem[];
  currentPage?: number;
  totalPage?: number;
}

/**
 * 발송 상세 조회
 *
 * 특정 발송 건의 상세 결과를 조회합니다.
 *
 * @param request 조회 요청
 * @returns 발송 상세 목록
 */
export async function getHistoryDetail(request: HistoryDetailRequest): Promise<HistoryDetailResult> {
  const testMode = getKakaoAligoTestMode();

  if (!isAlimtalkConfigured()) {
    return {
      success: false,
      errorMessage: '카카오 알림톡 설정이 완료되지 않았습니다.',
      errorCode: -900,
      testMode,
    };
  }

  try {
    const params: Record<string, string | number | undefined> = {
      mid: request.mid,
      page: request.page ?? 1,
      limit: request.limit ?? 30,
    };

    const response = await requestKakaoApi<HistoryDetailApiResponse>(
      '/akv10/history/detail/',
      params
    );

    return {
      success: true,
      items: response.list,
      currentPage: response.currentPage,
      totalPage: response.totalPage,
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -999,
      testMode,
    };
  }
}

// ============================================================================
// 잔여 포인트 조회 API
// ============================================================================

/**
 * 잔여 포인트 결과
 */
export interface RemainResult {
  success: boolean;
  alimtalk?: number;
  friendtalkText?: number;
  friendtalkImage?: number;
  friendtalkWide?: number;
  errorMessage?: string;
  errorCode?: number;
  testMode: boolean;
}

interface RemainApiResponse extends KakaoBaseResponse {
  AT_CNT?: number;
  FT_CNT?: number;
  FI_CNT?: number;
  FW_CNT?: number;
}

/**
 * 잔여 포인트 조회
 *
 * 알림톡/친구톡 발송 가능 잔여 포인트를 조회합니다.
 *
 * @returns 잔여 포인트 정보
 */
export async function getRemain(): Promise<RemainResult> {
  const testMode = getKakaoAligoTestMode();

  if (!isAlimtalkConfigured()) {
    return {
      success: false,
      errorMessage: '카카오 알림톡 설정이 완료되지 않았습니다.',
      errorCode: -900,
      testMode,
    };
  }

  try {
    const response = await requestKakaoApi<RemainApiResponse>(
      '/akv10/remain/',
      {}
    );

    return {
      success: true,
      alimtalk: response.AT_CNT,
      friendtalkText: response.FT_CNT,
      friendtalkImage: response.FI_CNT,
      friendtalkWide: response.FW_CNT,
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -999,
      testMode,
    };
  }
}

// ============================================================================
// 예약 취소 API
// ============================================================================

/**
 * 예약 취소 결과
 */
export interface CancelResult {
  success: boolean;
  cancelCount?: number;
  errorMessage?: string;
  errorCode?: number;
  testMode: boolean;
}

interface CancelApiResponse extends KakaoBaseResponse {
  data?: {
    cnt?: number;
  };
}

/**
 * 예약 발송 취소
 *
 * 예약된 알림톡/친구톡 발송을 취소합니다.
 * 발송 5분 전까지만 취소 가능합니다.
 *
 * @param mid 메시지 ID
 * @returns 취소 결과
 */
export async function cancelScheduled(mid: number): Promise<CancelResult> {
  const testMode = getKakaoAligoTestMode();

  if (!isAlimtalkConfigured()) {
    return {
      success: false,
      errorMessage: '카카오 알림톡 설정이 완료되지 않았습니다.',
      errorCode: -900,
      testMode,
    };
  }

  try {
    const params: Record<string, string | number | undefined> = {
      mid,
    };

    const response = await requestKakaoApi<CancelApiResponse>(
      '/akv10/cancel/',
      params
    );

    return {
      success: true,
      cancelCount: response.data?.cnt,
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -999,
      testMode,
    };
  }
}

// ============================================================================
// 내부 헬퍼 함수
// ============================================================================

/**
 * senderkey 없이 카카오 API 요청 (채널 인증, 카테고리 조회 등)
 */
async function requestKakaoApiWithoutSenderKey<T extends KakaoBaseResponse>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  timeout = 30000
): Promise<T> {
  const testMode = getKakaoAligoTestMode();
  const url = `${KAKAO_API_BASE_URL}${endpoint}`;

  const formData = new URLSearchParams();
  formData.append('apikey', envServer.KAKAO_ALIGO_API_KEY || '');
  formData.append('userid', envServer.KAKAO_ALIGO_USER_ID || '');

  if (envServer.KAKAO_ALIGO_TOKEN) {
    formData.append('token', envServer.KAKAO_ALIGO_TOKEN);
  }

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  }

  if (testMode) {
    formData.append('testMode', 'Y');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP 오류: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as T;

    if (data.code !== 0) {
      throw new Error(data.message || '알 수 없는 오류');
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('요청 타임아웃');
    }

    throw error;
  }
}

// Re-export
export { isKakaoAligoConfigured, getKakaoAligoTestMode } from './env-registry.ts';
