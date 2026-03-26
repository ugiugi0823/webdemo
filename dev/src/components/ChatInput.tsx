import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Send, Square, Plus, X, FileText, Loader, Brain } from 'lucide-react'
import {
  getFileKind,
  extractDocumentText,
  DOC_ACCEPT,
  IMAGE_ACCEPT,
} from '../utils/docExtract'
import type { AttachedDocument } from '../types'
import { useTheme } from '../context/ThemeContext'

interface AttachedImage {
  base64: string
  mimeType: string
  name: string
  preview: string
}

interface Props {
  onSend: (text: string, image?: AttachedImage, document?: AttachedDocument) => void
  onStop: () => void
  isStreaming: boolean
  placeholder?: string
  initialValue?: string
  thinking?: boolean
  onThinkingChange?: (v: boolean) => void
  pendingImage?: AttachedImage | null
}

const MAX_SIZE = 30 * 1024 * 1024
const IMAGE_MAX = 10 * 1024 * 1024

export function ChatInput({
  onSend, onStop, isStreaming, placeholder, initialValue,
  thinking, onThinkingChange, pendingImage,
}: Props) {
  const { dark } = useTheme()
  const [text, setText] = useState('')
  const [image, setImage] = useState<AttachedImage | null>(null)
  const [attachedDoc, setAttachedDoc] = useState<AttachedDocument | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [, setFocused] = useState(false)
  const [plusOpen, setPlusOpen] = useState(false)
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const [imgFullscreen, setImgFullscreen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const plusRef = useRef<HTMLDivElement>(null)

  // Dark mode colors
  const boxBg = dark ? '#1e2130' : '#ffffff'
  const textColor = dark ? '#e2e8f0' : '#1a1d2e'
  const textSecondary = dark ? '#94a3b8' : '#64748b'
  const borderBase = dark ? '#263044' : '#e2e8f0'

  useEffect(() => {
    if (!plusOpen) return
    const handler = (e: MouseEvent) => {
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) {
        setPlusOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [plusOpen])

  useEffect(() => {
    if (!imgFullscreen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setImgFullscreen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [imgFullscreen])

  useEffect(() => {
    if (initialValue !== undefined) {
      setText(initialValue)
      setTimeout(() => textareaRef.current?.focus(), 0)
    }
  }, [initialValue])

  // Auto-attach pending image (e.g. from image task pill)
  useEffect(() => {
    if (pendingImage != null) {
      setAttachedDoc(null)
      setImage(pendingImage)
    }
  }, [pendingImage])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
    el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden'
  }, [text])

  const clearAttachments = () => {
    setImage(null)
    setAttachedDoc(null)
    setDocError(null)
  }

  const processFile = useCallback(async (file: File) => {
    setDocError(null)
    const kind = getFileKind(file)

    if (kind === 'unsupported') {
      setDocError('지원하지 않는 형식입니다.')
      return
    }

    if (kind === 'image') {
      if (file.size > IMAGE_MAX) { setDocError('이미지는 10MB 이하만 가능합니다.'); return }
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setAttachedDoc(null)
        setImage({ base64: result.split(',')[1], mimeType: file.type, name: file.name, preview: result })
      }
      reader.readAsDataURL(file)
      return
    }

    if (file.size > MAX_SIZE) { setDocError('문서는 30MB 이하만 가능합니다.'); return }
    setDocLoading(true)
    setImage(null)
    try {
      const extracted = await extractDocumentText(file)
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      setAttachedDoc({ name: file.name, type: ext, text: extracted })
    } catch (err) {
      setDocError(err instanceof Error ? err.message : '파일 처리 실패')
    } finally {
      setDocLoading(false)
    }
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

  const handleSend = useCallback(() => {
    if (isStreaming) { onStop(); return }
    const t = text.trim()
    if (!t && !image && !attachedDoc) return
    onSend(t, image ?? undefined, attachedDoc ?? undefined)
    setText('')
    clearAttachments()
  }, [text, image, attachedDoc, isStreaming, onSend, onStop])

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (e.nativeEvent.isComposing) return  // 한글 IME 조합 중 무시
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const canSend = !isStreaming && (text.trim().length > 0 || image !== null || attachedDoc !== null) && !docLoading

  const borderColor = dragOver ? '#0ea5e9' : borderBase
  const boxShadow = dragOver
    ? '0 0 0 3px rgba(14,165,233,0.12)'
    : dark ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.06)'

  return (
    <div className="px-4 pb-4 pt-2">
      <div
        className="relative rounded-2xl transition-all"
        style={{ background: boxBg, border: `1px solid ${borderColor}`, boxShadow, outline: 'none' }}
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
                className="h-16 w-16 object-cover rounded-lg cursor-pointer"
                style={{ border: `1px solid ${borderBase}` }}
                onClick={() => setImgFullscreen(true)}
                title="클릭하여 전체화면"
              />
              <button
                onClick={clearAttachments}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: '#64748b', color: '#fff' }}
              >
                <X size={10} />
              </button>
            </div>
            <span className="text-xs" style={{ color: textSecondary }}>{image.name}</span>
          </div>
        )}

        {/* Document preview */}
        {(attachedDoc || docLoading) && (
          <div className="px-4 pt-3 flex items-center gap-2">
            <div
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
              style={{ background: dark ? '#0f2744' : '#f0f9ff', border: `1px solid ${dark ? '#1e3a5f' : '#e0f2fe'}`, maxWidth: '100%' }}
            >
              {docLoading ? (
                <Loader size={14} style={{ color: '#0ea5e9' }} className="animate-spin shrink-0" />
              ) : (
                <FileText size={14} style={{ color: '#0ea5e9' }} className="shrink-0" />
              )}
              <span className="text-xs truncate" style={{ color: dark ? '#7dd3fc' : '#0369a1', maxWidth: '240px' }}>
                {docLoading ? '텍스트 추출 중...' : attachedDoc?.name}
              </span>
              {attachedDoc && (
                <span className="text-xs shrink-0 uppercase font-medium" style={{ color: '#7dd3fc' }}>
                  {attachedDoc!.type}
                </span>
              )}
            </div>
            {!docLoading && (
              <button onClick={clearAttachments} className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: dark ? '#263044' : '#e2e8f0', color: textSecondary }}>
                <X size={10} />
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {docError && (
          <div className="px-4 pt-2">
            <p className="text-xs" style={{ color: '#ef4444' }}>{docError}</p>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder ?? '메세지를 입력하세요. (Shift+Enter: 줄바꿈)'}
          rows={1}
          className={`w-full resize-none bg-transparent px-4 py-3.5 text-sm outline-none${dark ? ' dark-placeholder' : ''}`}
          style={{ color: textColor, caretColor: '#0ea5e9', lineHeight: '1.6', maxHeight: '200px', outline: 'none' }}
        />

        {/* Actions */}
        <div className="flex items-center justify-between px-3 pb-3">
          {/* Left: + button */}
          <div className="flex items-center gap-1">
            <div className="relative" ref={plusRef}>
              <button
                onClick={() => setPlusOpen((v) => !v)}
                className="flex items-center justify-center transition-all"
                style={{ background: 'none', border: 'none', color: plusOpen ? '#0ea5e9' : textSecondary, padding: '4px', cursor: 'pointer' }}
                title="파일 첨부"
              >
                <Plus size={15} style={{ transform: plusOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>

              {plusOpen && (
                <div
                  className="absolute bottom-full mb-2 left-0 rounded-xl overflow-hidden z-10"
                  style={{ background: dark ? '#1e2130' : '#ffffff', border: `1px solid ${borderBase}`, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', minWidth: '150px' }}
                >
                  <button
                    onClick={() => { fileInputRef.current?.click(); setPlusOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left"
                    style={{ color: dark ? '#94a3b8' : '#374151' }}
                    onMouseEnter={e => e.currentTarget.style.background = dark ? '#263044' : '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <FileText size={14} style={{ color: '#0ea5e9' }} />
                    <span>파일 업로드</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: thinking toggle + send/stop */}
          <div className="flex items-center gap-2">
            {/* Thinking toggle (text button) */}
            {onThinkingChange !== undefined && (
              <button
                onClick={() => onThinkingChange(!thinking)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all"
                style={{
                  background: thinking ? 'rgba(3,105,161,0.12)' : 'transparent',
                  color: thinking ? '#0369a1' : textSecondary,
                  border: `1px solid ${thinking ? 'rgba(3,105,161,0.4)' : 'transparent'}`,
                  cursor: 'pointer',
                }}
                title={thinking ? 'Thinking ON (클릭하여 끄기)' : 'Thinking OFF (클릭하여 켜기)'}
              >
                <Brain size={13} />
                <span>Thinking</span>
              </button>
            )}

            <button
              onClick={handleSend}
              disabled={!canSend && !isStreaming}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: isStreaming ? 'linear-gradient(135deg, #0369a1, #0284c7)' : (canSend ? 'linear-gradient(135deg, #0369a1, #0284c7)' : (dark ? '#263044' : '#f1f5f9')),
                color: isStreaming ? '#fff' : (canSend ? '#fff' : (dark ? '#4a5568' : '#94a3b8')),
                cursor: (canSend || isStreaming) ? 'pointer' : 'not-allowed',
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
        accept={`${IMAGE_ACCEPT},${DOC_ACCEPT}`}
        className="hidden"
        onChange={handleFileChange}
      />

      {imgFullscreen && image && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.9)' }}
          onClick={() => setImgFullscreen(false)}
        >
          <img
            src={image.preview}
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
    </div>
  )
}
