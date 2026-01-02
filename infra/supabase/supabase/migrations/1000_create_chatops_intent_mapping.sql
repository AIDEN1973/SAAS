-- ChatOps Intent 매핑 테이블 생성
-- 목적: 사용자 질문 패턴을 Tool과 매핑하여 AI 성능 향상 및 토큰 비용 절감
-- 단기 학습 전략: 룰 기반 매핑

-- 1. chatops_intent_patterns 테이블 - 질문 패턴 저장
CREATE TABLE IF NOT EXISTS public.chatops_intent_patterns (
  id serial PRIMARY KEY,
  pattern text NOT NULL UNIQUE, -- 사용자 질문 패턴 (예: "학생 등록", "출결 조회")
  normalized_pattern text NOT NULL, -- 정규화된 패턴 (공백/특수문자 제거)
  tool_name text NOT NULL, -- 매핑된 Tool 이름
  action text, -- Tool의 action 파라미터 (선택)
  confidence decimal NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  usage_count int NOT NULL DEFAULT 0, -- 사용 횟수
  success_count int NOT NULL DEFAULT 0, -- 성공 횟수
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_chatops_intent_patterns_normalized
  ON public.chatops_intent_patterns(normalized_pattern);
CREATE INDEX IF NOT EXISTS idx_chatops_intent_patterns_tool
  ON public.chatops_intent_patterns(tool_name);
CREATE INDEX IF NOT EXISTS idx_chatops_intent_patterns_confidence
  ON public.chatops_intent_patterns(confidence DESC);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_chatops_intent_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_chatops_intent_patterns_updated_at
  BEFORE UPDATE ON public.chatops_intent_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_chatops_intent_patterns_updated_at();

-- 2. 기본 Intent 패턴 데이터 삽입
INSERT INTO public.chatops_intent_patterns (pattern, normalized_pattern, tool_name, action, confidence) VALUES
-- 학생 관리
('학생 등록', '학생등록', 'manage_student', 'register', 1.0),
('학생 추가', '학생추가', 'manage_student', 'register', 1.0),
('신규 학생', '신규학생', 'manage_student', 'register', 1.0),
('학생등록해줘', '학생등록해줘', 'manage_student', 'register', 1.0),
('학생 조회', '학생조회', 'manage_student', 'search', 1.0),
('학생 검색', '학생검색', 'manage_student', 'search', 1.0),
('학생 찾기', '학생찾기', 'manage_student', 'search', 1.0),
('학생 정보', '학생정보', 'manage_student', 'get_profile', 1.0),
('학생 퇴원', '학생퇴원', 'discharge', NULL, 1.0),
('퇴원 처리', '퇴원처리', 'discharge', NULL, 1.0),
('학생 휴원', '학생휴원', 'pause', NULL, 1.0),
('휴원 처리', '휴원처리', 'pause', NULL, 1.0),
('학생 복귀', '학생복귀', 'resume', NULL, 1.0),
('복귀 처리', '복귀처리', 'resume', NULL, 1.0),

-- 출결 관리
('출결 조회', '출결조회', 'query_attendance', NULL, 1.0),
('출석 확인', '출석확인', 'query_attendance', NULL, 1.0),
('출석부', '출석부', 'query_attendance', NULL, 1.0),
('결석 확인', '결석확인', 'query_attendance', NULL, 1.0),

-- 수납 관리
('수납 조회', '수납조회', 'query_billing', NULL, 1.0),
('미납 확인', '미납확인', 'query_billing', NULL, 1.0),
('미수금', '미수금', 'query_billing', NULL, 1.0),
('납부 내역', '납부내역', 'query_billing', NULL, 1.0),
('청구서', '청구서', 'query_billing', NULL, 1.0),

-- 메시지 관리
('메시지 보내기', '메시지보내기', 'send_message', NULL, 1.0),
('문자 발송', '문자발송', 'send_message', NULL, 1.0),
('알림 보내기', '알림보내기', 'send_message', NULL, 1.0),
('공지 전송', '공지전송', 'send_message', NULL, 1.0),

-- 반 관리
('반 조회', '반조회', 'query_class', 'list', 1.0),
('반 목록', '반목록', 'query_class', 'list', 1.0),
('반 학생', '반학생', 'query_class', 'roster', 1.0),
('반별 명단', '반별명단', 'query_class', 'roster', 1.0),

-- 리포트
('통계', '통계', 'get_report', 'summary', 0.8),
('현황', '현황', 'get_report', 'summary', 0.8),
('요약', '요약', 'get_report', 'summary', 0.8)

ON CONFLICT (pattern) DO NOTHING;

-- 3. 패턴 매칭 함수 - 사용자 질문에서 Intent 찾기
CREATE OR REPLACE FUNCTION match_intent_pattern(user_query text)
RETURNS TABLE (
  pattern text,
  tool_name text,
  action text,
  confidence decimal
) AS $$
DECLARE
  normalized_query text;
BEGIN
  -- 쿼리 정규화 (공백, 특수문자 제거, 소문자 변환)
  normalized_query := regexp_replace(lower(user_query), '[^가-힣a-z0-9]', '', 'g');

  -- 정규화된 패턴과 매칭 (부분 일치)
  RETURN QUERY
  SELECT
    p.pattern,
    p.tool_name,
    p.action,
    p.confidence
  FROM chatops_intent_patterns p
  WHERE
    normalized_query LIKE '%' || p.normalized_pattern || '%'
    OR p.normalized_pattern LIKE '%' || normalized_query || '%'
  ORDER BY
    p.confidence DESC,
    p.success_count DESC,
    length(p.normalized_pattern) DESC
  LIMIT 3;
END;
$$ LANGUAGE plpgsql;

-- 4. 사용 통계 업데이트 함수
CREATE OR REPLACE FUNCTION update_intent_pattern_usage(
  pattern_id int,
  is_success boolean DEFAULT true
)
RETURNS void AS $$
BEGIN
  UPDATE chatops_intent_patterns
  SET
    usage_count = usage_count + 1,
    success_count = CASE WHEN is_success THEN success_count + 1 ELSE success_count END,
    last_used_at = now(),
    confidence = CASE
      WHEN usage_count > 10 THEN (success_count::decimal / usage_count::decimal)
      ELSE confidence
    END
  WHERE id = pattern_id;
END;
$$ LANGUAGE plpgsql;

-- 5. 새로운 패턴 학습 함수 (피드백 기반)
CREATE OR REPLACE FUNCTION learn_intent_pattern(
  user_query text,
  tool_name text,
  action text DEFAULT NULL,
  initial_confidence decimal DEFAULT 0.5
)
RETURNS int AS $$
DECLARE
  normalized_query text;
  new_pattern_id int;
BEGIN
  -- 쿼리 정규화
  normalized_query := regexp_replace(lower(user_query), '[^가-힣a-z0-9]', '', 'g');

  -- 패턴 삽입 (중복 시 무시)
  INSERT INTO chatops_intent_patterns (pattern, normalized_pattern, tool_name, action, confidence)
  VALUES (user_query, normalized_query, tool_name, action, initial_confidence)
  ON CONFLICT (pattern) DO UPDATE
  SET
    usage_count = chatops_intent_patterns.usage_count + 1,
    confidence = LEAST(chatops_intent_patterns.confidence + 0.1, 1.0)
  RETURNING id INTO new_pattern_id;

  RETURN new_pattern_id;
END;
$$ LANGUAGE plpgsql;

-- 코멘트 추가
COMMENT ON TABLE public.chatops_intent_patterns IS 'ChatOps 질문 패턴과 Tool 매핑 테이블 - 룰 기반 학습';
COMMENT ON FUNCTION match_intent_pattern IS '사용자 질문에서 가장 일치하는 Intent 패턴 찾기';
COMMENT ON FUNCTION update_intent_pattern_usage IS 'Intent 패턴 사용 통계 업데이트 (성공률 기반 confidence 조정)';
COMMENT ON FUNCTION learn_intent_pattern IS '새로운 패턴 학습 또는 기존 패턴 강화';
