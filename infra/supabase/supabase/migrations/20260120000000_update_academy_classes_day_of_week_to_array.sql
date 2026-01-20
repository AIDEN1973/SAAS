-- Update academy_classes day_of_week to support array
-- [요구사항] 수업 요일을 단일 값에서 배열로 변경 (여러 요일 선택 지원)

-- 1. 기존 day_of_week 체크 제약 조건 제거
ALTER TABLE public.academy_classes
  DROP CONSTRAINT IF EXISTS academy_classes_day_of_week_check;

-- 2. day_of_week 컬럼을 text[]로 변경
-- 기존 데이터는 단일 값이므로 배열로 변환
ALTER TABLE public.academy_classes
  ALTER COLUMN day_of_week TYPE text[] USING ARRAY[day_of_week];

-- 3. 새로운 체크 제약 조건 추가 (배열의 각 요소가 유효한 요일인지 검증)
ALTER TABLE public.academy_classes
  ADD CONSTRAINT academy_classes_day_of_week_check
  CHECK (
    day_of_week IS NOT NULL AND
    array_length(day_of_week, 1) > 0 AND
    day_of_week <@ ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']::text[]
  );

-- 4. 기존 인덱스 재생성 (배열 타입에 맞게)
DROP INDEX IF EXISTS idx_academy_classes_day_time;
-- GIN 인덱스는 배열 컬럼에만 사용, tenant_id는 별도 B-tree 인덱스로 처리
CREATE INDEX idx_academy_classes_day_of_week_gin ON public.academy_classes USING GIN (day_of_week);
CREATE INDEX idx_academy_classes_tenant_day ON public.academy_classes (tenant_id, start_time, end_time);

-- 5. grade 컬럼도 배열로 변경 (여러 학년 선택 지원)
-- search_vector 생성 컬럼이 grade를 사용하므로 먼저 제거 후 재생성
ALTER TABLE public.academy_classes
  DROP COLUMN IF EXISTS search_vector;

ALTER TABLE public.academy_classes
  ALTER COLUMN grade TYPE text[] USING
    CASE
      WHEN grade IS NULL THEN NULL
      ELSE ARRAY[grade]
    END;

-- search_vector 컬럼 재생성 (일반 컬럼 + 트리거 방식)
-- GENERATED ALWAYS는 to_tsvector가 immutable하지 않아 사용 불가
ALTER TABLE public.academy_classes
  ADD COLUMN search_vector tsvector;

-- search_vector 업데이트 함수 생성
CREATE OR REPLACE FUNCTION update_academy_classes_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.subject, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.grade, ' '), '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.notes, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (INSERT, UPDATE 시 search_vector 자동 업데이트)
DROP TRIGGER IF EXISTS trg_academy_classes_search_vector ON public.academy_classes;
CREATE TRIGGER trg_academy_classes_search_vector
  BEFORE INSERT OR UPDATE ON public.academy_classes
  FOR EACH ROW
  EXECUTE FUNCTION update_academy_classes_search_vector();

-- 기존 데이터의 search_vector 업데이트
UPDATE public.academy_classes SET search_vector =
  setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(subject, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(array_to_string(grade, ' '), '')), 'C') ||
  setweight(to_tsvector('simple', COALESCE(notes, '')), 'D');

-- search_vector 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_academy_classes_search_vector ON public.academy_classes USING GIN (search_vector);

-- 참고: check_schedule_conflicts RPC 함수는 단일 요일만 받으므로 별도 수정 필요
