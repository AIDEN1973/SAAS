# 필터 태그 시스템 마이그레이션 배포 가이드

**목적**: message_filter_tags 테이블 및 관련 함수 배포
**날짜**: 2026-01-26
**배포 방법**: Supabase SQL Editor

---

## 🚀 빠른 배포 (SQL Editor)

### 1단계: SQL Editor 접속
```
1. https://supabase.com/dashboard/project/ynqdekicnalxzbfjhxck 접속
2. 좌측 메뉴 > "SQL Editor" 클릭
3. 새 쿼리 생성 (+ New query)
```

---

### 2단계: 마이그레이션 실행 (순서대로)

#### ✅ 마이그레이션 1: 테이블 생성

**파일**: `infra/supabase/supabase/migrations/20260127000000_create_message_filter_tags.sql`

<details>
<summary>📋 SQL 복사하기 (클릭하여 펼치기)</summary>

```sql
-- ============================================================================
-- 메시지 필터 태그 테이블 생성
-- 태그 기반 회원 필터링 + 수동 메시지 발송 시스템
-- ============================================================================

-- 1. 메시지 필터 태그 테이블 생성
CREATE TABLE IF NOT EXISTS message_filter_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 태그 기본 정보
  name TEXT NOT NULL,
  display_label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('popular', 'attendance', 'billing', 'enrollment', 'academic', 'combined', 'class', 'status')),
  color TEXT DEFAULT '#E5E7EB',
  icon TEXT,

  -- 필터링 조건
  condition_type TEXT NOT NULL,
  condition_params JSONB DEFAULT '{}'::jsonb,

  -- 메타데이터
  is_active BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,

  -- 감사 로그
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),

  -- 제약 조건
  CONSTRAINT message_filter_tags_unique_name_per_tenant UNIQUE (tenant_id, name)
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_message_filter_tags_tenant_category
  ON message_filter_tags(tenant_id, category, is_active);

CREATE INDEX IF NOT EXISTS idx_message_filter_tags_tenant_active
  ON message_filter_tags(tenant_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_message_filter_tags_usage
  ON message_filter_tags(tenant_id, usage_count DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_message_filter_tags_condition_type
  ON message_filter_tags(tenant_id, condition_type);

-- 3. RLS 활성화 및 정책 생성
ALTER TABLE message_filter_tags ENABLE ROW LEVEL SECURITY;

-- 조회 정책
CREATE POLICY "message_filter_tags_select_policy"
  ON message_filter_tags
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- 삽입 정책
CREATE POLICY "message_filter_tags_insert_policy"
  ON message_filter_tags
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- 업데이트 정책
CREATE POLICY "message_filter_tags_update_policy"
  ON message_filter_tags
  FOR UPDATE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- 삭제 정책
CREATE POLICY "message_filter_tags_delete_policy"
  ON message_filter_tags
  FOR DELETE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- 4. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_message_filter_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_message_filter_tags_updated_at
  BEFORE UPDATE ON message_filter_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_message_filter_tags_updated_at();

-- 5. 코멘트 추가
COMMENT ON TABLE message_filter_tags IS '메시지 발송을 위한 회원 필터 태그';
COMMENT ON COLUMN message_filter_tags.condition_type IS '필터 조건 타입 (예: attendance.consecutive_late_3days)';
COMMENT ON COLUMN message_filter_tags.condition_params IS '필터 조건 파라미터 (JSONB)';
COMMENT ON COLUMN message_filter_tags.usage_count IS '태그 사용 횟수 (인기 태그 정렬용)';
COMMENT ON COLUMN message_filter_tags.is_system_default IS '시스템 기본 태그 여부';
```

</details>

**실행 방법**:
1. 위 SQL 전체 복사
2. SQL Editor에 붙여넣기
3. "Run" 버튼 클릭
4. ✅ "Success" 메시지 확인

---

#### ⚠️ 마이그레이션 2 & 3: 필터 함수 + 시드 데이터

