/**
 * 학생 상세 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundary, useModal, useResponsiveMode } from '@ui-core/react';
import { Container, Card, Button, Input, Select, Textarea, Drawer, BottomActionBar } from '@ui-core/react';
import { SchemaForm, SchemaDetail } from '@schema-engine';
import { useSchema } from '@hooks/use-schema';
import { toKST } from '@lib/date-utils';
import { studentFormSchema } from '../schemas/student.schema';
import { studentDetailSchema } from '../schemas/student.detail.schema';
import { guardianFormSchema } from '../schemas/guardian.schema';
import { consultationFormSchema } from '../schemas/consultation.schema';
import { classAssignmentFormSchema } from '../schemas/class-assignment.schema';
import {
  useStudent,
  useGuardians,
  useConsultations,
  useStudentTags,
  useStudentTagsByStudent,
  useUpdateStudent,
  useCreateGuardian,
  useUpdateGuardian,
  useDeleteGuardian,
  useCreateConsultation,
  useUpdateConsultation,
  useDeleteConsultation,
  useGenerateConsultationAISummary,
  useUpdateStudentTags,
  useStudentClasses,
  useAssignStudentToClass,
  useUnassignStudentFromClass,
} from '@hooks/use-student';
import { useClasses } from '@hooks/use-class';
import { useAttendanceLogs } from '@hooks/use-attendance';
import type { AttendanceLog } from '@services/attendance-service';
import type { Class } from '@services/class-service';
import type { Student, StudentStatus, Gender, GuardianRelationship, ConsultationType } from '@services/student-service';
import type { Tag } from '@core/tags';
import { Badge } from '@ui-core/react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getApiContext, apiClient } from '@api-sdk/core';
import { useSession } from '@hooks/use-auth';

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showAlert, showConfirm } = useModal();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  // URL 경로에 따라 초기 탭 설정
  const getInitialTab = (): 'info' | 'guardians' | 'consultations' | 'tags' | 'classes' | 'counsel' | 'attendance' | 'risk' | 'welcome' => {
    const path = location.pathname;
    if (path.includes('/counsel')) return 'counsel';
    if (path.includes('/attendance')) return 'attendance';
    if (path.includes('/risk')) return 'risk';
    if (path.includes('/welcome')) return 'welcome';
    return 'info';
  };

  const [activeTab, setActiveTab] = useState<'info' | 'guardians' | 'consultations' | 'tags' | 'classes' | 'counsel' | 'attendance' | 'risk' | 'welcome'>(getInitialTab());

  // URL 변경 시 탭 업데이트
  useEffect(() => {
    const newTab = getInitialTab();
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [location.pathname]);

  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const [isEditing, setIsEditing] = useState(false);
  const [showGuardianForm, setShowGuardianForm] = useState(false);
  const [showConsultationForm, setShowConsultationForm] = useState(false);
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [editingConsultationId, setEditingConsultationId] = useState<string | null>(null);
  const [consultationTypeFilter, setConsultationTypeFilter] = useState<ConsultationType | 'all'>('all');

  // Schema Registry 연동 (아키텍처 문서 S3 참조)
  const { data: studentFormSchemaData } = useSchema('student', studentFormSchema, 'form');
  const { data: studentDetailSchemaData } = useSchema('student_detail', studentDetailSchema, 'detail');
  const { data: guardianFormSchemaData } = useSchema('guardian', guardianFormSchema, 'form');
  const { data: consultationFormSchemaData } = useSchema('consultation', consultationFormSchema, 'form');
  const { data: classAssignmentFormSchemaData } = useSchema('class_assignment', classAssignmentFormSchema, 'form');

  // Fallback: Registry에서 조회 실패 시 로컬 스키마 사용
  const effectiveStudentFormSchema = studentFormSchemaData || studentFormSchema;
  const effectiveStudentDetailSchema = studentDetailSchemaData || studentDetailSchema;
  const effectiveGuardianFormSchema = guardianFormSchemaData || guardianFormSchema;
  const effectiveConsultationFormSchema = consultationFormSchemaData || consultationFormSchema;
  const effectiveClassAssignmentFormSchema = classAssignmentFormSchemaData || classAssignmentFormSchema;

  const { data: student, isLoading: studentLoading } = useStudent(id || null);
  const { data: guardians, isLoading: guardiansLoading } = useGuardians(id || null);
  const { data: allConsultations, isLoading: consultationsLoading } = useConsultations(id || null);
  const { data: studentTags, isLoading: tagsLoading } = useStudentTagsByStudent(id || null);
  const { data: studentClasses, isLoading: classesLoading } = useStudentClasses(id || null);
  const { data: allClasses } = useClasses({ status: 'active' });

  // 학습일지 필터링 (요구사항: 상담일지/학습일지 관리)
  const consultations = useMemo(() => {
    if (!allConsultations) return [];
    if (consultationTypeFilter === 'all') return allConsultations;
    return allConsultations.filter((c) => c.consultation_type === consultationTypeFilter);
  }, [allConsultations, consultationTypeFilter]);

  const updateStudent = useUpdateStudent();
  const createGuardian = useCreateGuardian();
  const updateGuardian = useUpdateGuardian();
  const deleteGuardian = useDeleteGuardian();
  const createConsultation = useCreateConsultation();
  const updateConsultation = useUpdateConsultation();
  const deleteConsultation = useDeleteConsultation();
  const generateAISummary = useGenerateConsultationAISummary();
  const updateStudentTags = useUpdateStudentTags();
  const assignStudentToClass = useAssignStudentToClass();
  const unassignStudentFromClass = useUnassignStudentFromClass();

  if (studentLoading) {
    return (
      <Container maxWidth="xl" padding="lg">
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>
      </Container>
    );
  }

  if (!student) {
    return (
      <Container maxWidth="xl" padding="lg">
        <Card padding="md" variant="outlined">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <p>학생을 찾을 수 없습니다.</p>
            <Button variant="outline" onClick={() => navigate('/students')} style={{ marginTop: 'var(--spacing-md)' }}>
              목록으로 돌아가기
            </Button>
          </div>
        </Card>
      </Container>
    );
  }

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
              {student.name} 학생 상세
            </h1>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <Button variant="outline" onClick={() => navigate('/students')}>
                목록으로
              </Button>
              {!isEditing && (
                <Button variant="solid" onClick={() => setIsEditing(true)}>
                  수정
                </Button>
              )}
            </div>
          </div>

          {/* 빠른 링크 (한 페이지에 하나의 기능 원칙 준수: 기본 정보만 메인, 나머지는 별도 페이지) */}
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/students/${id}/guardians`)}
            >
              학부모 관리 ({guardians?.length || 0})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/students/${id}/consultations`)}
            >
              상담일지 ({consultations?.length || 0})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/students/${id}/tags`)}
            >
              태그 관리
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/students/${id}/classes`)}
            >
              반 배정 ({studentClasses?.filter((sc) => sc.is_active).length || 0})
            </Button>
          </div>

          {/* 기본 정보만 표시 (한 페이지에 하나의 기능 원칙) */}
          {activeTab === 'info' && (
            <StudentInfoTab
              student={student}
              isEditing={isEditing}
              effectiveStudentDetailSchema={effectiveStudentDetailSchema}
              effectiveStudentFormSchema={effectiveStudentFormSchema}
              onCancel={() => setIsEditing(false)}
              onSave={async (data) => {
                await updateStudent.mutateAsync({ studentId: student.id, input: data });
                setIsEditing(false);
              }}
            />
          )}

          {/* 학부모 페이지로 리다이렉트 */}
          {activeTab === 'guardians' && (
            <GuardiansTab
              guardians={guardians || []}
              isLoading={guardiansLoading}
              showForm={showGuardianForm}
              editingGuardianId={editingGuardianId}
              effectiveGuardianFormSchema={effectiveGuardianFormSchema}
              onShowForm={() => setShowGuardianForm(true)}
              onHideForm={() => {
                setShowGuardianForm(false);
                setEditingGuardianId(null);
              }}
              onEdit={(guardianId) => {
                setEditingGuardianId(guardianId);
                setShowGuardianForm(true);
              }}
              onCreate={async (data) => {
                await createGuardian.mutateAsync({ studentId: student.id, guardian: data });
                setShowGuardianForm(false);
              }}
              onUpdate={async (guardianId, data) => {
                await updateGuardian.mutateAsync({ guardianId, guardian: data, studentId: student.id });
                setShowGuardianForm(false);
                setEditingGuardianId(null);
              }}
              onDelete={async (guardianId) => {
                const confirmed = await showConfirm('정말 삭제하시겠습니까?', '보호자 삭제');
                if (confirmed) {
                  await deleteGuardian.mutateAsync({ guardianId, studentId: student.id });
                }
              }}
            />
          )}

          {/* 상담일지 탭 */}
          {activeTab === 'consultations' && (
            <ConsultationsTab
              consultations={consultations || []}
              isLoading={consultationsLoading}
              showForm={showConsultationForm}
              editingConsultationId={editingConsultationId}
              consultationTypeFilter={consultationTypeFilter}
              effectiveConsultationFormSchema={effectiveConsultationFormSchema}
              onShowForm={() => setShowConsultationForm(true)}
              onHideForm={() => {
                setShowConsultationForm(false);
                setEditingConsultationId(null);
              }}
              onEdit={(consultationId) => {
                setEditingConsultationId(consultationId);
                setShowConsultationForm(true);
              }}
              onCreate={async (data) => {
                if (!userId) {
                  showAlert('오류', '사용자 정보를 가져올 수 없습니다. 다시 로그인해주세요.');
                  return;
                }
                await createConsultation.mutateAsync({ studentId: student.id, consultation: data, userId });
                setShowConsultationForm(false);
              }}
              onUpdate={async (consultationId, data) => {
                await updateConsultation.mutateAsync({ consultationId, consultation: data, studentId: student.id });
                setShowConsultationForm(false);
                setEditingConsultationId(null);
              }}
              onDelete={async (consultationId) => {
                const confirmed = await showConfirm('정말 삭제하시겠습니까?', '상담일지 삭제');
                if (confirmed) {
                  await deleteConsultation.mutateAsync({ consultationId, studentId: student.id });
                }
              }}
              onGenerateAISummary={async (consultationId) => {
                try {
                  await generateAISummary.mutateAsync({ consultationId, studentId: student.id });
                } catch (error) {
                  console.error('AI 요약 생성 실패:', error);
                  showAlert('AI 요약 생성에 실패했습니다.', '오류', 'error');
                }
              }}
              onFilterChange={setConsultationTypeFilter}
            />
          )}

          {/* 태그 탭 */}
          {activeTab === 'tags' && (
            <TagsTab
              studentTags={studentTags || []}
              isLoading={tagsLoading}
              studentId={student.id}
              onUpdateTags={async (tagIds) => {
                await updateStudentTags.mutateAsync({ studentId: student.id, tagIds });
              }}
            />
          )}

          {activeTab === 'classes' && (
            <ClassesTab
              studentId={student.id}
              studentClasses={studentClasses || []}
              isLoading={classesLoading}
              allClasses={allClasses || []}
              effectiveClassAssignmentFormSchema={effectiveClassAssignmentFormSchema}
              onAssign={async (classId, enrolledAt) => {
                await assignStudentToClass.mutateAsync({
                  studentId: student.id,
                  classId,
                  enrolledAt,
                });
              }}
              onUnassign={async (classId, leftAt) => {
                await unassignStudentFromClass.mutateAsync({
                  studentId: student.id,
                  classId,
                  leftAt,
                });
              }}
            />
          )}

          {/* 상담 탭 (아키텍처 문서 3.1.1: task_type 'counseling' → /students/${student_id}/counsel) */}
          {activeTab === 'counsel' && (
            <CounselTab
              studentId={id || null}
              student={student}
              effectiveConsultationFormSchema={effectiveConsultationFormSchema}
              onCreateConsultation={async (data) => {
                if (!userId) {
                  showAlert('오류', '사용자 정보를 가져올 수 없습니다. 다시 로그인해주세요.');
                  return;
                }
                await createConsultation.mutateAsync({
                  studentId: id!,
                  consultation: data,
                  userId
                });
                setShowConsultationForm(false);
                setActiveTab('consultations');
              }}
            />
          )}

          {/* 출결 탭 */}
          {activeTab === 'attendance' && (
            <AttendanceTab studentId={id || null} student={student} />
          )}

          {/* 이탈 위험 탭 */}
          {activeTab === 'risk' && <RiskAnalysisTab studentId={id || null} student={student} />}

          {/* 환영 탭 */}
          {activeTab === 'welcome' && <WelcomeTab studentId={id || null} student={student} />}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

