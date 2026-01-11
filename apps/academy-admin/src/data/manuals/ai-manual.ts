/**
 * AI 분석 페이지 매뉴얼
 *
 * [불변 규칙] 매뉴얼 컨텐츠는 명확하고 이해하기 쉽게 작성합니다.
 */

import type { ManualPage } from '../../types/manual';

export const aiManual: ManualPage = {
  id: 'ai',
  title: 'AI 분석',
  description: 'AI가 자동으로 생성한 인사이트를 확인하고 운영에 활용하는 페이지입니다.',
  icon: 'Sparkles',
  lastUpdated: '2026-01-11',
  sections: [
    {
      id: 'intro',
      title: '이 화면, 언제 사용하나요?',
      type: 'intro',
      intro:
        '**AI가 자동으로 분석한 인사이트**를 확인하는 화면입니다. 출결 이상 탐지, 그룹/과목 성과 분석, 지역 대비 비교, 주간/일일 브리핑 등 다양한 AI 분석 결과를 한눈에 볼 수 있습니다. AI가 제공하는 권장 조치를 참고하여 **효율적인 운영 의사결정**을 내릴 수 있습니다.',
    },
    {
      id: 'features',
      title: '주요 기능',
      type: 'features',
      features: [
        '주간 브리핑 : 매주 월요일 자동 생성되는 이번 주 운영 요약',
        '일일 브리핑 : 매일 아침 자동 생성되는 오늘의 운영 요약 (Phase 2)',
        '출결 이상 탐지 : AI가 출결 패턴을 분석하여 이상 징후가 있는 학생 자동 감지',
        '성과 분석 : 그룹/과목별 성과를 분석하여 우수/보통/개선필요 등급 제공',
        '지역 대비 분석 : 내 학원과 지역 평균을 비교하여 부족한 영역 안내',
        '선제적 추천 : 긴급/중요/참고 우선순위로 조치가 필요한 항목 추천 (Phase 2)',
        '자동화 요약 : 오늘 실행된 자동화 작업의 성공/실패 현황 확인 (Phase 2)',
        '자동화 패턴 분석 : 주간 자동화 성공률 및 패턴 분석 (Phase 2)',
        '상담일지 요약 : 학생별 상담일지를 AI가 자동으로 요약',
        '월간 리포트 생성 : 버튼 클릭으로 AI 성과 분석 인사이트 수동 생성',
      ],
    },
    {
      id: 'steps',
      title: '단계별 사용법',
      type: 'steps',
      stepGuides: [
        {
          title: 'AI 인사이트 확인하기',
          steps: [
            { step: 1, content: '좌측 메뉴에서 "인공지능" 메뉴를 클릭하여 AI 분석 페이지로 이동합니다.' },
            { step: 2, content: '화면에 표시된 각 카드를 확인합니다. 주간 브리핑, 출결 이상 탐지, 성과 분석, 지역 비교 등 다양한 인사이트가 카드 형태로 표시됩니다.' },
            { step: 3, content: '더 자세한 내용을 보고 싶은 카드를 클릭하면 상세 분석 화면으로 이동합니다.' },
            { step: 4, content: 'AI가 제시한 권장 조치를 확인하고 필요한 경우 해당 페이지로 이동하여 조치를 취합니다.' },
          ],
          alert: {
            type: 'info',
            content: 'AI 인사이트는 실시간으로 업데이트됩니다. 출결 이상 탐지는 5분마다 갱신됩니다.',
          },
        },
        {
          title: '빠른 분석 메뉴 사용하기',
          steps: [
            { step: 1, content: '화면 상단의 "빠른 분석" 영역에서 원하는 분석 유형 버튼을 클릭합니다.' },
            { step: 2, content: '"출결 이상 탐지" 버튼 : 출결 문제가 있는 학생 목록으로 바로 이동' },
            { step: 3, content: '"성과 분석" 버튼 : 그룹별 성과 분석 상세 화면으로 이동' },
            { step: 4, content: '"월간 리포트 생성" 버튼 : AI에게 새로운 성과 분석 생성 요청' },
            { step: 5, content: '"상담일지 요약" 버튼 : 상담일지 AI 요약 페이지로 이동' },
            { step: 6, content: '"주간 브리핑" 버튼 : 주간 브리핑 카드로 스크롤 이동' },
            { step: 7, content: '"지역 비교" 버튼 : 지역 대비 분석 카드로 스크롤 이동' },
          ],
          alert: {
            type: 'success',
            content: '빠른 분석 버튼을 활용하면 원하는 정보를 빠르게 찾을 수 있습니다.',
          },
        },
        {
          title: '출결 이상 탐지 상세 보기',
          steps: [
            { step: 1, content: '"출결 이상 탐지" 카드를 클릭하거나 빠른 분석 버튼을 클릭합니다.' },
            { step: 2, content: '모달/드로어 창에서 출결 이상이 감지된 학생 목록을 확인합니다.' },
            { step: 3, content: '각 학생별로 감지된 문제(예: 연속 결석, 잦은 지각 등)와 권장 조치가 표시됩니다.' },
            { step: 4, content: '학생 카드를 클릭하면 해당 학생의 상세 정보 페이지로 이동하여 조치를 취할 수 있습니다.' },
          ],
        },
        {
          title: '성과 분석 상세 보기',
          steps: [
            { step: 1, content: '"성과 분석" 카드를 클릭하거나 빠른 분석 버튼을 클릭합니다.' },
            { step: 2, content: '상단의 요약 통계에서 우수/보통/개선필요 그룹 수를 확인합니다.' },
            { step: 3, content: '각 그룹 카드를 클릭하면 상세 AI 분석 인사이트를 확인할 수 있습니다.' },
            { step: 4, content: '상세 화면에서는 출석률, 정원 충족률, 수납률 등 다양한 지표를 확인할 수 있습니다.' },
            { step: 5, content: 'AI가 생성한 상세 분석과 권장 사항을 참고하여 그룹 운영을 개선합니다.' },
            { step: 6, content: '"그룹 관리 페이지로 이동" 버튼을 클릭하면 해당 그룹의 관리 페이지로 이동합니다.' },
          ],
          alert: {
            type: 'info',
            content: '성과 분석 데이터가 없는 경우 "월간 리포트 생성" 버튼을 클릭하여 AI 분석을 실행하세요.',
          },
        },
        {
          title: '상담일지 AI 요약 사용하기',
          steps: [
            { step: 1, content: '빠른 분석 버튼에서 "상담일지 요약"을 클릭하거나 URL에 ?tab=consultation을 추가하여 이동합니다.' },
            { step: 2, content: '학생 선택 드롭다운에서 상담일지를 확인할 학생을 선택합니다.' },
            { step: 3, content: '선택한 학생의 상담일지 목록이 표시됩니다.' },
            { step: 4, content: 'AI 요약이 없는 상담일지에서 "AI 요약 생성" 버튼을 클릭합니다.' },
            { step: 5, content: 'AI가 상담 내용을 분석하여 핵심 내용을 요약합니다.' },
            { step: 6, content: '생성된 AI 요약은 상담일지 카드 하단에 표시됩니다.' },
          ],
          alert: {
            type: 'success',
            content: 'AI 요약 생성이 완료되면 "AI 요약이 생성되었습니다" 메시지가 표시됩니다.',
          },
        },
        {
          title: 'AI 인사이트 무시하기',
          steps: [
            { step: 1, content: '더 이상 확인할 필요가 없는 인사이트 카드를 찾습니다.' },
            { step: 2, content: '카드 우측 상단의 "무시" 버튼을 클릭합니다.' },
            { step: 3, content: '해당 인사이트가 목록에서 숨겨집니다.' },
          ],
          alert: {
            type: 'warning',
            content: '무시한 인사이트는 다시 표시되지 않습니다. 신중하게 사용하세요.',
          },
        },
      ],
    },
    {
      id: 'screen',
      title: '화면 뜯어보기',
      type: 'screen',
      screenGroups: [
        {
          title: '상단 빠른 분석 영역',
          items: [
            { title: '출결 이상 탐지 버튼', description: '출결 이상이 감지된 학생 목록을 모달로 표시합니다.' },
            { title: '성과 분석 버튼', description: '그룹/과목별 성과 분석 상세 화면을 모달로 표시합니다.' },
            { title: '월간 리포트 생성 버튼', description: '클릭하면 AI가 새로운 성과 분석 인사이트를 생성합니다.' },
            { title: '상담일지 요약 버튼', description: '상담일지 AI 요약 기능 페이지로 이동합니다.' },
            { title: '주간 브리핑 버튼', description: '주간 브리핑 카드 위치로 스크롤 이동합니다.' },
            { title: '지역 비교 버튼', description: '지역 대비 분석 카드 위치로 스크롤 이동합니다.' },
            { title: '일일 브리핑 버튼', description: '오늘의 브리핑 카드 위치로 스크롤 이동합니다. (Phase 2)' },
            { title: '선제적 추천 버튼', description: '선제적 추천 카드 위치로 스크롤 이동합니다. (Phase 2)' },
            { title: '자동화 요약 버튼', description: '자동화 요약 카드 위치로 스크롤 이동합니다. (Phase 2)' },
          ],
        },
        {
          title: '주간 브리핑 카드',
          items: [
            { title: '제목 영역', description: '"주간 브리핑" 제목과 Phase 1 MVP 배지가 표시됩니다.' },
            { title: '무시 버튼', description: '카드 우측에 위치하며, 클릭하면 이 인사이트를 숨깁니다.' },
            { title: '브리핑 제목', description: '"이번 주 요약" 등 AI가 생성한 브리핑 제목입니다.' },
            { title: '브리핑 요약', description: '이번 주 운영 현황을 요약한 텍스트입니다.' },
            { title: '세부 정보', description: '브리핑의 상세 정보가 키-값 형태로 표시됩니다.' },
          ],
        },
        {
          title: '출결 이상 탐지 카드',
          items: [
            { title: '카드 제목', description: '"출결 이상 탐지" 제목이 표시됩니다.' },
            { title: '감지 요약', description: '몇 명의 학생에게 이상이 감지되었는지 요약합니다.' },
            { title: '학생별 이슈', description: '각 학생의 이름과 감지된 문제가 목록으로 표시됩니다. 최대 3건만 미리보기로 표시되며, 더 있으면 "외 N건..." 형태로 표시됩니다.' },
            { title: '클릭 안내', description: '"클릭하여 상세 분석 보기 →" 문구가 하단에 표시됩니다. 클릭하면 상세 모달이 열립니다.' },
          ],
        },
        {
          title: '성과 분석 카드',
          items: [
            { title: '카드 제목', description: '"그룹/과목 성과 분석" 제목이 표시됩니다.' },
            { title: '분석 요약', description: '몇 개 그룹의 성과를 분석했는지 요약합니다.' },
            { title: '그룹별 성과', description: '각 그룹의 성과 등급(우수/양호/보통/개선필요)이 색상별 배지로 표시됩니다.' },
            { title: '추세 정보', description: '각 그룹의 성과 추세(상승/하락/유지)가 함께 표시됩니다.' },
          ],
        },
        {
          title: '지역 대비 부족 영역 카드',
          items: [
            { title: '카드 제목', description: '"지역 대비 부족 영역" 제목이 표시됩니다.' },
            { title: '영역별 현황', description: '각 영역(예: 출석률, 수납률 등)의 상태가 배지로 표시됩니다.' },
            { title: '갭 정보', description: '지역 평균과의 차이가 표시됩니다.' },
            { title: '권장 조치', description: '해당 영역을 개선하기 위한 AI 권장 사항이 표시됩니다.' },
          ],
        },
        {
          title: '일일 브리핑 카드 (Phase 2)',
          items: [
            { title: '카드 제목', description: '"오늘의 브리핑" 제목과 Phase 2 배지가 표시됩니다.' },
            { title: '무시 버튼', description: '클릭하면 이 인사이트를 숨깁니다.' },
            { title: '브리핑 내용', description: '오늘 하루 운영에 필요한 핵심 정보를 요약합니다.' },
          ],
        },
        {
          title: '선제적 추천 카드 (Phase 2)',
          items: [
            { title: '카드 제목', description: '"선제적 추천" 제목과 Phase 2 배지가 표시됩니다.' },
            { title: '긴급 건수 배지', description: '긴급(high priority) 항목이 있는 경우 "긴급 N건" 배지가 표시됩니다.' },
            { title: '추천 요약', description: 'AI가 분석한 전체 추천 내용을 요약합니다.' },
            { title: '개별 추천 항목', description: '긴급/중요/참고 우선순위별로 색상이 다른 카드 형태로 표시됩니다. 각 항목에는 제목, 설명, 대상 건수, 권장 조치가 포함됩니다.' },
          ],
        },
        {
          title: '자동화 요약 카드 (Phase 2)',
          items: [
            { title: '카드 제목', description: '"오늘의 자동화 요약" 제목과 Phase 2 배지가 표시됩니다.' },
            { title: '실패 건수 배지', description: '실패한 자동화가 있는 경우 "실패 N건" 배지가 표시됩니다.' },
            { title: '요약 텍스트', description: '오늘 자동화 실행 현황을 요약합니다.' },
            { title: '통계 대시보드', description: '총 실행, 성공, 실패, 성공률 4가지 지표가 격자 형태로 표시됩니다. 성공률에 따라 색상이 달라집니다.' },
          ],
        },
        {
          title: '자동화 패턴 분석 카드 (Phase 2)',
          items: [
            { title: '카드 제목', description: '"자동화 패턴 분석" 제목과 Phase 2 배지가 표시됩니다.' },
            { title: '주간 성공률 배지', description: '이번 주 전체 자동화 성공률이 표시됩니다. 90% 이상은 녹색, 70% 이상은 노란색, 그 이하는 빨간색입니다.' },
            { title: '패턴 분석 요약', description: 'AI가 분석한 자동화 패턴 요약입니다.' },
            { title: '개별 패턴 항목', description: '각 패턴의 제목, 지표 값, 추세(상승/하락/유지), 설명, 권장 사항이 표시됩니다.' },
          ],
        },
        {
          title: '출결 이상 탐지 상세 모달',
          items: [
            { title: '요약 정보', description: '몇 명의 학생에게 이상이 감지되었는지와 조치 안내가 표시됩니다.' },
            { title: '학생 목록', description: '각 학생별로 카드 형태로 표시됩니다. "주의" 배지, 학생 이름, 감지된 문제, 권장 조치가 포함됩니다.' },
            { title: '상세 보기 링크', description: '각 학생 카드를 클릭하면 해당 학생의 상세 정보 페이지로 이동합니다.' },
          ],
        },
        {
          title: '성과 분석 상세 모달',
          items: [
            { title: '요약 통계', description: '우수/보통/개선필요 그룹 수가 색상별로 표시됩니다.' },
            { title: '안내 메시지', description: '각 그룹을 클릭하면 상세 AI 분석을 볼 수 있다는 안내입니다.' },
            { title: '그룹 목록', description: '각 그룹별로 성과 등급 배지, 그룹명, 출석률, 추세, 학생 수, 권장 사항이 표시됩니다.' },
            { title: '인사이트 개수 배지', description: '상세 인사이트가 있는 그룹에는 "N개 인사이트" 배지가 표시됩니다.' },
          ],
        },
        {
          title: '성과 분석 그룹 상세 화면',
          items: [
            { title: '뒤로가기 버튼', description: '"← 전체 목록으로" 버튼을 클릭하면 그룹 목록으로 돌아갑니다.' },
            { title: '그룹 정보 헤더', description: '선택한 그룹의 성과 등급, 이름, 추세가 표시됩니다.' },
            { title: '종합 지표 대시보드', description: '출석률, 정원 충족률, 수납률, 학생 수, 상담 건수, 교사 수 등이 격자 형태로 표시됩니다.' },
            { title: '세부 현황', description: '등록/이탈 현황, 미납 현황 등 상세 정보가 표시됩니다.' },
            { title: '핵심 권장 사항', description: 'AI가 분석한 이 그룹에 대한 핵심 권장 조치입니다.' },
            { title: '상세 분석 목록', description: 'AI가 생성한 개별 인사이트가 타입별(개선점/강점/패턴/비교/경고/기회) 색상과 아이콘으로 표시됩니다.' },
            { title: '그룹 관리 이동 버튼', description: '"그룹 관리 페이지로 이동 →" 버튼을 클릭하면 해당 그룹의 관리 페이지로 이동합니다.' },
          ],
        },
        {
          title: '상담일지 요약 탭',
          items: [
            { title: '학생 선택 드롭다운', description: '상담일지를 조회할 학생을 선택합니다.' },
            { title: '상담일지 목록', description: '선택한 학생의 상담일지가 날짜별로 표시됩니다. 상담 유형(상담/학습/행동/기타)이 배지로 표시됩니다.' },
            { title: '상담 내용', description: '상담일지의 원본 내용이 표시됩니다.' },
            { title: 'AI 요약 영역', description: 'AI 요약이 생성된 경우 회색 배경의 영역에 표시됩니다.' },
            { title: 'AI 요약 생성 버튼', description: 'AI 요약이 없는 경우 "AI 요약 생성" 버튼이 표시됩니다. 클릭하면 AI가 요약을 생성합니다.' },
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
          title: '꼭 알아야 할 주의사항',
          items: [
            { title: '권한에 따른 접근 제한', description: 'Teacher 역할인 경우 요약 정보만 볼 수 있습니다. 상세 분석 버튼은 표시되지 않으며, "요약 정보만 제공됩니다" 안내가 표시됩니다.' },
            { title: 'AI 인사이트 생성 주기', description: '주간 브리핑은 매주 월요일 07:00에, 일일 브리핑은 매일 07:00에, 선제적 추천은 매일 08:00에, 자동화 요약은 매일 23:00에 자동 생성됩니다.' },
            { title: '데이터 축적 필요', description: 'AI 분석은 충분한 데이터가 축적되어야 정확한 결과를 제공합니다. 운영 초기에는 인사이트가 적을 수 있습니다.' },
            { title: '무시 기능 주의', description: '"무시" 버튼을 클릭하면 해당 인사이트가 숨겨집니다. 다시 복구할 수 없으니 신중하게 사용하세요.' },
          ],
        },
        {
          title: '효율적으로 사용하는 팁',
          items: [
            { title: '빠른 분석 버튼 활용', description: '화면 상단의 빠른 분석 버튼을 활용하면 원하는 분석 결과를 빠르게 찾을 수 있습니다.' },
            { title: '월간 리포트 수동 생성', description: '성과 분석 데이터가 필요할 때 "월간 리포트 생성" 버튼을 클릭하면 즉시 AI 분석을 실행할 수 있습니다.' },
            { title: '출결 이상 탐지 우선 확인', description: '출결 이상이 감지된 학생은 빠른 조치가 필요할 수 있습니다. AI 분석 페이지 방문 시 이 카드를 먼저 확인하세요.' },
            { title: '권장 조치 참고', description: 'AI가 제시하는 권장 조치는 데이터 기반의 분석 결과입니다. 의사결정 시 참고하세요.' },
            { title: '상세 인사이트 확인', description: '성과 분석에서 각 그룹을 클릭하면 출석률, 수납률 등 다양한 지표와 AI의 상세 분석을 확인할 수 있습니다.' },
          ],
        },
        {
          title: '문제 해결',
          items: [
            { title: '인사이트가 표시되지 않아요', description: '데이터가 충분히 축적되지 않았거나, 주간/일일 브리핑 생성 시간이 되지 않은 경우입니다. "월간 리포트 생성" 버튼으로 성과 분석을 수동 생성해보세요.' },
            { title: '성과 분석 데이터가 없어요', description: '"월간 리포트 생성" 버튼을 클릭하여 AI 분석을 실행하세요.' },
            { title: '지역 비교 데이터가 없어요', description: '지역 정보가 설정되지 않은 경우입니다. 환경설정에서 지역 정보를 설정하면 분석을 제공받을 수 있습니다.' },
            { title: '빠른 분석 버튼이 보이지 않아요', description: 'Teacher 역할인 경우 빠른 분석 버튼이 표시되지 않습니다. Admin 또는 Owner 권한이 필요합니다.' },
            { title: 'AI 요약 생성이 실패해요', description: '인터넷 연결을 확인하고 다시 시도해보세요. 문제가 지속되면 관리자에게 문의하세요.' },
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
            { title: '드로어 형태 상세 화면', description: '모바일에서는 상세 분석이 모달 대신 화면 하단에서 올라오는 드로어 형태로 표시됩니다.' },
            { title: '세로 스크롤', description: '카드가 세로로 배열되어 스크롤하여 확인합니다.' },
            { title: '터치 조작', description: '카드를 터치하여 상세 분석을 확인합니다.' },
            { title: '빠른 분석 버튼 줄바꿈', description: '화면 너비에 따라 버튼이 자동으로 줄바꿈됩니다.' },
          ],
        },
        {
          title: '태블릿에서의 차이점',
          items: [
            { title: '모달 형태 상세 화면', description: '태블릿에서는 PC와 동일하게 모달 형태로 상세 화면이 표시됩니다.' },
            { title: '더 큰 카드', description: '화면이 넓어 더 많은 정보를 한눈에 볼 수 있습니다.' },
          ],
        },
      ],
    },
    {
      id: 'technical',
      title: '기술적 특징',
      type: 'technical',
      technicalFeatures: [
        'React Query 기반 데이터 캐싱 (1분 staleTime, 5분 refetchInterval)',
        'ai_insights 테이블에서 insight_type별 인사이트 조회',
        'N+1 쿼리 최적화 : 모든 인사이트 타입을 한 번에 조회',
        'useResponsiveMode 훅 기반 반응형 레이아웃',
        'Zero-Trust : Context에서 tenantId 자동 추출',
        'api-sdk를 통한 Edge Function 호출 (generate-performance-insights)',
        'Policy Registry 기반 출결 이상 자동 판정',
        'useUserRole 훅 기반 권한 제어 (Teacher는 요약만 접근)',
        'KST 기준 날짜 처리 (dayjs)',
        'useDismissAIInsight 훅을 통한 인사이트 무시 처리',
        'CSS 변수 기반 디자인 시스템',
      ],
    },
  ],
};
