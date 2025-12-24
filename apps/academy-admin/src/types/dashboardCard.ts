/**
 * DashboardCard 타입 정의 (공통)
 *
 * [불변 규칙] HomePage와 AllCardsPage에서 공통 사용
 * [불변 규칙] SSOT 원칙 준수: 타입 정의는 이 파일에만 존재
 */

import type { StudentTaskCard } from '@hooks/use-student';

export interface EmergencyCard {
  id: string;
  type: 'emergency';
  title: string;
  message: string;
  priority: number;
  action_url?: string;
}

export interface AIBriefingCard {
  id: string;
  type: 'ai_briefing';
  title: string;
  summary: string;
  insights: string[];
  created_at: string;
  action_url?: string; // 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동
}

export interface ClassCard {
  id: string;
  type: 'class';
  class_name: string;
  start_time: string;
  student_count: number;
  attendance_count: number;
  action_url: string;
}

export interface StatsCard {
  id: string;
  type: 'stats';
  title: string;
  value: string;
  unit?: string;
  trend?: string;
  action_url?: string;
  /** 그래프 데이터 키 (daily_store_metrics 테이블의 필드명) */
  chartDataKey?: 'student_count' | 'revenue' | 'attendance_rate' | 'new_enrollments' | 'late_rate' | 'absent_rate' | 'active_student_count' | 'inactive_student_count' | 'avg_students_per_class' | 'avg_capacity_rate' | 'arpu';
}

export interface BillingSummaryCard {
  id: string;
  type: 'billing_summary';
  title: string;
  expected_collection_rate: number;
  unpaid_count: number;
  action_url: string;
  priority?: number; // 정본 규칙: context 기반 가중치
}

export type DashboardCard = EmergencyCard | AIBriefingCard | ClassCard | StatsCard | BillingSummaryCard | StudentTaskCard;

