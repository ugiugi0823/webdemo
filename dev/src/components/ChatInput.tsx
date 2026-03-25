import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Square, Paperclip, X, Image } from 'lucide-react'

interface AttachedImage {
  base64: string
  mimeType: string
  name: string
  preview: string
}

interface Props {
  onSend: (text: string, image?: AttachedImage) => void
  onStop: () => void
  isStreaming: boolean
  placeholder?: string
  initialValue?: string
}

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function ChatInput({ onSend, onStop, isStreaming, placeholder, initialValue }: Props) {
  const [text, setText] = useState('')
  const [image, setImage] = useState<AttachedImage | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load initial value from task selection
  useEffect(() => {
    if (initialValue !== undefined) {
      setText(initialValue)
      setTimeout(() => textareaRef.current?.focus(), 0)
    }
  }, [initialValue])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [text])

  const handleSend = useCallback(() => {
    if (isStreaming) { onStop(); return }
    const t = text.trim()
    if (!t && !image) return
    onSend(t, image ?? undefined)
    setText('')
    setImage(null)
  }, [text, image, isStreaming, onSend, onStop])

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const processFile = useCallback((file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('지원하지 않는 형식입니다. JPEG, PNG, WebP, GIF만 가능합니다.')
      return
    }
    if (file.size > MAX_SIZE) {
      alert('파일 크기가 10MB를 초과합니다.')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      const base64 = result.split(',')[1]
      setImage({ base64, mimeType: file.type, name: file.name, preview: result })
    }
    reader.readAsDataURL(file)
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
      e.target.value = ''
    },
    [processFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const canSend = (text.trim().length > 0 || image !== null) && !isStreaming
    || isStreaming

  return (
    <div className="px-4 pb-4 pt-2">
      <div
        className="relative rounded-2xl transition-all"
        style={{
          background: '#1e2235',
          border: `1px solid ${dragOver ? '#7c6bff' : '#2a2f47'}`,
          boxShadow: dragOver ? '0 0 0 2px rgba(124,107,255,0.2)' : 'none',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Image preview */}
        {image && (
          <div className="px-4 pt-3 flex items-center gap-2">
            <div className="relative inline-block">
              <img
                src={image.preview}
                alt="preview"
                className="h-16 w-16 object-cover rounded-lg"
                style={{ border: '1px solid #2a2f47' }}
              />
              <button
                onClick={() => setImage(null)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: '#3d4460', color: '#e8eaf0' }}
              >
                <X size={10} />
              </button>
            </div>
            <div className="text-xs" style={{ color: '#555b72' }}>
              <p style={{ color: '#8b90a8' }}>{image.name}</p>
              <p className="flex items-center gap-1 mt-0.5">
                <Image size={10} />
                이미지 추론 모드
              </p>
            </div>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder ?? '메세지를 입력하세요. (Shift+Enter: 줄바꿈)'}
          rows={1}
          disabled={isStreaming && !text}
          className="w-full resize-none bg-transparent px-4 py-3.5 text-sm outline-none"
          style={{
            color: '#e8eaf0',
            caretColor: '#7c6bff',
            lineHeight: '1.6',
            maxHeight: '200px',
          }}
        />

        {/* Actions */}
        <div className="flex items-center justify-between px-3 pb-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{ color: '#555b72', background: 'transparent' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#252a3d'
              e.currentTarget.style.color = '#8b90a8'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#555b72'
            }}
            title="이미지 첨부"
          >
            <Paperclip size={14} />
            <span>이미지</span>
          </button>

          <div className="flex items-center gap-2">
            {isStreaming && (
              <span className="text-xs" style={{ color: '#555b72' }}>
                생성 중...
              </span>
            )}
            <button
              onClick={handleSend}
              disabled={!canSend && !isStreaming}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: isStreaming
                  ? '#2a1f3d'
                  : canSend
                  ? 'linear-gradient(135deg, #7c6bff, #a855f7)'
                  : '#2a2f47',
                color: isStreaming ? '#a78bfa' : canSend ? '#fff' : '#555b72',
                cursor: canSend || isStreaming ? 'pointer' : 'not-allowed',
              }}
              title={isStreaming ? '중지' : '전송 (Enter)'}
            >
              {isStreaming ? <Square size={14} fill="currentColor" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        className="hidden"
        onChange={handleFileChange}
      />

      <p className="text-center text-xs mt-2" style={{ color: '#3d4460' }}>
        LLM42 · 42MARU
      </p>
    </div>
  )
}
