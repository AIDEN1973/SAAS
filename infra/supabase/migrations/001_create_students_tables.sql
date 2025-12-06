-- 학생 관리 테이블 생성
-- [불변 규칙] 모든 테이블은 tenant_id 필수 + 인덱스 구성

-- 1. 학생 테이블
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  industry_type text NOT NULL,  -- tenants.industry_type과 동일 (성능 최적화)
  name text NOT NULL,
  birth_date date,
  gender text CHECK (gender IN ('male', 'female', 'other')),
  phone text,
  email text,
  address text,
  school_name text,
  grade text,  -- 학년 (예: '1학년', '중1', '고1')
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'graduated', 'withdrawn')),
  notes text,
  profile_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_students_tenant ON public.students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_tenant_created ON public.students(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_tenant_status ON public.students(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_students_industry_tenant ON public.students(industry_type, tenant_id, created_at DESC);

-- 이름 검색용 인덱스 (Phase 2+)
CREATE INDEX IF NOT EXISTS idx_students_name_pattern ON public.students USING btree (name text_pattern_ops);

-- 2. 학부모(보호자) 테이블
CREATE TABLE IF NOT EXISTS public.guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text NOT NULL CHECK (relationship IN ('parent', 'guardian', 'other')),  -- 부, 모, 보호자, 기타
  phone text NOT NULL,
  email text,
  is_primary boolean NOT NULL DEFAULT false,  -- 주 보호자 여부
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guardians_tenant ON public.guardians(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guardians_student ON public.guardians(student_id);
CREATE INDEX IF NOT EXISTS idx_guardians_tenant_student ON public.guardians(tenant_id, student_id);

-- 3. 태그는 core-tags 공통 모듈 사용 (003_create_core_tags_tables.sql 참조)
-- student_tags, student_tag_assignments 테이블은 사용하지 않음

-- 5. 반-학생 연결 테이블 (다중 반 소속 지원)
CREATE TABLE IF NOT EXISTS public.student_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL,  -- classes 테이블 참조 (나중에 생성)
  enrolled_at date NOT NULL DEFAULT CURRENT_DATE,
  left_at date,  -- 반 이동 시 이전 반의 left_at 설정
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, class_id, enrolled_at)  -- 중복 방지
);

CREATE INDEX IF NOT EXISTS idx_student_classes_tenant ON public.student_classes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_classes_student ON public.student_classes(student_id);
CREATE INDEX IF NOT EXISTS idx_student_classes_class ON public.student_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_student_classes_active ON public.student_classes(tenant_id, is_active) WHERE is_active = true;

-- 6. 상담일지 테이블
CREATE TABLE IF NOT EXISTS public.student_consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  consultation_date date NOT NULL DEFAULT CURRENT_DATE,
  consultation_type text NOT NULL CHECK (consultation_type IN ('counseling', 'learning', 'behavior', 'other')),
  content text NOT NULL,  -- 상담 내용
  ai_summary text,  -- AI 요약 (나중에 생성)
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_consultations_tenant ON public.student_consultations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_consultations_student ON public.student_consultations(student_id);
CREATE INDEX IF NOT EXISTS idx_student_consultations_date ON public.student_consultations(tenant_id, consultation_date DESC);

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거
CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guardians_updated_at
  BEFORE UPDATE ON public.guardians
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_consultations_updated_at
  BEFORE UPDATE ON public.student_consultations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

