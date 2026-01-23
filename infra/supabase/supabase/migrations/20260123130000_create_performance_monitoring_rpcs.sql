-- Migration: Create Performance Monitoring RPC Functions
-- Description: Edge Function, Realtime, Storage 통계 조회를 위한 RPC 함수 생성
-- Date: 2026-01-23

-- ============================================================================
-- 1. Edge Function 통계 조회 RPC
-- ============================================================================
-- Edge Function 로그를 분석하여 함수별 통계 제공
-- - 최근 24시간 호출 횟수, 에러율, 평균 실행 시간

CREATE OR REPLACE FUNCTION get_edge_function_stats()
RETURNS TABLE (
  function_name TEXT,
  total_calls BIGINT,
  error_count BIGINT,
  error_rate NUMERIC,
  avg_execution_time NUMERIC,
  max_execution_time NUMERIC,
  last_error TEXT,
  last_error_time TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ⚠️ 주의: Edge Function 로그는 Supabase Management API를 통해서만 접근 가능
  -- 현재는 모의 데이터를 반환하며, 실제 구현은 Edge Function에서 로그를 수집하여
  -- edge_function_logs 테이블에 저장한 후 조회하는 방식으로 구현해야 함

  -- Edge Function 로그 테이블이 존재하는 경우 실제 통계 반환
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'edge_function_logs'
  ) THEN
    RETURN QUERY
    SELECT
      efl.function_name::TEXT,
      COUNT(*)::BIGINT AS total_calls,
      COUNT(*) FILTER (WHERE efl.status_code >= 400)::BIGINT AS error_count,
      ROUND(
        (COUNT(*) FILTER (WHERE efl.status_code >= 400)::NUMERIC / NULLIF(COUNT(*), 0) * 100),
        2
      ) AS error_rate,
      ROUND(AVG(efl.execution_time_ms)::NUMERIC, 2) AS avg_execution_time,
      ROUND(MAX(efl.execution_time_ms)::NUMERIC, 2) AS max_execution_time,
      (
        SELECT event_message
        FROM edge_function_logs efl2
        WHERE efl2.function_name = efl.function_name
          AND efl2.status_code >= 400
        ORDER BY efl2.timestamp DESC
        LIMIT 1
      )::TEXT AS last_error,
      (
        SELECT timestamp
        FROM edge_function_logs efl2
        WHERE efl2.function_name = efl.function_name
          AND efl2.status_code >= 400
        ORDER BY efl2.timestamp DESC
        LIMIT 1
      ) AS last_error_time
    FROM edge_function_logs efl
    WHERE efl.timestamp >= NOW() - INTERVAL '24 hours'
    GROUP BY efl.function_name
    ORDER BY total_calls DESC;
  ELSE
    -- 로그 테이블이 없는 경우 빈 결과 반환
    RETURN;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_edge_function_stats() IS
'Edge Function 통계 조회 (최근 24시간)
- 함수별 호출 횟수, 에러율, 실행 시간
- 실제 로그는 edge_function_logs 테이블에서 조회
- 로그 수집은 별도 Edge Function으로 구현 필요';

-- ============================================================================
-- 2. Realtime 통계 조회 RPC
-- ============================================================================
-- Realtime 연결 및 메시지 통계 제공

