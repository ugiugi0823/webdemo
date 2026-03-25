import { MessageCircle, HelpCircle, Tag, FileText, Search, Sparkles } from 'lucide-react'
import type { TaskExample } from '../types'
import { TASK_EXAMPLES } from '../types'

const ICONS: Record<string, React.ReactNode> = {
  MessageCircle: <MessageCircle size={20} />,
  HelpCircle: <HelpCircle size={20} />,
  Tag: <Tag size={20} />,
  FileText: <FileText size={20} />,
  Search: <Search size={20} />,
}

const CARD_COLORS = [
  { bg: 'rgba(124, 107, 255, 0.12)', border: 'rgba(124, 107, 255, 0.25)', icon: '#7c6bff' },
  { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.25)', icon: '#a855f7' },
  { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.25)', icon: '#3b82f6' },
  { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)', icon: '#10b981' },
  { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)', icon: '#f59e0b' },
]

interface Props {
  onSelectTask: (task: TaskExample) => void
}

export function WelcomeScreen({ onSelectTask }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg"
          style={{ background: 'linear-gradient(135deg, #7c6bff, #a855f7)' }}
        >
          42
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-1" style={{ color: '#e8eaf0' }}>
            LLM42 Demo
          </h1>
          <p className="text-sm flex items-center gap-1.5" style={{ color: '#555b72' }}>
            <Sparkles size={13} />
            42MARU의 한국어 특화 언어모델
          </p>
        </div>
      </div>

      {/* Quick start cards */}
      <div className="w-full max-w-xl">
        <p className="text-xs font-medium mb-3 text-center" style={{ color: '#555b72' }}>
          태스크를 선택하거나 자유롭게 대화를 시작하세요
        </p>
        <div className="grid grid-cols-1 gap-2">
          {TASK_EXAMPLES.map((task, i) => {
            const color = CARD_COLORS[i % CARD_COLORS.length]
            return (
              <button
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                style={{
                  background: color.bg,
                  border: `1px solid ${color.border}`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = `0 4px 20px ${color.border}`
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <span style={{ color: color.icon }}>{ICONS[task.icon]}</span>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#c4c9e2' }}>
                    {task.label}
                  </p>
                  {task.prompt && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#555b72' }}>
                      {task.prompt.slice(0, 50)}...
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <p className="mt-8 text-xs" style={{ color: '#2a2f47' }}>
        이미지를 드래그하거나 📎 버튼으로 이미지 추론을 시작할 수 있습니다
      </p>
    </div>
  )
}
