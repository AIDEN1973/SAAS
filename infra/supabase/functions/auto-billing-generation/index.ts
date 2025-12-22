/**
 * 청구 생성 배치 작업 (서버가 생성)
 *
 * 아키텍처 문서 3.4.6 섹션 참조
 * 스케줄: 매일 04:00 KST (Supabase cron 설정 필요)
 *
 * [불변 규칙] Zero-Management: 사용자 개입 없이 자동 실행
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // [불변 규칙] Edge Functions도 env-registry를 통해 환경변수 접근
    // [불변 규칙] Role 분리: 상용화 단계에서 Role 분리 구현
    // auto-billing-generation은 BILLING_BATCH_ROLE_KEY 사용, 없으면 SERVICE_ROLE_KEY fallback
    const roleKey = envServer.BILLING_BATCH_ROLE_KEY || envServer.SERVICE_ROLE_KEY;
    const supabase = createClient(envServer.SUPABASE_URL, roleKey);

    // 기술문서 19-1-2: KST 기준 날짜 처리
    // [불변 규칙] 파일명 생성 시 날짜 형식은 반드시 KST 기준을 사용합니다.
    const kstTime = toKST();
    const currentMonth = toKSTMonth(); // YYYY-MM
    const periodStart = `${currentMonth}-01`;
    const periodEnd = toKSTDate(new Date(kstTime.getFullYear(), kstTime.getMonth() + 1, 0)); // 월말 날짜

    console.log(`[Auto Billing] Starting batch for period: ${periodStart} to ${periodEnd}`);

    // 모든 활성 테넌트 조회
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, industry_type')
      .eq('status', 'active');

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    if (!tenants || tenants.length === 0) {
      console.log('[Auto Billing] No active tenants found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active tenants', generated_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalGenerated = 0;
    const errors: string[] = [];

    // 각 테넌트별로 청구서 생성
    for (const tenant of tenants) {
      try {
        // ⚠️ 중요: 청구 생성 Policy 확인 (서버가 생성, Fail Closed)
        // SSOT 경로 우선: billing.auto_generation.enabled (저장 위치는 tenant_settings(key='config').value(JSONB))
        // 레거시 fallback: 신규 경로가 없고 기존 값이 있을 때만 제한적 fallback (읽기만 허용, 쓰기 금지)
        const autoBillingPolicy = await getTenantSettingByPath(
          supabase,
          tenant.id,
          'billing.auto_generation.enabled',
          'auto_billing.enabled' // 레거시 fallback
        );
        if (!autoBillingPolicy || autoBillingPolicy !== true) {
          // Policy가 없거나 비활성화되어 있으면 실행하지 않음 (Fail Closed)
          console.log(`[Auto Billing] Auto billing disabled for tenant ${tenant.id}, skipping`);
          continue;
        }

        // ⚠️ 중요: 자동 실행 자기 억제 메커니즘 체크 (프론트 자동화 문서 2.5.2 섹션 참조)
        const actionType = 'generate_billing';
        const todayStart = new Date(kstTime);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(kstTime);
        todayEnd.setHours(23, 59, 59, 999);

        const { data: safetyState, error: safetyError } = await withTenant(
          supabase
          .from('automation_safety_state')
          .select('*')
          .eq('action_type', actionType)
          .gte('window_start', todayStart.toISOString())
            .lte('window_end', todayEnd.toISOString()),
          tenant.id
        ).single();

        if (safetyError && safetyError.code !== 'PGRST116') {
          console.error(`[Auto Billing] Failed to check automation safety for tenant ${tenant.id}:`, safetyError);
        }

        // 안전성 체크
        if (safetyState) {
          if (safetyState.state === 'paused') {
            console.warn(`[Auto Billing] Skipping billing generation for tenant ${tenant.id} due to paused state.`);
            continue;
          }

          if (safetyState.executed_count >= safetyState.max_allowed) {
            await supabase
              .from('automation_safety_state')
              .update({ state: 'paused' })
              .eq('id', safetyState.id);
            console.warn(`[Auto Billing] Skipping billing generation for tenant ${tenant.id} due to safety limits.`);
            continue;
          }

          // 실행 카운트 증가
          await supabase
            .from('automation_safety_state')
            .update({
              executed_count: safetyState.executed_count + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', safetyState.id);
        } else {
          // 초기 상태 생성
          // ⚠️ 중요: max_allowed는 Policy에서 조회 (Fail Closed)
          // SSOT 경로 우선: billing.auto_generation.throttle.daily_limit (저장 위치는 tenant_settings(key='config').value(JSONB))
          // 레거시 fallback: 신규 경로가 없고 기존 값이 있을 때만 제한적 fallback (읽기만 허용, 쓰기 금지)
          const dailyLimitPolicy = await getTenantSettingByPath(
            supabase,
            tenant.id,
            'billing.auto_generation.throttle.daily_limit',
            'auto_billing.daily_limit' // 레거시 fallback
          );
          if (!dailyLimitPolicy || typeof dailyLimitPolicy !== 'number') {
            // Policy가 없으면 실행하지 않음 (Fail Closed)
            console.log(`[Auto Billing] Daily limit policy not found for tenant ${tenant.id}, skipping`);
            continue;
          }
          const maxAllowed = dailyLimitPolicy; // Policy에서 조회한 값만 사용

          await supabase.from('automation_safety_state').insert({
            tenant_id: tenant.id,
            action_type: actionType,
            window_start: todayStart.toISOString(),
            window_end: todayEnd.toISOString(),
            max_allowed: maxAllowed,
            state: 'normal',
          });
        }

        // 해당 테넌트의 활성 학생 조회 (persons 테이블에서 student 타입)
        const { data: students, error: studentsError } = await withTenant(
          supabase
          .from('persons')
          .select('id')
          .eq('person_type', 'student')
            .eq('status', 'active'),
          tenant.id
        );

        if (studentsError) {
          console.error(`[Auto Billing] Failed to fetch students for tenant ${tenant.id}:`, studentsError);
          errors.push(`Tenant ${tenant.id}: ${studentsError.message}`);
          continue;
        }

        if (!students || students.length === 0) {
          console.log(`[Auto Billing] No active students for tenant ${tenant.id}`);
          continue;
        }

        // 이미 생성된 청구서 확인
        const { data: existingInvoices, error: invoicesError } = await withTenant(
          supabase
          .from('invoices')
          .select('payer_id')
          .gte('period_start', periodStart)
            .lte('period_start', periodEnd),
          tenant.id
        );

        if (invoicesError) {
          console.error(`[Auto Billing] Failed to check existing invoices for tenant ${tenant.id}:`, invoicesError);
          errors.push(`Tenant ${tenant.id}: ${invoicesError.message}`);
          continue;
        }

        const existingPayerIds = new Set((existingInvoices || []).map((inv: { payer_id?: string }) => inv.payer_id));

        // 청구서가 없는 학생들에 대해 청구서 생성
        const studentsToBill = students.filter((student: { id: string }) => !existingPayerIds.has(student.id));

        if (studentsToBill.length === 0) {
          console.log(`[Auto Billing] All students already have invoices for tenant ${tenant.id}`);
          continue;
        }

        // 청구서 생성
        // ⚠️ 참고: billing_plans 테이블이 구현되면 실제 금액을 조회하여 설정해야 함
        // 현재는 amount=0으로 생성하며, 이후 수동으로 금액을 설정하거나 billing_plans 연동 필요
        const invoices = studentsToBill.map((student: { id: string }) => ({
          tenant_id: tenant.id,
          payer_id: student.id,
          amount: 0, // ⚠️ 향후 billing_plans에서 실제 금액 조회 필요
          period_start: periodStart,
          period_end: periodEnd,
          due_date: periodEnd, // 기한은 월말
          status: 'draft',
          industry_type: tenant.industry_type,
        }));

        const { error: insertError } = await supabase
          .from('invoices')
          .insert(invoices);

        if (insertError) {
          console.error(`[Auto Billing] Failed to create invoices for tenant ${tenant.id}:`, insertError);
          errors.push(`Tenant ${tenant.id}: ${insertError.message}`);
          continue;
        }

        totalGenerated += invoices.length;
        console.log(`[Auto Billing] Generated ${invoices.length} invoices for tenant ${tenant.id}`);

      } catch (error) {
        console.error(`[Auto Billing] Error processing tenant ${tenant.id}:`, error);
        errors.push(`Tenant ${tenant.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated_count: totalGenerated,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Auto Billing] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});





