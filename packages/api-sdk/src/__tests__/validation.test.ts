/**
 * Validation Utilities Unit Tests
 *
 * [테스트 커버리지] Zod 기반 입력 검증 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  validateInput,
  validateAndPrepare,
  validateField,
  emailSchema,
  phoneSchema,
  nameSchema,
  uuidSchema,
  dateSchema,
  studentStatusSchema,
  createStudentInputSchema,
  createGuardianInputSchema,
  createAttendanceInputSchema,
  createClassInputSchema,
  createTagInputSchema,
} from '../validation';

describe('validateInput', () => {
  it('유효한 데이터를 성공적으로 검증한다', () => {
    const result = validateInput(nameSchema, '홍길동');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('홍길동');
    }
  });

  it('유효하지 않은 데이터에 대해 에러를 반환한다', () => {
    const result = validateInput(nameSchema, '');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBeDefined();
      expect(result.errors[0].message).toBeDefined();
    }
  });
});

describe('validateAndPrepare', () => {
  it('유효한 데이터를 반환한다', () => {
    const result = validateAndPrepare(nameSchema, '김철수');

    expect(result.error).toBeUndefined();
    expect(result.data).toBe('김철수');
  });

  it('유효하지 않은 데이터에 대해 에러 메시지를 반환한다', () => {
    const result = validateAndPrepare(nameSchema, '123');

    expect(result.data).toBeUndefined();
    expect(result.error).toContain('이름은 한글, 영문, 공백만 허용됩니다');
  });
});

describe('validateField', () => {
  it('유효한 값을 반환한다', () => {
    const result = validateField(emailSchema, 'test@example.com');

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toBe('test@example.com');
    }
  });

  it('유효하지 않은 값에 대해 에러를 반환한다', () => {
    const result = validateField(emailSchema, 'invalid-email');

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('이메일');
    }
  });
});

describe('공통 스키마', () => {
  describe('emailSchema', () => {
    it('유효한 이메일을 허용한다', () => {
      const result = validateField(emailSchema, 'user@domain.com');
      expect(result.valid).toBe(true);
    });

    it('유효하지 않은 이메일을 거부한다', () => {
      const result = validateField(emailSchema, 'invalid');
      expect(result.valid).toBe(false);
    });

    it('null과 undefined를 허용한다 (optional)', () => {
      expect(validateField(emailSchema, null).valid).toBe(true);
      expect(validateField(emailSchema, undefined).valid).toBe(true);
    });
  });

  describe('phoneSchema', () => {
    it('유효한 전화번호를 허용한다', () => {
      const result = validateField(phoneSchema, '010-1234-5678');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.value).toBe('01012345678'); // 하이픈 제거
      }
    });

    it('하이픈 없는 전화번호도 허용한다', () => {
      const result = validateField(phoneSchema, '01012345678');
      expect(result.valid).toBe(true);
    });

    it('유효하지 않은 전화번호를 거부한다', () => {
      const result = validateField(phoneSchema, '02-123-4567');
      expect(result.valid).toBe(false);
    });
  });

  describe('nameSchema', () => {
    it('한글 이름을 허용한다', () => {
      const result = validateField(nameSchema, '홍길동');
      expect(result.valid).toBe(true);
    });

    it('영문 이름을 허용한다', () => {
      const result = validateField(nameSchema, 'John Doe');
      expect(result.valid).toBe(true);
    });

    it('숫자가 포함된 이름을 거부한다', () => {
      const result = validateField(nameSchema, '홍길동123');
      expect(result.valid).toBe(false);
    });

    it('빈 이름을 거부한다', () => {
      const result = validateField(nameSchema, '');
      expect(result.valid).toBe(false);
    });
  });

  describe('uuidSchema', () => {
    it('유효한 UUID를 허용한다', () => {
      const result = validateField(uuidSchema, '123e4567-e89b-12d3-a456-426614174000');
      expect(result.valid).toBe(true);
    });

    it('유효하지 않은 UUID를 거부한다', () => {
      const result = validateField(uuidSchema, 'invalid-uuid');
      expect(result.valid).toBe(false);
    });
  });

  describe('dateSchema', () => {
    it('YYYY-MM-DD 형식을 허용한다', () => {
      const result = validateField(dateSchema, '2024-01-15');
      expect(result.valid).toBe(true);
    });

    it('다른 날짜 형식을 거부한다', () => {
      const result = validateField(dateSchema, '15/01/2024');
      expect(result.valid).toBe(false);
    });
  });

  describe('studentStatusSchema', () => {
    it('유효한 상태를 허용한다', () => {
      expect(validateField(studentStatusSchema, 'active').valid).toBe(true);
      expect(validateField(studentStatusSchema, 'on_leave').valid).toBe(true);
      expect(validateField(studentStatusSchema, 'graduated').valid).toBe(true);
      expect(validateField(studentStatusSchema, 'withdrawn').valid).toBe(true);
    });

    it('유효하지 않은 상태를 거부한다', () => {
      const result = validateField(studentStatusSchema, 'invalid');
      expect(result.valid).toBe(false);
    });
  });
});

describe('학생 관련 스키마', () => {
  describe('createStudentInputSchema', () => {
    it('최소 필수 필드로 학생을 생성할 수 있다', () => {
      const input = {
        name: '김학생',
      };

      const result = validateInput(createStudentInputSchema, input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('김학생');
        expect(result.data.status).toBe('active'); // 기본값
      }
    });

    it('전체 필드를 검증한다', () => {
      const input = {
        name: '김학생',
        email: 'student@example.com',
        phone: '010-1234-5678',
        address: '서울시 강남구',
        birth_date: '2010-05-15',
        gender: 'male',
        school_name: '서울초등학교',
        grade: '3학년',
        status: 'active',
        notes: '메모 내용',
        guardians: [
          {
            name: '김부모',
            relationship: '부모',
            phone: '010-9876-5432',
            is_primary: true,
          },
        ],
        tag_ids: ['123e4567-e89b-12d3-a456-426614174000'],
      };

      const result = validateInput(createStudentInputSchema, input);

      expect(result.success).toBe(true);
    });

    it('유효하지 않은 이메일을 거부한다', () => {
      const input = {
        name: '김학생',
        email: 'invalid-email',
      };

      const result = validateInput(createStudentInputSchema, input);

      expect(result.success).toBe(false);
    });
  });
});

describe('보호자 관련 스키마', () => {
  describe('createGuardianInputSchema', () => {
    it('유효한 보호자 정보를 검증한다', () => {
      const input = {
        student_id: '123e4567-e89b-12d3-a456-426614174000',
        name: '김부모',
        phone: '010-1234-5678',
      };

      const result = validateInput(createGuardianInputSchema, input);

      expect(result.success).toBe(true);
    });

    it('student_id가 필수임을 검증한다', () => {
      const input = {
        name: '김부모',
        phone: '010-1234-5678',
      };

      const result = validateInput(createGuardianInputSchema, input);

      expect(result.success).toBe(false);
    });
  });
});

describe('출결 관련 스키마', () => {
  describe('createAttendanceInputSchema', () => {
    it('유효한 출결 기록을 검증한다', () => {
      const input = {
        student_id: '123e4567-e89b-12d3-a456-426614174000',
        occurred_at: '2024-01-15T09:00:00.000Z',
        attendance_type: 'check_in',
        status: 'present',
      };

      const result = validateInput(createAttendanceInputSchema, input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.check_in_method).toBe('manual'); // 기본값
      }
    });

    it('유효하지 않은 출결 유형을 거부한다', () => {
      const input = {
        student_id: '123e4567-e89b-12d3-a456-426614174000',
        occurred_at: '2024-01-15T09:00:00.000Z',
        attendance_type: 'invalid_type',
        status: 'present',
      };

      const result = validateInput(createAttendanceInputSchema, input);

      expect(result.success).toBe(false);
    });
  });
});

describe('수업 관련 스키마', () => {
  describe('createClassInputSchema', () => {
    it('유효한 수업 정보를 검증한다', () => {
      const input = {
        name: '수학 기초반',
        day_of_week: 'monday',
        start_time: '14:00',
        end_time: '16:00',
      };

      const result = validateInput(createClassInputSchema, input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.capacity).toBe(20); // 기본값
        expect(result.data.color).toBe('#3b82f6'); // 기본값
      }
    });

    it('잘못된 시간 형식을 거부한다', () => {
      const input = {
        name: '수학 기초반',
        day_of_week: 'monday',
        start_time: '2:00 PM',
        end_time: '16:00',
      };

      const result = validateInput(createClassInputSchema, input);

      expect(result.success).toBe(false);
    });

    it('잘못된 요일을 거부한다', () => {
      const input = {
        name: '수학 기초반',
        day_of_week: 'funday',
        start_time: '14:00',
        end_time: '16:00',
      };

      const result = validateInput(createClassInputSchema, input);

      expect(result.success).toBe(false);
    });
  });
});

describe('태그 관련 스키마', () => {
  describe('createTagInputSchema', () => {
    it('유효한 태그 정보를 검증한다', () => {
      const input = {
        name: '신규',
      };

      const result = validateInput(createTagInputSchema, input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBe('#6366f1'); // 기본값
        expect(result.data.entity_type).toBe('student'); // 기본값
      }
    });

    it('잘못된 색상 형식을 거부한다', () => {
      const input = {
        name: '신규',
        color: 'red', // #RRGGBB 형식이 아님
      };

      const result = validateInput(createTagInputSchema, input);

      expect(result.success).toBe(false);
    });

    it('빈 태그 이름을 거부한다', () => {
      const input = {
        name: '',
      };

      const result = validateInput(createTagInputSchema, input);

      expect(result.success).toBe(false);
    });
  });
});
