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
    conversations,
    currentConvId,
    loadConversation,
    deleteConversation,
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
    <div className="flex h-full overflow-hidden" style={{ background: '#f0f4f9' }}>
      <Sidebar
        params={params}
        setParams={setParams}
        onNewChat={handleNewChat}
        conversations={conversations}
        currentConvId={currentConvId}
        onLoadConversation={(conv) => {
          loadConversation(conv)
          setPendingPrompt(undefined)
          setActiveTask(null)
        }}
        onDeleteConversation={deleteConversation}
      />

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar — only when chatting */}
        {!isEmpty && (
          <div
            className="flex items-center justify-between px-6 py-3 shrink-0"
            style={{
              borderBottom: '1px solid #e2e8f0',
              background: 'rgba(240, 244, 249, 0.9)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div className="flex items-center gap-2">
              {activeTask ? (
                <>
                  <span className="text-sm font-medium" style={{ color: '#1a1d2e' }}>
                    {activeTask.label}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(124, 107, 255, 0.12)', color: '#7c6bff' }}
                  >
                    활성
                  </span>
                </>
              ) : (
                <span className="text-sm font-medium" style={{ color: '#64748b' }}>
                  42Maru
                </span>
              )}
            </div>


          </div>
        )}

        {/* Welcome screen — input centered */}
        {isEmpty ? (
          <WelcomeScreen
            onSelectTask={handleSelectTask}
            onSend={sendMessage}
            onStop={stopStreaming}
            isStreaming={isStreaming}
            pendingPrompt={pendingPrompt}
            activeTask={activeTask}
          />
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-4 py-6">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Input at bottom */}
            <div
              className="shrink-0"
              style={{
                background: 'rgba(240, 244, 249, 0.95)',
                backdropFilter: 'blur(8px)',
                borderTop: '1px solid #e2e8f0',
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
          </>
        )}
      </main>
    </div>
  )
}
