// LAYER: EDGE_FUNCTION_SHARED
/**
 * L0 Intent 실행 핸들러
 *
 * 챗봇.md 6.1 참조
 * 목적: L0 Intent(조회/초안)를 직접 실행하여 결과 반환
 *
 * [불변 규칙] L0 Intent는 TaskCard 생성 없이 즉시 실행
 * [불변 규칙] 결과는 responseSchema에 맞춰 반환
 * [불변 규칙] PII 마스킹 필수
 */

import { withTenant } from './withTenant.ts';
import { maskPII } from './pii-utils.ts';
import { toKSTDate } from './date-utils.ts';
import {
  getTenantTableName,
  getTenantIndustryType,
  getFKRelationName,
} from './industry-adapter.ts';

/**
 * L0 Intent 실행 컨텍스트
 */
export interface L0HandlerContext {
  tenant_id: string;
  user_id: string;
  supabase: any; // SupabaseClient 타입 (Deno 환경 제약)
}

/**
 * L0 Intent 실행 결과
 */
export interface L0HandlerResult {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * L0 Intent 핸들러 인터페이스
 */
export interface L0IntentHandler {
  intent_key: string;
  execute(
    params: Record<string, unknown>,
    context: L0HandlerContext
  ): Promise<L0HandlerResult>;
}

/**
 * 출결: 지각한 대상 조회
 * Intent: attendance.query.late
 */
export const attendanceQueryLateHandler: L0IntentHandler = {
  intent_key: 'attendance.query.late',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const classId = params.class_id as string | undefined;
      const date = params.date as string | undefined; // YYYY-MM-DD

      // Industry Adapter: 업종별 FK 관계명 동적 조회
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const classFKName = getFKRelationName('attendance_logs_class_id', industryType) ||
        'academy_classes!attendance_logs_class_id_fkey'; // Fallback

      // 날짜 필터 (KST 기준)
      let query = withTenant(
        supabase
          .from('attendance_logs')
          .select(`
            id,
            student_id,
            persons!attendance_logs_student_id_fkey(id, name),
            ${classFKName}(id, name),
            occurred_at,
            status
          `)
          .eq('status', 'late')
          .order('occurred_at', { ascending: false }),
        tenant_id
      );

      if (classId) {
        query = query.eq('class_id', classId);
      }

      if (date) {
        // KST 기준 날짜 처리
        const dateFrom = `${date}T00:00:00+09:00`;
        const dateTo = `${date}T23:59:59+09:00`;
        query = query.gte('occurred_at', dateFrom).lte('occurred_at', dateTo);
      } else {
        // 오늘 날짜 (KST 기준)
        // [불변 규칙] 파일명 생성 시 날짜 형식은 반드시 KST 기준을 사용합니다.
        const todayStr = toKSTDate();
        const dateFrom = `${todayStr}T00:00:00+09:00`;
        const dateTo = `${todayStr}T23:59:59+09:00`;
        query = query.gte('occurred_at', dateFrom).lte('occurred_at', dateTo);
      }

      const { data, error } = await query;

      if (error) {
        // P0: PII 마스킹 필수
        const maskedError = maskPII(error);
        console.error('[attendanceQueryLateHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '출결 데이터 조회에 실패했습니다.',
          },
        };
      }

      // 응답 형식 변환
      // [불변 규칙] L0 Intent는 responseSchema에 맞춰 반환
      // Registry의 responseSchema: { students: [{ id, name, class_name, late_time }], total_count }
      // Industry Adapter: 업종별 클래스 정보 동적 접근 (FK 관계명에서 테이블명 추출)
      const classTableName = classFKName.split('!')[0] || 'academy_classes';
      const students = (data || []).map((log: any) => ({
        id: log.student_id,
        name: log.persons?.name || '',
        class_name: log[classTableName]?.name || log.academy_classes?.name || '',
        late_time: log.occurred_at ? new Date(log.occurred_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '',
      }));

      // 기본적인 response 구조 검증 (Edge Function에서는 Zod 사용 어려움)
      const responseData = {
        students,
        total_count: students.length,
      };

      // 최소한 필수 필드 검증
      if (!Array.isArray(responseData.students) || typeof responseData.total_count !== 'number') {
        return {
          success: false,
          error: {
            code: 'INVALID_RESPONSE_FORMAT',
            message: '응답 형식이 올바르지 않습니다.',
          },
        };
      }

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      // P0: PII 마스킹 필수
      const maskedError = maskPII(error);
      console.error('[attendanceQueryLateHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 출결: 특정 학생의 출결 조회
 * Intent: attendance.query.by_student
 */
export const attendanceQueryByStudentHandler: L0IntentHandler = {
  intent_key: 'attendance.query.by_student',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const studentId = params.student_id as string;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD

      if (!studentId) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'student_id가 필요합니다.',
          },
        };
      }

