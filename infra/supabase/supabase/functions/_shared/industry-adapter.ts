// LAYER: EDGE_FUNCTION_SHARED
/**
 * Industry Adapter
 *
 * [SSOT 준수] Automation & AI Industry-Neutral Rule (SSOT) 준수
 * [불변 규칙] 업종별 차이는 로직이 아니라 Adapter + Schema 레이어에서만 허용
 * [불변 규칙] 업종별 신규 자동화 엔진 또는 AI 엔진을 생성하는 행위는 금지
 *
 * 목적: 업종별 테이블명을 동적으로 매핑하여 새로운 업종 추가 시 코드 수정 없이 동작
 *
 * 참고 문서:
 * - SSOT: docu/AI_자동화_기능_정리.md (Automation & AI Industry-Neutral Rule)
 * - SSOT: docu/전체 기술문서.txt (업종별 스키마 분리 전략)
 */

/**
 * 업종 타입 (SSOT: tenants 테이블의 industry_type CHECK 제약조건과 일치)
 */
export type IndustryType = 'academy' | 'salon' | 'real_estate' | 'gym' | 'ngo';

/**
 * 엔티티 타입 (Core Party + 업종별 확장)
 */
export type EntityType =
  | 'student' // Core Party: persons, 업종별 확장: academy_students, salon_customers 등
  | 'class' // 업종별: academy_classes, salon_services 등
  | 'teacher' // Core Party: persons (person_type='teacher'), 업종별 확장 가능
  | 'guardian'; // Core Party: persons (person_type='guardian')

/**
 * 테이블명 매핑 레지스트리
 *
 * [불변 규칙] 업종별 테이블 prefix 규칙:
 * - Core Party 테이블: persons (공통, prefix 없음)
 * - 업종별 확장 테이블: {industry_type}_{entity_type} 형식
 *   - 예: academy_students, salon_customers, real_estate_clients
 *
 * [불변 규칙] 테이블명은 snake_case 사용
 */
const TABLE_NAME_REGISTRY: Record<IndustryType, Record<EntityType, string>> = {
  academy: {
    student: 'academy_students',
    class: 'academy_classes',
    teacher: 'persons', // Core Party 테이블 사용
    guardian: 'persons', // Core Party 테이블 사용
  },
  salon: {
    student: 'salon_customers', // 예상 테이블명 (아직 미구현 시 academy_students fallback)
    class: 'salon_services', // 예상 테이블명 (아직 미구현 시 academy_classes fallback)
    teacher: 'persons',
    guardian: 'persons',
  },
  real_estate: {
    student: 'real_estate_clients', // 예상 테이블명
    class: 'real_estate_properties', // 예상 테이블명
    teacher: 'persons',
    guardian: 'persons',
  },
  gym: {
    student: 'gym_members', // 예상 테이블명
    class: 'gym_classes', // 예상 테이블명
    teacher: 'persons',
    guardian: 'persons',
  },
  ngo: {
    student: 'ngo_beneficiaries', // 예상 테이블명
    class: 'ngo_programs', // 예상 테이블명
    teacher: 'persons',
    guardian: 'persons',
  },
};

/**
 * Industry Adapter: 업종별 테이블명 조회
 *
 * [불변 규칙] Fail-Closed: industry_type이 유효하지 않으면 null 반환
 * [불변 규칙] Core Party 테이블(persons)은 업종과 무관하게 항상 'persons' 반환
 *
 * @param industryType 업종 타입
 * @param entityType 엔티티 타입
 * @returns 테이블명 또는 null (유효하지 않은 경우)
 *
 * @example
 * ```typescript
 * const tableName = getIndustryTableName('academy', 'student');
 * // 반환: 'academy_students'
 *
 * const tableName = getIndustryTableName('salon', 'student');
 * // 반환: 'salon_customers' (또는 fallback: 'academy_students')
 * ```
 */
export function getIndustryTableName(
  industryType: string | null | undefined,
  entityType: EntityType
): string | null {
  // Fail-Closed: industry_type이 없으면 null 반환
  if (!industryType) {
    return null;
  }

  // industry_type 검증 (SSOT: tenants 테이블의 CHECK 제약조건과 일치)
  const validIndustryTypes: IndustryType[] = ['academy', 'salon', 'real_estate', 'gym', 'ngo'];
  if (!validIndustryTypes.includes(industryType as IndustryType)) {
    console.warn(
      `[Industry Adapter] Invalid industry_type: ${industryType}. Valid values: ${validIndustryTypes.join(', ')}`
    );
    return null;
  }

  // Core Party 테이블은 업종과 무관하게 항상 'persons' 반환
  if (entityType === 'teacher' || entityType === 'guardian') {
    return 'persons';
  }

  // 업종별 테이블명 조회
  const tableName = TABLE_NAME_REGISTRY[industryType as IndustryType]?.[entityType];

  if (!tableName) {
    console.warn(
      `[Industry Adapter] Table name not found for industry_type=${industryType}, entity_type=${entityType}`
    );
    return null;
  }

  return tableName;
}

