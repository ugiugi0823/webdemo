# LLM42 웹데모

42Maru 사내 LLM 데모 웹앱. vLLM 서버에 SSE 스트리밍으로 채팅 요청을 보내고 결과를 실시간으로 표시합니다.

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| React 18 + TypeScript 5 | UI |
| Vite 8 | 번들러 |
| Tailwind CSS v4 | 스타일 (Vite 플러그인 방식, `@tailwindcss/vite`) |
| react-markdown + remark-gfm | 마크다운 렌더링 |
| remark-math + rehype-katex | 수식 렌더링 (`$...$`) |
| react-syntax-highlighter | 코드 블록 하이라이팅 |
| lucide-react | 아이콘 |

---

## 빠른 시작

```bash
cd dev/
npm install

# 개발 서버 (port 9090, 핫리로드, API 로그 패널 포함)
npm run dev

# 프로덕션 빌드
npm run build
```

### Docker 배포 (port 8080)

```bash
cd dev/
docker compose -f docker/docker-compose.yml up -d --build
```

---

## 두 가지 서빙 환경

의도적으로 분리해 운영합니다.

| 환경 | 포트 | API 로그 패널 | 용도 |
|------|------|--------------|------|
| `npm run dev` | **9090** | ✅ 있음 | 개발, 디버깅, 요청/응답 확인 |
| Docker (nginx) | **8080** | ❌ 없음 | 실제 데모 서빙 |

분기: `App.tsx` 하단 `{import.meta.env.DEV && <ApiLogPanel />}`

---

## 프록시 설정

### 개발 (`vite.config.ts`)
```ts
proxy: {
  '/api/vllm':    → https://llm42-api-int.42maru.com
  '/api/fastapi': → http://192.168.0.234:9016
}
```

### 프로덕션 (`docker/nginx.conf`)
```nginx
location /api/vllm/ {
    proxy_pass https://llm42-api-int.42maru.com;
    proxy_buffering off;    # SSE 스트리밍 필수 — 없으면 스트리밍 안 됨
    proxy_read_timeout 300s;
}
```

---

## 파일 구조

```
dev/
├── vite.config.ts
├── docker/
│   ├── Dockerfile              # node:20-alpine 빌드 → nginx:alpine 서빙
│   ├── nginx.conf              # SPA + 프록시 + SSE 설정
│   └── docker-compose.yml
└── src/
    ├── main.tsx                 # ThemeProvider 래핑
    ├── App.tsx                  # 레이아웃, 스크롤 관리, API 로그 패널
    ├── index.css                # Tailwind v4 + 커스텀 애니메이션
    ├── types.ts                 # 공유 타입
    ├── context/ThemeContext.tsx # 다크/라이트 모드 Context
    ├── api/chat.ts             # vLLM API 클라이언트 (핵심)
    ├── hooks/useChat.ts        # 채팅 상태 전체 관리
    └── components/
        ├── Sidebar.tsx          # 대화 목록 + 데모 기능 바로가기 + 설정 (시스템 프롬프트, Sampling, Temperature)
        ├── ChatMessage.tsx      # 메시지 버블
        ├── ChatInput.tsx        # 입력창 + 파일 첨부
        └── WelcomeScreen.tsx    # 빈 화면 태스크 카드
```

---

## 핵심 구현 상세

### 1. vLLM API 연동 (`src/api/chat.ts`)

#### API 요청 구조
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

- 이미지 첨부 시: `max_tokens: 4096`, `temperature` 제외
- 문서 첨부 시: `temperature` 제외
- `sampling=false` 시: `temperature: 0` (greedy decoding)

#### 시스템 프롬프트 우선순위

`useChat.ts`의 `sendMessage`에서 아래 순으로 적용:

```ts
activeTask?.systemPrompt ?? params.systemPrompt
```

태스크 카드 선택 시 해당 태스크의 `systemPrompt`가 우선. 없으면 설정 패널에서 입력한 `params.systemPrompt` 사용.

