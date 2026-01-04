-- Automatic Class Color Assignment
-- [요구사항] 디어쌤_아키텍처.md 3.2.4: 반 생성 시 자동 색상 태깅
-- [Industry Layer] academy-specific feature

-- 1. 색상 팔레트 정의 (Material Design Colors)
CREATE OR REPLACE FUNCTION public.get_next_class_color(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_color_palette text[] := ARRAY[
    '#ef4444', -- red-500
    '#f97316', -- orange-500
    '#f59e0b', -- amber-500
    '#eab308', -- yellow-500
    '#84cc16', -- lime-500
    '#22c55e', -- green-500
    '#10b981', -- emerald-500
    '#14b8a6', -- teal-500
    '#06b6d4', -- cyan-500
    '#0ea5e9', -- sky-500
    '#3b82f6', -- blue-500
    '#6366f1', -- indigo-500
    '#8b5cf6', -- violet-500
    '#a855f7', -- purple-500
    '#d946ef', -- fuchsia-500
    '#ec4899', -- pink-500
    '#f43f5e'  -- rose-500
  ];
  v_used_colors text[];
  v_next_color text;
  v_color_count integer;
BEGIN
  -- 현재 테넌트에서 사용 중인 색상 목록 조회
  SELECT array_agg(DISTINCT color)
  INTO v_used_colors
  FROM public.academy_classes
  WHERE tenant_id = p_tenant_id
    AND status = 'active';

  -- 사용되지 않은 첫 번째 색상 선택
  IF v_used_colors IS NULL THEN
    v_used_colors := ARRAY[]::text[];
  END IF;

  -- 팔레트에서 사용되지 않은 색상 찾기
  FOREACH v_next_color IN ARRAY v_color_palette
  LOOP
    IF NOT (v_next_color = ANY(v_used_colors)) THEN
      RETURN v_next_color;
    END IF;
  END LOOP;

  -- 모든 색상이 사용 중이면 순환 (가장 적게 사용된 색상 선택)
  WITH color_usage AS (
    SELECT
      unnest(v_color_palette) as color,
      COUNT(ac.id) as usage_count
    FROM public.academy_classes ac
    WHERE ac.tenant_id = p_tenant_id
      AND ac.status = 'active'
      AND ac.color = ANY(v_color_palette)
    GROUP BY unnest(v_color_palette)
    ORDER BY usage_count ASC, random()
    LIMIT 1
  )
  SELECT color INTO v_next_color FROM color_usage;

  -- Fallback: 기본 파란색
  RETURN COALESCE(v_next_color, '#3b82f6');
END;
$$;

-- 2. academy_classes INSERT 시 자동으로 색상 할당하는 트리거 함수
CREATE OR REPLACE FUNCTION auto_assign_class_color()
RETURNS TRIGGER AS $$
BEGIN
  -- color가 기본값이거나 NULL이면 자동 할당
  IF NEW.color = '#3b82f6' OR NEW.color IS NULL THEN
    NEW.color := get_next_class_color(NEW.tenant_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 트리거 생성
DROP TRIGGER IF EXISTS trigger_auto_assign_class_color ON public.academy_classes;
CREATE TRIGGER trigger_auto_assign_class_color
  BEFORE INSERT ON public.academy_classes
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_class_color();

-- 권한 부여
GRANT EXECUTE ON FUNCTION public.get_next_class_color TO authenticated;

COMMENT ON FUNCTION public.get_next_class_color IS
'반 생성 시 자동 색상 할당. 사용되지 않은 색상 우선 선택, 모두 사용 중이면 가장 적게 사용된 색상 순환.';
