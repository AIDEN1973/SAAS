/**
 * E2E Test Cleanup Utility
 *
 * 테스트 후 생성된 데이터를 정리하는 헬퍼 함수
 * [불변 규칙] cleanup은 best-effort (실패해도 테스트 결과에 영향 없음)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  if (!supabaseServiceKey) {
    console.warn('[E2E Cleanup] SUPABASE_SERVICE_ROLE_KEY not set, skipping cleanup');
    return null;
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * 테스트 학생 삭제 (cascade: person + academy_student)
 */
export async function cleanupStudent(personId: string) {
  const supabase = getAdminClient();
  if (!supabase) return;

  try {
    await supabase.from('academy_students').delete().eq('person_id', personId);
    await supabase.from('persons').delete().eq('id', personId);
  } catch (error) {
    console.warn(`[E2E Cleanup] Failed to cleanup student ${personId}:`, error);
  }
}

/**
 * 테스트 수업 삭제
 */
export async function cleanupClass(classId: string) {
  const supabase = getAdminClient();
  if (!supabase) return;

  try {
    await supabase.from('academy_classes').delete().eq('id', classId);
  } catch (error) {
    console.warn(`[E2E Cleanup] Failed to cleanup class ${classId}:`, error);
  }
}

/**
 * 테스트 출결 로그 삭제
 */
export async function cleanupAttendanceLog(logId: string) {
  const supabase = getAdminClient();
  if (!supabase) return;

  try {
    await supabase.from('attendance_logs').delete().eq('id', logId);
  } catch (error) {
    console.warn(`[E2E Cleanup] Failed to cleanup attendance log ${logId}:`, error);
  }
}

/**
 * E2E 접두사로 생성된 모든 테스트 데이터 일괄 정리
 */
export async function cleanupAllTestData(tenantId: string) {
  const supabase = getAdminClient();
  if (!supabase) return;

  try {
    // e2e- 접두사로 생성된 테스트 데이터만 삭제 (실 데이터 보호)
    // attendance_logs: e2e- 접두사 학생의 로그만 삭제
    const { data: e2ePersons } = await supabase
      .from('persons')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('name', 'e2e-%');

    if (e2ePersons && e2ePersons.length > 0) {
      const personIds = e2ePersons.map((p: { id: string }) => p.id);

      await supabase
        .from('attendance_logs')
        .delete()
        .eq('tenant_id', tenantId)
        .in('student_id', personIds);

      await supabase
        .from('academy_students')
        .delete()
        .eq('tenant_id', tenantId)
        .in('person_id', personIds);
    }

    await supabase
      .from('persons')
      .delete()
      .eq('tenant_id', tenantId)
      .ilike('name', 'e2e-%');

    await supabase
      .from('academy_classes')
      .delete()
      .eq('tenant_id', tenantId)
      .ilike('name', 'e2e-%');
  } catch (error) {
    console.warn(`[E2E Cleanup] Failed to cleanup test data for tenant ${tenantId}:`, error);
  }
}
