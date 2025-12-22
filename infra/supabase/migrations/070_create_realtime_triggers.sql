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
      -- 기술문서 19-1-2: KST 기준 날짜 처리 (timezone('Asia/Seoul', now())::date 사용)
      expires_at := ((timezone('Asia/Seoul', now())::date + INTERVAL '3 days')::DATE + TIME '23:59:59')::timestamptz;

      -- ⚠️ v3.3 정본 규칙: 멱등성/중복방지 - 반드시 UPSERT 사용 (프론트 자동화 문서 2.3 섹션 참조)
      -- 정본 포맷: dedup_key = "{tenantId}:{trigger}:{entityType}:{entityId}:{window}"
      INSERT INTO task_cards (
        tenant_id,
        student_id,
        entity_id,
        entity_type,
        student_name,
        task_type,
        priority,
        title,
        description,
        action_url,
        expires_at,
        absence_days,
        parent_contact_needed,
        dedup_key,
        status
      ) VALUES (
        NEW.tenant_id,
        NEW.student_id,
        NEW.student_id,  -- entity_id = student_id (entity_type='student')
        'student',       -- entity_type
        student_name,
        'absence',
        60 + absence_count * 10, -- 우선순위 계산
        absence_count || '일 연속 결석',
        COALESCE(student_name, '학생') || '이(가) ' || absence_count || '일 연속 결석했습니다. 학부모 연락이 필요합니다.',
        '/students/' || NEW.student_id || '/attendance',
        expires_at,
        absence_count,
        true,
        NEW.tenant_id::text || ':absence:student:' || NEW.student_id::text || ':' || timezone('Asia/Seoul', now())::date::text, -- 정본 포맷
        'pending'
      )
      ON CONFLICT (tenant_id, dedup_key)
      WHERE dedup_key IS NOT NULL
      DO UPDATE SET
        updated_at = now(),
        priority = EXCLUDED.priority,
        absence_days = EXCLUDED.absence_days;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 재생성 (기존 트리거가 있을 수 있으므로 DROP 후 CREATE)
DROP TRIGGER IF EXISTS attendance_absence_trigger ON attendance_logs;
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
  -- 기술문서 19-1-2: KST 기준 날짜 처리 (timezone('Asia/Seoul', now())::date 사용)
  expires_at := (timezone('Asia/Seoul', now())::date + TIME '23:59:59')::timestamptz;

  -- ⚠️ v3.3 정본 규칙: 멱등성/중복방지 - 반드시 UPSERT 사용 (프론트 자동화 문서 2.3 섹션 참조)
  -- 정본 포맷: dedup_key = "{tenantId}:{trigger}:{entityType}:{entityId}:{window}"
  INSERT INTO task_cards (
    tenant_id,
    student_id,
    entity_id,
    entity_type,
    student_name,
    task_type,
    priority,
    title,
    description,
    action_url,
    expires_at,
    counseling_type,
    urgency,
    dedup_key,
    status
  ) VALUES (
    NEW.tenant_id,
    NEW.student_id,
    NEW.student_id,  -- entity_id = student_id (entity_type='student')
    'student',       -- entity_type
    student_name,
    'counseling',
    50, -- 기본 우선순위
    '상담 필요',
    COALESCE(student_name, '학생') || '에 대한 상담이 필요합니다.',
    '/students/' || NEW.student_id || '/counsel',
    expires_at,
    NEW.consultation_type,
    'normal',
    NEW.tenant_id::text || ':counseling:student:' || NEW.student_id::text || ':' || timezone('Asia/Seoul', now())::date::text, -- 정본 포맷
    'pending'
  )
  ON CONFLICT (tenant_id, dedup_key)
  WHERE dedup_key IS NOT NULL AND status = 'pending'
  DO UPDATE SET
    updated_at = now(),
    priority = EXCLUDED.priority;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 재생성 (기존 트리거가 있을 수 있으므로 DROP 후 CREATE)
DROP TRIGGER IF EXISTS consultation_task_card_trigger ON student_consultations;
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
  IF NEW.content IS NOT NULL AND LENGTH(TRIM(NEW.content)) > 0 THEN
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
      LEFT(NEW.content, 200) || '...', -- 임시 요약 (실제로는 AI 생성)
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

