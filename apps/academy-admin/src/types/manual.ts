/**
 * 온라인 매뉴얼 타입 정의
 *
 * [불변 규칙] 모든 타입은 명확하게 정의하고 주석을 작성합니다.
 */

/** 알림 박스 타입 */
export type AlertType = 'info' | 'warning' | 'success' | 'error';

/** 알림 박스 */
export interface ManualAlert {
  /** 알림 타입 */
  type: AlertType;
  /** 알림 내용 */
  content: string;
}

/** 단계별 가이드 아이템 */
export interface ManualStep {
  /** 단계 번호 */
  step: number;
  /** 단계 내용 */
  content: string;
}

/** 단계별 가이드 섹션 */
export interface ManualStepGuide {
  /** 가이드 제목 */
  title: string;
  /** 단계 목록 */
  steps: ManualStep[];
  /** 가이드 하단 알림 */
  alert?: ManualAlert;
}

/** 화면 설명 아이템 */
export interface ManualScreenItem {
  /** 아이템 제목 */
  title: string;
  /** 아이템 설명 */
  description: string;
}

/** 화면 설명 그룹 */
export interface ManualScreenGroup {
  /** 그룹 제목 */
  title: string;
  /** 아이템 목록 */
  items: ManualScreenItem[];
}

/** 팁/주의사항 아이템 */
export interface ManualTipItem {
  /** 아이템 내용 */
  content: string;
}

/** 팁/주의사항 그룹 */
export interface ManualTipGroup {
  /** 그룹 제목 */
  title: string;
  /** 그룹 타입 (warning: 주의사항, tip: 유용한 팁) */
  type: 'warning' | 'tip';
  /** 아이템 목록 */
  items: ManualTipItem[];
}

/** 매뉴얼 섹션 */
export interface ManualSection {
  /** 섹션 ID */
  id: string;
  /** 섹션 제목 */
  title: string;
  /** 섹션 타입 */
  type: 'intro' | 'features' | 'steps' | 'screen' | 'tips' | 'technical' | 'custom';
  /** 섹션 소개 텍스트 (intro 타입) */
  intro?: string;
  /** 기능 목록 (features 타입) */
  features?: string[];
  /** 단계별 가이드 목록 (steps 타입) */
  stepGuides?: ManualStepGuide[];
  /** 화면 설명 그룹 목록 (screen 타입) */
  screenGroups?: ManualScreenGroup[];
  /** 팁/주의사항 그룹 목록 (tips 타입) */
  tipGroups?: ManualTipGroup[];
  /** 기술적 특징 목록 (technical 타입) */
  technicalFeatures?: string[];
  /** 커스텀 컨텐츠 (custom 타입, Markdown) */
  content?: string;
  /** 하위 섹션 */
  subsections?: ManualSection[];
}

export interface ManualPage {
  /** 페이지 ID (라우트 경로와 매칭) */
  id: string;
  /** 페이지 제목 */
  title: string;
  /** 페이지 설명 */
  description: string;
  /** 페이지 아이콘 (lucide-react 아이콘 이름) */
  icon?: string;
  /** 매뉴얼 섹션 목록 */
  sections: ManualSection[];
  /** 마지막 업데이트 날짜 */
  lastUpdated?: string;
}

export interface ManualCategory {
  /** 카테고리 ID */
  id: string;
  /** 카테고리 제목 */
  title: string;
  /** 카테고리 내 페이지 목록 */
  pages: ManualPage[];
}