#### `buildMessages(history, systemPrompt, docMaxChars)`

히스토리 → vLLM API 형식 변환. 분기별 처리:

| 메시지 종류 | 처리 |
|------------|------|
| user + 이미지 | multimodal content 배열 (`text` → `image_url` 순서 고정, vLLM 규칙) |
| user + 문서 | `[첨부 문서: ...]\n\n{추출텍스트}\n---\n{질문}` 형식으로 prepend |
| assistant | `<think>...</think>` 태그 strip (히스토리 오염 방지) |
| user 일반 | `usedThinking=true`이면 `\n\n질문의 의도를 파악해` suffix 재적용 |

#### SSE 스트리밍 파싱
```ts
delta.reasoning_content  →  thinking 버퍼에 누적
delta.content            →  content 버퍼에 누적 + UI에 yield
```
두 필드를 독립 `if`로 처리 — vLLM이 둘 중 하나에만 출력하는 경우가 있음.

#### 문서 크기 자동 축소
HTTP 400 + "context too long" 시 `docMaxChars`를 절반씩 줄여 재시도:
```
20,000자 → 10,000자 → 5,000자 → ... → 500자 (최솟값, 이하면 에러 반환)
```

---

### 2. 채팅 상태 관리 (`src/hooks/useChat.ts`)

#### API 전송 전 히스토리 전처리

```ts
filterEmptyTurns(trimHistory([...messages, userMsg]))
```

1. **`trimHistory`**: 전체 글자 수 > 80,000자 → 앞에서부터 제거 (최소 2개 유지)
2. **`filterEmptyTurns`**: (user, 빈 assistant) 쌍 및 단독 빈 assistant 메시지 제거

빈 assistant 메시지가 히스토리에 남으면 모델이 연속 빈 응답을 출력하는 버그가 있었음.

#### 빈 응답 자동 재시도

스트리밍 로직을 `runStream()` 내부 함수로 추출, content가 없으면 1회 자동 재시도:

```ts
let { contentBuf } = await runStream(assistantId)

if (!contentBuf) {
  // 메시지 초기화 후 재시도 (ID 유지)
  setMessages(prev => prev.map(m =>
    m.id === assistantId ? { ...m, content: '', thinking: undefined, streaming: true } : m
  ))
  abortRef.current = new AbortController()
  const retry = await runStream(assistantId)
  contentBuf = retry.contentBuf
}

const finalContent = contentBuf || '답변을 반환할 수 없습니다.'
```

#### `resendFrom(messageId, newText)`

해당 인덱스 이전까지 메시지를 잘라내고 `sendMessage` 재호출. 마지막 user 메시지의 편집/재전송에 사용.

#### 대화 이력 저장

- 키: `localStorage['llm42_conversations']`
- 최대 30개, 스트리밍 완료 시 자동 저장

---

### 3. 메시지 렌더링 (`src/components/ChatMessage.tsx`)

#### Thinking 처리 흐름

```
스트리밍 중:
  delta.reasoning_content → message.thinking에 누적
  → "추론 과정" 버튼 표시 (스트리밍 중엔 점 3개 애니메이션)

렌더링 시 (보조 파싱):
  content에 <think>...</think> 태그가 있으면 분리해 display
```

#### 렌더링 조건 분기

| 상태 | 렌더링 |
|------|--------|
| 스트리밍 중, content·thinking 모두 없음 | 점 3개 로딩 |
| 스트리밍 중, thinking만 있음 | 추론 과정 버튼만 |
| 스트리밍 완료, content 있음 | 말풍선 |
| 스트리밍 완료, content 없음 | "답변을 반환할 수 없습니다." |

#### 마크다운 + 수식 렌더링 (어시스턴트 메시지만)

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkMath]}
  rehypePlugins={[rehypeKatex]}
  components={{ code: CodeBlock }}
>
  {content}
