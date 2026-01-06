import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Suspense, lazy, useMemo, useEffect, useCallback } from 'react';
import {
  Button,
  useModal,
  useTheme,
  AIToggle,
  useAILayerMenu,
  getOrCreateChatOpsSessionId,
} from '@ui-core/react';
import type { SidebarItem, ExecutionAuditRun } from '@ui-core/react';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleBasedRoute } from './components/RoleBasedRoute';
import { IndustryBasedRoute } from './components/IndustryBasedRoute';
import { useLogout, useUserRole } from '@hooks/use-auth';
import { useExecutionAuditRuns, fetchExecutionAuditSteps } from '@hooks/use-execution-audit';
import { sendChatOpsMessageStreaming } from '@hooks/use-chatops';
import { useIndustryConfig } from '@hooks/use-industry-config';
import { getApiContext } from '@api-sdk/core';
import type { TenantRole } from '@core/tenancy';
import { createSafeNavigate, logError, logWarn, logInfo } from './utils';
import { maskPII } from '@core/pii-utils';

// 큰 컴포넌트는 lazy loading으로 전환 (초기 로드 번들 크기 감소)
const AppLayout = lazy(() => import('@ui-core/react').then(m => ({ default: m.AppLayout })));

// 핵심 페이지는 즉시 로드 (초기 로딩 속도)
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { TenantSelectionPage } from './pages/TenantSelectionPage';

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
const IntentPatternsPage = lazy(() => import('./pages/IntentPatternsPage').then(m => ({ default: m.IntentPatternsPage })));
const SchemaEditorPage = lazy(() => import('../../super-admin/src/pages/SchemaEditorPage').then(m => ({ default: m.SchemaEditorPage })));
const AuthGuard = lazy(() => import('../../super-admin/src/components/AuthGuard').then(m => ({ default: m.AuthGuard })));

