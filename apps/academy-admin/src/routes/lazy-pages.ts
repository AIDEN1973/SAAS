/**
 * Lazy-loaded 페이지 컴포넌트 정의
 * 코드 스플리팅으로 초기 번들 크기 감소
 */
import { lazy } from 'react';

// 레이아웃 컴포넌트
export const AppLayout = lazy(() => import('@ui-core/react').then(m => ({ default: m.AppLayout })));
export const TimelineModal = lazy(() => import('@ui-core/react').then(m => ({ default: m.TimelineModal })));

// 핵심 페이지 (초기 로딩 번들)
export const HomePage = lazy(() => import('../pages/HomePage').then(m => ({ default: m.HomePage })));
export const LoginPage = lazy(() => import('../pages/LoginPage').then(m => ({ default: m.LoginPage })));
export const SignupPage = lazy(() => import('../pages/SignupPage').then(m => ({ default: m.SignupPage })));
export const TenantSelectionPage = lazy(() => import('../pages/TenantSelectionPage').then(m => ({ default: m.TenantSelectionPage })));

// 나머지 페이지 (지연 로딩)
export const StudentsHomePage = lazy(() => import('../pages/StudentsHomePage').then(m => ({ default: m.StudentsHomePage })));
export const StudentsListPage = lazy(() => import('../pages/StudentsListPage').then(m => ({ default: m.StudentsListPage })));
export const ClassesPage = lazy(() => import('../pages/ClassesPage').then(m => ({ default: m.ClassesPage })));
export const TeachersPage = lazy(() => import('../pages/TeachersPage').then(m => ({ default: m.TeachersPage })));
export const AttendancePage = lazy(() => import('../pages/AttendancePage').then(m => ({ default: m.AttendancePage })));
export const KioskCheckInPage = lazy(() => import('../pages/KioskCheckInPage').then(m => ({ default: m.KioskCheckInPage })));
export const BillingPage = lazy(() => import('../pages/BillingPage').then(m => ({ default: m.BillingPage })));
export const BillingHomePage = lazy(() => import('../pages/BillingHomePage').then(m => ({ default: m.BillingHomePage })));
export const NotificationsPage = lazy(() => import('../pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
export const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
export const AIPage = lazy(() => import('../pages/AIPage').then(m => ({ default: m.AIPage })));
export const AllCardsPage = lazy(() => import('../pages/AllCardsPage').then(m => ({ default: m.AllCardsPage })));
export const StudentTasksPage = lazy(() => import('../pages/StudentTasksPage').then(m => ({ default: m.StudentTasksPage })));
export const AutomationSettingsPage = lazy(() => import('../pages/AutomationSettingsPage').then(m => ({ default: m.AutomationSettingsPage })));
export const AlimtalkSettingsPage = lazy(() => import('../pages/AlimtalkSettingsPage').then(m => ({ default: m.AlimtalkSettingsPage })));
export const SettingsPermissionsPage = lazy(() => import('../pages/SettingsPermissionsPage').then(m => ({ default: m.SettingsPermissionsPage })));
export const IntentPatternsPage = lazy(() => import('../pages/IntentPatternsPage').then(m => ({ default: m.IntentPatternsPage })));
export const AgentPage = lazy(() => import('../pages/AgentPage').then(m => ({ default: m.AgentPage })));
export const ManualPage = lazy(() => import('../pages/ManualPage').then(m => ({ default: m.ManualPage })));

// 슈퍼 어드민 페이지
export const SchemaEditorPage = lazy(() => import('../../../super-admin/src/pages/SchemaEditorPage').then(m => ({ default: m.SchemaEditorPage })));
export const AuthGuard = lazy(() => import('../../../super-admin/src/pages/SchemaEditorPage').then(() => import('../../../super-admin/src/components/AuthGuard')).then(m => ({ default: m.AuthGuard })));
