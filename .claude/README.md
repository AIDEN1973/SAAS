# Claude Code 설정 가이드

이 디렉토리는 SAMDLE 프로젝트에서 Claude Code를 사용할 때 필요한 설정 파일들을 포함합니다.

## 파일 구조

```
.claude/
├── mcp.json                    # MCP (Model Context Protocol) 서버 설정
├── settings.local.json         # 로컬 권한 설정
└── README.md                   # 이 파일
```

## MCP (Model Context Protocol) 서버 설정

### 개요

MCP는 Claude가 외부 도구 및 데이터 소스와 통신할 수 있게 해주는 프로토콜입니다.
현재 SAMDLE 프로젝트에서는 다음 MCP 서버들이 설정되어 있습니다:

1. **Supabase MCP**: 데이터베이스 쿼리, 마이그레이션, Edge Function 관리
2. **GitHub MCP**: 저장소 관리, 이슈/PR 작업
3. **Memory MCP**: 대화 컨텍스트 메모리 관리

### 설정 방법

#### 1. VSCode Extension 사용 (권장)

VSCode에서 Claude Code Extension을 사용하는 경우, 이미 프로젝트의 [.claude/mcp.json](.claude/mcp.json)이 자동으로 감지됩니다.

**확인 방법**:
1. VSCode에서 Claude Code 패널 열기
2. 설정(⚙️) 아이콘 클릭
3. "MCP Servers" 섹션에서 Supabase, GitHub, Memory 서버 확인

#### 2. Claude Desktop 사용

Claude Desktop 앱을 사용하는 경우:

**Windows**:
```powershell
# MCP 설정 파일 위치
%APPDATA%\Claude\claude_desktop_config.json
```

**macOS/Linux**:
```bash
# MCP 설정 파일 위치
~/Library/Application Support/Claude/claude_desktop_config.json
```

`.claude/mcp.json`의 내용을 위 파일에 복사하거나, 심볼릭 링크를 생성합니다.

### 환경변수

MCP 서버들은 다음 환경변수를 사용합니다:

#### 설정 방법

**옵션 1: 시스템 환경변수 사용 (권장)**

Windows (PowerShell):
```powershell
$env:SUPABASE_URL="https://xawypsrotrfoyozhrsbb.supabase.co"
$env:SUPABASE_ACCESS_TOKEN="your_token_here"
$env:GITHUB_PERSONAL_ACCESS_TOKEN="your_token_here"
```

macOS/Linux (Bash):
```bash
export SUPABASE_URL="https://xawypsrotrfoyozhrsbb.supabase.co"
export SUPABASE_ACCESS_TOKEN="your_token_here"
export GITHUB_PERSONAL_ACCESS_TOKEN="your_token_here"
```

**옵션 2: mcp.json 직접 수정**

1. `mcp.json.example`을 `mcp.json`으로 복사:
   ```bash
   cp .claude/mcp.json.example .claude/mcp.json
   ```

2. `mcp.json`에서 `${VARIABLE_NAME}` 부분을 실제 값으로 변경

⚠️ **보안 경고**:
- **절대로 실제 토큰 값이 포함된 `mcp.json`을 커밋하지 마세요!**
- `.claude/mcp.json`은 `.gitignore`에 포함되어 있습니다
- 토큰 발급 방법은 아래 "토큰 발급" 섹션 참조

#### 필요한 환경변수

**Supabase**:
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_ACCESS_TOKEN`: Supabase Access Token (Management API용)

**GitHub**:
- `GITHUB_PERSONAL_ACCESS_TOKEN`: GitHub Personal Access Token

### 토큰 발급

#### Supabase Access Token
1. [Supabase Dashboard](https://app.supabase.com) 로그인
2. Settings → Access Tokens 이동
3. "Generate new token" 클릭
4. 토큰 이름 입력 후 생성
5. 생성된 토큰 복사 (한 번만 표시됨!)

#### GitHub Personal Access Token
1. [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) 이동
2. "Generate new token (classic)" 클릭
3. 필요한 권한 선택:
   - `repo` (전체 저장소 접근)
   - `read:org` (조직 정보 읽기)
   - `read:user` (사용자 정보 읽기)
4. "Generate token" 클릭
5. 생성된 토큰 복사 (한 번만 표시됨!)

### 사용 가능한 MCP 도구들

#### Supabase MCP

```typescript
// 테이블 목록 조회
mcp__supabase__list_tables

// SQL 실행
mcp__supabase__execute_sql

// 마이그레이션 적용
mcp__supabase__apply_migration

// Edge Function 배포
mcp__supabase__deploy_edge_function

// Edge Function 목록
mcp__supabase__list_edge_functions

// 로그 조회
mcp__supabase__get_logs

// 마이그레이션 목록
mcp__supabase__list_migrations

// Supabase 문서 검색
mcp__supabase__search_docs

// Extension 목록
mcp__supabase__list_extensions
```

#### GitHub MCP

```typescript
// 저장소 검색
mcp__github__search_repositories

// 파일 내용 조회
mcp__github__get_file_contents

// 파일 생성/업데이트
mcp__github__create_or_update_file

// 이슈 생성/조회/업데이트
mcp__github__create_issue
mcp__github__get_issue
mcp__github__list_issues
mcp__github__update_issue

// PR 생성/조회/병합
mcp__github__create_pull_request
mcp__github__get_pull_request
mcp__github__list_pull_requests
mcp__github__merge_pull_request

// 그 외 다양한 GitHub 작업...
```

#### Memory MCP

```typescript
// 지식 그래프 읽기
mcp__memory__read_graph

// 엔티티 생성/삭제
mcp__memory__create_entities
mcp__memory__delete_entities

// 관계 생성/삭제
mcp__memory__create_relations
mcp__memory__delete_relations

// 관찰 추가/삭제
mcp__memory__add_observations
mcp__memory__delete_observations

// 노드 검색
mcp__memory__search_nodes
```

### 권한 관리

[settings.local.json](settings.local.json)에서 각 MCP 도구에 대한 권한을 관리합니다.

**권한 추가 예시**:
```json
{
  "permissions": {
    "allow": [
      "mcp__supabase__list_tables",
      "mcp__supabase__execute_sql",
      "mcp__github__create_issue"
    ]
  }
}
```

## 문제 해결

### MCP 서버가 연결되지 않는 경우

1. **Node.js 버전 확인**: Node.js 18 이상이 필요합니다
   ```bash
   node --version
   ```

2. **npx 권한 확인**: MCP 서버는 `npx`를 통해 실행됩니다
   ```bash
   npx -y @modelcontextprotocol/server-supabase --version
   ```

3. **환경변수 확인**: `.env.local`에 필요한 환경변수가 모두 설정되어 있는지 확인

4. **VSCode 재시작**: VSCode를 재시작하여 MCP 설정을 다시 로드

### 권한 오류

- [settings.local.json](settings.local.json)의 `permissions.allow` 배열에 해당 도구가 추가되어 있는지 확인
- VSCode Claude Code 패널에서 권한 요청 알림을 확인

### 연결 테스트

Claude Code에서 다음 명령으로 MCP 서버 연결을 테스트할 수 있습니다:

```
Supabase 테이블 목록을 조회해줘
```

정상적으로 연결되었다면 데이터베이스의 테이블 목록이 출력됩니다.

## 참고 자료

- [MCP 공식 문서](https://modelcontextprotocol.io/)
- [Supabase MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/supabase)
- [GitHub MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/github)
- [Memory MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)

## 버전 정보

- **작성일**: 2026-01-26
- **Claude Code 버전**: VSCode Extension
- **MCP 프로토콜 버전**: 1.0
