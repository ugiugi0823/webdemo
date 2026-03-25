import { useState, useRef, useCallback, useEffect } from 'react'
import { streamChat } from '../api/chat'
import type { Message, ChatParams, TaskExample, Conversation, AttachedDocument } from '../types'

const DEFAULT_PARAMS: ChatParams = {
  thinking: true,
  temperature: 1.0,
  sampling: true,
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
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

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [params, setParams] = useState<ChatParams>(DEFAULT_PARAMS)
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTask, setActiveTask] = useState<TaskExample | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations)
  const abortRef = useRef<AbortController | null>(null)
  const currentConvId = useRef<string | null>(null)

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
        next = [updated, ...prev].slice(0, 30)
      }
      persistConversations(next)
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

      const userMsg: Message = {
        id: uid(),
        role: 'user',
        content: text.trim(),
        image,
        document,
        timestamp: new Date(),
      }

      const assistantId = uid()
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        thinking: undefined,
        timestamp: new Date(),
        streaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsStreaming(true)

      abortRef.current = new AbortController()

      try {
        const history = [...messages, userMsg]
        let thinkBuf = ''
        let contentBuf = ''

        for await (const chunk of streamChat(
          history,
          params,
          activeTask?.systemPrompt,
          abortRef.current.signal
        )) {
          if (chunk.done) break

          if (chunk.thinking) {
            thinkBuf += chunk.thinking
          }
          if (chunk.token) {
            contentBuf += chunk.token
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: contentBuf, thinking: thinkBuf || undefined }
                : m
            )
          )
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, streaming: false } : m
          )
        )
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, streaming: false } : m
            )
          )
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
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
  }, [])

  const loadConversation = useCallback((conv: Conversation) => {
    abortRef.current?.abort()
    setMessages(conv.messages)
    setParams(conv.params)
    setIsStreaming(false)
    setActiveTask(null)
    currentConvId.current = conv.id
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

  return {
    messages,
    params,
    setParams,
    isStreaming,
    activeTask,
    setActiveTask,
    sendMessage,
    stopStreaming,
    clearChat,
    conversations,
    currentConvId,
    loadConversation,
    deleteConversation,
  }
}