**파일들**:
- `20260127000001_create_filter_functions.sql` (1500+ 줄)
- `20260127000002_seed_default_filter_tags.sql`

**문제**: SQL Editor 타임아웃 가능성 (파일이 너무 큼)

**해결책 1: 파일 직접 업로드** (추천)
```
1. SQL Editor > "Import SQL" 버튼 클릭
2. 파일 선택:
   - infra/supabase/supabase/migrations/20260127000001_create_filter_functions.sql
3. "Import" 클릭
4. 완료 후 20260127000002_seed_default_filter_tags.sql 반복
```

**해결책 2: 로컬 PostgreSQL 클라이언트 사용**
```bash
# psql 사용
psql "postgresql://postgres.ynqdekicnalxzbfjhxck:PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres" -f infra/supabase/supabase/migrations/20260127000001_create_filter_functions.sql

# 또는 pgAdmin / DBeaver 등 GUI 도구 사용
```

---

## 🔍 배포 검증

### 1. 테이블 생성 확인
```sql
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'message_filter_tags'
ORDER BY ordinal_position;

-- 예상 결과: 16개 컬럼 표시
```

### 2. RLS 정책 확인
```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'message_filter_tags'
ORDER BY cmd;

-- 예상 결과: 4개 정책 (SELECT, INSERT, UPDATE, DELETE)
```

### 3. 필터 함수 확인
```sql
SELECT
  proname AS function_name,
  pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname LIKE 'filter_%students'
  AND pronamespace = 'public'::regnamespace
ORDER BY proname;

-- 예상 결과: 28개 함수
```

### 4. 기본 태그 확인
```sql
SELECT
  category,
  COUNT(*) as tag_count
FROM message_filter_tags
WHERE is_system_default = true
GROUP BY category
ORDER BY category;

-- 예상 결과: 8개 카테고리, 총 38개 태그
```

---

## 🐛 트러블슈팅

### 문제 1: "relation already exists" 에러
**원인**: 테이블이 이미 생성됨
**해결**:
```sql
-- 기존 테이블 확인
SELECT * FROM message_filter_tags LIMIT 1;

-- 이미 있으면 마이그레이션 1 스킵하고 2번부터 실행
```

### 문제 2: "function does not exist" 에러
**원인**: 필터 함수 미생성
**해결**: 마이그레이션 2 (`create_filter_functions.sql`) 실행 필수

### 문제 3: RLS 정책 충돌
**원인**: 동일 이름 정책이 이미 존재
**해결**:
```sql
-- 기존 정책 삭제 후 재생성
DROP POLICY IF EXISTS "message_filter_tags_select_policy" ON message_filter_tags;
-- 그 후 마이그레이션 1 재실행
```

---

## 📋 배포 체크리스트

### 배포 전
- [ ] Supabase Dashboard 접속 가능
- [ ] SQL Editor 권한 확인
- [ ] 마이그레이션 파일 3개 확인

### 배포 중
- [ ] 마이그레이션 1 실행 완료 (테이블 생성)
- [ ] 마이그레이션 2 실행 완료 (필터 함수)
- [ ] 마이그레이션 3 실행 완료 (시드 데이터)

### 배포 후
- [ ] 테이블 생성 확인 (16개 컬럼)
- [ ] RLS 정책 확인 (4개)
- [ ] 필터 함수 확인 (28개)
- [ ] 기본 태그 확인 (38개)
- [ ] 프론트엔드 테스트 (`/bulk-message`)

---

## 🚀 다음 단계

배포 완료 후:
1. ✅ 프론트엔드 빌드 및 배포
2. ✅ 브라우저 테스트 (기본 필터 3개)
3. ✅ UI 컴포넌트 구현 (FilterTagList 등)
4. ✅ AI Edge Functions 배포

---

**작성일**: 2026-01-26
**작성자**: Claude Sonnet 4.5
**버전**: 1.0.0
