-- 2026-01-27: class_teachers.teacher_id FK 제약 조건 수정
-- 문제: class_teachers.teacher_id가 academy_teachers.person_id를 참조 (잘못됨)
-- 수정: class_teachers.teacher_id가 academy_teachers.id를 참조 (올바름)

-- 1. 기존 잘못된 FK 제약 조건 삭제
ALTER TABLE class_teachers
DROP CONSTRAINT IF EXISTS class_teachers_teacher_id_fkey;

-- 2. 올바른 FK 제약 조건 추가
ALTER TABLE class_teachers
ADD CONSTRAINT class_teachers_teacher_id_fkey
FOREIGN KEY (teacher_id)
REFERENCES academy_teachers(id)
ON DELETE CASCADE;

-- 제약 조건 확인용 코멘트
COMMENT ON CONSTRAINT class_teachers_teacher_id_fkey ON class_teachers IS
'[수정됨 2026-01-27] class_teachers.teacher_id는 academy_teachers.id를 참조해야 함 (이전에는 person_id를 잘못 참조)';
