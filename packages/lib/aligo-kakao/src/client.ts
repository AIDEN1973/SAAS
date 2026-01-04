/**
 * 알리고 카카오 알림톡/친구톡 API 클라이언트
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 개발/프로덕션 모드 모두 지원 (testMode 파라미터)
 * [불변 규칙] 알림톡 기본, SMS 폴백 지원
 *
 * 공식 문서: https://smartsms.aligo.in/admin/api/kakao.html
 */

import type {
  KakaoCredentials,
  KakaoClientOptions,
  KakaoBaseResponse,
  TokenCreateRequest,
  TokenCreateResponse,
  CategoryListResponse,
  ProfileAddRequest,
  ProfileAddResponse,
  ProfileListResponse,
  TemplateListRequest,
  TemplateListResponse,
  TemplateAddRequest,
  TemplateAddResponse,
  TemplateModifyRequest,
  TemplateDeleteRequest,
  TemplateRequestRequest,
  AlimtalkSendRequest,
  AlimtalkSendResponse,
  AlimtalkBulkSendRequest,
  FriendtalkSendRequest,
  FriendtalkSendResponse,
  HistoryListRequest,
  HistoryListResponse,
  HistoryDetailRequest,
  HistoryDetailResponse,
  RemainResponse,
  CancelRequest,
  CancelResponse,
  SendResult,
} from './types.ts';
import { KakaoApiError } from './types.ts';

/** 알리고 카카오 API 기본 URL */
const KAKAO_API_BASE_URL = 'https://kakaoapi.aligo.in';

/** 대량 발송 최대 건수 */
const BULK_SEND_MAX_COUNT = 500;

/**
 * 전화번호 정규화 (하이픈 제거)
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * 알리고 카카오 클라이언트
 */
export class AligoKakaoClient {
  private readonly credentials: KakaoCredentials;
  private readonly testMode: boolean;
  private readonly timeout: number;

  constructor(options: KakaoClientOptions) {
    this.credentials = options.credentials;
    this.testMode = options.testMode ?? true; // 안전 기본값: 테스트 모드
    this.timeout = options.timeout ?? 30000;
  }

  // ============================================================================
  // 공통 API 요청
  // ============================================================================

  /**
   * API 요청 전송 (공통)
   */
  private async request<T extends KakaoBaseResponse>(
    endpoint: string,
    params: Record<string, string | number | undefined>,
    options?: { skipAuth?: boolean }
  ): Promise<T> {
    const url = `${KAKAO_API_BASE_URL}${endpoint}`;

    // FormData 생성
    const formData = new URLSearchParams();
    formData.append('apikey', this.credentials.apikey);
    formData.append('userid', this.credentials.userid);

    // senderkey는 일부 API에서만 필요
    if (this.credentials.senderkey && !options?.skipAuth) {
      formData.append('senderkey', this.credentials.senderkey);
    }

    // token이 있으면 추가
    if (this.credentials.token) {
      formData.append('token', this.credentials.token);
    }

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }

