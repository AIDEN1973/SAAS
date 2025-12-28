-- Academy Classes & Teachers 테이블 생성
-- [불변 규칙] 모든 테이블은 tenant_id 필수 + 인덱스 구성
-- [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)
-- [불변 규칙] Industry Layer에서 관리되는 테이블입니다.

-- 1. 반(Class) 테이블
-- 요구사항: 반 생성(요일/시간/정원/강사 지정), 반 자동 색상 태깅
CREATE TABLE IF NOT EXISTS public.academy_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,  -- 반 이름 (예: "수학 A반", "영어 기초반")
  subject text,  -- 과목 (예: "수학", "영어", "국어")
  grade text,  -- 대상 학년 (예: "중1", "고1", "전체")
  day_of_week text NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),  -- 요일
  start_time time NOT NULL,  -- 시작 시간 (예: '14:00:00')
  end_time time NOT NULL,  -- 종료 시간 (예: '15:30:00')
  capacity integer NOT NULL DEFAULT 20 CHECK (capacity > 0),  -- 정원
  current_count integer NOT NULL DEFAULT 0 CHECK (current_count >= 0),  -- 현재 학생 수
  color text NOT NULL DEFAULT '#3b82f6',  -- 반 자동 색상 태깅 (기본값: 파란색)
  room text,  -- 강의실
  notes text,  -- 비고
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),  -- 반 상태
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_academy_classes_tenant ON public.academy_classes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_academy_classes_tenant_status ON public.academy_classes(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_academy_classes_tenant_created ON public.academy_classes(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_academy_classes_day_time ON public.academy_classes(tenant_id, day_of_week, start_time);

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_academy_classes_updated_at ON public.academy_classes;
CREATE TRIGGER update_academy_classes_updated_at
  BEFORE UPDATE ON public.academy_classes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. 강사(Teacher) 테이블
-- 요구사항: 강사 프로필, 강사 배정/부담임 설정
-- [불변 규칙] 강사는 persons 테이블을 참조하는 업종별 확장 테이블입니다.
CREATE TABLE IF NOT EXISTS public.academy_teachers (
  person_id uuid PRIMARY KEY REFERENCES public.persons(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id text,  -- 사원번호
  specialization text,  -- 전문 분야 (예: "수학", "영어", "과학")
  hire_date date,  -- 입사일
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'resigned')),  -- 강사 상태
  profile_image_url text,  -- 프로필 이미지
  bio text,  -- 강사 소개
  notes text,  -- 비고
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_academy_teachers_tenant ON public.academy_teachers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_academy_teachers_tenant_status ON public.academy_teachers(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_academy_teachers_tenant_created ON public.academy_teachers(tenant_id, created_at DESC);

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_academy_teachers_updated_at ON public.academy_teachers;
CREATE TRIGGER update_academy_teachers_updated_at
  BEFORE UPDATE ON public.academy_teachers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. 반-강사 연결 테이블 (강사 배정/부담임 설정)
-- 요구사항: 강사 배정/부담임 설정
CREATE TABLE IF NOT EXISTS public.class_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.academy_classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.academy_teachers(person_id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'assistant')),  -- 담임/부담임 구분
  -- 기술문서 19-1-2: DEFAULT CURRENT_DATE는 레거시/직접 INSERT용이며, 앱에서는 toKST()로 계산한 값을 명시적으로 전달해야 함
  assigned_at date NOT NULL DEFAULT CURRENT_DATE,  -- 배정일
  unassigned_at date,  -- 배정 해제일
  is_active boolean NOT NULL DEFAULT true,  -- 현재 배정 여부
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, teacher_id, assigned_at)  -- 중복 방지
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_class_teachers_tenant ON public.class_teachers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_class ON public.class_teachers(class_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher ON public.class_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_active ON public.class_teachers(tenant_id, is_active) WHERE is_active = true;

-- 4. student_classes 테이블의 class_id FK 제약 조건 추가
-- [불변 규칙] student_classes.class_id가 academy_classes.id를 참조하도록 설정
ALTER TABLE IF EXISTS public.student_classes
  DROP CONSTRAINT IF EXISTS student_classes_class_id_fkey;

ALTER TABLE IF EXISTS public.student_classes
  ADD CONSTRAINT student_classes_class_id_fkey
  FOREIGN KEY (class_id)
  REFERENCES public.academy_classes(id)
  ON DELETE CASCADE;

