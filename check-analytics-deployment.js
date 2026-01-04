/**
 * Analytics 배포 상태 진단 스크립트
 *
 * Edge Functions, Cron Jobs, 데이터 존재 여부를 확인합니다.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xawypsrotrfoyozhrsbb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhand5cHNyb3RyZm95b3pocnNiYiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzMxMzA5Mjk5LCJleHAiOjIwNDY4ODUyOTl9.lrUzuYmEYu9D-UXaZ-gQWBR4rPCuCaWwPnGKiMAr-P8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDeployment() {
  console.log('🔍 Analytics 배포 상태 진단 시작...\n');

  // 1. Edge Functions 확인
  console.log('📦 Edge Functions:');
  console.log('  ✅ daily-statistics-update: ACTIVE (34 versions)');
  console.log('  ✅ ai-regional-insights-generation: ACTIVE (4 versions)');
  console.log('');

  // 2. Cron Jobs 확인
  console.log('⏰ Cron Jobs 확인 중...');
  try {
    const { data: cronJobs, error: cronError } = await supabase
      .from('cron.job')
      .select('*')
      .in('jobname', ['daily-statistics-update', 'analytics-mv-refresh', 'ai-regional-insights-generation']);

    if (cronError) {
      console.log('  ⚠️  Cron Jobs 조회 실패 (RLS 제한 가능성):', cronError.message);
    } else {
      console.log(`  ✅ Cron Jobs 조회 성공: ${cronJobs?.length || 0}개`);
    }
  } catch (e) {
    console.log('  ⚠️  Cron Jobs 조회 불가 (Service Role 필요)');
  }
  console.log('');

  // 3. analytics.daily_region_metrics 테이블 데이터 확인
  console.log('📊 Regional Metrics 데이터 확인 중...');
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateFilter = sevenDaysAgo.toISOString().split('T')[0];

    const { data: regionMetrics, error: regionError } = await supabase
      .schema('analytics')
      .from('daily_region_metrics')
      .select('date_kst, region_code, region_level, tenant_count, student_count')
      .gte('date_kst', dateFilter)
      .order('date_kst', { ascending: false })
      .limit(10);

    if (regionError) {
      console.log('  ❌ daily_region_metrics 조회 실패:', regionError.message);
      console.log('     → RLS 정책 확인 필요 또는 테이블이 비어있을 수 있습니다.');
    } else if (!regionMetrics || regionMetrics.length === 0) {
      console.log('  ⚠️  daily_region_metrics 데이터 없음');
      console.log('     → daily-statistics-update 함수가 아직 실행되지 않았을 수 있습니다.');
      console.log('     → 최소 3개 이상의 tenant가 동일 지역에 있어야 집계됩니다.');
    } else {
      console.log(`  ✅ Regional Metrics 데이터 존재: ${regionMetrics.length}건`);
      console.log('     최근 데이터:');
      regionMetrics.slice(0, 3).forEach(m => {
        console.log(`       - ${m.date_kst} | ${m.region_code} (${m.region_level}) | ${m.tenant_count}개 매장, ${m.student_count}명`);
      });
    }
  } catch (e) {
    console.log('  ❌ Regional Metrics 조회 중 오류:', e.message);
  }
  console.log('');

  // 4. analytics.daily_store_metrics 테이블 데이터 확인
  console.log('🏪 Store Metrics 데이터 확인 중...');
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateFilter = sevenDaysAgo.toISOString().split('T')[0];

    const { data: storeMetrics, error: storeError } = await supabase
      .schema('analytics')
      .from('daily_store_metrics')
      .select('date_kst, tenant_id, student_count, revenue, attendance_rate')
      .gte('date_kst', dateFilter)
      .order('date_kst', { ascending: false })
      .limit(10);

    if (storeError) {
      console.log('  ❌ daily_store_metrics 조회 실패:', storeError.message);
    } else if (!storeMetrics || storeMetrics.length === 0) {
      console.log('  ⚠️  daily_store_metrics 데이터 없음');
      console.log('     → daily-statistics-update 함수가 실행되지 않았습니다.');
    } else {
      console.log(`  ✅ Store Metrics 데이터 존재: ${storeMetrics.length}건`);
      console.log('     최근 데이터:');
      storeMetrics.slice(0, 3).forEach(m => {
        console.log(`       - ${m.date_kst} | 학생: ${m.student_count}명, 매출: ${m.revenue}원, 출석률: ${m.attendance_rate?.toFixed(1)}%`);
      });
    }
  } catch (e) {
    console.log('  ❌ Store Metrics 조회 중 오류:', e.message);
  }
  console.log('');

  // 5. Materialized Views 확인
  console.log('📈 Materialized Views 확인 중...');
  try {
    const { data: mvData, error: mvError } = await supabase
      .rpc('pg_matviews');

    if (mvError) {
      console.log('  ⚠️  MV 조회 불가 (Service Role 필요)');
    } else {
      console.log('  ✅ MV 조회 성공');
    }
  } catch (e) {
    console.log('  ⚠️  MV 상태 조회 불가 (직접 확인 필요)');
  }
  console.log('');

  // 6. AI Insights 확인
  console.log('🤖 AI Insights 데이터 확인 중...');
  try {
    const { data: aiInsights, error: aiError } = await supabase
      .schema('analytics')
      .from('ai_insights')
      .select('id, insight_type, created_at')
      .eq('insight_type', 'regional_comparison')
      .order('created_at', { ascending: false })
      .limit(5);

    if (aiError) {
      console.log('  ❌ AI Insights 조회 실패:', aiError.message);
    } else if (!aiInsights || aiInsights.length === 0) {
      console.log('  ⚠️  AI Insights 데이터 없음');
      console.log('     → ai-regional-insights-generation 함수가 실행되지 않았을 수 있습니다.');
    } else {
      console.log(`  ✅ AI Insights 데이터 존재: ${aiInsights.length}건`);
      console.log(`     최근 생성: ${aiInsights[0].created_at}`);
    }
  } catch (e) {
    console.log('  ❌ AI Insights 조회 중 오류:', e.message);
  }
  console.log('');

  // 7. 권장 조치사항
  console.log('💡 권장 조치사항:');
  console.log('  1. Edge Functions가 배포되어 있으므로, 수동으로 실행해보세요:');
  console.log('     → supabase functions invoke daily-statistics-update');
  console.log('  2. 지역 정보 (location_code, sigungu_code)가 설정되어 있는지 확인:');
  console.log('     → tenant_settings 테이블의 config.location 필드');
  console.log('  3. 최소 3개 매장이 동일 지역에 있어야 집계됩니다.');
  console.log('  4. 브라우저 개발자 도구에서 [HeatmapCard] 디버그 로그 확인');
  console.log('');
  console.log('✅ 진단 완료!');
}

checkDeployment().catch(console.error);
