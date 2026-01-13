-- attendance_logs 테이블에 UNIQUE INDEX 추가
-- 목적: 같은 학생이 같은 날짜에 같은 타입(check_in/check_out)의 중복 레코드를 방지
-- 이를 통해 UPSERT(ON CONFLICT) 사용 가능
--
-- 주의: PostgreSQL에서는 표현식(DATE(occurred_at))을 UNIQUE 제약조건에 직접 사용할 수 없으므로
--       UNIQUE INDEX를 사용합니다.

-- 1. 기존 중복 데이터 확인 및 정리 (있다면)
-- 같은 student_id, DATE(occurred_at), attendance_type 조합이 중복되는 경우 최신 것만 남기고 삭제
WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, student_id, DATE(occurred_at), attendance_type
      ORDER BY created_at DESC, id DESC
    ) as rn
  FROM public.attendance_logs_2025
)
DELETE FROM public.attendance_logs_2025
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 2026년 파티션도 동일하게 처리 (존재하는 경우)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'attendance_logs_2026'
  ) THEN
    WITH duplicates AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY tenant_id, student_id, DATE(occurred_at), attendance_type
          ORDER BY created_at DESC, id DESC
        ) as rn
      FROM public.attendance_logs_2026
    )
    DELETE FROM public.attendance_logs_2026
    WHERE id IN (
      SELECT id FROM duplicates WHERE rn > 1
    );
  END IF;
END $$;

-- 2. 각 파티션에 UNIQUE INDEX 추가
-- 2025년 파티션
-- UNIQUE INDEX는 ON CONFLICT에서 사용 가능
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_logs_2025_student_date_type
  ON public.attendance_logs_2025(tenant_id, student_id, DATE(occurred_at), attendance_type);

-- 2026년 파티션 (존재하는 경우)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'attendance_logs_2026'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_logs_2026_student_date_type
      ON public.attendance_logs_2026(tenant_id, student_id, DATE(occurred_at), attendance_type);
  END IF;
END $$;

-- 3. 검증 쿼리
DO $$
DECLARE
  index_count int;
BEGIN
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname LIKE 'uq_attendance_logs_%_student_date_type';

  RAISE NOTICE '✅ UNIQUE INDEX 추가 완료: % 개', index_count;

  IF index_count = 0 THEN
    RAISE WARNING '❌ UNIQUE INDEX가 추가되지 않았습니다!';
  END IF;
END $$;
