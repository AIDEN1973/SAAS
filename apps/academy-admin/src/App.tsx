import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import React, { Suspense, lazy, useMemo, useEffect, useCallback, useState } from 'react';
import {
  useModal,
  useTheme,
  AIToggle,
  useAILayerMenu,
  getOrCreateChatOpsSessionId,
  useGlobalSearch,
  Tooltip,
} from '@ui-core/react';
import type { SearchResult, SidebarItem, ExecutionAuditRun } from '@ui-core/react';
import { ChatsCircle, ClockCounterClockwise, BookOpen } from 'phosphor-react';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleBasedRoute } from './components/RoleBasedRoute';
import { IndustryBasedRoute } from './components/IndustryBasedRoute';
import { useLogout, useUserRole, useSession } from '@hooks/use-auth';
import { useExecutionAuditRuns, fetchExecutionAuditSteps } from '@hooks/use-execution-audit';
import { sendChatOpsMessageStreaming } from '@hooks/use-chatops';
import { useIndustryConfig } from '@hooks/use-industry-config';
import { getApiContext } from '@api-sdk/core';
import type { TenantRole } from '@core/tenancy';
import { useCurrentTeacherPosition, useRolePermissions, DEFAULT_PERMISSIONS } from '@hooks/use-class';
import { createSafeNavigate, logError, logWarn, logInfo } from './utils';
import { maskPII } from '@core/pii-utils';

// Agent Button Component
const AgentButton: React.FC<{ isOpen: boolean; onClick: () => void }> = ({ isOpen, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Tooltip content="에이전트" position="bottom">
      <button
        onClick={onClick}
        aria-label="에이전트 열기/닫기"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--spacing-sm)',
          backgroundColor: isHovered ? 'var(--color-primary-40)' : 'transparent',
          border: 'none',
          borderRadius: 'var(--border-radius-md)',
          cursor: 'pointer',
          transition: 'var(--transition-all)',
        }}
      >
        <ChatsCircle
          weight={isOpen ? 'bold' : 'regular'}
          style={{
            width: 'var(--size-icon-xl)',
            height: 'var(--size-icon-xl)',
            color: isOpen ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
          }}
        />
      </button>
    </Tooltip>
  );
};

// Timeline Button Component
const TimelineButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Tooltip content="타임라인" position="bottom">
      <button
        onClick={onClick}
        aria-label="타임라인 열기"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--spacing-sm)',
          backgroundColor: isHovered ? 'var(--color-primary-40)' : 'transparent',
          border: 'none',
          borderRadius: 'var(--border-radius-md)',
          cursor: 'pointer',
          transition: 'var(--transition-all)',
        }}
      >
        <ClockCounterClockwise
          weight="regular"
          style={{
            width: 'var(--size-icon-xl)',
            height: 'var(--size-icon-xl)',
            color: 'var(--color-text-tertiary)',
          }}
        />
      </button>
    </Tooltip>
  );
};

// Manual Button Component
const ManualButton: React.FC<{ isOpen: boolean; onClick: () => void }> = ({ isOpen, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Tooltip content="매뉴얼" position="bottom">
      <button
        onClick={onClick}
        aria-label="매뉴얼 열기/닫기"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--spacing-sm)',
          backgroundColor: isHovered ? 'var(--color-primary-hover)' : 'transparent',
          border: 'none',
          borderRadius: 'var(--border-radius-md)',
          cursor: 'pointer',
          transition: 'var(--transition-all)',
        }}
      >
        <BookOpen
          weight={isOpen ? 'bold' : 'regular'}
          style={{
            width: 'var(--size-icon-xl)',
            height: 'var(--size-icon-xl)',
            color: isOpen ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
          }}
        />
      </button>
    </Tooltip>
  );
};

// 큰 컴포넌트는 lazy loading으로 전환 (초기 로드 번들 크기 감소)
const AppLayout = lazy(() => import('@ui-core/react').then(m => ({ default: m.AppLayout })));
const TimelineModal = lazy(() => import('@ui-core/react').then(m => ({ default: m.TimelineModal })));

// 핵심 페이지도 lazy loading으로 전환 (초기 로딩 번들 크기 대폭 감소)
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./pages/SignupPage').then(m => ({ default: m.SignupPage })));
const TenantSelectionPage = lazy(() => import('./pages/TenantSelectionPage').then(m => ({ default: m.TenantSelectionPage })));

