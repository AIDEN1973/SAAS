# 학생 이탈 위험 분석 Edge Function

## 개요

ChatGPT API를 사용하여 학생의 출결·상담·성적 패턴을 종합 분석하고 이탈 위험도를 평가합니다.

## 환경변수 설정

Supabase 프로젝트의 Secrets에 다음 환경변수를 설정해야 합니다:

```bash
OPENAI_API_KEY=sk-proj-...
```

## 배포

```bash
supabase functions deploy student-risk-analysis
```

## API 엔드포인트

```
POST /functions/v1/student-risk-analysis
```

### 요청 본문

```json
{
  "tenant_id": "uuid",
  "student_id": "uuid"
}
```

### 응답

```json
{
  "risk_score": 75,
  "risk_level": "high",
  "reasons": [
    "최근 30일간 결석/지각률이 30% 이상입니다.",
    "상담일지가 없어 학생 상태 파악이 어렵습니다."
  ],
  "recommended_actions": [
    "학부모와 상담 일정을 잡아주세요.",
    "출결 패턴을 면밀히 관찰하세요.",
    "학생의 학습 동기를 파악하세요."
  ]
}
```

## 동작 방식

1. 학생의 최근 30일 출결 데이터 조회
2. 상담일지 조회
3. 반 배정 정보 조회
4. ChatGPT API를 통해 종합 분석 수행
5. 위험 점수가 90 이상이면 `task_cards`에 카드 자동 생성 (StudentTaskCard는 학생용 별칭)

## 모델

- `gpt-4o-mini` 사용
- JSON 형식으로 응답 받음
- Temperature: 0.3 (일관성 있는 분석)