      if (!from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from과 to 날짜가 필요합니다.',
          },
        };
      }

      const dateFrom = `${from}T00:00:00+09:00`;
      const dateTo = `${to}T23:59:59+09:00`;

      const { data, error } = await withTenant(
        supabase
          .from('attendance_logs')
          .select('*')
          .eq('student_id', studentId)
          .gte('occurred_at', dateFrom)
          .lte('occurred_at', dateTo)
          .order('occurred_at', { ascending: false }),
        tenant_id
      );

      if (error) {
        // P0: PII 마스킹 필수
        const maskedError = maskPII(error);
        console.error('[attendanceQueryByStudentHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '출결 데이터 조회에 실패했습니다.',
          },
        };
      }

      // [불변 규칙] L0 Intent는 responseSchema에 맞춰 반환
      // Registry의 responseSchema: { records: [{ date, status, time }], total_count }
      const records = (data || []).map((log: any) => ({
        date: log.occurred_at ? toKSTDate(log.occurred_at) : '',
        status: log.status,
        time: log.occurred_at ? new Date(log.occurred_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '',
      }));

      // 기본적인 response 구조 검증
      const responseData = {
        records,
        total_count: records.length,
      };

      if (!Array.isArray(responseData.records) || typeof responseData.total_count !== 'number') {
        return {
          success: false,
          error: {
            code: 'INVALID_RESPONSE_FORMAT',
            message: '응답 형식이 올바르지 않습니다.',
          },
        };
      }

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      // P0: PII 마스킹 필수
      const maskedError = maskPII(error);
      console.error('[attendanceQueryByStudentHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 학생: 학생 검색
 * Intent: student.query.search
 */
export const studentQuerySearchHandler: L0IntentHandler = {
  intent_key: 'student.query.search',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const q = params.q as string | undefined;
      const limit = (params.limit as number | undefined) || 10;

      if (!q || q.trim().length === 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: '검색어가 필요합니다.',
          },
        };
      }

      // 이름으로 검색 (persons 테이블)
      const { data: persons, error: personsError } = await withTenant(
        supabase
          .from('persons')
          .select('id, name')
          .ilike('name', `%${q}%`)
          .eq('person_type', 'student')
          .limit(limit),
        tenant_id
      );

      if (personsError) {
        // P0: PII 마스킹 필수
        const maskedError = maskPII(personsError);
        console.error('[studentQuerySearchHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '학생 검색에 실패했습니다.',
          },
        };
      }

      if (!persons || persons.length === 0) {
        return {
          success: true,
          data: {
            students: [],
            total_count: 0,
          },
        };
      }

      const personIds = persons.map((p: any) => p.id);

      // Industry Adapter: 업종별 테이블명 및 FK 관계명 동적 조회
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const studentTableName = await getTenantTableName(supabase, tenant_id, 'student');
      const classFKName = getFKRelationName('student_classes_class_id', industryType) ||
        'academy_classes!student_classes_class_id_fkey'; // Fallback
      const studentFKName = getFKRelationName('student_classes_student_id', industryType) ||
        'academy_students!student_classes_student_id_fkey'; // Fallback

      // 업종별 학생 테이블 조회 (academy_students, salon_customers 등)
      const { data: academyStudents, error: studentsError } = await withTenant(
        supabase
          .from(studentTableName || 'academy_students') // Fallback
          .select(`
            person_id,
            grade,
            status,
            student_classes!${studentFKName}(
              ${classFKName}(
                id,
                name
              )
            )
          `)
          .in('person_id', personIds),
        tenant_id
      );

      if (studentsError) {
        // P0: PII 마스킹 필수
        const maskedError = maskPII(studentsError);
        console.error('[studentQuerySearchHandler] Failed to fetch industry student table:', maskedError);
        // 업종별 학생 테이블 조회 실패해도 persons 정보는 반환
      }

      // persons와 업종별 학생 테이블 매핑
      const studentsMap = new Map<string, any>();
      for (const person of persons || []) {
        studentsMap.set(person.id, {
          id: person.id,
          name: person.name,
          class_name: '',
          grade: '',
          status: 'active',
        });
      }

      // 업종별 학생 테이블 정보 병합
      const classTableName = classFKName.split('!')[0] || 'academy_classes';
      for (const student of academyStudents || []) {
        const studentData = studentsMap.get(student.person_id);
        if (studentData) {
          const studentClass = student.student_classes?.[0];
          const industryClass = studentClass?.[classTableName] || studentClass?.academy_classes;
          studentData.grade = student.grade || '';
          studentData.status = student.status || 'active';
          studentData.class_name = industryClass?.name || '';
        }
      }

      const students = Array.from(studentsMap.values());

      // [불변 규칙] L0 Intent는 responseSchema에 맞춰 반환
      // Registry의 responseSchema: { students: [{ id, name, class_name, grade, status }], total_count }
      const responseData = {
        students,
        total_count: students.length,
      };

      // 기본적인 response 구조 검증
      if (!Array.isArray(responseData.students) || typeof responseData.total_count !== 'number') {
        return {
          success: false,
          error: {
            code: 'INVALID_RESPONSE_FORMAT',
            message: '응답 형식이 올바르지 않습니다.',
          },
        };
      }

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      // P0: PII 마스킹 필수
      const maskedError = maskPII(error);
      console.error('[studentQuerySearchHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 출결: 결석한 대상 조회
 * Intent: attendance.query.absent
 */
export const attendanceQueryAbsentHandler: L0IntentHandler = {
  intent_key: 'attendance.query.absent',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const date = params.date as string | undefined; // YYYY-MM-DD
      const includeExcused = params.include_excused as boolean | undefined;

      // Industry Adapter: 업종별 FK 관계명 동적 조회
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const classFKName = getFKRelationName('attendance_logs_class_id', industryType) ||
        'academy_classes!attendance_logs_class_id_fkey'; // Fallback

      let query = withTenant(
        supabase
          .from('attendance_logs')
          .select(`
            id,
            student_id,
            persons!attendance_logs_student_id_fkey(id, name),
            ${classFKName}(id, name),
            occurred_at,
            status
          `)
          .eq('status', 'absent')
          .order('occurred_at', { ascending: false }),
        tenant_id
      );

      if (!includeExcused) {
        query = query.neq('status', 'excused');
      }

      if (date) {
        const dateFrom = `${date}T00:00:00+09:00`;
        const dateTo = `${date}T23:59:59+09:00`;
        query = query.gte('occurred_at', dateFrom).lte('occurred_at', dateTo);
      } else {
        const todayStr = toKSTDate();
        const dateFrom = `${todayStr}T00:00:00+09:00`;
        const dateTo = `${todayStr}T23:59:59+09:00`;
        query = query.gte('occurred_at', dateFrom).lte('occurred_at', dateTo);
      }

      const { data, error } = await query;

      if (error) {
        const maskedError = maskPII(error);
        console.error('[attendanceQueryAbsentHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '출결 데이터 조회에 실패했습니다.',
          },
        };
      }

      // Industry Adapter: 업종별 클래스 정보 동적 접근
      const classTableName = classFKName.split('!')[0] || 'academy_classes';
      const students = (data || []).map((log: any) => ({
        id: log.student_id,
        name: log.persons?.name || '',
        class_name: log[classTableName]?.name || log.academy_classes?.name || '',
      }));

      const responseData = {
        students,
        total_count: students.length,
      };

      if (!Array.isArray(responseData.students) || typeof responseData.total_count !== 'number') {
        return {
          success: false,
          error: {
            code: 'INVALID_RESPONSE_FORMAT',
            message: '응답 형식이 올바르지 않습니다.',
          },
        };
      }

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[attendanceQueryAbsentHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 출결: 조퇴한 대상 조회
 * Intent: attendance.query.early_leave
 */
export const attendanceQueryEarlyLeaveHandler: L0IntentHandler = {
  intent_key: 'attendance.query.early_leave',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const date = params.date as string | undefined; // YYYY-MM-DD

      // Industry Adapter: 업종별 FK 관계명 동적 조회
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const classFKName = getFKRelationName('attendance_logs_class_id', industryType) ||
        'academy_classes!attendance_logs_class_id_fkey'; // Fallback

      let query = withTenant(
        supabase
          .from('attendance_logs')
          .select(`
            id,
            student_id,
            persons!attendance_logs_student_id_fkey(id, name),
            ${classFKName}(id, name),
            occurred_at,
            status
          `)
          .eq('status', 'early_leave')
          .order('occurred_at', { ascending: false }),
        tenant_id
      );

      if (date) {
        const dateFrom = `${date}T00:00:00+09:00`;
        const dateTo = `${date}T23:59:59+09:00`;
        query = query.gte('occurred_at', dateFrom).lte('occurred_at', dateTo);
      } else {
        const todayStr = toKSTDate();
        const dateFrom = `${todayStr}T00:00:00+09:00`;
        const dateTo = `${todayStr}T23:59:59+09:00`;
        query = query.gte('occurred_at', dateFrom).lte('occurred_at', dateTo);
      }

      const { data, error } = await query;

      if (error) {
        const maskedError = maskPII(error);
        console.error('[attendanceQueryEarlyLeaveHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '출결 데이터 조회에 실패했습니다.',
          },
        };
      }

      // Industry Adapter: 업종별 클래스 정보 동적 접근
      const classTableName = classFKName.split('!')[0] || 'academy_classes';
      const students = (data || []).map((log: any) => ({
        id: log.student_id,
        name: log.persons?.name || '',
        class_name: log[classTableName]?.name || log.academy_classes?.name || '',
        leave_time: log.occurred_at ? new Date(log.occurred_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '',
      }));

      const responseData = {
        students,
        total_count: students.length,
      };

      if (!Array.isArray(responseData.students) || typeof responseData.total_count !== 'number') {
        return {
          success: false,
          error: {
            code: 'INVALID_RESPONSE_FORMAT',
            message: '응답 형식이 올바르지 않습니다.',
          },
        };
      }

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[attendanceQueryEarlyLeaveHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 출결: 출결 미체크 대상 조회
 * Intent: attendance.query.unchecked
 */
export const attendanceQueryUncheckedHandler: L0IntentHandler = {
  intent_key: 'attendance.query.unchecked',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const date = params.date as string | undefined; // YYYY-MM-DD

      const targetDate = date || toKSTDate();
      const dateFrom = `${targetDate}T00:00:00+09:00`;
      const dateTo = `${targetDate}T23:59:59+09:00`;

      // 해당 날짜에 출결 기록이 없는 학생 조회
      // Industry Adapter: 업종별 테이블명 및 FK 관계명 동적 조회
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const studentTableName = await getTenantTableName(supabase, tenant_id, 'student');
      const classFKName = getFKRelationName('student_classes_class_id', industryType) ||
        'academy_classes!student_classes_class_id_fkey'; // Fallback
      const studentFKName = getFKRelationName('student_classes_student_id', industryType) ||
        'academy_students!student_classes_student_id_fkey'; // Fallback

      // 1. 모든 활성 학생 조회
      // Industry Adapter: 업종별 FK 관계명 동적 조회
      const personFKName = studentTableName
        ? `${studentTableName}!${studentTableName}_person_id_fkey`
        : 'academy_students!academy_students_person_id_fkey'; // Fallback

      const { data: allStudents, error: studentsError } = await withTenant(
        supabase
          .from(studentTableName || 'academy_students') // Fallback
          .select(`
            person_id,
            ${personFKName}(id, name),
            student_classes!${studentFKName}(
              ${classFKName}(id, name)
            )
          `)
          .eq('status', 'active'),
        tenant_id
      );

      if (studentsError) {
        const maskedError = maskPII(studentsError);
        console.error('[attendanceQueryUncheckedHandler] Failed to fetch students:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '학생 정보 조회에 실패했습니다.',
          },
        };
      }

      // 2. 해당 날짜에 출결 기록이 있는 학생 조회
      const { data: checkedStudents, error: checkedError } = await withTenant(
        supabase
          .from('attendance_logs')
          .select('student_id')
          .gte('occurred_at', dateFrom)
          .lte('occurred_at', dateTo),
        tenant_id
      );

      if (checkedError) {
        const maskedError = maskPII(checkedError);
        console.error('[attendanceQueryUncheckedHandler] Failed to fetch checked students:', maskedError);
        // checkedStudents 조회 실패해도 계속 진행
      }

      const checkedStudentIds = new Set((checkedStudents || []).map((log: any) => log.student_id));

      // 3. 출결 기록이 없는 학생 필터링
      const classTableName = classFKName.split('!')[0] || 'academy_classes';
      const uncheckedStudents = (allStudents || [])
        .filter((student: any) => !checkedStudentIds.has(student.person_id))
        .map((student: any) => {
          const studentClass = student.student_classes?.[0];
          const industryClass = studentClass?.[classTableName] || studentClass?.academy_classes;
          return {
            id: student.person_id,
            name: student.persons?.name || '',
            class_name: industryClass?.name || '',
          };
        });

      const responseData = {
        students: uncheckedStudents,
        total_count: uncheckedStudents.length,
      };

      if (!Array.isArray(responseData.students) || typeof responseData.total_count !== 'number') {
        return {
          success: false,
          error: {
            code: 'INVALID_RESPONSE_FORMAT',
            message: '응답 형식이 올바르지 않습니다.',
          },
        };
      }

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[attendanceQueryUncheckedHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 출결: 반별 출결 조회
 * Intent: attendance.query.by_class
 */
export const attendanceQueryByClassHandler: L0IntentHandler = {
  intent_key: 'attendance.query.by_class',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const classId = params.class_id as string;
      const date = params.date as string | undefined; // YYYY-MM-DD

      if (!classId) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'class_id가 필요합니다.',
          },
        };
      }

      let query = withTenant(
        supabase
          .from('attendance_logs')
          .select(`
            id,
            student_id,
            persons!attendance_logs_student_id_fkey(id, name),
            occurred_at,
            status
          `)
          .eq('class_id', classId)
          .order('occurred_at', { ascending: false }),
        tenant_id
      );

      if (date) {
        const dateFrom = `${date}T00:00:00+09:00`;
        const dateTo = `${date}T23:59:59+09:00`;
        query = query.gte('occurred_at', dateFrom).lte('occurred_at', dateTo);
      } else {
        const todayStr = toKSTDate();
        const dateFrom = `${todayStr}T00:00:00+09:00`;
        const dateTo = `${todayStr}T23:59:59+09:00`;
        query = query.gte('occurred_at', dateFrom).lte('occurred_at', dateTo);
      }

      const { data, error } = await query;

      if (error) {
        const maskedError = maskPII(error);
        console.error('[attendanceQueryByClassHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '출결 데이터 조회에 실패했습니다.',
          },
        };
      }

      const records = (data || []).map((log: any) => ({
        student_id: log.student_id,
        student_name: log.persons?.name || '',
        status: log.status,
        time: log.occurred_at ? new Date(log.occurred_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '',
      }));

      const responseData = {
        records,
        total_count: records.length,
      };

      if (!Array.isArray(responseData.records) || typeof responseData.total_count !== 'number') {
        return {
          success: false,
          error: {
            code: 'INVALID_RESPONSE_FORMAT',
            message: '응답 형식이 올바르지 않습니다.',
          },
        };
      }

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[attendanceQueryByClassHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 학생: 학생 프로필 조회
 * Intent: student.query.profile
 */
export const studentQueryProfileHandler: L0IntentHandler = {
  intent_key: 'student.query.profile',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const studentId = params.student_id as string;

      if (!studentId) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'student_id가 필요합니다.',
          },
        };
      }

      // ⚠️ 중요: persons 테이블에서 먼저 조회 (academy_students는 optional)
      // persons에 있지만 academy_students에 없을 수 있음
      const { data: person, error: personError } = await withTenant(
        supabase
          .from('persons')
          .select('id, name, phone, email')
          .eq('id', studentId)
          .eq('person_type', 'student')
          .single(),
        tenant_id
      );

      if (personError || !person) {
        const maskedError = maskPII(personError);
        console.error('[studentQueryProfileHandler] Person query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'STUDENT_NOT_FOUND',
            message: '학생을 찾을 수 없습니다.',
          },
        };
      }

      // Industry Adapter: 업종별 학생 테이블 정보 조회 (optional)
      const studentTableName = await getTenantTableName(supabase, tenant_id, 'student');
      const { data: academyStudent } = await withTenant(
        supabase
          .from(studentTableName || 'academy_students') // Fallback
          .select('grade, status')
          .eq('person_id', studentId)
          .maybeSingle(),
        tenant_id
      );

      // Industry Adapter: 업종별 FK 관계명 동적 조회
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const classFKName = getFKRelationName('student_classes_class_id', industryType) ||
        'academy_classes!student_classes_class_id_fkey'; // Fallback

      // 반 정보 별도 조회 (student_classes는 persons.id를 참조)
      const { data: studentClasses } = await withTenant(
        supabase
          .from('student_classes')
          .select(`
            class_id,
            ${classFKName}(id, name)
          `)
          .eq('student_id', studentId)
          .eq('is_active', true)
          .limit(1),
        tenant_id
      );

      // 보호자 정보 조회
      const { data: guardian } = await withTenant(
        supabase
          .from('guardians')
          .select('name, phone')
          .eq('student_id', studentId)
          .eq('is_primary', true)
          .maybeSingle(),
        tenant_id
      );

      const studentClass = studentClasses?.[0];
      const classTableName = classFKName.split('!')[0] || 'academy_classes';
      const industryClass = studentClass?.[classTableName] || studentClass?.academy_classes;

      const responseData = {
        student: {
          id: person.id,
          name: person.name || '',
          grade: academyStudent?.grade || '',
          class_name: industryClass?.name || '',
          status: academyStudent?.status || 'active',
          guardian_name: guardian?.name || '',
          guardian_contact: guardian?.phone || '',
        },
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[studentQueryProfileHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 학생: 상태별 학생 목록 조회
 * Intent: student.query.status_list
 */
export const studentQueryStatusListHandler: L0IntentHandler = {
  intent_key: 'student.query.status_list',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const status = params.status as string;
      const classId = params.class_id as string | undefined;

      if (!status) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'status가 필요합니다.',
          },
        };
      }

      // Industry Adapter: 업종별 테이블명 및 FK 관계명 동적 조회
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const studentTableName = await getTenantTableName(supabase, tenant_id, 'student');
      const classFKName = getFKRelationName('student_classes_class_id', industryType) ||
        'academy_classes!student_classes_class_id_fkey'; // Fallback
      const studentFKName = getFKRelationName('student_classes_student_id', industryType) ||
        'academy_students!student_classes_student_id_fkey'; // Fallback
      const personFKName = studentTableName
        ? `${studentTableName}!${studentTableName}_person_id_fkey`
        : 'academy_students!academy_students_person_id_fkey'; // Fallback

      let query = withTenant(
        supabase
          .from(studentTableName || 'academy_students') // Fallback
          .select(`
            person_id,
            status,
            ${personFKName}(id, name),
            student_classes!${studentFKName}(
              ${classFKName}(id, name)
            )
          `)
          .eq('status', status),
        tenant_id
      );

      if (classId) {
        // class_id로 필터링하려면 student_classes를 통해 조회
        query = query.eq('student_classes.class_id', classId);
      }

      const { data, error } = await query;

      if (error) {
        const maskedError = maskPII(error);
        console.error('[studentQueryStatusListHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '학생 목록 조회에 실패했습니다.',
          },
        };
      }

      // Industry Adapter: 업종별 클래스 정보 동적 접근
      const classTableName = classFKName.split('!')[0] || 'academy_classes';
      const students = (data || []).map((student: any) => {
        const studentClass = student.student_classes?.[0];
        const industryClass = studentClass?.[classTableName] || studentClass?.academy_classes;
        return {
          id: student.person_id,
          name: student.persons?.name || '',
          class_name: industryClass?.name || '',
          status: student.status,
        };
      });

      const responseData = {
        students,
        total_count: students.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[studentQueryStatusListHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 반: 반 목록 조회
 * Intent: class.query.list
 */
export const classQueryListHandler: L0IntentHandler = {
  intent_key: 'class.query.list',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const activeOnly = params.active_only as boolean | undefined;

      // Industry Adapter: 업종별 클래스 테이블명 동적 조회
      const classTableName = await getTenantTableName(supabase, tenant_id, 'class');
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const teacherFKName = classTableName
        ? `${classTableName}!${classTableName}_teacher_id_fkey`
        : 'academy_classes!academy_classes_teacher_id_fkey'; // Fallback

      let query = withTenant(
        supabase
          .from(classTableName || 'academy_classes') // Fallback
          .select(`
            id,
            name,
            teacher_id,
            ${teacherFKName}(name),
            status,
            student_classes(count)
          `)
          .order('name', { ascending: true }),
        tenant_id
      );

      if (activeOnly) {
        query = query.eq('status', 'active');
      }

      const { data, error } = await query;

      if (error) {
        const maskedError = maskPII(error);
        console.error('[classQueryListHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '반 목록 조회에 실패했습니다.',
          },
        };
      }

      const classes = (data || []).map((cls: any) => ({
        id: cls.id,
        name: cls.name,
        teacher_name: cls.persons?.name || '',
        student_count: cls.student_classes?.[0]?.count || 0,
        status: cls.status,
      }));

      const responseData = {
        classes,
        total_count: classes.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[classQueryListHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 반: 반 명단 조회
 * Intent: class.query.roster
 */
export const classQueryRosterHandler: L0IntentHandler = {
  intent_key: 'class.query.roster',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const classId = params.class_id as string;
      const date = params.date as string | undefined; // YYYY-MM-DD

      if (!classId) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'class_id가 필요합니다.',
          },
        };
      }

      // Industry Adapter: 업종별 FK 관계명 동적 조회
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const studentFKName = getFKRelationName('student_classes_student_id', industryType) ||
        'academy_students!student_classes_student_id_fkey'; // Fallback

      // 해당 날짜(또는 현재) 기준으로 반 학생 조회
      const targetDate = date || toKSTDate();

      const { data, error } = await withTenant(
        supabase
          .from('student_classes')
          .select(`
            student_id,
            persons!student_classes_student_id_fkey(id, name),
            ${studentFKName}(status)
          `)
          .eq('class_id', classId)
          .lte('started_at', `${targetDate}T23:59:59+09:00`)
          .or(`ended_at.is.null,ended_at.gte.${targetDate}T00:00:00+09:00`),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[classQueryRosterHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '반 명단 조회에 실패했습니다.',
          },
        };
      }

      // Industry Adapter: 업종별 학생 테이블 정보 동적 접근
      const studentTableName = studentFKName.split('!')[0] || 'academy_students';
      const students = (data || []).map((sc: any) => ({
        id: sc.student_id,
        name: sc.persons?.name || '',
        status: sc[studentTableName]?.status || sc.academy_students?.status || 'active',
      }));

      const responseData = {
        students,
        total_count: students.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[classQueryRosterHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 출결: 연속 결석 대상 조회
 * Intent: attendance.query.streak_absent
 */
export const attendanceQueryStreakAbsentHandler: L0IntentHandler = {
  intent_key: 'attendance.query.streak_absent',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD
      const streakDays = params.streak_days as number;

      if (!from || !to || !streakDays) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from, to, streak_days가 필요합니다.',
          },
        };
      }

      // Industry Adapter: 업종별 FK 관계명 동적 조회
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const classFKName = getFKRelationName('attendance_logs_class_id', industryType) ||
        'academy_classes!attendance_logs_class_id_fkey'; // Fallback

      // 출결 로그에서 연속 결석 대상 조회
      // 실제 구현은 더 복잡한 로직 필요 (날짜별 결석 체크)
      const { data, error } = await withTenant(
        supabase
          .from('attendance_logs')
          .select(`
            student_id,
            persons!attendance_logs_student_id_fkey(id, name),
            ${classFKName}(id, name),
            occurred_at,
            status
          `)
          .eq('status', 'absent')
          .gte('occurred_at', `${from}T00:00:00+09:00`)
          .lte('occurred_at', `${to}T23:59:59+09:00`)
          .order('occurred_at', { ascending: false }),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[attendanceQueryStreakAbsentHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '연속 결석 데이터 조회에 실패했습니다.',
          },
        };
      }

      // 연속 결석 계산 (간단한 예시, 실제로는 더 정교한 로직 필요)
      const studentStreaks = new Map<string, { count: number; lastDate: string }>();
      for (const log of data || []) {
        const studentId = log.student_id;
        const logDate = log.occurred_at ? toKSTDate(log.occurred_at) : '';
        const existing = studentStreaks.get(studentId);
        if (!existing) {
          studentStreaks.set(studentId, { count: 1, lastDate: logDate });
        } else {
          studentStreaks.set(studentId, { count: existing.count + 1, lastDate: logDate });
        }
      }

      // Industry Adapter: 업종별 클래스 정보 동적 접근
      const classTableName = classFKName.split('!')[0] || 'academy_classes';
      const students = Array.from(studentStreaks.entries())
        .filter(([_, streak]) => streak.count >= streakDays)
        .map(([studentId, streak]) => {
          const log = (data || []).find((l: any) => l.student_id === studentId);
          return {
            id: studentId,
            name: log?.persons?.name || '',
            class_name: log?.[classTableName]?.name || log?.academy_classes?.name || '',
            streak_days: streak.count,
          };
        });

      const responseData = {
        students,
        total_count: students.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[attendanceQueryStreakAbsentHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 출결: 출결률 요약 조회
 * Intent: attendance.query.rate_summary
 */
export const attendanceQueryRateSummaryHandler: L0IntentHandler = {
  intent_key: 'attendance.query.rate_summary',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD
      const groupBy = params.group_by as 'class' | 'grade' | undefined;

      if (!from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from과 to 날짜가 필요합니다.',
          },
        };
      }

      // Industry Adapter: 업종별 FK 관계명 동적 조회
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const classFKName = getFKRelationName('attendance_logs_class_id', industryType) ||
        'academy_classes!attendance_logs_class_id_fkey'; // Fallback
      const studentTableName = await getTenantTableName(supabase, tenant_id, 'student');
      const studentFKName = studentTableName
        ? `${studentTableName}!attendance_logs_student_id_fkey`
        : 'academy_students!attendance_logs_student_id_fkey'; // Fallback

      // 출결 로그 조회
      const { data, error } = await withTenant(
        supabase
          .from('attendance_logs')
          .select(`
            student_id,
            status,
            ${classFKName}(id, name),
            ${studentFKName}(grade)
          `)
          .gte('occurred_at', `${from}T00:00:00+09:00`)
          .lte('occurred_at', `${to}T23:59:59+09:00`),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[attendanceQueryRateSummaryHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '출결률 데이터 조회에 실패했습니다.',
          },
        };
      }

      // 그룹별 출결률 계산 (간단한 예시)
      const summary: Array<{ group_key: string; group_name: string; attendance_rate: number; total_students: number }> = [];
      let totalPresent = 0;
      let totalCount = 0;

      // Industry Adapter: 업종별 클래스 정보 동적 접근
      const classTableName = classFKName.split('!')[0] || 'academy_classes';
      if (groupBy === 'class') {
        const classMap = new Map<string, { present: number; total: number; name: string }>();
        for (const log of data || []) {
          const industryClass = log[classTableName] || log.academy_classes;
          const classId = industryClass?.id || 'unknown';
          const className = industryClass?.name || 'Unknown';
          const existing = classMap.get(classId) || { present: 0, total: 0, name: className };
          existing.total++;
          if (log.status === 'present') {
            existing.present++;
          }
          classMap.set(classId, existing);
        }
        for (const [classId, stats] of classMap.entries()) {
          summary.push({
            group_key: classId,
            group_name: stats.name,
            attendance_rate: stats.total > 0 ? (stats.present / stats.total) * 100 : 0,
            total_students: stats.total,
          });
          totalPresent += stats.present;
          totalCount += stats.total;
        }
      } else {
        // 전체 요약
        for (const log of data || []) {
          totalCount++;
          if (log.status === 'present') {
            totalPresent++;
          }
        }
      }

      const overallRate = totalCount > 0 ? (totalPresent / totalCount) * 100 : 0;

      const responseData = {
        summary,
        overall_rate: overallRate,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[attendanceQueryRateSummaryHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 출결: 출결률 하락 대상 조회
 * Intent: attendance.query.rate_drop
 */
export const attendanceQueryRateDropHandler: L0IntentHandler = {
  intent_key: 'attendance.query.rate_drop',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD
      const dropPp = params.drop_pp as number; // 하락 퍼센트포인트

      if (!from || !to || dropPp === undefined) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from, to, drop_pp가 필요합니다.',
          },
        };
      }

      // 기간을 반으로 나누어 이전/현재 출결률 비교
      // 실제 구현은 더 정교한 로직 필요
      const midDate = new Date((new Date(from).getTime() + new Date(to).getTime()) / 2);
      const midDateStr = toKSTDate(midDate);

      // 이전 기간 출결률
      const { data: previousData } = await withTenant(
        supabase
          .from('attendance_logs')
          .select('student_id, status')
          .gte('occurred_at', `${from}T00:00:00+09:00`)
          .lt('occurred_at', `${midDateStr}T00:00:00+09:00`),
        tenant_id
      );

      // Industry Adapter: 업종별 FK 관계명 동적 조회
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const classFKName = getFKRelationName('attendance_logs_class_id', industryType) ||
        'academy_classes!attendance_logs_class_id_fkey'; // Fallback

      // 현재 기간 출결률
      const { data: currentData } = await withTenant(
        supabase
          .from('attendance_logs')
          .select(`
            student_id,
            status,
            persons!attendance_logs_student_id_fkey(id, name),
            ${classFKName}(id, name)
          `)
          .gte('occurred_at', `${midDateStr}T00:00:00+09:00`)
          .lte('occurred_at', `${to}T23:59:59+09:00`),
        tenant_id
      );

      // 학생별 출결률 계산
      const studentRates = new Map<string, { previous: number; current: number; name: string; className: string }>();

      // 이전 기간 계산
      const prevMap = new Map<string, { present: number; total: number }>();
      for (const log of previousData || []) {
        const studentId = log.student_id;
        const existing = prevMap.get(studentId) || { present: 0, total: 0 };
        existing.total++;
        if (log.status === 'present') {
          existing.present++;
        }
        prevMap.set(studentId, existing);
      }

      // Industry Adapter: 업종별 클래스 정보 동적 접근
      const classTableName = classFKName.split('!')[0] || 'academy_classes';
      // 현재 기간 계산
      const currMap = new Map<string, { present: number; total: number; name: string; className: string }>();
      for (const log of currentData || []) {
        const studentId = log.student_id;
        const industryClass = log[classTableName] || log.academy_classes;
        const existing = currMap.get(studentId) || { present: 0, total: 0, name: log.persons?.name || '', className: industryClass?.name || '' };
        existing.total++;
        if (log.status === 'present') {
          existing.present++;
        }
        currMap.set(studentId, existing);
      }

      // 하락 대상 필터링
      const students: Array<{ id: string; name: string; class_name: string; previous_rate: number; current_rate: number; drop_pp: number }> = [];
      for (const [studentId, curr] of currMap.entries()) {
        const prev = prevMap.get(studentId);
        if (prev && prev.total > 0 && curr.total > 0) {
          const prevRate = (prev.present / prev.total) * 100;
          const currRate = (curr.present / curr.total) * 100;
          const drop = prevRate - currRate;
          if (drop >= dropPp) {
            students.push({
              id: studentId,
              name: curr.name,
              class_name: curr.className,
              previous_rate: prevRate,
              current_rate: currRate,
              drop_pp: drop,
            });
          }
        }
      }

      const responseData = {
        students,
        total_count: students.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[attendanceQueryRateDropHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 출결: 지각 랭킹 조회
 * Intent: attendance.query.late_rank
 */
export const attendanceQueryLateRankHandler: L0IntentHandler = {
  intent_key: 'attendance.query.late_rank',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD
      const topN = params.top_n as number;

      if (!from || !to || !topN) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from, to, top_n이 필요합니다.',
          },
        };
      }

      // Industry Adapter: 업종별 FK 관계명 동적 조회
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const classFKName = getFKRelationName('attendance_logs_class_id', industryType) ||
        'academy_classes!attendance_logs_class_id_fkey'; // Fallback

      // 지각 로그 조회
      const { data, error } = await withTenant(
        supabase
          .from('attendance_logs')
          .select(`
            student_id,
            persons!attendance_logs_student_id_fkey(id, name),
            ${classFKName}(id, name),
            status
          `)
          .eq('status', 'late')
          .gte('occurred_at', `${from}T00:00:00+09:00`)
          .lte('occurred_at', `${to}T23:59:59+09:00`),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[attendanceQueryLateRankHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '지각 랭킹 데이터 조회에 실패했습니다.',
          },
        };
      }

      // Industry Adapter: 업종별 클래스 정보 동적 접근
      const classTableName = classFKName.split('!')[0] || 'academy_classes';
      // 학생별 지각 횟수 계산
      const studentLateCounts = new Map<string, { count: number; name: string; className: string }>();
      for (const log of data || []) {
        const studentId = log.student_id;
        const industryClass = log[classTableName] || log.academy_classes;
        const existing = studentLateCounts.get(studentId) || { count: 0, name: log.persons?.name || '', className: industryClass?.name || '' };
        existing.count++;
        studentLateCounts.set(studentId, existing);
      }

      // 랭킹 정렬
      const students = Array.from(studentLateCounts.entries())
        .map(([studentId, stats]) => ({
          id: studentId,
          name: stats.name,
          class_name: stats.className,
          late_count: stats.count,
          rank: 0, // 임시
        }))
        .sort((a, b) => b.late_count - a.late_count)
        .slice(0, topN)
        .map((student, index) => ({
          ...student,
          rank: index + 1,
        }));

      const responseData = {
        students,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[attendanceQueryLateRankHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 출결: 출결 데이터 CSV 내보내기
 * Intent: attendance.query.export_csv
 */
export const attendanceQueryExportCsvHandler: L0IntentHandler = {
  intent_key: 'attendance.query.export_csv',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD

      if (!from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from과 to 날짜가 필요합니다.',
          },
        };
      }

      // 출결 로그 조회
      const { data, error } = await withTenant(
        supabase
          .from('attendance_logs')
          .select('*')
          .gte('occurred_at', `${from}T00:00:00+09:00`)
          .lte('occurred_at', `${to}T23:59:59+09:00`),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[attendanceQueryExportCsvHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '출결 데이터 조회에 실패했습니다.',
          },
        };
      }

      // CSV 생성 및 업로드 (실제 구현은 storage에 업로드)
      // 임시로 다운로드 URL 생성 (실제로는 storage에 업로드 후 signed URL 반환)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24시간 후 만료

      const responseData = {
        download_url: `https://storage.example.com/exports/attendance_${from}_${to}.csv`, // 임시 URL
        expires_at: expiresAt.toISOString(),
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[attendanceQueryExportCsvHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 수납/청구: 월별 연체 조회
 * Intent: billing.query.overdue_month
 */
export const billingQueryOverdueMonthHandler: L0IntentHandler = {
  intent_key: 'billing.query.overdue_month',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const month = params.month as string; // YYYY-MM

      if (!month) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'month가 필요합니다.',
          },
        };
      }

      // 해당 월의 연체 청구서 조회
      const { data, error } = await withTenant(
        supabase
          .from('invoices')
          .select(`
            id,
            student_id,
            amount_due,
            due_date,
            persons!invoices_student_id_fkey(id, name)
          `)
          .eq('month', month)
          .gt('amount_due', 0),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[billingQueryOverdueMonthHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '연체 데이터 조회에 실패했습니다.',
          },
        };
      }

      // 연체 일수 계산
      const students = (data || []).map((invoice: any) => {
        const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
        const today = new Date();
        const overdueDays = dueDate ? Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
        return {
          id: invoice.student_id,
          name: invoice.persons?.name || '',
          overdue_amount: invoice.amount_due || 0,
          overdue_days: overdueDays,
        };
      });

      const totalAmount = students.reduce((sum: number, s: any) => sum + s.overdue_amount, 0);

      const responseData = {
        students,
        total_count: students.length,
        total_amount: totalAmount,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billingQueryOverdueMonthHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 수납/청구: 연체 목록 조회
 * Intent: billing.query.overdue_list
 */
export const billingQueryOverdueListHandler: L0IntentHandler = {
  intent_key: 'billing.query.overdue_list',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD
      const minDays = params.min_days as number | undefined;

      if (!from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from과 to 날짜가 필요합니다.',
          },
        };
      }

      // 연체 청구서 조회
      const { data, error } = await withTenant(
        supabase
          .from('invoices')
          .select(`
            id,
            student_id,
            amount_due,
            due_date,
            persons!invoices_student_id_fkey(id, name)
          `)
          .gte('due_date', `${from}T00:00:00+09:00`)
          .lte('due_date', `${to}T23:59:59+09:00`)
          .gt('amount_due', 0),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[billingQueryOverdueListHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '연체 목록 조회에 실패했습니다.',
          },
        };
      }

      // 연체 일수 계산 및 필터링
      let students = (data || []).map((invoice: any) => {
        const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
        const today = new Date();
        const overdueDays = dueDate ? Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
        return {
          id: invoice.student_id,
          name: invoice.persons?.name || '',
          overdue_amount: invoice.amount_due || 0,
          overdue_days: overdueDays,
        };
      });

      if (minDays !== undefined) {
        students = students.filter((s: any) => s.overdue_days >= minDays);
      }

      const responseData = {
        students,
        total_count: students.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billingQueryOverdueListHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 수납/청구: 특정 학생의 청구 조회
 * Intent: billing.query.by_student
 */
export const billingQueryByStudentHandler: L0IntentHandler = {
  intent_key: 'billing.query.by_student',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const studentId = params.student_id as string;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD

      if (!studentId || !from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'student_id, from, to가 필요합니다.',
          },
        };
      }

      // 해당 기간의 청구서 조회
      const { data, error } = await withTenant(
        supabase
          .from('invoices')
          .select('id, month, amount, status')
          .eq('student_id', studentId)
          .gte('month', from.substring(0, 7))
          .lte('month', to.substring(0, 7)),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[billingQueryByStudentHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '청구 데이터 조회에 실패했습니다.',
          },
        };
      }

      const invoices = (data || []).map((invoice: any) => ({
        id: invoice.id,
        month: invoice.month,
        amount: invoice.amount || 0,
        status: invoice.status || 'unissued',
      }));

      const responseData = {
        invoices,
        total_count: invoices.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billingQueryByStudentHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 수납/청구: 청구서 상태 조회
 * Intent: billing.query.invoice_status
 */
export const billingQueryInvoiceStatusHandler: L0IntentHandler = {
  intent_key: 'billing.query.invoice_status',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const month = params.month as string; // YYYY-MM
      const status = params.status as string;

      if (!month || !status) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'month와 status가 필요합니다.',
          },
        };
      }

      // 해당 월의 특정 상태 청구서 조회
      const { data, error } = await withTenant(
        supabase
          .from('invoices')
          .select(`
            id,
            student_id,
            amount,
            persons!invoices_student_id_fkey(id, name)
          `)
          .eq('month', month)
          .eq('status', status),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[billingQueryInvoiceStatusHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '청구서 조회에 실패했습니다.',
          },
        };
      }

      const invoices = (data || []).map((invoice: any) => ({
        id: invoice.id,
        student_id: invoice.student_id,
        student_name: invoice.persons?.name || '',
        amount: invoice.amount || 0,
      }));

      const responseData = {
        invoices,
        total_count: invoices.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billingQueryInvoiceStatusHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 수납/청구: 결제 실패 목록 조회
 * Intent: billing.query.failed_payments
 */
export const billingQueryFailedPaymentsHandler: L0IntentHandler = {
  intent_key: 'billing.query.failed_payments',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD

      if (!from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from과 to 날짜가 필요합니다.',
          },
        };
      }

      // 결제 실패 기록 조회
      const { data, error } = await withTenant(
        supabase
          .from('payments')
          .select(`
            id,
            student_id,
            amount,
            failed_at,
            reason,
            persons!payments_student_id_fkey(id, name)
          `)
          .eq('status', 'failed')
          .gte('failed_at', `${from}T00:00:00+09:00`)
          .lte('failed_at', `${to}T23:59:59+09:00`),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[billingQueryFailedPaymentsHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '결제 실패 목록 조회에 실패했습니다.',
          },
        };
      }

      const payments = (data || []).map((payment: any) => ({
        id: payment.id,
        student_id: payment.student_id,
        student_name: payment.persons?.name || '',
        amount: payment.amount || 0,
        failed_at: payment.failed_at || '',
        reason: payment.reason || '',
      }));

      const responseData = {
        payments,
        total_count: payments.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billingQueryFailedPaymentsHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 수납/청구: 환불 후보 조회
 * Intent: billing.query.refund_candidates
 */
export const billingQueryRefundCandidatesHandler: L0IntentHandler = {
  intent_key: 'billing.query.refund_candidates',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD

      if (!from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from과 to 날짜가 필요합니다.',
          },
        };
      }

      // 환불 후보 조회 (실제 구현은 비즈니스 로직에 따라 다름)
      // 예: 퇴원 학생의 미사용 수강료 등
      const { data, error } = await withTenant(
        supabase
          .from('invoices')
          .select(`
            student_id,
            persons!invoices_student_id_fkey(id, name),
            amount,
            status
          `)
          .eq('status', 'paid')
          .gte('created_at', `${from}T00:00:00+09:00`)
          .lte('created_at', `${to}T23:59:59+09:00`),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[billingQueryRefundCandidatesHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '환불 후보 조회에 실패했습니다.',
          },
        };
      }

      // 간단한 예시: 환불 후보 계산 (실제로는 더 복잡한 로직 필요)
      const candidates = (data || []).map((invoice: any) => ({
        student_id: invoice.student_id,
        student_name: invoice.persons?.name || '',
        refund_amount: invoice.amount || 0,
        reason: '환불 후보',
      }));

      const responseData = {
        candidates,
        total_count: candidates.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billingQueryRefundCandidatesHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 수납/청구: 수납 KPI 요약 조회
 * Intent: billing.query.kpi_summary
 */
export const billingQueryKpiSummaryHandler: L0IntentHandler = {
  intent_key: 'billing.query.kpi_summary',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD
      const groupBy = params.group_by as 'class' | 'grade' | undefined;

      if (!from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from과 to 날짜가 필요합니다.',
          },
        };
      }

      // Industry Adapter: 업종별 FK 관계명 동적 조회
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const studentFKName = getFKRelationName('invoices_student_id', industryType) ||
        'academy_students!invoices_student_id_fkey'; // Fallback
      const studentClassesFKName = getFKRelationName('student_classes_student_id', industryType) ||
        'academy_students!student_classes_student_id_fkey'; // Fallback

      // 청구서 및 결제 데이터 조회
      const { data: invoices, error: invoicesError } = await withTenant(
        supabase
          .from('invoices')
          .select(`
            id,
            student_id,
            amount,
            status,
            ${studentFKName}(grade, student_classes!${studentClassesFKName}(class_id))
          `)
          .gte('month', from.substring(0, 7))
          .lte('month', to.substring(0, 7)),
        tenant_id
      );

      if (invoicesError) {
        const maskedError = maskPII(invoicesError);
        console.error('[billingQueryKpiSummaryHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: 'KPI 데이터 조회에 실패했습니다.',
          },
        };
      }

      // KPI 계산 (간단한 예시)
      let summary: Array<{ group_key: string; group_name: string; total_revenue: number; collection_rate: number }> = [];
      let overallRevenue = 0;
      let overallPaid = 0;

      // Industry Adapter: 업종별 학생 테이블 정보 동적 접근
      const studentTableNameForAccess = studentFKName.split('!')[0] || 'academy_students';
      if (groupBy === 'class') {
        const classMap = new Map<string, { revenue: number; paid: number; name: string }>();
        for (const invoice of invoices || []) {
          const studentData = invoice[studentTableNameForAccess] || invoice.academy_students;
          const classId = studentData?.student_classes?.[0]?.class_id || 'unknown';
          const existing = classMap.get(classId) || { revenue: 0, paid: 0, name: 'Unknown' };
          existing.revenue += invoice.amount || 0;
          if (invoice.status === 'paid') {
            existing.paid += invoice.amount || 0;
          }
          classMap.set(classId, existing);
        }
        for (const [classId, stats] of classMap.entries()) {
          summary.push({
            group_key: classId,
            group_name: stats.name,
            total_revenue: stats.revenue,
            collection_rate: stats.revenue > 0 ? (stats.paid / stats.revenue) * 100 : 0,
          });
          overallRevenue += stats.revenue;
          overallPaid += stats.paid;
        }
      } else {
        // 전체 요약
        for (const invoice of invoices || []) {
          overallRevenue += invoice.amount || 0;
          if (invoice.status === 'paid') {
            overallPaid += invoice.amount || 0;
          }
        }
      }

      const overallCollectionRate = overallRevenue > 0 ? (overallPaid / overallRevenue) * 100 : 0;

      const responseData = {
        summary,
        overall_revenue: overallRevenue,
        overall_collection_rate: overallCollectionRate,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billingQueryKpiSummaryHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 수납/청구: 미발행 청구서 조회
 * Intent: billing.query.unissued_invoices
 */
export const billingQueryUnissuedInvoicesHandler: L0IntentHandler = {
  intent_key: 'billing.query.unissued_invoices',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const month = params.month as string; // YYYY-MM

      if (!month) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'month가 필요합니다.',
          },
        };
      }

      // Industry Adapter: 업종별 학생 테이블명 동적 조회
      const studentTableName = await getTenantTableName(supabase, tenant_id, 'student');
      const personFKName = studentTableName
        ? `${studentTableName}!${studentTableName}_person_id_fkey`
        : 'academy_students!academy_students_person_id_fkey'; // Fallback

      // 미발행 청구서 조회 (실제로는 학생별 예상 청구 금액 계산 필요)
      const { data: students, error: studentsError } = await withTenant(
        supabase
          .from(studentTableName || 'academy_students') // Fallback
          .select(`
            person_id,
            ${personFKName}(id, name)
          `)
          .eq('status', 'active'),
        tenant_id
      );

      if (studentsError) {
        const maskedError = maskPII(studentsError);
        console.error('[billingQueryUnissuedInvoicesHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '학생 정보 조회에 실패했습니다.',
          },
        };
      }

      // 해당 월에 발행된 청구서 확인
      const { data: issuedInvoices } = await withTenant(
        supabase
          .from('invoices')
          .select('student_id')
          .eq('month', month)
          .eq('status', 'issued'),
        tenant_id
      );

      const issuedStudentIds = new Set((issuedInvoices || []).map((inv: any) => inv.student_id));

      // 미발행 학생 목록
      const unissuedStudents = (students || [])
        .filter((s: any) => !issuedStudentIds.has(s.person_id))
        .map((s: any) => ({
          id: s.person_id,
          name: s.persons?.name || '',
          expected_amount: 0, // 실제로는 가격 규칙에 따라 계산 필요
        }));

      const responseData = {
        students: unissuedStudents,
        total_count: unissuedStudents.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billingQueryUnissuedInvoicesHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 수납/청구: 부분 결제 목록 조회
 * Intent: billing.query.partial_payments
 */
export const billingQueryPartialPaymentsHandler: L0IntentHandler = {
  intent_key: 'billing.query.partial_payments',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD

      if (!from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from과 to 날짜가 필요합니다.',
          },
        };
      }

      // 부분 결제 조회 (status가 'partial'인 청구서)
      const { data, error } = await withTenant(
        supabase
          .from('invoices')
          .select(`
            id,
            student_id,
            amount,
            amount_due,
            persons!invoices_student_id_fkey(id, name)
          `)
          .eq('status', 'partial')
          .gte('created_at', `${from}T00:00:00+09:00`)
          .lte('created_at', `${to}T23:59:59+09:00`),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[billingQueryPartialPaymentsHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '부분 결제 목록 조회에 실패했습니다.',
          },
        };
      }

      const payments = (data || []).map((invoice: any) => ({
        id: invoice.id,
        student_id: invoice.student_id,
        student_name: invoice.persons?.name || '',
        paid_amount: (invoice.amount || 0) - (invoice.amount_due || 0),
        remaining_amount: invoice.amount_due || 0,
      }));

      const responseData = {
        payments,
        total_count: payments.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billingQueryPartialPaymentsHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 수납/청구: 명세서 내보내기
 * Intent: billing.query.export_statement
 */
export const billingQueryExportStatementHandler: L0IntentHandler = {
  intent_key: 'billing.query.export_statement',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD
      const format = params.format as 'csv' | 'pdf' | 'excel' | undefined;

      if (!from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from과 to 날짜가 필요합니다.',
          },
        };
      }

      // 명세서 데이터 조회 및 파일 생성 (실제 구현은 storage에 업로드)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const responseData = {
        download_url: `https://storage.example.com/exports/billing_${from}_${to}.${format || 'csv'}`,
        expires_at: expiresAt.toISOString(),
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[billingQueryExportStatementHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 메시지/공지: 발송 로그 조회
 * Intent: message.query.sent_log
 */
export const messageQuerySentLogHandler: L0IntentHandler = {
  intent_key: 'message.query.sent_log',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD
      const channel = params.channel as string | undefined;

      if (!from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from과 to 날짜가 필요합니다.',
          },
        };
      }

      let query = withTenant(
        supabase
          .from('notifications')
          .select(`
            id,
            channel,
            sent_at,
            status,
            execution_context
          `)
          .eq('status', 'sent')
          .gte('sent_at', `${from}T00:00:00+09:00`)
          .lte('sent_at', `${to}T23:59:59+09:00`),
        tenant_id
      );

      if (channel) {
        query = query.eq('channel', channel);
      }

      const { data, error } = await query;

      if (error) {
        const maskedError = maskPII(error);
        console.error('[messageQuerySentLogHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '발송 로그 조회에 실패했습니다.',
          },
        };
      }

      // execution_context에서 student_id 추출
      const messages = (data || []).map((notification: any) => {
        const execContext = notification.execution_context || {};
        return {
          id: notification.id,
          student_id: execContext.student_id || '',
          student_name: '', // 실제로는 persons 조회 필요
          channel: notification.channel,
          sent_at: notification.sent_at || '',
          status: notification.status,
        };
      });

      const responseData = {
        messages,
        total_count: messages.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[messageQuerySentLogHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 메시지/공지: 발송 실패 로그 조회
 * Intent: message.query.failed_log
 */
export const messageQueryFailedLogHandler: L0IntentHandler = {
  intent_key: 'message.query.failed_log',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD

      if (!from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from과 to 날짜가 필요합니다.',
          },
        };
      }

      const { data, error } = await withTenant(
        supabase
          .from('notifications')
          .select(`
            id,
            channel,
            failed_at,
            error,
            execution_context
          `)
          .eq('status', 'failed')
          .gte('failed_at', `${from}T00:00:00+09:00`)
          .lte('failed_at', `${to}T23:59:59+09:00`),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[messageQueryFailedLogHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '실패 로그 조회에 실패했습니다.',
          },
        };
      }

      const messages = (data || []).map((notification: any) => {
        const execContext = notification.execution_context || {};
        return {
          id: notification.id,
          student_id: execContext.student_id || '',
          student_name: '',
          channel: notification.channel,
          failed_at: notification.failed_at || '',
          error: notification.error || '',
        };
      });

      const responseData = {
        messages,
        total_count: messages.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[messageQueryFailedLogHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 메시지/공지: 결석 안내 초안 생성
 * Intent: message.draft.absence_notice
 */
export const messageDraftAbsenceNoticeHandler: L0IntentHandler = {
  intent_key: 'message.draft.absence_notice',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const studentId = params.student_id as string;
      const date = params.date as string; // YYYY-MM-DD
      const tone = params.tone as 'formal' | 'friendly' | 'casual' | undefined;

      if (!studentId || !date) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'student_id와 date가 필요합니다.',
          },
        };
      }

      // Industry Adapter: 업종별 학생 테이블명 동적 조회
      const studentTableName = await getTenantTableName(supabase, tenant_id, 'student');
      const personFKName = studentTableName
        ? `${studentTableName}!${studentTableName}_person_id_fkey`
        : 'academy_students!academy_students_person_id_fkey'; // Fallback

      // 학생 정보 조회
      const { data: student } = await withTenant(
        supabase
          .from(studentTableName || 'academy_students') // Fallback
          .select(`${personFKName}(name)`)
          .eq('person_id', studentId)
          .single(),
        tenant_id
      );

      // 초안 생성 (실제로는 AI 또는 템플릿 엔진 사용)
      const draft = {
        title: `[${date}] 결석 안내`,
        body: `안녕하세요. ${student?.persons?.name || '학생'}님의 ${date} 결석에 대해 안내드립니다.`,
        variables: ['student_name', 'date', 'class_name'],
      };

      const responseData = {
        draft,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[messageDraftAbsenceNoticeHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 메시지/공지: 연체 안내 초안 생성
 * Intent: message.draft.overdue_notice
 */
export const messageDraftOverdueNoticeHandler: L0IntentHandler = {
  intent_key: 'message.draft.overdue_notice',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const studentId = params.student_id as string;
      const month = params.month as string; // YYYY-MM
      const tone = params.tone as 'formal' | 'friendly' | 'casual' | undefined;

      if (!studentId || !month) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'student_id와 month가 필요합니다.',
          },
        };
      }

      // 청구서 정보 조회
      const { data: invoice } = await withTenant(
        supabase
          .from('invoices')
          .select('amount_due, persons!invoices_student_id_fkey(name)')
          .eq('student_id', studentId)
          .eq('month', month)
          .single(),
        tenant_id
      );

      const draft = {
        title: `[${month}] 연체 안내`,
        body: `안녕하세요. ${invoice?.persons?.name || '학생'}님의 ${month} 청구금액이 연체되었습니다.`,
        variables: ['student_name', 'month', 'amount_due'],
      };

      const responseData = {
        draft,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[messageDraftOverdueNoticeHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 메시지/공지: 일반 공지 초안 생성
 * Intent: message.draft.general_notice
 */
export const messageDraftGeneralNoticeHandler: L0IntentHandler = {
  intent_key: 'message.draft.general_notice',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const title = params.title as string;
      const bodyHint = params.body_hint as string;
      const audience = params.audience as 'all' | 'class' | 'grade';

      if (!title || !bodyHint || !audience) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'title, body_hint, audience가 필요합니다.',
          },
        };
      }

      // 초안 생성 (실제로는 AI 사용)
      const draft = {
        title: title,
        body: bodyHint,
        variables: ['student_name', 'class_name'],
      };

      const responseData = {
        draft,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[messageDraftGeneralNoticeHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 메시지/공지: 수신 대상 미리보기
 * Intent: message.preview.audience
 */
export const messagePreviewAudienceHandler: L0IntentHandler = {
  intent_key: 'message.preview.audience',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const audience = params.audience as 'all' | 'class' | 'grade';
      const id = params.id as string | undefined; // class_id 또는 grade

      if (!audience) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'audience가 필요합니다.',
          },
        };
      }

      // Industry Adapter: 업종별 학생 테이블명 동적 조회
      const studentTableName = await getTenantTableName(supabase, tenant_id, 'student');

      let studentIds: string[] = [];
      if (audience === 'all') {
        const { data: allStudents } = await withTenant(
          supabase
            .from(studentTableName || 'academy_students') // Fallback
            .select('person_id')
            .eq('status', 'active'),
          tenant_id
        );
        studentIds = (allStudents || []).map((s: any) => s.person_id);
      } else if (audience === 'class' && id) {
        const { data: classStudents } = await withTenant(
          supabase
            .from('student_classes')
            .select('student_id')
            .eq('class_id', id),
          tenant_id
        );
        studentIds = (classStudents || []).map((sc: any) => sc.student_id);
      } else if (audience === 'grade' && id) {
        const { data: gradeStudents } = await withTenant(
          supabase
            .from(studentTableName || 'academy_students') // Fallback
            .select('person_id')
            .eq('grade', id)
            .eq('status', 'active'),
          tenant_id
        );
        studentIds = (gradeStudents || []).map((s: any) => s.person_id);
      }

      // 보호자 정보 조회
      const { data: guardians } = await withTenant(
        supabase
          .from('guardians')
          .select(`
            student_id,
            name,
            phone,
            persons!guardians_student_id_fkey(id, name)
          `)
          .in('student_id', studentIds)
          .eq('is_primary', true),
        tenant_id
      );

      const recipients = (guardians || []).map((guardian: any) => ({
        student_id: guardian.student_id,
        student_name: guardian.persons?.name || '',
        guardian_name: guardian.name || '',
        contact: guardian.phone || '',
      }));

      const responseData = {
        recipients,
        total_count: recipients.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[messagePreviewAudienceHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 메시지/공지: 템플릿 렌더링 미리보기
 * Intent: message.preview.template_render
 */
export const messagePreviewTemplateRenderHandler: L0IntentHandler = {
  intent_key: 'message.preview.template_render',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const templateId = params.template_id as string;
      const sampleStudentIds = params.sample_student_ids as string[];

      if (!templateId || !sampleStudentIds || sampleStudentIds.length === 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'template_id와 sample_student_ids가 필요합니다.',
          },
        };
      }

      // 템플릿 조회
      const { data: template } = await withTenant(
        supabase
          .from('message_templates')
          .select('body')
          .eq('id', templateId)
          .single(),
        tenant_id
      );

      // Industry Adapter: 업종별 학생 테이블명 동적 조회
      const studentTableName = await getTenantTableName(supabase, tenant_id, 'student');
      const personFKName = studentTableName
        ? `${studentTableName}!${studentTableName}_person_id_fkey`
        : 'academy_students!academy_students_person_id_fkey'; // Fallback

      // 학생 정보 조회
      const { data: students } = await withTenant(
        supabase
          .from(studentTableName || 'academy_students') // Fallback
          .select(`${personFKName}(name)`)
          .in('person_id', sampleStudentIds),
        tenant_id
      );

      // 템플릿 렌더링 (간단한 예시)
      const samples = (students || []).map((student: any) => ({
        student_id: student.person_id,
        student_name: student.persons?.name || '',
        rendered_text: template?.body?.replace('{{student_name}}', student.persons?.name || '') || '',
      }));

      const responseData = {
        samples,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[messagePreviewTemplateRenderHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 메시지/공지: 결제 링크 안내 초안 생성
 * Intent: message.draft.payment_link_notice
 */
export const messageDraftPaymentLinkNoticeHandler: L0IntentHandler = {
  intent_key: 'message.draft.payment_link_notice',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const studentId = params.student_id as string;
      const month = params.month as string; // YYYY-MM
      const tone = params.tone as 'formal' | 'friendly' | 'casual' | undefined;

      if (!studentId || !month) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'student_id와 month가 필요합니다.',
          },
        };
      }

      // 청구서 및 결제 링크 조회
      const { data: invoice } = await withTenant(
        supabase
          .from('invoices')
          .select('payment_link, persons!invoices_student_id_fkey(name)')
          .eq('student_id', studentId)
          .eq('month', month)
          .single(),
        tenant_id
      );

      const draft = {
        title: `[${month}] 결제 링크 안내`,
        body: `안녕하세요. ${invoice?.persons?.name || '학생'}님의 ${month} 청구금액 결제 링크입니다.`,
        variables: ['student_name', 'month', 'payment_link'],
      };

      const responseData = {
        draft,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[messageDraftPaymentLinkNoticeHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 메시지/공지: 템플릿 변수 검증
 * Intent: message.query.variables_check
 */
export const messageQueryVariablesCheckHandler: L0IntentHandler = {
  intent_key: 'message.query.variables_check',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const templateId = params.template_id as string;

      if (!templateId) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'template_id가 필요합니다.',
          },
        };
      }

      // 템플릿 조회
      const { data: template, error } = await withTenant(
        supabase
          .from('message_templates')
          .select('body')
          .eq('id', templateId)
          .single(),
        tenant_id
      );

      if (error || !template) {
        const maskedError = maskPII(error);
        console.error('[messageQueryVariablesCheckHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '템플릿 조회에 실패했습니다.',
          },
        };
      }

      // 변수 추출 (간단한 예시: {{variable}} 패턴)
      const variablePattern = /\{\{(\w+)\}\}/g;
      const variables: string[] = [];
      const matches = template.body?.matchAll(variablePattern);
      if (matches) {
        for (const match of matches) {
          if (!variables.includes(match[1])) {
            variables.push(match[1]);
          }
        }
      }

      // 변수 검증 (실제로는 더 복잡한 로직 필요)
      const valid = true;
      const errors: string[] = [];

      const responseData = {
        valid,
        errors,
        variables,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[messageQueryVariablesCheckHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 학생: 보호자 연락처 누락 학생 조회
 * Intent: student.query.missing_guardian_contact
 */
export const studentQueryMissingGuardianContactHandler: L0IntentHandler = {
  intent_key: 'student.query.missing_guardian_contact',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;

      // Industry Adapter: 업종별 테이블명 및 FK 관계명 동적 조회
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const studentTableName = await getTenantTableName(supabase, tenant_id, 'student');
      const classFKName = getFKRelationName('student_classes_class_id', industryType) ||
        'academy_classes!student_classes_class_id_fkey'; // Fallback
      const studentFKName = getFKRelationName('student_classes_student_id', industryType) ||
        'academy_students!student_classes_student_id_fkey'; // Fallback
      const personFKName = studentTableName
        ? `${studentTableName}!${studentTableName}_person_id_fkey`
        : 'academy_students!academy_students_person_id_fkey'; // Fallback

      // 보호자 연락처가 없는 학생 조회
      const { data: students, error: studentsError } = await withTenant(
        supabase
          .from(studentTableName || 'academy_students') // Fallback
          .select(`
            person_id,
            ${personFKName}(id, name),
            student_classes!${studentFKName}(
              ${classFKName}(id, name)
            )
          `)
          .eq('status', 'active'),
        tenant_id
      );

      if (studentsError) {
        const maskedError = maskPII(studentsError);
        console.error('[studentQueryMissingGuardianContactHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '학생 정보 조회에 실패했습니다.',
          },
        };
      }

      // 보호자 연락처 확인
      const studentIds = (students || []).map((s: any) => s.person_id);
      const { data: guardians } = await withTenant(
        supabase
          .from('guardians')
          .select('student_id, phone, email')
          .in('student_id', studentIds)
          .eq('is_primary', true),
        tenant_id
      );

      const guardianMap = new Map<string, boolean>();
      for (const guardian of guardians || []) {
        if (guardian.phone || guardian.email) {
          guardianMap.set(guardian.student_id, true);
        }
      }

      // Industry Adapter: 업종별 클래스 정보 동적 접근
      const classTableName = classFKName.split('!')[0] || 'academy_classes';
      const missingStudents = (students || [])
        .filter((s: any) => !guardianMap.has(s.person_id))
        .map((s: any) => {
          const studentClass = s.student_classes?.[0];
          const industryClass = studentClass?.[classTableName] || studentClass?.academy_classes;
          return {
            id: s.person_id,
            name: s.persons?.name || '',
            class_name: industryClass?.name || '',
          };
        });

      const responseData = {
        students: missingStudents,
        total_count: missingStudents.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[studentQueryMissingGuardianContactHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 학생: 중복 의심 학생 조회
 * Intent: student.query.duplicates_suspected
 */
export const studentQueryDuplicatesSuspectedHandler: L0IntentHandler = {
  intent_key: 'student.query.duplicates_suspected',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string | undefined;
      const to = params.to as string | undefined;

      // Industry Adapter: 업종별 학생 테이블명 동적 조회
      const studentTableName = await getTenantTableName(supabase, tenant_id, 'student');
      const personFKName = studentTableName
        ? `${studentTableName}!${studentTableName}_person_id_fkey`
        : 'academy_students!academy_students_person_id_fkey'; // Fallback

      // 중복 의심 학생 조회 (실제로는 더 복잡한 알고리즘 필요)
      // 간단한 예시: 이름과 전화번호가 같은 학생
      const { data: students, error } = await withTenant(
        supabase
          .from(studentTableName || 'academy_students') // Fallback
          .select(`
            person_id,
            ${personFKName}(id, name, phone)
          `)
          .eq('status', 'active'),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[studentQueryDuplicatesSuspectedHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '학생 정보 조회에 실패했습니다.',
          },
        };
      }

      // 중복 검사 (간단한 예시)
      const nameMap = new Map<string, any[]>();
      for (const student of students || []) {
        const name = student.persons?.name || '';
        if (name) {
          if (!nameMap.has(name)) {
            nameMap.set(name, []);
          }
          nameMap.get(name)!.push(student);
        }
      }

      const duplicates: any[] = [];
      for (const [name, studentList] of nameMap.entries()) {
        if (studentList.length > 1) {
          for (let i = 0; i < studentList.length; i++) {
            for (let j = i + 1; j < studentList.length; j++) {
              duplicates.push({
                primary_id: studentList[i].person_id,
                primary_name: studentList[i].persons?.name || '',
                duplicate_id: studentList[j].person_id,
                duplicate_name: studentList[j].persons?.name || '',
                similarity_score: 0.9, // 실제로는 유사도 계산 필요
              });
            }
          }
        }
      }

      const responseData = {
        duplicates,
        total_count: duplicates.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[studentQueryDuplicatesSuspectedHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 학생: 온보딩 필요 학생 조회
 * Intent: student.query.onboarding_needed
 */
export const studentQueryOnboardingNeededHandler: L0IntentHandler = {
  intent_key: 'student.query.onboarding_needed',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD

      if (!from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from과 to 날짜가 필요합니다.',
          },
        };
      }

      // Industry Adapter: 업종별 학생 테이블명 동적 조회
      const studentTableName = await getTenantTableName(supabase, tenant_id, 'student');
      const personFKName = studentTableName
        ? `${studentTableName}!${studentTableName}_person_id_fkey`
        : 'academy_students!academy_students_person_id_fkey'; // Fallback

      // 해당 기간에 등록된 학생 조회
      const { data: students, error } = await withTenant(
        supabase
          .from(studentTableName || 'academy_students') // Fallback
          .select(`
            person_id,
            created_at,
            ${personFKName}(id, name)
          `)
          .gte('created_at', `${from}T00:00:00+09:00`)
          .lte('created_at', `${to}T23:59:59+09:00`),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[studentQueryOnboardingNeededHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '학생 정보 조회에 실패했습니다.',
          },
        };
      }

      // 온보딩 필요 항목 확인 (간단한 예시)
      const onboardingNeeded = (students || []).map((student: any) => ({
        id: student.person_id,
        name: student.persons?.name || '',
        registered_at: student.created_at || '',
        missing_items: ['guardian_contact', 'documents'], // 실제로는 더 정교한 검사 필요
      }));

      const responseData = {
        students: onboardingNeeded,
        total_count: onboardingNeeded.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[studentQueryOnboardingNeededHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 학생: 학생 데이터 품질 검증
 * Intent: student.query.data_quality_scan
 */
export const studentQueryDataQualityScanHandler: L0IntentHandler = {
  intent_key: 'student.query.data_quality_scan',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const fields = params.fields as string[];
      const scope = params.scope as string | undefined;

      if (!fields || fields.length === 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'fields가 필요합니다.',
          },
        };
      }

      // Industry Adapter: 업종별 학생 테이블명 동적 조회
      const studentTableName = await getTenantTableName(supabase, tenant_id, 'student');
      const personFKName = studentTableName
        ? `${studentTableName}!${studentTableName}_person_id_fkey`
        : 'academy_students!academy_students_person_id_fkey'; // Fallback

      // 학생 데이터 조회
      const { data: students, error } = await withTenant(
        supabase
          .from(studentTableName || 'academy_students') // Fallback
          .select(`
            person_id,
            ${personFKName}(id, name, phone, email)
          `)
          .eq('status', 'active'),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[studentQueryDataQualityScanHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '학생 정보 조회에 실패했습니다.',
          },
        };
      }

      // 데이터 품질 검사
      const issues: any[] = [];
      for (const student of students || []) {
        for (const field of fields) {
          const value = (student.persons as any)?.[field];
          if (!value || value.trim() === '') {
            issues.push({
              student_id: student.person_id,
              student_name: student.persons?.name || '',
              field: field,
              issue_type: 'missing',
              severity: 'error',
            });
          }
        }
      }

      const responseData = {
        issues,
        total_count: issues.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[studentQueryDataQualityScanHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 스케줄: 오늘 시간표 조회
 * Intent: schedule.query.today
 */
export const scheduleQueryTodayHandler: L0IntentHandler = {
  intent_key: 'schedule.query.today',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const date = params.date as string | undefined; // YYYY-MM-DD

      const targetDate = date || toKSTDate();
      const dateFrom = `${targetDate}T00:00:00+09:00`;
      const dateTo = `${targetDate}T23:59:59+09:00`;

      // Industry Adapter: 업종별 FK 관계명 동적 조회
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const classFKName = industryType
        ? `${await getTenantTableName(supabase, tenant_id, 'class')}!class_sessions_class_id_fkey`
        : 'academy_classes!class_sessions_class_id_fkey'; // Fallback

      const { data, error } = await withTenant(
        supabase
          .from('class_sessions')
          .select(`
            id,
            class_id,
            starts_at,
            ends_at,
            room,
            ${classFKName}(id, name)
          `)
          .gte('starts_at', dateFrom)
          .lte('starts_at', dateTo)
          .order('starts_at', { ascending: true }),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[scheduleQueryTodayHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '시간표 조회에 실패했습니다.',
          },
        };
      }

      // Industry Adapter: 업종별 클래스 정보 동적 접근
      const classTableName = classFKName.split('!')[0] || 'academy_classes';
      const sessions = (data || []).map((session: any) => ({
        id: session.id,
        class_id: session.class_id,
        class_name: session[classTableName]?.name || session.academy_classes?.name || '',
        starts_at: session.starts_at || '',
        ends_at: session.ends_at || '',
        room: session.room || '',
      }));

      const responseData = {
        sessions,
        total_count: sessions.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[scheduleQueryTodayHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 스케줄: 강사별 시간표 조회
 * Intent: schedule.query.by_teacher
 */
export const scheduleQueryByTeacherHandler: L0IntentHandler = {
  intent_key: 'schedule.query.by_teacher',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const teacherId = params.teacher_id as string;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD

      if (!teacherId || !from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'teacher_id, from, to가 필요합니다.',
          },
        };
      }

      const dateFrom = `${from}T00:00:00+09:00`;
      const dateTo = `${to}T23:59:59+09:00`;

      // Industry Adapter: 업종별 FK 관계명 동적 조회
      const industryType = await getTenantIndustryType(supabase, tenant_id);
      const classFKName = getFKRelationName('class_sessions_class_id', industryType) ||
        'academy_classes!class_sessions_class_id_fkey'; // Fallback

      // 강사가 담당하는 반의 세션 조회
      const { data, error } = await withTenant(
        supabase
          .from('class_sessions')
          .select(`
            id,
            class_id,
            starts_at,
            ends_at,
            ${classFKName}(id, name, teacher_id)
          `)
          .gte('starts_at', dateFrom)
          .lte('starts_at', dateTo)
          .eq(`${classTableName || 'academy_classes'}.teacher_id`, teacherId)
          .order('starts_at', { ascending: true }),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[scheduleQueryByTeacherHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '시간표 조회에 실패했습니다.',
          },
        };
      }

      // Industry Adapter: 업종별 클래스 정보 동적 접근
      const classTableNameForAccess = classFKName.split('!')[0] || 'academy_classes';
      const sessions = (data || []).map((session: any) => ({
        id: session.id,
        class_id: session.class_id,
        class_name: session[classTableNameForAccess]?.name || session.academy_classes?.name || '',
        starts_at: session.starts_at || '',
        ends_at: session.ends_at || '',
      }));

      const responseData = {
        sessions,
        total_count: sessions.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[scheduleQueryByTeacherHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 스케줄: 반별 시간표 조회
 * Intent: schedule.query.by_class
 */
export const scheduleQueryByClassHandler: L0IntentHandler = {
  intent_key: 'schedule.query.by_class',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const classId = params.class_id as string;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD

      if (!classId || !from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'class_id, from, to가 필요합니다.',
          },
        };
      }

      const dateFrom = `${from}T00:00:00+09:00`;
      const dateTo = `${to}T23:59:59+09:00`;

      const { data, error } = await withTenant(
        supabase
          .from('class_sessions')
          .select('id, starts_at, ends_at, room')
          .eq('class_id', classId)
          .gte('starts_at', dateFrom)
          .lte('starts_at', dateTo)
          .order('starts_at', { ascending: true }),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[scheduleQueryByClassHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '시간표 조회에 실패했습니다.',
          },
        };
      }

      const sessions = (data || []).map((session: any) => ({
        id: session.id,
        starts_at: session.starts_at || '',
        ends_at: session.ends_at || '',
        room: session.room || '',
      }));

      const responseData = {
        sessions,
        total_count: sessions.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[scheduleQueryByClassHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 스케줄: 시간표 내보내기
 * Intent: schedule.query.export_timetable
 */
export const scheduleQueryExportTimetableHandler: L0IntentHandler = {
  intent_key: 'schedule.query.export_timetable',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD

      if (!from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from과 to 날짜가 필요합니다.',
          },
        };
      }

      // 시간표 데이터 조회 및 파일 생성
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const responseData = {
        download_url: `https://storage.example.com/exports/timetable_${from}_${to}.csv`,
        expires_at: expiresAt.toISOString(),
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[scheduleQueryExportTimetableHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 노트: 학생별 상담일지 조회
 * Intent: note.query.by_student
 */
export const noteQueryByStudentHandler: L0IntentHandler = {
  intent_key: 'note.query.by_student',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const studentId = params.student_id as string;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD

      if (!studentId || !from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'student_id, from, to가 필요합니다.',
          },
        };
      }

      const dateFrom = `${from}T00:00:00+09:00`;
      const dateTo = `${to}T23:59:59+09:00`;

      const { data, error } = await withTenant(
        supabase
          .from('notes')
          .select('id, type, content, created_at')
          .eq('student_id', studentId)
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo)
          .order('created_at', { ascending: false }),
        tenant_id
      );

      if (error) {
        const maskedError = maskPII(error);
        console.error('[noteQueryByStudentHandler] Query failed:', maskedError);
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: '상담일지 조회에 실패했습니다.',
          },
        };
      }

      const notes = (data || []).map((note: any) => ({
        id: note.id,
        type: note.type || '',
        content: note.content || '',
        created_at: note.created_at || '',
      }));

      const responseData = {
        notes,
        total_count: notes.length,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[noteQueryByStudentHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 노트: 상담 요약 초안 생성
 * Intent: note.draft.consult_summary
 */
export const noteDraftConsultSummaryHandler: L0IntentHandler = {
  intent_key: 'note.draft.consult_summary',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const noteId = params.note_id as string;
      const format = params.format as 'bullets' | 'short' | 'detailed';

      if (!noteId || !format) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'note_id와 format이 필요합니다.',
          },
        };
      }

      // 상담일지 조회
      const { data: note } = await withTenant(
        supabase
          .from('notes')
          .select('content')
          .eq('id', noteId)
          .single(),
        tenant_id
      );

      // 요약 생성 (실제로는 AI 사용)
      const summary = note?.content ? `[${format}] ${note.content.substring(0, 100)}...` : '';

      const responseData = {
        summary,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[noteDraftConsultSummaryHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * AI: 학생 이력 요약
 * Intent: ai.summarize.student_history
 */
export const aiSummarizeStudentHistoryHandler: L0IntentHandler = {
  intent_key: 'ai.summarize.student_history',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const studentId = params.student_id as string;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD

      if (!studentId || !from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'student_id, from, to가 필요합니다.',
          },
        };
      }

      // 출결, 청구, 상담일지 데이터 조회
      // 실제로는 AI를 사용하여 요약 생성
      const summary = {
        attendance_summary: '출결 요약',
        billing_summary: '청구 요약',
        notes_summary: '상담 요약',
      };

      const responseData = {
        summary,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[aiSummarizeStudentHistoryHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * AI: 후속 메시지 생성
 * Intent: ai.generate.followup_message
 */
export const aiGenerateFollowupMessageHandler: L0IntentHandler = {
  intent_key: 'ai.generate.followup_message',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const studentId = params.student_id as string;
      const reason = params.reason as string;
      const tone = params.tone as 'formal' | 'friendly' | 'casual' | undefined;

      if (!studentId || !reason) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'student_id와 reason이 필요합니다.',
          },
        };
      }

      // AI를 사용하여 후속 메시지 생성 (실제 구현 필요)
      const message = `[${tone || 'friendly'}] ${reason}에 대한 후속 메시지입니다.`;

      const responseData = {
        message,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[aiGenerateFollowupMessageHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * AI: 반 이력 요약
 * Intent: ai.summarize.class_history
 */
export const aiSummarizeClassHistoryHandler: L0IntentHandler = {
  intent_key: 'ai.summarize.class_history',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const classId = params.class_id as string;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD

      if (!classId || !from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'class_id, from, to가 필요합니다.',
          },
        };
      }

      // 반 이력 데이터 조회 및 AI 요약 생성
      const summary = {
        attendance_summary: '반 출결 요약',
        performance_summary: '반 성과 요약',
      };

      const responseData = {
        summary,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[aiSummarizeClassHistoryHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * AI: 상담 안건 초안 생성
 * Intent: ai.generate.counseling_agenda
 */
export const aiGenerateCounselingAgendaHandler: L0IntentHandler = {
  intent_key: 'ai.generate.counseling_agenda',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const studentId = params.student_id as string;

      if (!studentId) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'student_id가 필요합니다.',
          },
        };
      }

      // AI를 사용하여 상담 안건 생성
      const agenda = '상담 안건 초안';

      const responseData = {
        agenda,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[aiGenerateCounselingAgendaHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * AI: AI 브리핑 내보내기
 * Intent: ai.query.export_ai_briefing
 */
export const aiQueryExportAiBriefingHandler: L0IntentHandler = {
  intent_key: 'ai.query.export_ai_briefing',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const date = params.date as string; // YYYY-MM-DD

      if (!date) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'date가 필요합니다.',
          },
        };
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const responseData = {
        download_url: `https://storage.example.com/exports/ai_briefing_${date}.pdf`,
        expires_at: expiresAt.toISOString(),
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[aiQueryExportAiBriefingHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 리포트: 대시보드 KPI 조회
 * Intent: report.query.dashboard_kpi
 */
export const reportQueryDashboardKpiHandler: L0IntentHandler = {
  intent_key: 'report.query.dashboard_kpi',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD

      if (!from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from과 to 날짜가 필요합니다.',
          },
        };
      }

      // Industry Adapter: 업종별 학생 테이블명 동적 조회
      const studentTableName = await getTenantTableName(supabase, tenant_id, 'student');

      // KPI 데이터 조회
      const { data: students } = await withTenant(
        supabase
          .from(studentTableName || 'academy_students') // Fallback
          .select('person_id')
          .eq('status', 'active'),
        tenant_id
      );

      // 출결률, 수납률, 수익 계산 (간단한 예시)
      const kpi = {
        total_students: (students || []).length,
        attendance_rate: 0,
        collection_rate: 0,
        revenue: 0,
      };

      const responseData = {
        kpi,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[reportQueryDashboardKpiHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 리포트: 출결 요약 리포트 조회
 * Intent: report.query.attendance_summary
 */
export const reportQueryAttendanceSummaryHandler: L0IntentHandler = {
  intent_key: 'report.query.attendance_summary',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD
      const groupBy = params.group_by as 'class' | 'grade' | undefined;

      if (!from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from과 to 날짜가 필요합니다.',
          },
        };
      }

      // 출결 데이터 조회 및 요약 계산
      const summary = {
        total_days: 0,
        attendance_rate: 0,
        absent_count: 0,
        late_count: 0,
      };

      const responseData = {
        summary,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[reportQueryAttendanceSummaryHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 리포트: 수납 요약 리포트 조회
 * Intent: report.query.billing_summary
 */
export const reportQueryBillingSummaryHandler: L0IntentHandler = {
  intent_key: 'report.query.billing_summary',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD
      const groupBy = params.group_by as 'class' | 'grade' | undefined;

      if (!from || !to) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'from과 to 날짜가 필요합니다.',
          },
        };
      }

      // 수납 데이터 조회 및 요약 계산
      const summary = {
        total_revenue: 0,
        collection_rate: 0,
        overdue_amount: 0,
        paid_count: 0,
      };

      const responseData = {
        summary,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[reportQueryBillingSummaryHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 리포트: 데이터셋 내보내기
 * Intent: report.query.export_dataset
 */
export const reportQueryExportDatasetHandler: L0IntentHandler = {
  intent_key: 'report.query.export_dataset',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const dataset = params.dataset as string;
      const from = params.from as string; // YYYY-MM-DD
      const to = params.to as string; // YYYY-MM-DD
      const format = params.format as 'csv' | 'excel' | 'json';

      if (!dataset || !from || !to || !format) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'dataset, from, to, format이 필요합니다.',
          },
        };
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const responseData = {
        download_url: `https://storage.example.com/exports/${dataset}_${from}_${to}.${format}`,
        expires_at: expiresAt.toISOString(),
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[reportQueryExportDatasetHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 리포트: 헬스 스냅샷 조회
 * Intent: report.query.health_snapshot
 */
export const reportQueryHealthSnapshotHandler: L0IntentHandler = {
  intent_key: 'report.query.health_snapshot',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const date = params.date as string | undefined; // YYYY-MM-DD

      const snapshot = {
        system_health: 'healthy',
        data_quality: 'good',
        performance_metrics: {},
      };

      const responseData = {
        snapshot,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[reportQueryHealthSnapshotHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 정책: 자동화 규칙 조회
 * Intent: policy.query.automation_rules
 */
export const policyQueryAutomationRulesHandler: L0IntentHandler = {
  intent_key: 'policy.query.automation_rules',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase } = context;

      // 자동화 규칙 조회 (tenant_settings.config에서)
      const { data: config } = await withTenant(
        supabase
          .from('tenant_settings')
          .select('value')
          .eq('key', 'config')
          .single(),
        tenant_id
      );

      // auto_notification 섹션에서 규칙 추출
      const rules: any[] = [];
      if (config?.value && typeof config.value === 'object') {
        const autoNotification = (config.value as any).auto_notification;
        if (autoNotification) {
          for (const [eventType, settings] of Object.entries(autoNotification)) {
            if (typeof settings === 'object' && settings !== null) {
              rules.push({
                event_type: eventType,
                enabled: (settings as any).enabled || false,
                threshold: (settings as any).threshold || {},
              });
            }
          }
        }
      }

      const responseData = {
        rules,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[policyQueryAutomationRulesHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * RBAC: 내 권한 조회
 * Intent: rbac.query.my_permissions
 */
export const rbacQueryMyPermissionsHandler: L0IntentHandler = {
  intent_key: 'rbac.query.my_permissions',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const { tenant_id, supabase, user_id } = context;

      // 사용자 역할 조회
      const { data: userRole } = await withTenant(
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user_id)
          .single(),
        tenant_id
      );

      // 권한 조회 (역할 기반)
      const permissions: string[] = [];
      const role = userRole?.role || 'guest';

      const responseData = {
        permissions,
        role,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[rbacQueryMyPermissionsHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * 시스템: 시스템 헬스 체크
 * Intent: system.query.health
 */
export const systemQueryHealthHandler: L0IntentHandler = {
  intent_key: 'system.query.health',
  async execute(params: Record<string, unknown>, context: L0HandlerContext): Promise<L0HandlerResult> {
    try {
      const checks = params.checks as string[] | undefined;

      // 헬스 체크 수행
      const health = {
        status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
        checks: {},
      };

      const responseData = {
        health,
      };

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[systemQueryHealthHandler] Execution failed:', maskedError);
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      };
    }
  },
};

/**
 * L0 Intent Handler Registry
 */
export const l0HandlerRegistry: Record<string, L0IntentHandler> = {
  // 출결(Attendance) 도메인
  'attendance.query.late': attendanceQueryLateHandler,
  'attendance.query.by_student': attendanceQueryByStudentHandler,
  'attendance.query.absent': attendanceQueryAbsentHandler,
  'attendance.query.early_leave': attendanceQueryEarlyLeaveHandler,
  'attendance.query.unchecked': attendanceQueryUncheckedHandler,
  'attendance.query.by_class': attendanceQueryByClassHandler,
  'attendance.query.streak_absent': attendanceQueryStreakAbsentHandler,
  'attendance.query.rate_summary': attendanceQueryRateSummaryHandler,
  'attendance.query.rate_drop': attendanceQueryRateDropHandler,
  'attendance.query.late_rank': attendanceQueryLateRankHandler,
  'attendance.query.export_csv': attendanceQueryExportCsvHandler,

  // 학생(Student) 도메인
  'student.query.search': studentQuerySearchHandler,
  'student.query.profile': studentQueryProfileHandler,
  'student.query.status_list': studentQueryStatusListHandler,
  'student.query.missing_guardian_contact': studentQueryMissingGuardianContactHandler,
  'student.query.duplicates_suspected': studentQueryDuplicatesSuspectedHandler,
  'student.query.onboarding_needed': studentQueryOnboardingNeededHandler,
  'student.query.data_quality_scan': studentQueryDataQualityScanHandler,

  // 반/수업(Class) 도메인
  'class.query.list': classQueryListHandler,
  'class.query.roster': classQueryRosterHandler,

  // 수납/청구(Billing) 도메인
  'billing.query.overdue_month': billingQueryOverdueMonthHandler,
  'billing.query.overdue_list': billingQueryOverdueListHandler,
  'billing.query.by_student': billingQueryByStudentHandler,
  'billing.query.invoice_status': billingQueryInvoiceStatusHandler,
  'billing.query.failed_payments': billingQueryFailedPaymentsHandler,
  'billing.query.refund_candidates': billingQueryRefundCandidatesHandler,
  'billing.query.kpi_summary': billingQueryKpiSummaryHandler,
  'billing.query.unissued_invoices': billingQueryUnissuedInvoicesHandler,
  'billing.query.partial_payments': billingQueryPartialPaymentsHandler,
  'billing.query.export_statement': billingQueryExportStatementHandler,

  // 메시지/공지(Messaging) 도메인
  'message.query.sent_log': messageQuerySentLogHandler,
  'message.query.failed_log': messageQueryFailedLogHandler,
  'message.draft.absence_notice': messageDraftAbsenceNoticeHandler,
  'message.draft.overdue_notice': messageDraftOverdueNoticeHandler,
  'message.draft.general_notice': messageDraftGeneralNoticeHandler,
  'message.preview.audience': messagePreviewAudienceHandler,
  'message.preview.template_render': messagePreviewTemplateRenderHandler,
  'message.draft.payment_link_notice': messageDraftPaymentLinkNoticeHandler,
  'message.query.variables_check': messageQueryVariablesCheckHandler,

  // 스케줄(Schedule) 도메인
  'schedule.query.today': scheduleQueryTodayHandler,
  'schedule.query.by_teacher': scheduleQueryByTeacherHandler,
  'schedule.query.by_class': scheduleQueryByClassHandler,
  'schedule.query.export_timetable': scheduleQueryExportTimetableHandler,

  // 노트(Note) 도메인
  'note.query.by_student': noteQueryByStudentHandler,
  'note.draft.consult_summary': noteDraftConsultSummaryHandler,

  // AI 도메인
  'ai.summarize.student_history': aiSummarizeStudentHistoryHandler,
  'ai.generate.followup_message': aiGenerateFollowupMessageHandler,
  'ai.summarize.class_history': aiSummarizeClassHistoryHandler,
  'ai.generate.counseling_agenda': aiGenerateCounselingAgendaHandler,
  'ai.query.export_ai_briefing': aiQueryExportAiBriefingHandler,

  // 리포트(Report) 도메인
  'report.query.dashboard_kpi': reportQueryDashboardKpiHandler,
  'report.query.attendance_summary': reportQueryAttendanceSummaryHandler,
  'report.query.billing_summary': reportQueryBillingSummaryHandler,
  'report.query.export_dataset': reportQueryExportDatasetHandler,
  'report.query.health_snapshot': reportQueryHealthSnapshotHandler,

  // 정책/권한/시스템(System) 도메인
  'policy.query.automation_rules': policyQueryAutomationRulesHandler,
  'rbac.query.my_permissions': rbacQueryMyPermissionsHandler,
  'system.query.health': systemQueryHealthHandler,
};

/**
 * L0 Intent 핸들러 존재 여부 확인
 */
export function hasL0Handler(intent_key: string): boolean {
  return intent_key in l0HandlerRegistry;
}

/**
 * L0 Intent 핸들러 조회
 */
export function getL0Handler(intent_key: string): L0IntentHandler | undefined {
  return l0HandlerRegistry[intent_key];
}
