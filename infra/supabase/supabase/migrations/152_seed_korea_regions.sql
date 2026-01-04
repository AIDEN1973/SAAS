-- ============================================================================
-- 한국 전체 행정구역 시드 데이터
--
-- 행정안전부 행정표준코드 기반 (2024년 기준)
-- 구조: 시도(si) → 시군구(gu_gun) → 읍면동(dong)
--
-- 참고: https://www.code.go.kr (행정표준코드관리시스템)
-- ============================================================================

-- 임시 테이블로 시드 데이터 관리 (중복 방지)
DO $$
DECLARE
  -- 시도 ID 변수
  v_seoul_id UUID;
  v_busan_id UUID;
  v_daegu_id UUID;
  v_incheon_id UUID;
  v_gwangju_id UUID;
  v_daejeon_id UUID;
  v_ulsan_id UUID;
  v_sejong_id UUID;
  v_gyeonggi_id UUID;
  v_gangwon_id UUID;
  v_chungbuk_id UUID;
  v_chungnam_id UUID;
  v_jeonbuk_id UUID;
  v_jeonnam_id UUID;
  v_gyeongbuk_id UUID;
  v_gyeongnam_id UUID;
  v_jeju_id UUID;

  -- 시군구 ID 변수 (일부)
  v_gu_id UUID;
