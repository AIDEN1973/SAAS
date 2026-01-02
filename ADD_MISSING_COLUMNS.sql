/**
 * daily_region_metrics에 누락된 컬럼 추가
 *
 * 현재 스키마에 없는 컬럼들만 추가합니다.
 * Supabase SQL Editor에서 직접 실행하세요.
 */

-- 1. id 컬럼 추가 (Primary Key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'id'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN id uuid DEFAULT gen_random_uuid();

    RAISE NOTICE '✅ Added id column';
  ELSE
    RAISE NOTICE '⏭️ id column already exists';
  END IF;
END $$;

-- 2. updated_at 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN updated_at timestamptz DEFAULT now();

    RAISE NOTICE '✅ Added updated_at column';
  ELSE
    RAISE NOTICE '⏭️ updated_at column already exists';
  END IF;
END $$;

-- 3. tenant_count 컬럼 추가 (기존 store_count와 별개)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'tenant_count'
  ) THEN
    -- store_count를 tenant_count로 복사
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN tenant_count integer;

    -- 기존 데이터 복사
    UPDATE analytics.daily_region_metrics
    SET tenant_count = COALESCE(store_count, 0);

    -- NOT NULL 제약 조건 추가
    ALTER TABLE analytics.daily_region_metrics
      ALTER COLUMN tenant_count SET DEFAULT 0,
      ALTER COLUMN tenant_count SET NOT NULL;

    RAISE NOTICE '✅ Added tenant_count column (copied from store_count)';
  ELSE
    RAISE NOTICE '⏭️ tenant_count column already exists';
  END IF;
END $$;

-- 4. student_count 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'student_count'
  ) THEN
    -- active_members_avg를 student_count로 복사
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN student_count integer;

    -- 기존 데이터 복사 (반올림)
    UPDATE analytics.daily_region_metrics
    SET student_count = COALESCE(ROUND(active_members_avg)::integer, 0);

    -- NOT NULL 제약 조건 추가
    ALTER TABLE analytics.daily_region_metrics
      ALTER COLUMN student_count SET DEFAULT 0,
      ALTER COLUMN student_count SET NOT NULL;

    RAISE NOTICE '✅ Added student_count column (copied from active_members_avg)';
  ELSE
    RAISE NOTICE '⏭️ student_count column already exists';
  END IF;
END $$;

-- 5. avg_arpu 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'avg_arpu'
  ) THEN
    -- revenue_avg를 avg_arpu로 복사
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN avg_arpu numeric(12, 2);

    -- 기존 데이터 복사
    UPDATE analytics.daily_region_metrics
    SET avg_arpu = COALESCE(revenue_avg, 0);

    -- NOT NULL 제약 조건 추가
    ALTER TABLE analytics.daily_region_metrics
      ALTER COLUMN avg_arpu SET DEFAULT 0,
      ALTER COLUMN avg_arpu SET NOT NULL;

    RAISE NOTICE '✅ Added avg_arpu column (copied from revenue_avg)';
  ELSE
    RAISE NOTICE '⏭️ avg_arpu column already exists';
  END IF;
END $$;

-- 6. revenue_growth_rate_avg 컬럼 확인 및 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'revenue_growth_rate_avg'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN revenue_growth_rate_avg numeric(5, 2);

    RAISE NOTICE '✅ Added revenue_growth_rate_avg column';
  ELSE
    RAISE NOTICE '⏭️ revenue_growth_rate_avg column already exists';
  END IF;
END $$;

-- 7. revenue_growth_rate_p75 컬럼 확인 및 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'revenue_growth_rate_p75'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN revenue_growth_rate_p75 numeric(5, 2);

    RAISE NOTICE '✅ Added revenue_growth_rate_p75 column';
  ELSE
    RAISE NOTICE '⏭️ revenue_growth_rate_p75 column already exists';
  END IF;
END $$;

-- 8. student_growth_rate_p75 컬럼 확인 및 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'student_growth_rate_p75'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN student_growth_rate_p75 numeric(5, 2);

    RAISE NOTICE '✅ Added student_growth_rate_p75 column';
  ELSE
    RAISE NOTICE '⏭️ student_growth_rate_p75 column already exists';
  END IF;
END $$;

-- 9. Primary Key 설정 (id가 추가된 경우)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_region_metrics_pkey'
    AND conrelid = 'analytics.daily_region_metrics'::regclass
  ) THEN
    -- 기존 행의 id가 NULL인 경우 UUID 생성
    UPDATE analytics.daily_region_metrics
    SET id = gen_random_uuid()
    WHERE id IS NULL;

    -- NOT NULL 제약 조건 추가
    ALTER TABLE analytics.daily_region_metrics
      ALTER COLUMN id SET NOT NULL;

    -- Primary Key 추가
    ALTER TABLE analytics.daily_region_metrics
      ADD CONSTRAINT daily_region_metrics_pkey PRIMARY KEY (id);

    RAISE NOTICE '✅ Added Primary Key on id';
  ELSE
    RAISE NOTICE '⏭️ Primary Key already exists';
  END IF;
END $$;

-- 10. 유니크 제약 조건 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ux_daily_region_metrics_region_industry_date'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD CONSTRAINT ux_daily_region_metrics_region_industry_date
      UNIQUE (region_code, region_level, industry_type, date_kst);

    RAISE NOTICE '✅ Added unique constraint';
  ELSE
    RAISE NOTICE '⏭️ Unique constraint already exists';
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    RAISE WARNING '⚠️ Duplicate data exists - cannot add unique constraint';
  WHEN OTHERS THEN
    RAISE WARNING '⚠️ Could not add unique constraint: %', SQLERRM;
END $$;

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 누락된 컬럼 추가 완료!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '추가된 컬럼:';
  RAISE NOTICE '  - id (uuid, PK)';
  RAISE NOTICE '  - updated_at (timestamptz)';
  RAISE NOTICE '  - tenant_count (integer, from store_count)';
  RAISE NOTICE '  - student_count (integer, from active_members_avg)';
  RAISE NOTICE '  - avg_arpu (numeric, from revenue_avg)';
  RAISE NOTICE '  - revenue_growth_rate_avg (numeric)';
  RAISE NOTICE '  - revenue_growth_rate_p75 (numeric)';
  RAISE NOTICE '  - student_growth_rate_p75 (numeric)';
  RAISE NOTICE '';
  RAISE NOTICE '다음 단계: Migration 141 실행 (Materialized Views)';
  RAISE NOTICE '';
END $$;
