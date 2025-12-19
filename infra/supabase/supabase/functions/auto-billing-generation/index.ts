/**
 * 자동 청구 생성 배치 작업
 *
 * 아키텍처 문서 3.4.6 섹션 참조
 * 스케줄: 매일 04:00 KST (Supabase cron 설정 필요)
 *
 * [불변 규칙] Zero-Management: 사용자 개입 없이 자동 실행
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    // 환경변수 검증
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL 환경변수가 설정되지 않았습니다.');
    }
    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.');
    }

    // Supabase 클라이언트 생성 (Service Role 사용)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 기술문서 19-1-2: KST 기준 날짜 처리
    // Edge Functions는 Deno 환경이므로 수동으로 KST 변환 수행
    const now = new Date();
    const kstOffset = 9 * 60; // KST는 UTC+9
    const kstTime = new Date(now.getTime() + (kstOffset * 60 * 1000));
    const currentMonth = kstTime.toISOString().slice(0, 7); // YYYY-MM
    const periodStart = `${currentMonth}-01`;
    const periodEnd = new Date(kstTime.getFullYear(), kstTime.getMonth() + 1, 0)
      .toISOString().slice(0, 10); // 월말 날짜

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
        // 해당 테넌트의 활성 학생 조회 (persons 테이블에서 student 타입)
        const { data: students, error: studentsError } = await supabase
          .from('persons')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('person_type', 'student')
          .eq('status', 'active');

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
        const { data: existingInvoices, error: invoicesError } = await supabase
          .from('invoices')
          .select('payer_id')
          .eq('tenant_id', tenant.id)
          .gte('period_start', periodStart)
          .lte('period_start', periodEnd);

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

        // 청구서 생성 (billing_plans 정보는 향후 추가)
        const invoices = studentsToBill.map((student: { id: string }) => ({
          tenant_id: tenant.id,
          payer_id: student.id,
          amount: 0, // TODO: billing_plans에서 실제 금액 가져오기
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