BEGIN
  -- ========================================
  -- 1. 시도 (17개)
  -- ========================================

  -- 서울특별시
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '11', '서울특별시', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_seoul_id;
  IF v_seoul_id IS NULL THEN
    SELECT id INTO v_seoul_id FROM core_regions WHERE level = 'si' AND code = '11';
  END IF;

  -- 부산광역시
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '26', '부산광역시', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_busan_id;
  IF v_busan_id IS NULL THEN
    SELECT id INTO v_busan_id FROM core_regions WHERE level = 'si' AND code = '26';
  END IF;

  -- 대구광역시
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '27', '대구광역시', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_daegu_id;
  IF v_daegu_id IS NULL THEN
    SELECT id INTO v_daegu_id FROM core_regions WHERE level = 'si' AND code = '27';
  END IF;

  -- 인천광역시
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '28', '인천광역시', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_incheon_id;
  IF v_incheon_id IS NULL THEN
    SELECT id INTO v_incheon_id FROM core_regions WHERE level = 'si' AND code = '28';
  END IF;

  -- 광주광역시
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '29', '광주광역시', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_gwangju_id;
  IF v_gwangju_id IS NULL THEN
    SELECT id INTO v_gwangju_id FROM core_regions WHERE level = 'si' AND code = '29';
  END IF;

  -- 대전광역시
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '30', '대전광역시', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_daejeon_id;
  IF v_daejeon_id IS NULL THEN
    SELECT id INTO v_daejeon_id FROM core_regions WHERE level = 'si' AND code = '30';
  END IF;

  -- 울산광역시
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '31', '울산광역시', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_ulsan_id;
  IF v_ulsan_id IS NULL THEN
    SELECT id INTO v_ulsan_id FROM core_regions WHERE level = 'si' AND code = '31';
  END IF;

  -- 세종특별자치시
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '36', '세종특별자치시', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_sejong_id;
  IF v_sejong_id IS NULL THEN
    SELECT id INTO v_sejong_id FROM core_regions WHERE level = 'si' AND code = '36';
  END IF;

  -- 경기도
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '41', '경기도', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_gyeonggi_id;
  IF v_gyeonggi_id IS NULL THEN
    SELECT id INTO v_gyeonggi_id FROM core_regions WHERE level = 'si' AND code = '41';
  END IF;

  -- 강원특별자치도
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '42', '강원특별자치도', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_gangwon_id;
  IF v_gangwon_id IS NULL THEN
    SELECT id INTO v_gangwon_id FROM core_regions WHERE level = 'si' AND code = '42';
  END IF;

  -- 충청북도
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '43', '충청북도', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_chungbuk_id;
  IF v_chungbuk_id IS NULL THEN
    SELECT id INTO v_chungbuk_id FROM core_regions WHERE level = 'si' AND code = '43';
  END IF;

  -- 충청남도
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '44', '충청남도', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_chungnam_id;
  IF v_chungnam_id IS NULL THEN
    SELECT id INTO v_chungnam_id FROM core_regions WHERE level = 'si' AND code = '44';
  END IF;

  -- 전북특별자치도
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '45', '전북특별자치도', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_jeonbuk_id;
  IF v_jeonbuk_id IS NULL THEN
    SELECT id INTO v_jeonbuk_id FROM core_regions WHERE level = 'si' AND code = '45';
  END IF;

  -- 전라남도
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '46', '전라남도', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_jeonnam_id;
  IF v_jeonnam_id IS NULL THEN
    SELECT id INTO v_jeonnam_id FROM core_regions WHERE level = 'si' AND code = '46';
  END IF;

  -- 경상북도
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '47', '경상북도', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_gyeongbuk_id;
  IF v_gyeongbuk_id IS NULL THEN
    SELECT id INTO v_gyeongbuk_id FROM core_regions WHERE level = 'si' AND code = '47';
  END IF;

  -- 경상남도
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '48', '경상남도', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_gyeongnam_id;
  IF v_gyeongnam_id IS NULL THEN
    SELECT id INTO v_gyeongnam_id FROM core_regions WHERE level = 'si' AND code = '48';
  END IF;

  -- 제주특별자치도
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('si', '50', '제주특별자치도', NULL)
  ON CONFLICT (level, code) DO NOTHING
  RETURNING id INTO v_jeju_id;
  IF v_jeju_id IS NULL THEN
    SELECT id INTO v_jeju_id FROM core_regions WHERE level = 'si' AND code = '50';
  END IF;

  -- ========================================
  -- 2. 서울특별시 구 (25개)
  -- ========================================

  -- 강남구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11680', '강남구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 강동구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11740', '강동구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 강북구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11305', '강북구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 강서구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11500', '강서구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 관악구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11620', '관악구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 광진구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11215', '광진구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 구로구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11530', '구로구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 금천구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11545', '금천구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 노원구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11350', '노원구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 도봉구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11320', '도봉구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 동대문구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11230', '동대문구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 동작구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11590', '동작구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 마포구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11440', '마포구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 서대문구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11410', '서대문구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 서초구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11650', '서초구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 성동구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11200', '성동구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 성북구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11290', '성북구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 송파구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11710', '송파구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 양천구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11470', '양천구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 영등포구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11560', '영등포구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 용산구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11170', '용산구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 은평구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11380', '은평구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 종로구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11110', '종로구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 중구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11140', '중구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

  -- 중랑구
  INSERT INTO core_regions (level, code, name_ko, parent_id)
  VALUES ('gu_gun', '11260', '중랑구', v_seoul_id)
  ON CONFLICT (level, code) DO NOTHING;

END $$;

-- ========================================
-- 3. 서울 강남구 동 (22개) - 예시
-- ========================================
DO $$
DECLARE
  v_gangnam_id UUID;