// 나머지 페이지는 코드 스플리팅 (지연 로딩)
const StudentsHomePage = lazy(() => import('./pages/StudentsHomePage').then(m => ({ default: m.StudentsHomePage })));
const StudentsListPage = lazy(() => import('./pages/StudentsListPage').then(m => ({ default: m.StudentsListPage })));
const ClassesPage = lazy(() => import('./pages/ClassesPage').then(m => ({ default: m.ClassesPage })));
const TeachersPage = lazy(() => import('./pages/TeachersPage').then(m => ({ default: m.TeachersPage })));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then(m => ({ default: m.AttendancePage })));
const KioskCheckInPage = lazy(() => import('./pages/KioskCheckInPage').then(m => ({ default: m.KioskCheckInPage })));
const BillingPage = lazy(() => import('./pages/BillingPage').then(m => ({ default: m.BillingPage })));
const BillingHomePage = lazy(() => import('./pages/BillingHomePage').then(m => ({ default: m.BillingHomePage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const AIPage = lazy(() => import('./pages/AIPage').then(m => ({ default: m.AIPage })));
const AllCardsPage = lazy(() => import('./pages/AllCardsPage').then(m => ({ default: m.AllCardsPage })));
const StudentTasksPage = lazy(() => import('./pages/StudentTasksPage').then(m => ({ default: m.StudentTasksPage })));
const AutomationSettingsPage = lazy(() => import('./pages/AutomationSettingsPage').then(m => ({ default: m.AutomationSettingsPage })));
const AlimtalkSettingsPage = lazy(() => import('./pages/AlimtalkSettingsPage').then(m => ({ default: m.AlimtalkSettingsPage })));
const SettingsPermissionsPage = lazy(() => import('./pages/SettingsPermissionsPage').then(m => ({ default: m.SettingsPermissionsPage })));
const IntentPatternsPage = lazy(() => import('./pages/IntentPatternsPage').then(m => ({ default: m.IntentPatternsPage })));
const SchemaEditorPage = lazy(() => import('../../super-admin/src/pages/SchemaEditorPage').then(m => ({ default: m.SchemaEditorPage })));
const AuthGuard = lazy(() => import('../../super-admin/src/components/AuthGuard').then(m => ({ default: m.AuthGuard })));
const AgentPage = lazy(() => import('./pages/AgentPage').then(m => ({ default: m.AgentPage })));
const ManualPage = lazy(() => import('./pages/ManualPage').then(m => ({ default: m.ManualPage })));

// 로딩 컴포넌트 - 스켈레톤 형태로 체감 로딩 속도 개선
// [SSOT] 하드코딩 금지: CSS 변수 사용
const PageLoader = () => (
  <div style={{ padding: 'var(--spacing-lg)' }}>
    {/* 페이지 제목 스켈레톤 */}
    <div
      style={{
        height: '28px',
        width: '180px',
        backgroundColor: 'var(--color-bg-tertiary)',
        borderRadius: 'var(--border-radius-md)',
        marginBottom: 'var(--spacing-lg)',
        animation: 'pageLoaderPulse 1.5s ease-in-out infinite',
      }}
    />
    {/* 콘텐츠 카드 스켈레톤 */}
    <div
      style={{
        height: '160px',
        backgroundColor: 'var(--color-bg-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        animation: 'pageLoaderPulse 1.5s ease-in-out infinite',
        animationDelay: '0.2s',
      }}
    />
    <style>{`
      @keyframes pageLoaderPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `}</style>
  </div>
);

function AppContent() {
  // 테넌트별 테마 적용
  useTheme({ mode: 'auto' });
  const location = useLocation();
  const navigate = useNavigate();
  // [P0-2 수정] SSOT: 네비게이션 보안 유틸리티 사용 (일관성)
  const safeNavigate = useMemo(
    () => createSafeNavigate(navigate),
    [navigate]
  );
  const { showAlert } = useModal();
  const logout = useLogout();
  const { data: session } = useSession();
  const { data: userRole } = useUserRole();
  const { data: teacherPosition } = useCurrentTeacherPosition();
  const { data: rolePermissions } = useRolePermissions(teacherPosition || undefined);
  const aiLayerMenu = useAILayerMenu();
  // 업종별 설정 (Phase 3: Industry-Based Page Visibility)
  const { terms, isPageVisible } = useIndustryConfig();

  // 타임라인 모달 상태
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  // 매뉴얼 페이지 여부 확인
  const isManualPath = location.pathname === '/manual';

  // 매뉴얼 버튼 클릭 핸들러 (라우트 기반)
  const handleManualToggle = useCallback(() => {
    if (isManualPath) {
      // 매뉴얼 페이지에서 버튼 클릭 시 이전 페이지로 이동
      window.history.back();
    } else {
      // 다른 페이지에서 버튼 클릭 시 매뉴얼 페이지로 이동
      safeNavigate('/manual');
    }
  }, [isManualPath, safeNavigate]);

  // 글로벌 검색 API 호출 함수
  const handleGlobalSearch = useCallback(async (input: { query: string; entity_types?: string[]; limit?: number }) => {
    const context = getApiContext();
    const tenantId = context?.tenantId;
    if (!tenantId) {
      return [];
    }

    try {
      // [P0 수정] api-sdk를 통해 RPC 호출 (Supabase 직접 호출 금지)
      const { apiClient } = await import('@api-sdk/core');

      type GlobalSearchResult = {
        id: string;
        entity_type: string;
        title: string;
        subtitle: string;
        relevance: number;
        created_at: string;
      };

      const response = await apiClient.callRPC<GlobalSearchResult[]>('global_search', {
        p_tenant_id: tenantId,
        p_query: input.query,
        p_entity_types: input.entity_types || ['student', 'teacher', 'class', 'guardian', 'consultation', 'announcement', 'tag'],
        p_limit: input.limit || 20,
      });

      if (!response.success) {
        console.error('[GlobalSearch] RPC error:', response.error);
        return [];
      }

      const results = response.data || [];
      return results.map((item) => ({
        id: item.id,
        entity_type: item.entity_type as SearchResult['entity_type'],
        title: item.title,
        subtitle: item.subtitle,
        relevance: item.relevance,
        created_at: item.created_at,
      }));
    } catch (error) {
      console.error('[GlobalSearch] Error:', error);
      return [];
    }
  }, []);

  // 글로벌 검색 훅
  const globalSearch = useGlobalSearch({
    tenantId: getApiContext()?.tenantId || '',
    onSearch: handleGlobalSearch,
  });

  // 검색 결과 클릭 핸들러
  const handleSearchResultClick = useCallback(async (result: SearchResult) => {
    // 엔티티 타입별 페이지 이동
    switch (result.entity_type) {
      case 'student':
        safeNavigate(`/students/${result.id}`);
        break;
      case 'teacher':
        safeNavigate(`/teachers/${result.id}`);
        break;
      case 'class':
        safeNavigate(`/classes/${result.id}`);
        break;
      case 'guardian':
        // 보호자 ID로 연결된 학생 찾기
        try {
          // [P0 수정] api-sdk를 통해 조회 (Supabase 직접 호출 금지)
          const { apiClient } = await import('@api-sdk/core');

          // guardians 테이블에서 id로 student_id 찾기
          const response = await apiClient.get<{ student_id: string }>('guardians', {
            select: 'student_id',
            filters: { id: result.id },
            limit: 1,
          });

          if (!response.success || !response.data?.length) {
            console.error('[GlobalSearch] Failed to find student for guardian:', response.error);
            safeNavigate(`/students/list`);
            return;
          }

          const guardian = response.data[0];

          // 학생의 보호자 탭으로 이동 (query parameter 사용)
          safeNavigate(`/students/list?studentId=${guardian.student_id}&panel=guardians`);
        } catch (error) {
          console.error('[GlobalSearch] Error navigating to guardian:', error);
          safeNavigate(`/students/list`);
        }
        break;
      case 'consultation':
        // 상담은 학생 상세에서 확인
        safeNavigate(`/students/list`);
        break;
      case 'announcement':
        safeNavigate(`/notifications`);
        break;
      case 'tag':
        // 태그는 학생 목록에서 필터링
        safeNavigate(`/students/list`);
        break;
      default:
        safeNavigate(`/home`);
    }
  }, [safeNavigate]);

  // 사용자 프로필 정보
  const userProfile = session?.user ? {
    name: (session.user.user_metadata?.full_name as string | undefined) || session.user.email?.split('@')[0] || '사용자',
    email: session.user.email || '',
    avatarUrl: session.user.user_metadata?.avatar_url as string | undefined,
  } : undefined;

  // Execution Audit 데이터 로드 (액티비티.md 10.1 참조)
  const executionAuditQuery = useExecutionAuditRuns(
    aiLayerMenu.executionAuditFilters,
    aiLayerMenu.executionAuditNextCursor
  );

  // Execution Audit 데이터를 useAILayerMenu 상태에 동기화
  useEffect(() => {
    if (!executionAuditQuery.data) {
      return;
    }

    const isAdditionalLoad = !!aiLayerMenu.executionAuditNextCursor;

    if (isAdditionalLoad) {
      // 추가 로드: 기존 데이터에 추가
      aiLayerMenu.setExecutionAuditRuns([
        ...aiLayerMenu.executionAuditRuns,
        ...executionAuditQuery.data.items,
      ]);
    } else {
      // 초기 로드: 데이터 교체
      aiLayerMenu.setExecutionAuditRuns(executionAuditQuery.data.items);
    }

    aiLayerMenu.setExecutionAuditHasMore(executionAuditQuery.data.has_more);
    aiLayerMenu.setExecutionAuditNextCursor(executionAuditQuery.data.next_cursor);
    aiLayerMenu.setExecutionAuditLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionAuditQuery.data]);

  // Execution Audit 로딩 상태 동기화
  useEffect(() => {
    aiLayerMenu.setExecutionAuditLoading(executionAuditQuery.isLoading);
  }, [executionAuditQuery.isLoading, aiLayerMenu]);

  // Execution Audit Steps 로딩 상태 감지 및 실제 API 호출 (액티비티.md 10.2 참조)
  // AppLayout에서 onExecutionAuditLoadSteps 호출 시 로딩 상태만 설정하고,
  // 여기서 실제 API 호출을 수행
  useEffect(() => {
    const loadingRunIds = Object.entries(aiLayerMenu.executionAuditStepsLoading)
      .filter(([, loading]) => loading)
      .map(([runId]) => runId);

    if (loadingRunIds.length === 0) {
      return;
    }

    // 중요: forEach 내부 async는 await를 지원하지 않으므로 Promise.all 사용
    void Promise.all(
      loadingRunIds.map(async (runId) => {
        // 이미 Steps가 로드되어 있으면 스킵 (중복 호출 방지)
        if (aiLayerMenu.executionAuditStepsByRunId[runId]?.length > 0) {
          aiLayerMenu.setExecutionAuditStepsLoading(runId, false);
          return;
        }

        try {
          const context = getApiContext();
          const tenantId = context.tenantId;
          if (!tenantId) {
            throw new Error('Tenant ID is required');
          }

          const response = await fetchExecutionAuditSteps(tenantId, runId);
          aiLayerMenu.setExecutionAuditSteps(runId, response.items);
        } catch (error) {
          // P0: PII 마스킹 필수 (체크리스트.md 4. PII 마스킹)
          const maskedError = maskPII(error);
          logError('App:ExecutionAudit:LoadSteps', maskedError);
        } finally {
          aiLayerMenu.setExecutionAuditStepsLoading(runId, false);
        }
      })
    );
  }, [aiLayerMenu.executionAuditStepsLoading, aiLayerMenu]);

  // Execution Audit 핸들러 구현 (액티비티.md 10.1, 10.2 참조)
  const handleExecutionAuditRowClick = useCallback((run: ExecutionAuditRun) => {
    const { entity_type, entity_id } = run.reference;

    // entity_type에 따라 적절한 페이지로 이동
    if (entity_type === 'student' && entity_id) {
      safeNavigate(`/students/${entity_id}`);
    } else if (entity_type === 'guardian' && entity_id) {
      // 보호자인 경우: reference에서 student_id 추출하여 학생 페이지의 보호자 탭으로 이동
      // guardian 등록 시 details에 student_id가 포함되어 있음
      const studentId = run.details?.student_id as string | undefined;
      if (studentId) {
        safeNavigate(`/students/${studentId}?tab=guardians`);
      } else if (entity_id) {
        // student_id가 없으면 guardian_id만으로 이동 시도
        // (향후 guardian 조회 API로 student_id를 가져올 수도 있음)
        console.warn('[ExecutionAudit] Guardian 클릭: student_id를 찾을 수 없습니다', { run });
      }
    } else if (entity_type === 'config' && entity_id) {
      // 설정인 경우: 설정 페이지로 이동
      safeNavigate('/settings');
    } else if (entity_type === 'chatops_session') {
      // ChatOps 세션인 경우 ChatOps 탭으로 전환
      aiLayerMenu.setActiveTab('chatops');
    }
    // 필요시 다른 entity_type 추가 가능
  }, [safeNavigate, aiLayerMenu]);

  // ChatOps 핸들러 구현 (챗봇.md 참조)
  // ✅ 수정: 스트리밍 모드로 변경하여 응답 속도 개선
  const handleChatOpsSendMessage = useCallback(async (message: string) => {
    if (!message || message.trim().length === 0) {
      return;
    }

    try {
      // 사용자 메시지를 ChatOps 메시지로 추가
      aiLayerMenu.addChatOpsMessage({
        id: `user-${Date.now()}`,
        type: 'user_message',
        content: message,
        timestamp: new Date(),
      });

      // 로딩 상태 설정
      aiLayerMenu.setChatOpsLoading(true);

      // ChatOps API 호출 (스트리밍 모드)
      // session_id 가져오기 (새로고침 시에도 유지)
      const sessionId = getOrCreateChatOpsSessionId();

      const context = getApiContext();
      const tenantId = context?.tenantId || '';

      // ✅ 스트리밍 모드 복원: Tool 실행 + 진행 상황 표시
      const assistantMessageId = `assistant-${Date.now()}`;
      const statusMessageId = `status-${Date.now()}`;
      let assistantContent = '';
      let messageCreated = false; // 메시지 생성 여부 추적
      let statusMessageCreated = false; // 진행 상황 메시지 생성 여부

      await sendChatOpsMessageStreaming(
        tenantId,
        sessionId,
        message,
        // onChunk: 실시간 청크 처리
        (chunk: string) => {
          // content 이벤트 처리
          assistantContent += chunk;

          // ✅ 진행 상황 메시지 삭제 (있는 경우)
          if (statusMessageCreated) {
            aiLayerMenu.updateChatOpsMessage(statusMessageId, {
              content: '', // 빈 내용으로 업데이트 (삭제 효과)
              metadata: {
                isStreaming: false,
                hidden: true, // 숨김 플래그
              },
            });
          }

          // ✅ content 이벤트에서 메시지 생성 또는 업데이트
          if (messageCreated) {
            // 이미 생성된 경우 업데이트
            aiLayerMenu.updateChatOpsMessage(assistantMessageId, {
              content: assistantContent,
              metadata: {
                isStreaming: true,
              },
            });
          } else {
            // 첫 content 이벤트에서 메시지 생성
            messageCreated = true;
            aiLayerMenu.addChatOpsMessage({
              id: assistantMessageId,
              type: 'assistant_message',
              content: assistantContent,
              timestamp: new Date(),
              metadata: {
                isStreaming: true,
              },
            });
          }
        },
        // onComplete: 완료
        (fullResponse: string) => {
          // 메시지가 생성되지 않았다면 생성 (status 이벤트가 없는 경우)
          if (!messageCreated) {
            messageCreated = true;
            aiLayerMenu.addChatOpsMessage({
              id: assistantMessageId,
              type: 'assistant_message',
              content: assistantContent || fullResponse,
              timestamp: new Date(),
              metadata: {
                isStreaming: false,
              },
            });
          } else {
            // 최종 응답으로 업데이트
            aiLayerMenu.updateChatOpsMessage(assistantMessageId, {
              content: assistantContent || fullResponse,
              metadata: {
                isStreaming: false,
              },
            });
          }
        },
        // onError: 에러 처리
        (error: string) => {
          console.error('[ChatOps:Frontend] 스트리밍 에러:', error);

          let errorMessage = '응답 처리 중 오류가 발생했습니다.';
          if (error.includes('network') || error.includes('fetch')) {
            errorMessage = '네트워크 연결이 불안정합니다. 잠시 후 다시 시도해주세요.';
          } else if (error.includes('timeout')) {
            errorMessage = '응답 시간이 초과되었습니다. 다시 시도해주세요.';
          } else if (error.includes('401') || error.includes('auth')) {
            errorMessage = '인증이 만료되었습니다. 다시 로그인해주세요.';
          }

          // 메시지가 생성되지 않았다면 생성
          if (!messageCreated) {
            messageCreated = true;
            aiLayerMenu.addChatOpsMessage({
              id: assistantMessageId,
              type: 'assistant_message',
              content: `[오류] ${errorMessage}`,
              timestamp: new Date(),
              metadata: {
                isStreaming: false,
                hasError: true,
              },
            });
          } else {
            aiLayerMenu.updateChatOpsMessage(assistantMessageId, {
              content: `[오류] ${errorMessage}`,
              metadata: {
                isStreaming: false,
                hasError: true,
              },
            });
          }
        },
        // onStatus: 단계별 진행 상황 표시
        (status: string) => {
          if (!statusMessageCreated) {
            // 첫 번째 상태: 진행 상황 메시지 생성
            statusMessageCreated = true;
            aiLayerMenu.addChatOpsMessage({
              id: statusMessageId,
              type: 'assistant_message',
              content: status,
              timestamp: new Date(),
              metadata: {
                isStreaming: true,
                isStatusMessage: true, // 진행 상황 메시지 플래그
              },
            });
          } else {
            // 이후 상태: 진행 상황 메시지 업데이트
            aiLayerMenu.updateChatOpsMessage(statusMessageId, {
              content: status,
              metadata: {
                isStreaming: true,
                isStatusMessage: true,
              },
            });
          }
        }
      );
    } catch (error) {
      console.error('[ChatOps:Frontend] 에러 발생:', error);
      // P0: PII 마스킹 필수 (체크리스트.md 4. PII 마스킹)
      // error 객체는 PII가 포함될 수 있으므로 마스킹 필요
      const maskedError = maskPII(error);
      logError('App:ChatOps:SendMessage', maskedError);

      // 에러 메시지 추가
      // P0: 사용자에게 표시되는 에러 메시지도 PII 마스킹 적용
      let errorMessage = '메시지 전송에 실패했습니다.';
      if (error instanceof Error) {
        // 에러 타입별 사용자 친화적 메시지
        if (error.message.includes('AI 기능이 비활성화')) {
          errorMessage = 'AI 기능이 비활성화되어 있습니다. 설정에서 활성화해주세요.';
        } else if (error.message.includes('인증이 필요')) {
          errorMessage = '인증이 필요합니다. 다시 로그인해주세요.';
        } else if (error.message.includes('네트워크') || error.message.includes('fetch')) {
          errorMessage = '네트워크 오류가 발생했습니다. 연결을 확인하고 다시 시도해주세요.';
        } else {
          const maskedErrorMessage = maskPII(error.message);
          errorMessage = typeof maskedErrorMessage === 'string' ? maskedErrorMessage : '메시지 전송에 실패했습니다.';
        }
      }

      aiLayerMenu.addChatOpsMessage({
        id: `error-${Date.now()}`,
        type: 'assistant_message',
        content: errorMessage,
        timestamp: new Date(),
      });
    } finally {
      aiLayerMenu.setChatOpsLoading(false);
    }
  }, [aiLayerMenu]);

  // ChatOps 초기화 핸들러
  const handleChatOpsReset = useCallback(() => {
    aiLayerMenu.clearChatOpsMessages();
  }, [aiLayerMenu]);

  // URL과 에이전트 상태 동기화
  // /agent 경로 진입 시 에이전트 모드 활성화
  // 다른 경로 이동 시 에이전트 모드 비활성화
  const isAgentPath = location.pathname === '/agent';
  useEffect(() => {
    if (isAgentPath && !aiLayerMenu.isOpen) {
      // /agent 경로로 진입했는데 에이전트가 닫혀있으면 열기
      aiLayerMenu.open();
    } else if (!isAgentPath && aiLayerMenu.isOpen) {
      // 다른 경로로 이동했는데 에이전트가 열려있으면 닫기
      aiLayerMenu.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAgentPath]); // aiLayerMenu.isOpen을 dependency에서 제외하여 무한 루프 방지

  // 에이전트 버튼 클릭 핸들러 (라우트 기반)
  const handleAgentToggle = useCallback(() => {
    if (isAgentPath) {
      // 에이전트 페이지에서 버튼 클릭 시 이전 페이지로 이동 (또는 홈)
      safeNavigate('/home');
    } else {
      // 다른 페이지에서 버튼 클릭 시 에이전트 페이지로 이동
      safeNavigate('/agent');
    }
  }, [isAgentPath, safeNavigate]);

  // NOTE: 사이드바 아이템은 getSidebarItemsForRole()에서 생성합니다.

  /**
   * 권한 확인 헬퍼 함수
   * - DB의 role_permissions 테이블에서 권한 확인
   * - 해당 직급의 권한이 DB에 하나라도 있으면 DB만 사용 (명시적 권한 관리)
   * - 해당 직급의 권한이 DB에 전혀 없으면 기본 권한 사용 (초기 상태)
   * - 관리자 역할은 항상 전체 접근 허용
   * - 경로 매칭: /students 권한이 있으면 /students/home도 접근 가능
   */
  const hasPagePermission = (pagePath: string): boolean => {
    // 최고 관리자 역할은 항상 전체 접근 허용 (권한 설정 불가)
    if (userRole && ['admin', 'owner', 'super_admin'].includes(userRole)) {
      return true;
    }

    // 강사 직급이 없으면 staff, counselor 등 기타 역할 → 기본 허용
    if (!teacherPosition) {
      return true;
    }

    // 해당 직급의 권한이 DB에 있는지 확인
    const positionPermissions = rolePermissions?.filter(p => p.position === teacherPosition) || [];
    const hasPositionPermissionsInDB = positionPermissions.length > 0;

    if (hasPositionPermissionsInDB) {
      // DB에 권한이 있으면 DB 우선 사용, 없으면 기본 권한 fallback
      // 가장 구체적인 경로(긴 경로)가 먼저 매칭되도록 정렬
      const sortedPermissions = [...positionPermissions].sort(
        (a, b) => b.page_path.length - a.page_path.length
      );

      // 경로 매칭: pagePath가 DB 경로로 시작하면 매칭
      const permission = sortedPermissions.find(p => pagePath.startsWith(p.page_path));

      // DB에 명시적으로 권한이 있으면 DB 값 사용
      if (permission) {
        console.log('[hasPagePermission] DB 권한 사용:', {
          pagePath,
          permission: { page_path: permission.page_path, can_access: permission.can_access },
          result: permission.can_access,
        });
        return permission.can_access;
      }

      // DB에 해당 경로가 없으면 기본 권한으로 fallback
      console.log('[hasPagePermission] DB에 없음, 기본 권한 fallback:', { pagePath });
    }

    // DB에 권한이 전혀 없거나, DB에 해당 경로가 없으면 기본 권한 사용
    const defaultPaths = DEFAULT_PERMISSIONS[teacherPosition];
    if (defaultPaths.includes('*')) {
      console.log('[hasPagePermission] 기본 권한: 전체 접근');
      return true;
    }

    // 기본 권한도 구체적인 경로 우선 매칭
    const sortedDefaultPaths = [...defaultPaths].sort((a, b) => b.length - a.length);
    const hasDefaultAccess = sortedDefaultPaths.some(dp => pagePath.startsWith(dp));
    console.log('[hasPagePermission] 기본 권한 사용:', {
      pagePath,
      defaultPaths,
      result: hasDefaultAccess,
    });
    return hasDefaultAccess;
  };

  /**
   * 역할별 + 업종별 사이드바 메뉴 필터링 (Phase 3: Industry-Based Filtering)
   * ✅ Phase 4: 권한 기반 메뉴 필터링 (role_permissions 테이블 사용)
   *
   * 역할별 UI 단순화 원칙:
   * - Assistant: 출결만 노출
   * - Teacher: 홈, 학생 관리, 출결 관리, AI 분석만 노출 (수업 관리는 읽기 전용)
   * - Admin/Owner/Sub Admin: 전체 메뉴 노출
   * - 통계와 AI는 핵심 메뉴이므로 Advanced에 들어가면 안 됨
   * - 수업/강사관리, 수납/청구, 메시지/공지는 Advanced 메뉴 (일부 역할만)
   *
   * 업종별 페이지 가시성 (Phase 3):
   * - Academy/Gym: attendance=true, appointments=false
   * - Salon/Nail Salon: attendance=false, appointments=true
   * - Real Estate: billing=false, appointments=true, properties=true
   *
   * Advanced 메뉴 구조 (아키텍처 문서 4.8):
   * - 수업/강사관리
   * - 출결 설정
   * - 상품/청구 설정
   * - 메시지 템플릿/예약발송
   * - 정산/매출 상세
   * - 시스템 설정
   */
  const getSidebarItemsForRole = (role: TenantRole | undefined): SidebarItem[] => {
    if (!role) {
      // 역할이 아직 로드되지 않은 경우 빈 배열 반환
      return [];
    }

    // Advanced 메뉴 아이템 정의 (아키텍처 문서 4.8 참조)
    // ✅ Phase 3: 업종별 필터링 적용
    const advancedMenuChildren: SidebarItem[] = [];

    // ✅ 수업관리: classes 페이지가 visible일 때만 표시
    if (isPageVisible('classes')) {
      advancedMenuChildren.push({
        id: 'classes-advanced',
        label: terms.GROUP_LABEL + '관리',
        path: terms.ROUTES.CLASSES || '/classes',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 .83.18 2 2 0 0 0 .83-.18l8.58-3.9a1 1 0 0 0 0-1.831z"/>
            <path d="M16 17h6"/>
            <path d="M19 14v6"/>
            <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 .825.178"/>
            <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l2.116-.962"/>
          </svg>
        ),
      });
    }

    // ✅ 강사관리: teachers 페이지가 visible일 때만 표시
    if (isPageVisible('teachers')) {
      advancedMenuChildren.push({
        id: 'teachers-advanced',
        label: terms.PERSON_LABEL_SECONDARY + '관리',
        path: terms.ROUTES.TEACHERS || '/teachers',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 21h8"/>
            <path d="m15 5 4 4"/>
            <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
          </svg>
        ),
      });
    }

    // ✅ 수납관리: billing 페이지가 visible일 때만 표시
    if (isPageVisible('billing')) {
      advancedMenuChildren.push({
        id: 'billing-advanced',
        label: '수납관리',
        path: '/billing/home',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="5" rx="2"/>
            <line x1="2" x2="22" y1="10" y2="10"/>
          </svg>
        ),
      });
    }

    // ✅ 자동화 설정: automation 페이지가 visible일 때만 표시
    if (isPageVisible('automation')) {
      advancedMenuChildren.push({
        id: 'automation-settings-advanced',
        label: '자동화 설정',
        path: '/settings/automation',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        ),
      });
    }

    // ✅ 알림톡 설정: alimtalk 페이지가 visible일 때만 표시
    if (isPageVisible('alimtalk')) {
      advancedMenuChildren.push({
        id: 'alimtalk-settings-advanced',
        label: '알림톡 설정',
        path: '/settings/alimtalk',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        ),
      });
    }

    // ✅ 직급별 권한 설정: 관리자만 접근 가능
    advancedMenuChildren.push({
      id: 'permissions-settings-advanced',
      label: '권한 설정',
      path: '/settings/permissions',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
    });

    const advancedMenuItems: SidebarItem[] = [
      {
        id: 'advanced',
        label: '더보기',
        isAdvanced: true,
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 5H3"/>
            <path d="M15 12H3"/>
            <path d="M17 19H3"/>
          </svg>
        ),
        children: advancedMenuChildren,
      },
    ];

    // 기본 메뉴 아이템 (핵심 메뉴 - Advanced에 포함되지 않음)
    // ✅ Phase 3: 업종별 필터링 적용
    const coreMenuItems: SidebarItem[] = [
      {
        id: 'home',
        label: '대시보드',
        path: '/home',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"/>
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
          </svg>
        ),
      },
    ];

    // ✅ 학생/회원/고객 관리: primary 페이지가 visible일 때만 표시
    if (isPageVisible('primary')) {
      coreMenuItems.push({
        id: 'students',
        label: terms.PERSON_LABEL_PRIMARY + '관리',
        path: terms.ROUTES.PRIMARY_LIST || '/students/home',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" x2="9.01" y1="9" y2="9"/>
            <line x1="15" x2="15.01" y1="9" y2="9"/>
          </svg>
        ),
      });
    }

    // ✅ 출결관리: attendance 페이지가 visible일 때만 표시 (academy, gym만)
    if (isPageVisible('attendance')) {
      coreMenuItems.push({
        id: 'attendance',
        label: '출결관리',
        path: '/attendance',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.801 10A10 10 0 1 1 17 3.335"/>
            <path d="m9 11 3 3L22 4"/>
          </svg>
        ),
      });
    }

    // ✅ 예약관리: appointments 페이지가 visible일 때만 표시 (salon, nail_salon, real_estate만)
    if (isPageVisible('appointments')) {
      coreMenuItems.push({
        id: 'appointments',
        label: '예약관리',
        path: terms.ROUTES.APPOINTMENTS || '/appointments',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
            <line x1="16" x2="16" y1="2" y2="6"/>
            <line x1="8" x2="8" y1="2" y2="6"/>
            <line x1="3" x2="21" y1="10" y2="10"/>
          </svg>
        ),
      });
    }

    // ✅ 문자발송 (모든 업종 공통)
    coreMenuItems.push({
      id: 'notifications',
      label: '문자발송',
      path: '/notifications',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/>
          <rect x="2" y="4" width="20" height="16" rx="2"/>
        </svg>
      ),
    });

    // ✅ 통계분석: analytics 페이지가 visible일 때만 표시
    if (isPageVisible('analytics')) {
      coreMenuItems.push({
        id: 'analytics',
        label: '통계분석',
        path: '/analytics',
        icon: (
          <svg fill="none" viewBox="0 0 24 24">
            <path d="M5 21v-6"/>
            <path d="M12 21V9"/>
            <path d="M19 21V3"/>
          </svg>
        ),
      });
    }

    // ✅ 인공지능: ai 페이지가 visible일 때만 표시
    if (isPageVisible('ai')) {
      coreMenuItems.push({
        id: 'ai',
        label: '인공지능',
        path: '/ai',
        icon: (
          <svg fill="none" viewBox="0 0 24 24">
            <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>
          </svg>
        ),
      });
    }

    // Admin, Owner, Sub Admin, Super Admin: 전체 메뉴 노출 (핵심 메뉴 + Advanced 메뉴)
    if (['admin', 'owner', 'sub_admin', 'super_admin'].includes(role)) {
      return [...coreMenuItems, ...advancedMenuItems];
    }

    // Manager: 핵심 메뉴 + Advanced 메뉴 (수납/청구 포함)
    if (role === 'manager') {
      return [
        ...coreMenuItems.filter(item => ['home', 'students', 'attendance', 'appointments', 'analytics', 'ai'].includes(item.id)),
        ...advancedMenuItems.filter(item => item.id === 'advanced').map(item => ({
          ...item,
          children: item.children?.filter(child =>
            ['classes-advanced', 'teachers-advanced', 'billing-advanced'].includes(child.id)
          ),
        })),
      ];
    }

    // Staff: 핵심 메뉴 + Advanced 메뉴 (메시지/공지 포함)
    if (role === 'staff') {
      return [
        ...coreMenuItems.filter(item => ['home', 'students', 'attendance', 'appointments', 'notifications'].includes(item.id)),
        ...advancedMenuItems.filter(item => item.id === 'advanced').map(item => ({
          ...item,
          children: item.children?.filter(child =>
            ['classes-advanced', 'teachers-advanced'].includes(child.id)
          ),
        })),
      ];
    }

    // Counselor: 핵심 메뉴만 (Advanced 메뉴 없음)
    if (role === 'counselor') {
      return coreMenuItems.filter(item =>
        ['home', 'students', 'attendance', 'appointments'].includes(item.id)
      );
    }

    // Teacher: 권한 기반 필터링 (role_permissions 테이블 사용)
    // DB에서 설정된 권한에 따라 메뉴 노출
    if (role === 'teacher') {
      console.log('[getSidebarItemsForRole] Teacher 필터링 시작:', {
        coreMenuItemsCount: coreMenuItems.length,
        advancedMenuItemsCount: advancedMenuItems.length,
        advancedChildren: advancedMenuItems[0]?.children?.map(c => ({ id: c.id, path: c.path })),
      });

      const filteredCoreItems = coreMenuItems.filter(item => {
        if (!item.path) return true; // path가 없으면 보여줌
        const hasPermission = hasPagePermission(item.path);
        console.log('[Core 메뉴 필터링]', item.id, item.path, '→', hasPermission);
        return hasPermission;
      });

      const filteredAdvancedItems = advancedMenuItems
        .filter(item => item.id === 'advanced')
        .map(item => ({
          ...item,
          children: item.children?.filter(child => {
            if (!child.path) return true;
            const hasPermission = hasPagePermission(child.path);
            console.log('[Advanced 메뉴 필터링]', child.id, child.path, '→', hasPermission);
            return hasPermission;
          }),
        }))
        .filter(item => item.children && item.children.length > 0); // children이 비어있으면 제외

      console.log('[getSidebarItemsForRole] Teacher 필터링 결과:', {
        filteredCoreItemsCount: filteredCoreItems.length,
        filteredAdvancedItemsCount: filteredAdvancedItems.length,
        filteredAdvancedChildren: filteredAdvancedItems[0]?.children?.map(c => ({ id: c.id, path: c.path })),
      });

      return [...filteredCoreItems, ...filteredAdvancedItems];
    }

    // Assistant: 권한 기반 필터링 (role_permissions 테이블 사용)
    if (role === 'assistant') {
      const filteredCoreItems = coreMenuItems.filter(item => {
        if (!item.path) return true;
        return hasPagePermission(item.path);
      });

      const filteredAdvancedItems = advancedMenuItems
        .filter(item => item.id === 'advanced')
        .map(item => ({
          ...item,
          children: item.children?.filter(child => {
            if (!child.path) return true;
            return hasPagePermission(child.path);
          }),
        }))
        .filter(item => item.children && item.children.length > 0); // children이 비어있으면 제외

      return [...filteredCoreItems, ...filteredAdvancedItems];
    }

    // 기본값: 빈 배열
    return [];
  };

  // 역할별 필터링된 사이드바 아이템
  const sidebarItems = getSidebarItemsForRole(userRole as TenantRole | undefined);

  const handleSidebarItemClick = (item: SidebarItem) => {
    // P0: PII 마스킹 필수 (체크리스트.md 4. PII 마스킹)
    // 개발 환경에서도 PII 마스킹 적용
    const logData = {
      itemId: item.id,
      itemPath: item.path,
      currentPath: location.pathname,
      isAdvanced: item.isAdvanced,
      hasChildren: !!item.children,
    };
    const maskedLogData = maskPII(logData);
    logInfo('App:Sidebar:ItemClick', 'handleSidebarItemClick called', maskedLogData);

    // Advanced 메뉴는 Sidebar 컴포넌트에서 펼치기/접기 처리하므로 여기서는 무시
    if (item.isAdvanced && item.children && item.children.length > 0) {
      return;
    }

    // 일반 메뉴 클릭 시 경로 이동
    // [P0-2 수정] SSOT: safeNavigate 사용 (일관성, 내부적으로 isSafeInternalPath 검증)
    if (item.path) {
      // P0: item.path는 내부 경로이므로 PII 마스킹 불필요하지만 일관성을 위해 적용
      const maskedPath = maskPII(item.path);
      logInfo('App:Sidebar:Navigate', 'Navigating to', maskedPath);
      safeNavigate(item.path);
      logInfo('App:Sidebar:Navigate', 'Navigate called, new path should be', maskedPath);
    } else {
      // P0: PII 마스킹 필수
      const maskedItem = maskPII(item);
      logWarn('App:Sidebar:NoPath', 'Sidebar item has no path', maskedItem);
    }
  };

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      // [P0-2 수정] SSOT: safeNavigate 사용 (일관성)
      safeNavigate('/auth/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : '로그아웃에 실패했습니다.';
      showAlert(message, '오류');
    }
  };

  return (
    <>
      <Routes>
        {/* 인증이 필요 없는 라우트 - lazy loaded */}
        <Route path="/auth/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
        <Route path="/auth/signup" element={<Suspense fallback={<PageLoader />}><SignupPage /></Suspense>} />
        <Route path="/auth/select-tenant" element={<Suspense fallback={<PageLoader />}><TenantSelectionPage /></Suspense>} />

      {/* 인증이 필요한 라우트 */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <AppLayout
              header={{
                title: '디어쌤 학원관리',
                search: {
                  query: globalSearch.query,
                  onQueryChange: globalSearch.setQuery,
                  results: globalSearch.results,
                  loading: globalSearch.loading,
                  error: globalSearch.error,
                  onResultClick: (result: SearchResult) => {
                    void handleSearchResultClick(result);
                  },
                  placeholder: '학생, 수업, 보호자 검색 (Ctrl+K)',
                  inputPlaceholder: '학생, 수업, 보호자 등을 검색하세요...',
                  emptyStateMessage: '학생, 수업, 보호자, 상담 등을 검색할 수 있습니다.',
                  entityTypeLabels: {
                    student: '학생',
                    teacher: '강사',
                    class: '수업',
                    guardian: '보호자',
                    consultation: '상담',
                    announcement: '공지사항',
                    tag: '태그',
                  },
                },
                rightContent: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <AIToggle />
                    <AgentButton
                      isOpen={aiLayerMenu.isOpen}
                      onClick={handleAgentToggle}
                    />
                    <TimelineButton
                      onClick={() => setIsTimelineOpen(true)}
                    />
                    <ManualButton
                      isOpen={isManualPath}
                      onClick={handleManualToggle}
                    />
                  </div>
                ),
                userProfile,
                onLogout: () => {
                  void handleLogout();
                },
                onSettings: () => safeNavigate('/settings'),
              }}
              sidebar={{
                items: sidebarItems,
                currentPath: location.pathname,
                onItemClick: (item: SidebarItem) => {
                  void handleSidebarItemClick(item);
                },
              }}
            >
              <Routes>
                {/* 에이전트 모드 전용 라우트 - 새로고침해도 유지됨 */}
                <Route path="/agent" element={
                  <RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}>
                    <Suspense fallback={<PageLoader />}>
                      <AgentPage
                        chatOpsIndustryTerms={{
                          personLabel: terms.PERSON_LABEL_PRIMARY,
                          personLabelPlural: terms.PERSON_LABEL_PLURAL,
                          attendanceLabel: terms.ATTENDANCE_LABEL,
                          lateLabel: terms.LATE_LABEL,
                        }}
                        onChatOpsSendMessage={handleChatOpsSendMessage}
                        onChatOpsReset={handleChatOpsReset}
                        userName={session?.user?.user_metadata?.full_name as string | undefined}
                        userEmail={session?.user?.email}
                      />
                    </Suspense>
                  </RoleBasedRoute>
                } />
                <Route path="/home" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><HomePage /></Suspense></RoleBasedRoute>} />
                <Route path="/home/all-cards" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><AllCardsPage /></Suspense></RoleBasedRoute>} />
                <Route path="/students/home" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><StudentsHomePage /></Suspense></RoleBasedRoute>} />
                <Route path="/students/tasks" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><StudentTasksPage /></Suspense></RoleBasedRoute>} />
                <Route path="/students/list" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><StudentsListPage /></Suspense></RoleBasedRoute>} />
                <Route path="/students" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><StudentsHomePage /></Suspense></RoleBasedRoute>} />
                {/* StudentDetailPage는 레이어 메뉴로 통합됨 - URL은 StudentsPage로 리다이렉트 */}
                <Route path="/students/:id" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><StudentsListPage /></Suspense></RoleBasedRoute>} />
                <Route path="/students/:id/counsel" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'counselor', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><StudentsListPage /></Suspense></RoleBasedRoute>} />
                <Route path="/students/:id/attendance" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><StudentsListPage /></Suspense></RoleBasedRoute>} />
                <Route path="/students/:id/risk" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'counselor', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><StudentsListPage /></Suspense></RoleBasedRoute>} />
                <Route path="/students/:id/welcome" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><StudentsListPage /></Suspense></RoleBasedRoute>} />
                {/* ✅ Phase 3: 수업관리 - classes 페이지가 visible일 때만 접근 가능 */}
                <Route path="/classes" element={<IndustryBasedRoute page="classes"><RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><ClassesPage /></Suspense></RoleBasedRoute></IndustryBasedRoute>} />
                <Route path="/classes/:id" element={<IndustryBasedRoute page="classes"><RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><ClassesPage /></Suspense></RoleBasedRoute></IndustryBasedRoute>} />
                {/* ✅ Phase 3: 강사관리 - teachers 페이지가 visible일 때만 접근 가능 */}
                <Route path="/teachers" element={<IndustryBasedRoute page="teachers"><RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><TeachersPage /></Suspense></RoleBasedRoute></IndustryBasedRoute>} />
                {/* ✅ Phase 3: 출결관리 - attendance 페이지가 visible일 때만 접근 가능 */}
                <Route path="/attendance" element={<IndustryBasedRoute page="attendance"><RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><AttendancePage /></Suspense></RoleBasedRoute></IndustryBasedRoute>} />
                <Route path="/kiosk-check-in" element={<Suspense fallback={<PageLoader />}><KioskCheckInPage /></Suspense>} />
                {/* ✅ Phase 3: 수납관리 - billing 페이지가 visible일 때만 접근 가능 */}
                <Route path="/billing/home" element={<IndustryBasedRoute page="billing"><RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><BillingHomePage /></Suspense></RoleBasedRoute></IndustryBasedRoute>} />
                <Route path="/billing/list" element={<IndustryBasedRoute page="billing"><RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><BillingPage /></Suspense></RoleBasedRoute></IndustryBasedRoute>} />
                <Route path="/billing" element={<IndustryBasedRoute page="billing"><RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><BillingHomePage /></Suspense></RoleBasedRoute></IndustryBasedRoute>} />
                <Route path="/notifications" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><NotificationsPage /></Suspense></RoleBasedRoute>} />
                {/* ✅ Phase 3: 통계분석 - analytics 페이지가 visible일 때만 접근 가능 */}
                <Route path="/analytics" element={<IndustryBasedRoute page="analytics"><RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense></RoleBasedRoute></IndustryBasedRoute>} />
                {/* ✅ Phase 3: 인공지능 - ai 페이지가 visible일 때만 접근 가능 */}
                <Route path="/ai" element={<IndustryBasedRoute page="ai"><RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'counselor', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><AIPage /></Suspense></RoleBasedRoute></IndustryBasedRoute>} />
                {/* ✅ Phase 3: 자동화 설정 - automation 페이지가 visible일 때만 접근 가능 */}
                <Route path="/settings/automation" element={<IndustryBasedRoute page="automation"><RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'super_admin']}><Suspense fallback={<PageLoader />}><AutomationSettingsPage /></Suspense></RoleBasedRoute></IndustryBasedRoute>} />
                {/* ✅ Phase 3: 알림톡 설정 - alimtalk 페이지가 visible일 때만 접근 가능 */}
                <Route path="/settings/alimtalk" element={<IndustryBasedRoute page="alimtalk"><RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'super_admin']}><Suspense fallback={<PageLoader />}><AlimtalkSettingsPage /></Suspense></RoleBasedRoute></IndustryBasedRoute>} />
                {/* ✅ 직급별 권한 설정 - 관리자만 접근 가능 */}
                <Route path="/settings/permissions" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'super_admin']}><Suspense fallback={<PageLoader />}><SettingsPermissionsPage /></Suspense></RoleBasedRoute>} />
                <Route path="/settings/intent-patterns" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'super_admin']}><Suspense fallback={<PageLoader />}><IntentPatternsPage /></Suspense></RoleBasedRoute>} />
                <Route
                  path="/super-admin"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AuthGuard>
                        <SchemaEditorPage />
                      </AuthGuard>
                    </Suspense>
                  }
                />
                {/* 매뉴얼 페이지 - 모든 인증된 사용자 접근 가능 */}
                <Route path="/manual" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><ManualPage /></Suspense></RoleBasedRoute>} />
                <Route path="/" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><HomePage /></Suspense></RoleBasedRoute>} />
                <Route path="*" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><HomePage /></Suspense></RoleBasedRoute>} />
              </Routes>
              </AppLayout>
            </Suspense>
          </ProtectedRoute>
        }
      />
      </Routes>

      {/* 타임라인 모달 - lazy loaded */}
      {isTimelineOpen && (
        <Suspense fallback={null}>
          <TimelineModal
            isOpen={isTimelineOpen}
            onClose={() => setIsTimelineOpen(false)}
            executionAuditRuns={aiLayerMenu.executionAuditRuns}
            executionAuditLoading={aiLayerMenu.executionAuditLoading}
            executionAuditHasMore={aiLayerMenu.executionAuditHasMore}
            executionAuditNextCursor={aiLayerMenu.executionAuditNextCursor}
            executionAuditStepsByRunId={aiLayerMenu.executionAuditStepsByRunId}
            executionAuditStepsLoading={aiLayerMenu.executionAuditStepsLoading}
            onExecutionAuditLoadMore={(cursor) => {
              aiLayerMenu.setExecutionAuditLoading(true);
              aiLayerMenu.setExecutionAuditNextCursor(cursor);
            }}
            onExecutionAuditLoadSteps={(runId) => {
              aiLayerMenu.setExecutionAuditStepsLoading(runId, true);
            }}
            onExecutionAuditRowClick={handleExecutionAuditRowClick}
            onExecutionAuditFilterChange={aiLayerMenu.setExecutionAuditFilters}
            executionAuditInitialFilters={aiLayerMenu.executionAuditFilters}
            executionAuditAvailableOperationTypes={aiLayerMenu.executionAuditAvailableOperationTypes}
          />
        </Suspense>
      )}
    </>
  );
}

function App() {
  return <AppContent />;
}

export default App;
