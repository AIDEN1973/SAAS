-- Execution Audit 제약 및 트리거 추가
-- 액티비티.md 8.B 섹션 참조
-- 목적: DB 레벨에서 correlation key, operation_type 형식, details allowlist 강제

-- ============================================================================
-- 8.B.1 correlation key 최소 1개 강제 (CHECK 제약)
-- ============================================================================
-- reference에는 최소한 request_id / source_event_id / diagnostic_id 중 하나가 존재해야 함
-- ⚠️ 참고: request_id는 automation_actions.request_id와 동일한 형식 사용(챗봇.md 6.3.1 참조)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'execution_audit_runs_reference_min_key_chk'
  ) THEN
    ALTER TABLE execution_audit_runs
    ADD CONSTRAINT execution_audit_runs_reference_min_key_chk
    CHECK (
      (reference ? 'request_id')
      OR (reference ? 'source_event_id')
      OR (reference ? 'diagnostic_id')
    );
    RAISE NOTICE 'correlation key 최소 1개 강제 CHECK 제약 추가 완료';
  ELSE
    RAISE NOTICE 'correlation key 최소 1개 강제 CHECK 제약 이미 존재';
  END IF;
END $$;

-- ============================================================================
-- 8.B.2 operation_type 형식 강제 (prefix + kebab-case 고정)
-- ============================================================================
-- prefix가 없는 경우: kebab-case (예: send-sms)
-- prefix가 있는 경우: segment(.segment)*.kebab-case (예: messaging.send-sms)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'execution_audit_runs_operation_type_format_chk'
  ) THEN
    ALTER TABLE execution_audit_runs
    ADD CONSTRAINT execution_audit_runs_operation_type_format_chk
    CHECK (
      -- prefix가 있는 경우: segment(.segment)*.kebab-case
      -- 예: messaging.send-sms, attendance.update-attendance
      -- 마지막 토큰은 kebab-case(하이픈 포함 가능) 또는 단일 단어(하이픈 없음) 허용
      operation_type ~ '^[a-z0-9]+(\.[a-z0-9]+)*\.[a-z0-9]+(-[a-z0-9]+)*$'
      OR
      -- prefix가 없는 경우: kebab-case 또는 단일 단어
      -- 예: send-sms, update-attendance, send
      operation_type ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    );
    RAISE NOTICE 'operation_type 형식 강제 CHECK 제약 추가 완료';
  ELSE
    RAISE NOTICE 'operation_type 형식 강제 CHECK 제약 이미 존재';
  END IF;
END $$;

-- ============================================================================
-- 8.B.3 details allowlist 트리거 함수 및 트리거
-- ============================================================================
-- ⚠️ 성능 고려사항 (P0):
-- - 서버 레벨 캐싱 필수: operation_registry의 allowed_details_keys를 서버에서 캐싱하여 매 INSERT마다 DB 조회를 최소화
-- - DB 트리거는 2차 방어로만 사용: 서버 구현 실수/우회 삽입을 대비한 최소 방어

-- 트리거 함수 생성
-- ⚠️ 중요: unknown_operation은 서버 레벨에서 처리 (status=failed, error_code=unknown_operation으로 Run 생성)
-- 트리거는 details allowlist 검증만 수행 (액티비티.md 8.A.3, 8.B.3 참조)
CREATE OR REPLACE FUNCTION enforce_execution_audit_details_allowlist()
RETURNS trigger AS $$
DECLARE
  allowed jsonb;
  k text;
BEGIN
  -- details가 null이거나 빈 객체면 검증 불필요
  IF NEW.details IS NULL OR NEW.details = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  -- registry 조회 (DB 정본일 때)
  SELECT allowed_details_keys INTO allowed
  FROM meta.operation_registry
  WHERE operation_type = NEW.operation_type
  AND is_enabled = true;

  -- registry에 등록되지 않은 operation_type은 서버에서 처리 (unknown_operation으로 Run 생성)
  -- 트리거는 details allowlist 검증만 수행
  IF allowed IS NULL THEN
    -- unknown_operation인 경우 details는 null이거나 빈 객체여야 함 (서버에서 이미 처리됨)
    -- 하지만 트리거는 details allowlist 검증만 하므로, unknown_operation도 통과
    RETURN NEW;
  END IF;

  -- allowlist에 없는 키가 있으면 예외(또는 제거)
  -- ⚠️ Fail-Closed 철학상 불허 키가 들어오면 예외가 더 명확함
  FOR k IN SELECT jsonb_object_keys(NEW.details)
  LOOP
    IF NOT (allowed ? k) THEN
      RAISE EXCEPTION 'details key not allowed: % (operation_type: %)', k, NEW.operation_type;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trg_enforce_execution_audit_details_allowlist ON execution_audit_runs;
