# LLM42 웹데모 — 프로젝트 문서

> 이 파일이 메인 문서입니다. 다른 `.md` 파일들은 참고용 아카이브입니다.
> 마지막 업데이트: 2026-03-26

---

## 빠른 시작

```bash
# 개발 (핫리로드, API 로그 포함)
cd /data/rex/workspace/dev/webdemo/dev
npm run dev          # → http://localhost:9090

# 프로덕션 배포 (Docker, API 로그 없음)
cd /data/rex/workspace/dev/webdemo/dev
docker compose -f docker/docker-compose.yml up -d --build
# → http://localhost:8080
```

---

## 프로젝트 개요

42Maru 사내 LLM 데모 웹앱.
vLLM 서버(`192.168.0.234:9015`)에 SSE 스트리밍으로 채팅 요청.

- **스택:** Vite + React + TypeScript + Tailwind CSS v4
- **배포:** Docker (nginx) ← 실서빙 / npm dev ← 개발
- **API:** vLLM `/v1/chat/completions` (SSE streaming)

### 두 가지 서빙 환경

| 환경 | 포트 | API 로그 | 용도 |
|------|------|----------|------|
| npm dev | 9090 | ✅ 있음 | 개발/디버깅 |
| Docker  | 8080 | ❌ 없음 | 실제 데모 서빙 |

`import.meta.env.DEV`로 분기 (`App.tsx` 하단 API 로그 패널).

---

## 파일 구조

```
dev/
├── vite.config.ts              # 프록시 /api/vllm/* → 192.168.0.234:9015, port: 9090
├── docker/
│   ├── Dockerfile              # node:20-alpine 빌드 → nginx:alpine 서빙
│   ├── nginx.conf              # /api/vllm/ 프록시 설정
│   └── docker-compose.yml      # port 8080:80
└── src/
    ├── main.tsx                 # ThemeProvider 래핑
    ├── App.tsx                  # 전체 레이아웃, 스크롤 관리, API 로그 패널
    ├── index.css                # Tailwind v4 + custom (thinking-dot, avatar-spin 등)
    ├── types.ts                 # Message, ChatParams, TaskExample, Conversation, ApiLogEntry
    ├── context/
    │   └── ThemeContext.tsx     # dark/setDark React Context
    ├── api/
    │   └── chat.ts             # vLLM 클라이언트 (buildMessages, streamChat)
    ├── hooks/
    │   └── useChat.ts          # 메시지 상태, 대화 이력, resendFrom, retry 로직
    └── components/
        ├── Sidebar.tsx          # 대화 목록, 설정(Sampling/Temperature/Dark mode)
        ├── ChatMessage.tsx      # 메시지 버블, 편집UI, copy/resend 버튼, 수식 렌더링
        ├── ChatInput.tsx        # 입력창, 파일 첨부, Thinking 토글
        └── WelcomeScreen.tsx    # 빈 화면 태스크 카드 (5종)
```

---

## 현재 구현된 기능

| 기능 | 파일 | 비고 |
|------|------|------|
| SSE 스트리밍 + 중단(AbortController) | api/chat.ts, useChat.ts | |
| Thinking 모드 (Brain 버튼) | ChatInput.tsx | `chat_template_kwargs.thinking` |
| 추론 과정 표시 (접이식) | ChatMessage.tsx | `delta.reasoning_content` 파싱 |
| 수식 렌더링 (KaTeX) | ChatMessage.tsx | assistant 답변에만 적용, `$...$` |
| 이미지 첨부 + 전체화면 | ChatInput, ChatMessage | base64, portal, Esc 닫기 |
| 문서 첨부 (PDF/HWP/DOCX 등) | ChatInput, docExtract.ts | 텍스트 추출 후 전송 |
| 마지막 메시지 편집/재전송 | ChatMessage.tsx, useChat.ts | 스트리밍 완료 후에만 표시 |
| 메시지 복사 버튼 | ChatMessage.tsx | hover 시 표시 |
| 대화 이력 (localStorage) | useChat.ts | 최대 30개 |
| 다크/라이트 모드 | ThemeContext, 각 컴포넌트 | |
| API 로그 패널 | App.tsx | DEV 빌드 전용 |
| 컨텍스트 트리밍 | useChat.ts | 80,000자 초과 시 앞에서 제거 |
| 빈 응답 자동 재시도 | useChat.ts | 1회 재시도 후 실패 시 "답변을 반환할 수 없습니다." |
| 문서 크기 자동 축소 | api/chat.ts | HTTP 400 시 docMaxChars 절반씩 감소 |
| 스크롤 관리 | App.tsx | 수동 스크롤 시 자동 스크롤 중단, 전송 시 리셋 |
| 한글 IME Enter 오입력 방지 | ChatInput.tsx | `e.nativeEvent.isComposing` 체크 |

