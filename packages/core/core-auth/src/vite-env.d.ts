// ImportMeta 인터페이스 확장 (Vite 환경변수 타입 정의)
// Vite에 의존하지 않고 직접 타입 정의
interface ImportMetaEnv {
  readonly DEV?: boolean;
  readonly MODE?: string;
  readonly PROD?: boolean;
  readonly SSR?: boolean;
  [key: string]: unknown;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

