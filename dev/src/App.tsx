import { useRef, useEffect, useState, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatMessage } from './components/ChatMessage'
import { ChatInput } from './components/ChatInput'
import { WelcomeScreen } from './components/WelcomeScreen'
import { useChat } from './hooks/useChat'
import { useTheme } from './context/ThemeContext'
import type { TaskExample } from './types'

interface AttachedImage {
  base64: string
  mimeType: string
  name: string
  preview: string
}

export default function App() {
  const { dark } = useTheme()
  const {
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
  } = useChat()

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)
  const isAutoScrolling = useRef(false)
  const logBottomRef = useRef<HTMLDivElement>(null)
  const [pendingPrompt, setPendingPrompt] = useState<string | undefined>(undefined)
  const [pendingImage, setPendingImage] = useState<AttachedImage | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [logCopied, setLogCopied] = useState(false)

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    if (!userScrolledUp.current) {
      isAutoScrolling.current = true
      el.scrollTop = el.scrollHeight
      setTimeout(() => { isAutoScrolling.current = false }, 50)
    }
  }, [messages])

  const handleMessagesScroll = useCallback(() => {
    if (isAutoScrolling.current) return
    userScrolledUp.current = true
  }, [])

  useEffect(() => {
    if (logOpen) logBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [apiLogs, logOpen])

  const logTypeColor = useCallback((type: string) => {
    if (type === 'request') return '#38bdf8'
    if (type === 'response') return '#4ade80'
    if (type === 'error') return '#f87171'
    if (type === 'done') return '#a78bfa'
    return '#94a3b8'
  }, [])

  const handleSelectTask = (task: TaskExample) => {
    if (task.prompt) setPendingPrompt(task.prompt)

    if (task.imageUrl) {
      fetch(task.imageUrl)
        .then(r => r.blob())
        .then(blob => new Promise<AttachedImage>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            const result = e.target?.result as string
            resolve({
              base64: result.split(',')[1],
              mimeType: blob.type || 'image/jpeg',
              name: task.imageUrl!.split('/').pop() ?? 'image.jpg',
              preview: result,
            })
          }
          reader.onerror = reject
          reader.readAsDataURL(blob)
        }))
        .then(img => setPendingImage(img))
        .catch(() => {})
    } else {
      setPendingImage(null)
    }

    setActiveTask(null)
  }

  const handleNewChat = () => {
    clearChat()
    setActiveTask(null)
    setPendingPrompt(undefined)
    setPendingImage(null)
  }

  const isEmpty = messages.length === 0

  // Dark mode colors
  const mainBg = dark
    ? (isEmpty ? '#1a1d2e' : '#141720')
    : (isEmpty ? '#f0f4f9' : '#ffffff')
  const topBarBg = dark ? 'rgba(20,23,32,0.92)' : 'rgba(255,255,255,0.9)'
  const bottomBarBg = dark ? 'rgba(20,23,32,0.96)' : 'rgba(255,255,255,0.95)'
  const textPrimary = dark ? '#e2e8f0' : '#1a1d2e'

  return (
    <div className={`flex h-full overflow-hidden${dark ? ' dark-mode' : ''}`} style={{ background: mainBg }}>
      <Sidebar
        isEmpty={isEmpty}
        params={params}
        setParams={setParams}
        onNewChat={handleNewChat}
        conversations={conversations}
        currentConvId={currentConvId}
        onLoadConversation={(conv) => {
          loadConversation(conv)
          setPendingPrompt(undefined)
          setPendingImage(null)
          setActiveTask(null)
        }}
        onDeleteConversation={deleteConversation}
      />

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ height: '100%', position: 'relative' }}>
        {/* Top bar — only when chatting */}
        {!isEmpty && (
          <div
            className="flex items-center justify-between px-4 py-4 shrink-0"
            style={{ background: topBarBg, backdropFilter: 'blur(8px)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold" style={{ color: textPrimary }}>
                42Maru
              </span>
            </div>
          </div>
        )}

        {/* Welcome screen */}
        {isEmpty ? (
          <WelcomeScreen
            onSelectTask={handleSelectTask}
            onSend={(text, image, doc) => {
              userScrolledUp.current = false
              sendMessage(text, image, doc)
              setPendingPrompt(undefined)
              setPendingImage(null)
            }}
            onStop={stopStreaming}
            isStreaming={isStreaming}
            pendingPrompt={pendingPrompt}
            pendingImage={pendingImage}
            activeTask={activeTask}
            thinking={params.thinking}
            onThinkingChange={(v) => setParams({ ...params, thinking: v })}
          />
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto" ref={scrollContainerRef} onScroll={handleMessagesScroll}>
              <div className="max-w-3xl mx-auto px-4 py-6">
                {(() => {
                  const lastUserIdx = messages.reduce((last, m, i) => m.role === 'user' ? i : last, -1)
                  return messages.map((msg, i) => (
                    <ChatMessage key={msg.id} message={msg} onResend={resendFrom} isLastUser={i === lastUserIdx && !isStreaming} />
                  ))
                })()}
              </div>
            </div>

            {/* Input at bottom */}
            <div
              className="shrink-0"
              style={{ background: bottomBarBg, backdropFilter: 'blur(8px)' }}
            >
              <div className="max-w-3xl mx-auto">
                <ChatInput
                  onSend={(text, image, doc) => {
                    userScrolledUp.current = false
                    sendMessage(text, image, doc)
                    setPendingPrompt(undefined)
                    setPendingImage(null)
                  }}
                  onStop={stopStreaming}
                  isStreaming={isStreaming}
                  placeholder="메세지를 입력하세요. (Shift+Enter: 줄바꿈)"
                  initialValue={pendingPrompt}
                  thinking={params.thinking}
                  onThinkingChange={(v) => setParams({ ...params, thinking: v })}
                />
              </div>
            </div>
          </>
        )}
        {/* API Log Panel — production only */}
        {import.meta.env.DEV && <div
          className="shrink-0"
          style={{
            background: dark ? '#0d1117' : '#1e2130',
            borderTop: `1px solid ${dark ? '#21262d' : '#263044'}`,
            maxHeight: logOpen ? '320px' : '32px',
            transition: 'max-height 0.2s ease',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 shrink-0"
            style={{ height: '32px', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setLogOpen(v => !v)}
          >
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '11px', color: '#4ade80', fontFamily: 'monospace' }}>●</span>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                API LOG
              </span>
              {apiLogs.length > 0 && (
                <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                  ({apiLogs.length})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {logOpen && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const text = apiLogs.map(l =>
                        `[${l.type.toUpperCase()}] ${l.time.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}\n${l.data}`
                      ).join('\n\n---\n\n')
                      try {
                        const ta = document.createElement('textarea')
                        ta.value = text
                        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
                        document.body.appendChild(ta)
                        ta.focus()
                        ta.select()
                        document.execCommand('copy')
                        document.body.removeChild(ta)
                        setLogCopied(true)
                        setTimeout(() => setLogCopied(false), 2000)
                      } catch { /* ignore */ }
                    }}
                    style={{ fontSize: '10px', color: logCopied ? '#4ade80' : '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace' }}
                    onMouseEnter={e => { if (!logCopied) e.currentTarget.style.color = '#94a3b8' }}
                    onMouseLeave={e => { if (!logCopied) e.currentTarget.style.color = '#64748b' }}
                  >
                    {logCopied ? 'copied!' : 'copy'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); clearApiLogs() }}
                    style={{ fontSize: '10px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#64748b' }}
                  >
                    clear
                  </button>
                </>
              )}
              <span style={{ fontSize: '10px', color: '#4a5568', fontFamily: 'monospace' }}>
                {logOpen ? '▼' : '▲'}
              </span>
            </div>
          </div>

          {/* Log content */}
          {logOpen && (
            <div className="flex-1 overflow-y-auto overflow-x-auto" style={{ height: '288px' }} onClick={e => e.stopPropagation()}>
              {apiLogs.length === 0 ? (
                <p style={{ fontSize: '11px', color: '#4a5568', padding: '8px 12px', fontFamily: 'monospace' }}>로그 없음</p>
              ) : (
                apiLogs.map((entry) => (
                  <div key={entry.id} style={{ borderBottom: '1px solid #21262d', padding: '6px 12px' }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: '3px' }}>
                      <span style={{ fontSize: '10px', color: logTypeColor(entry.type), fontFamily: 'monospace', textTransform: 'uppercase', flexShrink: 0 }}>
                        {entry.type}
                      </span>
                      <span style={{ fontSize: '10px', color: '#4a5568', fontFamily: 'monospace' }}>
                        {entry.time.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <pre style={{ fontSize: '11px', color: logTypeColor(entry.type), fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                      {entry.data}
                    </pre>
                  </div>
                ))
              )}
              <div ref={logBottomRef} />
            </div>
          )}
        </div>}
      </main>
    </div>
  )
}
