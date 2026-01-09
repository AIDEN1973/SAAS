// .eslintrc.cjs
module.exports = {
  root: true,

  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },

  extends: [
    "eslint:recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:@typescript-eslint/recommended",
  ],

  // react-hooks는 앱 레벨에서 이미 설정되어 있다면 여기서는 로드하지 않음(중복 방지)
  plugins: ["import", "@typescript-eslint"],

  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: ["./tsconfig.json", "./apps/*/tsconfig.json", "./packages/*/tsconfig.json"],
      },
    },
  },

  overrides: [
    // =========================================================
    // ✅ Typed ESLint (type-aware rules)
    // - TS/TSX에서만 켠다
    // - project/tsconfigRootDir 반드시 지정
    // - React Query 오탐 완화 옵션 적용
    // =========================================================
    {
      files: ["**/*.{ts,tsx}"],
      excludedFiles: [
        "apps/**/*.{ts,tsx}",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/*.config.{ts,tsx,js,cjs,mjs}",
        "**/vite.config.{ts,js}",
        "**/webpack.config.{ts,js}",
        "**/dev/**",
        "**/seed/**",
        "**/dist/**",
        "**/build/**",
        "**/.turbo/**",
        "**/.next/**",
      ],
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.eslint.json"],
      },
      extends: [
        // v6+ 권장 세트 (type-aware)
        "plugin:@typescript-eslint/recommended-type-checked",
      ],
      rules: {
        // ✅ React Query / 이벤트 핸들러에서 체감 큰 조합
        "@typescript-eslint/no-floating-promises": [
          "error",
          {
            ignoreVoid: true, // void foo()면 OK (invalidateQueries 같은 것 처리 편해짐)
            ignoreIIFE: true,
          },
        ],
        "@typescript-eslint/no-misused-promises": [
          "error",
          {
            checksVoidReturn: {
              attributes: false, // onClick={async () => ...} 같은 JSX 속성 오탐 완화
            },
          },
        ],

        // ✅ queryFn / try-catch에서 안정적인 패턴 강제
        "@typescript-eslint/return-await": ["error", "in-try-catch"],
        "@typescript-eslint/await-thenable": "error",

        // ✅ "unknown/any 섞여서 런타임 터짐" 방지 (api-sdk 응답 처리에 도움)
        "@typescript-eslint/no-unsafe-argument": "error",
        "@typescript-eslint/no-unsafe-assignment": "error",
        "@typescript-eslint/no-unsafe-member-access": "error",
        "@typescript-eslint/no-unsafe-call": "error",

        // ✅ 타입 단언 남발 억제
        "@typescript-eslint/no-unnecessary-type-assertion": "error",
      },
    },

    // =========================================================
    // packages/api-sdk: unsafe 규칙 완화 (저수준 경계 처리)
    // =========================================================
    {
      files: ["packages/api-sdk/**/*.{ts,tsx}"],
      excludedFiles: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
      rules: {
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
      },
    },

    // =========================================================
    // apps/hooks/features: unsafe 규칙 엄격 적용 (타입 안전성 강화)
    // =========================================================
    {
      files: [
        "apps/**/*.{ts,tsx}",
        "packages/hooks/**/*.{ts,tsx}",
        "packages/features/**/*.{ts,tsx}",
      ],
      excludedFiles: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/dev/**", "**/seed/**"],
      rules: {
        "@typescript-eslint/no-unsafe-assignment": "error",
        "@typescript-eslint/no-unsafe-member-access": "error",
        "@typescript-eslint/no-unsafe-call": "error",
        "@typescript-eslint/no-unsafe-argument": "error",
      },
    },

    // =========================================================
    // P0-1: hooks에서 라우팅 금지 + 더미/랜덤 데이터 import 금지
    // (한 override에서 통합하여 덮어쓰기 방지)
    // =========================================================
    {
      files: ["packages/hooks/**/*.{ts,tsx}"],
      excludedFiles: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/dev/**", "**/seed/**", "**/SchemaPreview.tsx"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "react-router-dom",
                message:
                  "Hook 패키지에서는 라우팅 의존 금지. URL/액션은 반환하고 navigate는 컴포넌트에서 처리.",
              },
              { name: "@faker-js/faker", message: "운영 코드에서 faker 사용 금지. dev/test/seed로 이동하세요." },
              { name: "faker", message: "운영 코드에서 faker 사용 금지. dev/test/seed로 이동하세요." },
              { name: "mockjs", message: "운영 코드에서 mockjs 사용 금지. dev/test/seed로 이동하세요." },
              { name: "chance", message: "운영 코드에서 chance 사용 금지. dev/test/seed로 이동하세요." },
            ],
          },
        ],
      },
    },

    // =========================================================
    // P0-2: UI에서 api-sdk 우회 API 호출 금지 (import 차단)
    // =========================================================
    {
      files: ["apps/**/*.{ts,tsx}", "packages/ui-core/**/*.{ts,tsx}", "packages/features/**/*.{ts,tsx}"],
      excludedFiles: ["packages/api-sdk/**/*.{ts,tsx}", "**/api-sdk/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              { name: "axios", message: "직접 API 호출 금지. api-sdk를 사용." },
              { name: "ky", message: "직접 API 호출 금지. api-sdk를 사용." },
              {
                name: "@supabase/supabase-js",
                message: "UI에서 직접 Supabase 금지. api-sdk/edge-function을 통해서만.",
              },
              { name: "superagent", message: "직접 API 호출 금지. api-sdk를 사용." },
            ],
          },
        ],
      },
    },

    // =========================================================
    // P0-3: client에서 server 전용 import 금지
    // =========================================================
    {
      files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
      excludedFiles: [
        "packages/env-registry/**/*.{ts,tsx}",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/*.config.{ts,js}",
        "**/vite.config.{ts,js}",
        "**/webpack.config.{ts,js}",
      ],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              { name: "@env-registry/server", message: "클라이언트 번들에서 server 모듈 import 금지." },
              { name: "@env-registry/common", message: "클라이언트 번들에서 common 모듈 import 금지." },
              { name: "fs", message: "클라이언트에서 Node 내장 모듈 금지." },
              { name: "path", message: "클라이언트에서 Node 내장 모듈 금지." },
              { name: "crypto", message: "클라이언트에서 Node 내장 모듈 금지." },
            ],
          },
        ],
      },
    },

    // =========================================================
    // apps/**/*: no-restricted-syntax 통합 (error) — 한 곳에서만 관리
    // =========================================================
    {
      files: ["apps/**/*.{ts,tsx}"],
      excludedFiles: [
        "**/*.config.{ts,js}",
        "**/vite.config.{ts,js}",
        "**/webpack.config.{ts,js}",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/dev/**",
        "**/seed/**",
        "**/SchemaPreview.tsx",
      ],
      rules: {
        "no-restricted-syntax": [
          "error",

          // ---- Kakao Local REST API 직접 호출 금지 (fetch 전면 금지보다 먼저 배치) ----
          // ⚠️ 참고: fetch 전면 금지와 의미상 중복이지만, Kakao 전용 메시지를 노리는 목적
          // 순서상 위에 배치하여 Kakao fetch는 먼저 이 메시지로 걸리도록 함
          {
            selector:
              "CallExpression[callee.name='fetch'][arguments.0.value=/https?:\\/\\/dapi\\.kakao\\.com/]",
            message: "Client Component에서 Kakao Local REST API 직접 호출 금지. Edge Function을 통해서만 호출하세요.",
          },
          {
            selector:
              "CallExpression[callee.type='MemberExpression'][callee.object.name=/^(window|globalThis)$/][callee.property.name='fetch'][arguments.0.value=/https?:\\/\\/dapi\\.kakao\\.com/]",
            message: "Client Component에서 Kakao Local REST API 직접 호출 금지. Edge Function을 통해서만 호출하세요.",
          },

          // fetch 금지 (UI fetch 전면 금지)
          {
            selector: "CallExpression[callee.name='fetch']",
            message: "직접 fetch 호출 금지. api-sdk를 사용하세요. (Kakao API 등 외부 API는 Edge Function을 통해서만 호출)",
          },
          // window.fetch / globalThis.fetch 금지
          {
            selector:
              "CallExpression[callee.type='MemberExpression'][callee.object.name=/^(window|globalThis)$/][callee.property.name='fetch']",
            message: "직접 fetch 호출 금지. api-sdk를 사용하세요. (Kakao API 등 외부 API는 Edge Function을 통해서만 호출)",
          },

          // Zero-Trust - URL/query에서 tenantId 읽기 금지
          // ⚠️ 제한사항: 변수명이 searchParams가 아닌 경우(예: const [sp] = useSearchParams())는 미탐
          // ESLint selector만으로 "이 get()이 URLSearchParams인지"를 100% 판별하기 어려움
          // 권장: useSearchParams() 결과는 반드시 searchParams로 받게 팀 룰화 또는 래퍼 훅(useSafeSearchParams) 사용
          // 패턴 1: searchParams.get('tenantId') - 변수명이 searchParams인 경우 (일반적: const [searchParams] = useSearchParams())
          {
            selector:
              "CallExpression[callee.object.name='searchParams'][callee.property.name='get'][arguments.0.value=/^tenant(_id)?$/i]",
            message: "Zero-Trust: URL/query에서 tenantId 읽기 금지. getApiContext()로만 조회.",
          },
          // 패턴 2: new URLSearchParams().get('tenantId') - 생성자 사용 (NewExpression 타입)
          {
            selector:
              "CallExpression[callee.property.name='get'][callee.object.type='NewExpression'][callee.object.callee.name='URLSearchParams'][arguments.0.value=/^tenant(_id)?$/i]",
            message: "Zero-Trust: URL/query에서 tenantId 읽기 금지. getApiContext()로만 조회.",
          },

          // React.useX 금지
          {
            selector:
              "MemberExpression[object.name='React'][property.name=/^(useState|useEffect|useMemo|useCallback|forwardRef|useRef|useContext)$/]",
            message: "React.useMemo() 대신 import { useMemo } from 'react'를 사용하세요.",
          },

          // apiClient.get('ai_insights') 직접 호출 금지 (예시)
          {
            selector:
              "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='ai_insights']",
            message: "ai_insights 직접 조회 금지. useAIInsights()/fetchAIInsights()를 사용하세요.",
          },

          // getApiContext 직접 호출 지양
          // ⚠️ 주의: no-restricted-syntax는 배열 맨 앞의 "error"가 전체 공통 severity
          // 초기 전면 error는 생산성 저하 가능하나, 현재는 error로 강제
          {
            selector: "CallExpression[callee.name='getApiContext']",
            message: "getApiContext() 직접 호출 지양. 가능한 Hook 내부로 이동하거나 useApiContext() 도입.",
          },

          // window 전역 플래그 직접 접근 금지
          {
            selector: "MemberExpression[object.name='window'][property.name=/^__sduiWidgetRegistered$/]",
            message: "window.__sduiWidgetRegistered 직접 접근 금지. 전용 util로 래핑해서 사용.",
          },
          {
            selector: "MemberExpression[object.name='window'][property.name=/^__CRITERION__$/]",
            message: "window.__CRITERION__ 직접 접근 금지. 전용 util로 래핑해서 사용.",
          },

          // localStorage/sessionStorage 직접 사용 금지
          {
            selector: "MemberExpression[object.name='localStorage']",
            message: "직접 localStorage 사용 금지. storage util로만 접근.",
          },
          {
            selector: "MemberExpression[object.name='sessionStorage']",
            message: "직접 sessionStorage 사용 금지. storage util로만 접근.",
          },
          // window.localStorage / window.sessionStorage 우회 금지
          {
            selector: "MemberExpression[object.name='window'][property.name=/^(localStorage|sessionStorage)$/]",
            message: "직접 localStorage/sessionStorage 사용 금지. storage util로만 접근.",
          },

          // process.env 직접 접근 금지
          {
            selector: "MemberExpression[object.name='process'][property.name='env']",
            message: "process.env 직접 접근 금지. env-registry/client 또는 api-sdk 경유.",
          },

          // ---- CSS 하드코딩 금지 ----
          // ⚠️ 주의: Literal 기반 규칙은 모든 문자열 리터럴에 적용되므로 오탐 가능 (예: "image-16px.png")
          // 오탐이 많으면 warn으로 전환하거나 스타일 객체 범위로 제한 검토
          // 참고: @typescript-eslint/parser도 문자열/숫자 리터럴을 Literal로 내보내므로 Literal만으로 충분
          {
            selector: "Literal[value=/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
            message: "하드코딩 색상 금지. var(--color-*) 토큰을 사용하세요.",
          },
          // 하드코딩 단위(px/rem/em) 금지 - Property > Literal로 범위 좁혀 오탐 방지
          {
            selector: "Property > Literal[value=/\\b\\d+(\\.\\d+)?(px|rem|em)\\b/]",
            message: "하드코딩 단위(px/rem/em) 금지. var(--spacing-*) 등 CSS 변수 토큰을 사용하세요.",
          },
          {
            selector:
              "Property[key.name=/^border(Top|Right|Bottom|Left)?(Width|Style|Color)?$/] > Literal[value=/\\b\\d+(\\.\\d+)?px\\b/]",
            message: "하드코딩 border(px) 금지. var(--border-width-*) 토큰을 사용하세요.",
          },
          {
            selector: "Property[key.name='opacity'] > Literal",
            message: "하드코딩 opacity 금지. var(--opacity-*) 토큰을 사용하세요.",
          },
          {
            selector:
              "JSXOpeningElement[name.name=/Icon|IconButton|IconButtonGroup|BadgeIcon/i]:has(JSXAttribute[name.name='size'] > JSXExpressionContainer > Literal)",
            message: "아이콘 size 하드코딩 금지. useIconSize() 훅(또는 디자인 토큰) 기반 크기를 사용하세요.",
          },

          // ---- 더미/랜덤 금지 ----
          {
            selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
            message: "운영 코드에서 Math.random() 더미/랜덤 생성 금지. dev/test/seed로 이동하세요.",
          },
          {
            selector: "CallExpression[callee.object.name='crypto'][callee.property.name='getRandomValues']",
            message: "운영 코드에서 랜덤 데이터 생성 금지. dev/test/seed로 이동하세요.",
          },

          // ---- KST 날짜 처리 금지 ----
          // ⚠️ 주의: no-restricted-syntax는 배열 맨 앞의 "error"가 전체 공통 severity
          // UI에서 합리적 케이스도 많아 오탐/불만 가능하나, 현재는 error로 강제
          {
            selector: "CallExpression[callee.property.name='toLocaleString']",
            message: "toLocaleString() 직접 사용 금지. KST 변환 유틸리티를 사용하세요.",
          },
          {
            selector: "CallExpression[callee.property.name='toLocaleDateString']",
            message: "toLocaleDateString() 직접 사용 금지. KST 변환 유틸리티를 사용하세요.",
          },
          {
            selector: "CallExpression[callee.property.name='toLocaleTimeString']",
            message: "toLocaleTimeString() 직접 사용 금지. KST 변환 유틸리티를 사용하세요.",
          },

          // ---- alert/confirm/prompt 금지 ----
          {
            selector: "CallExpression[callee.object.name='window'][callee.property.name='alert']",
            message: "window.alert() 사용 금지. useModal()을 사용하세요.",
          },
          {
            selector: "CallExpression[callee.object.name='window'][callee.property.name='confirm']",
            message: "window.confirm() 사용 금지. useModal()을 사용하세요.",
          },
          {
            selector: "CallExpression[callee.object.name='window'][callee.property.name='prompt']",
            message: "window.prompt() 사용 금지. useModal()을 사용하세요.",
          },


          // ---- Array.from({ length: N }) 더미 금지 ----
          // :has() 사용 (Icon-size 규칙에서도 :has() 사용 중이므로 통일)
          {
            selector:
              "CallExpression[callee.object.name='Array'][callee.property.name='from']:has(ObjectExpression > Property[key.name='length'])",
            message: "Array.from({ length: N }) 더미 데이터 생성 금지. dev/test/seed로 이동하세요.",
          },

          // ---- industry-specific prefix 테이블 자동 생성 금지 ----
          {
            selector: "Literal[value=/^(academy_|salon_|nail_)/]",
            message:
              "industry-specific prefix 테이블(예: academy_*) 자동 생성 금지. 개발자가 명시 요청한 경우에만 생성하세요.",
          },
        ],
      },
    },

    // =========================================================
    // packages/**/*: React.useX 금지 (일부)
    // =========================================================
    {
      files: ["packages/**/*.{ts,tsx}"],
      excludedFiles: [
        "packages/api-sdk/**/*.{ts,tsx}",
        "packages/ui-core/**/*.{ts,tsx}",
        "packages/features/**/*.{ts,tsx}",
        "**/api-sdk/**",
      ],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "MemberExpression[object.name='React'][property.name=/^(useState|useEffect|useMemo|useCallback|forwardRef|useRef|useContext)$/]",
            message: "React.useMemo() 대신 import { useMemo } from 'react'를 사용하세요.",
          },
        ],
      },
    },

    // P1-2: import 중복 금지
    {
      files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
      rules: { "import/no-duplicates": "error" },
    },

    // P1-5: any 금지
    {
      files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
      rules: { "@typescript-eslint/no-explicit-any": "error" },
    },

    // P1-4: 경계(레이어) 역참조 금지
    // target: 제한을 적용할 파일/디렉토리
    // from: target에서 import를 금지할 경로
    // 즉, { target: "./packages/ui-core", from: "./apps" }는 "ui-core에서 apps를 import하면 금지"를 의미
    {
      files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
      rules: {
        "import/no-restricted-paths": [
          "error",
          {
            zones: [
              { target: "./packages/ui-core", from: "./apps", message: "ui-core는 apps를 import하면 안 됩니다." },
              { target: "./packages/hooks", from: "./apps", message: "hooks는 apps 레이어에 의존하면 안 됩니다." },
              { target: "./packages/api-sdk", from: "./apps", message: "api-sdk는 apps 레이어에 의존하면 안 됩니다." },
            ],
          },
        ],
      },
    },

    // 더미/랜덤 데이터 import 금지 (운영 코드)
    // 주석: packages/hooks는 P0-1 override에서 통합 관리하므로 여기서 제외
    {
      files: ["apps/**/*.{ts,tsx}", "packages/services/**/*.{ts,tsx}"],
      excludedFiles: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/dev/**", "**/seed/**", "**/SchemaPreview.tsx"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              { name: "@faker-js/faker", message: "운영 코드에서 faker 사용 금지. dev/test/seed로 이동하세요." },
              { name: "faker", message: "운영 코드에서 faker 사용 금지. dev/test/seed로 이동하세요." },
              { name: "mockjs", message: "운영 코드에서 mockjs 사용 금지. dev/test/seed로 이동하세요." },
              { name: "chance", message: "운영 코드에서 chance 사용 금지. dev/test/seed로 이동하세요." },
            ],
          },
        ],
      },
    },

    // Automation Config First (자동화 영역 한정)
    {
      files: ["packages/core/core-automation/**/*.{ts,tsx}"],
      excludedFiles: [
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/policy/**",
        "**/*policy*.{ts,tsx}",
        "**/*threshold*.{ts,tsx}",
        "**/*constants*.{ts,tsx}",
      ],
      rules: {
        "@typescript-eslint/no-magic-numbers": [
          "error",
          { ignore: [0, 1, -1], ignoreArrayIndexes: true, enforceConst: true, detectObjects: true },
        ],
      },
    },

    // =========================================================
    // packages/services 규칙: no-restricted-syntax는 "한 override"로 통합(덮어쓰기 방지)
    // React.useX 금지도 여기에 포함하여 packages/**/* override와의 덮어쓰기 방지
    // =========================================================
    {
      files: ["packages/services/**/*.{ts,tsx}"],
      excludedFiles: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
      rules: {
        "no-restricted-syntax": [
          "error",

          // React.useX 금지 (packages/**/* override와의 덮어쓰기 방지)
          {
            selector:
              "MemberExpression[object.name='React'][property.name=/^(useState|useEffect|useMemo|useCallback|forwardRef|useRef|useContext)$/]",
            message: "React.useMemo() 대신 import { useMemo } from 'react'를 사용하세요.",
          },

          // SELECT/UPDATE/DELETE에서 .eq('tenant_id') 직접 사용 금지
          // arguments[0]이 Literal로 'tenant_id'인 경우 (StringLiteral은 ESTree에서 Literal로 통합)
          {
            selector:
              "CallExpression[callee.property.name='eq'][arguments.0.type='Literal'][arguments.0.value=/^tenant(_id)?$/i]",
            message: "SELECT/UPDATE/DELETE에서 .eq('tenant_id') 직접 사용 금지. withTenant()를 사용하세요.",
          },

          // INSERT/UPSERT에서 withTenant() 사용 금지 (정책 강제)
          // SELECT/UPDATE/DELETE에서는 withTenant() 사용 권장하므로 INSERT/UPSERT에서만 금지
          // :has()를 사용하여 insert/upsert 호출 체인 어딘가에 withTenant가 있으면 금지
          // (withTenant(q).from('x').insert(...) 같은 체이닝 패턴도 탐지)
          {
            selector:
              "CallExpression[callee.property.name=/^(insert|upsert)$/]:has(CallExpression[callee.name='withTenant'])",
            message: "INSERT/UPSERT 쿼리에서 withTenant() 사용 금지. row object에 tenant_id를 직접 포함하세요.",
          },

          // 채널 코드 'kakao' 저장 금지 (필드명 기반, 오탐 방지)
          // key.name: { channel: 'kakao' } 형태
          // key.value: { 'channel': 'kakao' } 형태 (문자열 key)
          {
            selector: "Property[key.name=/^(channel|notification_channel)$/i] > Literal[value='kakao']",
            message: "채널 코드 'kakao' 저장 금지. SSOT-3: 'sms' | 'kakao_at'만 허용됩니다.",
          },
          {
            selector: "Property[key.value=/^(channel|notification_channel)$/i] > Literal[value='kakao']",
            message: "채널 코드 'kakao' 저장 금지. SSOT-3: 'sms' | 'kakao_at'만 허용됩니다.",
          },
        ],
      },
    },
  ],
};
