/**
 * Mock Data Factories
 *
 * 타입 안전 테스트 데이터 팩토리
 * 각 도메인 엔티티의 기본 mock 데이터를 생성
 */

let idCounter = 0;
function nextId(prefix = 'mock') {
  return `${prefix}-${++idCounter}`;
}

export function resetIdCounter() {
  idCounter = 0;
}

// ── Person / Student ──

export function createMockPerson(overrides: Record<string, unknown> = {}) {
  const id = nextId('person');
  return {
    id,
    tenant_id: 'test-tenant-id',
    name: `테스트사용자_${id}`,
    person_type: 'student' as const,
    phone: '010-0000-0000',
    email: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function createMockStudent(overrides: Record<string, unknown> = {}) {
  const person = createMockPerson(overrides);
  return {
    ...person,
    status: 'active' as const,
    birth_date: null,
    gender: null,
    school_name: null,
    grade: null,
    notes: null,
    profile_image_url: null,
    primary_guardian_name: undefined,
    primary_class_name: undefined,
    ...overrides,
  };
}

// ── Class ──

export function createMockClass(overrides: Record<string, unknown> = {}) {
  const id = nextId('class');
  return {
    id,
    tenant_id: 'test-tenant-id',
    name: `테스트반_${id}`,
    description: null,
    teacher_id: null,
    schedule: null,
    capacity: 20,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Attendance ──

export function createMockAttendanceLog(overrides: Record<string, unknown> = {}) {
  const id = nextId('att');
  return {
    id,
    tenant_id: 'test-tenant-id',
    student_id: 'student-1',
    class_id: 'class-1',
    date: '2026-03-05',
    status: 'present' as const,
    check_in_time: '09:00:00',
    check_out_time: null,
    notes: null,
    created_at: '2026-03-05T00:00:00Z',
    ...overrides,
  };
}

// ── Tag ──

export function createMockTag(overrides: Record<string, unknown> = {}) {
  const id = nextId('tag');
  return {
    id,
    tenant_id: 'test-tenant-id',
    name: `태그_${id}`,
    color: '#3B82F6',
    entity_type: 'student',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Guardian ──

export function createMockGuardian(overrides: Record<string, unknown> = {}) {
  const id = nextId('guardian');
  return {
    id,
    tenant_id: 'test-tenant-id',
    student_id: 'student-1',
    name: `보호자_${id}`,
    phone: '010-1111-1111',
    relationship: 'parent',
    is_primary: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── API Response Helpers ──

export function createSuccessResponse<T>(data: T, count?: number) {
  return { data, error: null, count };
}

export function createErrorResponse(message: string) {
  return { data: null, error: { message } };
}
