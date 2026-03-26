import type { TaskExample } from '../types'
import { TASK_EXAMPLES } from '../types'
import { ChatInput } from './ChatInput'
import { useTheme } from '../context/ThemeContext'

interface AttachedImage {
  base64: string
  mimeType: string
  name: string
  preview: string
}

interface AttachedDocument {
  name: string
  type: string
  text: string
}

interface Props {
  onSelectTask: (task: TaskExample) => void
  onSend: (text: string, image?: AttachedImage, document?: AttachedDocument) => void
  onStop: () => void
  isStreaming: boolean
  pendingPrompt?: string
  pendingImage?: AttachedImage | null
  activeTask: TaskExample | null
  thinking?: boolean
  onThinkingChange?: (v: boolean) => void
}

const PILL_COLORS = [
  { bg: 'rgba(14, 165, 233, 0.08)', border: 'rgba(14, 165, 233, 0.2)', hover: 'rgba(14, 165, 233, 0.15)', text: '#0284c7' },
  { bg: 'rgba(56, 189, 248, 0.08)', border: 'rgba(56, 189, 248, 0.2)', hover: 'rgba(56, 189, 248, 0.15)', text: '#0ea5e9' },
  { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)', hover: 'rgba(59, 130, 246, 0.15)', text: '#2563eb' },
  { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.2)', hover: 'rgba(16, 185, 129, 0.15)', text: '#059669' },
  { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)', hover: 'rgba(245, 158, 11, 0.15)', text: '#d97706' },
]

export function WelcomeScreen({ onSelectTask, onSend, onStop, isStreaming, pendingPrompt, pendingImage, activeTask, thinking, onThinkingChange }: Props) {
  const { dark } = useTheme()
  const textPrimary = dark ? '#e2e8f0' : '#1a1d2e'
  const textSecondary = dark ? '#94a3b8' : '#64748b'

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-4 relative"
      style={{ minHeight: 0, height: '100%', overflow: 'hidden' }}
    >
      <span
        className="absolute top-4 left-4 text-xl font-semibold"
        style={{ color: textPrimary }}
      >
        42Maru
      </span>

      <div className="w-full max-w-2xl flex flex-col items-start gap-6 py-8">

        {/* Greeting + Input + Pills: grouped close together */}
        <div className="w-full flex flex-col gap-2 chat-input-enter">

          {/* Greeting */}
          <div className="flex flex-col gap-1 greeting-enter px-4">
            <div className="flex items-center gap-2">
              <img
                src="/favicon.png"
                alt="LLM42"
                className="w-6 h-6 rounded-lg object-cover shrink-0 logo-spin-enter"
                style={{ boxShadow: '0 2px 8px rgba(14,165,233,0.2)' }}
              />
              <p className="text-sm font-medium" style={{ color: textSecondary }}>LLM42에 오신 것을 환영합니다</p>
            </div>
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{ color: textPrimary, letterSpacing: '-0.02em' }}
            >
              무엇을 도와드릴까요?
            </h1>
          </div>

          {/* Input */}
          <ChatInput
            onSend={onSend}
            onStop={onStop}
            isStreaming={isStreaming}
            placeholder="LLM42에게 물어보세요..."
            initialValue={pendingPrompt}
            pendingImage={pendingImage}
            thinking={thinking}
            onThinkingChange={onThinkingChange}
          />

          {/* Quick action pills */}
          <div className="w-full flex flex-wrap justify-center gap-2 px-4">
            {TASK_EXAMPLES.map((task, i) => {
              const c = PILL_COLORS[i % PILL_COLORS.length]
              const isActive = activeTask?.id === task.id
              return (
                <button
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: isActive ? c.hover : c.bg,
                    border: `1px solid ${c.border}`,
                    color: c.text,
                    boxShadow: isActive ? `0 0 0 2px ${c.border}` : 'none',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.background = c.hover
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.background = c.bg
                  }}
                >
                  {task.label}
                </button>
              )
            })}
          </div>

        </div>

      </div>
    </div>
  )
}
