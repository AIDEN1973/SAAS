-- ============================================================================
-- 매장 생성 RPC 함수 (주소 및 지역 코드 포함)
--
-- 카카오 주소 검색 API로 파싱된 지역 정보를 core_stores에 저장
-- [불변 규칙] 서버 권한으로 실행되므로 RLS를 우회합니다.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_store_with_address(
  p_tenant_id uuid,
  p_name text,
  p_industry_type text,
  p_address text,
  p_sido_code text DEFAULT NULL,
  p_sido_name text DEFAULT NULL,
  p_sigungu_code text DEFAULT NULL,
  p_sigungu_name text DEFAULT NULL,
  p_dong_code text DEFAULT NULL,
  p_dong_name text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  -- search_path 고정
  PERFORM set_config('search_path', 'public, pg_temp', true);

  -- 기존 매장 확인 (테넌트당 하나의 매장만 허용하는 경우)
  SELECT id INTO v_store_id
  FROM public.core_stores
  WHERE tenant_id = p_tenant_id
  LIMIT 1;

  IF v_store_id IS NOT NULL THEN
    -- 기존 매장 업데이트
    UPDATE public.core_stores
    SET
      name = COALESCE(p_name, name),
      address = COALESCE(p_address, address),
      sido_code = COALESCE(p_sido_code, sido_code),
      sido_name = COALESCE(p_sido_name, sido_name),
      sigungu_code = COALESCE(p_sigungu_code, sigungu_code),
      sigungu_name = COALESCE(p_sigungu_name, sigungu_name),
      dong_code = COALESCE(p_dong_code, dong_code),
      dong_name = COALESCE(p_dong_name, dong_name),
      latitude = COALESCE(p_latitude, latitude),
      longitude = COALESCE(p_longitude, longitude),
      updated_at = now()
    WHERE id = v_store_id;
  ELSE
    -- 새 매장 생성
    INSERT INTO public.core_stores (
      tenant_id,
      name,
      industry_type,
      address,
      sido_code,
      sido_name,
      sigungu_code,
      sigungu_name,
      dong_code,
      dong_name,
      latitude,
      longitude,
      status
    ) VALUES (
      p_tenant_id,
      p_name,
      p_industry_type,
      p_address,
      p_sido_code,
      p_sido_name,
      p_sigungu_code,
      p_sigungu_name,
      p_dong_code,
      p_dong_name,
      p_latitude,
      p_longitude,
      'active'
    )
    RETURNING id INTO v_store_id;
  END IF;

  RETURN v_store_id;
END;
$$;

-- RPC 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION create_store_with_address TO authenticated;

COMMENT ON FUNCTION create_store_with_address IS '카카오 주소 검색 API로 파싱된 지역 정보를 포함하여 매장을 생성/업데이트합니다.';
