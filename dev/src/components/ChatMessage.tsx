import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { ChevronDown, ChevronRight, Copy, Check, Brain, FileText } from 'lucide-react'
import type { Message } from '../types'

interface Props {
  message: Message
}

export function ChatMessage({ message }: Props) {
  const [thinkOpen, setThinkOpen] = useState(false)
  const isUser = message.role === 'user'

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
      <div
        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 overflow-hidden"
        style={
          isUser
            ? { background: 'linear-gradient(135deg, #0369a1, #0284c7)', color: '#fff' }
            : undefined
        }
      >
        {isUser ? (
          <span style={{ color: '#fff' }}>U</span>
        ) : (
          <img src="/favicon.png" alt="LLM42" className={`w-full h-full object-cover${isStreaming ? " avatar-spin" : ""}`} />
        )}
      </div>

      {/* Bubble */}
      <div className={`flex flex-col gap-2 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
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
          <img
            src={`data:${message.image.mimeType};base64,${message.image.base64}`}
            alt="attached"
            className="rounded-xl max-h-48 max-w-xs object-cover border"
            style={{ borderColor: '#e2e8f0' }}
          />
        )}

        {/* Thinking section */}
        {hasThinking && (
          <button
            onClick={() => setThinkOpen(!thinkOpen)}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-colors self-start"
            style={{
              background: '#f0f9ff',
              color: '#0ea5e9',
              border: '1px solid #e0f2fe',
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
              background: '#f0f9ff',
              color: '#0284c7',
              border: '1px solid #e0f2fe',
              fontFamily: 'ui-monospace, monospace',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6',
            }}
          >
            {thinking}
          </div>
        )}

        {/* Main content */}
        {(content || (!hasThinking && isStreaming)) && (
          <div
            className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
            style={
              isUser
                ? {
                    background: 'linear-gradient(135deg, #0369a1, #0369a1)',
                    color: '#fff',
                    borderBottomRightRadius: '4px',
                  }
                : {
                    background: 'transparent',
                    color: '#1a1d2e',
                  }
            }
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{content}</p>
            ) : (
              <div className="prose-chat">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
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

        {/* Streaming empty state */}
        {!content && !hasThinking && isStreaming && (
          <div
            className="rounded-2xl px-4 py-3 text-sm"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderBottomLeftRadius: '4px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <span className="flex gap-1 items-center" style={{ color: '#94a3b8' }}>
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-current" />
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-current" />
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-current" />
            </span>
          </div>
        )}

        {/* Timestamp */}
        <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity px-1" style={{ color: '#94a3b8' }}>
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}

function CodeBlock({ language, code }: { language: string; code: string }) {
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
        style={oneLight}
        customStyle={{
          margin: 0,
          borderRadius: '0 0 8px 8px',
          fontSize: '13px',
          border: '1px solid #e2e8f0',
          borderTop: 'none',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}
