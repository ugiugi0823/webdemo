import type { Message, ChatParams } from '../types'

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
    } else {
      msgs.push({ role: msg.role, content: msg.content })
    }
  }

  return msgs
}

export async function* streamChat(
  history: Message[],
  params: ChatParams,
  systemPrompt?: string,
  signal?: AbortSignal
): AsyncGenerator<{ token?: string; thinking?: string; done?: boolean }> {
  const hasImage = history.some((m) => m.role === 'user' && m.image)
  const hasDoc = history.some((m) => m.role === 'user' && m.document)
  const maxTokens = hasImage ? 4096 : hasDoc ? MAX_OUTPUT_TOKENS_DOC : MAX_OUTPUT_TOKENS

  let docMaxChars = MAX_DOC_CHARS_INITIAL
  let res: Response

  // Retry loop: halve document size on each context-length 400 error
  while (true) {
    const messages = buildMessages(history, systemPrompt, docMaxChars)
    const body: Record<string, unknown> = {
      model: 'LLM42',
      messages,
      stream: true,
      max_tokens: maxTokens,
      chat_template_kwargs: { thinking: hasImage ? false : params.thinking },
    }
    if (params.sampling && !hasImage && !hasDoc) {
      body.temperature = params.temperature
    }

    res = await fetch(VLLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(body),
      signal,
    })

    if (res.ok) break

    if (res.status === 400) {
      const errText = await res.text()
      if ((errText.includes('maximum context length') || errText.includes('context window') || errText.includes('sequence length') || errText.includes('too long') || errText.includes('max_tokens')) && docMaxChars > MIN_DOC_CHARS) {
        docMaxChars = Math.floor(docMaxChars / 2)
        continue  // retry with half the document
      }
      throw new Error(`API error ${res.status}: ${errText}`)
    }

    const err = await res.text()
    throw new Error(`API error ${res.status}: ${err}`)
  }

  const reader = res!.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

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
        yield { done: true }
        return
      }
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta
        if (!delta) continue

        if (delta.reasoning_content) {
          yield { thinking: delta.reasoning_content }
        } else if (delta.content) {
          yield { token: delta.content }
        }
      } catch {
        // skip malformed
      }
    }
  }

  yield { done: true }
}
