/**
 * AcademyService Extended Unit Tests
 *
 * Covers uncovered facade methods that delegate to domain instances:
 * - getStudent, updateStudent, bulkCreateStudents
 * - getStudentTags, getStudentClasses, getAllStudentClasses
 * - getStudentClassesPaged, updateStudentClassEnrolledAt
 * - createConsultation, updateConsultation, deleteConsultation
 * - generateConsultationAISummary
 * - updateGuardian, deleteGuardian, createGuardians
 * - getStudentsPaged, restoreDeletedStudent, getConsultationsPaged
 * - getClass, updateClass, deleteClass, getClassStatistics
 * - getTeachers, getTeacher, createTeacher, updateTeacher, deleteTeacher
 * - assignTeacher, unassignTeacher, getClassTeachers
 * - enrollStudentToClass, unenrollStudentFromClass
 * - createAttendanceLog, getAttendanceLogsByStudent, getAttendanceLogsByClass
 * - deleteAttendanceLog
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Supabase chain mock
function createChainMock(resolvedData: unknown = [], resolvedError: unknown = null, resolvedCount?: number) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in',
    'is', 'gte', 'lte', 'gt', 'lt', 'order', 'limit', 'range',
    'ilike', 'or', 'not', 'contains', 'filter', 'textSearch',
    'maybeSingle', 'csv', 'match', 'like'];

  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }

  chain.single = vi.fn(() => ({ data: resolvedData, error: resolvedError, count: resolvedCount }));

  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: unknown) => void) => {
      resolve({ data: resolvedData, error: resolvedError, count: resolvedCount });
    },
  });

  return chain;
}

const {
  mockFrom, mockRpc, mockFunctionsInvoke,
  mockTagsServiceGetTags, mockTagsServiceAssignTags, mockTagsServiceGetEntityTags,
  mockPartyServiceCreatePerson, mockPartyServiceDeletePerson, mockPartyServiceUpdatePerson,
  mockConfigServiceGetConfig, mockNotificationServiceCreateNotification,
  mockRecordEvent, mockRecordUsage,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockFunctionsInvoke: vi.fn(),
  mockTagsServiceGetTags: vi.fn(),
  mockTagsServiceAssignTags: vi.fn(),
  mockTagsServiceGetEntityTags: vi.fn(),
  mockPartyServiceCreatePerson: vi.fn(),
  mockPartyServiceDeletePerson: vi.fn(),
  mockPartyServiceUpdatePerson: vi.fn(),
  mockConfigServiceGetConfig: vi.fn(),
  mockNotificationServiceCreateNotification: vi.fn(),
  mockRecordEvent: vi.fn(),
  mockRecordUsage: vi.fn(),
}));

vi.mock('@lib/supabase-client/server', () => ({
  createServerClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
    functions: { invoke: mockFunctionsInvoke },
  }),
}));

vi.mock('@lib/supabase-client', () => ({
  createClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
    functions: { invoke: mockFunctionsInvoke },
  }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

vi.mock('@core/pii-utils', () => ({
  maskPII: (val: unknown) => val,
}));

vi.mock('@lib/date-utils', () => ({
  toKST: (date?: string) => ({
    format: (fmt?: string) => date ? '03/05 10:00' : '2026-03-05',
  }),
  toKSTDate: (d: Date) => d.toISOString().split('T')[0],
  toKSTMonth: () => '2026-03',
}));

vi.mock('@core/tags/service', () => ({
  tagsService: {
    getTags: (...args: unknown[]) => mockTagsServiceGetTags(...args),
    assignTags: (...args: unknown[]) => mockTagsServiceAssignTags(...args),
    getEntityTags: (...args: unknown[]) => mockTagsServiceGetEntityTags(...args),
  },
}));

vi.mock('@core/party/service', () => ({
  partyService: {
    createPerson: (...args: unknown[]) => mockPartyServiceCreatePerson(...args),
    deletePerson: (...args: unknown[]) => mockPartyServiceDeletePerson(...args),
    updatePerson: (...args: unknown[]) => mockPartyServiceUpdatePerson(...args),
  },
}));

vi.mock('@core/config/service', () => ({
  configService: {
    getConfig: (...args: unknown[]) => mockConfigServiceGetConfig(...args),
  },
}));

vi.mock('@core/notification/service', () => ({
  notificationService: {
    createNotification: (...args: unknown[]) => mockNotificationServiceCreateNotification(...args),
  },
}));

vi.mock('@core/analytics/service', () => ({
  analyticsService: {
    recordEvent: (...args: unknown[]) => mockRecordEvent(...args),
  },
}));

vi.mock('@core/metering/service', () => ({
  meteringService: {
    recordUsage: (...args: unknown[]) => mockRecordUsage(...args),
  },
}));

vi.mock('../student-transforms', () => ({
  extractAcademyData: (data: unknown) => {
    if (Array.isArray(data)) return data[0] || null;
    return data;
  },
  mapPersonToStudent: (person: Record<string, unknown>, academyData: Record<string, unknown> | null) => ({
    id: person.id,
    tenant_id: person.tenant_id,
    name: person.name,
    status: academyData?.status || 'active',
    deleted_at: academyData?.deleted_at || null,
    ...(academyData || {}),
  }),
}));

import { AcademyService } from '../service';

const TENANT_ID = 'test-tenant-id';
const MOCK_USER_ID = 'test-user-id';

describe('AcademyService (extended)', () => {
  let service: AcademyService;

  beforeEach(() => {
    service = new AcademyService();
    vi.clearAllMocks();
  });

  // ==================== Student methods ====================

  describe('getStudent', () => {
    it('delegates to studentDomain.getStudent', async () => {
      const personData = {
        id: 'p1', tenant_id: TENANT_ID, name: 'S1',
        academy_students: { status: 'active', deleted_at: null },
      };
      const chain = createChainMock(personData);
      mockFrom.mockReturnValue(chain);

      const result = await service.getStudent(TENANT_ID, 'p1');

      expect(result).toBeDefined();
      expect(result?.name).toBe('S1');
    });
  });

  describe('updateStudent', () => {
    it('delegates to studentDomain.updateStudent', async () => {
      mockPartyServiceUpdatePerson.mockResolvedValue(undefined);

      const getChain = createChainMock({
        id: 'p1', tenant_id: TENANT_ID, name: 'Updated',
        academy_students: { status: 'active', deleted_at: null },
      });
      mockFrom.mockReturnValue(getChain);

      const result = await service.updateStudent(TENANT_ID, 'p1', { name: 'Updated' });

      expect(result).toBeDefined();
      expect(mockPartyServiceUpdatePerson).toHaveBeenCalled();
    });
  });

  describe('bulkCreateStudents', () => {
    it('delegates to studentDomain.bulkCreateStudents', async () => {
      const person = { id: 'p1', tenant_id: TENANT_ID, name: 'S1', person_type: 'student' };
      mockPartyServiceCreatePerson.mockResolvedValue(person);

      const chain = createChainMock({ person_id: 'p1', status: 'active' });
      mockFrom.mockReturnValue(chain);

      const result = await service.bulkCreateStudents(TENANT_ID, 'academy', [{ name: 'S1' }]);

      expect(result).toHaveLength(1);
    });
  });

  describe('getStudentTags', () => {
    it('delegates to studentDomain.getStudentTags', async () => {
      mockTagsServiceGetEntityTags.mockResolvedValue([{ id: 't1', name: 'VIP' }]);

      const result = await service.getStudentTags(TENANT_ID, 'p1');

      expect(mockTagsServiceGetEntityTags).toHaveBeenCalledWith(TENANT_ID, 'p1', 'student');
      expect(result).toHaveLength(1);
    });
  });

  describe('updateGuardian', () => {
    it('delegates to studentDomain.updateGuardian', async () => {
      const chain = createChainMock({ id: 'g1', name: 'Updated' });
      mockFrom.mockReturnValue(chain);

      const result = await service.updateGuardian(TENANT_ID, 'g1', { name: 'Updated' });

      expect(result).toBeDefined();
    });
  });

  describe('deleteGuardian', () => {
    it('delegates to studentDomain.deleteGuardian', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await service.deleteGuardian(TENANT_ID, 'g1');

      expect(mockFrom).toHaveBeenCalledWith('guardians');
    });
  });

  describe('createConsultation', () => {
    it('delegates to studentDomain.createConsultation', async () => {
      const chain = createChainMock({ id: 'con1', content: 'Test' });
      mockFrom.mockReturnValue(chain);

      const result = await service.createConsultation(
        TENANT_ID, 'p1',
        { consultation_date: '2026-03-05', consultation_type: 'counseling', content: 'Test', created_by: MOCK_USER_ID },
        MOCK_USER_ID
      );

      expect(result).toBeDefined();
    });
  });

  describe('updateConsultation', () => {
    it('delegates to studentDomain.updateConsultation', async () => {
      const chain = createChainMock({ id: 'con1', content: 'Updated' });
      mockFrom.mockReturnValue(chain);

      const result = await service.updateConsultation(TENANT_ID, 'con1', { content: 'Updated' });

      expect(result).toBeDefined();
    });
  });

  describe('deleteConsultation', () => {
    it('delegates to studentDomain.deleteConsultation', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await service.deleteConsultation(TENANT_ID, 'con1');

      expect(mockFrom).toHaveBeenCalledWith('student_consultations');
    });
  });

  describe('generateConsultationAISummary', () => {
    it('delegates to studentDomain.generateConsultationAISummary', async () => {
      const consultationChain = createChainMock({ id: 'con1', content: 'Content' });
      mockFrom.mockReturnValue(consultationChain);
      mockFunctionsInvoke.mockResolvedValue({ data: { ai_summary: 'Summary' }, error: null });

      const result = await service.generateConsultationAISummary(TENANT_ID, 'con1');

      expect(result).toBe('Summary');
    });
  });

  describe('getStudentsPaged', () => {
    it('delegates to studentDomain.getStudentsPaged', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      const result = await service.getStudentsPaged(TENANT_ID, undefined, 1, 20);

      expect(result.students).toEqual([]);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('getConsultationsPaged', () => {
    it('delegates to studentDomain.getConsultationsPaged', async () => {
      const chain = createChainMock([], null, 0);
      mockFrom.mockReturnValue(chain);

      const result = await service.getConsultationsPaged(TENANT_ID, { page: 1 });

      expect(result.consultations).toEqual([]);
    });
  });

  // ==================== Class methods ====================

  describe('getClass', () => {
    it('delegates to classDomain.getClass', async () => {
      const chain = createChainMock({ id: 'c1', name: 'Math' });
      mockFrom.mockReturnValue(chain);

      const result = await service.getClass(TENANT_ID, 'c1');

      expect(result).toBeDefined();
    });
  });

  describe('updateClass', () => {
    it('delegates to classDomain.updateClass', async () => {
      const chain = createChainMock({ id: 'c1', name: 'Updated Math' });
      mockFrom.mockReturnValue(chain);

      const result = await service.updateClass(TENANT_ID, 'c1', { name: 'Updated Math' });

      expect(result).toBeDefined();
    });
  });

  describe('deleteClass', () => {
    it('delegates to classDomain.deleteClass', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await service.deleteClass(TENANT_ID, 'c1');

      expect(mockFrom).toHaveBeenCalledWith('academy_classes');
    });
  });

  describe('getClassStatistics', () => {
    it('delegates to classDomain.getClassStatistics', async () => {
      const chain = createChainMock({ id: 'c1', current_count: 10, capacity: 20 });
      mockFrom.mockReturnValue(chain);

      const result = await service.getClassStatistics(TENANT_ID, 'c1');

      expect(result).toBeDefined();
      expect(result.capacity_rate).toBe(50);
    });
  });

  // ==================== Teacher methods ====================

  describe('getTeachers', () => {
    it('delegates to teacherDomain.getTeachers', async () => {
      const personsData = [
        { id: 'p1', tenant_id: TENANT_ID, name: 'Teacher1', person_type: 'teacher', academy_teachers: [{ status: 'active' }] },
      ];
      const chain = createChainMock(personsData);
      mockFrom.mockReturnValue(chain);

      const result = await service.getTeachers(TENANT_ID);

      expect(result).toHaveLength(1);
    });
  });

  describe('getTeacher', () => {
    it('delegates to teacherDomain.getTeacher', async () => {
      const chain = createChainMock({
        id: 'p1', tenant_id: TENANT_ID, name: 'Teacher1',
        academy_teachers: [{ status: 'active' }],
      });
      mockFrom.mockReturnValue(chain);

      const result = await service.getTeacher(TENANT_ID, 'p1');

      expect(result).toBeDefined();
    });
  });

  describe('createTeacher', () => {
    it('delegates to teacherDomain.createTeacher', async () => {
      const person = { id: 'p-new', tenant_id: TENANT_ID, name: 'NewTeacher', person_type: 'teacher', created_at: '', updated_at: '' };
      mockPartyServiceCreatePerson.mockResolvedValue(person);

      const chain = createChainMock({ person_id: 'p-new', status: 'active' });
      mockFrom.mockReturnValue(chain);

      const result = await service.createTeacher(TENANT_ID, { name: 'NewTeacher', position: 'teacher' });

      expect(result).toBeDefined();
    });
  });

  describe('updateTeacher', () => {
    it('delegates to teacherDomain.updateTeacher', async () => {
      // persons UPDATE (phone is a person field)
      const personChain = createChainMock(null);
      // academy_teachers UPDATE (specialization is a teacher field)
      const teacherChain = createChainMock(null);
      // getTeacher query (persons + academy_teachers join)
      const getChain = createChainMock({
        id: 'p1', tenant_id: TENANT_ID, name: 'Updated',
        academy_teachers: [{ status: 'active', specialization: 'Math' }],
      });

      mockFrom
        .mockReturnValueOnce(personChain)
        .mockReturnValueOnce(teacherChain)
        .mockReturnValueOnce(getChain);

      // Pass both person field (phone) and teacher field (specialization) to trigger both updates
      const result = await service.updateTeacher(TENANT_ID, 'p1', {
        phone: '010-1111',
        specialization: 'Math',
      });

      expect(result).toBeDefined();
    });
  });

  describe('deleteTeacher', () => {
    it('delegates to teacherDomain.deleteTeacher', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await service.deleteTeacher(TENANT_ID, 'p1');

      expect(mockFrom).toHaveBeenCalledWith('academy_teachers');
    });
  });

  // ==================== Class-Teacher methods ====================

  describe('assignTeacher', () => {
    it('delegates to classDomain.assignTeacher', async () => {
      const chain = createChainMock({ class_id: 'c1', teacher_id: 't1' });
      mockFrom.mockReturnValue(chain);

      const result = await service.assignTeacher(TENANT_ID, {
        class_id: 'c1', teacher_id: 't1', role: 'teacher',
      });

      expect(result).toBeDefined();
    });
  });

  describe('unassignTeacher', () => {
    it('delegates to classDomain.unassignTeacher', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await service.unassignTeacher(TENANT_ID, 'c1', 't1');

      expect(mockFrom).toHaveBeenCalledWith('class_teachers');
    });
  });

  describe('getClassTeachers', () => {
    it('delegates to classDomain.getClassTeachers', async () => {
      const chain = createChainMock([{ class_id: 'c1', teacher_id: 't1' }]);
      mockFrom.mockReturnValue(chain);

      const result = await service.getClassTeachers(TENANT_ID, 'c1');

      expect(result).toHaveLength(1);
    });
  });

  // ==================== Enrollment methods ====================

  describe('enrollStudentToClass', () => {
    it('delegates to enrollmentDomain.enrollStudentToClass', async () => {
      const insertChain = createChainMock({ id: 'sc1', student_id: 's1', class_id: 'c1' });
      const countChain = createChainMock(null, null, 5);
      const updateChain = createChainMock(null);
      // getClass for class_name update
      const getClassChain = createChainMock({ id: 'c1', name: 'Math' });
      // academy_students class_name update
      const classNameChain = createChainMock(null);

      mockFrom
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(getClassChain) // classDomain.getClass
        .mockReturnValueOnce(classNameChain); // class_name update

      const result = await service.enrollStudentToClass(TENANT_ID, 's1', 'c1');

      expect(result).toBeDefined();
    });
  });

  describe('unenrollStudentFromClass', () => {
    it('delegates to enrollmentDomain.unenrollStudentFromClass', async () => {
      const findChain = createChainMock({ id: 'sc1' });
      const deactivateChain = createChainMock(null);
      const countChain = createChainMock(null, null, 0);
      const updateCountChain = createChainMock(null);
      const remainingChain = createChainMock([]);
      const classNameChain = createChainMock(null);

      mockFrom
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(deactivateChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateCountChain)
        .mockReturnValueOnce(remainingChain)
        .mockReturnValueOnce(classNameChain);

      await service.unenrollStudentFromClass(TENANT_ID, 's1', 'c1');

      // If no error thrown, delegation was successful
    });
  });

  describe('getStudentClasses', () => {
    it('delegates to enrollmentDomain.getStudentClasses', async () => {
      const scChain = createChainMock([{ id: 'sc1', class_id: 'c1' }]);
      const clsChain = createChainMock([{ id: 'c1', name: 'Math' }]);

      mockFrom
        .mockReturnValueOnce(scChain)
        .mockReturnValueOnce(clsChain);

      const result = await service.getStudentClasses(TENANT_ID, 's1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getAllStudentClasses', () => {
    it('delegates to enrollmentDomain.getAllStudentClasses', async () => {
      const chain = createChainMock([{ id: 'sc1' }]);
      mockFrom.mockReturnValue(chain);

      const result = await service.getAllStudentClasses(TENANT_ID);

      expect(result).toHaveLength(1);
    });
  });

  describe('getStudentClassesPaged', () => {
    it('delegates to enrollmentDomain.getStudentClassesPaged', async () => {
      const chain = createChainMock([], null, 0);
      mockFrom.mockReturnValue(chain);

      const result = await service.getStudentClassesPaged(TENANT_ID, { page: 1, pageSize: 10 });

      expect(result.studentClasses).toEqual([]);
    });
  });

  describe('updateStudentClassEnrolledAt', () => {
    it('delegates to enrollmentDomain.updateStudentClassEnrolledAt', async () => {
      const chain = createChainMock({ id: 'sc1', enrolled_at: '2026-06-01' });
      mockFrom.mockReturnValue(chain);

      const result = await service.updateStudentClassEnrolledAt(TENANT_ID, 'sc1', '2026-06-01');

      expect(result).toBeDefined();
    });
  });

  // ==================== Attendance methods ====================

  describe('getAttendanceLogsByStudent', () => {
    it('delegates to attendanceDomain.getAttendanceLogsByStudent', async () => {
      const chain = createChainMock([{ id: 'log1' }]);
      mockFrom.mockReturnValue(chain);

      const result = await service.getAttendanceLogsByStudent(TENANT_ID, 's1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getAttendanceLogsByClass', () => {
    it('delegates to attendanceDomain.getAttendanceLogsByClass', async () => {
      const chain = createChainMock([{ id: 'log1' }]);
      mockFrom.mockReturnValue(chain);

      const result = await service.getAttendanceLogsByClass(TENANT_ID, 'c1');

      expect(result).toHaveLength(1);
    });
  });

  describe('deleteAttendanceLog', () => {
    it('delegates to attendanceDomain.deleteAttendanceLog', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await service.deleteAttendanceLog(TENANT_ID, 'log1');

      expect(mockFrom).toHaveBeenCalledWith('attendance_logs');
    });
  });

  describe('createAttendanceLog', () => {
    it('creates attendance log and records analytics', async () => {
      const insertChain = createChainMock({ id: 'log1', student_id: 's1', class_id: 'c1', tenant_id: TENANT_ID });
      const tenantsChain = createChainMock({ industry_type: 'academy' });
      const storesChain = createChainMock([{ id: 'store1', region_id: 'r1', industry_type: 'academy' }]);

      mockFrom
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(tenantsChain)
        .mockReturnValueOnce(storesChain);

      mockConfigServiceGetConfig.mockResolvedValue({ attendance: { auto_notification: false } });
      mockRecordEvent.mockResolvedValue(undefined);
      mockRecordUsage.mockResolvedValue(undefined);

      const result = await service.createAttendanceLog(TENANT_ID, {
        student_id: 's1',
        class_id: 'c1',
        occurred_at: '2026-03-05T10:00:00+09:00',
        attendance_type: 'check_in',
        status: 'present',
      }, MOCK_USER_ID);

      expect(result).toBeDefined();
    });
  });

  // ==================== getConsultations / getGuardians ====================

  describe('getConsultations', () => {
    it('delegates to studentDomain.getConsultations', async () => {
      const chain = createChainMock([{ id: 'con1' }]);
      mockFrom.mockReturnValue(chain);

      const result = await service.getConsultations(TENANT_ID, 'p1');

      expect(result).toHaveLength(1);
    });
  });

  describe('createGuardians', () => {
    it('delegates to studentDomain.createGuardians', async () => {
      const chain = createChainMock([{ id: 'g1', name: 'Mom' }]);
      mockFrom.mockReturnValue(chain);

      const result = await service.createGuardians(TENANT_ID, 'p1', [
        { name: 'Mom', relationship: 'parent', phone: '010-1111', is_primary: true },
      ]);

      expect(result).toHaveLength(1);
    });
  });
});
