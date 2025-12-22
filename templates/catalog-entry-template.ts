/**
 * Shared Catalog 엔트리 템플릿
 *
 * 이 템플릿을 복사하여 packages/shared-catalog.ts에 추가하세요.
 * 모든 필드를 채워야 하며, 특히 useWhen, doNot, examples는 수동 검토가 필요합니다.
 */

export const catalogEntryTemplate = {
  // Hook 엔트리 템플릿
  hook: {
    'use-example-hook': {
      path: '@hooks/use-example', // ⚠️ 수정 필요: 실제 Hook 패키지 경로
      import: 'import { useExample } from "@hooks/use-example"', // ⚠️ 수정 필요: 실제 import 문
      useWhen: '설명을 작성하세요: 이 Hook을 언제 사용해야 하는가?', // ⚠️ 수정 필요: Hook의 JSDoc에서 추출 시도
      input: '{ param1: string; param2?: number }', // 선택: Hook의 파라미터 타입
      output: 'ExampleType[]', // 선택: Hook의 반환 타입
      extensionPoints: ['param1', 'param2'], // 선택: 확장 가능한 파라미터 목록
      doNot: [
        '직접 apiClient.get("example_table") 호출', // ⚠️ 수정 필요: 금지 패턴 목록
        'useQuery로 example_table 직접 조회', // ⚠️ 수정 필요: Hook의 JSDoc에서 추출 시도
      ],
      examples: [
        'import { useExample } from "@hooks/use-example";', // ⚠️ 수정 필요: 복붙 가능한 코드 예시
        'const { data } = useExample({ param1: "value" });', // ⚠️ 수정 필요: Hook 파일 내 예시에서 추출 시도
      ],
      related: {
        feature: 'example-feature', // 선택: 관련 Feature
        adapter: 'industryAdapter.example', // 선택: 관련 Adapter
      },
    },
  },

  // Feature 엔트리 템플릿
  feature: {
    'example-feature': {
      path: '@features/example', // ⚠️ 수정 필요: 실제 Feature 패키지 경로
      import: 'import { ExampleFeature } from "@features/example"', // ⚠️ 수정 필요: 실제 import 문
      useWhen: '설명을 작성하세요: 이 Feature를 언제 사용해야 하는가?', // ⚠️ 수정 필요
      input: '{ data: ExampleType; onAction?: () => void }', // 선택: Feature의 props 타입
      output: 'React.ReactNode', // 선택: Feature의 반환 타입
      extensionPoints: ['onAction'], // 선택: 확장 가능한 props 목록
      doNot: [
        'Feature 렌더링 로직 중복 구현', // ⚠️ 수정 필요: 금지 패턴 목록
        '업종별 라벨 하드코딩', // ⚠️ 수정 필요
      ],
      examples: [
        '<ExampleFeature data={data} onAction={handleAction} />', // ⚠️ 수정 필요: 복붙 가능한 코드 예시
      ],
      related: {
        hook: 'use-example-hook', // 선택: 관련 Hook
        adapter: 'industryAdapter.example', // 선택: 관련 Adapter
      },
    },
  },

  // Adapter 엔트리 템플릿
  adapter: {
    'example-adapter': {
      path: '@industry/*/adapter', // ⚠️ 수정 필요: 실제 Adapter 경로
      import: 'import { industryAdapter } from "@industry/*/adapter"', // ⚠️ 수정 필요: 실제 import 문
      useWhen: '설명을 작성하세요: 이 Adapter를 언제 사용해야 하는가?', // ⚠️ 수정 필요
      input: '없음 (Context에서 자동 주입)', // 선택: Adapter의 입력 타입
      output: '{ label: string; buildUrl?: (id: string) => string }', // 선택: Adapter의 출력 타입
      extensionPoints: ['label', 'buildUrl'], // 선택: 확장 가능한 속성 목록
      doNot: [
        '업종별 라벨을 컴포넌트에 하드코딩', // ⚠️ 수정 필요: 금지 패턴 목록
        '프론트에서 라우팅 직접 조립', // ⚠️ 수정 필요
      ],
      examples: [
        'const label = industryAdapter.example.label;', // ⚠️ 수정 필요: 복붙 가능한 코드 예시
        'const url = industryAdapter.example.buildUrl?.(id);', // ⚠️ 수정 필요
      ],
      related: {
        hook: 'use-example-hook', // 선택: 관련 Hook
        feature: 'example-feature', // 선택: 관련 Feature
      },
    },
  },
};

/**
 * 사용 가이드:
 *
 * 1. 위 템플릿을 복사하여 packages/shared-catalog.ts의 sharedCatalog 객체에 추가
 * 2. ⚠️ 표시된 필드는 반드시 수정 필요
 * 3. Hook의 JSDoc 주석에서 useWhen, doNot 정보 추출 시도
 * 4. Hook 파일 내 예시 코드에서 examples 추출 시도
 * 5. scripts/check-shared-catalog.ts로 검증
 */

