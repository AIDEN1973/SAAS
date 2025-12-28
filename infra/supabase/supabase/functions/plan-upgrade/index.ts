/**
 * 플랜 업그레이드 처리
 *
 * [불변 규칙] 전체 기술문서 1029줄: 상용화 단계에서 플랜 업그레이드 구현
 * [불변 규칙] Zero-Management: 사용자 개입 없이 자동 실행
 * [불변 규칙] Role 분리: 상용화 단계에서 Role 분리 구현
 *
 * 기능:
 * - 테넌트 플랜 업그레이드 (basic -> premium -> enterprise)
 * - 플랜 변경 시 tenant_features 자동 업데이트
 * - 플랜 변경 이력 기록
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { envServer } from '../_shared/env-registry.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { toKST } from '../_shared/date-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 플랜 순서 정의
const PLAN_ORDER: Record<string, number> = {
  basic: 1,
  premium: 2,
  enterprise: 3,
};

// 플랜별 기능 설정
const PLAN_FEATURES: Record<string, { messaging: boolean; analytics: boolean; messagingQuota: number | null }> = {
  basic: {
    messaging: false,
    analytics: false,
    messagingQuota: 100,
  },
  premium: {
    messaging: true,
    analytics: true,
    messagingQuota: null,
  },
  enterprise: {
    messaging: true,
    analytics: true,
    messagingQuota: null,
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // [불변 규칙] Role 분리: 플랜 업그레이드는 일반 서비스이므로 SERVICE_ROLE_KEY 사용
    // 상용화 단계에서는 별도 Role 키 사용 가능 (현재는 SERVICE_ROLE_KEY 사용)
    const roleKey = envServer.PAYMENT_WEBHOOK_ROLE_KEY || envServer.SERVICE_ROLE_KEY;
    const supabase = createClient(envServer.SUPABASE_URL, roleKey);

    const { tenant_id, target_plan } = await req.json();

    if (!tenant_id || !target_plan) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id와 target_plan이 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['basic', 'premium', 'enterprise'].includes(target_plan)) {
      return new Response(
        JSON.stringify({ success: false, error: '유효하지 않은 플랜입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 현재 플랜 조회
    const { data: tenant, error: tenantError } = await withTenant(
      supabase
        .from('tenants')
        .select('id, plan, name')
        .eq('id', tenant_id)
        .single(),
      tenant_id
    );

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ success: false, error: '테넌트를 찾을 수 없습니다.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentPlan = tenant.plan;

    // 업그레이드만 허용 (다운그레이드는 별도 프로세스 필요)
    if (PLAN_ORDER[target_plan] <= PLAN_ORDER[currentPlan]) {
      return new Response(
        JSON.stringify({ success: false, error: '업그레이드만 가능합니다. 다운그레이드는 별도 절차가 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const features = PLAN_FEATURES[target_plan];

    // 트랜잭션: 플랜 업데이트 + 기능 설정 업데이트
    const { error: updateError } = await withTenant(
      supabase
        .from('tenants')
        .update({ plan: target_plan, updated_at: new Date().toISOString() })
        .eq('id', tenant_id),
      tenant_id
    );

    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, error: `플랜 업데이트 실패: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // tenant_features 업데이트
    const featureUpdates = [
      { feature_key: 'messaging', enabled: features.messaging, quota: features.messagingQuota },
      { feature_key: 'analytics', enabled: features.analytics, quota: null },
    ];

    for (const feature of featureUpdates) {
      // 기존 기능 조회
      // [불변 규칙] SELECT 쿼리는 withTenant() 사용하여 tenant_id 필터 강제
      // withTenant() 내부에서 이미 tenant_id 필터가 적용되므로 .eq('tenant_id') 중복 사용 금지
      const { data: existingFeature } = await withTenant(
        supabase
          .from('tenant_features')
          .select('id')
          .eq('feature_key', feature.feature_key)
          .single(),
        tenant_id
      );

      if (existingFeature) {
        // 업데이트
        await withTenant(
          supabase
            .from('tenant_features')
            .update({
              enabled: feature.enabled,
              quota: feature.quota,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingFeature.id),
          tenant_id
        );
      } else {
        // 생성
        await withTenant(
          supabase
            .from('tenant_features')
            .insert({
              tenant_id,
              feature_key: feature.feature_key,
              enabled: feature.enabled,
              quota: feature.quota,
            }),
          tenant_id
        );
      }
    }

    // 플랜 변경 이력 기록 (선택적, 별도 테이블이 있다면)
    // TODO: plan_changes 테이블이 있다면 여기에 기록

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          tenant_id,
          previous_plan: currentPlan,
          new_plan: target_plan,
          updated_at: new Date().toISOString(),
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('플랜 업그레이드 오류:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