/**
 * 이탈 위험 분석 탭 컴포넌트
 */
function RiskAnalysisTab({ studentId, student }: { studentId: string | null; student: Student | null | undefined }) {
  const { showAlert } = useModal();
  const context = getApiContext();
  const tenantId = context.tenantId;

  // 학생의 출결 데이터 조회 (최근 30일)
  const thirtyDaysAgo = React.useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  }, []);

  const { data: attendanceLogsData } = useAttendanceLogs({
    student_id: studentId || undefined,
    date_from: thirtyDaysAgo,
  });
  const attendanceLogs = attendanceLogsData || [];

  // 학생의 상담일지 조회
  const { data: consultations } = useConsultations(studentId);

  // AI 위험 점수 조회
  const { data: riskAnalysis, isLoading } = useQuery({
    queryKey: ['student-risk-analysis', tenantId, studentId],
    queryFn: async () => {
      if (!tenantId || !studentId) return null;

      // TODO: ai_insights 테이블이 생성되면 실제 조회로 변경
      // 현재는 출결 패턴 기반 간단한 분석
      const recentAbsences = attendanceLogs.filter((log: AttendanceLog) =>
        log.status === 'absent' || log.status === 'late'
      ).length;

      const absenceRate = attendanceLogs.length > 0
        ? (recentAbsences / attendanceLogs.length) * 100
        : 0;

      // 간단한 위험 점수 계산 (실제로는 AI 모델 사용)
      let riskScore = 0;
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      const reasons: string[] = [];

      if (absenceRate > 30) {
        riskScore += 40;
        riskLevel = 'high';
        reasons.push('최근 30일간 결석/지각률이 30% 이상입니다.');
      } else if (absenceRate > 20) {
        riskScore += 25;
        riskLevel = 'medium';
        reasons.push('최근 30일간 결석/지각률이 20% 이상입니다.');
      }

      if (consultations && consultations.length === 0) {
        riskScore += 15;
        if (riskLevel === 'low') riskLevel = 'medium';
        reasons.push('상담일지가 없어 학생 상태 파악이 어렵습니다.');
      }

      return {
        risk_score: Math.min(riskScore, 100),
        risk_level: riskLevel,
        reasons,
        recommended_actions: [
          '학부모와 상담 일정을 잡아주세요.',
          '출결 패턴을 면밀히 관찰하세요.',
          '학생의 학습 동기를 파악하세요.',
        ],
      };
    },
    enabled: !!tenantId && !!studentId,
  });

  if (isLoading) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          분석 중...
        </div>
      </Card>
    );
  }

  if (!riskAnalysis) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
          분석 데이터가 없습니다.
        </div>
      </Card>
    );
  }

  const riskColor = riskAnalysis.risk_level === 'high' ? 'error' : riskAnalysis.risk_level === 'medium' ? 'warning' : 'success';

  return (
    <Card padding="md" variant="default">
      <h3 style={{ marginBottom: 'var(--spacing-md)' }}>이탈 위험 분석</h3>

      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
            위험 점수: {riskAnalysis.risk_score}점
          </div>
          <Badge variant="solid" color={riskColor}>
            {riskAnalysis.risk_level === 'high' ? '높음' : riskAnalysis.risk_level === 'medium' ? '보통' : '낮음'}
          </Badge>
        </div>
      </div>

      {riskAnalysis.reasons.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
            위험 요인
          </h4>
          <ul style={{ paddingLeft: 'var(--spacing-md)', margin: 0 }}>
            {riskAnalysis.reasons.map((reason, idx) => (
              <li key={idx} style={{ marginBottom: 'var(--spacing-xs)', color: 'var(--color-text-secondary)' }}>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {riskAnalysis.recommended_actions.length > 0 && (
        <div>
          <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
            권장 조치
          </h4>
          <ul style={{ paddingLeft: 'var(--spacing-md)', margin: 0 }}>
            {riskAnalysis.recommended_actions.map((action, idx) => (
              <li key={idx} style={{ marginBottom: 'var(--spacing-xs)', color: 'var(--color-text-secondary)' }}>
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/**
 * 환영 메시지 탭 컴포넌트
 */
function WelcomeTab({ studentId, student }: { studentId: string | null; student: Student | null | undefined }) {
  const { showAlert } = useModal();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  // 환영 메시지 발송 상태 확인
  const { data: welcomeMessageSent } = useQuery({
    queryKey: ['welcome-message-sent', tenantId, studentId],
    queryFn: async () => {
      if (!tenantId || !studentId) return false;

      // TODO: student_task_cards 테이블에서 welcome_message_sent 확인
      // 또는 별도 welcome_messages 테이블 확인
      const response = await apiClient.get<any>('student_task_cards', {
        filters: {
          student_id: studentId,
          task_type: 'new_signup',
        },
        limit: 1,
      });

      if (response.error || !response.data || response.data.length === 0) {
        return false;
      }

      const card = response.data[0];
      return card.welcome_message_sent || false;
    },
    enabled: !!tenantId && !!studentId,
  });

  // 환영 메시지 발송
  const sendWelcomeMessage = useMutation({
    mutationFn: async () => {
      if (!tenantId || !studentId || !student) {
        throw new Error('학생 정보가 없습니다.');
      }

      // 학부모 정보 조회
      const guardiansResponse = await apiClient.get<any>('guardians', {
        filters: { student_id: studentId, is_primary: true },
        limit: 1,
      });

      if (guardiansResponse.error || !guardiansResponse.data || guardiansResponse.data.length === 0) {
        throw new Error('주 보호자 정보를 찾을 수 없습니다.');
      }

      const guardian = guardiansResponse.data[0];

      // 환영 메시지 발송
      const notificationResponse = await apiClient.post<any>('notifications', {
        channel: 'sms',
        recipient: guardian.phone,
        content: `${student.name} 학생의 학원 등록을 환영합니다! 앞으로 함께 성장해 나가겠습니다.`,
        status: 'pending',
      });

      if (notificationResponse.error) {
        throw new Error(notificationResponse.error.message);
      }

      // student_task_cards 업데이트 (welcome_message_sent = true)
      const taskCardResponse = await apiClient.get<any>('student_task_cards', {
        filters: {
          student_id: studentId,
          task_type: 'new_signup',
        },
        limit: 1,
      });

      if (!taskCardResponse.error && taskCardResponse.data && taskCardResponse.data.length > 0) {
        const cardId = taskCardResponse.data[0].id;
        await apiClient.patch('student_task_cards', cardId, {
          welcome_message_sent: true,
        });
      }

      return notificationResponse.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['welcome-message-sent', tenantId, studentId] });
      queryClient.invalidateQueries({ queryKey: ['student-task-cards', tenantId] });
      showAlert('환영 메시지가 발송되었습니다.', '성공', 'success');
    },
    onError: (error: Error) => {
      showAlert(error.message, '오류', 'error');
    },
  });

  return (
    <Card padding="md" variant="default">
      <h3 style={{ marginBottom: 'var(--spacing-md)' }}>신규 등록 환영</h3>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
        신규 등록 학생을 위한 환영 메시지를 발송하고 초기 설정을 완료하세요.
      </p>

      {welcomeMessageSent ? (
        <div style={{
          padding: 'var(--spacing-md)',
          backgroundColor: 'var(--color-success-50)',
          borderRadius: 'var(--border-radius-md)',
          marginBottom: 'var(--spacing-md)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <span style={{ fontSize: 'var(--font-size-xl)' }}>✓</span>
            <span style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-semibold)' }}>
              환영 메시지가 이미 발송되었습니다.
            </span>
          </div>
        </div>
      ) : (
        <Button
          variant="solid"
          onClick={() => sendWelcomeMessage.mutate()}
          disabled={sendWelcomeMessage.isPending}
        >
          {sendWelcomeMessage.isPending ? '발송 중...' : '환영 메시지 발송'}
        </Button>
      )}
    </Card>
  );
}

// 기본 정보 탭 컴포넌트
interface StudentInfoTabProps {
  student: any;
  isEditing: boolean;
  effectiveStudentDetailSchema: any;
  effectiveStudentFormSchema: any;
  onCancel: () => void;
  onSave: (data: any) => Promise<void>;
}

function StudentInfoTab({ student, isEditing, effectiveStudentDetailSchema, effectiveStudentFormSchema, onCancel, onSave }: StudentInfoTabProps) {
  if (!isEditing) {
    // SchemaDetail 사용
    const detailData = {
      name: student.name,
      birth_date: student.birth_date || '',
      gender: student.gender === 'male' ? '남' : student.gender === 'female' ? '여' : '',
      phone: student.phone || '',
      email: student.email || '',
      address: student.address || '',
      school_name: student.school_name || '',
      grade: student.grade || '',
      status: student.status === 'active' ? '재원' : student.status === 'on_leave' ? '휴원' : student.status === 'withdrawn' ? '퇴원' : '졸업',
      notes: student.notes || '',
    };

    return (
      <Card padding="md" variant="default">
        <SchemaDetail
          schema={effectiveStudentDetailSchema}
          data={detailData}
        />
      </Card>
    );
  }

  // 수정 모드: SchemaForm 사용
  const handleSubmit = async (data: any) => {
    // 스키마에서 받은 데이터를 UpdateStudentInput 형식으로 변환
    const updateData = {
      name: data.name || student.name,
      birth_date: data.birth_date || undefined,
      gender: data.gender || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      address: data.address || undefined,
      school_name: data.school_name || undefined,
      grade: data.grade || undefined,
      status: data.status || student.status,
      notes: data.notes || undefined,
    };
    await onSave(updateData);
  };

  // 수정 모드를 위한 스키마 (submit 버튼 커스터마이징)
  const editSchema = {
    ...effectiveStudentFormSchema,
    form: {
      ...effectiveStudentFormSchema.form,
      submit: {
        label: '저장',
        variant: 'solid' as const,
        color: 'primary' as const,
        size: 'md' as const,
      },
    },
  };

  return (
    <Card padding="md" variant="default">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>학생 정보 수정</h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          취소
        </Button>
      </div>
      <SchemaForm
        schema={editSchema}
        onSubmit={handleSubmit}
        defaultValues={{
          name: student.name,
          birth_date: student.birth_date || '',
          gender: student.gender || '',
          phone: student.phone || '',
          email: student.email || '',
          address: student.address || '',
          school_name: student.school_name || '',
          grade: student.grade || '',
          status: student.status,
          notes: student.notes || '',
        }}
      />
    </Card>
  );
}

// 학부모 탭 컴포넌트
interface GuardiansTabProps {
  guardians: any[];
  isLoading: boolean;
  showForm: boolean;
  editingGuardianId: string | null;
  effectiveGuardianFormSchema: any;
  onShowForm: () => void;
  onHideForm: () => void;
  onEdit: (guardianId: string) => void;
  onCreate: (data: any) => Promise<void>;
  onUpdate: (guardianId: string, data: any) => Promise<void>;
  onDelete: (guardianId: string) => Promise<void>;
}

function GuardiansTab({
  guardians,
  isLoading,
  showForm,
  editingGuardianId,
  effectiveGuardianFormSchema,
  onShowForm,
  onHideForm,
  onEdit,
  onCreate,
  onUpdate,
  onDelete,
}: GuardiansTabProps) {
  const editingGuardian = editingGuardianId ? guardians.find((g) => g.id === editingGuardianId) : null;
  const { showAlert } = useModal();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';

  const handleSubmit = async (data: any) => {
    try {
    if (editingGuardianId) {
        await onUpdate(editingGuardianId, data);
    } else {
        await onCreate(data);
    }
      onHideForm();
    } catch (error) {
      showAlert('오류', error instanceof Error ? error.message : '학부모 정보 저장에 실패했습니다.');
    }
  };

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div>
      {!showForm && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <Button variant="solid" onClick={onShowForm}>
            학부모 추가
          </Button>
        </div>
      )}

      {showForm && (
        <>
          {isMobile || isTablet ? (
            // 모바일/태블릿: Drawer 사용
            <Drawer
              isOpen={showForm}
              onClose={onHideForm}
              title={editingGuardianId ? '학부모 수정' : '학부모 추가'}
              position={isMobile ? 'bottom' : 'right'}
              width={isTablet ? '500px' : '100%'}
            >
              <SchemaForm
                schema={effectiveGuardianFormSchema}
                onSubmit={handleSubmit}
                defaultValues={editingGuardian ? {
                  name: editingGuardian.name,
                  relationship: editingGuardian.relationship,
                  phone: editingGuardian.phone || '',
                  email: editingGuardian.email || '',
                  is_primary: editingGuardian.is_primary || false,
                } : {}}
                disableCardPadding={true}
                actionContext={{
                  apiCall: async (endpoint: string, method: string, body?: any) => {
                    if (method === 'POST') {
                      const response = await apiClient.post(endpoint, body);
                      if (response.error) {
                        throw new Error(response.error.message);
                      }
                      return response.data;
                    }
                    const response = await apiClient.get(endpoint);
                    if (response.error) {
                      throw new Error(response.error.message);
                    }
                    return response.data;
                  },
                }}
              />
            </Drawer>
          ) : (
            // 데스크톱: 인라인 폼
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                  {editingGuardianId ? '학부모 수정' : '학부모 추가'}
                </h3>
                <Button variant="ghost" size="sm" onClick={onHideForm}>
                  닫기
                </Button>
              </div>
              <SchemaForm
                schema={effectiveGuardianFormSchema}
                onSubmit={handleSubmit}
                defaultValues={editingGuardian ? {
                  name: editingGuardian.name,
                  relationship: editingGuardian.relationship,
                  phone: editingGuardian.phone || '',
                  email: editingGuardian.email || '',
                  is_primary: editingGuardian.is_primary || false,
                  notes: editingGuardian.notes || '',
                } : {
                  relationship: 'parent',
                  is_primary: false,
                }}
                actionContext={{
                  apiCall: async (endpoint: string, method: string, body?: any) => {
                    const { apiClient } = await import('@api-sdk/core');
                    if (method === 'POST') {
                      const response = await apiClient.post(endpoint, body);
                      if (response.error) {
                        throw new Error(response.error.message);
                      }
                      return response.data;
                    }
                    const response = await apiClient.get(endpoint);
                    if (response.error) {
                      throw new Error(response.error.message);
                    }
                    return response.data;
                  },
                  showToast: (message: string, variant?: string) => {
                    showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
                  },
                }}
              />
            </Card>
          )}
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {guardians.map((guardian) => (
          <Card key={guardian.id} padding="md" variant="default">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                  <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>{guardian.name}</h4>
                  {guardian.is_primary && (
                    <span style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-xs) var(--spacing-sm)', backgroundColor: 'var(--color-blue-100)', color: 'var(--color-blue-800)', borderRadius: 'var(--border-radius-sm)' }}>
                      주 보호자
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  {guardian.relationship === 'parent' ? '부모' : guardian.relationship === 'guardian' ? '보호자' : '기타'}
                </p>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{guardian.phone}</p>
                {guardian.email && (
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{guardian.email}</p>
                )}
                {guardian.notes && (
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>{guardian.notes}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <Button variant="ghost" size="sm" onClick={() => onEdit(guardian.id)}>
                  수정
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(guardian.id)}>
                  삭제
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {guardians.length === 0 && !showForm && (
          <Card padding="md" variant="outlined">
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>등록된 학부모가 없습니다.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

// 상담일지 탭 컴포넌트
interface ConsultationsTabProps {
  consultations: any[];
  isLoading: boolean;
  showForm: boolean;
  editingConsultationId: string | null;
  consultationTypeFilter: ConsultationType | 'all';
  effectiveConsultationFormSchema: any;
  onShowForm: () => void;
  onHideForm: () => void;
  onEdit: (consultationId: string) => void;
  onCreate: (data: any) => Promise<void>;
  onUpdate: (consultationId: string, data: any) => Promise<void>;
  onDelete: (consultationId: string) => Promise<void>;
  onGenerateAISummary: (consultationId: string) => Promise<void>;
  onFilterChange: (filter: ConsultationType | 'all') => void;
}

function ConsultationsTab({
  consultations,
  isLoading,
  showForm,
  editingConsultationId,
  consultationTypeFilter,
  effectiveConsultationFormSchema,
  onShowForm,
  onHideForm,
  onEdit,
  onCreate,
  onUpdate,
  onDelete,
  onGenerateAISummary,
  onFilterChange,
}: ConsultationsTabProps) {
  const editingConsultation = editingConsultationId ? consultations.find((c) => c.id === editingConsultationId) : null;
  const { showAlert } = useModal();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';

  const handleSubmit = async (data: any) => {
    try {
    if (editingConsultationId) {
        await onUpdate(editingConsultationId, data);
    } else {
        await onCreate(data);
    }
      onHideForm();
    } catch (error) {
      showAlert('오류', error instanceof Error ? error.message : '상담일지 저장에 실패했습니다.');
    }
  };

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div>
      {!showForm && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <Button
              variant={consultationTypeFilter === 'all' ? 'solid' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('all')}
            >
              전체
            </Button>
            <Button
              variant={consultationTypeFilter === 'counseling' ? 'solid' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('counseling')}
            >
              상담일지
            </Button>
            <Button
              variant={consultationTypeFilter === 'learning' ? 'solid' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('learning')}
            >
              학습일지
            </Button>
            <Button
              variant={consultationTypeFilter === 'behavior' ? 'solid' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('behavior')}
            >
              행동일지
            </Button>
          </div>
          <Button variant="solid" onClick={onShowForm}>
            상담일지 추가
          </Button>
        </div>
      )}

      {showForm && (
        <>
          {isMobile || isTablet ? (
            // 모바일/태블릿: Drawer 사용
            <Drawer
              isOpen={showForm}
              onClose={onHideForm}
              title={editingConsultationId ? '상담일지 수정' : '상담일지 추가'}
              position={isMobile ? 'bottom' : 'right'}
              width={isTablet ? '500px' : '100%'}
            >
              <SchemaForm
                schema={effectiveConsultationFormSchema}
                onSubmit={handleSubmit}
                defaultValues={editingConsultation ? {
                  consultation_date: editingConsultation.consultation_date,
                  consultation_type: editingConsultation.consultation_type,
                  content: editingConsultation.content,
                } : {
                  consultation_date: toKST().format('YYYY-MM-DD'),
                  consultation_type: 'counseling',
                }}
                disableCardPadding={true}
                actionContext={{
                  apiCall: async (endpoint: string, method: string, body?: any) => {
                    const { apiClient } = await import('@api-sdk/core');
                    if (method === 'POST') {
                      const response = await apiClient.post(endpoint, body);
                      if (response.error) {
                        throw new Error(response.error.message);
                      }
                      return response.data;
                    }
                    const response = await apiClient.get(endpoint);
                    if (response.error) {
                      throw new Error(response.error.message);
                    }
                    return response.data;
                  },
                  showToast: (message: string, variant?: string) => {
                    showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
                  },
                }}
              />
            </Drawer>
          ) : (
            // 데스크톱: 인라인 폼
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                  {editingConsultationId ? '상담일지 수정' : '상담일지 추가'}
                </h3>
                <Button variant="ghost" size="sm" onClick={onHideForm}>
                  닫기
                </Button>
              </div>
              <SchemaForm
                schema={effectiveConsultationFormSchema}
                onSubmit={handleSubmit}
                defaultValues={editingConsultation ? {
                  consultation_date: editingConsultation.consultation_date,
                  consultation_type: editingConsultation.consultation_type,
                  content: editingConsultation.content,
                } : {
                  consultation_date: toKST().format('YYYY-MM-DD'),
                  consultation_type: 'counseling',
                }}
                actionContext={{
                  apiCall: async (endpoint: string, method: string, body?: any) => {
                    const { apiClient } = await import('@api-sdk/core');
                    if (method === 'POST') {
                      const response = await apiClient.post(endpoint, body);
                      if (response.error) {
                        throw new Error(response.error.message);
                      }
                      return response.data;
                    }
                    const response = await apiClient.get(endpoint);
                    if (response.error) {
                      throw new Error(response.error.message);
                    }
                    return response.data;
                  },
                  showToast: (message: string, variant?: string) => {
                    showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
                  },
                }}
              />
            </Card>
          )}
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {consultations.map((consultation) => (
          <Card key={consultation.id} padding="md" variant="default">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                  <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>
                    {consultation.consultation_date}
                  </h4>
                  <span style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-xs) var(--spacing-sm)', backgroundColor: 'var(--color-gray-100)', color: 'var(--color-gray-800)', borderRadius: 'var(--border-radius-sm)' }}>
                    {consultation.consultation_type === 'counseling' ? '상담' : consultation.consultation_type === 'learning' ? '학습' : consultation.consultation_type === 'behavior' ? '행동' : '기타'}
                  </span>
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
                  {consultation.content}
                </p>
                {consultation.ai_summary && (
                  <div style={{ marginTop: 'var(--spacing-sm)', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-blue-50)', borderRadius: 'var(--border-radius-sm)' }}>
                    <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>AI 요약</p>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{consultation.ai_summary}</p>
                  </div>
                )}
                {!consultation.ai_summary && (
                  <div style={{ marginTop: 'var(--spacing-sm)' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onGenerateAISummary(consultation.id)}
                      style={{ fontSize: 'var(--font-size-xs)' }}
                    >
                      🤖 AI 요약 생성
                    </Button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <Button variant="ghost" size="sm" onClick={() => onEdit(consultation.id)}>
                  수정
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(consultation.id)}>
                  삭제
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {consultations.length === 0 && !showForm && (
          <Card padding="md" variant="outlined">
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>등록된 상담일지가 없습니다.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

// 태그 탭 컴포넌트
interface TagsTabProps {
  studentTags: Array<{ id: string; name: string; color: string }>;
  isLoading: boolean;
  studentId: string;
  onUpdateTags: (tagIds: string[]) => Promise<void>;
}

function TagsTab({ studentTags, isLoading, studentId, onUpdateTags }: TagsTabProps) {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const { data: allTags, isLoading: allTagsLoading } = useStudentTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // 학생 태그가 로드되면 선택된 태그 ID 업데이트
  useEffect(() => {
    if (studentTags) {
      setSelectedTagIds(studentTags.map((tag) => tag.id));
    }
  }, [studentTags]);

  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const newIds = prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId];
      return newIds;
    });
  };

  const handleSave = async () => {
    await onUpdateTags(selectedTagIds);
  };

  if (isLoading || allTagsLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div style={{ paddingBottom: isMobile ? 'var(--spacing-bottom-action-bar)' : '0' }}>
      <Card padding="md" variant="default">
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
            태그 관리
          </h3>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
          학생에게 태그를 추가하거나 제거할 수 있습니다.
        </p>
      </div>

      {/* 전체 태그 목록 */}
      {allTags && allTags.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
            사용 가능한 태그
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
            {allTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => handleTagToggle(tag.id)}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    fontSize: 'var(--font-size-sm)',
                    borderRadius: 'var(--border-radius-sm)',
                    border: isSelected ? `var(--border-width-base) solid ${tag.color}` : `var(--border-width-base) solid transparent`,
                    color: isSelected ? 'var(--color-white)' : tag.color,
                    backgroundColor: isSelected ? tag.color : 'transparent',
                    cursor: 'pointer',
                    transition: 'var(--transition-all)',
                  }}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 저장 버튼 - 모바일: Bottom Action Bar, 데스크톱: 인라인 */}
      {isMobile ? (
        <BottomActionBar>
          <div style={{ flex: 1 }} />
          <Button
            variant="solid"
            color="primary"
            size="sm"
            onClick={handleSave}
            disabled={isLoading}
          >
            저장
          </Button>
        </BottomActionBar>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
          <Button
            variant="solid"
            color="primary"
            onClick={handleSave}
            disabled={isLoading}
          >
            저장
          </Button>
        </div>
      )}
      </Card>
    </div>
  );
}

// 반 배정 탭 컴포넌트
interface ClassesTabProps {
  studentId: string;
  studentClasses: Array<{
    id: string;
    class_id: string;
    enrolled_at: string;
    left_at?: string;
    is_active: boolean;
    class: Class | null;
  }>;
  isLoading: boolean;
  allClasses: Class[];
  effectiveClassAssignmentFormSchema: any;
  onAssign: (classId: string, enrolledAt?: string) => Promise<void>;
  onUnassign: (classId: string, leftAt?: string) => Promise<void>;
}

function ClassesTab({
  studentId,
  studentClasses,
  isLoading,
  allClasses,
  effectiveClassAssignmentFormSchema,
  onAssign,
  onUnassign,
}: ClassesTabProps) {
  const { showAlert, showConfirm } = useModal();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [enrolledAt, setEnrolledAt] = useState(toKST().format('YYYY-MM-DD'));

  // 이미 배정된 반 ID 목록
  const assignedClassIds = studentClasses
    .filter((sc) => sc.is_active)
    .map((sc) => sc.class_id);

  // 배정 가능한 반 목록 (활성 상태이고 아직 배정되지 않은 반)
  const availableClasses = allClasses.filter(
    (c) => c.status === 'active' && !assignedClassIds.includes(c.id)
  );

  const DAYS_OF_WEEK: { value: string; label: string }[] = [
    { value: 'monday', label: '월요일' },
    { value: 'tuesday', label: '화요일' },
    { value: 'wednesday', label: '수요일' },
    { value: 'thursday', label: '목요일' },
    { value: 'friday', label: '금요일' },
    { value: 'saturday', label: '토요일' },
    { value: 'sunday', label: '일요일' },
  ];

  const handleAssign = async (data: any) => {
    if (!data.class_id) return;

    try {
      await onAssign(data.class_id, data.enrolled_at || toKST().format('YYYY-MM-DD'));
      setShowAssignForm(false);
      setSelectedClassId('');
      setEnrolledAt(toKST().format('YYYY-MM-DD'));
    } catch (error) {
      console.error('Failed to assign class:', error);
      showAlert('반 배정에 실패했습니다.', '오류', 'error');
    }
  };

  const handleUnassign = async (classId: string) => {
    const confirmed = await showConfirm('정말 이 반에서 제외하시겠습니까?', '반 제외');
    if (!confirmed) return;

    try {
      await onUnassign(classId, toKST().format('YYYY-MM-DD'));
    } catch (error) {
      console.error('Failed to unassign class:', error);
      showAlert('반 제외에 실패했습니다.', '오류', 'error');
    }
  };

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <Button
          variant="solid"
          onClick={() => setShowAssignForm(!showAssignForm)}
          disabled={availableClasses.length === 0}
        >
          반 배정
        </Button>
        {availableClasses.length === 0 && (
          <span style={{ marginLeft: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            배정 가능한 반이 없습니다.
          </span>
        )}
      </div>

      {showAssignForm && (
        <>
          {isMobile || isTablet ? (
            <Drawer
              isOpen={showAssignForm}
              onClose={() => setShowAssignForm(false)}
              title="반 배정"
              position={isMobile ? 'bottom' : 'right'}
              width={isTablet ? '500px' : '100%'}
            >
              <SchemaForm
                schema={{
                  ...effectiveClassAssignmentFormSchema,
                  form: {
                    ...effectiveClassAssignmentFormSchema.form,
                    fields: [
                      {
                        ...effectiveClassAssignmentFormSchema.form.fields[0],
                        options: [
                          { label: '반을 선택하세요', value: '' },
                          ...availableClasses.map((classItem) => {
                            const dayLabel = DAYS_OF_WEEK.find((d) => d.value === classItem.day_of_week)?.label || classItem.day_of_week;
                            return {
                              label: `${classItem.name} (${dayLabel} ${classItem.start_time}~${classItem.end_time})`,
                              value: classItem.id,
                            };
                          }),
                        ],
                      },
                      effectiveClassAssignmentFormSchema.form.fields[1],
                    ],
                  },
                }}
                onSubmit={handleAssign}
                defaultValues={{
                  enrolled_at: toKST().format('YYYY-MM-DD'),
                }}
                actionContext={{
                  apiCall: async (endpoint: string, method: string, body?: any) => {
                    const { apiClient } = await import('@api-sdk/core');
                    if (method === 'POST') {
                      const response = await apiClient.post(endpoint, body);
                      if (response.error) {
                        throw new Error(response.error.message);
                      }
                      return response.data;
                    }
                    const response = await apiClient.get(endpoint);
                    if (response.error) {
                      throw new Error(response.error.message);
                    }
                    return response.data;
                  },
                  showToast: (message: string, variant?: string) => {
                    showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
                  },
                }}
              />
            </Drawer>
          ) : (
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>반 배정</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowAssignForm(false)}>
                  닫기
                </Button>
              </div>
              <SchemaForm
                schema={{
                  ...effectiveClassAssignmentFormSchema,
                  form: {
                    ...effectiveClassAssignmentFormSchema.form,
                    fields: [
                      {
                        ...effectiveClassAssignmentFormSchema.form.fields[0],
                        options: [
                          { label: '반을 선택하세요', value: '' },
                          ...availableClasses.map((classItem) => {
                            const dayLabel = DAYS_OF_WEEK.find((d) => d.value === classItem.day_of_week)?.label || classItem.day_of_week;
                            return {
                              label: `${classItem.name} (${dayLabel} ${classItem.start_time}~${classItem.end_time})`,
                              value: classItem.id,
                            };
                          }),
                        ],
                      },
                      effectiveClassAssignmentFormSchema.form.fields[1],
                    ],
                  },
                }}
                onSubmit={handleAssign}
                defaultValues={{
                  enrolled_at: toKST().format('YYYY-MM-DD'),
                }}
                actionContext={{
                  apiCall: async (endpoint: string, method: string, body?: any) => {
                    const { apiClient } = await import('@api-sdk/core');
                    if (method === 'POST') {
                      const response = await apiClient.post(endpoint, body);
                      if (response.error) {
                        throw new Error(response.error.message);
                      }
                      return response.data;
                    }
                    const response = await apiClient.get(endpoint);
                    if (response.error) {
                      throw new Error(response.error.message);
                    }
                    return response.data;
                  },
                  showToast: (message: string, variant?: string) => {
                    showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
                  },
                }}
              />
            </Card>
          )}
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {studentClasses
          .filter((sc) => sc.is_active && sc.class)
          .map((studentClass) => {
            const classItem = studentClass.class!;
            const dayLabel = DAYS_OF_WEEK.find((d) => d.value === classItem.day_of_week)?.label || classItem.day_of_week;

            return (
              <Card key={studentClass.id} padding="md" variant="default" style={{ borderLeft: `var(--border-width-thick) solid ${classItem.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                      {classItem.name}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {classItem.subject && <div>과목: {classItem.subject}</div>}
                      {classItem.grade && <div>대상: {classItem.grade}</div>}
                      <div>요일: {dayLabel}</div>
                      <div>시간: {classItem.start_time} ~ {classItem.end_time}</div>
                      {classItem.room && <div>강의실: {classItem.room}</div>}
                      <div>배정일: {studentClass.enrolled_at}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnassign(classItem.id)}
                  >
                    제외
                  </Button>
                </div>
              </Card>
            );
          })}
        {studentClasses.filter((sc) => sc.is_active && sc.class).length === 0 && (
          <Card padding="md" variant="outlined">
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              배정된 반이 없습니다.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

/**
 * 상담일지 작성 탭 컴포넌트
 */
function CounselTab({
  studentId,
  student,
  effectiveConsultationFormSchema,
  onCreateConsultation,
}: {
  studentId: string | null;
  student: Student | null | undefined;
  effectiveConsultationFormSchema: any;
  onCreateConsultation: (data: any) => Promise<void>;
}) {
  const { showAlert } = useModal();
  const [showForm, setShowForm] = useState(false);

  if (!studentId || !student) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          학생 정보를 불러올 수 없습니다.
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md" variant="default">
      <h3 style={{ marginBottom: 'var(--spacing-md)' }}>상담일지 작성</h3>

      {!showForm ? (
        <>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
            {student.name} 학생에 대한 상담일지를 작성하세요.
          </p>
          <Button
            variant="solid"
            onClick={() => setShowForm(true)}
          >
            상담일지 작성하기
          </Button>
        </>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
              새 상담일지 작성
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              취소
            </Button>
          </div>
          <SchemaForm
            schema={effectiveConsultationFormSchema}
            onSubmit={async (data) => {
              try {
                await onCreateConsultation({
                  consultation_date: data.consultation_date || toKST().format('YYYY-MM-DD'),
                  consultation_type: data.consultation_type || 'counseling',
                  content: data.content || '',
                  notes: data.notes || undefined,
                });
                setShowForm(false);
                showAlert('상담일지가 작성되었습니다.', '성공', 'success');
              } catch (error) {
                showAlert(error instanceof Error ? error.message : '상담일지 작성에 실패했습니다.', '오류', 'error');
              }
            }}
            defaultValues={{
              consultation_date: toKST().format('YYYY-MM-DD'),
              consultation_type: 'counseling',
            }}
          />
        </div>
      )}
    </Card>
  );
}

/**
 * 출결 관리 탭 컴포넌트
 */
function AttendanceTab({
  studentId,
  student,
}: {
  studentId: string | null;
  student: Student | null | undefined;
}) {
  const navigate = useNavigate();
  const { showAlert } = useModal();

  // 최근 30일 출결 내역 조회
  const thirtyDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  }, []);

  const { data: attendanceLogsData, isLoading } = useAttendanceLogs({
    student_id: studentId || undefined,
    date_from: thirtyDaysAgo,
  });
  const attendanceLogs = attendanceLogsData || [];

  // 출결 통계 계산
  const stats = useMemo(() => {
    if (attendanceLogs.length === 0) return null;

    const present = attendanceLogs.filter(log => log.status === 'present').length;
    const late = attendanceLogs.filter(log => log.status === 'late').length;
    const absent = attendanceLogs.filter(log => log.status === 'absent').length;
    const total = attendanceLogs.length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      total,
      present,
      late,
      absent,
      attendanceRate,
    };
  }, [attendanceLogs]);

  if (!studentId || !student) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          학생 정보를 불러올 수 없습니다.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {/* 출결 통계 */}
      <Card padding="md" variant="default">
        <h3 style={{ marginBottom: 'var(--spacing-md)' }}>출결 통계 (최근 30일)</h3>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            출결 정보를 불러오는 중...
          </div>
        ) : stats ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--spacing-md)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                총 출결
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
                {stats.total}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                출석
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
                {stats.present}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                지각
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning)' }}>
                {stats.late}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                결석
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-error)' }}>
                {stats.absent}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                출석률
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
                {stats.attendanceRate}%
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            출결 데이터가 없습니다.
          </div>
        )}
      </Card>

      {/* 출결 내역 */}
      <Card padding="md" variant="default">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <h3>최근 출결 내역</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/attendance?student_id=${student.id}`)}
          >
            전체 출결 보기
          </Button>
        </div>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            출결 정보를 불러오는 중...
          </div>
        ) : attendanceLogs && attendanceLogs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {attendanceLogs.slice(0, 10).map((log) => {
              const statusColor = log.status === 'present' ? 'success' : log.status === 'late' ? 'warning' : 'error';
              const statusLabel = log.status === 'present' ? '출석' : log.status === 'late' ? '지각' : log.status === 'absent' ? '결석' : '사유';
              const typeLabel = log.attendance_type === 'check_in' ? '등원' : log.attendance_type === 'check_out' ? '하원' : log.attendance_type;

              return (
                <Card key={log.id} padding="sm" variant="outlined">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                        <Badge variant="soft" color={statusColor}>
                          {statusLabel}
                        </Badge>
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                          {typeLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        {toKST(log.occurred_at).format('YYYY-MM-DD HH:mm')}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--spacing-xl)' }}>
            최근 출결 내역이 없습니다.
          </div>
        )}
      </Card>
    </div>
  );
}

