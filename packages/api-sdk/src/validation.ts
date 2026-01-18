/**
 * Input Validation Utilities
 *
 * [불변 규칙] 모든 사용자 입력은 Zod 스키마로 검증합니다.
 * [불변 규칙] 검증 실패 시 명확한 에러 메시지를 반환합니다.
 *
 * 사용 예시:
 * ```typescript
 * import { validateInput, studentSchema } from '@api-sdk/core';
 *
 * const result = validateInput(studentSchema, formData);
 * if (!result.success) {
 *   console.error(result.errors);
 *   return;
 * }
 * const validData = result.data;
 * ```
 */

import { z, ZodSchema, ZodError } from 'zod';

// ==================== 검증 결과 타입 ====================

export interface ValidationSuccess<T> {
  success: true;
  data: T;
  errors?: undefined;
}

export interface ValidationError {
  success: false;
  data?: undefined;
  errors: ValidationErrorItem[];
}

export interface ValidationErrorItem {
  field: string;
  message: string;
  code: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

// ==================== 검증 함수 ====================

/**
 * Zod 스키마로 입력 데이터 검증
 *
 * @param schema Zod 스키마
 * @param data 검증할 데이터
 * @returns ValidationResult<T>
 */
export function validateInput<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const validData = schema.parse(data);
    return {
      success: true,
      data: validData,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        errors: formatZodErrors(error),
      };
    }
    return {
      success: false,
      errors: [
        {
          field: '_root',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: 'UNKNOWN_ERROR',
        },
      ],
    };
  }
}

/**
 * Zod 에러를 사용자 친화적인 형식으로 변환
 */
function formatZodErrors(error: ZodError): ValidationErrorItem[] {
  return error.errors.map((err) => ({
    field: err.path.join('.') || '_root',
    message: err.message,
    code: err.code,
  }));
}

// ==================== 공통 스키마 ====================

/**
 * 이메일 스키마
 */
export const emailSchema = z
  .string()
  .email('올바른 이메일 형식이 아닙니다')
  .max(255, '이메일은 255자 이하여야 합니다')
  .optional()
  .nullable();

/**
 * 전화번호 스키마 (한국)
 */
export const phoneSchema = z
  .string()
  .regex(
    /^01[0-9]-?\d{3,4}-?\d{4}$/,
    '올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)'
  )
  .transform((val) => val.replace(/-/g, '')) // 하이픈 제거
  .optional()
  .nullable();

/**
 * 이름 스키마
 */
export const nameSchema = z
  .string()
  .min(1, '이름을 입력해주세요')
  .max(100, '이름은 100자 이하여야 합니다')
  .regex(/^[가-힣a-zA-Z\s]+$/, '이름은 한글, 영문, 공백만 허용됩니다');

/**
 * UUID 스키마
 */
export const uuidSchema = z
  .string()
  .uuid('올바른 UUID 형식이 아닙니다');

/**
 * 날짜 스키마 (YYYY-MM-DD)
 */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜는 YYYY-MM-DD 형식이어야 합니다')
  .optional()
  .nullable();

/**
 * 학생 상태 스키마
 */
export const studentStatusSchema = z.enum(
  ['active', 'on_leave', 'graduated', 'withdrawn'],
  {
    errorMap: () => ({ message: '올바른 학생 상태가 아닙니다' }),
  }
);

/**
 * 성별 스키마
 */
export const genderSchema = z
  .enum(['male', 'female', 'other'], {
    errorMap: () => ({ message: '올바른 성별이 아닙니다' }),
  })
  .optional()
  .nullable();

/**
 * 학년 스키마
 */
export const gradeSchema = z
  .string()
  .max(50, '학년은 50자 이하여야 합니다')
  .optional()
  .nullable();

// ==================== 학생 관련 스키마 ====================

/**
 * 학생 생성 입력 스키마
 */
export const createStudentInputSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  address: z.string().max(500, '주소는 500자 이하여야 합니다').optional().nullable(),
  birth_date: dateSchema,
  gender: genderSchema,
  school_name: z.string().max(100, '학교명은 100자 이하여야 합니다').optional().nullable(),
  grade: gradeSchema,
  status: studentStatusSchema.optional().default('active'),
  notes: z.string().max(2000, '메모는 2000자 이하여야 합니다').optional().nullable(),
  profile_image_url: z.string().url('올바른 URL 형식이 아닙니다').optional().nullable(),
  guardians: z
    .array(
      z.object({
        name: nameSchema,
        relationship: z.string().max(50, '관계는 50자 이하여야 합니다').optional(),
        phone: phoneSchema,
        email: emailSchema,
        is_primary: z.boolean().optional().default(false),
      })
    )
    .optional(),
  tag_ids: z.array(uuidSchema).optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentInputSchema>;

/**
 * 학생 업데이트 입력 스키마 (모든 필드 옵션)
 */
export const updateStudentInputSchema = createStudentInputSchema.partial();