    // 테스트 모드 설정
    if (this.testMode) {
      formData.append('testMode', 'Y');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

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
        throw new KakaoApiError(
          `HTTP 오류: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data = (await response.json()) as T;

      // API 응답 코드 확인 (0이 아니면 실패)
      if (data.code !== 0) {
        throw new KakaoApiError(data.message || '알 수 없는 오류', data.code, data);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof KakaoApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new KakaoApiError('요청 타임아웃', -999);
      }

      throw new KakaoApiError(
        error instanceof Error ? error.message : '알 수 없는 오류',
        -998
      );
    }
  }

  // ============================================================================
  // 토큰 관리
  // ============================================================================

  /**
   * 인증 토큰 생성
   *
   * @param request 토큰 생성 요청
   * @returns 토큰 생성 응답
   */
  async createToken(request: TokenCreateRequest): Promise<TokenCreateResponse> {
    const params: Record<string, string | number | undefined> = {
      plusid: request.plusid,
      phonenumber: normalizePhoneNumber(request.phonenumber),
    };

    return this.request<TokenCreateResponse>('/akv10/token/create/1000/y/', params, { skipAuth: true });
  }

  // ============================================================================
  // 카테고리 조회
  // ============================================================================

  /**
   * 카테고리 목록 조회
   *
   * @param groupCode 그룹 코드 (하위 카테고리 조회 시)
   * @returns 카테고리 목록
   */
  async getCategories(groupCode?: string): Promise<CategoryListResponse> {
    const params: Record<string, string | number | undefined> = {};
    if (groupCode) {
      params.groupcode = groupCode;
    }

    return this.request<CategoryListResponse>('/akv10/category/', params, { skipAuth: true });
  }

  // ============================================================================
  // 프로필 관리
  // ============================================================================

  /**
   * 발신 프로필 등록
   *
   * @param request 프로필 등록 요청
   * @returns 등록 결과
   */
  async addProfile(request: ProfileAddRequest): Promise<ProfileAddResponse> {
    const params: Record<string, string | number | undefined> = {
      plusid: request.plusid,
      categorycode: request.categorycode,
      phonenumber: normalizePhoneNumber(request.phonenumber),
    };

    return this.request<ProfileAddResponse>('/akv10/profile/add/', params);
  }

  /**
   * 발신 프로필 목록 조회
   *
   * @returns 프로필 목록
   */
  async getProfiles(): Promise<ProfileListResponse> {
    return this.request<ProfileListResponse>('/akv10/profile/list/', {});
  }

  // ============================================================================
  // 템플릿 관리
  // ============================================================================

  /**
   * 템플릿 목록 조회
   *
   * @param request 조회 요청
   * @returns 템플릿 목록
   */
  async getTemplates(request: TemplateListRequest): Promise<TemplateListResponse> {
    const params: Record<string, string | number | undefined> = {
      senderkey: request.senderkey,
      token: request.token,
      tpl_code: request.tpl_code,
    };

    return this.request<TemplateListResponse>('/akv10/template/list/', params);
  }

  /**
   * 템플릿 등록
   *
   * @param request 등록 요청
   * @returns 등록 결과
   */
  async addTemplate(request: TemplateAddRequest): Promise<TemplateAddResponse> {
    const params: Record<string, string | number | undefined> = {
      senderkey: request.senderkey,
      token: request.token,
      tpl_name: request.tpl_name,
      tpl_content: request.tpl_content,
      tpl_message_type: request.tpl_message_type,
      tpl_emphasis_type: request.tpl_emphasis_type,
      emphasis_title: request.emphasis_title,
      emphasis_subtitle: request.emphasis_subtitle,
      tpl_extra: request.tpl_extra,
      tpl_ad: request.tpl_ad,
      tpl_button: request.tpl_button ? JSON.stringify(request.tpl_button) : undefined,
      category_code: request.category_code,
      security_flag: request.security_flag,
    };

    return this.request<TemplateAddResponse>('/akv10/template/add/', params);
  }

  /**
   * 템플릿 수정
   *
   * @param request 수정 요청
   * @returns 수정 결과
   */
  async modifyTemplate(request: TemplateModifyRequest): Promise<KakaoBaseResponse> {
    const params: Record<string, string | number | undefined> = {
      senderkey: request.senderkey,
      token: request.token,
      tpl_code: request.tpl_code,
      tpl_name: request.tpl_name,
      tpl_content: request.tpl_content,
      tpl_message_type: request.tpl_message_type,
      tpl_emphasis_type: request.tpl_emphasis_type,
      emphasis_title: request.emphasis_title,
      emphasis_subtitle: request.emphasis_subtitle,
      tpl_extra: request.tpl_extra,
      tpl_ad: request.tpl_ad,
      tpl_button: request.tpl_button ? JSON.stringify(request.tpl_button) : undefined,
      category_code: request.category_code,
      security_flag: request.security_flag,
    };

    return this.request<KakaoBaseResponse>('/akv10/template/modify/', params);
  }

  /**
   * 템플릿 삭제
   *
   * @param request 삭제 요청
   * @returns 삭제 결과
   */
  async deleteTemplate(request: TemplateDeleteRequest): Promise<KakaoBaseResponse> {
    const params: Record<string, string | number | undefined> = {
      senderkey: request.senderkey,
      token: request.token,
      tpl_code: request.tpl_code,
    };

    return this.request<KakaoBaseResponse>('/akv10/template/delete/', params);
  }

  /**
   * 템플릿 검수 요청
   *
   * @param request 검수 요청
   * @returns 검수 요청 결과
   */
  async requestTemplateReview(request: TemplateRequestRequest): Promise<KakaoBaseResponse> {
    const params: Record<string, string | number | undefined> = {
      senderkey: request.senderkey,
      token: request.token,
      tpl_code: request.tpl_code,
    };

    return this.request<KakaoBaseResponse>('/akv10/template/request/', params);
  }

  // ============================================================================
  // 알림톡 발송
  // ============================================================================

  /**
   * 알림톡 단건 발송
   *
   * @param request 발송 요청
   * @returns 발송 결과
   */
  async sendAlimtalk(request: AlimtalkSendRequest): Promise<SendResult> {
    const params: Record<string, string | number | undefined> = {
      senderkey: request.senderkey,
      tpl_code: request.tpl_code,
      sender: request.sender,
      msg_1: request.msg_1,
      receiver_1: normalizePhoneNumber(request.receiver_1),
      recvname_1: request.recvname_1,
      button_1: request.button_1,
      senddate: request.senddate,
    };

    // SMS 대체발송 설정
    if (request.failover === 'Y') {
      params.failover = 'Y';
      if (request.fsubject_1) params.fsubject_1 = request.fsubject_1;
      if (request.fmessage_1) params.fmessage_1 = request.fmessage_1;
    }

    // 테스트 모드 오버라이드
    if (request.testMode === 'Y') {
      params.testMode = 'Y';
    }

    try {
      const response = await this.request<AlimtalkSendResponse>('/akv10/alimtalk/send/', params);

      return {
        success: true,
        mid: response.info?.mid,
        count: response.info?.cnt ?? 1,
        type: 'AT',
        usedFallback: false,
      };
    } catch (error) {
      if (error instanceof KakaoApiError) {
        return {
          success: false,
          count: 0,
          errorMessage: error.message,
          errorCode: error.code,
        };
      }
      throw error;
    }
  }

  /**
   * 알림톡 대량 발송
   *
   * @param request 대량 발송 요청
   * @returns 발송 결과
   */
  async sendAlimtalkBulk(request: AlimtalkBulkSendRequest): Promise<SendResult> {
    if (request.recipients.length > BULK_SEND_MAX_COUNT) {
      return {
        success: false,
        count: 0,
        errorMessage: `수신자 수가 최대 ${BULK_SEND_MAX_COUNT}명을 초과합니다.`,
        errorCode: -901,
      };
    }

    if (request.recipients.length === 0) {
      return {
        success: false,
        count: 0,
        errorMessage: '수신자가 없습니다.',
        errorCode: -902,
      };
    }

    const params: Record<string, string | number | undefined> = {
      senderkey: request.senderkey,
      tpl_code: request.tpl_code,
      sender: request.sender,
      senddate: request.senddate,
      cnt: request.recipients.length,
    };

    // 개별 수신자 정보 추가
    request.recipients.forEach((recipient, index) => {
      const num = index + 1;
      params[`receiver_${num}`] = normalizePhoneNumber(recipient.receiver);
      params[`msg_${num}`] = recipient.msg;
      if (recipient.recvname) params[`recvname_${num}`] = recipient.recvname;
      if (recipient.button) params[`button_${num}`] = recipient.button;
      if (recipient.failover === 'Y') {
        params[`failover_${num}`] = 'Y';
        if (recipient.fsubject) params[`fsubject_${num}`] = recipient.fsubject;
        if (recipient.fmessage) params[`fmessage_${num}`] = recipient.fmessage;
      }
    });

    // 테스트 모드 오버라이드
    if (request.testMode === 'Y') {
      params.testMode = 'Y';
    }

    try {
      const response = await this.request<AlimtalkSendResponse>('/akv10/alimtalk/send/', params);

      return {
        success: true,
        mid: response.info?.mid,
        count: response.info?.cnt ?? request.recipients.length,
        type: 'AT',
        usedFallback: false,
      };
    } catch (error) {
      if (error instanceof KakaoApiError) {
        return {
          success: false,
          count: 0,
          errorMessage: error.message,
          errorCode: error.code,
        };
      }
      throw error;
    }
  }

  // ============================================================================
  // 친구톡 발송
  // ============================================================================

  /**
   * 친구톡 발송
   *
   * @param request 발송 요청
   * @returns 발송 결과
   */
  async sendFriendtalk(request: FriendtalkSendRequest): Promise<SendResult> {
    const params: Record<string, string | number | undefined> = {
      senderkey: request.senderkey,
      adFlag: request.adFlag,
      sender: request.sender,
      msg_1: request.msg_1,
      receiver_1: normalizePhoneNumber(request.receiver_1),
      recvname_1: request.recvname_1,
      image_1: request.image_1,
      image_type: request.image_type,
      button_1: request.button_1,
      senddate: request.senddate,
    };

    // SMS 대체발송 설정
    if (request.failover === 'Y') {
      params.failover = 'Y';
      if (request.fsubject_1) params.fsubject_1 = request.fsubject_1;
      if (request.fmessage_1) params.fmessage_1 = request.fmessage_1;
    }

    // 테스트 모드 오버라이드
    if (request.testMode === 'Y') {
      params.testMode = 'Y';
    }

    try {
      const response = await this.request<FriendtalkSendResponse>('/akv10/friend/send/', params);

      return {
        success: true,
        mid: response.info?.mid,
        count: response.info?.cnt ?? 1,
        type: 'FT',
        usedFallback: false,
      };
    } catch (error) {
      if (error instanceof KakaoApiError) {
        return {
          success: false,
          count: 0,
          errorMessage: error.message,
          errorCode: error.code,
        };
      }
      throw error;
    }
  }

  // ============================================================================
  // 발송 내역 조회
  // ============================================================================

  /**
   * 발송 내역 목록 조회
   *
   * @param request 조회 요청
   * @returns 발송 내역 목록
   */
  async getHistory(request?: HistoryListRequest): Promise<HistoryListResponse> {
    const params: Record<string, string | number | undefined> = {
      page: request?.page ?? 1,
      limit: request?.limit ?? 30,
      startdate: request?.startdate,
      enddate: request?.enddate,
    };

    return this.request<HistoryListResponse>('/akv10/history/list/', params);
  }

  /**
   * 발송 상세 조회
   *
   * @param request 조회 요청
   * @returns 발송 상세 목록
   */
  async getHistoryDetail(request: HistoryDetailRequest): Promise<HistoryDetailResponse> {
    const params: Record<string, string | number | undefined> = {
      mid: request.mid,
      page: request.page ?? 1,
      limit: request.limit ?? 30,
    };

    return this.request<HistoryDetailResponse>('/akv10/history/detail/', params);
  }

  // ============================================================================
  // 잔여 포인트 조회
  // ============================================================================

  /**
   * 잔여 포인트 조회
   *
   * @returns 잔여 포인트 정보
   */
  async getRemain(): Promise<RemainResponse> {
    return this.request<RemainResponse>('/akv10/remain/', {});
  }

  // ============================================================================
  // 예약 취소
  // ============================================================================

  /**
   * 예약 발송 취소
   *
   * @param request 취소 요청
   * @returns 취소 결과
   */
  async cancel(request: CancelRequest): Promise<CancelResponse> {
    const params: Record<string, string | number | undefined> = {
      mid: request.mid,
    };

    return this.request<CancelResponse>('/akv10/cancel/', params);
  }
}

/**
 * 알리고 카카오 클라이언트 생성 헬퍼 함수
 *
 * @param credentials 인증 정보
 * @param testMode 테스트 모드 (기본값: true, 안전 기본값)
 * @returns AligoKakaoClient 인스턴스
 */
export function createKakaoClient(
  credentials: KakaoCredentials,
  testMode = true
): AligoKakaoClient {
  return new AligoKakaoClient({
    credentials,
    testMode,
  });
}
