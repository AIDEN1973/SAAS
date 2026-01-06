-- 개발 환경 RLS 우회 정책 (개발 전용)
-- [불변 규칙] 이 마이그레이션은 개발 환경에서만 사용하며, 프로덕션에서는 제거해야 합니다.
-- [불변 규칙] 개발 환경에서 JWT에 tenant_id claim이 없을 때 테스트를 위한 임시 정책입니다.
-- ⚠️ 주의: 프로덕션 배포 전에 이 정책을 제거하거나 비활성화해야 합니다.
-- 
-- 프로덕션 배포 전 제거 방법:
-- 1. SQL로 직접 제거: DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON <table>;
-- 2. 또는 016_remove_dev_rls_bypass.sql 마이그레이션 실행
-- 
-- 자세한 내용은 docu/프로덕션_RLS_가이드.md 참고

-- 개발 환경 감지 (환경변수 또는 설정 테이블 사용)
-- 현재는 항상 활성화되지만, 실제로는 NODE_ENV 또는 다른 방법으로 감지해야 합니다.

-- persons 테이블 개발 환경 정책 추가
-- 개발 환경에서는 authenticated 사용자가 모든 tenant_id로 접근 가능 (개발 전용)
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.persons;
CREATE POLICY "Dev: Allow all authenticated users" 
ON public.persons
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- academy_students 테이블 개발 환경 정책 추가
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.academy_students;
CREATE POLICY "Dev: Allow all authenticated users" 
ON public.academy_students
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- guardians 테이블 개발 환경 정책 추가
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.guardians;
CREATE POLICY "Dev: Allow all authenticated users" 
ON public.guardians
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- student_consultations 테이블 개발 환경 정책 추가
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.student_consultations;
CREATE POLICY "Dev: Allow all authenticated users" 
ON public.student_consultations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- student_classes 테이블 개발 환경 정책 추가
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.student_classes;
CREATE POLICY "Dev: Allow all authenticated users" 
ON public.student_classes
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- tags 테이블 개발 환경 정책 추가
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.tags;
CREATE POLICY "Dev: Allow all authenticated users" 
ON public.tags
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- tag_assignments 테이블 개발 환경 정책 추가
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.tag_assignments;
CREATE POLICY "Dev: Allow all authenticated users" 
ON public.tag_assignments
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- academy_classes 테이블 개발 환경 정책 추가
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.academy_classes;
CREATE POLICY "Dev: Allow all authenticated users" 
ON public.academy_classes
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- academy_teachers 테이블 개발 환경 정책 추가
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.academy_teachers;
CREATE POLICY "Dev: Allow all authenticated users" 
ON public.academy_teachers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- class_teachers 테이블 개발 환경 정책 추가
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.class_teachers;
CREATE POLICY "Dev: Allow all authenticated users" 
ON public.class_teachers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ⚠️ 중요: 프로덕션 배포 전에 이 정책들을 제거해야 합니다.
-- 제거 명령:
-- DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.persons;
-- DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.academy_students;
-- ... (각 테이블마다)

