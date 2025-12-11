/**
 * 실시간 이벤트 트리거 생성
 *
 * 아키텍처 문서 3.1.3 섹션 참조
 * Zero-Management: 이벤트 발생 시 자동으로 StudentTaskCard 생성
 */

-- 결석 이벤트 발생 시 StudentTaskCard 생성 트리거
CREATE OR REPLACE FUNCTION create_absence_task_card()
RETURNS TRIGGER AS $$
DECLARE
  student_name TEXT;
  absence_count INTEGER;
  expires_at TIMESTAMPTZ;
BEGIN
  -- 결석 상태인 경우에만 처리
  IF NEW.status = 'absent' THEN
    -- 학생 이름 조회
    SELECT name INTO student_name
    FROM persons
    WHERE id = NEW.student_id AND tenant_id = NEW.tenant_id;

    -- 최근 3일간 결석 횟수 확인
    SELECT COUNT(*) INTO absence_count
    FROM attendance_logs
    WHERE student_id = NEW.student_id
      AND tenant_id = NEW.tenant_id
      AND status = 'absent'
      AND occurred_at >= NOW() - INTERVAL '3 days';

    -- 3일 이상 결석한 경우에만 카드 생성
    IF absence_count >= 3 THEN
      -- 만료일: 3일 후 자정 (아키텍처 문서 802줄)
      expires_at := (CURRENT_DATE + INTERVAL '3 days')::DATE + TIME '23:59:59';

      -- 중복 카드 확인 (동일 날짜에 이미 생성된 카드가 있는지)
      IF NOT EXISTS (
        SELECT 1 FROM student_task_cards
        WHERE tenant_id = NEW.tenant_id
          AND student_id = NEW.student_id
          AND task_type = 'absence'
          AND DATE(created_at) = CURRENT_DATE
      ) THEN
        INSERT INTO student_task_cards (
          tenant_id,
          student_id,
          student_name,
          task_type,
          priority,
          title,
          description,
          action_url,
          expires_at,
          absence_days,
          parent_contact_needed
        ) VALUES (
          NEW.tenant_id,
          NEW.student_id,
          student_name,
          'absence',
          60 + absence_count * 10, -- 우선순위 계산
          absence_count || '일 연속 결석',
          COALESCE(student_name, '학생') || '이(가) ' || absence_count || '일 연속 결석했습니다. 학부모 연락이 필요합니다.',
          '/students/' || NEW.student_id || '/attendance',
          expires_at,
          absence_count,
          true
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attendance_absence_trigger
AFTER INSERT ON attendance_logs
FOR EACH ROW
WHEN (NEW.status = 'absent')
EXECUTE FUNCTION create_absence_task_card();

-- 상담일지 저장 시 StudentTaskCard 생성 트리거
CREATE OR REPLACE FUNCTION create_counseling_task_card()
RETURNS TRIGGER AS $$
DECLARE
  student_name TEXT;
  expires_at TIMESTAMPTZ;
BEGIN
  -- 학생 이름 조회
  SELECT name INTO student_name
  FROM persons
  WHERE id = NEW.student_id AND tenant_id = NEW.tenant_id;

  -- 만료일: 당일 자정 (아키텍처 문서 801줄)
  expires_at := CURRENT_DATE + TIME '23:59:59';

  -- 중복 카드 확인
  IF NOT EXISTS (
    SELECT 1 FROM student_task_cards
    WHERE tenant_id = NEW.tenant_id
      AND student_id = NEW.student_id
      AND task_type = 'counseling'
      AND DATE(created_at) = CURRENT_DATE
  ) THEN
    INSERT INTO student_task_cards (
      tenant_id,
      student_id,
      student_name,
      task_type,
      priority,
      title,
      description,
      action_url,
      expires_at,
      counseling_type,
      urgency
    ) VALUES (
      NEW.tenant_id,
      NEW.student_id,
      student_name,
      'counseling',
      50, -- 기본 우선순위
      '상담 필요',
      COALESCE(student_name, '학생') || '에 대한 상담이 필요합니다.',
      '/students/' || NEW.student_id || '/counsel',
      expires_at,
      NEW.consultation_type,
      'normal'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consultation_task_card_trigger
AFTER INSERT ON student_consultations
FOR EACH ROW
EXECUTE FUNCTION create_counseling_task_card();

-- 상담일지 저장 시 AI 자동 요약 생성 트리거 (아키텍처 문서 324줄)
CREATE OR REPLACE FUNCTION create_consultation_ai_summary()
RETURNS TRIGGER AS $$
DECLARE
  summary_text TEXT;
BEGIN
  -- 상담일지 내용이 있는 경우에만 AI 요약 생성
  IF NEW.notes IS NOT NULL AND LENGTH(TRIM(NEW.notes)) > 0 THEN
    -- TODO: 실제 AI API 호출로 변경 필요
    -- 현재는 간단한 요약 생성 (실제로는 AI 엔진 호출)
    -- AI 요약 생성은 별도 Edge Function 또는 외부 서비스로 처리

    -- AI 요약을 ai_insights 테이블에 저장
    INSERT INTO ai_insights (
      tenant_id,
      insight_type,
      title,
      summary,
      insights,
      action_url,
      created_at
    ) VALUES (
      NEW.tenant_id,
      'consultation_summary',
      '상담일지 요약',
      LEFT(NEW.notes, 200) || '...', -- 임시 요약 (실제로는 AI 생성)
      jsonb_build_array(
        '상담 내용을 바탕으로 학생의 학습 방향을 조정할 수 있습니다.',
        '다음 상담 시점을 확인하세요.'
      ),
      '/students/' || NEW.student_id || '/counsel',
      NOW()
    )
    ON CONFLICT DO NOTHING; -- 중복 방지
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER consultation_ai_summary_trigger
AFTER INSERT OR UPDATE ON student_consultations
FOR EACH ROW
WHEN (NEW.notes IS NOT NULL AND LENGTH(TRIM(NEW.notes)) > 0)
EXECUTE FUNCTION create_consultation_ai_summary();

-- 신규 학생 등록 시 StudentTaskCard 생성 트리거
CREATE OR REPLACE FUNCTION create_new_signup_task_card()
RETURNS TRIGGER AS $$
DECLARE
  expires_at TIMESTAMPTZ;
BEGIN
  -- 학생 타입인 경우에만 처리
  IF NEW.person_type = 'student' AND NEW.status = 'active' THEN
    -- 만료일: 7일 후 자정 (아키텍처 문서 803줄)
    expires_at := (CURRENT_DATE + INTERVAL '7 days')::DATE + TIME '23:59:59';

    -- 중복 카드 확인
    IF NOT EXISTS (
      SELECT 1 FROM student_task_cards
      WHERE tenant_id = NEW.tenant_id
        AND student_id = NEW.id
        AND task_type = 'new_signup'
    ) THEN
      INSERT INTO student_task_cards (
        tenant_id,
        student_id,
        student_name,
        task_type,
        priority,
        title,
        description,
        action_url,
        expires_at,
        signup_date,
        initial_setup_needed
      ) VALUES (
        NEW.tenant_id,
        NEW.id,
        NEW.name,
        'new_signup',
        30, -- 기본 우선순위
        '신규 등록 학생 환영',
        NEW.name || ' 학생이 등록되었습니다. 환영 메시지 발송 및 초기 설정을 완료하세요.',
        '/students/' || NEW.id || '/welcome',
        expires_at,
        NEW.created_at,
        true
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER new_student_signup_trigger
AFTER INSERT ON persons
FOR EACH ROW
WHEN (NEW.person_type = 'student' AND NEW.status = 'active')
EXECUTE FUNCTION create_new_signup_task_card();

-- 이탈 위험 감지 시 StudentTaskCard 생성 (AI 위험 점수 90 이상)
-- 이 함수는 AI 엔진에서 직접 호출하거나 별도 트리거로 구현
CREATE OR REPLACE FUNCTION create_risk_task_card(
  p_tenant_id UUID,
  p_student_id UUID,
  p_risk_score INTEGER,
  p_risk_reason TEXT,
  p_recommended_action TEXT
)
RETURNS UUID AS $$
DECLARE
  student_name TEXT;
  expires_at TIMESTAMPTZ;
  card_id UUID;
BEGIN
  -- 위험 점수 90 이상인 경우에만 처리
  IF p_risk_score >= 90 THEN
    -- 학생 이름 조회
    SELECT name INTO student_name
    FROM persons
    WHERE id = p_student_id AND tenant_id = p_tenant_id;

    -- 만료일: 5일 후 자정 (아키텍처 문서 804줄)
    expires_at := (CURRENT_DATE + INTERVAL '5 days')::DATE + TIME '23:59:59';

    -- 중복 카드 확인 (동일 날짜)
    IF NOT EXISTS (
      SELECT 1 FROM student_task_cards
      WHERE tenant_id = p_tenant_id
        AND student_id = p_student_id
        AND task_type = 'risk'
        AND DATE(created_at) = CURRENT_DATE
    ) THEN
      INSERT INTO student_task_cards (
        tenant_id,
        student_id,
        student_name,
        task_type,
        priority,
        title,
        description,
        action_url,
        expires_at,
        risk_level,
        risk_reason,
        recommended_action
      ) VALUES (
        p_tenant_id,
        p_student_id,
        student_name,
        'risk',
        p_risk_score, -- 위험 점수를 우선순위로 사용
        '이탈 위험 학생',
        COALESCE(student_name, '학생') || '이(가) 이탈 위험 단계입니다. ' || COALESCE(p_risk_reason, ''),
        '/students/' || p_student_id || '/risk',
        expires_at,
        CASE
          WHEN p_risk_score >= 90 THEN 'high'
          WHEN p_risk_score >= 70 THEN 'medium'
          ELSE 'low'
        END,
        p_risk_reason,
        p_recommended_action
      )
      RETURNING id INTO card_id;

      RETURN card_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

