/**
 * KioskCheckIn 페이지 매뉴얼
 *
 * [자동 생성] 이 파일은 generate-manual-draft.ts로 생성된 초안입니다.
 * [TODO] 마크가 있는 부분을 실제 내용으로 교체해주세요.
 */

import type { ManualPage } from '../../../types/manual';

export const kioskcheckinManual: ManualPage = {
  id: 'kioskcheckin',
  title: 'KioskCheckIn',
  description: '[TODO: KioskCheckIn 페이지에 대한 간단한 설명을 입력해주세요.]',
  icon: 'FileText',
  lastUpdated: '2026-01-25',
  sections: [
    {
      id: 'intro',
      title: '이 화면, 언제 사용하나요?',
      type: 'intro' as const,
      intro: 'KioskCheckIn 페이지입니다. [TODO: 이 페이지의 주요 목적과 사용 시점을 설명해주세요.]',
    },
    {
      id: 'features',
      title: '주요 기능',
      type: 'features' as const,
      features: [
        '모달/다이얼로그 표시 : [TODO: 상세 설명 추가]',
        '상태 관리 : [TODO: 상세 설명 추가]',
        '카드 형태 정보 표시 : [TODO: 상세 설명 추가]',
        '텍스트 입력 : [TODO: 상세 설명 추가]',
        '액션 버튼 : [TODO: 상세 설명 추가]',
      ],
    },
    {
      id: 'steps',
      title: '단계별 사용법',
      type: 'steps' as const,
      stepGuides: [
        {
          title: 'KioskCheckIn 기본 사용법',
          steps: [
            { step: 1, content: '왼쪽 메뉴에서 "KioskCheckIn"을 클릭하여 이동합니다.' },
            { step: 2, content: '[TODO: 두 번째 단계를 설명해주세요.]' },
            { step: 3, content: '[TODO: 세 번째 단계를 설명해주세요.]' },
          ],
        },
      ],
    },
  ],
};