/**
 * Industry Adapter: 테넌트의 industry_type 조회
 *
 * [불변 규칙] Zero-Trust: tenant_id는 JWT에서 추출 (요청 본문에서 받지 않음)
 * [불변 규칙] Fail-Closed: 조회 실패 시 null 반환
 *
 * @param supabase Supabase 클라이언트
 * @param tenantId 테넌트 ID
 * @returns industry_type 또는 null
 */
export async function getTenantIndustryType(
  supabase: any, // SupabaseClient 타입 (Deno 환경 제약)
  tenantId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('industry_type')
      .eq('id', tenantId)
      .single();

    if (error || !data) {
      console.warn(`[Industry Adapter] Failed to fetch industry_type for tenant ${tenantId}`);
      return null;
    }

    return data.industry_type || null;
  } catch (error) {
    console.error(`[Industry Adapter] Error fetching industry_type:`, error);
    return null;
  }
}

/**
 * Industry Adapter: 업종별 테이블명 조회 (테넌트 기반)
 *
 * [불변 규칙] 테넌트의 industry_type을 조회한 후 테이블명 매핑
 * [불변 규칙] Fail-Closed: 조회 실패 시 null 반환
 *
 * @param supabase Supabase 클라이언트
 * @param tenantId 테넌트 ID
 * @param entityType 엔티티 타입
 * @returns 테이블명 또는 null
 *
 * @example
 * ```typescript
 * const tableName = await getTenantTableName(supabase, tenantId, 'student');
 * // 반환: 'academy_students' (tenant의 industry_type이 'academy'인 경우)
 * ```
 */
export async function getTenantTableName(
  supabase: any,
  tenantId: string,
  entityType: EntityType
): Promise<string | null> {
  const industryType = await getTenantIndustryType(supabase, tenantId);
  if (!industryType) {
    return null;
  }

  return getIndustryTableName(industryType, entityType);
}

/**
 * Industry Adapter: FK 관계명 생성
 *
 * [불변 규칙] Supabase PostgREST FK 관계명 규칙:
 * - 형식: {table_name}!{fk_constraint_name}
 * - 예: academy_students!academy_students_person_id_fkey
 *
 * @param tableName 테이블명
 * @param fkConstraintName FK 제약조건명
 * @returns FK 관계명
 *
 * @example
 * ```typescript
 * const fkName = buildFKRelationName('academy_students', 'academy_students_person_id_fkey');
 * // 반환: 'academy_students!academy_students_person_id_fkey'
 * ```
 */
export function buildFKRelationName(tableName: string, fkConstraintName: string): string {
  return `${tableName}!${fkConstraintName}`;
}

/**
 * Industry Adapter: 업종별 FK 관계명 조회
 *
 * [불변 규칙] 업종별 FK 제약조건명 규칙:
 * - 형식: {table_name}_{column_name}_fkey
 * - 예: academy_students_person_id_fkey, academy_classes_teacher_id_fkey
 *
 * @param industryType 업종 타입
 * @param entityType 엔티티 타입
 * @param fkColumn FK 컬럼명
 * @returns FK 관계명 또는 null
 *
 * @example
 * ```typescript
 * const fkName = getIndustryFKRelationName('academy', 'student', 'person_id');
 * // 반환: 'academy_students!academy_students_person_id_fkey'
 * ```
 */
export function getIndustryFKRelationName(
  industryType: string | null | undefined,
  entityType: EntityType,
  fkColumn: string
): string | null {
  const tableName = getIndustryTableName(industryType, entityType);
  if (!tableName) {
    return null;
  }

  const fkConstraintName = `${tableName}_${fkColumn}_fkey`;
  return buildFKRelationName(tableName, fkConstraintName);
}

/**
 * Industry Adapter: 업종별 FK 관계명 레지스트리
 *
 * [불변 규칙] FK 관계명은 DB 스키마의 실제 FK 제약조건명과 일치해야 함
 * [불변 규칙] 업종별 FK 관계명 매핑 (attendance_logs, student_classes 등에서 사용)
 */
