-- 학년 필드에 제약조건 추가 및 자동 상향 함수 생성
-- 작성일: 2026-01-18

-- 1. 기존 학년 데이터를 새로운 형식으로 마이그레이션
DO $$
BEGIN
  -- 기존 데이터를 새로운 형식으로 변환
  -- 예: '1학년' -> '초등 1학년', '중1' -> '중등 1학년' 등
  UPDATE public.academy_students
  SET grade = CASE
    -- 숫자만 있는 경우 (예: '1', '2', '3')
    WHEN grade ~ '^\d$' AND grade::int BETWEEN 1 AND 6 THEN '초등 ' || grade || '학년'

    -- 초등학교 패턴 (예: '1학년', '초1', '초등1')
    WHEN grade ~ '^[1-6]학년$' THEN '초등 ' || SUBSTRING(grade, 1, 1) || '학년'
    WHEN grade ~ '^초[1-6]$' THEN '초등 ' || SUBSTRING(grade, 2, 1) || '학년'
    WHEN grade ~ '^초등[1-6]$' THEN '초등 ' || SUBSTRING(grade, 3, 1) || '학년'
    WHEN grade ~ '^초등\s*[1-6]학년$' THEN '초등 ' || SUBSTRING(grade FROM '[1-6]') || '학년'

    -- 중학교 패턴 (예: '중1', '중등1', '중1학년')
    WHEN grade ~ '^중[1-3]$' THEN '중등 ' || SUBSTRING(grade, 2, 1) || '학년'
    WHEN grade ~ '^중등[1-3]$' THEN '중등 ' || SUBSTRING(grade, 3, 1) || '학년'
    WHEN grade ~ '^중[1-3]학년$' THEN '중등 ' || SUBSTRING(grade, 2, 1) || '학년'
    WHEN grade ~ '^중등\s*[1-3]학년$' THEN '중등 ' || SUBSTRING(grade FROM '[1-3]') || '학년'

    -- 고등학교 패턴 (예: '고1', '고등1', '고1학년')
    WHEN grade ~ '^고[1-3]$' THEN '고등 ' || SUBSTRING(grade, 2, 1) || '학년'
    WHEN grade ~ '^고등[1-3]$' THEN '고등 ' || SUBSTRING(grade, 3, 1) || '학년'
    WHEN grade ~ '^고[1-3]학년$' THEN '고등 ' || SUBSTRING(grade, 2, 1) || '학년'
    WHEN grade ~ '^고등\s*[1-3]학년$' THEN '고등 ' || SUBSTRING(grade FROM '[1-3]') || '학년'

    -- 유치원 연령대 (4세~7세)
    WHEN grade ~ '^[4-7]세$' THEN grade

    -- 이미 올바른 형식인 경우
    WHEN grade IN (
      '4세', '5세', '6세', '7세',
      '초등 1학년', '초등 2학년', '초등 3학년', '초등 4학년', '초등 5학년', '초등 6학년',
      '중등 1학년', '중등 2학년', '중등 3학년',
      '고등 1학년', '고등 2학년', '고등 3학년'
    ) THEN grade

    -- 그 외는 모두 '기타'로 처리
    ELSE '기타'
  END,
  updated_at = NOW()
  WHERE grade IS NOT NULL AND grade != '';

  -- 변환 결과 로그
  RAISE NOTICE '학년 데이터 마이그레이션 완료';
END $$;

-- 2. academy_students 테이블의 grade 필드에 체크 제약조건 추가
DO $$
BEGIN
  -- 기존 제약조건이 있으면 삭제
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'academy_students_grade_check'
    AND conrelid = 'public.academy_students'::regclass
  ) THEN
    ALTER TABLE public.academy_students DROP CONSTRAINT academy_students_grade_check;
  END IF;

  -- 새로운 제약조건 추가
  ALTER TABLE public.academy_students
  ADD CONSTRAINT academy_students_grade_check
  CHECK (grade IN (
    '4세', '5세', '6세', '7세',
    '초등 1학년', '초등 2학년', '초등 3학년', '초등 4학년', '초등 5학년', '초등 6학년',
    '중등 1학년', '중등 2학년', '중등 3학년',
    '고등 1학년', '고등 2학년', '고등 3학년',
    '기타'
  ) OR grade IS NULL);
END $$;

-- 3. 학년 자동 상향 함수 생성
CREATE OR REPLACE FUNCTION public.upgrade_student_grades()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 학년 자동 상향 업데이트
  UPDATE public.academy_students
  SET grade = CASE grade
    WHEN '4세' THEN '5세'
    WHEN '5세' THEN '6세'
    WHEN '6세' THEN '7세'
    WHEN '7세' THEN '초등 1학년'
    WHEN '초등 1학년' THEN '초등 2학년'
    WHEN '초등 2학년' THEN '초등 3학년'
    WHEN '초등 3학년' THEN '초등 4학년'
    WHEN '초등 4학년' THEN '초등 5학년'
    WHEN '초등 5학년' THEN '초등 6학년'
    WHEN '초등 6학년' THEN '중등 1학년'
    WHEN '중등 1학년' THEN '중등 2학년'
    WHEN '중등 2학년' THEN '중등 3학년'
    WHEN '중등 3학년' THEN '고등 1학년'
    WHEN '고등 1학년' THEN '고등 2학년'
    WHEN '고등 2학년' THEN '고등 3학년'
    WHEN '고등 3학년' THEN '고등 3학년' -- 졸업 상태 유지
    WHEN '기타' THEN '기타' -- 기타는 변경 없음
    ELSE grade
  END,
  updated_at = NOW()
  WHERE grade IS NOT NULL
    AND grade != '기타'
    AND grade != '고등 3학년'; -- 고등 3학년과 기타는 제외

  -- 로그 기록
  RAISE NOTICE '학년 자동 상향 완료: % 건 업데이트됨', (SELECT COUNT(*) FROM public.academy_students WHERE grade IS NOT NULL AND grade != '기타' AND grade != '고등 3학년');
END;
$$;

-- 함수 설명 추가
COMMENT ON FUNCTION public.upgrade_student_grades() IS '매년 1월 1일 실행되는 학년 자동 상향 함수';

-- 4. pg_cron 스케줄러 설정 (Supabase에서 수동으로 설정 필요)
-- Supabase Dashboard에서 다음 명령을 실행하세요:
-- SELECT cron.schedule(
--   'upgrade-student-grades-yearly',  -- 작업 이름
--   '0 0 1 1 *',                       -- 매년 1월 1일 00:00:00 (Cron 표현식)
--   $$SELECT public.upgrade_student_grades();$$
-- );

-- 참고: pg_cron 확장이 활성화되어 있어야 합니다.
-- Supabase Dashboard -> Database -> Extensions에서 pg_cron 활성화 필요
