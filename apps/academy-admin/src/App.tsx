import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import React, { Suspense, lazy, useMemo, useEffect, useCallback, useState } from 'react';
import {
  useModal,
  useTheme,
  AIToggle,
  useAILayerMenu,
  getOrCreateChatOpsSessionId,
  useGlobalSearch,
  ErrorBoundary,
} from '@ui-core/react';
import type { SearchResult, SidebarItem, ExecutionAuditRun } from '@ui-core/react';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleBasedRoute } from './components/RoleBasedRoute';
import { IndustryBasedRoute } from './components/IndustryBasedRoute';
import { AgentButton, TimelineButton, ManualButton } from './components/navigation';
import { PageLoader } from './components/layout';
import { useLogout, useUserRole, useSession } from '@hooks/use-auth';
import { useExecutionAuditRuns, fetchExecutionAuditSteps } from '@hooks/use-execution-audit';
import { sendChatOpsMessageStreaming } from '@hooks/use-chatops';
import { useIndustryConfig } from '@hooks/use-industry-config';
import { getApiContext } from '@api-sdk/core';
import type { TenantRole } from '@core/tenancy';
import { useCurrentTeacherPosition, useRolePermissions } from '@hooks/use-class';
import { createSafeNavigate, logError, logWarn, logInfo, getSidebarItemsForRole } from './utils';
import { maskPII } from '@core/pii-utils';
import { Agentation } from 'agentation';
import { ProactiveAlertBanner } from './components/ProactiveAlertBanner';

// 버튼 컴포넌트들은 ./components/navigation에서 import

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
// 통합 설정 페이지 (자동화, 알림톡, 권한 통합)
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const IntentPatternsPage = lazy(() => import('./pages/IntentPatternsPage').then(m => ({ default: m.IntentPatternsPage })));
const SchemaEditorPage = lazy(() => import('../../super-admin/src/pages/SchemaEditorPage').then(m => ({ default: m.SchemaEditorPage })));
const AuthGuard = lazy(() => import('../../super-admin/src/components/AuthGuard').then(m => ({ default: m.AuthGuard })));
const AgentPage = lazy(() => import('./pages/AgentPage').then(m => ({ default: m.AgentPage })));
const ManualPage = lazy(() => import('./pages/ManualPage').then(m => ({ default: m.ManualPage })));