</ReactMarkdown>
```

#### 메시지 편집 UI

마지막 user 메시지, 스트리밍 완료 후에만 편집/재전송 버튼 표시:

```tsx
// App.tsx
const lastUserIdx = messages.reduce((last, m, i) => m.role === 'user' ? i : last, -1)
<ChatMessage isLastUser={i === lastUserIdx && !isStreaming} />
```

편집 모드: 전체 너비 textarea, `onChange`에서 `el.style.height = el.scrollHeight + 'px'`로 자동 높이 조절.

---

### 4. 파일 첨부 (`src/components/ChatInput.tsx`)

| 종류 | 최대 크기 | 처리 방식 |
|------|----------|-----------|
| 이미지 | 10MB | `FileReader.readAsDataURL` → base64 → `Message.image` |
| 문서 (PDF/DOCX/HWP 등) | 30MB | `docExtract.ts`에서 텍스트 추출 → `Message.document.text` |

드래그앤드롭: 입력창 `div`의 `onDragOver` + `onDrop` 이벤트 → `processFile()` 동일하게 처리.

---

### 5. 스크롤 관리 (`src/App.tsx`)

생성 중 수동 스크롤 가능 + 새 메시지 전송 시 맨 아래 이동.

```ts
const userScrolledUp = useRef(false)   // 사용자가 위로 스크롤했는지
const isAutoScrolling = useRef(false)  // 프로그램이 스크롤 중인지 (onScroll 오감지 방지)

useEffect(() => {
  if (!userScrolledUp.current) {
    isAutoScrolling.current = true
    el.scrollTop = el.scrollHeight     // smooth 금지 — 토큰마다 animation 충돌로 stuttering
    setTimeout(() => { isAutoScrolling.current = false }, 50)
  }
}, [messages])

// 수동 스크롤 감지
const handleMessagesScroll = () => {
  if (isAutoScrolling.current) return  // 프로그램 스크롤 무시
  userScrolledUp.current = true
}

// 전송 시 리셋
userScrolledUp.current = false
```

---

### 6. 다크 모드 (`src/context/ThemeContext.tsx`)

`localStorage['llm42_theme']`에 저장. 컴포넌트별 `dark ? 'darkColor' : 'lightColor'` 인라인 스타일로 적용.

---

## 타입 정의 (`src/types.ts`)

```ts
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string          // 추론 과정
  usedThinking?: boolean     // API 전송 시 thinking=true였는지 (히스토리 재구성용)
  image?: { base64: string; mimeType: string; name: string }
  document?: { name: string; type: string; text: string }
  timestamp: Date
  streaming?: boolean
}

interface ChatParams {
  thinking: boolean       // Thinking 모드
  temperature: number     // 0.0 ~ 2.0
  sampling: boolean       // false → temperature=0 (greedy)
  systemPrompt?: string   // 사용자 정의 시스템 프롬프트 (설정 패널에서 입력)
}
```

---

## 알려진 미해결 버그

**thinking 전환 시 hang**: thinking=true → false 전환 후 다음 요청에서 브라우저가 응답하지 않는 현상. 30초 fetch 타임아웃(`AbortSignal.timeout`)으로 임시 처리 중. 근본 원인 미확정.

---

## 알려진 주의사항

| 항목 | 내용 |
|------|------|
| vLLM multimodal | content 배열에서 `text`가 `image_url`보다 **먼저** 와야 함 |
| SSE + nginx | `proxy_buffering off` 없으면 스트리밍이 청크 단위로 묶여서 옴 |
| 한글 IME Enter | `e.nativeEvent.isComposing` 체크 없으면 조합 중 Enter에 이중 입력 발생 |
| fixed 모달 | CSS animation 부모 안에서 `position: fixed`가 어긋남 → `createPortal(modal, document.body)` |
| localStorage 한도 | 이미지 포함 대화 저장 시 base64가 통째로 저장 → 5~10MB 한도 초과 시 저장 실패 (현재 조용히 무시 중) |
| smooth scroll | 스트리밍 중 `scrollIntoView({ behavior: 'smooth' })` 사용 금지 → stuttering |