CREATE OR REPLACE FUNCTION get_realtime_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- ⚠️ 주의: Realtime 통계는 Supabase Realtime Inspector API를 통해서만 접근 가능
  -- 현재는 모의 데이터를 반환하며, 실제 구현은 Realtime 메트릭을 수집하여
  -- realtime_stats 테이블에 저장한 후 조회하는 방식으로 구현해야 함

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'realtime_connection_logs'
  ) THEN
    SELECT json_build_object(
      'active_connections', (
        SELECT COUNT(DISTINCT connection_id)
        FROM realtime_connection_logs
        WHERE disconnected_at IS NULL
      ),
      'total_messages_24h', (
        SELECT COUNT(*)
        FROM realtime_connection_logs
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      ),
      'error_count_24h', (
        SELECT COUNT(*)
        FROM realtime_connection_logs
        WHERE error IS NOT NULL
          AND created_at >= NOW() - INTERVAL '24 hours'
      ),
      'channels', (
        SELECT json_agg(
          json_build_object(
            'name', channel,
            'subscribers', COUNT(DISTINCT connection_id),
            'messages', COUNT(*)
          )
        )
        FROM realtime_connection_logs
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY channel
        LIMIT 10
      )
    ) INTO result;

    RETURN result;
  ELSE
    -- 로그 테이블이 없는 경우 기본값 반환
    RETURN json_build_object(
      'active_connections', 0,
      'total_messages_24h', 0,
      'error_count_24h', 0,
      'channels', '[]'::json
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION get_realtime_stats() IS
'Realtime 연결 통계 조회
- 활성 연결 수, 메시지 수, 에러 수
- 채널별 구독자 및 메시지 통계
- 실제 로그는 realtime_connection_logs 테이블에서 조회';

-- ============================================================================
-- 3. Storage 사용량 조회 RPC
-- ============================================================================
-- Storage 버킷별 사용량 및 파일 수 제공

CREATE OR REPLACE FUNCTION get_storage_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  result JSON;
  total_usage BIGINT;
  total_files BIGINT;
  limit_bytes BIGINT := 107374182400; -- 100GB (기본 Supabase 무료 플랜)
BEGIN
  -- Storage 사용량 계산 (storage.objects 테이블 사용)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    -- 전체 사용량 계산
    SELECT
      COALESCE(SUM(
        CASE
          WHEN metadata->>'size' IS NOT NULL
          THEN (metadata->>'size')::BIGINT
          ELSE 0
        END
      ), 0),
      COUNT(*)
    INTO total_usage, total_files
    FROM storage.objects
    WHERE NOT (metadata->>'mimetype' = 'application/x-directory' OR name LIKE '%/');

    -- 버킷별 통계
    SELECT json_build_object(
      'total_usage_bytes', total_usage,
      'total_usage_formatted', pg_size_pretty(total_usage),
      'total_files', total_files,
      'usage_percentage', ROUND((total_usage::NUMERIC / limit_bytes * 100), 2),
      'limit_bytes', limit_bytes,
      'buckets', (
        SELECT json_agg(
          json_build_object(
            'bucket_name', bucket_id,
            'total_size_bytes', bucket_size,
            'total_size_formatted', pg_size_pretty(bucket_size),
            'file_count', file_count,
            'last_updated', last_updated
          )
        )
        FROM (
          SELECT
            bucket_id,
            SUM(
              CASE
                WHEN metadata->>'size' IS NOT NULL
                THEN (metadata->>'size')::BIGINT
                ELSE 0
              END
            ) AS bucket_size,
            COUNT(*) AS file_count,
            MAX(created_at) AS last_updated
          FROM storage.objects
          WHERE NOT (metadata->>'mimetype' = 'application/x-directory' OR name LIKE '%/')
          GROUP BY bucket_id
          ORDER BY bucket_size DESC
        ) bucket_stats
      )
    ) INTO result;

    RETURN result;
  ELSE
    -- storage.objects 테이블이 없는 경우 기본값 반환
    RETURN json_build_object(
      'total_usage_bytes', 0,
      'total_usage_formatted', '0 bytes',
      'total_files', 0,
      'usage_percentage', 0,
      'limit_bytes', limit_bytes,
      'buckets', '[]'::json
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION get_storage_stats() IS
'Storage 사용량 통계 조회
- 전체 사용량 및 파일 수
- 버킷별 사용량 및 파일 수
- storage.objects 테이블에서 직접 조회';

-- ============================================================================
-- 4. RPC 함수 권한 설정
-- ============================================================================
-- Super Admin만 성능 모니터링 RPC 호출 가능

-- get_edge_function_stats 권한
REVOKE ALL ON FUNCTION get_edge_function_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_edge_function_stats() TO authenticated;

-- get_realtime_stats 권한
REVOKE ALL ON FUNCTION get_realtime_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_realtime_stats() TO authenticated;

-- get_storage_stats 권한
REVOKE ALL ON FUNCTION get_storage_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_storage_stats() TO authenticated;

-- ⚠️ RLS를 통한 추가 권한 검증은 애플리케이션 레벨에서 수행
-- Super Admin 앱에서만 이 함수들을 호출하도록 제한

-- ============================================================================
-- 5. 완료 메시지
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Performance Monitoring RPC 생성 완료!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '생성된 RPC 함수:';
  RAISE NOTICE '  - get_edge_function_stats(): Edge Function 통계';
  RAISE NOTICE '  - get_realtime_stats(): Realtime 연결 통계';
  RAISE NOTICE '  - get_storage_stats(): Storage 사용량 통계';
  RAISE NOTICE '';
  RAISE NOTICE '📌 실제 로그 수집 필요:';
  RAISE NOTICE '   1. Edge Function 로그 → edge_function_logs 테이블';
  RAISE NOTICE '   2. Realtime 메트릭 → realtime_connection_logs 테이블';
  RAISE NOTICE '   3. Storage는 storage.objects에서 직접 조회 (구현 완료)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ 권한: authenticated 사용자만 호출 가능';
  RAISE NOTICE '   Super Admin 앱에서 추가 검증 수행';
  RAISE NOTICE '';
END $$;
