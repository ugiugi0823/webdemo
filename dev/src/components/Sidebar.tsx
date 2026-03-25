import { useState } from 'react'
import {
  Menu,
  SquarePen,
  Thermometer,
  Brain,
  Shuffle,
  Trash2,
  MessageSquare,
} from 'lucide-react'
import type { ChatParams, Conversation } from '../types'

interface SidebarProps {
  isEmpty: boolean
  params: ChatParams
  setParams: (p: ChatParams) => void
  onNewChat: () => void
  conversations: Conversation[]
  currentConvId: React.MutableRefObject<string | null>
  onLoadConversation: (conv: Conversation) => void
  onDeleteConversation: (id: string) => void
}

function formatDate(d: Date): string {
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const day = 1000 * 60 * 60 * 24

  if (diff < day && now.getDate() === d.getDate()) return '오늘'
  if (diff < 2 * day) return '어제'
  if (diff < 7 * day) return '이번 주'
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

function groupConversations(convs: Conversation[]) {
  const groups: { label: string; items: Conversation[] }[] = []
  const seen = new Set<string>()

  for (const conv of convs) {
    const label = formatDate(conv.timestamp)
    if (!seen.has(label)) {
      seen.add(label)
      groups.push({ label, items: [] })
    }
    groups[groups.length - 1].items.push(conv)
  }
  return groups
}

export function Sidebar({
  isEmpty,
  params,
  setParams,
  onNewChat,
  conversations,
  currentConvId,
  onLoadConversation,
  onDeleteConversation,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const groups = groupConversations(conversations)

  return (
    <aside
      className="flex flex-col shrink-0 transition-all duration-300"
      style={{
        width: collapsed ? '56px' : '260px',
        background: isEmpty ? '#ffffff' : '#f0f4f9',
        borderRight: '1px solid #e2e8f0',
      }}
    >
      {/* Hamburger header */}
      <div
        className="flex items-center shrink-0"
        style={{ padding: '10px 12px', gap: '10px' }}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center shrink-0"
          style={{ color: '#64748b', background: 'none', border: 'none', padding: '6px', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#1a1d2e' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#64748b' }}
          title={collapsed ? '메뉴 열기' : '메뉴 닫기'}
        >
          <Menu size={18} />
        </button>

      </div>

      {/* New Chat */}
      <div className="px-3 py-1 shrink-0">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 rounded-lg text-sm font-medium transition-colors"
          style={{ color: '#64748b', padding: collapsed ? '6px' : '6px 10px', background: 'transparent', justifyContent: collapsed ? 'center' : 'flex-start' }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#1a1d2e'
            e.currentTarget.style.background = '#f1f5f9'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#64748b'
            e.currentTarget.style.background = 'transparent'
          }}
          title="새 채팅"
        >
          <SquarePen size={17} className="shrink-0" />
          {!collapsed && <span>새 채팅</span>}
        </button>
      </div>

      {/* Conversation history */}
      <div className="flex-1 overflow-y-auto">
        {collapsed ? (
          null
        ) : (
          /* Expanded: grouped conversation list */
          <div className="px-3 pb-3">
            {groups.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: '#cbd5e1' }}>
                대화 이력이 없습니다
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.label} className="mb-3">
                  <p className="text-xs font-medium px-1 py-1.5" style={{ color: '#94a3b8' }}>
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((conv) => {
                      const isActive = currentConvId.current === conv.id
                      return (
                        <div
                          key={conv.id}
                          className="relative group/item flex items-center rounded-lg transition-colors"
                          style={{
                            background: isActive ? 'rgba(14,165,233,0.08)' : 'transparent',
                          }}
                          onMouseEnter={() => setHoveredId(conv.id)}
                          onMouseLeave={() => setHoveredId(null)}
                        >
                          <button
                            onClick={() => onLoadConversation(conv)}
                            className="flex-1 flex items-center gap-2 px-2 py-2 text-left min-w-0"
                            onMouseEnter={e => {
                              if (!isActive) e.currentTarget.parentElement!.style.background = '#f8fafc'
                            }}
                            onMouseLeave={e => {
                              if (!isActive) e.currentTarget.parentElement!.style.background = 'transparent'
                            }}
                          >
                            <MessageSquare
                              size={13}
                              className="shrink-0"
                              style={{ color: isActive ? '#0ea5e9' : '#94a3b8' }}
                            />
                            <span
                              className="text-xs truncate"
                              style={{ color: isActive ? '#0ea5e9' : '#374151' }}
                            >
                              {conv.title}
                            </span>
                          </button>
                          {hoveredId === conv.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteConversation(conv.id)
                              }}
                              className="shrink-0 w-6 h-6 mr-1 flex items-center justify-center rounded transition-colors"
                              style={{ color: '#94a3b8' }}
                              onMouseEnter={e => {
                                e.currentTarget.style.color = '#ef4444'
                                e.currentTarget.style.background = '#fef2f2'
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.color = '#94a3b8'
                                e.currentTarget.style.background = 'transparent'
                              }}
                              title="삭제"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Parameters */}
      {!collapsed && (
        <div className="px-4 py-4 space-y-4 border-t shrink-0" style={{ borderColor: '#e2e8f0' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm" style={{ color: '#64748b' }}>
              <Brain size={14} />
              <span>Thinking</span>
            </div>
            <Toggle value={params.thinking} onChange={(v) => setParams({ ...params, thinking: v })} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm" style={{ color: '#64748b' }}>
              <Shuffle size={14} />
              <span>Sampling</span>
            </div>
            <Toggle value={params.sampling} onChange={(v) => setParams({ ...params, sampling: v })} />
          </div>

          {params.sampling && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm" style={{ color: '#64748b' }}>
                <div className="flex items-center gap-2">
                  <Thermometer size={14} />
                  <span>Temperature</span>
                </div>
                <span style={{ color: '#1a1d2e', fontVariantNumeric: 'tabular-nums' }}>
                  {params.temperature.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={params.temperature}
                onChange={(e) => setParams({ ...params, temperature: parseFloat(e.target.value) })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  accentColor: '#0ea5e9',
                  background: `linear-gradient(to right, #0ea5e9 ${(params.temperature / 2) * 100}%, #e2e8f0 ${(params.temperature / 2) * 100}%)`,
                }}
              />
              <div className="flex justify-between text-xs" style={{ color: '#94a3b8' }}>
                <span>0</span>
                <span>2</span>
              </div>
            </div>
          )}
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
      style={{ background: value ? '#0ea5e9' : '#cbd5e1' }}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm"
        style={{ transform: value ? 'translateX(20px)' : 'translateX(2px)' }}
      />
    </button>
  )
}
