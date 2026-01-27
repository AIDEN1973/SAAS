/**
 * Analytics 테이블 권한 수정 스크립트
 *
 * daily_store_metrics 테이블에 대한 GRANT 권한 부여
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xawypsrotrfoyozhrsbb.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhd3lwc3JvdHJmb3lvemhyc2JiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDMxODU3OSwiZXhwIjoyMDQ5ODk0NTc5fQ.C7v0wL7CKhUGXGLZ8l0gYXHlbLNcqW8qNWNRU3GNZF8';

async function fixAnalyticsPermissions() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('Analytics 테이블 권한 수정 시작...');

  const queries = [
    'GRANT SELECT, INSERT, UPDATE, DELETE ON analytics.daily_store_metrics TO authenticated',
    'GRANT SELECT ON analytics.daily_region_metrics TO authenticated',
    'GRANT USAGE ON SCHEMA analytics TO authenticated',
  ];

  for (const query of queries) {
    console.log(`실행 중: ${query}`);

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: query }).single();

    if (error) {
      // exec_sql RPC 함수가 없을 경우, 직접 SQL 실행
      console.log('RPC 함수를 사용할 수 없습니다. PostgreSQL에 직접 연결이 필요합니다.');
      console.log('\nSupabase 대시보드의 SQL Editor에서 다음 SQL을 실행하세요:');
      console.log('\n' + queries.join(';\n') + ';\n');
      process.exit(1);
    }

    console.log('✓ 완료');
  }

  console.log('\n모든 권한이 성공적으로 부여되었습니다!');
}

fixAnalyticsPermissions().catch((error) => {
  console.error('오류 발생:', error);
  process.exit(1);
});
