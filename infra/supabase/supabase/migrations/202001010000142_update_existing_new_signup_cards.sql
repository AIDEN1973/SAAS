-- 기존 신규 등록 학생 환영 카드의 타이틀과 설명을 새 형식으로 업데이트
-- 목적: 이전 형식("신규 등록 학생 환영", "학생이 등록되었습니다. 환영 메시지 발송 및 초기 설정을 완료하세요.")
--       을 새 형식("{학생이름} 학생 신규 등록", "환영 메시지를 발송해 보세요.")으로 변경

UPDATE task_cards
SET
  title = COALESCE(student_name, '학생') || ' 학생 신규 등록',
  description = '환영 메시지를 발송해 보세요.',
  updated_at = now()
WHERE
  task_type = 'new_signup'
  AND status = 'pending'
  AND (
    title = '신규 등록 학생 환영'
    OR title LIKE '%학생이 등록되었습니다%'
    OR description LIKE '%학생이 등록되었습니다%'
    OR description LIKE '%환영 메시지 발송 및 초기 설정을 완료하세요%'
  )
  AND student_name IS NOT NULL;

-- 주석
COMMENT ON FUNCTION create_new_signup_task_card() IS '신규 학생 등록 시 StudentTaskCard 생성 트리거. 타이틀: "{학생이름} 학생 신규 등록", 설명: "환영 메시지를 발송해 보세요."';

