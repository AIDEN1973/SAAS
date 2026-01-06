-- Academy 업종 관련 테이블 생성 (persons 참조)
-- [불변 규칙] 모든 테이블은 tenant_id 필수 + 인덱스 구성
-- [불변 규칙] student_id는 person_id를 참조 (persons.id)
-- [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)

-- 1. 학부모(보호자) 테이블
CREATE TABLE IF NOT EXISTS public.guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,  -- persons 테이블 참조
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

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_guardians_updated_at
  BEFORE UPDATE ON public.guardians
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. 반-학생 연결 테이블 (다중 반 소속 지원)
CREATE TABLE IF NOT EXISTS public.student_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,  -- persons 테이블 참조
  class_id uuid NOT NULL,  -- classes 테이블 참조 (나중에 생성)
  -- 기술문서 19-1-2: DEFAULT CURRENT_DATE는 레거시/직접 INSERT용이며, 앱에서는 toKST()로 계산한 값을 명시적으로 전달해야 함
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

-- 3. 상담일지 테이블
CREATE TABLE IF NOT EXISTS public.student_consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,  -- persons 테이블 참조
  -- 기술문서 19-1-2: DEFAULT CURRENT_DATE는 레거시/직접 INSERT용이며, 앱에서는 toKST()로 계산한 값을 명시적으로 전달해야 함
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

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_student_consultations_updated_at
  BEFORE UPDATE ON public.student_consultations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