BEGIN
  SELECT id INTO v_gangnam_id FROM core_regions WHERE level = 'gu_gun' AND code = '11680';

  IF v_gangnam_id IS NOT NULL THEN
    INSERT INTO core_regions (level, code, name_ko, parent_id) VALUES
      ('dong', '1168010100', '역삼1동', v_gangnam_id),
      ('dong', '1168010200', '역삼2동', v_gangnam_id),
      ('dong', '1168010300', '개포1동', v_gangnam_id),
      ('dong', '1168010400', '개포2동', v_gangnam_id),
      ('dong', '1168010500', '개포4동', v_gangnam_id),
      ('dong', '1168010600', '청담동', v_gangnam_id),
      ('dong', '1168010700', '삼성1동', v_gangnam_id),
      ('dong', '1168010800', '삼성2동', v_gangnam_id),
      ('dong', '1168010900', '대치1동', v_gangnam_id),
      ('dong', '1168011000', '대치2동', v_gangnam_id),
      ('dong', '1168011100', '대치4동', v_gangnam_id),
      ('dong', '1168011200', '논현1동', v_gangnam_id),
      ('dong', '1168011300', '논현2동', v_gangnam_id),
      ('dong', '1168011400', '압구정동', v_gangnam_id),
      ('dong', '1168011500', '신사동', v_gangnam_id),
      ('dong', '1168011600', '일원본동', v_gangnam_id),
      ('dong', '1168011700', '일원1동', v_gangnam_id),
      ('dong', '1168011800', '일원2동', v_gangnam_id),
      ('dong', '1168011900', '수서동', v_gangnam_id),
      ('dong', '1168012000', '세곡동', v_gangnam_id),
      ('dong', '1168012100', '자곡동', v_gangnam_id),
      ('dong', '1168012200', '율현동', v_gangnam_id)
    ON CONFLICT (level, code) DO NOTHING;
  END IF;
END $$;

-- ========================================
-- 4. 서울 서초구 동 (18개) - 예시
-- ========================================
DO $$
DECLARE
  v_seocho_id UUID;
BEGIN
  SELECT id INTO v_seocho_id FROM core_regions WHERE level = 'gu_gun' AND code = '11650';

  IF v_seocho_id IS NOT NULL THEN
    INSERT INTO core_regions (level, code, name_ko, parent_id) VALUES
      ('dong', '1165010100', '서초1동', v_seocho_id),
      ('dong', '1165010200', '서초2동', v_seocho_id),
      ('dong', '1165010300', '서초3동', v_seocho_id),
      ('dong', '1165010400', '서초4동', v_seocho_id),
      ('dong', '1165010500', '잠원동', v_seocho_id),
      ('dong', '1165010600', '반포본동', v_seocho_id),
      ('dong', '1165010700', '반포1동', v_seocho_id),
      ('dong', '1165010800', '반포2동', v_seocho_id),
      ('dong', '1165010900', '반포3동', v_seocho_id),
      ('dong', '1165011000', '반포4동', v_seocho_id),
      ('dong', '1165011100', '방배본동', v_seocho_id),
      ('dong', '1165011200', '방배1동', v_seocho_id),
      ('dong', '1165011300', '방배2동', v_seocho_id),
      ('dong', '1165011400', '방배3동', v_seocho_id),
      ('dong', '1165011500', '방배4동', v_seocho_id),
      ('dong', '1165011600', '양재1동', v_seocho_id),
      ('dong', '1165011700', '양재2동', v_seocho_id),
      ('dong', '1165011800', '내곡동', v_seocho_id)
    ON CONFLICT (level, code) DO NOTHING;
  END IF;
END $$;

-- ========================================
-- 5. 서울 송파구 동 (26개) - 예시
-- ========================================
DO $$
DECLARE
  v_songpa_id UUID;
BEGIN
  SELECT id INTO v_songpa_id FROM core_regions WHERE level = 'gu_gun' AND code = '11710';

  IF v_songpa_id IS NOT NULL THEN
    INSERT INTO core_regions (level, code, name_ko, parent_id) VALUES
      ('dong', '1171010100', '잠실본동', v_songpa_id),
      ('dong', '1171010200', '잠실2동', v_songpa_id),
      ('dong', '1171010300', '잠실3동', v_songpa_id),
      ('dong', '1171010400', '잠실4동', v_songpa_id),
      ('dong', '1171010500', '잠실6동', v_songpa_id),
      ('dong', '1171010600', '잠실7동', v_songpa_id),
      ('dong', '1171010700', '삼전동', v_songpa_id),
      ('dong', '1171010800', '석촌동', v_songpa_id),
      ('dong', '1171010900', '송파1동', v_songpa_id),
      ('dong', '1171011000', '송파2동', v_songpa_id),
      ('dong', '1171011100', '풍납1동', v_songpa_id),
      ('dong', '1171011200', '풍납2동', v_songpa_id),
      ('dong', '1171011300', '거여1동', v_songpa_id),
      ('dong', '1171011400', '거여2동', v_songpa_id),
      ('dong', '1171011500', '마천1동', v_songpa_id),
      ('dong', '1171011600', '마천2동', v_songpa_id),
      ('dong', '1171011700', '방이1동', v_songpa_id),
      ('dong', '1171011800', '방이2동', v_songpa_id),
      ('dong', '1171011900', '오금동', v_songpa_id),
      ('dong', '1171012000', '오륜동', v_songpa_id),
      ('dong', '1171012100', '문정1동', v_songpa_id),
      ('dong', '1171012200', '문정2동', v_songpa_id),
      ('dong', '1171012300', '장지동', v_songpa_id),
      ('dong', '1171012400', '가락본동', v_songpa_id),
      ('dong', '1171012500', '가락1동', v_songpa_id),
      ('dong', '1171012600', '가락2동', v_songpa_id)
    ON CONFLICT (level, code) DO NOTHING;
  END IF;
