-- 기존 students 테이블 데이터를 persons + academy_students로 마이그레이션
-- [불변 규칙] 기존 데이터를 보존하면서 새로운 구조로 마이그레이션
-- ⚠️ 주의: 이 마이그레이션은 기존 students 테이블이 존재할 때만 실행해야 합니다.

-- 1. 기존 students 데이터를 persons 테이블로 마이그레이션
INSERT INTO public.persons (id, tenant_id, name, email, phone, address, person_type, created_at, updated_at)
SELECT 
  id,
  tenant_id,
  name,
  email,
  phone,
  address,
  'student'::text as person_type,
  created_at,
  updated_at
FROM public.students
WHERE NOT EXISTS (
  SELECT 1 FROM public.persons WHERE persons.id = students.id
);

-- 2. 기존 students 데이터를 academy_students 테이블로 마이그레이션
INSERT INTO public.academy_students (
  person_id,
  tenant_id,
  birth_date,
  gender,
  school_name,
  grade,
  status,
  notes,
  profile_image_url,
  created_at,
  updated_at,
  created_by,
  updated_by
)
SELECT 
  id as person_id,
  tenant_id,
  birth_date,
  gender,
  school_name,
  grade,
  status,
  notes,
  profile_image_url,
  created_at,
  updated_at,
  created_by,
  updated_by
FROM public.students
WHERE NOT EXISTS (
  SELECT 1 FROM public.academy_students WHERE academy_students.person_id = students.id
);

-- 3. guardians 테이블의 student_id를 person_id로 업데이트 (FK는 이미 person_id를 참조하도록 변경됨)
-- 주의: guardians 테이블의 FK가 이미 person_id를 참조하도록 변경되었다고 가정
-- 만약 아직 student_id를 참조한다면, 먼저 FK를 변경해야 합니다.

-- 4. student_consultations 테이블의 student_id를 person_id로 업데이트
-- 주의: student_consultations 테이블의 FK가 이미 person_id를 참조하도록 변경되었다고 가정
-- 만약 아직 student_id를 참조한다면, 먼저 FK를 변경해야 합니다.

-- 5. student_classes 테이블의 student_id를 person_id로 업데이트
-- 주의: student_classes 테이블의 FK가 이미 person_id를 참조하도록 변경되었다고 가정
-- 만약 아직 student_id를 참조한다면, 먼저 FK를 변경해야 합니다.

-- 6. tag_assignments 테이블의 entity_id는 이미 person_id를 사용하므로 변경 불필요
-- (core-tags는 이미 person_id를 entity_id로 사용)

-- ⚠️ 중요: 마이그레이션 완료 후, 기존 students 테이블은 삭제하지 않습니다.
-- 대신 deprecated로 표시하고, 향후 삭제 계획을 수립합니다.
-- 실제 삭제는 모든 관련 코드가 업데이트된 후에 수행해야 합니다.