// 로딩 컴포넌트
// [SSOT] 하드코딩 금지: CSS 변수 사용
const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'var(--spacing-3xl)' }}>
    <div>로딩 중...</div>
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
  const { data: userRole } = useUserRole();
  const aiLayerMenu = useAILayerMenu();
  // 업종별 설정 (Phase 3: Industry-Based Page Visibility)
  const { terms, isPageVisible } = useIndustryConfig();

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

  // Location 변경 추적 (필요시 디버깅용으로 활성화)
  // useEffect(() => {
  //   console.log('[App.tsx] Location changed:', {
  //     pathname: location.pathname,
  //     search: location.search,
  //     hash: location.hash,
  //   });
  // }, [location]);

  // NOTE: 사이드바 아이템은 getSidebarItemsForRole()에서 생성합니다.

  /**
   * 역할별 + 업종별 사이드바 메뉴 필터링 (Phase 3: Industry-Based Filtering)
   *
   * 역할별 UI 단순화 원칙:
   * - Assistant: 출결만 노출
   * - Teacher: 홈, 학생 관리, 출결 관리, AI 분석만 노출 (수업 관리는 읽기 전용)
   * - Admin/Owner/Sub Admin: 전체 메뉴 노출
   * - 통계와 AI는 핵심 메뉴이므로 Advanced에 들어가면 안 됨
   * - 수업/강사 관리, 수납/청구, 메시지/공지는 Advanced 메뉴 (일부 역할만)
   *
   * 업종별 페이지 가시성 (Phase 3):
   * - Academy/Gym: attendance=true, appointments=false
   * - Salon/Nail Salon: attendance=false, appointments=true
   * - Real Estate: billing=false, appointments=true, properties=true
   *
   * Advanced 메뉴 구조 (아키텍처 문서 4.8):
   * - 반/강사 관리
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
        label: terms.GROUP_LABEL + ' 관리',
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
        label: terms.PERSON_LABEL_SECONDARY + ' 관리',
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
        label: terms.PERSON_LABEL_PRIMARY + ' 관리',
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

    // 문자발송 (모든 업종 공통)
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

    // Teacher: 핵심 메뉴만 (Advanced 메뉴 없음, 수업 관리는 읽기 전용)
    // 아키텍처 문서 2.3: "오늘의 반 + 학생 리스트 + 출결 체크만 노출"
    // 아키텍처 문서 2.4: "/analytics/** 접근 금지 (요약만 제공)"
    // 통계와 AI는 핵심 메뉴이므로 Advanced에 들어가면 안 됨 (4.8)
    if (role === 'teacher') {
      return coreMenuItems.filter(item =>
        ['home', 'students', 'attendance', 'appointments', 'ai'].includes(item.id)
        // analytics는 제외 (요약만 제공, 상세 분석 제한)
      );
    }

    // Assistant: 출결만 노출 (아키텍처 문서 2.3: "출결 버튼만 노출")
    if (role === 'assistant') {
      return coreMenuItems.filter(item => item.id === 'attendance');
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
    <Routes>
      {/* 인증이 필요 없는 라우트 */}
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/signup" element={<SignupPage />} />
      <Route path="/auth/select-tenant" element={<TenantSelectionPage />} />

      {/* 인증이 필요한 라우트 */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout
              header={{
                title: '디어쌤 학원관리',
                rightContent: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                    <AIToggle />
                    <Button
                      variant={aiLayerMenu.isOpen ? 'solid' : 'outline'}
                      size="sm"
                      onClick={aiLayerMenu.toggle}
                      aria-label="AI 대화창 열기/닫기"
                    >
                      <div>💬</div> AI
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                    >
                      로그아웃
                    </Button>
                  </div>
                ),
              }}
              sidebar={{
                items: sidebarItems,
                currentPath: location.pathname,
                onItemClick: handleSidebarItemClick,
              }}
              chatOpsIndustryTerms={{
                personLabel: terms.PERSON_LABEL_PRIMARY,
                personLabelPlural: terms.PERSON_LABEL_PLURAL,
                attendanceLabel: terms.ATTENDANCE_LABEL,
                lateLabel: terms.LATE_LABEL,
              }}
              onChatOpsSendMessage={handleChatOpsSendMessage}
              onChatOpsReset={handleChatOpsReset}
              onExecutionAuditRowClick={handleExecutionAuditRowClick}
            >
              <Routes>
                <Route path="/home" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><HomePage /></RoleBasedRoute>} />
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
                <Route path="/notifications" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><NotificationsPage /></Suspense></RoleBasedRoute>} />
                {/* ✅ Phase 3: 통계분석 - analytics 페이지가 visible일 때만 접근 가능 */}
                <Route path="/analytics" element={<IndustryBasedRoute page="analytics"><RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense></RoleBasedRoute></IndustryBasedRoute>} />
                {/* ✅ Phase 3: 인공지능 - ai 페이지가 visible일 때만 접근 가능 */}
                <Route path="/ai" element={<IndustryBasedRoute page="ai"><RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'counselor', 'staff', 'manager', 'super_admin']}><Suspense fallback={<PageLoader />}><AIPage /></Suspense></RoleBasedRoute></IndustryBasedRoute>} />
                {/* ✅ Phase 3: 자동화 설정 - automation 페이지가 visible일 때만 접근 가능 */}
                <Route path="/settings/automation" element={<IndustryBasedRoute page="automation"><RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'super_admin']}><Suspense fallback={<PageLoader />}><AutomationSettingsPage /></Suspense></RoleBasedRoute></IndustryBasedRoute>} />
                {/* ✅ Phase 3: 알림톡 설정 - alimtalk 페이지가 visible일 때만 접근 가능 */}
                <Route path="/settings/alimtalk" element={<IndustryBasedRoute page="alimtalk"><RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'super_admin']}><Suspense fallback={<PageLoader />}><AlimtalkSettingsPage /></Suspense></RoleBasedRoute></IndustryBasedRoute>} />
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
                <Route path="/" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><HomePage /></RoleBasedRoute>} />
                <Route path="*" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><HomePage /></RoleBasedRoute>} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
