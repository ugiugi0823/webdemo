import { useState, useRef, useCallback, useEffect } from 'react'
import { streamChat } from '../api/chat'
import type { Message, ChatParams, TaskExample, Conversation, AttachedDocument, ApiLogEntry } from '../types'

const DEFAULT_PARAMS: ChatParams = {
  thinking: true,
  temperature: 1.0,
  sampling: false,
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// Frontend memory management: trim oldest messages when context is too large
const MAX_CONTEXT_CHARS = 80_000

function filterEmptyTurns(history: Message[]): Message[] {
  const result: Message[] = []
  for (let i = 0; i < history.length; i++) {
    const m = history[i]
    // Skip (user, empty-assistant) pairs entirely
    if (m.role === 'user' && i + 1 < history.length) {
      const next = history[i + 1]
      if (next.role === 'assistant' && !next.content && !next.thinking) {
        i++ // skip both
        continue
      }
    }
    // Skip standalone empty assistant messages
    if (m.role === 'assistant' && !m.content && !m.thinking) continue
    result.push(m)
  }
  return result
}

function trimHistory(history: Message[]): Message[] {
  const msgChars = (m: Message) =>
    m.content.length + (m.document?.text.length ?? 0)
  let total = history.reduce((s, m) => s + msgChars(m), 0)
  if (total <= MAX_CONTEXT_CHARS) return history
  const trimmed = [...history]
  while (total > MAX_CONTEXT_CHARS && trimmed.length > 2) {
    total -= msgChars(trimmed.shift()!)
  }
  return trimmed
}

function loadConversations(): Conversation[] {
  try {
    const stored = localStorage.getItem('llm42_conversations')
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return parsed.map((c: Conversation & { timestamp: string; messages: (Message & { timestamp: string })[] }) => ({
      ...c,
      timestamp: new Date(c.timestamp),
      messages: c.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
    }))
  } catch {
    return []
  }
}

function persistConversations(convs: Conversation[]) {
  try {
    localStorage.setItem('llm42_conversations', JSON.stringify(convs))
  } catch {
    // storage full
  }
}

function loadLastSession(): { messages: Message[]; convId: string | null; params: ChatParams } {
  try {
    const convId = localStorage.getItem('llm42_current_conv')
    if (!convId) return { messages: [], convId: null, params: DEFAULT_PARAMS }
    const convs = loadConversations()
    const conv = convs.find(c => c.id === convId)
    if (!conv) return { messages: [], convId: null, params: DEFAULT_PARAMS }
    return { messages: conv.messages, convId, params: conv.params }
  } catch {
    return { messages: [], convId: null, params: DEFAULT_PARAMS }
  }
}

export function useChat() {
  const lastSession = loadLastSession()
  const [messages, setMessages] = useState<Message[]>(lastSession.messages)
  const [params, setParams] = useState<ChatParams>(lastSession.params)
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTask, setActiveTask] = useState<TaskExample | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations)
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const currentConvId = useRef<string | null>(lastSession.convId)

  // Save conversation when streaming ends
  useEffect(() => {
    if (isStreaming || messages.length === 0) return

    const firstUser = messages.find((m) => m.role === 'user')
    const raw = firstUser?.content ?? '새 대화'
    const title = raw.slice(0, 45) + (raw.length > 45 ? '...' : '')

    if (!currentConvId.current) {
      currentConvId.current = uid()
    }
    const convId = currentConvId.current

    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === convId)
      const updated: Conversation = {
        id: convId,
        title,
        messages,
        timestamp: new Date(),
        params,
      }
      let next: Conversation[]
      if (idx >= 0) {
        next = [...prev]
        next[idx] = updated
      } else {
        next = [updated, ...prev].slice(0, 15)
      }
      persistConversations(next)
      try { localStorage.setItem('llm42_current_conv', convId) } catch { /* ignore */ }
      return next
    })
  }, [isStreaming]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(
    async (
      text: string,
      image?: { base64: string; mimeType: string; name: string },
      document?: AttachedDocument
    ) => {
      if (isStreaming) return
      if (!text.trim() && !image && !document) return

      const hasImage = !!image
      const effectiveThinking = params.thinking && !hasImage

      const userMsg: Message = {
        id: uid(),
        role: 'user',
        content: text.trim(),
        usedThinking: effectiveThinking,
        image,
        document,
        timestamp: new Date(),
      }

      let currentAssistantId = uid()
      setMessages((prev) => [...prev, userMsg, {
        id: currentAssistantId,
        role: 'assistant' as const,
        content: '',
        thinking: undefined,
        timestamp: new Date(),
        streaming: true,
      }])
      setIsStreaming(true)

      abortRef.current = new AbortController()

      try {
        const history = filterEmptyTurns(trimHistory([...messages, userMsg]))
        const onLog = (entry: ApiLogEntry) =>
          setApiLogs((prev) => [...prev.slice(-199), entry])

        const runStream = async (msgId: string) => {
          let thinkBuf = ''
          let contentBuf = ''
          for await (const chunk of streamChat(
            history,
            params,
            activeTask?.systemPrompt ?? params.systemPrompt,
            abortRef.current!.signal,
            onLog
          )) {
            if (chunk.done) break
            if (chunk.thinking) thinkBuf += chunk.thinking
            if (chunk.token) contentBuf += chunk.token
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId
                  ? { ...m, content: contentBuf, thinking: thinkBuf || undefined }
                  : m
              )
            )
          }
          return { thinkBuf, contentBuf }
        }

        let { thinkBuf, contentBuf } = await runStream(currentAssistantId)

        // content 없으면 1회 재시도
        if (!contentBuf) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === currentAssistantId
                ? { ...m, content: '', thinking: undefined, streaming: true }
                : m
            )
          )
          abortRef.current = new AbortController()
          const retry = await runStream(currentAssistantId)
          thinkBuf = retry.thinkBuf
          contentBuf = retry.contentBuf
        }

        const finalContent = contentBuf || '답변을 반환할 수 없습니다.'
        setMessages((prev) =>
          prev.map((m) =>
            m.id === currentAssistantId
              ? { ...m, content: finalContent, thinking: thinkBuf || undefined, streaming: false }
              : m
          )
        )
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === currentAssistantId ? { ...m, streaming: false } : m
            )
          )
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === currentAssistantId
                ? {
                    ...m,
                    content: `오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`,
                    streaming: false,
                  }
                : m
            )
          )
        }
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [messages, params, isStreaming, activeTask]
  )

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearChat = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setIsStreaming(false)
    currentConvId.current = null
    try { localStorage.removeItem('llm42_current_conv') } catch { /* ignore */ }
  }, [])

  const loadConversation = useCallback((conv: Conversation) => {
    abortRef.current?.abort()
    setMessages(conv.messages)
    setParams(conv.params)
    setIsStreaming(false)
    setActiveTask(null)
    currentConvId.current = conv.id
    try { localStorage.setItem('llm42_current_conv', conv.id) } catch { /* ignore */ }
  }, [])

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id)
      persistConversations(next)
      return next
    })
    if (currentConvId.current === id) {
      setMessages([])
      setIsStreaming(false)
      currentConvId.current = null
    }
  }, [])

  const clearApiLogs = useCallback(() => setApiLogs([]), [])

  const resendFrom = useCallback(
    (messageId: string, newText: string) => {
      if (isStreaming) return
      const idx = messages.findIndex((m) => m.id === messageId)
      if (idx < 0) return
      const original = messages[idx]
      // Trim history up to (not including) this message, then resend
      setMessages(messages.slice(0, idx))
      sendMessage(newText, original.image, original.document)
    },
    [messages, isStreaming, sendMessage]
  )

  return {
    messages,
    params,
    setParams,
    isStreaming,
    activeTask,
    setActiveTask,
    sendMessage,
    resendFrom,
    stopStreaming,
    clearChat,
    conversations,
    currentConvId,
    loadConversation,
    deleteConversation,
    apiLogs,
    clearApiLogs,
  }
}
