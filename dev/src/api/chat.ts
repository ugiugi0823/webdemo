import type { Message, ChatParams } from '../types'

const VLLM_URL = '/api/vllm/v1/chat/completions'
const API_KEY = '3f985cda689134ea45509ec236d7c10df30c8a858a36a791da95674490d4c032'

function buildMessages(history: Message[], systemPrompt?: string) {
  const msgs: { role: string; content: string | object[] }[] = []

  if (systemPrompt) {
    msgs.push({ role: 'system', content: systemPrompt })
  }

  for (const msg of history) {
    if (msg.role === 'user' && msg.image) {
      const mimeType = msg.image.mimeType
      const base64 = msg.image.base64
      const fileName = msg.image.name

      msgs.push({
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
            },
          },
          {
            type: 'text',
            text: `<|mime_start|>{"id": "image_00", "type": "${mimeType}", "filename": "${fileName}"}<|mime_end|><|image_start|><|IMAGE_PAD|><|image_end|>\n${msg.content}`,
          },
        ],
      })
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
  const messages = buildMessages(history, systemPrompt)

  const body: Record<string, unknown> = {
    model: 'LLM42',
    messages,
    stream: true,
    chat_template_kwargs: {
      thinking: params.thinking,
    },
  }

  if (params.sampling) {
    body.temperature = params.temperature
  }

  const res = await fetch(VLLM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API error ${res.status}: ${err}`)
  }

  const reader = res.body!.getReader()
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
