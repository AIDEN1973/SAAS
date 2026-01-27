# 📚 SAMDLE 프로젝트 문서 가이드

**최종 업데이트**: 2026-01-26
**총 문서 수**: 24개 (정리 완료)

> **최신 변경사항**:
> - **(2026-01-26)**: 문서 대규모 정리 완료 - AI 생성 중복 문서 50+ 개 제거, 성능 모니터링 문서 통합
> - **(2026-01-14)**: AI 기능의 PII 마스킹 완전 제거 - [CHANGELOG_PII_MASKING_REMOVAL.md](./CHANGELOG_PII_MASKING_REMOVAL.md) 참조

---

## 🎯 빠른 시작: 역할별 추천 문서

### 👨‍💻 신규 개발자 (첫 1주일)

**필수 읽기 순서**:
1. [rules.md](./rules.md) - 프로젝트 구조, 의존성, 네이밍 규칙 (30분)
2. [Industry_Neutrality.md](./Industry_Neutrality.md) - 업종 중립성 핵심 원칙 (10분)
3. [체크리스트.md](./체크리스트.md) - P0/P1/P2 필수 체크리스트 (40분)
4. [TESTING.md](./TESTING.md) - 테스트 환경 구축 및 실행 (20분)

**선택 읽기**:
- [React_Query_표준_패턴.md](./React_Query_표준_패턴.md) - 데이터 페칭 패턴 (15분)
- [SSOT_UI_DESIGN.md](./SSOT_UI_DESIGN.md) - UI 컴포넌트 규칙 (20분)

### 🔧 백엔드 개발자

**필수 읽기 순서**:
1. [rules.md](./rules.md) - RLS, withTenant(), 보안 규칙
2. [Industry_Neutrality.md](./Industry_Neutrality.md) - Industry Adapter 패턴
3. [Agent_아키텍처_전환.md](./Agent_아키텍처_전환.md) - Agent 기반 시스템 개요
4. [Agent_파라미터_추출.md](./Agent_파라미터_추출.md) - Tool 파라미터 처리
5. [Agent_계약검증.md](./Agent_계약검증.md) - Tool 검증 + 배포 전 검증 + 모니터링

### 🎨 프론트엔드 개발자

**필수 읽기 순서**:
1. [SSOT_UI_DESIGN.md](./SSOT_UI_DESIGN.md) - UI 디자인 시스템
2. [React_Query_표준_패턴.md](./React_Query_표준_패턴.md) - 데이터 페칭 및 캐싱
3. [Industry_Neutrality.md](./Industry_Neutrality.md) - 업종 중립적 UI 설계
4. [프론트 자동화.md](./프론트 자동화.md) - 자동화 Policy 기반 UI

**선택 읽기**:
- [체크리스트.md](./체크리스트.md) - UI 관련 P1/P2 항목
- [TESTING.md](./TESTING.md) - E2E 테스트 작성

### 🤖 ChatOps/AI 개발자

**필수 읽기 순서**:
1. [Agent_아키텍처_전환.md](./Agent_아키텍처_전환.md) - Intent → Agent 전환 배경
2. [Agent_파라미터_추출.md](./Agent_파라미터_추출.md) - LLM Function Calling
3. [Agent_계약검증.md](./Agent_계약검증.md) - 6대 계약 검증 + 배포 전 검증
4. [챗봇_성능최적화.md](./챗봇_성능최적화.md) - 응답 시간/비용 최적화

**선택 읽기**:
- [핸들러 구현.md](./핸들러 구현.md) - Execution Audit Handler

### ⚙️ DevOps/CI/CD 담당자

**필수 읽기 순서**:
1. [프로젝트_자동화_가이드.md](./프로젝트_자동화_가이드.md) - CI/CD 파이프라인 전체
2. [TESTING.md](./TESTING.md) - 테스트 자동화
3. [Agent_계약검증.md](./Agent_계약검증.md) - 배포 전 검증 + 모니터링
4. [PERFORMANCE_MONITORING_GUIDE.md](./PERFORMANCE_MONITORING_GUIDE.md) - 성능 모니터링 시스템

