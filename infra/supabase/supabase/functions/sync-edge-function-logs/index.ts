/**
 * Edge Function 로그 동기화
 *
 * 역할: Supabase Management API에서 Edge Function 로그를 가져와 edge_function_logs 테이블에 저장
 * 실행: Cron Job으로 5분마다 실행
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ACCESS_TOKEN = Deno.env.get('MANAGEMENT_API_TOKEN'); // Management API Token
const PROJECT_REF = Deno.env.get('PROJECT_REF');

interface EdgeFunctionLog {
  id: string;
  timestamp: string;
  event_message: string;
  metadata: {
    function_name?: string;
    execution_time_ms?: number;
    status_code?: number;
    level?: string;
  };
}

serve(async (req) => {
  try {
    // CORS 헤더
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Supabase Logs API 호출 (최근 5분)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    let logs: EdgeFunctionLog[] = [];

    if (SUPABASE_ACCESS_TOKEN && PROJECT_REF) {
      // Management API 사용 (권장)
      const logsResponse = await fetch(
        `https://api.supabase.com/v1/projects/${PROJECT_REF}/logs/edge-functions?timestamp_start=${fiveMinutesAgo}`,
        {
          headers: {
            'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          },
        }
      );

      if (logsResponse.ok) {
        const data = await logsResponse.json();
        logs = data.result || [];
      } else {
        console.warn('Failed to fetch logs from Management API:', await logsResponse.text());
      }
    } else {
      // Fallback: get_logs RPC 사용
      const { data: rpcLogs, error: rpcError } = await supabase.rpc('get_logs', {
        p_service: 'edge-function',
      });

      if (rpcError) {
        console.warn('Failed to fetch logs via RPC:', rpcError.message);
      } else {
        logs = rpcLogs || [];
      }
    }

    // 로그 변환 및 저장
    const transformedLogs = logs.map(log => ({
      function_name: log.metadata.function_name || 'unknown',
      event_message: log.event_message,
      execution_time_ms: log.metadata.execution_time_ms || 0,
      status_code: log.metadata.status_code || 200,
      level: log.metadata.level || 'info',
      created_at: log.timestamp,
    }));

    if (transformedLogs.length > 0) {
      // edge_function_logs 테이블이 없으면 생성
      const { error: createError } = await supabase.rpc('ensure_edge_function_logs_table');
      if (createError) {
        console.warn('Table creation check failed:', createError.message);
      }

      // 로그 삽입 (중복 무시)
      const { error: insertError } = await supabase
        .from('edge_function_logs')
        .upsert(transformedLogs, { onConflict: 'function_name,created_at', ignoreDuplicates: true });

      if (insertError) {
        throw new Error(`Failed to insert logs: ${insertError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        logs_synced: transformedLogs.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Edge Function log sync error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
