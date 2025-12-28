# 상담일지 AI 요약 생성 Edge Function (서버가 생성하며 AI 호출 포함)

## 개요

서버가 ChatGPT API를 호출하여 상담일지 내용을 요약합니다.

## 환경변수 설정

Supabase 프로젝트의 Secrets에 다음 환경변수를 설정해야 합니다:

```bash
OPENAI_API_KEY=sk-proj-...
```

## 배포

```bash
supabase functions deploy consultation-ai-summary --project-ref xawypsrotrfoyozhrsbb
```

## API 엔드포인트

```
POST /functions/v1/consultation-ai-summary
```

### 요청 본문

```json
{
  "consultation_id": "uuid"
}
```

### 응답

```json
{
  "ai_summary": "학생은 최근 수업에 적극적으로 참여하고 있으며, 학습 동기가 높아 보입니다. 다만 과제 제출이 늦는 경향이 있어 시간 관리 능력을 향상시킬 필요가 있습니다."
}
```

## 동작 방식

1. 상담기록 조회 (tenant_id로 필터링)
2. PII 마스킹 적용 (아키텍처 문서 3.1.5, 898-950줄)
   - 학생 실명 → [학생]
   - 전화번호 → 010-****-****
   - 학원명 → [학원명]
   - 주소 → [주소]
   - 이메일 → u***@example.com
3. 서버가 ChatGPT API를 호출하여 요약 생성
4. 상담기록의 `ai_summary` 필드에 저장

## 모델

- `gpt-4o-mini` 사용
- Temperature: 0.3 (일관성 있는 요약)
- Max tokens: 300

## Zero-Trust 준수

- JWT에서 `tenant_id` 추출 (요청 본문에서 받지 않음)
- RLS 정책으로 데이터 접근 제어

## 아키텍처 문서 참조

- 3.1.5: 상담일지 요약 시 개인정보 마스킹 규칙 (898-950줄)
- 3.7.1: 상담일지 자동 요약 기능

