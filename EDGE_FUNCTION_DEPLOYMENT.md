# Edge Function 배포 가이드

## 현재 상황
npm 환경 문제로 CLI 배포가 안 되고 있습니다.

## 배포 방법

### 옵션 1: Supabase Dashboard (권장)
1. https://supabase.com/dashboard 접속
2. 프로젝트: `xawypsrotrfoyozhrsbb` 선택
3. **Functions** 메뉴 클릭
4. **Deploy a new function** 클릭
5. 이름: `chatops` 입력
6. **Create function** 클릭
7. 다음 파일 내용을 복사하여 붙여넣기:
   - `infra/supabase/supabase/functions/chatops/index.ts`

### 옵션 2: 로컬 Supabase CLI 재설정

```bash
# 1. npm 문제 해결
rm -rf node_modules package-lock.json
npm install

# 2. Supabase 프로젝트 링크
cd infra/supabase
npx supabase link --project-ref xawypsrotrfoyozhrsbb

# 3. 마이그레이션 적용
npx supabase db push

# 4. Edge Function 배포
npx supabase functions deploy chatops
```

### 옵션 3: 수동 SQL 적용 + Function 수정

#### 1단계: 마이그레이션 적용
```sql
-- 1000_create_chatops_intent_mapping.sql 파일의 전체 내용 실행
-- Supabase Dashboard → SQL Editor에서 복사 & 붙여넣기
```

#### 2단계: chatops/index.ts 업데이트 확인
- 파일이 이미 수정되었는지 확인
- 최근 변경사항:
  - Line 239: `let toolResults` 추가
  - Line 270: `toolResults = data.tool_results || []` 추가
  - Line 1964-1995: Intent 통계 자동 업데이트 로직 추가

## 수정 사항 확인

### 변경된 Edge Function 파일
- `infra/supabase/supabase/functions/chatops/index.ts` (Lines 237-337)

### 변경된 Agent Engine 파일
- `infra/supabase/supabase/functions/_shared/agent-engine-final.ts` (Lines 1852-1995)

## 배포 후 검증

### 1. 마이그레이션 확인
```sql
SELECT * FROM chatops_intent_patterns LIMIT 1;
```
✅ 결과: 기본 패턴 데이터가 조회됨

### 2. 함수 테스트
```sql
-- Intent 매칭 테스트
SELECT * FROM match_intent_pattern('학생 등록해줘');
```
✅ 결과: Tool 이름과 신뢰도가 반환됨

### 3. 패턴 학습 테스트
```sql
-- 새 패턴 추가
SELECT learn_intent_pattern('원생 명단', 'manage_student', 'search', 0.7);
```
✅ 결과: 패턴 ID 반환 (예: 1, 2, 3 등)

## 문제 해결

### npm 오류가 계속 나는 경우
```bash
# node_modules 완전 삭제
rm -rf node_modules yarn.lock package-lock.json

# 재설치
npm install

# yarn 사용 시도
yarn install
```

### Supabase 로그인 필요한 경우
```bash
npx supabase login
```

## 상태 확인

| 항목 | 상태 | 비고 |
|------|------|------|
| **마이그레이션** | ✅ 준비 | `1000_create_chatops_intent_mapping.sql` |
| **Agent Engine** | ✅ 수정 완료 | 자동 통계 수집 로직 추가 |
| **관리 UI** | ✅ 준비 | `IntentPatternsPage.tsx` |
| **라우팅** | ✅ 준비 | `/settings/intent-patterns` |
| **Edge Function 배포** | ⏳ 대기 | CLI 오류로 인해 수동 배포 필요 |

## 다음 단계

1. **마이그레이션 적용** (Supabase Dashboard SQL Editor)
2. **Edge Function 배포** (위의 옵션 중 선택)
3. **관리 UI 확인** (http://localhost:3000/settings/intent-patterns)
4. **테스트**:
   - 사용자가 질문 → 자동으로 통계 수집
   - 관리자가 저품질 패턴 정리
   - 신규 패턴 추가

## 지원

문제가 발생하면 다음을 확인하세요:
- ✅ 마이그레이션이 적용되었는가?
- ✅ Supabase 권한이 있는가?
- ✅ 프로젝트 ref가 정확한가? (`xawypsrotrfoyozhrsbb`)
