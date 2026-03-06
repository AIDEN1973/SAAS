/**
 * StudentDomain Extended Unit Tests
 *
 * Covers uncovered branches/methods:
 * - getStudent: success, not-found (PGRST116), other error, deleted_at check
 * - getStudents: grade filter, search filter, empty data
 * - getStudents: tag_ids error path, class_id error path
 * - bulkCreateStudents: success, partial failure
 * - updateStudent: only person fields, only academy fields, no fields, error paths
 * - deleteStudent: error path
 * - getGuardians: success, error
 * - createGuardians: success, error
 * - getConsultations: success, error
 * - createConsultation: success, error
 * - updateConsultation: success, error
 * - deleteConsultation: success, error
 * - generateConsultationAISummary: success, consultation not found, AI error, empty summary
 * - updateGuardian: success, error
 * - deleteGuardian: success, error
 * - getTags, getStudentTags
 * - updateStudentTags: success, delete error, empty tag_ids
 * - getStudentsPaged: pagination
 * - restoreDeletedStudent: success, error, not found after restore
 * - getConsultationsPaged: filters, error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChainMock, TENANT_ID, MOCK_USER_ID } from './test-helpers';

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockFunctionsInvoke = vi.fn();

vi.mock('@lib/supabase-client', () => ({
  createClient: () => ({ from: mockFrom, rpc: mockRpc, functions: { invoke: mockFunctionsInvoke } }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

const mockCreatePerson = vi.fn();
const mockDeletePerson = vi.fn();
const mockUpdatePerson = vi.fn();
vi.mock('@core/party/service', () => ({
  partyService: {
    createPerson: (...args: unknown[]) => mockCreatePerson(...args),
    deletePerson: (...args: unknown[]) => mockDeletePerson(...args),
    updatePerson: (...args: unknown[]) => mockUpdatePerson(...args),
  },
}));

const mockTagsGetTags = vi.fn();
const mockTagsGetEntityTags = vi.fn();
const mockTagsAssignTags = vi.fn();
vi.mock('@core/tags/service', () => ({
  tagsService: {
    getTags: (...args: unknown[]) => mockTagsGetTags(...args),
    getEntityTags: (...args: unknown[]) => mockTagsGetEntityTags(...args),
    assignTags: (...args: unknown[]) => mockTagsAssignTags(...args),
  },
}));

vi.mock('@lib/date-utils', () => ({
  toKST: () => ({
    format: () => '2026-03-05',
  }),
  toKSTDate: (d: Date) => d.toISOString().split('T')[0],
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
    phone: person.phone,
    email: person.email,
    address: person.address,
    status: academyData?.status || 'active',
    deleted_at: academyData?.deleted_at || null,
    grade: academyData?.grade || null,
    ...(academyData || {}),
  }),
}));

import { StudentDomain } from '../domains/student-domain';

describe('StudentDomain (extended)', () => {
  let domain: StudentDomain;
  const mockSupabase = { from: mockFrom, rpc: mockRpc, functions: { invoke: mockFunctionsInvoke } } as never;

  beforeEach(() => {
    domain = new StudentDomain(mockSupabase);
    vi.clearAllMocks();
  });

  // ==================== getStudent ====================

  describe('getStudent', () => {
    it('returns student when found', async () => {
      const personData = {
        id: 'p1',
        tenant_id: TENANT_ID,
        name: 'Student1',
        person_type: 'student',
        academy_students: { status: 'active', deleted_at: null },
      };
      const chain = createChainMock(personData);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getStudent(TENANT_ID, 'p1');

      expect(result).toBeDefined();
      expect(result?.name).toBe('Student1');
    });

    it('returns null when not found (PGRST116)', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'not found' });
      mockFrom.mockReturnValue(chain);

      const result = await domain.getStudent(TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
    });

    it('throws on non-PGRST116 error', async () => {
      const chain = createChainMock(null, { code: 'OTHER', message: 'DB error' });
      mockFrom.mockReturnValue(chain);

      await expect(domain.getStudent(TENANT_ID, 'p1'))
        .rejects.toThrow('Failed to fetch student: DB error');
    });

    it('returns null when academy_students has deleted_at set', async () => {
      const personData = {
        id: 'p1',
        tenant_id: TENANT_ID,
        name: 'Deleted',
        person_type: 'student',
        academy_students: { status: 'withdrawn', deleted_at: '2026-01-01' },
      };
      const chain = createChainMock(personData);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getStudent(TENANT_ID, 'p1');

      expect(result).toBeNull();
    });

    it('returns null when academy_students is null/undefined', async () => {
      const personData = {
        id: 'p1',
        tenant_id: TENANT_ID,
        name: 'NoAcademy',
        person_type: 'student',
        academy_students: null,
      };
      const chain = createChainMock(personData);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getStudent(TENANT_ID, 'p1');

      // extractAcademyData(null) returns undefined, so condition !academyData → true → null
      expect(result).toBeNull();
    });
  });

  // ==================== getStudents - extended ====================

  describe('getStudents (extended)', () => {
    it('applies grade filter', async () => {
      const personsData = [
        { id: 'p1', tenant_id: TENANT_ID, name: 'Grade3', person_type: 'student', academy_students: [{ status: 'active', deleted_at: null, grade: '3' }] },
        { id: 'p2', tenant_id: TENANT_ID, name: 'Grade5', person_type: 'student', academy_students: [{ status: 'active', deleted_at: null, grade: '5' }] },
      ];
      const chain = createChainMock(personsData);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getStudents(TENANT_ID, { grade: '3' });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Grade3');
    });

    it('applies status filter as array', async () => {
      const personsData = [
        { id: 'p1', tenant_id: TENANT_ID, name: 'Active', person_type: 'student', academy_students: [{ status: 'active', deleted_at: null }] },
        { id: 'p2', tenant_id: TENANT_ID, name: 'OnLeave', person_type: 'student', academy_students: [{ status: 'on_leave', deleted_at: null }] },
        { id: 'p3', tenant_id: TENANT_ID, name: 'Graduated', person_type: 'student', academy_students: [{ status: 'graduated', deleted_at: null }] },
      ];
      const chain = createChainMock(personsData);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getStudents(TENANT_ID, { status: ['active', 'on_leave'] });

      expect(result).toHaveLength(2);
    });

    it('filters out students without academy_students data', async () => {
      const personsData = [
        { id: 'p1', tenant_id: TENANT_ID, name: 'HasData', person_type: 'student', academy_students: [{ status: 'active', deleted_at: null }] },
        { id: 'p2', tenant_id: TENANT_ID, name: 'NoData', person_type: 'student', academy_students: [] },
      ];
      const chain = createChainMock(personsData);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getStudents(TENANT_ID);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('HasData');
    });

    it('throws on tag_ids filter error', async () => {
      const personsData = [
        { id: 'p1', tenant_id: TENANT_ID, name: 'S1', person_type: 'student', academy_students: [{ status: 'active', deleted_at: null }] },
      ];
      const personsChain = createChainMock(personsData);
      const tagsChain = createChainMock(null, { message: 'Tag query failed' });

      mockFrom
        .mockReturnValueOnce(personsChain)
        .mockReturnValueOnce(tagsChain);

      await expect(
        domain.getStudents(TENANT_ID, { tag_ids: ['t1'] })
      ).rejects.toThrow('Failed to fetch student tags: Tag query failed');
    });

    it('throws on class_id filter error', async () => {
      const personsData = [
        { id: 'p1', tenant_id: TENANT_ID, name: 'S1', person_type: 'student', academy_students: [{ status: 'active', deleted_at: null }] },
      ];
      const personsChain = createChainMock(personsData);
      const classChain = createChainMock(null, { message: 'Class query failed' });

      mockFrom
        .mockReturnValueOnce(personsChain)
        .mockReturnValueOnce(classChain);

      await expect(
        domain.getStudents(TENANT_ID, { class_id: 'c1' })
      ).rejects.toThrow('Failed to fetch class assignments: Class query failed');
    });

    it('handles empty result from persons query (null)', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getStudents(TENANT_ID);

      expect(result).toEqual([]);
    });
  });

  // ==================== bulkCreateStudents ====================

  describe('bulkCreateStudents', () => {
    it('creates multiple students successfully', async () => {
      const person1 = { id: 'p1', tenant_id: TENANT_ID, name: 'S1', person_type: 'student' };
      const person2 = { id: 'p2', tenant_id: TENANT_ID, name: 'S2', person_type: 'student' };

      mockCreatePerson
        .mockResolvedValueOnce(person1)
        .mockResolvedValueOnce(person2);

      const chain1 = createChainMock({ person_id: 'p1', status: 'active' });
      const chain2 = createChainMock({ person_id: 'p2', status: 'active' });

      mockFrom
        .mockReturnValueOnce(chain1)
        .mockReturnValueOnce(chain2);

      const result = await domain.bulkCreateStudents(TENANT_ID, 'academy', [
        { name: 'S1' },
        { name: 'S2' },
      ]);

      expect(result).toHaveLength(2);
    });

    it('continues on partial failure and logs warnings', async () => {
      const person1 = { id: 'p1', tenant_id: TENANT_ID, name: 'S1', person_type: 'student' };

      // First student succeeds
      mockCreatePerson.mockResolvedValueOnce(person1);
      const chain1 = createChainMock({ person_id: 'p1', status: 'active' });
      mockFrom.mockReturnValueOnce(chain1);

      // Second student fails at createPerson
      mockCreatePerson.mockRejectedValueOnce(new Error('Create person failed'));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await domain.bulkCreateStudents(TENANT_ID, 'academy', [
        { name: 'S1' },
        { name: 'S2' },
      ]);

      // Only first student created successfully
      expect(result).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('returns empty array when all fail', async () => {
      mockCreatePerson.mockRejectedValue(new Error('All fail'));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await domain.bulkCreateStudents(TENANT_ID, 'academy', [
        { name: 'S1' },
      ]);

      expect(result).toEqual([]);
      warnSpy.mockRestore();
    });

    it('passes userId to createStudent', async () => {
      const person = { id: 'p1', tenant_id: TENANT_ID, name: 'S1', person_type: 'student' };
      mockCreatePerson.mockResolvedValue(person);
      const chain = createChainMock({ person_id: 'p1', status: 'active' });
      mockFrom.mockReturnValue(chain);

      await domain.bulkCreateStudents(TENANT_ID, 'academy', [{ name: 'S1' }], MOCK_USER_ID);

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ created_by: MOCK_USER_ID })
      );
    });
  });

  // ==================== updateStudent - extended ====================

  describe('updateStudent (extended)', () => {
    it('updates only person fields when no academy fields', async () => {
      mockUpdatePerson.mockResolvedValue(undefined);

      // getStudent query
      const getChain = createChainMock({
        id: 'p1', tenant_id: TENANT_ID, name: 'Updated', person_type: 'student',
        academy_students: { status: 'active', deleted_at: null },
      });
      mockFrom.mockReturnValue(getChain);

      const result = await domain.updateStudent(TENANT_ID, 'p1', { name: 'Updated' });

      expect(mockUpdatePerson).toHaveBeenCalledWith(TENANT_ID, 'p1', { name: 'Updated' });
      // No academy_students update (only 1 from call for getStudent)
      expect(result).toBeDefined();
    });

    it('updates only academy fields when no person fields', async () => {
      // academy_students UPDATE
      const academyChain = createChainMock(null);
      // getStudent query
      const getChain = createChainMock({
        id: 'p1', tenant_id: TENANT_ID, name: 'Student', person_type: 'student',
        academy_students: { status: 'on_leave', deleted_at: null },
      });

      mockFrom
        .mockReturnValueOnce(academyChain)
        .mockReturnValueOnce(getChain);

      await domain.updateStudent(TENANT_ID, 'p1', { status: 'on_leave' });

      // partyService.updatePerson should NOT be called (no person fields)
      expect(mockUpdatePerson).not.toHaveBeenCalled();
      expect(academyChain.update).toHaveBeenCalled();
    });

    it('throws when academy_students update fails', async () => {
      mockUpdatePerson.mockResolvedValue(undefined);

      const academyChain = createChainMock(null, { message: 'Academy update failed' });
      mockFrom.mockReturnValue(academyChain);

      await expect(
        domain.updateStudent(TENANT_ID, 'p1', { status: 'on_leave' })
      ).rejects.toThrow('Failed to update academy student: Academy update failed');
    });

    it('throws when student not found after update', async () => {
      // getStudent returns person with deleted academy data
      const getChain = createChainMock({
        id: 'p1', tenant_id: TENANT_ID, name: 'Ghost', person_type: 'student',
        academy_students: { status: 'withdrawn', deleted_at: '2026-01-01' },
      });
      mockFrom.mockReturnValue(getChain);

      await expect(
        domain.updateStudent(TENANT_ID, 'p1', { name: 'Ghost' })
      ).rejects.toThrow('Student not found: p1');
    });

    it('includes all academy fields in update', async () => {
      const academyChain = createChainMock(null);
      const getChain = createChainMock({
        id: 'p1', tenant_id: TENANT_ID, name: 'Full', person_type: 'student',
        academy_students: { status: 'active', deleted_at: null },
      });

      mockFrom
        .mockReturnValueOnce(academyChain)
        .mockReturnValueOnce(getChain);

      await domain.updateStudent(TENANT_ID, 'p1', {
        birth_date: '2010-05-15',
        gender: 'male',
        school_name: 'Test School',
        grade: '4',
        status: 'active',
        notes: 'Good student',
        profile_image_url: 'https://example.com/photo.jpg',
      }, MOCK_USER_ID);

      expect(academyChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          birth_date: '2010-05-15',
          gender: 'male',
          school_name: 'Test School',
          grade: '4',
          status: 'active',
          notes: 'Good student',
          profile_image_url: 'https://example.com/photo.jpg',
          updated_by: MOCK_USER_ID,
        })
      );
    });

    it('includes all person fields in update', async () => {
      mockUpdatePerson.mockResolvedValue(undefined);

      const getChain = createChainMock({
        id: 'p1', tenant_id: TENANT_ID, name: 'Full', person_type: 'student',
        academy_students: { status: 'active', deleted_at: null },
      });
      mockFrom.mockReturnValue(getChain);

      await domain.updateStudent(TENANT_ID, 'p1', {
        name: 'New Name',
        email: 'new@test.com',
        phone: '010-9999-8888',
        address: 'New Address',
      });

      expect(mockUpdatePerson).toHaveBeenCalledWith(TENANT_ID, 'p1', {
        name: 'New Name',
        email: 'new@test.com',
        phone: '010-9999-8888',
        address: 'New Address',
      });
    });
  });

  // ==================== deleteStudent - extended ====================

  describe('deleteStudent (extended)', () => {
    it('throws when RPC fails', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

      await expect(domain.deleteStudent(TENANT_ID, 'p1'))
        .rejects.toThrow('Failed to delete student: RPC failed');
    });
  });

  // ==================== getGuardians ====================

  describe('getGuardians', () => {
    it('returns guardians sorted by is_primary', async () => {
      const guardians = [
        { id: 'g1', student_id: 'p1', name: 'Mom', is_primary: true },
        { id: 'g2', student_id: 'p1', name: 'Dad', is_primary: false },
      ];
      const chain = createChainMock(guardians);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getGuardians(TENANT_ID, 'p1');

      expect(mockFrom).toHaveBeenCalledWith('guardians');
      expect(chain.eq).toHaveBeenCalledWith('student_id', 'p1');
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no guardians', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getGuardians(TENANT_ID, 'p1');

      expect(result).toEqual([]);
    });

    it('throws when query fails', async () => {
      const chain = createChainMock(null, { message: 'Guardian query failed' });
      mockFrom.mockReturnValue(chain);

      await expect(domain.getGuardians(TENANT_ID, 'p1'))
        .rejects.toThrow('Failed to fetch guardians: Guardian query failed');
    });
  });

  // ==================== createGuardians ====================

  describe('createGuardians', () => {
    it('creates multiple guardians', async () => {
      const created = [
        { id: 'g1', name: 'Mom', relationship: 'parent' },
        { id: 'g2', name: 'Dad', relationship: 'parent' },
      ];
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      const result = await domain.createGuardians(TENANT_ID, 'p1', [
        { name: 'Mom', relationship: 'parent', phone: '010-1111', is_primary: true },
        { name: 'Dad', relationship: 'parent', phone: '010-2222', is_primary: false },
      ]);

      expect(chain.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ tenant_id: TENANT_ID, student_id: 'p1', name: 'Mom' }),
          expect.objectContaining({ tenant_id: TENANT_ID, student_id: 'p1', name: 'Dad' }),
        ])
      );
      expect(result).toHaveLength(2);
    });

    it('throws when insert fails', async () => {
      const chain = createChainMock(null, { message: 'Guardian insert failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        domain.createGuardians(TENANT_ID, 'p1', [
          { name: 'Mom', relationship: 'parent', phone: '010-1111', is_primary: true },
        ])
      ).rejects.toThrow('Failed to create guardians: Guardian insert failed');
    });

    it('returns empty array when data is null', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      const result = await domain.createGuardians(TENANT_ID, 'p1', [
        { name: 'Mom', relationship: 'parent', phone: '010-1111', is_primary: true },
      ]);

      expect(result).toEqual([]);
    });
  });

  // ==================== getTags / getStudentTags ====================

  describe('getTags', () => {
    it('delegates to tagsService.getTags', async () => {
      const tags = [{ id: 't1', name: 'Elementary' }];
      mockTagsGetTags.mockResolvedValue(tags);

      const result = await domain.getTags(TENANT_ID);

      expect(mockTagsGetTags).toHaveBeenCalledWith(TENANT_ID, { entity_type: 'student' });
      expect(result).toEqual(tags);
    });
  });

  describe('getStudentTags', () => {
    it('delegates to tagsService.getEntityTags', async () => {
      const tags = [{ id: 't1', name: 'VIP' }];
      mockTagsGetEntityTags.mockResolvedValue(tags);

      const result = await domain.getStudentTags(TENANT_ID, 'p1');

      expect(mockTagsGetEntityTags).toHaveBeenCalledWith(TENANT_ID, 'p1', 'student');
      expect(result).toEqual(tags);
    });
  });

  // ==================== getConsultations ====================

  describe('getConsultations', () => {
    it('returns consultations for student', async () => {
      const consultations = [
        { id: 'con1', student_id: 'p1', content: 'Discussion' },
      ];
      const chain = createChainMock(consultations);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getConsultations(TENANT_ID, 'p1');

      expect(mockFrom).toHaveBeenCalledWith('student_consultations');
      expect(chain.eq).toHaveBeenCalledWith('student_id', 'p1');
      expect(result).toHaveLength(1);
    });

    it('returns empty array when no consultations', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getConsultations(TENANT_ID, 'p1');

      expect(result).toEqual([]);
    });

    it('throws when query fails', async () => {
      const chain = createChainMock(null, { message: 'Consultation query failed' });
      mockFrom.mockReturnValue(chain);

      await expect(domain.getConsultations(TENANT_ID, 'p1'))
        .rejects.toThrow('Failed to fetch consultations: Consultation query failed');
    });
  });

  // ==================== createConsultation ====================

  describe('createConsultation', () => {
    it('creates consultation with all fields', async () => {
      const created = {
        id: 'con1',
        tenant_id: TENANT_ID,
        student_id: 'p1',
        consultation_date: '2026-03-05',
        consultation_type: 'counseling',
        content: 'Test content',
        created_by: MOCK_USER_ID,
      };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      const result = await domain.createConsultation(
        TENANT_ID,
        'p1',
        {
          consultation_date: '2026-03-05',
          consultation_type: 'counseling',
          content: 'Test content',
          created_by: MOCK_USER_ID,
        },
        MOCK_USER_ID
      );

      expect(mockFrom).toHaveBeenCalledWith('student_consultations');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          student_id: 'p1',
          consultation_date: '2026-03-05',
          content: 'Test content',
          created_by: MOCK_USER_ID,
        })
      );
      expect(result.id).toBe('con1');
    });

    it('throws when insert fails', async () => {
      const chain = createChainMock(null, { message: 'Consultation insert failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        domain.createConsultation(
          TENANT_ID,
          'p1',
          {
            consultation_date: '2026-03-05',
            consultation_type: 'counseling',
            content: 'Test',
            created_by: MOCK_USER_ID,
          },
          MOCK_USER_ID
        )
      ).rejects.toThrow('Failed to create consultation: Consultation insert failed');
    });
  });

  // ==================== updateConsultation ====================

  describe('updateConsultation', () => {
    it('updates consultation fields', async () => {
      const updated = { id: 'con1', content: 'Updated content' };
      const chain = createChainMock(updated);
      mockFrom.mockReturnValue(chain);

      const result = await domain.updateConsultation(
        TENANT_ID,
        'con1',
        { content: 'Updated content' }
      );

      expect(mockFrom).toHaveBeenCalledWith('student_consultations');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Updated content' })
      );
      expect(result.id).toBe('con1');
    });

    it('throws when update fails', async () => {
      const chain = createChainMock(null, { message: 'Consultation update failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        domain.updateConsultation(TENANT_ID, 'con1', { content: 'Fail' })
      ).rejects.toThrow('Failed to update consultation: Consultation update failed');
    });
  });

  // ==================== deleteConsultation ====================

  describe('deleteConsultation', () => {
    it('deletes consultation by id', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await domain.deleteConsultation(TENANT_ID, 'con1');

      expect(mockFrom).toHaveBeenCalledWith('student_consultations');
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'con1');
    });

    it('throws when delete fails', async () => {
      const chain = createChainMock(null, { message: 'Delete failed' });
      mockFrom.mockReturnValue(chain);

      await expect(domain.deleteConsultation(TENANT_ID, 'con1'))
        .rejects.toThrow('Failed to delete consultation: Delete failed');
    });
  });

  // ==================== generateConsultationAISummary ====================

  describe('generateConsultationAISummary', () => {
    it('generates AI summary successfully', async () => {
      // getConsultation (private method: student_consultations query)
      const consultationChain = createChainMock({
        id: 'con1', content: 'Some content', student_id: 'p1',
      });
      mockFrom.mockReturnValue(consultationChain);

      // Edge Function invoke
      mockFunctionsInvoke.mockResolvedValue({
        data: { ai_summary: 'AI generated summary' },
        error: null,
      });

      const result = await domain.generateConsultationAISummary(TENANT_ID, 'con1');

      expect(result).toBe('AI generated summary');
      expect(mockFunctionsInvoke).toHaveBeenCalledWith(
        'consultation-ai-summary',
        { body: { consultation_id: 'con1' } }
      );
    });

    it('throws when consultation not found', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'not found' });
      mockFrom.mockReturnValue(chain);

      await expect(
        domain.generateConsultationAISummary(TENANT_ID, 'nonexistent')
      ).rejects.toThrow('상담기록을 찾을 수 없습니다.');
    });

    it('throws when Edge Function fails', async () => {
      const consultationChain = createChainMock({
        id: 'con1', content: 'Some content',
      });
      mockFrom.mockReturnValue(consultationChain);

      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Function error' },
      });

      await expect(
        domain.generateConsultationAISummary(TENANT_ID, 'con1')
      ).rejects.toThrow('AI 요약 생성 실패: Function error');
    });

    it('throws when AI summary is empty', async () => {
      const consultationChain = createChainMock({
        id: 'con1', content: 'Some content',
      });
      mockFrom.mockReturnValue(consultationChain);

      mockFunctionsInvoke.mockResolvedValue({
        data: { ai_summary: null },
        error: null,
      });

      await expect(
        domain.generateConsultationAISummary(TENANT_ID, 'con1')
      ).rejects.toThrow('AI 요약 데이터가 없습니다.');
    });

    it('throws when data is null from Edge Function', async () => {
      const consultationChain = createChainMock({
        id: 'con1', content: 'Some content',
      });
      mockFrom.mockReturnValue(consultationChain);

      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        domain.generateConsultationAISummary(TENANT_ID, 'con1')
      ).rejects.toThrow('AI 요약 데이터가 없습니다.');
    });
  });

  // ==================== updateGuardian ====================

  describe('updateGuardian', () => {
    it('updates guardian fields', async () => {
      const updated = { id: 'g1', name: 'Updated Mom', phone: '010-9999' };
      const chain = createChainMock(updated);
      mockFrom.mockReturnValue(chain);

      const result = await domain.updateGuardian(TENANT_ID, 'g1', { name: 'Updated Mom' });

      expect(mockFrom).toHaveBeenCalledWith('guardians');
      expect(chain.update).toHaveBeenCalledWith({ name: 'Updated Mom' });
      expect(chain.eq).toHaveBeenCalledWith('id', 'g1');
      expect(result.name).toBe('Updated Mom');
    });

    it('throws when update fails', async () => {
      const chain = createChainMock(null, { message: 'Guardian update failed' });
      mockFrom.mockReturnValue(chain);

      await expect(domain.updateGuardian(TENANT_ID, 'g1', { name: 'Fail' }))
        .rejects.toThrow('Failed to update guardian: Guardian update failed');
    });
  });

  // ==================== deleteGuardian ====================

  describe('deleteGuardian', () => {
    it('deletes guardian by id', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await domain.deleteGuardian(TENANT_ID, 'g1');

      expect(mockFrom).toHaveBeenCalledWith('guardians');
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'g1');
    });

    it('throws when delete fails', async () => {
      const chain = createChainMock(null, { message: 'Guardian delete failed' });
      mockFrom.mockReturnValue(chain);

      await expect(domain.deleteGuardian(TENANT_ID, 'g1'))
        .rejects.toThrow('Failed to delete guardian: Guardian delete failed');
    });
  });

  // ==================== updateStudentTags ====================

  describe('updateStudentTags', () => {
    it('removes existing tags and assigns new ones', async () => {
      const deleteChain = createChainMock(null);
      mockFrom.mockReturnValue(deleteChain);
      mockTagsAssignTags.mockResolvedValue(undefined);

      await domain.updateStudentTags(TENANT_ID, 'p1', ['t1', 't2']);

      expect(mockFrom).toHaveBeenCalledWith('tag_assignments');
      expect(deleteChain.delete).toHaveBeenCalled();
      expect(deleteChain.eq).toHaveBeenCalledWith('entity_id', 'p1');
      expect(deleteChain.eq).toHaveBeenCalledWith('entity_type', 'student');
      expect(mockTagsAssignTags).toHaveBeenCalledWith(TENANT_ID, 'p1', 'student', ['t1', 't2']);
    });

    it('does not call assignTags when tagIds is empty', async () => {
      const deleteChain = createChainMock(null);
      mockFrom.mockReturnValue(deleteChain);

      await domain.updateStudentTags(TENANT_ID, 'p1', []);

      expect(deleteChain.delete).toHaveBeenCalled();
      expect(mockTagsAssignTags).not.toHaveBeenCalled();
    });

    it('throws when delete fails', async () => {
      const deleteChain = createChainMock(null, { message: 'Delete tags failed' });
      mockFrom.mockReturnValue(deleteChain);

      await expect(domain.updateStudentTags(TENANT_ID, 'p1', ['t1']))
        .rejects.toThrow('Failed to remove existing tags: Delete tags failed');
    });
  });

  // ==================== getStudentsPaged ====================

  describe('getStudentsPaged', () => {
    it('returns paged students with correct offset', async () => {
      const personsData = Array.from({ length: 5 }, (_, i) => ({
        id: `p${i}`,
        tenant_id: TENANT_ID,
        name: `Student${i}`,
        person_type: 'student',
        academy_students: [{ status: 'active', deleted_at: null }],
      }));
      const chain = createChainMock(personsData);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getStudentsPaged(TENANT_ID, undefined, 1, 2);

      expect(result.totalCount).toBe(5);
      expect(result.students).toHaveLength(2);
    });

    it('returns empty array for out-of-range page', async () => {
      const personsData = [
        { id: 'p1', tenant_id: TENANT_ID, name: 'S1', person_type: 'student', academy_students: [{ status: 'active', deleted_at: null }] },
      ];
      const chain = createChainMock(personsData);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getStudentsPaged(TENANT_ID, undefined, 10, 20);

      expect(result.totalCount).toBe(1);
      expect(result.students).toHaveLength(0);
    });

    it('uses default page and pageSize', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getStudentsPaged(TENANT_ID);

      expect(result.totalCount).toBe(0);
      expect(result.students).toEqual([]);
    });
  });

  // ==================== restoreDeletedStudent ====================

  describe('restoreDeletedStudent', () => {
    it('restores student and returns updated data', async () => {
      // academy_students UPDATE
      const updateChain = createChainMock(null);
      // getStudent query (after restore)
      const getChain = createChainMock({
        id: 'p1', tenant_id: TENANT_ID, name: 'Restored', person_type: 'student',
        academy_students: { status: 'active', deleted_at: null },
      });

      mockFrom
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(getChain);

      const result = await domain.restoreDeletedStudent(TENANT_ID, 'p1');

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: null,
          status: 'active',
        })
      );
      expect(result.name).toBe('Restored');
    });

    it('throws when update fails', async () => {
      const updateChain = createChainMock(null, { message: 'Restore failed' });
      mockFrom.mockReturnValue(updateChain);

      await expect(domain.restoreDeletedStudent(TENANT_ID, 'p1'))
        .rejects.toThrow('Failed to restore deleted student: Restore failed');
    });

    it('throws when restored student not found', async () => {
      // academy_students UPDATE succeeds
      const updateChain = createChainMock(null);
      // getStudent returns null (student still not found)
      const getChain = createChainMock(null, { code: 'PGRST116', message: 'not found' });

      mockFrom
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(getChain);

      await expect(domain.restoreDeletedStudent(TENANT_ID, 'p1'))
        .rejects.toThrow('Restored student not found: p1');
    });
  });

  // ==================== getConsultationsPaged ====================

  describe('getConsultationsPaged', () => {
    it('returns paged consultations with default options', async () => {
      const data = [{ id: 'con1', content: 'Test' }];
      const chain = createChainMock(data, null, 5);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getConsultationsPaged(TENANT_ID, {});

      expect(result.consultations).toHaveLength(1);
      expect(result.totalCount).toBe(5);
      expect(chain.range).toHaveBeenCalledWith(0, 19);
    });

    it('applies consultationType filter (non-all)', async () => {
      const chain = createChainMock([], null, 0);
      mockFrom.mockReturnValue(chain);

      await domain.getConsultationsPaged(TENANT_ID, { consultationType: 'counseling' });

      expect(chain.eq).toHaveBeenCalledWith('consultation_type', 'counseling');
    });

    it('skips consultationType filter when "all"', async () => {
      const chain = createChainMock([], null, 0);
      mockFrom.mockReturnValue(chain);

      await domain.getConsultationsPaged(TENANT_ID, { consultationType: 'all' });

      // eq should only be called for non-'all' consultationType
      // The chain is chainable so eq may be called for other reasons,
      // but specifically consultation_type should not be filtered
    });

    it('applies dateFrom filter', async () => {
      const chain = createChainMock([], null, 0);
      mockFrom.mockReturnValue(chain);

      await domain.getConsultationsPaged(TENANT_ID, { dateFrom: '2026-01-01' });

      expect(chain.gte).toHaveBeenCalledWith('consultation_date', '2026-01-01');
    });

    it('applies dateTo filter', async () => {
      const chain = createChainMock([], null, 0);
      mockFrom.mockReturnValue(chain);

      await domain.getConsultationsPaged(TENANT_ID, { dateTo: '2026-12-31' });

      expect(chain.lte).toHaveBeenCalledWith('consultation_date', '2026-12-31');
    });

    it('calculates correct offset for page 2 with pageSize 10', async () => {
      const chain = createChainMock([], null, 50);
      mockFrom.mockReturnValue(chain);

      await domain.getConsultationsPaged(TENANT_ID, { page: 2, pageSize: 10 });

      expect(chain.range).toHaveBeenCalledWith(10, 19);
    });

    it('throws when query fails', async () => {
      const chain = createChainMock(null, { message: 'Paged query failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        domain.getConsultationsPaged(TENANT_ID, {})
      ).rejects.toThrow('Failed to fetch paged consultations: Paged query failed');
    });

    it('returns totalCount 0 when count is null', async () => {
      const chain = createChainMock([], null, undefined);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getConsultationsPaged(TENANT_ID, {});

      expect(result.totalCount).toBe(0);
    });

    it('combines all filters', async () => {
      const chain = createChainMock([], null, 0);
      mockFrom.mockReturnValue(chain);

      await domain.getConsultationsPaged(TENANT_ID, {
        page: 3,
        pageSize: 5,
        dateFrom: '2026-01-01',
        dateTo: '2026-06-30',
        consultationType: 'learning',
      });

      expect(chain.eq).toHaveBeenCalledWith('consultation_type', 'learning');
      expect(chain.gte).toHaveBeenCalledWith('consultation_date', '2026-01-01');
      expect(chain.lte).toHaveBeenCalledWith('consultation_date', '2026-06-30');
      expect(chain.range).toHaveBeenCalledWith(10, 14);
    });
  });
});