const FK_RELATION_REGISTRY: Record<string, Record<IndustryType, string>> = {
  // attendance_logs_class_id_fkey
  'attendance_logs_class_id': {
    academy: 'academy_classes!attendance_logs_class_id_fkey',
    salon: 'salon_services!attendance_logs_class_id_fkey', // 예상
    real_estate: 'real_estate_properties!attendance_logs_class_id_fkey', // 예상
    gym: 'gym_classes!attendance_logs_class_id_fkey', // 예상
    ngo: 'ngo_programs!attendance_logs_class_id_fkey', // 예상
  },
  // student_classes_class_id_fkey
  'student_classes_class_id': {
    academy: 'academy_classes!student_classes_class_id_fkey',
    salon: 'salon_services!student_classes_class_id_fkey', // 예상
    real_estate: 'real_estate_properties!student_classes_class_id_fkey', // 예상
    gym: 'gym_classes!student_classes_class_id_fkey', // 예상
    ngo: 'ngo_programs!student_classes_class_id_fkey', // 예상
  },
  // student_classes_student_id_fkey
  'student_classes_student_id': {
    academy: 'academy_students!student_classes_student_id_fkey',
    salon: 'salon_customers!student_classes_student_id_fkey', // 예상
    real_estate: 'real_estate_clients!student_classes_student_id_fkey', // 예상
    gym: 'gym_members!student_classes_student_id_fkey', // 예상
    ngo: 'ngo_beneficiaries!student_classes_student_id_fkey', // 예상
  },
  // class_sessions_class_id_fkey
  'class_sessions_class_id': {
    academy: 'academy_classes!class_sessions_class_id_fkey',
    salon: 'salon_services!class_sessions_class_id_fkey', // 예상
    real_estate: 'real_estate_properties!class_sessions_class_id_fkey', // 예상
    gym: 'gym_classes!class_sessions_class_id_fkey', // 예상
    ngo: 'ngo_programs!class_sessions_class_id_fkey', // 예상
  },
  // invoices_student_id_fkey
  'invoices_student_id': {
    academy: 'academy_students!invoices_student_id_fkey',
    salon: 'salon_customers!invoices_student_id_fkey', // 예상
    real_estate: 'real_estate_clients!invoices_student_id_fkey', // 예상
    gym: 'gym_members!invoices_student_id_fkey', // 예상
    ngo: 'ngo_beneficiaries!invoices_student_id_fkey', // 예상
  },
  // student_person_id_fkey (업종별 학생 테이블 -> persons)
  // ⚠️ 중요: PostgREST FK 관계명은 대상 테이블!FK명 형식
  // academy_students.person_id → persons.id 관계는 persons!academy_students_person_id_fkey
  'student_person_id': {
    academy: 'persons!academy_students_person_id_fkey',
    salon: 'persons!salon_customers_person_id_fkey', // 예상
    real_estate: 'persons!real_estate_clients_person_id_fkey', // 예상
    gym: 'persons!gym_members_person_id_fkey', // 예상
    ngo: 'persons!ngo_beneficiaries_person_id_fkey', // 예상
  },
  // class_teacher_id_fkey (업종별 클래스 테이블 -> persons)
  'class_teacher_id': {
    academy: 'academy_classes!academy_classes_teacher_id_fkey',
    salon: 'salon_services!salon_services_teacher_id_fkey', // 예상
    real_estate: 'real_estate_properties!real_estate_properties_teacher_id_fkey', // 예상
    gym: 'gym_classes!gym_classes_teacher_id_fkey', // 예상
    ngo: 'ngo_programs!ngo_programs_teacher_id_fkey', // 예상
  },
};

/**
 * Industry Adapter: FK 관계명 조회 (레지스트리 기반)
 *
 * @param fkKey FK 키 (예: 'attendance_logs_class_id', 'student_classes_class_id')
 * @param industryType 업종 타입
 * @returns FK 관계명 또는 null
 */
export function getFKRelationName(fkKey: string, industryType: string | null | undefined): string | null {
  if (!industryType) {
    return null;
  }

  const validIndustryTypes: IndustryType[] = ['academy', 'salon', 'real_estate', 'gym', 'ngo'];
  if (!validIndustryTypes.includes(industryType as IndustryType)) {
    return null;
  }

  const fkMap = FK_RELATION_REGISTRY[fkKey];
  if (!fkMap) {
    return null;
  }

  return fkMap[industryType as IndustryType] || null;
}

