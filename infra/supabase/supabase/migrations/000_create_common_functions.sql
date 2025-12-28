-- 공통 함수 생성
-- [불변 규칙] 여러 테이블에서 공통으로 사용하는 함수들을 정의합니다.
-- [불변 규칙] 이 파일은 테이블 생성 전에 실행되어야 합니다.

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

