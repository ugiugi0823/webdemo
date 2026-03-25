import type { TaskExample } from '../types'
import { TASK_EXAMPLES } from '../types'
import { ChatInput } from './ChatInput'

interface AttachedImage {
  base64: string
  mimeType: string
  name: string
  preview: string
}

interface Props {
  onSelectTask: (task: TaskExample) => void
  onSend: (text: string, image?: AttachedImage) => void
  onStop: () => void
  isStreaming: boolean
  pendingPrompt?: string
  activeTask: TaskExample | null
}

const PILL_COLORS = [
  { bg: 'rgba(124, 107, 255, 0.08)', border: 'rgba(124, 107, 255, 0.2)', hover: 'rgba(124, 107, 255, 0.15)', text: '#6d51f5' },
  { bg: 'rgba(168, 85, 247, 0.08)', border: 'rgba(168, 85, 247, 0.2)', hover: 'rgba(168, 85, 247, 0.15)', text: '#9333ea' },
  { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)', hover: 'rgba(59, 130, 246, 0.15)', text: '#2563eb' },
  { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.2)', hover: 'rgba(16, 185, 129, 0.15)', text: '#059669' },
  { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)', hover: 'rgba(245, 158, 11, 0.15)', text: '#d97706' },
]

export function WelcomeScreen({ onSelectTask, onSend, onStop, isStreaming, pendingPrompt, activeTask }: Props) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto"
      style={{ minHeight: 0 }}
    >
      <div className="w-full max-w-2xl flex flex-col items-start gap-6 py-8">

        {/* Greeting — horizontal, left-aligned, inset to match input box */}
        <div className="flex items-center gap-3 greeting-enter w-full px-4">
          <img src="/favicon.png" alt="LLM42" className="w-8 h-8 rounded-xl object-cover shrink-0 logo-spin-enter" style={{ boxShadow: '0 4px 16px rgba(124,107,255,0.2)' }} />
          <div>
            <p className="text-xs" style={{ color: '#94a3b8' }}>LLM42에 오신 것을 환영합니다</p>
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{ color: '#1a1d2e', letterSpacing: '-0.02em' }}
            >
              무엇을 도와드릴까요?
            </h1>
          </div>
        </div>

        {/* Input — centered */}
        <div className="w-full chat-input-enter">
          <ChatInput
            onSend={onSend}
            onStop={onStop}
            isStreaming={isStreaming}
            placeholder="LLM42에게 물어보세요..."
            initialValue={pendingPrompt}
          />
        </div>

        {/* Quick action pills */}
        <div className="flex flex-wrap justify-start gap-2 px-4">
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
  )
}
