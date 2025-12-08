/**
 * API SDK Types
 *
 * [불변 규칙] UI는 테넌트 ID나 업종을 직접 결정해서는 안 됨
 * [불변 규칙] 모든 요청은 SDK를 통해 자동으로 tenant_id, industry_type, auth token을 삽입합니다.
 */

export interface ApiRequest {
  tenant?: string;  // SDK가 자동으로 삽입
  industry?: string;  // SDK가 자동으로 삽입
  authorization?: string;  // SDK가 자동으로 삽입
  [key: string]: any;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export interface ApiClientConfig {
  tenantId?: string;  // Context에서 가져옴
  industryType?: string;  // Context에서 가져옴
  authToken?: string;  // Auth에서 가져옴
}
