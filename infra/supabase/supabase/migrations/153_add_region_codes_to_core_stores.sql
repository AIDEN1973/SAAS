-- ============================================================================
-- core_stores 테이블에 지역 코드 직접 저장 컬럼 추가
--
-- 카카오 주소 검색 API 연동으로 행정구역 코드를 직접 저장
-- core_regions 테이블 조인 없이 지역 정보 조회 가능
-- ============================================================================

-- 지역 코드 컬럼 추가
ALTER TABLE core_stores
  ADD COLUMN IF NOT EXISTS sido_code TEXT,           -- 시도 코드 (2자리, 예: "11")
  ADD COLUMN IF NOT EXISTS sido_name TEXT,           -- 시도명 (예: "서울특별시")
  ADD COLUMN IF NOT EXISTS sigungu_code TEXT,        -- 시군구 코드 (5자리, 예: "11680")
  ADD COLUMN IF NOT EXISTS sigungu_name TEXT,        -- 시군구명 (예: "강남구")
  ADD COLUMN IF NOT EXISTS dong_code TEXT,           -- 행정동 코드 (10자리, 예: "1168010100")
  ADD COLUMN IF NOT EXISTS dong_name TEXT;           -- 행정동명 (예: "역삼1동")

-- region_id를 nullable로 변경 (카카오 API 방식에서는 사용하지 않음)
ALTER TABLE core_stores
  ALTER COLUMN region_id DROP NOT NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_core_stores_sido_code ON core_stores(sido_code);
CREATE INDEX IF NOT EXISTS idx_core_stores_sigungu_code ON core_stores(sigungu_code);
CREATE INDEX IF NOT EXISTS idx_core_stores_dong_code ON core_stores(dong_code);

-- 복합 인덱스 (지역 통계용)
CREATE INDEX IF NOT EXISTS idx_core_stores_industry_sido ON core_stores(industry_type, sido_code);
CREATE INDEX IF NOT EXISTS idx_core_stores_industry_sigungu ON core_stores(industry_type, sigungu_code);
CREATE INDEX IF NOT EXISTS idx_core_stores_industry_dong ON core_stores(industry_type, dong_code);

COMMENT ON COLUMN core_stores.sido_code IS '시도 코드 (2자리, 카카오 API h_code 앞 2자리)';
COMMENT ON COLUMN core_stores.sido_name IS '시도명 (카카오 API region_1depth_name)';
COMMENT ON COLUMN core_stores.sigungu_code IS '시군구 코드 (5자리, 카카오 API h_code 앞 5자리)';
COMMENT ON COLUMN core_stores.sigungu_name IS '시군구명 (카카오 API region_2depth_name)';
COMMENT ON COLUMN core_stores.dong_code IS '행정동 코드 (10자리, 카카오 API h_code)';
COMMENT ON COLUMN core_stores.dong_name IS '행정동명 (카카오 API region_3depth_h_name)';
