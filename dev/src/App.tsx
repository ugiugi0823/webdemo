import { useRef, useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatMessage } from './components/ChatMessage'
import { ChatInput } from './components/ChatInput'
import { WelcomeScreen } from './components/WelcomeScreen'
import { useChat } from './hooks/useChat'
import type { TaskExample } from './types'

export default function App() {
  const {
    messages,
    params,
    setParams,
    isStreaming,
    activeTask,
    setActiveTask,
    sendMessage,
    stopStreaming,
    clearChat,
  } = useChat()

  const bottomRef = useRef<HTMLDivElement>(null)
  const [pendingPrompt, setPendingPrompt] = useState<string | undefined>(undefined)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSelectTask = (task: TaskExample) => {
    setActiveTask(task)
    if (task.prompt) {
      setPendingPrompt(task.prompt)
    }
  }

  const handleNewChat = () => {
    clearChat()
    setActiveTask(null)
    setPendingPrompt(undefined)
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#0d0f16' }}>
      <Sidebar
        params={params}
        setParams={setParams}
        activeTask={activeTask}
        setActiveTask={(task) => {
          setActiveTask(task)
          if (task?.prompt) setPendingPrompt(task.prompt)
          else setPendingPrompt(undefined)
        }}
        onNewChat={handleNewChat}
      />

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{
            borderBottom: '1px solid #1e2235',
            background: 'rgba(13, 15, 22, 0.8)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex items-center gap-2">
            {activeTask ? (
              <>
                <span className="text-sm font-medium" style={{ color: '#e8eaf0' }}>
                  {activeTask.label}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(124, 107, 255, 0.15)', color: '#a78bfa' }}
                >
                  활성
                </span>
              </>
            ) : (
              <span className="text-sm" style={{ color: '#555b72' }}>
                LLM42 Demo
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs" style={{ color: '#555b72' }}>
            {params.thinking && (
              <span
                className="px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(124, 107, 255, 0.1)', color: '#7c6bff' }}
              >
                Thinking ON
              </span>
            )}
            <span>Temp {params.temperature.toFixed(1)}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <WelcomeScreen onSelectTask={handleSelectTask} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div
          className="shrink-0"
          style={{
            background: 'rgba(13, 15, 22, 0.9)',
            backdropFilter: 'blur(8px)',
            borderTop: '1px solid #1e2235',
          }}
        >
          <div className="max-w-3xl mx-auto">
            <ChatInput
              onSend={sendMessage}
              onStop={stopStreaming}
              isStreaming={isStreaming}
              placeholder={
                activeTask?.prompt
                  ? `${activeTask.label} 모드 — 메세지를 입력하세요.`
                  : '메세지를 입력하세요. (Shift+Enter: 줄바꿈)'
              }
              initialValue={pendingPrompt}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
