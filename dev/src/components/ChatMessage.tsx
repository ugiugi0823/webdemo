import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { ChevronDown, ChevronRight, Copy, Check, Brain, FileText, X, RotateCcw, Pencil } from 'lucide-react'
import type { Message } from '../types'
import { useTheme } from '../context/ThemeContext'

interface Props {
  message: Message
  onResend?: (messageId: string, newText: string) => void
  isLastUser?: boolean
}

export function ChatMessage({ message, onResend, isLastUser }: Props) {
  const { dark } = useTheme()
  const [thinkOpen, setThinkOpen] = useState(false)
  const [imgFullscreen, setImgFullscreen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = useCallback(() => {
    const text = message.content.trim()
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
      document.body.appendChild(ta)
      ta.focus(); ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }, [message.content])

  useEffect(() => {
    if (!imgFullscreen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setImgFullscreen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [imgFullscreen])

  // Parse thinking from content if not separated
  let thinking = message.thinking
  let content = message.content

  if (!thinking && content.includes('<think>')) {
    const match = content.match(/<think>([\s\S]*?)<\/think>([\s\S]*)/)
    if (match) {
      thinking = match[1].trim()
      content = match[2].trim()
    }
  }

  const hasThinking = Boolean(thinking)
  const isStreaming = message.streaming

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-6 group`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 overflow-hidden">
          <img src="/favicon.png" alt="LLM42" className={`w-full h-full object-cover${isStreaming ? " avatar-spin" : ""}`} />
        </div>
      )}
      {isUser && <div className="w-7 h-7 shrink-0" />}


      {/* Bubble */}
      <div className={`flex flex-col gap-2 ${editing ? 'w-full' : 'max-w-[80%]'} ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Document badge */}
        {isUser && message.document && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
            style={{ background: '#f0f9ff', border: '1px solid #e0f2fe', color: '#0369a1' }}
          >
            <FileText size={13} style={{ color: '#0ea5e9', flexShrink: 0 }} />
            <span className="truncate" style={{ maxWidth: '200px' }}>{message.document.name}</span>
            <span className="uppercase font-medium shrink-0" style={{ color: '#7dd3fc' }}>{message.document.type}</span>
          </div>
        )}

        {/* Image preview */}
        {isUser && message.image && (
          <>
            <img
              src={`data:${message.image.mimeType};base64,${message.image.base64}`}
              alt="attached"
              className="rounded-xl max-h-48 max-w-xs object-cover border cursor-pointer"
              style={{ borderColor: '#e2e8f0' }}
              onClick={() => setImgFullscreen(true)}
              title="클릭하여 전체화면"
            />
            {imgFullscreen && createPortal(
              <div
                className="fixed inset-0 z-50 flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.9)' }}
                onClick={() => setImgFullscreen(false)}
              >
                <img
                  src={`data:${message.image!.mimeType};base64,${message.image!.base64}`}
                  alt="fullscreen"
                  style={{ maxWidth: '96vw', maxHeight: '96vh', objectFit: 'contain', borderRadius: '8px' }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={() => setImgFullscreen(false)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
                >
                  <X size={18} />
                </button>
              </div>,
              document.body
            )}
          </>
        )}

        {/* Thinking section */}
        {hasThinking && (
          <button
            onClick={() => setThinkOpen(!thinkOpen)}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-colors self-start"
            style={{
              background: 'rgba(3, 105, 161, 0.12)',
              color: '#0369a1',
              border: '1px solid rgba(3, 105, 161, 0.4)',
            }}
          >
            <Brain size={12} />
            <span>{isStreaming && !content ? '생각 중...' : '추론 과정'}</span>
            {!isStreaming && (
              thinkOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />
            )}
            {isStreaming && !content && (
              <span className="flex gap-0.5 ml-1">
                <span className="thinking-dot w-1 h-1 rounded-full bg-current inline-block" />
                <span className="thinking-dot w-1 h-1 rounded-full bg-current inline-block" />
                <span className="thinking-dot w-1 h-1 rounded-full bg-current inline-block" />
              </span>
            )}
          </button>
        )}

        {thinkOpen && thinking && (
          <div
            className="text-xs rounded-xl px-4 py-3 max-w-full w-full"
            style={{
              background: 'rgba(3, 105, 161, 0.06)',
              color: '#0369a1',
              border: '1px solid rgba(3, 105, 161, 0.2)',
              fontFamily: 'ui-monospace, monospace',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6',
            }}
          >
            {thinking}
          </div>
        )}

        {/* Edit mode */}
        {isUser && editing && (
          <div className="w-full" style={{ minWidth: '260px' }}>
            <textarea
              autoFocus
              value={editText}
              onChange={e => {
                setEditText(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') setEditing(false)
              }}
              ref={el => {
                if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
              }}
              className="w-full resize-none text-sm leading-relaxed px-3 py-2.5 rounded-xl"
              style={{
                background: dark ? '#1e2130' : '#f8fafc',
                border: `1.5px solid ${dark ? '#3b82f6' : '#0ea5e9'}`,
                color: dark ? '#e2e8f0' : '#1a1d2e',
                outline: 'none',
                fontFamily: 'inherit',
                minHeight: '20px',
                overflow: 'hidden',
              }}
              rows={1}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium"
                style={{ background: dark ? '#263044' : '#e2e8f0', color: dark ? '#94a3b8' : '#475569', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (editText.trim()) {
                    onResend!(message.id, editText.trim())
                    setEditing(false)
                  }
                }}
                className="px-4 py-1.5 rounded-lg text-sm font-medium"
                style={{ background: 'linear-gradient(135deg, #0369a1, #0284c7)', color: '#fff', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >
                업데이트
              </button>
            </div>
          </div>
        )}

        {/* Main content */}
        {!editing && (content || (!hasThinking && isStreaming)) && (
          <div
            className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
            style={
              isUser
                ? {
                    background: dark ? '#1e2130' : '#f0f4f9',
                    color: dark ? '#e2e8f0' : '#1a1d2e',
                    borderBottomRightRadius: '4px',
                  }
                : {
                    background: 'transparent',
                    color: dark ? '#e2e8f0' : '#1a1d2e',
                  }
            }
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{content}</p>
            ) : (
              <div className="prose-chat">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '')
                      const code = String(children).replace(/\n$/, '')
                      return match ? (
                        <CodeBlock language={match[1]} code={code} />
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      )
                    },
                  }}
                >
                  {content}
                </ReactMarkdown>
                {isStreaming && (
                  <span
                    className="inline-block w-0.5 h-4 ml-0.5 align-middle animate-pulse"
                    style={{ background: '#0ea5e9' }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Action buttons — below bubble */}
        {!isStreaming && !editing && (
          <div className={`flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'justify-end' : 'justify-start'}`}>
            <button
              onClick={handleCopy}
              title="복사"
              className="flex items-center justify-center w-7 h-7 rounded-lg"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#4ade80' : '#94a3b8' }}
              onMouseEnter={e => { if (!copied) e.currentTarget.style.color = '#0ea5e9' }}
              onMouseLeave={e => { if (!copied) e.currentTarget.style.color = copied ? '#4ade80' : '#94a3b8' }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            {isUser && isLastUser && onResend && (
              <>
                <button
                  onClick={() => { setEditText(content); setEditing(true) }}
                  title="편집"
                  className="flex items-center justify-center w-7 h-7 rounded-lg"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#0ea5e9' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8' }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => onResend(message.id, content)}
                  title="재전송"
                  className="flex items-center justify-center w-7 h-7 rounded-lg"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#0ea5e9' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8' }}
                >
                  <RotateCcw size={14} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Streaming empty state */}
        {!content && !hasThinking && isStreaming && (
          <div
            className="rounded-2xl px-4 py-3 text-sm"
            style={{
              background: dark ? '#1e2130' : '#ffffff',
              border: `1px solid ${dark ? '#263044' : '#e2e8f0'}`,
              borderBottomLeftRadius: '4px',
              boxShadow: dark ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <span className="flex gap-1 items-center" style={{ color: '#94a3b8' }}>
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-current" />
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-current" />
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-current" />
            </span>
          </div>
        )}

      </div>
    </div>
  )
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const { dark } = useTheme()
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <div className="code-block-wrapper" style={{ position: 'relative' }}>
      <div
        className="flex items-center justify-between px-4 py-1.5 text-xs"
        style={{
          background: '#1e2235',
          borderRadius: '8px 8px 0 0',
          color: '#94a3b8',
          borderBottom: '1px solid #2a2f47',
        }}
      >
        <span>{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded transition-colors"
          style={{ color: copied ? '#7dd3fc' : '#94a3b8' }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={dark ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          borderRadius: '0 0 8px 8px',
          fontSize: '13px',
          border: dark ? '1px solid #263044' : '1px solid #e2e8f0',
          borderTop: 'none',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