END $$;

-- ========================================
-- 6. 부산광역시 구/군 (16개)
-- ========================================
DO $$
DECLARE
  v_busan_id UUID;
BEGIN
  SELECT id INTO v_busan_id FROM core_regions WHERE level = 'si' AND code = '26';

  IF v_busan_id IS NOT NULL THEN
    INSERT INTO core_regions (level, code, name_ko, parent_id) VALUES
      ('gu_gun', '26110', '중구', v_busan_id),
      ('gu_gun', '26140', '서구', v_busan_id),
      ('gu_gun', '26170', '동구', v_busan_id),
      ('gu_gun', '26200', '영도구', v_busan_id),
      ('gu_gun', '26230', '부산진구', v_busan_id),
      ('gu_gun', '26260', '동래구', v_busan_id),
      ('gu_gun', '26290', '남구', v_busan_id),
      ('gu_gun', '26320', '북구', v_busan_id),
      ('gu_gun', '26350', '해운대구', v_busan_id),
      ('gu_gun', '26380', '사하구', v_busan_id),
      ('gu_gun', '26410', '금정구', v_busan_id),
      ('gu_gun', '26440', '강서구', v_busan_id),
      ('gu_gun', '26470', '연제구', v_busan_id),
      ('gu_gun', '26500', '수영구', v_busan_id),
      ('gu_gun', '26530', '사상구', v_busan_id),
      ('gu_gun', '26710', '기장군', v_busan_id)
    ON CONFLICT (level, code) DO NOTHING;
  END IF;
END $$;

-- ========================================
-- 7. 경기도 시/군 (31개)
-- ========================================
DO $$
DECLARE
  v_gyeonggi_id UUID;
