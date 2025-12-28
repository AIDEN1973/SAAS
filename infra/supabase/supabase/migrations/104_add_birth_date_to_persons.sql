-- persons 테이블에 birth_date 필드 추가
-- birthday_greeting 자동화 기능을 위한 생일 필드
-- AI_자동화_기능_정리.md Section 11: birthday_greeting 참조

-- ⚠️ 참고: academy_students 테이블에 이미 birth_date가 있을 수 있으므로, persons 테이블에 추가하는 것은 선택적입니다.
-- 하지만 업종 중립성을 위해 persons 테이블에 추가하는 것이 권장됩니다.

-- birth_date 필드 추가 (없는 경우에만)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'persons'
      AND column_name = 'birth_date'
  ) THEN
    ALTER TABLE public.persons
      ADD COLUMN birth_date date;

    -- 인덱스 생성 (생일 기반 조회 최적화)
    CREATE INDEX IF NOT EXISTS idx_persons_birth_date ON public.persons(birth_date) WHERE birth_date IS NOT NULL;

    -- 월-일 조합 인덱스 (생일 알림용)
    -- ⚠️ 참고: PostgreSQL에서는 함수 기반 인덱스를 사용하여 월-일 조합을 인덱싱할 수 있습니다.
    -- 하지만 매일 실행되는 쿼리이므로, 인덱스 없이도 충분히 빠를 수 있습니다.

    COMMENT ON COLUMN public.persons.birth_date IS '생일 (birthday_greeting 자동화 기능용, 업종 중립)';
  END IF;
END $$;