**선택 읽기**:
- [SENTRY_SETUP_GUIDE.md](./SENTRY_SETUP_GUIDE.md) - Sentry 에러 추적 설정
- [SECURITY_CONFIGURATION_GUIDE.md](./SECURITY_CONFIGURATION_GUIDE.md) - 보안 설정
- [QUICK_ENV_SETUP.md](./QUICK_ENV_SETUP.md) - 빠른 환경 설정

---

## 📂 문서 분류 (카테고리별)

### 1. 핵심 규칙 및 아키텍처 (7개)

| 문서명 | 설명 | 읽기 시간 | 우선순위 |
|--------|------|----------|---------|
| [rules.md](./rules.md) | 프로젝트 구조, 의존성, 네이밍, 보안 규칙 | 30분 | ⭐⭐⭐⭐⭐ |
| [Industry_Neutrality.md](./Industry_Neutrality.md) | 업종 중립성 핵심 원칙 (SSOT) | 10분 | ⭐⭐⭐⭐⭐ |
| [디어쌤_아키텍처.md](./디어쌤_아키텍처.md) | 전체 시스템 아키텍처 (대형) | 60분+ | ⭐⭐⭐ |
| [체크리스트.md](./체크리스트.md) | P0/P1/P2 필수 체크리스트 | 40분 | ⭐⭐⭐⭐⭐ |
| [코드검증_지시문.md](./코드검증_지시문.md) | 코드 검증 프롬프트 템플릿 | 20분 | ⭐⭐⭐ |
| [CHANGELOG_PII_MASKING_REMOVAL.md](./CHANGELOG_PII_MASKING_REMOVAL.md) | PII 마스킹 제거 변경 이력 (2026-01-14) | 15분 | ⭐⭐⭐⭐ |

### 2. UI/UX 설계 (2개)

| 문서명 | 설명 | 읽기 시간 | 우선순위 |
|--------|------|----------|---------|
| [SSOT_UI_DESIGN.md](./SSOT_UI_DESIGN.md) | UI 디자인 시스템 단일 정본 | 20분 | ⭐⭐⭐⭐⭐ |
| [React_Query_표준_패턴.md](./React_Query_표준_패턴.md) | React Query 캐시 전략 표준화 | 15분 | ⭐⭐⭐⭐⭐ |

### 3. Agent 기반 아키텍처 (3개)

| 문서명 | 설명 | 읽기 시간 | 우선순위 |
|--------|------|----------|---------|
| [Agent_아키텍처_전환.md](./Agent_아키텍처_전환.md) | Intent → Agent 전환 가이드 | 25분 | ⭐⭐⭐⭐ |
| [Agent_파라미터_추출.md](./Agent_파라미터_추출.md) | LLM Function Calling 파라미터 추출 | 30분 | ⭐⭐⭐⭐⭐ |
| [Agent_계약검증.md](./Agent_계약검증.md) | 6대 계약 + 배포 전 검증 + 모니터링 | 40분 | ⭐⭐⭐⭐⭐ |

### 4. 자동화 및 테스트 (3개)

| 문서명 | 설명 | 읽기 시간 | 우선순위 |
|--------|------|----------|---------|
| [프로젝트_자동화_가이드.md](./프로젝트_자동화_가이드.md) | CI/CD + 41개 검증 명령어 | 30분 | ⭐⭐⭐⭐⭐ |
| [TESTING.md](./TESTING.md) | 유닛/E2E 테스트 가이드 | 20분 | ⭐⭐⭐⭐⭐ |
| [프론트 자동화.md](./프론트 자동화.md) | 프론트엔드 자동화 Policy 기반 | 25분 | ⭐⭐⭐⭐ |

### 5. 성능 및 운영 (8개)

