import type { Message, ChatParams, ApiLogEntry } from '../types'

const VLLM_URL = '/api/vllm/v1/chat/completions'
const API_KEY = '3f985cda689134ea45509ec236d7c10df30c8a858a36a791da95674490d4c032'

const MAX_OUTPUT_TOKENS = 2048
const MAX_OUTPUT_TOKENS_DOC = 2048
// Starting doc char cap — halved on each context-length 400 retry
const MAX_DOC_CHARS_INITIAL = 20_000
const MIN_DOC_CHARS = 500

function buildMessages(history: Message[], systemPrompt?: string, docMaxChars = MAX_DOC_CHARS_INITIAL) {
  const msgs: { role: string; content: string | object[] }[] = []

  if (systemPrompt) {
    msgs.push({ role: 'system', content: systemPrompt })
  }

  for (const msg of history) {
    if (msg.role === 'user' && msg.image) {
      const mimeType = msg.image.mimeType
      const base64 = msg.image.base64
      const fileName = msg.image.name

      // text (placeholder) MUST come before image_url — vLLM multimodal rule
      msgs.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: `<|mime_start|>{"id": "image_00", "type": "${mimeType}", "filename": "${fileName}"}<|mime_end|><|image_start|><|IMAGE_PAD|><|image_end|>\n${msg.content}`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      })
    } else if (msg.role === 'user' && msg.document) {
      const raw = msg.document.text
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // strip control chars
      const truncated = raw.length > docMaxChars
        ? raw.slice(0, docMaxChars) +
          `\n\n[... 문서가 너무 길어 ${(raw.length - docMaxChars).toLocaleString()}자 생략됨 ...]`
        : raw
      msgs.push({ role: 'user', content: `[첨부 문서: ${msg.document.name}]\n\n${truncated}\n\n---\n${msg.content}` })
    } else if (msg.role === 'assistant') {
      // Strip <think>...</think> blocks — vLLM sometimes embeds thinking inline in content.
      // Sending these tags back in history with thinking=false confuses the model.
      const clean = msg.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      msgs.push({ role: 'assistant', content: clean })
    } else {
      msgs.push({ role: msg.role, content: msg.content })
    }
  }

  return msgs
}

function logId() { return Math.random().toString(36).slice(2, 8) }

export async function* streamChat(
  history: Message[],
  params: ChatParams,
  systemPrompt?: string,
  signal?: AbortSignal,
  onLog?: (entry: ApiLogEntry) => void
): AsyncGenerator<{ token?: string; thinking?: string; done?: boolean }> {
  const hasImage = history.some((m) => m.role === 'user' && m.image)
  const hasDoc = history.some((m) => m.role === 'user' && m.document)
  const maxTokens = hasImage ? 4096 : hasDoc ? MAX_OUTPUT_TOKENS_DOC : MAX_OUTPUT_TOKENS

  let docMaxChars = MAX_DOC_CHARS_INITIAL
  let res: Response

  const FETCH_TIMEOUT_MS = 30_000

  // Retry loop: halve document size on each context-length 400 error
  while (true) {
    const messages = buildMessages(history, systemPrompt, docMaxChars)
    const body: Record<string, unknown> = {
      model: 'LLM42',
      messages,
      stream: true,
      max_tokens: maxTokens,
      chat_template_kwargs: { thinking: params.thinking },
    }
    if (!hasImage && !hasDoc) {
      body.temperature = params.sampling ? params.temperature : 0
    }

    // Build a loggable summary of the request (omit large base64 image data)
    const logBody = {
      ...body,
      messages: (body.messages as {role: string; content: unknown}[]).map((m) => ({
        role: m.role,
        content: typeof m.content === 'string'
          ? (m.content.length > 300 ? m.content.slice(0, 300) + `… [+${m.content.length - 300}자]` : m.content)
          : Array.isArray(m.content)
            ? (m.content as {type: string; text?: string}[]).map((c) =>
                c.type === 'image_url' ? { type: 'image_url', image_url: '[base64 생략]' } : c
              )
            : m.content,
      })),
    }
    onLog?.({ id: logId(), time: new Date(), type: 'request', data: JSON.stringify(logBody, null, 2) })

    const timeoutId = setTimeout(() => {
      onLog?.({ id: logId(), time: new Date(), type: 'error', data: `요청 타임아웃 (${FETCH_TIMEOUT_MS / 1000}초)` })
    }, FETCH_TIMEOUT_MS)
    const fetchSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)])
      : AbortSignal.timeout(FETCH_TIMEOUT_MS)
    try {
      res = await fetch(VLLM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify(body),
        signal: fetchSignal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (res.ok) {
      onLog?.({ id: logId(), time: new Date(), type: 'response', data: `HTTP ${res.status} ${res.statusText}` })
      break
    }

    if (res.status === 400) {
      const errText = await res.text()
      if ((errText.includes('maximum context length') || errText.includes('context window') || errText.includes('sequence length') || errText.includes('too long') || errText.includes('max_tokens')) && docMaxChars > MIN_DOC_CHARS) {
        onLog?.({ id: logId(), time: new Date(), type: 'error', data: `HTTP 400 — context too long, retrying (docMaxChars: ${docMaxChars} → ${Math.floor(docMaxChars / 2)})\n${errText}` })
        docMaxChars = Math.floor(docMaxChars / 2)
        continue  // retry with half the document
      }
      onLog?.({ id: logId(), time: new Date(), type: 'error', data: `HTTP ${res.status}: ${errText}` })
      throw new Error(`API error ${res.status}: ${errText}`)
    }

    const err = await res.text()
    onLog?.({ id: logId(), time: new Date(), type: 'error', data: `HTTP ${res.status}: ${err}` })
    throw new Error(`API error ${res.status}: ${err}`)
  }

  const reader = res!.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  let thinkingBuf = ''
  let contentBuf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') {
        const logParts: string[] = []
        if (thinkingBuf) logParts.push(`[thinking]\n${thinkingBuf}`)
        if (contentBuf) logParts.push(`[content]\n${contentBuf}`)
        onLog?.({ id: logId(), time: new Date(), type: 'done', data: logParts.join('\n\n') || 'Stream finished [DONE]' })
        yield { done: true }
        return
      }
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta
        if (!delta) continue

        const thinkingChunk = delta.reasoning_content ?? delta.reasoning
        if (thinkingChunk) {
          yield { thinking: thinkingChunk }
        }
        if (delta.content) {
          contentBuf += delta.content
          yield { token: delta.content }
        }
      } catch {
        // skip malformed
      }
    }
  }

  yield { done: true }
}