---

## 미해결 버그

### [HIGH] thinking=true → false 전환 시 히스토리 불일치

**증상:** thinking=true 대화 후 false로 전환하면 후속 응답 이상/미출력.

**원인:**
- API 전송 시: `"너는 누구야\n\n질문의 의도를 파악해"` (suffix 주입)
- messages state 저장: `"너는 누구야"` (suffix 없음)
- 다음 턴에서 모델이 실제로 본 것과 다른 히스토리를 받음

**현재 부분 완화:** `buildMessages`에서 assistant content의 `<think>` 태그 strip.

**완전 수정 방법** (`task_thinking_history_bug.md` 참조):

1. `types.ts` — `Message`에 `usedThinking?: boolean` 추가 (이미 추가됨 ✅)
2. `useChat.ts` — `sendMessage`에서 `usedThinking: params.thinking && !hasImage` 저장 (이미 저장됨 ✅)
3. `chat.ts` — `buildMessages`의 일반 user 메시지 분기에서 suffix 재적용:
   ```ts
   // chat.ts buildMessages 내 else 분기
   const content = msg.usedThinking
     ? `${msg.content}\n\n질문의 의도를 파악해`
     : msg.content
   msgs.push({ role: msg.role, content })
   ```
4. `chat.ts` — `streamChat`의 `historyForApi` suffix 주입 로직 삭제 (buildMessages로 이전)

> ⚠️ 1,2단계는 이미 완료. 3,4단계가 미구현 상태.

---

## API 연결 상세

```
POST /api/vllm/v1/chat/completions
Authorization: Bearer <API_KEY>  ← chat.ts 상단 상수
```

**Request body:**
```json
{
  "model": "LLM42",
  "messages": [...],
  "stream": true,
  "max_tokens": 2048,
  "chat_template_kwargs": { "thinking": true },
  "temperature": 1.0
}
```

**조건별 처리:**
| 조건 | thinking | max_tokens | temperature |
|------|----------|------------|-------------|
| 기본 | params.thinking | 2048 | params.temperature (sampling=false면 0) |
| 이미지 포함 | params.thinking | 4096 | 제외 |
| 문서 포함 | params.thinking | 2048 | 제외 |

**SSE 파싱:**
- `delta.reasoning_content` 또는 `delta.reasoning` → thinking
- `delta.content` → 응답 본문

---

## 데이터 관리 요약

> 상세: `conversation_memory_report.md`

- **서버 저장 없음.** 모든 데이터는 브라우저에만 존재.
- **React 상태:** 현재 대화 메시지 (탭 닫으면 사라짐)
- **localStorage:** 대화 이력 최대 30개 (브라우저 재시작 후에도 유지)
- **주의:** 이미지 포함 대화 → base64가 localStorage에 저장됨 → 5~10MB 한도 초과 시 저장 실패 (try/catch 무시 중)

---

## 과거 수정된 주요 버그

| 버그 | 원인 | 수정 위치 |
|------|------|-----------|
| fixed 모달 위치 어긋남 | CSS animation transform stacking context | createPortal 사용 |
| thinking=false 빈 응답 | vLLM이 reasoning_content에만 출력 | delta 독립 if 처리 |
| 빈 응답 히스토리 누적 | empty assistant 메시지 전송 | filterEmptyTurns() |
| `<think>` 태그 히스토리 오염 | assistant content에 태그 잔존 | buildMessages에서 strip |
| 한글 IME 이중 입력 | composition 중 Enter 이벤트 | isComposing 체크 |
| 스크롤 stuttering | 토큰마다 scrollIntoView smooth | scrollTop 직접 설정 + isAutoScrolling ref |

---

## 아카이브 (참고용, 신규 작업 불필요)

| 파일 | 내용 |
|------|------|
| `handoff_20260326.md` | 이전 인수인계 문서 (이 파일로 대체됨) |
| `task_thinking_history_bug.md` | thinking 히스토리 버그 상세 (위 "미해결 버그" 섹션 참조) |
| `conversation_memory_report.md` | 메모리 관리 보고서 |
| `task_20260325.md`, `task_20260325_163816.md` | 과거 작업 태스크 |
| `피드백.md`, `디자인 피드백.md` | 초기 디자인 피드백 |
| `result_vllm_experiment*.md` | vLLM 실험 결과 |
| `goal.md`, `prompt.md` | 초기 기획 |