| 문서명 | 설명 | 읽기 시간 | 우선순위 |
|--------|------|----------|---------|
| [PERFORMANCE_MONITORING_GUIDE.md](./PERFORMANCE_MONITORING_GUIDE.md) | 성능 모니터링 종합 가이드 (통합본) | 30분 | ⭐⭐⭐⭐⭐ |
| [챗봇_성능최적화.md](./챗봇_성능최적화.md) | ChatOps 응답 시간/비용 최적화 | 20분 | ⭐⭐⭐⭐ |
| [챗봇.md](./챗봇.md) | ChatOps 시스템 전체 가이드 | 40분 | ⭐⭐⭐ |
| [핸들러 구현.md](./핸들러 구현.md) | Execution Audit Handler 구현 | 15분 | ⭐⭐⭐ |
| [SENTRY_SETUP_GUIDE.md](./SENTRY_SETUP_GUIDE.md) | Sentry 에러 추적 설정 | 15분 | ⭐⭐⭐⭐ |
| [SECURITY_CONFIGURATION_GUIDE.md](./SECURITY_CONFIGURATION_GUIDE.md) | 보안 설정 가이드 | 10분 | ⭐⭐⭐⭐ |
| [QUICK_ENV_SETUP.md](./QUICK_ENV_SETUP.md) | 빠른 환경 설정 | 10분 | ⭐⭐⭐⭐ |
| [CRON_AND_ENV_SETUP_GUIDE.md](./CRON_AND_ENV_SETUP_GUIDE.md) | Cron 및 환경 변수 상세 가이드 | 20분 | ⭐⭐⭐ |
| [JOB_QUEUE_ARCHITECTURE.md](./JOB_QUEUE_ARCHITECTURE.md) | 백그라운드 작업 큐 아키텍처 | 15분 | ⭐⭐⭐ |

---

## 🔍 주제별 문서 찾기

### 보안 (Security)

- [rules.md](./rules.md) - RLS, withTenant(), Zero-Trust 원칙
- [체크리스트.md](./체크리스트.md) - P0 보안 항목 (13개)
- [Agent_계약검증.md](./Agent_계약검증.md) - 권한 검증 (C-AUTH)

### 성능 (Performance)

- [PERFORMANCE_MONITORING_GUIDE.md](./PERFORMANCE_MONITORING_GUIDE.md) - 성능 모니터링 시스템 ⭐
- [챗봇_성능최적화.md](./챗봇_성능최적화.md) - ChatOps 최적화 (Phase 1-4)
- [React_Query_표준_패턴.md](./React_Query_표준_패턴.md) - 캐시 전략
- [SSOT_UI_DESIGN.md](./SSOT_UI_DESIGN.md) - Virtual Scrolling 규칙

### 운영 & DevOps

- [SENTRY_SETUP_GUIDE.md](./SENTRY_SETUP_GUIDE.md) - 프론트엔드 에러 추적
- [SECURITY_CONFIGURATION_GUIDE.md](./SECURITY_CONFIGURATION_GUIDE.md) - 보안 설정
- [QUICK_ENV_SETUP.md](./QUICK_ENV_SETUP.md) - 빠른 환경 설정
- [CRON_AND_ENV_SETUP_GUIDE.md](./CRON_AND_ENV_SETUP_GUIDE.md) - Cron 작업 설정

### 업종 확장 (Industry Expansion)

- [Industry_Neutrality.md](./Industry_Neutrality.md) - 핵심 원칙 (SSOT)
- [Agent_아키텍처_전환.md](./Agent_아키텍처_전환.md) - Industry Adapter
- [디어쌤_아키텍처.md](./디어쌤_아키텍처.md) - 업종별 필드 커스터마이징

### 데이터 페칭 (Data Fetching)

- [React_Query_표준_패턴.md](./React_Query_표준_패턴.md) - Query Key, Cache Time
- [rules.md](./rules.md) - useQuery 규칙
- [체크리스트.md](./체크리스트.md) - P1-DATA-CONSISTENCY

### UI 컴포넌트 (UI Components)

- [SSOT_UI_DESIGN.md](./SSOT_UI_DESIGN.md) - UI Core Component 카탈로그
- [체크리스트.md](./체크리스트.md) - P2-UX 항목
- [프론트 자동화.md](./프론트 자동화.md) - Policy 기반 UI 조정

### 테스트 (Testing)

- [TESTING.md](./TESTING.md) - 유닛/E2E 테스트 전체 가이드
- [프로젝트_자동화_가이드.md](./프로젝트_자동화_가이드.md) - CI 파이프라인 테스트
- [체크리스트.md](./체크리스트.md) - P2-TEST 항목

### ChatOps/AI

