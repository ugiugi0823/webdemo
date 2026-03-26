# 버그 리포트: thinking=true 턴의 히스토리 불일치 문제

**작성일:** 2026-03-26
**심각도:** 높음 — 멀티턴 대화 전체의 히스토리가 오염됨
**관련 파일:**
- `dev/src/api/chat.ts` — `streamChat`, `buildMessages`
- `dev/src/hooks/useChat.ts` — `sendMessage`
- `dev/src/types.ts` — `Message` 인터페이스

---

## 증상

thinking=true로 대화한 뒤, thinking=false로 전환하면 후속 응답이 이상하거나 아예 안 나온다.

**실제 관찰된 API 로그:**

**Turn 1 (thinking=true):**
```json
{
  "messages": [
    { "role": "user", "content": "너는 누구야\n\n질문의 의도를 파악해" }
  ],
  "chat_template_kwargs": { "thinking": true }
}
```
→ 모델 응답: "저는 ChatGPT입니다..."

**Turn 2 (thinking=false):**
```json
{
  "messages": [
    { "role": "user",      "content": "너는 누구야" },
    { "role": "assistant", "content": "저는 ChatGPT입니다..." },
    { "role": "user",      "content": "너를 만든 기업은 어디야" }
  ],
  "chat_template_kwargs": { "thinking": false }
}
```

---

## 근본 원인

`chat.ts`의 `streamChat`에서 `thinking=true`일 때 마지막 user 메시지에 `\n\n질문의 의도를 파악해`를 **API 전송용으로만 주입**하고, **앱 내부 messages 상태에는 원본 텍스트만 저장**한다.

```ts
// api/chat.ts — streamChat 내부
const historyForApi = effectiveThinking
  ? history.map((m, i) =>
      m.role === 'user' && i === history.length - 1 && m.content
        ? { ...m, content: `${m.content}\n\n질문의 의도를 파악해` }
        : m
    )
  : history
```

```ts
// hooks/useChat.ts — sendMessage 내부
const userMsg: Message = {
  id: uid(),
  role: 'user',
  content: text.trim(),   // ← suffix 없음. 원본 저장
  ...
}
```

결과적으로:
- **모델이 실제로 본 것:** `"너는 누구야\n\n질문의 의도를 파악해"`
- **다음 턴에 히스토리로 전송되는 것:** `"너는 누구야"` (suffix 없음)

모델 입장에서는 `"너는 누구야"`라는 짧은 질문에 thinking 모드 응답을 생성한 것처럼 보이는 모순된 히스토리를 받게 된다. 이로 인해 후속 응답이 비정상적이거나 미출력된다.

---

## 수정 방법 (권장: Option A)

### Option A — `Message`에 `usedThinking` 메타데이터 추가 후 `buildMessages`에서 재적용

**단계 1: `types.ts`의 `Message` 인터페이스에 필드 추가**

```ts
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  usedThinking?: boolean   // ← 추가: 이 메시지가 thinking=true로 전송됐는지
  image?: { base64: string; mimeType: string; name: string }
  document?: AttachedDocument
  timestamp: Date
  streaming?: boolean
}
```

**단계 2: `useChat.ts`의 `sendMessage`에서 `usedThinking` 저장**

```ts
const hasImage = !!image
const effectiveThinking = params.thinking && !hasImage  // 이미지 있으면 thinking 강제 false

const userMsg: Message = {
  id: uid(),
  role: 'user',
  content: text.trim(),
  usedThinking: effectiveThinking,   // ← 저장
  image,
  document,
  timestamp: new Date(),
}
```

**단계 3: `chat.ts`의 `buildMessages`에서 `usedThinking`이 true인 user 메시지에 suffix 재적용**

```ts
function buildMessages(history: Message[], systemPrompt?: string, docMaxChars = MAX_DOC_CHARS_INITIAL) {
  const msgs: { role: string; content: string | object[] }[] = []
  if (systemPrompt) msgs.push({ role: 'system', content: systemPrompt })

  for (const msg of history) {
    if (msg.role === 'user' && msg.image) {
      // ... (기존 multimodal 처리 — 변경 없음)
    } else if (msg.role === 'user' && msg.document) {
      // ... (기존 document 처리 — 변경 없음)
    } else if (msg.role === 'assistant') {
      // ... (기존 <think> 태그 strip — 변경 없음)
    } else {
      // user 텍스트 메시지
      const content = msg.usedThinking
        ? `${msg.content}\n\n질문의 의도를 파악해`   // ← suffix 재적용
        : msg.content
      msgs.push({ role: msg.role, content })
    }
  }
  return msgs
}
```

**단계 4: `streamChat`의 `historyForApi` suffix 주입 로직 삭제**

`buildMessages`가 suffix를 처리하므로 `streamChat`의 아래 코드는 삭제:

```ts
// 삭제 대상
const historyForApi = effectiveThinking
  ? history.map((m, i) =>
      m.role === 'user' && i === history.length - 1 && m.content
        ? { ...m, content: `${m.content}\n\n질문의 의도를 파악해` }
        : m
    )
  : history
```

`buildMessages` 호출도 `historyForApi` → `history`로 교체:

```ts
const messages = buildMessages(history, systemPrompt, docMaxChars)
```

---

## Option B (간단한 대안 — 단점 있음)

suffix를 주입하지 않고, `\n\n질문의 의도를 파악해`를 **system prompt에 포함**시키는 방식.
단점: thinking=false일 때도 system prompt에 영향이 남는다. 권장하지 않음.

---

## 검증 방법

수정 후 아래 시나리오를 API 로그로 직접 확인:

1. thinking=true로 메시지 전송 → Turn 1의 user content에 suffix 포함 확인
2. 같은 대화에서 thinking=false로 후속 전송 → Turn 1 히스토리의 user content에 suffix **여전히 포함** 확인
3. 새 대화에서 처음부터 thinking=false → suffix 미포함 확인

---

## 주의 사항

- `usedThinking`은 **display용이 아니라 API 히스토리 재구성용**이다. UI에 표시하지 않는다.
- localStorage에 저장된 기존 대화에는 `usedThinking` 필드가 없다 → `undefined`는 falsy이므로 suffix 미적용으로 처리되어 하위 호환성 문제 없음.
- 이미지 첨부 메시지는 이미 `buildMessages`의 별도 분기에서 처리되므로 이 수정의 영향을 받지 않는다.
