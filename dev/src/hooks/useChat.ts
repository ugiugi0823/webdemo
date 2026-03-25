import { useState, useRef, useCallback } from 'react'
import { streamChat } from '../api/chat'
import type { Message, ChatParams, TaskExample } from '../types'

const DEFAULT_PARAMS: ChatParams = {
  thinking: true,
  temperature: 1.0,
  sampling: true,
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [params, setParams] = useState<ChatParams>(DEFAULT_PARAMS)
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTask, setActiveTask] = useState<TaskExample | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (
      text: string,
      image?: { base64: string; mimeType: string; name: string }
    ) => {
      if (isStreaming || !text.trim()) return

      const userMsg: Message = {
        id: uid(),
        role: 'user',
        content: text.trim(),
        image,
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
                ? {
                    ...m,
                    content: contentBuf,
                    thinking: thinkBuf || undefined,
                  }
                : m
            )
          )
        }

        // Finalize
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
  }
}
