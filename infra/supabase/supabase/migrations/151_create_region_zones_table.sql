-- ============================================================================
-- 권역(Region Zone) 매핑 테이블 생성
--
-- 아키텍처 문서 3.6.7: 권역 단위 통계 비교 (Fallback 4순위)
-- 시도 코드(sido_code) → 권역(region_zone) 매핑
-- ============================================================================

-- 권역 마스터 테이블
CREATE TABLE IF NOT EXISTS public.core_region_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 권역 코드 (예: "CAPITAL", "GYEONGGI", "CHUNGCHEONG")
  zone_code TEXT NOT NULL UNIQUE,

  -- 권역 이름 (예: "수도권", "경기권", "충청권")
  zone_name TEXT NOT NULL,

  -- 정렬 순서
  sort_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 시도 → 권역 매핑 테이블
CREATE TABLE IF NOT EXISTS public.core_sido_zone_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 시도 코드 (core_regions.code, level='si')
  sido_code TEXT NOT NULL UNIQUE,

  -- 권역 참조
  zone_id UUID NOT NULL REFERENCES public.core_region_zones(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_core_sido_zone_mappings_sido_code
  ON public.core_sido_zone_mappings(sido_code);
CREATE INDEX IF NOT EXISTS idx_core_sido_zone_mappings_zone_id
  ON public.core_sido_zone_mappings(zone_id);

-- RLS 정책 (읽기 전용, 모든 인증된 사용자 접근 가능)
ALTER TABLE public.core_region_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_sido_zone_mappings ENABLE ROW LEVEL SECURITY;

-- 읽기 정책 (인증된 사용자)
CREATE POLICY "core_region_zones_read_authenticated"
  ON public.core_region_zones
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "core_sido_zone_mappings_read_authenticated"
  ON public.core_sido_zone_mappings
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 권역 데이터 시드 (한국 표준 5대 권역 + 세분화)
-- ============================================================================

-- 권역 마스터 데이터
INSERT INTO public.core_region_zones (zone_code, zone_name, sort_order) VALUES
  ('CAPITAL', '수도권', 1),           -- 서울, 인천, 경기
  ('GANGWON', '강원권', 2),           -- 강원
  ('CHUNGCHEONG', '충청권', 3),       -- 대전, 세종, 충북, 충남
  ('HONAM', '호남권', 4),             -- 광주, 전북, 전남
  ('YEONGNAM', '영남권', 5),          -- 부산, 대구, 울산, 경북, 경남
  ('JEJU', '제주권', 6)               -- 제주
ON CONFLICT (zone_code) DO NOTHING;

-- 시도 → 권역 매핑 데이터
-- 시도 코드는 행정표준코드관리시스템 기준 (앞 2자리)
INSERT INTO public.core_sido_zone_mappings (sido_code, zone_id)
SELECT sido_code, zone_id FROM (
  VALUES
    -- 수도권
    ('11', (SELECT id FROM public.core_region_zones WHERE zone_code = 'CAPITAL')),  -- 서울특별시
    ('28', (SELECT id FROM public.core_region_zones WHERE zone_code = 'CAPITAL')),  -- 인천광역시
    ('41', (SELECT id FROM public.core_region_zones WHERE zone_code = 'CAPITAL')),  -- 경기도

    -- 강원권
    ('42', (SELECT id FROM public.core_region_zones WHERE zone_code = 'GANGWON')),  -- 강원특별자치도

    -- 충청권
    ('30', (SELECT id FROM public.core_region_zones WHERE zone_code = 'CHUNGCHEONG')),  -- 대전광역시
    ('36', (SELECT id FROM public.core_region_zones WHERE zone_code = 'CHUNGCHEONG')),  -- 세종특별자치시
    ('43', (SELECT id FROM public.core_region_zones WHERE zone_code = 'CHUNGCHEONG')),  -- 충청북도
    ('44', (SELECT id FROM public.core_region_zones WHERE zone_code = 'CHUNGCHEONG')),  -- 충청남도

    -- 호남권
    ('29', (SELECT id FROM public.core_region_zones WHERE zone_code = 'HONAM')),  -- 광주광역시
    ('45', (SELECT id FROM public.core_region_zones WHERE zone_code = 'HONAM')),  -- 전북특별자치도
    ('46', (SELECT id FROM public.core_region_zones WHERE zone_code = 'HONAM')),  -- 전라남도

    -- 영남권
    ('26', (SELECT id FROM public.core_region_zones WHERE zone_code = 'YEONGNAM')),  -- 부산광역시
    ('27', (SELECT id FROM public.core_region_zones WHERE zone_code = 'YEONGNAM')),  -- 대구광역시
    ('31', (SELECT id FROM public.core_region_zones WHERE zone_code = 'YEONGNAM')),  -- 울산광역시
    ('47', (SELECT id FROM public.core_region_zones WHERE zone_code = 'YEONGNAM')),  -- 경상북도
    ('48', (SELECT id FROM public.core_region_zones WHERE zone_code = 'YEONGNAM')),  -- 경상남도

    -- 제주권
    ('50', (SELECT id FROM public.core_region_zones WHERE zone_code = 'JEJU'))   -- 제주특별자치도
) AS t(sido_code, zone_id)
ON CONFLICT (sido_code) DO NOTHING;

-- updated_at 트리거
CREATE OR REPLACE FUNCTION public.update_core_region_zones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_core_region_zones_updated_at ON public.core_region_zones;
CREATE TRIGGER trg_core_region_zones_updated_at
  BEFORE UPDATE ON public.core_region_zones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_core_region_zones_updated_at();

-- 권역 조회 RPC 함수 (시도 코드로 권역 정보 조회)
CREATE OR REPLACE FUNCTION public.get_region_zone_by_sido_code(p_sido_code TEXT)
RETURNS TABLE (
  zone_id UUID,
  zone_code TEXT,
  zone_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rz.id AS zone_id,
    rz.zone_code,
    rz.zone_name
  FROM public.core_sido_zone_mappings szm
  JOIN public.core_region_zones rz ON szm.zone_id = rz.id
  WHERE szm.sido_code = p_sido_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.get_region_zone_by_sido_code(TEXT) TO authenticated;

COMMENT ON TABLE public.core_region_zones IS '권역 마스터 테이블 (아키텍처 문서 3.6.7)';
COMMENT ON TABLE public.core_sido_zone_mappings IS '시도→권역 매핑 테이블';
COMMENT ON FUNCTION public.get_region_zone_by_sido_code IS '시도 코드로 권역 정보 조회';
