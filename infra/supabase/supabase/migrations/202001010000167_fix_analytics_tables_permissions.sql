/**
 * Analytics 테이블 권한 수정
 *
 * 문제: analytics.daily_store_metrics, analytics.daily_region_metrics 테이블에 대한
 * GRANT 권한이 없어서 authenticated 사용자가 접근할 수 없음
 *
 * 해결: analytics 스키마의 테이블에 대한 SELECT, INSERT, UPDATE, DELETE 권한 부여
 */

-- analytics.daily_store_metrics 테이블 권한 부여
GRANT SELECT, INSERT, UPDATE, DELETE ON analytics.daily_store_metrics TO authenticated;

-- analytics.daily_region_metrics 테이블 권한 부여
GRANT SELECT ON analytics.daily_region_metrics TO authenticated;

-- analytics 스키마 사용 권한
GRANT USAGE ON SCHEMA analytics TO authenticated;

-- 시퀀스 권한도 부여 (INSERT 작업을 위해 필요할 수 있음)
-- Note: UUID는 gen_random_uuid()를 사용하므로 시퀀스 권한은 불필요하지만,
-- 다른 테이블에서 시퀀스를 사용할 경우를 대비하여 추가
DO $$
DECLARE
  seq_record RECORD;
BEGIN
  FOR seq_record IN
    SELECT sequence_schema, sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'analytics'
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I.%I TO authenticated',
                   seq_record.sequence_schema, seq_record.sequence_name);
  END LOOP;
END $$;
