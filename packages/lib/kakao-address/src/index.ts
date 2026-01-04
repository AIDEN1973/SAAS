/**
 * 카카오 주소 검색 API 유틸리티
 *
 * 카카오 로컬 API를 사용하여 주소 검색 및 행정구역 코드 조회
 * https://developers.kakao.com/docs/latest/ko/local/dev-guide
 *
 * [불변 규칙] 클라이언트에서 직접 호출 시 REST API 키 사용
 * [불변 규칙] 서버에서 호출 시 Admin 키 사용 (Edge Function)
 */

/**
 * 카카오 주소 검색 결과 타입
 */
export interface KakaoAddressResult {
  /** 전체 주소 */
  address_name: string;
  /** 시도명 (예: "서울특별시") */
  region_1depth_name: string;
  /** 시군구명 (예: "강남구") */
  region_2depth_name: string;
  /** 읍면동명 (예: "역삼동") */
  region_3depth_name: string;
  /** 행정동 코드 (예: "1168010100") */
  h_code: string;
  /** 법정동 코드 */
  b_code: string;
  /** 위도 */
  y: string;
  /** 경도 */
  x: string;
}

/**
 * 파싱된 지역 정보 타입
 */
export interface ParsedRegionInfo {
  /** 시도명 */
  si: string;
  /** 시군구명 */
  gu: string;
  /** 읍면동명 */
  dong: string;
  /** 행정동 코드 (10자리) */
  h_code: string;
  /** 시도 코드 (2자리) */
  sido_code: string;
  /** 시군구 코드 (5자리) */
  sigungu_code: string;
  /** 위도 */
  latitude: number;
  /** 경도 */
  longitude: number;
  /** 전체 주소 */
  full_address: string;
}

/**
 * 카카오 주소 검색 API 호출
 *
 * @param query 검색할 주소
 * @param kakaoApiKey 카카오 REST API 키
 * @returns 검색 결과 목록
 */
export async function searchKakaoAddress(
  query: string,
  kakaoApiKey: string
): Promise<KakaoAddressResult[]> {
  const url = new URL('https://dapi.kakao.com/v2/local/search/address.json');
  url.searchParams.set('query', query);
  url.searchParams.set('analyze_type', 'similar');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `KakaoAK ${kakaoApiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`카카오 주소 검색 실패: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // 주소 검색 결과 파싱
  const results: KakaoAddressResult[] = [];

  for (const doc of data.documents || []) {
    // 지번 주소 또는 도로명 주소에서 행정구역 정보 추출
    const address = doc.address || doc.road_address;
    if (!address) continue;

    results.push({
      address_name: doc.address_name || address.address_name,
      region_1depth_name: address.region_1depth_name || '',
      region_2depth_name: address.region_2depth_name || '',
      region_3depth_name: address.region_3depth_h_name || address.region_3depth_name || '',
      h_code: address.h_code || '',
      b_code: address.b_code || '',
      y: doc.y || address.y || '0',
      x: doc.x || address.x || '0',
    });
  }

  return results;
}

/**
 * 좌표로 행정구역 정보 조회 (Reverse Geocoding)
 *
 * @param latitude 위도
 * @param longitude 경도
 * @param kakaoApiKey 카카오 REST API 키
 * @returns 행정구역 정보
 */
export async function getRegionByCoords(
  latitude: number,
  longitude: number,
  kakaoApiKey: string
): Promise<KakaoAddressResult | null> {
  const url = new URL('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json');
  url.searchParams.set('x', longitude.toString());
  url.searchParams.set('y', latitude.toString());

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `KakaoAK ${kakaoApiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`카카오 좌표 변환 실패: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // 행정동 정보 찾기 (region_type: 'H')
  const adminRegion = (data.documents || []).find(
    (doc: { region_type: string }) => doc.region_type === 'H'
  );

  if (!adminRegion) {
    return null;
  }

  return {
    address_name: adminRegion.address_name || '',
    region_1depth_name: adminRegion.region_1depth_name || '',
    region_2depth_name: adminRegion.region_2depth_name || '',
    region_3depth_name: adminRegion.region_3depth_name || '',
    h_code: adminRegion.code || '',
    b_code: '',
    y: latitude.toString(),
    x: longitude.toString(),
  };
}

/**
 * 행정동 코드에서 시도/시군구 코드 추출
 *
 * 행정동 코드 구조 (10자리):
 * - 앞 2자리: 시도 코드
 * - 앞 5자리: 시군구 코드
 * - 전체 10자리: 행정동 코드
 *
 * @param h_code 행정동 코드 (10자리)
 * @returns 파싱된 코드 정보
 */
export function parseRegionCodes(h_code: string): {
  sido_code: string;
  sigungu_code: string;
  dong_code: string;
} {
  const code = h_code.padEnd(10, '0');
  return {
    sido_code: code.substring(0, 2),
    sigungu_code: code.substring(0, 5),
    dong_code: code,
  };
}

/**
 * 카카오 주소 검색 결과를 파싱된 지역 정보로 변환
 *
 * @param result 카카오 주소 검색 결과
 * @returns 파싱된 지역 정보
 */
export function parseKakaoAddressResult(result: KakaoAddressResult): ParsedRegionInfo {
  const codes = parseRegionCodes(result.h_code);

  return {
    si: result.region_1depth_name,
    gu: result.region_2depth_name,
    dong: result.region_3depth_name,
    h_code: result.h_code,
    sido_code: codes.sido_code,
    sigungu_code: codes.sigungu_code,
    latitude: parseFloat(result.y) || 0,
    longitude: parseFloat(result.x) || 0,
    full_address: result.address_name,
  };
}

/**
 * 주소 검색 및 파싱 통합 함수
 *
 * @param query 검색할 주소
 * @param kakaoApiKey 카카오 REST API 키
 * @returns 파싱된 지역 정보 목록
 */
export async function searchAndParseAddress(
  query: string,
  kakaoApiKey: string
): Promise<ParsedRegionInfo[]> {
  const results = await searchKakaoAddress(query, kakaoApiKey);
  return results.map(parseKakaoAddressResult);
}