BEGIN
  SELECT id INTO v_gyeonggi_id FROM core_regions WHERE level = 'si' AND code = '41';

  IF v_gyeonggi_id IS NOT NULL THEN
    INSERT INTO core_regions (level, code, name_ko, parent_id) VALUES
      ('gu_gun', '41111', '수원시 장안구', v_gyeonggi_id),
      ('gu_gun', '41113', '수원시 권선구', v_gyeonggi_id),
      ('gu_gun', '41115', '수원시 팔달구', v_gyeonggi_id),
      ('gu_gun', '41117', '수원시 영통구', v_gyeonggi_id),
      ('gu_gun', '41131', '성남시 수정구', v_gyeonggi_id),
      ('gu_gun', '41133', '성남시 중원구', v_gyeonggi_id),
      ('gu_gun', '41135', '성남시 분당구', v_gyeonggi_id),
      ('gu_gun', '41150', '의정부시', v_gyeonggi_id),
      ('gu_gun', '41171', '안양시 만안구', v_gyeonggi_id),
      ('gu_gun', '41173', '안양시 동안구', v_gyeonggi_id),
      ('gu_gun', '41190', '부천시', v_gyeonggi_id),
      ('gu_gun', '41210', '광명시', v_gyeonggi_id),
      ('gu_gun', '41220', '평택시', v_gyeonggi_id),
      ('gu_gun', '41250', '동두천시', v_gyeonggi_id),
      ('gu_gun', '41271', '안산시 상록구', v_gyeonggi_id),
      ('gu_gun', '41273', '안산시 단원구', v_gyeonggi_id),
      ('gu_gun', '41281', '고양시 덕양구', v_gyeonggi_id),
      ('gu_gun', '41285', '고양시 일산동구', v_gyeonggi_id),
      ('gu_gun', '41287', '고양시 일산서구', v_gyeonggi_id),
      ('gu_gun', '41290', '과천시', v_gyeonggi_id),
      ('gu_gun', '41310', '구리시', v_gyeonggi_id),
      ('gu_gun', '41360', '남양주시', v_gyeonggi_id),
      ('gu_gun', '41370', '오산시', v_gyeonggi_id),
      ('gu_gun', '41390', '시흥시', v_gyeonggi_id),
      ('gu_gun', '41410', '군포시', v_gyeonggi_id),
      ('gu_gun', '41430', '의왕시', v_gyeonggi_id),
      ('gu_gun', '41450', '하남시', v_gyeonggi_id),
      ('gu_gun', '41461', '용인시 처인구', v_gyeonggi_id),
      ('gu_gun', '41463', '용인시 기흥구', v_gyeonggi_id),
      ('gu_gun', '41465', '용인시 수지구', v_gyeonggi_id),
      ('gu_gun', '41480', '파주시', v_gyeonggi_id),
      ('gu_gun', '41500', '이천시', v_gyeonggi_id),
      ('gu_gun', '41550', '안성시', v_gyeonggi_id),
      ('gu_gun', '41570', '김포시', v_gyeonggi_id),
      ('gu_gun', '41590', '화성시', v_gyeonggi_id),
      ('gu_gun', '41610', '광주시', v_gyeonggi_id),
      ('gu_gun', '41630', '양주시', v_gyeonggi_id),
      ('gu_gun', '41650', '포천시', v_gyeonggi_id),
      ('gu_gun', '41670', '여주시', v_gyeonggi_id),
      ('gu_gun', '41800', '연천군', v_gyeonggi_id),
      ('gu_gun', '41820', '가평군', v_gyeonggi_id),
      ('gu_gun', '41830', '양평군', v_gyeonggi_id)
    ON CONFLICT (level, code) DO NOTHING;
  END IF;
END $$;

-- ========================================
-- 8. 인천광역시 구/군 (10개)
-- ========================================
DO $$
DECLARE
  v_incheon_id UUID;
BEGIN
  SELECT id INTO v_incheon_id FROM core_regions WHERE level = 'si' AND code = '28';

  IF v_incheon_id IS NOT NULL THEN
    INSERT INTO core_regions (level, code, name_ko, parent_id) VALUES
      ('gu_gun', '28110', '중구', v_incheon_id),
      ('gu_gun', '28140', '동구', v_incheon_id),
      ('gu_gun', '28177', '미추홀구', v_incheon_id),
      ('gu_gun', '28185', '연수구', v_incheon_id),
      ('gu_gun', '28200', '남동구', v_incheon_id),
      ('gu_gun', '28237', '부평구', v_incheon_id),
      ('gu_gun', '28245', '계양구', v_incheon_id),
      ('gu_gun', '28260', '서구', v_incheon_id),
      ('gu_gun', '28710', '강화군', v_incheon_id),
      ('gu_gun', '28720', '옹진군', v_incheon_id)
    ON CONFLICT (level, code) DO NOTHING;
  END IF;
END $$;

-- ========================================
-- 9. 대구광역시 구/군 (8개)
-- ========================================
DO $$
DECLARE
  v_daegu_id UUID;
