/**
 * 타임라인 매뉴얼
 *
 * [불변 규칙] 매뉴얼 컨텐츠는 명확하고 이해하기 쉽게 작성합니다.
 */

import type { ManualPage } from '../../types/manual';

export const timelineManual: ManualPage = {
  id: 'timeline',
  title: '타임라인',
  description: '학원에서 발생한 모든 활동과 이벤트를 시간순으로 확인하는 기능입니다.',
  icon: 'Clock',
  lastUpdated: '2026-01-11',
  sections: [
    {
      id: 'intro',
      title: '이 화면, 언제 사용하나요?',
      type: 'intro',
      intro:
        '학원에서 발생한 **모든 활동과 이벤트를 시간순으로** 확인하는 기능입니다. 화면 상단 오른쪽의 **시계 아이콘(회전 화살표 모양)**을 클릭하면 타임라인 모달이 열립니다. 출결 기록, 문자 발송, 청구서 생성, 자동화 실행 등 **시스템에서 발생한 모든 작업**을 테이블 형식으로 한눈에 파악할 수 있어 업무 진행 상황을 쉽게 추적할 수 있습니다.',
    },
    {
      id: 'features',
      title: '주요 기능',
      type: 'features',
      features: [
        '테이블 형식 조회 : 시간, 작업 유형, 요약, 소스, 상태를 테이블 형식으로 확인',
        '다양한 필터 : 기간, 요약 검색, 상태, 소스, 작업 유형별로 필터링 가능',
        '상태별 구분 : 성공(초록), 부분 성공(노랑), 실패(빨강) 상태를 색상으로 구분',
        '소스별 구분 : AI, 자동화, 스케줄러, 수동, 웹훅 등 실행 출처 확인',
        '빠른 접근 : 글로벌 헤더의 시계 아이콘으로 언제든 접근 가능',
        '실시간 업데이트 : 새로운 활동이 발생하면 자동으로 목록에 추가',
      ],
    },
    {
      id: 'steps',
      title: '단계별 사용법',
      type: 'steps',
      stepGuides: [
        {
          title: '타임라인 열기',
          steps: [
            { step: 1, content: '화면 상단 오른쪽의 시계(회전 화살표) 아이콘을 찾습니다.' },
            { step: 2, content: '아이콘을 클릭하면 타임라인 모달이 화면에 나타납니다.' },
            { step: 3, content: '최근 활동 목록이 테이블 형식으로 표시됩니다.' },
          ],
          alert: {
            type: 'info',
            content: '타임라인은 어떤 페이지에서든 글로벌 헤더를 통해 접근할 수 있습니다.',
          },
        },
        {
          title: '활동 내역 확인하기',
          steps: [
            { step: 1, content: '테이블에서 시간, 작업, 요약, 소스, 상태 컬럼을 확인합니다.' },
            { step: 2, content: '시간은 "2026-01-11 14:30" 형식으로 표시됩니다.' },
            { step: 3, content: '성공은 초록색, 부분 성공은 노란색, 실패는 빨간색 배지로 표시됩니다.' },
            { step: 4, content: '특정 행을 클릭하면 해당 활동의 상세 정보를 확인할 수 있습니다.' },
          ],
        },
        {
          title: '필터 사용하기',
          steps: [
            { step: 1, content: '기간 필터로 특정 날짜 범위의 활동만 조회합니다.' },
            { step: 2, content: '요약 검색창에 키워드를 입력하여 관련 활동을 찾습니다.' },
            { step: 3, content: '상태 필터에서 "성공", "부분 성공", "실패" 중 선택하여 필터링합니다.' },
            { step: 4, content: '소스 필터에서 "AI", "자동화", "스케줄러", "수동", "웹훅" 중 선택합니다.' },
          ],
          alert: {
            type: 'success',
            content: '여러 필터를 조합하면 원하는 활동을 더 빠르게 찾을 수 있습니다.',
          },
        },
        {
          title: '타임라인 닫기',
          steps: [
            { step: 1, content: '모달 우측 상단의 X 버튼을 클릭합니다.' },
            { step: 2, content: '또는 모달 바깥 영역을 클릭하면 닫힙니다.' },
            { step: 3, content: 'ESC 키를 눌러도 모달이 닫힙니다.' },
          ],
        },
      ],
    },
    {
      id: 'screen',
      title: '화면 뜯어보기',
      type: 'screen',
      screenGroups: [
        {
          title: '글로벌 헤더 영역',
          items: [
            { title: '타임라인 아이콘', description: '시계(회전 화살표) 모양 아이콘입니다. 클릭하면 타임라인 모달이 열립니다.' },
            { title: '아이콘 위치', description: '화면 상단 오른쪽, 에이전트 모드 아이콘과 매뉴얼 아이콘 사이에 위치합니다.' },
          ],
        },
        {
          title: '타임라인 모달',
          items: [
            { title: '모달 제목', description: '"타임라인"이라고 표시됩니다.' },
            { title: '닫기 버튼', description: '모달 우측 상단의 X 버튼입니다. 클릭하면 모달이 닫힙니다.' },
            { title: '필터 영역', description: '기간, 요약, 상태, 소스 등 다양한 필터 옵션이 상단에 표시됩니다.' },
            { title: '테이블 영역', description: '활동 목록이 테이블 형식으로 표시됩니다.' },
          ],
        },
        {
          title: '테이블 컬럼',
          items: [
            { title: '시간', description: '활동이 발생한 시간입니다. "2026-01-11 14:30" 형식으로 표시됩니다.' },
            { title: '작업', description: '어떤 종류의 작업인지 표시됩니다. 예: "에이전트 처리", "학생 등록", "SMS 발송"' },
            { title: '요약', description: '활동에 대한 요약 설명이 표시됩니다.' },
            { title: '소스', description: '실행 출처입니다. AI, 자동화, 스케줄러, 수동, 웹훅 중 하나로 표시됩니다.' },
            { title: '상태', description: '성공(초록), 부분 성공(노랑), 실패(빨강) 배지로 표시됩니다.' },
          ],
        },
      ],
    },
    {
      id: 'tips',
      title: '알아두면 좋은 팁 & 주의사항',
      type: 'screen',
      screenGroups: [
        {
          title: '활용 팁',
          items: [
            { title: '업무 추적', description: '오늘 어떤 작업이 완료되었는지 타임라인에서 빠르게 확인할 수 있습니다.' },
            { title: '문제 발견', description: '실패한 작업이 빨간색으로 표시되므로 문제를 빠르게 파악할 수 있습니다.' },
            { title: '자동화 확인', description: '자동화 작업이 제대로 실행되었는지 타임라인에서 확인할 수 있습니다.' },
          ],
        },
        {
          title: '주의사항',
          items: [
            { title: '데이터 보관 기간', description: '타임라인 데이터는 일정 기간 후 자동으로 삭제될 수 있습니다.' },
            { title: '실시간 업데이트', description: '새로운 활동이 발생하면 자동으로 목록에 추가됩니다. 수동 새로고침은 필요 없습니다.' },
          ],
        },
      ],
    },
    {
      id: 'mobile',
      title: '모바일/태블릿에서 사용하기',
      type: 'screen',
      screenGroups: [
        {
          title: '모바일에서의 차이점',
          items: [
            { title: '전체 화면 모달', description: '모바일에서는 타임라인 모달이 화면 전체를 차지합니다.' },
            { title: '스크롤', description: '위아래로 스크롤하여 더 많은 활동을 확인할 수 있습니다.' },
            { title: '터치 조작', description: '각 항목을 터치하면 상세 정보가 표시됩니다.' },
          ],
        },
        {
          title: '태블릿에서의 차이점',
          items: [
            { title: '넓은 모달', description: '태블릿에서는 모달이 더 넓게 표시되어 더 많은 정보를 볼 수 있습니다.' },
            { title: '가로 모드', description: '가로 모드에서 더 효율적으로 타임라인을 확인할 수 있습니다.' },
          ],
        },
      ],
    },
    {
      id: 'technical',
      title: '기술적 특징',
      type: 'technical',
      technicalFeatures: [
        'TimelineModal 컴포넌트 기반 모달 UI',
        'ExecutionAuditRun 데이터 구조 기반 활동 로그',
        'DataTable 컴포넌트 기반 테이블 형식 표시',
        'DataTableFilter를 통한 기간/상태/소스/작업 필터링',
        'React Suspense를 통한 Lazy Loading 적용',
        '글로벌 헤더 통합으로 모든 페이지에서 접근 가능',
        'CSS 변수 기반 디자인 시스템',
        'toKST 함수를 통한 한국 표준시 기준 시간 표시',
      ],
    },
  ],
};