- [Agent_아키텍처_전환.md](./Agent_아키텍처_전환.md) - Agent 기반 아키텍처
- [Agent_파라미터_추출.md](./Agent_파라미터_추출.md) - LLM Function Calling
- [Agent_계약검증.md](./Agent_계약검증.md) - Tool 실행 검증
- [챗봇_성능최적화.md](./챗봇_성능최적화.md) - 성능 튜닝

---

## 📊 문서 상태 요약

| 상태 | 문서 수 | 비율 |
|------|---------|------|
| ✅ 최신 (2026) | 24개 | 100% |
| ⚠️ 확인 필요 | 0개 | 0% |
| ❌ Obsolete | 0개 | 0% |

**최신성**: 모든 문서 2026년 최신화 완료, 프로덕션 배포 반영
**문서 정리**: 2026-01-26 중복 문서 50+ 개 제거, 통합 완료
**업종 확장성**: Industry Neutrality 원칙 준수로 새 업종 추가 시 Tool 코드 수정 불필요 ⭐

### 최근 정리 내역 (2026-01-26)

#### 삭제된 중복 문서
- **docs/archive**: 47개 AI 생성 중복 리포트 삭제
  - PERFORMANCE_OPTIMIZATION 시리즈 (4개 → 1개 유지)
  - PHASE2-4 시리즈 (8개 → 1개 유지)
  - Classes Page 관련 (10개 → 1개 유지)
  - Teachers Page 관련 (8개 → 1개 유지)
  - Attendance Page 관련 (3개 → 1개 유지)
  - SSOT 검증 시리즈 (6개 → 1개 유지)

#### 통합된 문서
- **docu/PERFORMANCE_MONITORING_GUIDE.md**: 9개 성능 모니터링 문서를 하나로 통합
  - 원본 6개 문서 삭제 (통합본에 모든 내용 포함)
  - Sentry, 보안, 환경 설정 가이드는 별도 유지

#### 보관된 참조 문서
- **docs/archive**: 9개 핵심 구현 보고서 보관 (참조용)

---

## 🔗 문서 간 관계 (Dependency Graph)

```
rules.md (기본 규칙)
  ↓
Industry_Neutrality.md (SSOT: 업종 중립성)
  ↓
├─ Agent_아키텍처_전환.md (Agent 개요)
│   ↓
│   ├─ Agent_파라미터_추출.md (파라미터)
│   └─ Agent_계약검증.md (검증 + 배포 전 검증 + 모니터링)
│
├─ SSOT_UI_DESIGN.md (UI 설계)
│   └─ React_Query_표준_패턴.md (데이터 페칭)
│
└─ 체크리스트.md (P0/P1/P2)
    └─ 코드검증_지시문.md (검증 프롬프트)
```

---

## 🚨 자주 놓치는 규칙 (Quick Reference)

### P0 (즉시 장애/보안)

1. **RLS 필수**: 모든 테이블에 `tenant_id` 기반 RLS 정책
2. **withTenant() 필수**: 모든 쿼리에 `withTenant(tenantId)` 적용
3. **Zero-Trust**: 프론트엔드 판단 금지, 모든 권한은 서버/Edge Function에서

### P1 (중장기 리스크)

1. **Policy 캐시 5분**: `CACHE_TIMES.POLICY = 5분` 고정
2. **UI Core Component 사용**: Custom 컴포넌트 금지
3. **Industry Neutrality**: 하드코딩된 업종 로직 금지

### P2 (품질/유지보수)

1. **테스트 커버리지 80%**: 핵심 훅 100% 커버
2. **타입 안전성**: `any` 타입 금지
3. **린트 통과**: `npm run lint` 0 warnings

---

## 📝 문서 작성 규칙

### 신규 문서 생성 시

1. **Front Matter 필수**:
```markdown
# 문서 제목

**작성일**: YYYY-MM-DD
**버전**: 1.0.0
**상태**: ✅ 운영 중 / ⚠️ 검토 중 / ❌ Obsolete
```

2. **목차 필수** (4개 이상 섹션일 경우)

3. **관련 문서 링크 필수** (하단에 배치)

4. **예시 코드 포함** (가능한 경우)