BEGIN
  SELECT id INTO v_daegu_id FROM core_regions WHERE level = 'si' AND code = '27';

  IF v_daegu_id IS NOT NULL THEN
    INSERT INTO core_regions (level, code, name_ko, parent_id) VALUES
      ('gu_gun', '27110', '중구', v_daegu_id),
      ('gu_gun', '27140', '동구', v_daegu_id),
      ('gu_gun', '27170', '서구', v_daegu_id),
      ('gu_gun', '27200', '남구', v_daegu_id),
      ('gu_gun', '27230', '북구', v_daegu_id),
      ('gu_gun', '27260', '수성구', v_daegu_id),
      ('gu_gun', '27290', '달서구', v_daegu_id),
      ('gu_gun', '27710', '달성군', v_daegu_id)
    ON CONFLICT (level, code) DO NOTHING;
  END IF;
END $$;

-- ========================================
-- 10. 광주광역시 구 (5개)
-- ========================================
DO $$
DECLARE
  v_gwangju_id UUID;
BEGIN
  SELECT id INTO v_gwangju_id FROM core_regions WHERE level = 'si' AND code = '29';

  IF v_gwangju_id IS NOT NULL THEN
    INSERT INTO core_regions (level, code, name_ko, parent_id) VALUES
      ('gu_gun', '29110', '동구', v_gwangju_id),
      ('gu_gun', '29140', '서구', v_gwangju_id),
      ('gu_gun', '29155', '남구', v_gwangju_id),
      ('gu_gun', '29170', '북구', v_gwangju_id),
      ('gu_gun', '29200', '광산구', v_gwangju_id)
    ON CONFLICT (level, code) DO NOTHING;
  END IF;
END $$;

-- ========================================
-- 11. 대전광역시 구 (5개)
-- ========================================
DO $$
DECLARE
  v_daejeon_id UUID;
BEGIN
  SELECT id INTO v_daejeon_id FROM core_regions WHERE level = 'si' AND code = '30';

  IF v_daejeon_id IS NOT NULL THEN
    INSERT INTO core_regions (level, code, name_ko, parent_id) VALUES
      ('gu_gun', '30110', '동구', v_daejeon_id),
      ('gu_gun', '30140', '중구', v_daejeon_id),
      ('gu_gun', '30170', '서구', v_daejeon_id),
      ('gu_gun', '30200', '유성구', v_daejeon_id),
      ('gu_gun', '30230', '대덕구', v_daejeon_id)
    ON CONFLICT (level, code) DO NOTHING;
  END IF;
END $$;

-- ========================================
-- 12. 울산광역시 구/군 (5개)
-- ========================================
DO $$
DECLARE
  v_ulsan_id UUID;
BEGIN
  SELECT id INTO v_ulsan_id FROM core_regions WHERE level = 'si' AND code = '31';

  IF v_ulsan_id IS NOT NULL THEN
    INSERT INTO core_regions (level, code, name_ko, parent_id) VALUES
      ('gu_gun', '31110', '중구', v_ulsan_id),
      ('gu_gun', '31140', '남구', v_ulsan_id),
      ('gu_gun', '31170', '동구', v_ulsan_id),
      ('gu_gun', '31200', '북구', v_ulsan_id),
      ('gu_gun', '31710', '울주군', v_ulsan_id)
    ON CONFLICT (level, code) DO NOTHING;
  END IF;
END $$;

-- ========================================
-- 13. 제주특별자치도 시 (2개)
-- ========================================
DO $$
DECLARE
  v_jeju_id UUID;
BEGIN
  SELECT id INTO v_jeju_id FROM core_regions WHERE level = 'si' AND code = '50';

  IF v_jeju_id IS NOT NULL THEN
    INSERT INTO core_regions (level, code, name_ko, parent_id) VALUES
      ('gu_gun', '50110', '제주시', v_jeju_id),
      ('gu_gun', '50130', '서귀포시', v_jeju_id)
    ON CONFLICT (level, code) DO NOTHING;
  END IF;
END $$;

-- ========================================
-- 통계 확인 쿼리
-- ========================================
-- SELECT level, COUNT(*) as count FROM core_regions GROUP BY level ORDER BY level;

COMMENT ON TABLE core_regions IS '한국 행정구역 계층 테이블 (시도→시군구→읍면동)';
