/**
 * Realtime 메트릭 수집
 *
 * 역할: Supabase Realtime Inspector API에서 메트릭을 가져와 realtime_connection_logs 테이블에 저장
 * 실행: Cron Job으로 1분마다 실행
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ACCESS_TOKEN = Deno.env.get('MANAGEMENT_API_TOKEN');
const PROJECT_REF = Deno.env.get('PROJECT_REF');

interface RealtimeMetrics {
  active_connections: number;
  total_messages: number;
  error_count: number;
  channels: Array<{
    name: string;
    subscribers: number;
    messages: number;
  }>;
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

    let metrics: RealtimeMetrics = {
      active_connections: 0,
      total_messages: 0,
      error_count: 0,
      channels: [],
    };

    if (SUPABASE_ACCESS_TOKEN && PROJECT_REF) {
      // Management API 사용 (Realtime Inspector)
      const metricsResponse = await fetch(
        `https://api.supabase.com/v1/projects/${PROJECT_REF}/realtime/inspector`,
        {
          headers: {
            'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          },
        }
      );

      if (metricsResponse.ok) {
        const data = await metricsResponse.json();
        metrics = {
          active_connections: data.connections?.length || 0,
          total_messages: data.total_messages || 0,
          error_count: data.errors?.length || 0,
          channels: (data.channels || []).map((ch: any) => ({
            name: ch.topic,
            subscribers: ch.subscribers,
            messages: ch.messages,
          })),
        };
      } else {
        console.warn('Failed to fetch realtime metrics:', await metricsResponse.text());
      }
    } else {
      // Fallback: Logs API로 추정
      const { data: logs } = await supabase.rpc('get_logs', {
        p_service: 'realtime',
      });

      if (logs && logs.length > 0) {
        // 로그에서 메트릭 추정
        metrics.total_messages = logs.filter((l: any) => l.metadata?.event === 'message').length;
        metrics.error_count = logs.filter((l: any) => l.metadata?.level === 'error').length;
      }
    }

    // realtime_connection_logs 테이블에 저장
    const { error: createError } = await supabase.rpc('ensure_realtime_connection_logs_table');
    if (createError) {
      console.warn('Table creation check failed:', createError.message);
    }

    const { error: insertError } = await supabase
      .from('realtime_connection_logs')
      .insert({
        active_connections: metrics.active_connections,
        total_messages: metrics.total_messages,
        error_count: metrics.error_count,
        channels: metrics.channels,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      throw new Error(`Failed to insert metrics: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        metrics,
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
    console.error('Realtime metrics collection error:', error);

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
