-- 업종별 테마 설정 테이블
-- [LAYER: INFRA_DATABASE]
-- SSOT: packages/design-system/src/theme.ts - ThemeEngine과 연동

CREATE TABLE IF NOT EXISTS public.industry_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_type text NOT NULL UNIQUE CHECK (industry_type IN ('academy', 'salon', 'nail_salon', 'real_estate', 'gym', 'ngo')),
  theme_tokens jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_theme_tokens CHECK (
    jsonb_typeof(theme_tokens) = 'object'
  )
);

-- RLS 활성화
ALTER TABLE public.industry_themes ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 업종 테마를 읽을 수 있음 (읽기 전용)
CREATE POLICY "Industry themes are readable by authenticated users"
  ON public.industry_themes
  FOR SELECT
  TO authenticated
  USING (true);

-- Super Admin만 업종 테마를 수정할 수 있음
CREATE POLICY "Industry themes are writable by super admins only"
  ON public.industry_themes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_platform_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_platform_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- ACADEMY 업종: 퍼플(Violet) 색상 적용
INSERT INTO public.industry_themes (industry_type, theme_tokens)
VALUES (
  'academy',
  '{
    "colors": {
      "primary": {
        "light": "#a78bfa",
        "DEFAULT": "#8b5cf6",
        "dark": "#7c3aed"
      }
    }
  }'::jsonb
)
ON CONFLICT (industry_type) DO UPDATE
SET theme_tokens = EXCLUDED.theme_tokens,
    updated_at = now();

-- GYM 업종: 오렌지 색상 적용 (예시)
INSERT INTO public.industry_themes (industry_type, theme_tokens)
VALUES (
  'gym',
  '{
    "colors": {
      "primary": {
        "light": "#fb923c",
        "DEFAULT": "#f97316",
        "dark": "#ea580c"
      }
    }
  }'::jsonb
)
ON CONFLICT (industry_type) DO UPDATE
SET theme_tokens = EXCLUDED.theme_tokens,
    updated_at = now();

-- SALON/NAIL_SALON 업종: 핑크 색상 적용 (예시)
INSERT INTO public.industry_themes (industry_type, theme_tokens)
VALUES (
  'salon',
  '{
    "colors": {
      "primary": {
        "light": "#f9a8d4",
        "DEFAULT": "#ec4899",
        "dark": "#db2777"
      }
    }
  }'::jsonb
),
(
  'nail_salon',
  '{
    "colors": {
      "primary": {
        "light": "#f9a8d4",
        "DEFAULT": "#ec4899",
        "dark": "#db2777"
      }
    }
  }'::jsonb
)
ON CONFLICT (industry_type) DO UPDATE
SET theme_tokens = EXCLUDED.theme_tokens,
    updated_at = now();

-- REAL_ESTATE 업종: 청록색 적용 (예시)
INSERT INTO public.industry_themes (industry_type, theme_tokens)
VALUES (
  'real_estate',
  '{
    "colors": {
      "primary": {
        "light": "#5eead4",
        "DEFAULT": "#14b8a6",
        "dark": "#0d9488"
      }
    }
  }'::jsonb
)
ON CONFLICT (industry_type) DO UPDATE
SET theme_tokens = EXCLUDED.theme_tokens,
    updated_at = now();

-- NGO 업종: 그린 색상 적용 (예시)
INSERT INTO public.industry_themes (industry_type, theme_tokens)
VALUES (
  'ngo',
  '{
    "colors": {
      "primary": {
        "light": "#86efac",
        "DEFAULT": "#22c55e",
        "dark": "#16a34a"
      }
    }
  }'::jsonb
)
ON CONFLICT (industry_type) DO UPDATE
SET theme_tokens = EXCLUDED.theme_tokens,
    updated_at = now();

-- 테이블에 코멘트 추가
COMMENT ON TABLE public.industry_themes IS '업종별 테마 색상 및 스타일 토큰 (SSOT: packages/design-system/src/theme.ts)';
COMMENT ON COLUMN public.industry_themes.theme_tokens IS 'JSON 형식의 테마 토큰 (colors, spacing, sizes 등)';

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_industry_themes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_industry_themes_updated_at
  BEFORE UPDATE ON public.industry_themes
  FOR EACH ROW
  EXECUTE FUNCTION update_industry_themes_updated_at();