// 로딩 컴포넌트는 ./components/layout에서 import

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

    console.log('[GlobalSearch] 검색 시작:', { query: input.query, tenantId, entity_types: input.entity_types });

    if (!tenantId) {
      console.error('[GlobalSearch] Tenant ID를 찾을 수 없습니다');
      throw new Error('Tenant ID를 찾을 수 없습니다. 로그인 상태를 확인해주세요.');
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

      const entityTypes = input.entity_types || ['student', 'teacher', 'class', 'guardian', 'consultation', 'announcement', 'tag'];
      const rpcParams = {
        p_tenant_id: tenantId,
        p_query: input.query,
        p_entity_types: entityTypes.join(','),
        p_limit: input.limit || 20,
      };

      const response = await apiClient.callRPC<GlobalSearchResult[]>('global_search', rpcParams);

      if (!response.success) {
        throw new Error(`검색 실패: ${response.error?.message || '알 수 없는 오류'}`);
      }

      const results = response.data || [];
      console.log('[GlobalSearch] 검색 결과 반환:', results.length, '건');

      return results.map((item) => ({
        id: item.id,
        entity_type: item.entity_type as SearchResult['entity_type'],
        title: item.title,
        subtitle: item.subtitle,
        relevance: item.relevance,
        created_at: item.created_at,
      }));
    } catch (error) {
      console.error('[GlobalSearch] 예외 발생:', error);
      throw error;
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

    // P1-1 수정: Promise.all 에러 핸들링 추가
    Promise.all(
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
    ).catch((error) => {
      // P1-1: Promise.all 전체 실패 시 에러 로깅
      const maskedError = maskPII(error);
      logError('App:ExecutionAudit:LoadSteps:BatchFailed', maskedError);
    });
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

  // 역할별 필터링된 사이드바 아이템 (utils/sidebar-utils.tsx에서 import한 함수 사용)
  const sidebarItems = useMemo(() => getSidebarItemsForRole({
    userRole: userRole as TenantRole | undefined,
    teacherPosition,
    rolePermissions,
    terms,
    isPageVisible,
  }), [userRole, teacherPosition, rolePermissions, terms, isPageVisible]);

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
            <ErrorBoundary
              fallback={
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <h2 style={{ color: 'var(--color-red-600)', marginBottom: '1rem' }}>
                    오류가 발생했습니다
                  </h2>
                  <p style={{ marginBottom: '1rem' }}>
                    페이지를 불러오는 중 문제가 발생했습니다.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: 'var(--color-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    페이지 새로고침
                  </button>
                </div>
              }
              onError={(error, errorInfo) => {
                // Sentry 등 에러 트래킹 서비스로 전송
                logError('App:ErrorBoundary', { error: maskPII(error), errorInfo: maskPII(errorInfo) });
              }}
            >
            <Suspense fallback={<PageLoader />}>
              <AppLayout
              header={{
                title: `디어쌤 ${terms.PERSON_LABEL_PRIMARY}관리`,
                onTitleClick: () => safeNavigate('/home'),
                search: {
                  query: globalSearch.query,
                  onQueryChange: globalSearch.setQuery,
                  results: globalSearch.results,
                  loading: globalSearch.loading,
                  error: globalSearch.error,
                  onResultClick: (result: SearchResult) => {
                    void handleSearchResultClick(result);
                  },
                  placeholder: `${terms.PERSON_LABEL_PRIMARY}, ${terms.GROUP_LABEL}, ${terms.GUARDIAN_LABEL} 검색 (Ctrl+K)`,
                  inputPlaceholder: `${terms.PERSON_LABEL_PRIMARY}, ${terms.GROUP_LABEL}, ${terms.GUARDIAN_LABEL} 등을 검색하세요...`,
                  emptyStateMessage: `${terms.PERSON_LABEL_PRIMARY}, ${terms.GROUP_LABEL}, ${terms.GUARDIAN_LABEL}, 상담 등을 검색할 수 있습니다.`,
                  entityTypeLabels: {
                    student: terms.PERSON_LABEL_PRIMARY,
                    teacher: terms.PERSON_LABEL_SECONDARY,
                    class: terms.GROUP_LABEL,
                    guardian: terms.GUARDIAN_LABEL,
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
                {/* ✅ 통합 설정 페이지 (매장 정보, 자동화, 알림톡, 권한) - 관리자만 접근 가능 */}
                <Route path="/settings" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'super_admin']}><Suspense fallback={<PageLoader />}><SettingsPage /></Suspense></RoleBasedRoute>} />
                <Route path="/settings/store" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'super_admin']}><Suspense fallback={<PageLoader />}><SettingsPage /></Suspense></RoleBasedRoute>} />
                <Route path="/settings/automation" element={<IndustryBasedRoute page="automation"><RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'super_admin']}><Suspense fallback={<PageLoader />}><SettingsPage /></Suspense></RoleBasedRoute></IndustryBasedRoute>} />
                <Route path="/settings/permissions" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'super_admin']}><Suspense fallback={<PageLoader />}><SettingsPage /></Suspense></RoleBasedRoute>} />
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
            </ErrorBoundary>
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
  return (
    <>
      <AppContent />
      {/* 선제적 알림 배너 (AI 기반) */}
      <ProactiveAlertBanner />
      {/* 개발 환경에서만 agentation 활성화 */}
      {import.meta.env.DEV && <Agentation />}
    </>
  );
}

export default App;