-- 트리거 재생성 (기존 트리거가 있을 수 있으므로 DROP 후 CREATE)
DROP TRIGGER IF EXISTS consultation_ai_summary_trigger ON student_consultations;
CREATE TRIGGER consultation_ai_summary_trigger
AFTER INSERT OR UPDATE ON student_consultations
FOR EACH ROW
WHEN (NEW.content IS NOT NULL AND LENGTH(TRIM(NEW.content)) > 0)
EXECUTE FUNCTION create_consultation_ai_summary();

-- 신규 학생 등록 시 StudentTaskCard 생성 트리거
CREATE OR REPLACE FUNCTION create_new_signup_task_card()
RETURNS TRIGGER AS $$
DECLARE
  expires_at TIMESTAMPTZ;
BEGIN
  -- 학생 타입인 경우에만 처리
  IF NEW.person_type = 'student' THEN
    -- 만료일: 7일 후 자정 (아키텍처 문서 803줄)
    -- 기술문서 19-1-2: KST 기준 날짜 처리 (timezone('Asia/Seoul', now())::date 사용)
    expires_at := ((timezone('Asia/Seoul', now())::date + INTERVAL '7 days')::DATE + TIME '23:59:59')::timestamptz;

    -- ⚠️ v3.3 정본 규칙: 멱등성/중복방지 - 반드시 UPSERT 사용 (프론트 자동화 문서 2.3 섹션 참조)
    -- 정본 포맷: dedup_key = "{tenantId}:{trigger}:{entityType}:{entityId}:{window}"
    INSERT INTO task_cards (
      tenant_id,
      student_id,
      entity_id,
      entity_type,
      student_name,
      task_type,
      priority,
      title,
      description,
      action_url,
      expires_at,
      signup_date,
      initial_setup_needed,
      dedup_key,
      status
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      NEW.id,        -- entity_id = student_id (entity_type='student')
      'student',     -- entity_type
      NEW.name,
      'new_signup',
      30, -- 기본 우선순위
      '신규 등록 학생 환영',
      NEW.name || ' 학생이 등록되었습니다. 환영 메시지 발송 및 초기 설정을 완료하세요.',
      '/students/' || NEW.id || '/welcome',
      expires_at,
      NEW.created_at,
      true,
      NEW.tenant_id::text || ':new_signup:student:' || NEW.id::text || ':' || timezone('Asia/Seoul', now())::date::text, -- 정본 포맷
      'pending'
    )
    ON CONFLICT (tenant_id, dedup_key)
    WHERE dedup_key IS NOT NULL AND status = 'pending'
    DO UPDATE SET
      updated_at = now(),
      priority = EXCLUDED.priority;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 재생성 (기존 트리거가 있을 수 있으므로 DROP 후 CREATE)
DROP TRIGGER IF EXISTS new_student_signup_trigger ON persons;
CREATE TRIGGER new_student_signup_trigger
AFTER INSERT ON persons
FOR EACH ROW
WHEN (NEW.person_type = 'student')
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
    -- 기술문서 19-1-2: KST 기준 날짜 처리 (timezone('Asia/Seoul', now())::date 사용)
    expires_at := ((timezone('Asia/Seoul', now())::date + INTERVAL '5 days')::DATE + TIME '23:59:59')::timestamptz;

    -- ⚠️ v3.3 정본 규칙: 멱등성/중복방지 - 반드시 UPSERT 사용 (프론트 자동화 문서 2.3 섹션 참조)
    -- 정본 포맷: dedup_key = "{tenantId}:{trigger}:{entityType}:{entityId}:{window}"
    INSERT INTO task_cards (
      tenant_id,
      student_id,
      entity_id,
      entity_type,
      student_name,
      task_type,
      priority,
      title,
      description,
      action_url,
      expires_at,
      risk_level,
      risk_reason,
      recommended_action,
      dedup_key,
      status
    ) VALUES (
      p_tenant_id,
      p_student_id,
      p_student_id,  -- entity_id = student_id (entity_type='student')
      'student',     -- entity_type
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
      p_recommended_action,
      p_tenant_id::text || ':risk:student:' || p_student_id::text || ':' || timezone('Asia/Seoul', now())::date::text, -- 정본 포맷
      'pending'
    )
    ON CONFLICT (tenant_id, dedup_key)
    WHERE dedup_key IS NOT NULL AND status = 'pending'
    DO UPDATE SET
      updated_at = now(),
      priority = EXCLUDED.priority,
      risk_level = EXCLUDED.risk_level,
      risk_reason = EXCLUDED.risk_reason,
      recommended_action = EXCLUDED.recommended_action
    RETURNING id INTO card_id;

    RETURN card_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

