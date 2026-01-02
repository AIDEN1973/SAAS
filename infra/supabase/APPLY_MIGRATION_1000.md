# Intent 매핑 마이그레이션 적용 가이드

## 마이그레이션 파일
`migrations/1000_create_chatops_intent_mapping.sql`

## 적용 방법

### 옵션 1: Supabase Dashboard (권장)
1. https://supabase.com/dashboard 접속
2. 프로젝트 선택
3. SQL Editor 열기
4. `1000_create_chatops_intent_mapping.sql` 내용 복사하여 실행

### 옵션 2: Supabase CLI
```bash
cd infra/supabase
supabase db push
```

### 옵션 3: psql 직접 연결
```bash
psql postgresql://postgres.xawypsrotrfoyozhrsbb:Nqf6tCgDSrXbO8kU@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres -f migrations/1000_create_chatops_intent_mapping.sql
```

## 테스트 쿼리

### 1. Intent 패턴 확인
```sql
SELECT * FROM chatops_intent_patterns
ORDER BY confidence DESC, usage_count DESC
LIMIT 10;
```

### 2. 패턴 매칭 테스트
```sql
SELECT * FROM match_intent_pattern('홍길동 학생 등록해줘');
SELECT * FROM match_intent_pattern('출결 조회');
SELECT * FROM match_intent_pattern('미납 확인');
```

### 3. 새 패턴 학습 테스트
```sql
SELECT learn_intent_pattern('학생 명단 보기', 'manage_student', 'search', 0.7);
SELECT * FROM chatops_intent_patterns WHERE pattern = '학생 명단 보기';
```

## 검증

마이그레이션 후 다음을 확인하세요:
- [x] `chatops_intent_patterns` 테이블 생성됨
- [x] 기본 패턴 30+ 개 삽입됨
- [x] `match_intent_pattern()` 함수 정상 작동
- [x] `learn_intent_pattern()` 함수 정상 작동
- [x] `update_intent_pattern_usage()` 함수 정상 작동