export type UpdateStudentInput = z.infer<typeof updateStudentInputSchema>;

/**
 * 학생 필터 스키마
 */
export const studentFilterSchema = z.object({
  search: z.string().max(100).optional(),
  status: studentStatusSchema.optional(),
  grade: gradeSchema,
  class_id: uuidSchema.optional(),
  tag_ids: z.array(uuidSchema).optional(),
});

export type StudentFilter = z.infer<typeof studentFilterSchema>;

// ==================== 보호자 관련 스키마 ====================

/**
 * 보호자 생성 입력 스키마
 */
export const createGuardianInputSchema = z.object({
  student_id: uuidSchema,
  name: nameSchema,
  relationship: z.string().max(50).optional(),
  phone: phoneSchema,
  email: emailSchema,
  is_primary: z.boolean().optional().default(false),
});

export type CreateGuardianInput = z.infer<typeof createGuardianInputSchema>;

// ==================== 출결 관련 스키마 ====================

/**
 * 출결 유형 스키마
 */
export const attendanceTypeSchema = z.enum(
  ['check_in', 'check_out', 'absent', 'late'],
  {
    errorMap: () => ({ message: '올바른 출결 유형이 아닙니다' }),
  }
);

/**
 * 출결 상태 스키마
 */
export const attendanceStatusSchema = z.enum(
  ['present', 'late', 'absent', 'excused'],
  {
    errorMap: () => ({ message: '올바른 출결 상태가 아닙니다' }),
  }
);

/**
 * 출결 기록 입력 스키마
 */
export const createAttendanceInputSchema = z.object({
  student_id: uuidSchema,
  class_id: uuidSchema.optional().nullable(),
  occurred_at: z.string().datetime({ message: '올바른 날짜/시간 형식이 아닙니다' }),
  attendance_type: attendanceTypeSchema,
  status: attendanceStatusSchema,
  notes: z.string().max(500).optional().nullable(),
  check_in_method: z
    .enum(['phone_auth', 'qr_scan', 'manual', 'kiosk_phone'])
    .optional()
    .default('manual'),
});

export type CreateAttendanceInput = z.infer<typeof createAttendanceInputSchema>;

// ==================== 반 관련 스키마 ====================

/**
 * 요일 스키마
 */
export const dayOfWeekSchema = z.enum(
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  {
    errorMap: () => ({ message: '올바른 요일이 아닙니다' }),
  }
);

/**
 * 시간 스키마 (HH:MM)
 */
export const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, '시간은 HH:MM 형식이어야 합니다');

/**
 * 수업 생성 입력 스키마
 */
export const createClassInputSchema = z.object({
  name: z.string().min(1, '수업 이름을 입력해주세요').max(100),
  subject: z.string().max(100).optional().nullable(),
  grade: gradeSchema,
  day_of_week: dayOfWeekSchema,
  start_time: timeSchema,
  end_time: timeSchema,
  capacity: z.number().int().positive('정원은 1 이상이어야 합니다').max(1000).default(20),
  room: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, '색상은 #RRGGBB 형식이어야 합니다')
    .optional()
    .default('#3b82f6'),
});

export type CreateClassInput = z.infer<typeof createClassInputSchema>;

// ==================== 태그 관련 스키마 ====================

/**
 * 태그 생성 입력 스키마
 */
export const createTagInputSchema = z.object({
  name: z.string().min(1, '태그 이름을 입력해주세요').max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, '색상은 #RRGGBB 형식이어야 합니다')
    .optional()
    .default('#6366f1'),
  description: z.string().max(200).optional().nullable(),
  entity_type: z.enum(['student', 'class', 'teacher']).default('student'),
});

export type CreateTagInput = z.infer<typeof createTagInputSchema>;

// ==================== API 요청 검증 래퍼 ====================

/**
 * API 요청 전 입력 데이터 검증
 *
 * 사용 예시:
 * ```typescript
 * const { data, error } = validateAndPrepare(createStudentInputSchema, formData);
 * if (error) {
 *   showError(error);
 *   return;
 * }
 * await apiClient.post('students', data);
 * ```
 */
export function validateAndPrepare<T>(
  schema: ZodSchema<T>,
  data: unknown
): { data: T; error?: undefined } | { data?: undefined; error: string } {
  const result = validateInput(schema, data);

  if (!result.success) {
    const errorMessage = result.errors
      .map((e) => `${e.field}: ${e.message}`)
      .join('\n');
    return { error: errorMessage };
  }

  return { data: result.data };
}

/**
 * 단일 필드 검증
 */
export function validateField<T>(
  schema: ZodSchema<T>,
  value: unknown
): { valid: true; value: T } | { valid: false; error: string } {
  try {
    const validValue = schema.parse(value);
    return { valid: true, value: validValue };
  } catch (error) {
    if (error instanceof ZodError) {
      return { valid: false, error: error.errors[0]?.message || 'Invalid value' };
    }
    return { valid: false, error: 'Validation failed' };
  }
}