### 기존 문서 업데이트 시

1. **버전 업데이트**: 버전 번호 증가 (major.minor.patch)
2. **최종 업데이트 날짜**: Front Matter 날짜 갱신
3. **변경 이력**: 필요시 "## 변경 이력" 섹션 추가

---

## 🆘 문제 해결

### "어떤 문서를 먼저 읽어야 하나요?"

→ 역할별 추천 섹션 참조 ([🎯 빠른 시작](#-빠른-시작-역할별-추천-문서))

### "특정 주제 문서가 어디 있나요?"

→ 주제별 문서 찾기 섹션 참조 ([🔍 주제별 문서 찾기](#-주제별-문서-찾기))

### "문서 내용이 오래된 것 같아요"

→ Front Matter의 "작성일" 및 "상태" 확인, 필요시 Issue 생성

### "여러 문서에서 같은 내용을 발견했어요"

→ SSOT 문서 확인 ([Industry_Neutrality.md](./Industry_Neutrality.md) 등), 다른 문서는 참조용

---

## 🤖 Claude Code 사용 가이드

Claude Code는 마크다운 링크를 **자동으로 따라가지 않습니다**. 작업 유형에 따라 아래 프롬프트를 사용하세요.

### 새 업종 테넌트 추가 시

```
새 업종(예: 헬스장) 테넌트 추가 작업을 해야 해.
다음 문서들을 순서대로 읽고 작업해:
1. docu/Industry_Neutrality.md
2. docu/rules.md
3. docu/체크리스트.md
```

### 백엔드 작업 시

```
백엔드 작업을 해야 해.
다음 문서들을 읽고 규칙을 따라줘:
1. docu/rules.md (RLS, withTenant 규칙)
2. docu/Industry_Neutrality.md (Industry Adapter 패턴)
3. docu/Agent_계약검증.md (6대 계약 검증)
```

### 프론트엔드 작업 시

```
프론트엔드 작업을 해야 해.
다음 문서들을 읽고 규칙을 따라줘:
1. docu/SSOT_UI_DESIGN.md (UI 디자인 시스템)
2. docu/React_Query_표준_패턴.md (데이터 페칭)
3. docu/체크리스트.md (P1/P2 UI 항목)
```

### Agent/ChatOps 작업 시

```
ChatOps Agent 작업을 해야 해.
다음 문서들을 읽고 규칙을 따라줘:
1. docu/Agent_아키텍처_전환.md
2. docu/Agent_파라미터_추출.md
3. docu/Agent_계약검증.md
4. docu/챗봇_성능최적화.md
```

### 전체 문서 탐색 (Explore Agent 활용)

```
docu/ 폴더의 모든 문서를 탐색해서 [작업 내용]에 관련된 규칙과 패턴을 찾아줘.
```

> **팁**: Claude Code의 Explore Agent는 코드베이스를 빠르게 탐색할 수 있습니다. 어떤 문서를 읽어야 할지 모를 때 유용합니다.

---

## 📞 Contact

- **문서 관련 질문**: GitHub Issue 생성
- **긴급 문서 업데이트 요청**: PR 생성
- **문서 오류 발견**: Issue 생성 (Label: `documentation`)

---

---

## 🌐 업종 확장성 (Industry Neutrality)

이 프로젝트는 **다양한 업종의 테넌트를 관리하는 SaaS 플랫폼**입니다.

**핵심 원칙**:
- Tool 명칭은 업종 무관 (`manage_student`, `manage_payment`)
- 사용자는 업종별 용어 사용 가능 (학생/고객/회원)
- Industry Adapter가 동적 테이블 매핑
- 새 업종 추가 시 Tool 코드 변경 불필요

**자세한 내용**: [Industry_Neutrality.md](./Industry_Neutrality.md) ⭐

---

**문서 버전**: 3.0.0 (대규모 정리 및 재구성 완료)
**최종 업데이트**: 2026-01-26
**작성자**: Claude Sonnet 4.5
**주요 변경사항**:
- 중복 문서 50+ 개 제거
- 성능 모니터링 문서 9개 통합
- AI 생성 리포트 정리 완료
- 전체 문서 수: 95개 → 33개 (65% 감소)
