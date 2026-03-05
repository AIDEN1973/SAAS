/**
 * E2E Test Data Seeding Utility
 *
 * 테스트 데이터 시딩을 위한 헬퍼 함수
 * [불변 규칙] 테스트 데이터는 고유 접두사를 사용하여 충돌 방지
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for E2E test seeding');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * 테스트용 학생 생성
 */
export async function seedStudent(tenantId: string, overrides?: Record<string, unknown>) {
  const supabase = getAdminClient();
  const uniqueId = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { data: person, error: personError } = await supabase
    .from('persons')
    .insert({
      tenant_id: tenantId,
      person_type: 'student',
      name: overrides?.name || `테스트학생-${uniqueId}`,
      phone: overrides?.phone || `010-${uniqueId.slice(-8)}`,
    })
    .select()
    .single();

  if (personError) throw new Error(`Failed to seed student: ${personError.message}`);

  const { error: studentError } = await supabase
    .from('academy_students')
    .insert({
      person_id: person.id,
      tenant_id: tenantId,
      status: 'active',
      ...overrides,
    });

  if (studentError) throw new Error(`Failed to seed academy_student: ${studentError.message}`);

  return person;
}

/**
 * 테스트용 수업 생성
 */
export async function seedClass(tenantId: string, overrides?: Record<string, unknown>) {
  const supabase = getAdminClient();
  const uniqueId = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { data, error } = await supabase
    .from('academy_classes')
    .insert({
      tenant_id: tenantId,
      name: overrides?.name || `테스트수업-${uniqueId}`,
      max_capacity: overrides?.max_capacity || 20,
      current_count: 0,
      status: 'active',
      ...overrides,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to seed class: ${error.message}`);
  return data;
}

/**
 * 테스트용 출결 로그 생성
 */
export async function seedAttendanceLog(
  tenantId: string,
  studentId: string,
  classId: string,
  overrides?: Record<string, unknown>
) {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('attendance_logs')
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      class_id: classId,
      status: overrides?.status || 'checked_in',
      checked_in_at: overrides?.checked_in_at || new Date().toISOString(),
      ...overrides,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to seed attendance log: ${error.message}`);
  return data;
}