CREATE TRIGGER trg_enforce_execution_audit_details_allowlist
BEFORE INSERT OR UPDATE ON execution_audit_runs
FOR EACH ROW EXECUTE FUNCTION enforce_execution_audit_details_allowlist();

-- execution_audit_steps에도 동일한 트리거 적용
-- ⚠️ 중요: Step details의 allowlist는 Run details와 동일한 규칙을 적용 (액티비티.md 8.2 참조)
CREATE OR REPLACE FUNCTION enforce_execution_audit_steps_details_allowlist()
RETURNS trigger AS $$
DECLARE
  allowed jsonb;
  k text;
  operation_type_val text;
BEGIN
  -- details가 null이거나 빈 객체면 검증 불필요
  IF NEW.details IS NULL OR NEW.details = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  -- run_id로부터 operation_type 조회
  SELECT r.operation_type INTO operation_type_val
  FROM execution_audit_runs r
  WHERE r.id = NEW.run_id;

  IF operation_type_val IS NULL THEN
    RAISE EXCEPTION 'run_id not found: %', NEW.run_id;
  END IF;

  -- registry 조회
  SELECT allowed_details_keys INTO allowed
  FROM meta.operation_registry
  WHERE operation_type = operation_type_val
  AND is_enabled = true;

  -- registry에 등록되지 않은 operation_type은 서버에서 처리 (unknown_operation으로 Run 생성)
  -- 트리거는 details allowlist 검증만 수행
  IF allowed IS NULL THEN
    -- unknown_operation인 경우 details는 null이거나 빈 객체여야 함 (서버에서 이미 처리됨)
    RETURN NEW;
  END IF;

  -- allowlist에 없는 키가 있으면 예외
  FOR k IN SELECT jsonb_object_keys(NEW.details)
  LOOP
    IF NOT (allowed ? k) THEN
      RAISE EXCEPTION 'details key not allowed: % (operation_type: %)', k, operation_type_val;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 트리거 생성
DROP TRIGGER IF EXISTS trg_enforce_execution_audit_steps_details_allowlist ON execution_audit_steps;
CREATE TRIGGER trg_enforce_execution_audit_steps_details_allowlist
BEFORE INSERT OR UPDATE ON execution_audit_steps
FOR EACH ROW EXECUTE FUNCTION enforce_execution_audit_steps_details_allowlist();

-- ============================================================================
-- 8.1 version 필드 Semver 형식 검증 (선택적 CHECK 제약)
-- ============================================================================
-- ⚠️ 참고: 이 CHECK 제약은 선택적이며, 서버 레벨에서 Semver 형식을 보장하는 경우 생략 가능
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'execution_audit_runs_version_semver_chk'
  ) THEN
    ALTER TABLE execution_audit_runs
    ADD CONSTRAINT execution_audit_runs_version_semver_chk
    CHECK (
      version IS NULL
      OR version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*)?(\+[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*)?$'
    );
    RAISE NOTICE 'version 필드 Semver 형식 검증 CHECK 제약 추가 완료';
  ELSE
    RAISE NOTICE 'version 필드 Semver 형식 검증 CHECK 제약 이미 존재';
  END IF;
END $$;

-- ============================================================================
-- COMMENT
-- ============================================================================
COMMENT ON CONSTRAINT execution_audit_runs_reference_min_key_chk ON execution_audit_runs IS 'correlation key 최소 1개 강제 (액티비티.md 8.B.1 참조)';
COMMENT ON CONSTRAINT execution_audit_runs_operation_type_format_chk ON execution_audit_runs IS 'operation_type 형식 강제 (kebab-case, 액티비티.md 8.B.2 참조)';
COMMENT ON CONSTRAINT execution_audit_runs_version_semver_chk ON execution_audit_runs IS 'version 필드 Semver 형식 검증 (선택적, 액티비티.md 8.1 참조)';
COMMENT ON FUNCTION enforce_execution_audit_details_allowlist() IS 'details allowlist 강제 트리거 함수 (액티비티.md 8.B.3 참조)';
COMMENT ON FUNCTION enforce_execution_audit_steps_details_allowlist() IS 'execution_audit_steps details allowlist 강제 트리거 함수 (액티비티.md 8.2, 8.B.3 참조)';

