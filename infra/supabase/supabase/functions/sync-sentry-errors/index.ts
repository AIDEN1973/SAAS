/**
 * Sentry 에러 동기화
 *
 * 역할: Sentry API에서 프론트엔드 에러를 가져와 frontend_error_logs 테이블에 저장
 * 실행: Cron Job으로 5분마다 실행
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SENTRY_AUTH_TOKEN = Deno.env.get('SENTRY_AUTH_TOKEN'); // Sentry API Token
const SENTRY_ORG = Deno.env.get('SENTRY_ORG'); // Sentry Organization Slug
const SENTRY_PROJECT = Deno.env.get('SENTRY_PROJECT'); // Sentry Project Slug

interface SentryIssue {
  id: string;
  title: string;
  metadata: {
    type?: string;
    value?: string;
  };
  count: string;
  lastSeen: string;
  level: string;
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

    let errors: Array<{
      id: string;
      message: string;
      component: string;
      operation: string;
      count: number;
      last_seen: string;
      level: string;
    }> = [];

    if (SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT) {
      // Sentry API 호출 (최근 24시간)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const sentryResponse = await fetch(
        `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?statsPeriod=24h&query=is:unresolved`,
        {
          headers: {
            'Authorization': `Bearer ${SENTRY_AUTH_TOKEN}`,
          },
        }
      );

      if (sentryResponse.ok) {
        const issues: SentryIssue[] = await sentryResponse.json();

        // Sentry 이슈를 우리 형식으로 변환
        errors = issues.map(issue => {
          // metadata.value에서 component:operation 파싱
          const metadataValue = issue.metadata?.value || issue.title;
          const [component = 'Unknown', operation = 'Unknown'] = metadataValue.includes(':')
            ? metadataValue.split(':')
            : [metadataValue, ''];

          return {
            id: issue.id,
            message: issue.title,
            component: component.trim(),
            operation: operation.trim() || 'Error',
            count: parseInt(issue.count, 10) || 0,
            last_seen: issue.lastSeen,
            level: issue.level as 'error' | 'warning' | 'info',
          };
        });
      } else {
        console.warn('Failed to fetch Sentry issues:', await sentryResponse.text());
      }
    } else {
      console.warn('Sentry credentials not configured. Skipping sync.');
    }

    // frontend_error_logs 테이블에 저장
    if (errors.length > 0) {
      const { error: createError } = await supabase.rpc('ensure_frontend_error_logs_table');
      if (createError) {
        console.warn('Table creation check failed:', createError.message);
      }

      // 기존 에러 삭제 (최신 상태로 유지)
      await supabase.from('frontend_error_logs').delete().gte('last_seen', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // 새 에러 삽입
      const { error: insertError } = await supabase
        .from('frontend_error_logs')
        .upsert(errors, { onConflict: 'id', ignoreDuplicates: false });

      if (insertError) {
        throw new Error(`Failed to insert errors: ${insertError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        errors_synced: errors.length,
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
    console.error('Sentry error sync error:', error);

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
