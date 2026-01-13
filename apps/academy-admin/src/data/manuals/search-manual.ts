/**
 * 검색 기능 매뉴얼
 *
 * [불변 규칙] 매뉴얼 컨텐츠는 명확하고 이해하기 쉽게 작성합니다.
 */

import type { ManualPage } from '../../types/manual';

export const searchManual: ManualPage = {
  id: 'search',
  title: '검색',
  description: '학생, 수업, 강사 등 필요한 정보를 빠르게 찾는 통합 검색 기능입니다.',
  icon: 'Search',
  lastUpdated: '2026-01-12',
  sections: [
    {
      id: 'intro',
      title: '이 기능, 언제 사용하나요?',
      type: 'intro',
      intro:
        '학원 관리 시스템 전체에서 **학생, 수업, 강사 등 필요한 정보를 빠르게 찾을** 수 있는 통합 검색 기능입니다. 화면 상단 오른쪽의 **검색 아이콘**을 클릭하거나 **단축키 (Ctrl+K 또는 Cmd+K)**를 누르면 검색창이 열립니다. 이름, 전화번호, 수업명 등 다양한 검색어로 원하는 정보를 즉시 찾을 수 있어 각 페이지를 일일이 찾아다닐 필요가 없습니다.',
    },
    {
      id: 'features',
      title: '주요 기능',
      type: 'features',
      features: [
        '통합 검색 : 학생, 수업, 강사, 청구서 등 모든 데이터를 한 번에 검색',
        '실시간 검색 : 입력하는 즉시 결과가 실시간으로 표시',
        '키보드 단축키 : Ctrl+K (Windows/Linux) 또는 Cmd+K (Mac)로 빠른 접근',
        '최근 검색 기록 : 최근 검색한 항목을 다시 빠르게 접근',
        '검색 필터 : 학생만, 수업만, 강사만 등 카테고리별 필터링',
        '바로 이동 : 검색 결과를 클릭하면 해당 상세 페이지로 즉시 이동',
        '다양한 검색 기준 : 이름, 전화번호, 이메일, 수업명, 강사명 등으로 검색',
        '검색어 하이라이트 : 검색 결과에서 검색어가 강조 표시',
      ],
    },
    {
      id: 'steps',
      title: '단계별 사용법',
      type: 'steps',
      stepGuides: [
        {
          title: '기본 검색하기',
          steps: [
            { step: 1, content: '화면 상단 오른쪽의 검색 아이콘(돋보기 모양)을 클릭하거나, 키보드에서 Ctrl+K (Windows/Linux) 또는 Cmd+K (Mac)를 누릅니다.' },
            { step: 2, content: '검색창에 찾고자 하는 학생 이름, 전화번호, 수업명 등을 입력합니다.' },
            { step: 3, content: '입력하는 즉시 관련 검색 결과가 아래에 실시간으로 표시됩니다.' },
            { step: 4, content: '원하는 결과를 클릭하면 해당 상세 페이지로 이동합니다.' },
          ],
          alert: {
            type: 'info',
            content: '최소 2글자 이상 입력해야 검색 결과가 표시됩니다.',
          },
        },
        {
          title: '필터를 사용한 검색',
          steps: [
            { step: 1, content: '검색창을 엽니다 (Ctrl+K 또는 Cmd+K).' },
            { step: 2, content: '검색창 상단의 필터 버튼을 클릭합니다. (전체, 학생, 수업, 강사, 청구서 등)' },
            { step: 3, content: '원하는 카테고리를 선택합니다. 예를 들어 "학생"을 선택하면 학생만 검색됩니다.' },
            { step: 4, content: '검색어를 입력하면 선택한 카테고리 내에서만 검색 결과가 표시됩니다.' },
          ],
          alert: {
            type: 'info',
            content: '많은 검색 결과가 나올 때는 필터를 활용하면 더 빠르게 원하는 정보를 찾을 수 있습니다.',
          },
        },
        {
          title: '최근 검색 기록 활용하기',
          steps: [
            { step: 1, content: '검색창을 엽니다 (Ctrl+K 또는 Cmd+K).' },
            { step: 2, content: '검색어를 입력하지 않은 상태에서 "최근 검색" 영역을 확인합니다.' },
            { step: 3, content: '최근에 검색했던 항목이 목록으로 표시됩니다.' },
            { step: 4, content: '원하는 항목을 클릭하면 다시 검색하지 않고 바로 이동할 수 있습니다.' },
          ],
        },
        {
          title: '키보드로 빠르게 검색하기',
          steps: [
            { step: 1, content: 'Ctrl+K (Windows/Linux) 또는 Cmd+K (Mac)를 눌러 검색창을 엽니다.' },
            { step: 2, content: '검색어를 입력하면 검색 결과가 표시됩니다.' },
            { step: 3, content: '위/아래 화살표 키로 검색 결과를 탐색합니다.' },
            { step: 4, content: 'Enter 키를 누르면 선택된 항목의 상세 페이지로 이동합니다.' },
            { step: 5, content: 'ESC 키를 누르면 검색창이 닫힙니다.' },
          ],
          alert: {
            type: 'info',
            content: '마우스를 사용하지 않고 키보드만으로 빠르게 검색하고 이동할 수 있습니다.',
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
          title: '글로벌 헤더 영역',
          items: [
            { title: '검색 아이콘', description: '돋보기 모양의 아이콘입니다. 클릭하면 검색창이 열립니다.' },
            { title: '아이콘 위치', description: '화면 상단 오른쪽, 타임라인 아이콘과 에이전트 모드 아이콘 사이에 위치합니다.' },
            { title: '단축키 표시', description: '아이콘에 마우스를 올리면 단축키 (Ctrl+K 또는 Cmd+K)가 툴팁으로 표시됩니다.' },
          ],
        },
        {
          title: '검색 모달',
          items: [
            { title: '검색 입력창', description: '상단의 텍스트 입력 영역입니다. 검색어를 입력하는 곳입니다.' },
            { title: '플레이스홀더', description: '검색창에 "학생, 수업, 강사 검색..." 같은 안내 문구가 표시됩니다.' },
            { title: '필터 버튼', description: '검색창 아래 또는 위쪽에 위치한 필터 버튼들입니다. 전체, 학생, 수업, 강사 등으로 구분됩니다.' },
            { title: '검색 결과 영역', description: '검색어 입력 시 결과가 표시되는 리스트 영역입니다.' },
            { title: '결과 항목', description: '각 검색 결과의 이름, 전화번호, 관련 정보가 표시됩니다.' },
            { title: '하이라이트', description: '검색어와 일치하는 부분이 강조 표시됩니다.' },
            { title: '카테고리 라벨', description: '각 결과 항목의 카테고리(학생, 수업, 강사 등)가 뱃지로 표시됩니다.' },
            { title: '최근 검색', description: '검색어가 없을 때 최근 검색 기록이 표시됩니다.' },
            { title: '닫기 버튼', description: '모달 우측 상단의 X 버튼입니다. 클릭하면 검색창이 닫힙니다.' },
          ],
        },
        {
          title: '검색 결과 항목 예시',
          items: [
            { title: '학생 결과', description: '학생 이름, 전화번호, 등록 수업 정보가 표시됩니다. "학생" 뱃지가 붙습니다.' },
            { title: '수업 결과', description: '수업명, 요일/시간, 등록 인원이 표시됩니다. "수업" 뱃지가 붙습니다.' },
            { title: '강사 결과', description: '강사 이름, 전화번호, 담당 수업 수가 표시됩니다. "강사" 뱃지가 붙습니다.' },
            { title: '청구서 결과', description: '청구서 번호, 학생명, 금액, 상태가 표시됩니다. "청구서" 뱃지가 붙습니다.' },
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
          title: '효율적으로 사용하는 팁',
          items: [
            { title: '단축키 활용', description: 'Ctrl+K 또는 Cmd+K를 사용하면 마우스 없이 빠르게 검색할 수 있습니다.' },
            { title: '부분 검색 가능', description: '전체 이름을 입력하지 않아도 됩니다. "홍길"만 입력해도 "홍길동"을 찾을 수 있습니다.' },
            { title: '전화번호로 검색', description: '학생 이름이 기억나지 않으면 전화번호 일부로도 검색 가능합니다.' },
            { title: '필터로 결과 좁히기', description: '너무 많은 결과가 나올 때는 필터를 사용하여 특정 카테고리만 검색하세요.' },
            { title: '키보드 네비게이션', description: '화살표 키로 결과를 탐색하고 Enter로 선택하면 마우스보다 빠릅니다.' },
            { title: '최근 검색 재활용', description: '자주 찾는 항목은 최근 검색 기록에서 빠르게 다시 접근할 수 있습니다.' },
          ],
        },
        {
          title: '꼭 알아야 할 주의사항',
          items: [
            { title: '최소 2글자', description: '검색 결과가 표시되려면 최소 2글자 이상 입력해야 합니다.' },
            { title: '대소문자 구분 없음', description: '영문 검색 시 대문자와 소문자를 구분하지 않습니다.' },
            { title: '띄어쓰기 주의', description: '이름 중간에 띄어쓰기가 있는 경우 정확히 입력해야 더 정확한 결과를 얻을 수 있습니다.' },
            { title: '권한 기반 결과', description: '로그인한 계정의 권한에 따라 검색 결과가 다를 수 있습니다.' },
            { title: '삭제된 항목 제외', description: '삭제되거나 비활성화된 항목은 검색 결과에 표시되지 않습니다.' },
          ],
        },
        {
          title: '문제 해결',
          items: [
            { title: '검색 결과가 안 나와요', description: '최소 2글자 이상 입력했는지 확인하고, 필터가 특정 카테고리로 설정되어 있는지 확인하세요.' },
            { title: '검색창이 안 열려요', description: '단축키가 작동하지 않으면 검색 아이콘을 직접 클릭해보세요. 브라우저 설정에서 단축키 충돌이 있을 수 있습니다.' },
            { title: '원하는 결과가 안 나와요', description: '검색어 철자를 확인하거나, 이름 대신 전화번호로 검색해보세요. 필터를 "전체"로 변경해보세요.' },
            { title: '검색이 느려요', description: '네트워크 상태를 확인하고, 너무 일반적인 검색어는 결과가 많아 느릴 수 있으니 더 구체적으로 입력하세요.' },
          ],
        },
      ],
    },
    {
      id: 'searchable',
      title: '검색 가능한 항목',
      type: 'screen',
      screenGroups: [
        {
          title: '학생 검색',
          items: [
            { title: '이름으로 검색', description: '학생의 이름 전체 또는 일부를 입력합니다.' },
            { title: '전화번호로 검색', description: '학생의 전화번호 일부를 입력합니다. (예: 010-1234)' },
            { title: '이메일로 검색', description: '학생의 이메일 주소로 검색할 수 있습니다.' },
            { title: '학부모명으로 검색', description: '학부모 이름으로도 학생을 찾을 수 있습니다.' },
          ],
        },
        {
          title: '수업 검색',
          items: [
            { title: '수업명으로 검색', description: '수업의 이름 전체 또는 일부를 입력합니다.' },
            { title: '강사명으로 검색', description: '해당 수업을 담당하는 강사 이름으로 검색할 수 있습니다.' },
            { title: '요일/시간으로 검색', description: '특정 요일이나 시간대의 수업을 찾을 수 있습니다.' },
          ],
        },
        {
          title: '강사 검색',
          items: [
            { title: '이름으로 검색', description: '강사의 이름 전체 또는 일부를 입력합니다.' },
            { title: '전화번호로 검색', description: '강사의 전화번호 일부를 입력합니다.' },
            { title: '이메일로 검색', description: '강사의 이메일 주소로 검색할 수 있습니다.' },
          ],
        },
        {
          title: '청구서 검색',
          items: [
            { title: '청구서 번호로 검색', description: '청구서 고유 번호로 찾을 수 있습니다.' },
            { title: '학생명으로 검색', description: '청구 대상 학생의 이름으로 청구서를 찾을 수 있습니다.' },
            { title: '금액으로 검색', description: '특정 금액의 청구서를 검색할 수 있습니다.' },
          ],
        },
      ],
    },
    {
      id: 'shortcuts',
      title: '키보드 단축키',
      type: 'screen',
      screenGroups: [
        {
          title: '검색 단축키',
          items: [
            { title: 'Ctrl+K (Win/Linux)', description: '검색창을 엽니다.' },
            { title: 'Cmd+K (Mac)', description: '검색창을 엽니다.' },
            { title: 'ESC', description: '검색창을 닫습니다.' },
            { title: '↑ (위 화살표)', description: '이전 검색 결과로 이동합니다.' },
            { title: '↓ (아래 화살표)', description: '다음 검색 결과로 이동합니다.' },
            { title: 'Enter', description: '선택된 검색 결과의 상세 페이지로 이동합니다.' },
            { title: 'Tab', description: '필터 버튼 간 이동합니다.' },
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
            { title: '검색 아이콘 터치', description: '화면 상단 오른쪽의 검색 아이콘을 터치하여 검색창을 엽니다.' },
            { title: '전체 화면 검색', description: '검색창이 전체 화면으로 열려 편하게 입력할 수 있습니다.' },
            { title: '자동 키보드', description: '검색창이 열리면 자동으로 키보드가 표시됩니다.' },
            { title: '터치로 선택', description: '검색 결과를 터치하여 상세 페이지로 이동합니다.' },
            { title: '뒤로 가기', description: '기기의 뒤로 가기 버튼 또는 화면 외부를 터치하여 검색창을 닫을 수 있습니다.' },
          ],
        },
        {
          title: '태블릿에서의 차이점',
          items: [
            { title: '반응형 레이아웃', description: '검색창이 화면 크기에 맞게 적절한 크기로 표시됩니다.' },
            { title: '넓은 결과 표시', description: '더 넓은 화면에 검색 결과가 보기 편하게 표시됩니다.' },
            { title: '터치 최적화', description: '버튼과 결과 항목이 터치하기 편한 크기로 표시됩니다.' },
          ],
        },
      ],
    },
    {
      id: 'technical',
      title: '기술적 특징',
      type: 'technical',
      technicalFeatures: [
        'Debounced Search로 입력 성능 최적화 (300ms 지연)',
        'React Query 기반 검색 결과 캐싱',
        'Fuzzy Matching 알고리즘으로 유사 검색 지원',
        'useSearch 훅을 통한 검색 상태 관리',
        '키보드 네비게이션을 위한 Accessibility 최적화',
        'Modal/Drawer 조건부 렌더링으로 디바이스별 최적화',
        '검색 히스토리 LocalStorage 저장',
        'CSS 변수 기반 디자인 시스템',
        'Zero-Trust 기반 권한별 검색 결과 필터링',
        'useMemo를 통한 검색 결과 정렬 최적화',
        'React Suspense를 통한 Lazy Loading',
      ],
    },
  ],
};
