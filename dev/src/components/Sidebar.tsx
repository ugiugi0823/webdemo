import { useState } from 'react'
import {
  MessageCircle,
  HelpCircle,
  Tag,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Thermometer,
  Brain,
  Shuffle,
} from 'lucide-react'
import type { ChatParams, TaskExample } from '../types'
import { TASK_EXAMPLES } from '../types'

const ICONS: Record<string, React.ReactNode> = {
  MessageCircle: <MessageCircle size={16} />,
  HelpCircle: <HelpCircle size={16} />,
  Tag: <Tag size={16} />,
  FileText: <FileText size={16} />,
  Search: <Search size={16} />,
}

interface SidebarProps {
  params: ChatParams
  setParams: (p: ChatParams) => void
  activeTask: TaskExample | null
  setActiveTask: (t: TaskExample | null) => void
  onNewChat: () => void
}

export function Sidebar({ params, setParams, activeTask, setActiveTask, onNewChat }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className="flex flex-col shrink-0 transition-all duration-300 relative"
      style={{
        width: collapsed ? '56px' : '260px',
        background: '#111420',
        borderRight: '1px solid #1e2235',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: '#1e2235' }}>
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg, #7c6bff, #a855f7)' }}
            >
              42
            </div>
            <span className="font-semibold text-sm truncate" style={{ color: '#e8eaf0' }}>
              LLM42 Demo
            </span>
          </div>
        )}
        {collapsed && (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold mx-auto"
            style={{ background: 'linear-gradient(135deg, #7c6bff, #a855f7)' }}
          >
            42
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors"
          style={{ color: '#555b72' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#e8eaf0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555b72')}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* New Chat */}
      <div className="px-3 py-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: '#1e2235', color: '#8b90a8' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#252a3d'
            e.currentTarget.style.color = '#e8eaf0'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#1e2235'
            e.currentTarget.style.color = '#8b90a8'
          }}
          title="New Chat"
        >
          <Plus size={16} className="shrink-0" />
          {!collapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* Task Examples */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <p className="text-xs font-medium px-1 mb-2" style={{ color: '#555b72' }}>
            Task Examples
          </p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        {TASK_EXAMPLES.map((task) => {
          const isActive = activeTask?.id === task.id
          return (
            <button
              key={task.id}
              onClick={() => setActiveTask(isActive ? null : task)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all text-left"
              style={{
                background: isActive ? 'rgba(124, 107, 255, 0.15)' : 'transparent',
                color: isActive ? '#a78bfa' : '#8b90a8',
                border: isActive ? '1px solid rgba(124, 107, 255, 0.3)' : '1px solid transparent',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = '#1e2235'
                  e.currentTarget.style.color = '#c4c9e2'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#8b90a8'
                }
              }}
              title={task.label}
            >
              <span className="shrink-0">{ICONS[task.icon]}</span>
              {!collapsed && <span className="truncate">{task.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Parameters */}
      {!collapsed && (
        <div className="px-4 py-4 space-y-4 border-t" style={{ borderColor: '#1e2235' }}>
          {/* Thinking */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm" style={{ color: '#8b90a8' }}>
              <Brain size={14} />
              <span>Thinking</span>
            </div>
            <Toggle
              value={params.thinking}
              onChange={(v) => setParams({ ...params, thinking: v })}
            />
          </div>

          {/* Sampling */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm" style={{ color: '#8b90a8' }}>
              <Shuffle size={14} />
              <span>Sampling</span>
            </div>
            <Toggle
              value={params.sampling}
              onChange={(v) => setParams({ ...params, sampling: v })}
            />
          </div>

          {/* Temperature */}
          {params.sampling && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm" style={{ color: '#8b90a8' }}>
                <div className="flex items-center gap-2">
                  <Thermometer size={14} />
                  <span>Temperature</span>
                </div>
                <span style={{ color: '#c4c9e2', fontVariantNumeric: 'tabular-nums' }}>
                  {params.temperature.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={params.temperature}
                onChange={(e) =>
                  setParams({ ...params, temperature: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  accentColor: '#7c6bff',
                  background: `linear-gradient(to right, #7c6bff ${(params.temperature / 2) * 100}%, #2a2f47 ${(params.temperature / 2) * 100}%)`,
                }}
              />
              <div className="flex justify-between text-xs" style={{ color: '#555b72' }}>
                <span>0</span>
                <span>2</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsed params icons */}
      {collapsed && (
        <div className="px-3 py-4 space-y-3 border-t flex flex-col items-center" style={{ borderColor: '#1e2235' }}>
          <button
            onClick={() => setParams({ ...params, thinking: !params.thinking })}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{
              background: params.thinking ? 'rgba(124, 107, 255, 0.2)' : '#1e2235',
              color: params.thinking ? '#a78bfa' : '#555b72',
            }}
            title={`Thinking: ${params.thinking ? 'ON' : 'OFF'}`}
          >
            <Brain size={15} />
          </button>
        </div>
      )}
    </aside>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
      style={{ background: value ? '#7c6bff' : '#2a2f47' }}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
        style={{ transform: value ? 'translateX(20px)' : 'translateX(2px)' }}
      />
    </button>
  )
}
