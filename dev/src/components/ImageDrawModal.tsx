import { useRef, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Eraser, Trash2 } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

interface Props {
  preview: string
  onClose: () => void
  onApply: (base64: string, preview: string, mimeType: string) => void
}

const COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff']
const SIZES = [2, 5, 10, 20]

export function ImageDrawModal({ preview, onClose, onApply }: Props) {
  const { dark } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [color, setColor] = useState('#ef4444')
  const [strokeSize, setStrokeSize] = useState(5)
  const [erasing, setErasing] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const drawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  const borderColor = dark ? '#263044' : '#e2e8f0'
  const textSecondary = dark ? '#94a3b8' : '#64748b'

  // Set canvas dimensions after both image and canvas are in the DOM
  useEffect(() => {
    if (!imgLoaded) return
    requestAnimationFrame(() => {
      const img = imgRef.current
      const canvas = canvasRef.current
      if (!img || !canvas) return
      const rect = img.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
    })
  }, [imgLoaded])

  // Preserve drawing on resize
  useEffect(() => {
    if (!imgLoaded) return
    const handler = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const tmp = document.createElement('canvas')
      tmp.width = canvas.width
      tmp.height = canvas.height
      tmp.getContext('2d')?.drawImage(canvas, 0, 0)
      requestAnimationFrame(() => {
        const img = imgRef.current
        if (!img || !canvas) return
        const rect = img.getBoundingClientRect()
        canvas.width = rect.width
        canvas.height = rect.height
        canvas.getContext('2d')?.drawImage(tmp, 0, 0, canvas.width, canvas.height)
      })
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [imgLoaded])

  const getPos = useCallback((
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect()
    // Scale from CSS pixels to canvas internal resolution
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    }
  }, [])

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    drawing.current = true
    lastPos.current = getPos(e, canvas)
  }, [getPos])

  const doDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pos = getPos(e, canvas)
    const from = lastPos.current ?? pos

    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.lineWidth = strokeSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (erasing) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = color
    }
    ctx.stroke()
    lastPos.current = pos
  }, [color, strokeSize, erasing, getPos])

  const endDraw = useCallback(() => {
    drawing.current = false
    lastPos.current = null
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  const handleApply = useCallback(() => {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas) return

    const merged = document.createElement('canvas')
    merged.width = img.naturalWidth
    merged.height = img.naturalHeight
    const ctx = merged.getContext('2d')
    if (!ctx) return

    ctx.drawImage(img, 0, 0, merged.width, merged.height)
    ctx.drawImage(canvas, 0, 0, merged.width, merged.height)

    const dataUrl = merged.toDataURL('image/jpeg', 0.92)
    onApply(dataUrl.split(',')[1], dataUrl, 'image/jpeg')
  }, [onApply])

  const modal = (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-4"
      style={{ background: 'rgba(0,0,0,0.88)' }}
    >
      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-2xl shrink-0"
        style={{
          background: dark ? '#1e2130' : '#ffffff',
          border: `1px solid ${borderColor}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        {/* Color palette */}
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setErasing(false) }}
              title={c}
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: c,
                border: color === c && !erasing ? '2.5px solid #0ea5e9' : '2px solid transparent',
                outline: c === '#ffffff' ? `1px solid ${borderColor}` : 'none',
                transform: color === c && !erasing ? 'scale(1.25)' : 'scale(1)',
                transition: 'transform 0.12s',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            />
          ))}
        </div>

        <div style={{ width: '1px', height: '20px', background: borderColor }} />

        {/* Stroke sizes */}
        <div className="flex items-center gap-1">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => { setStrokeSize(s); setErasing(false) }}
              className="flex items-center justify-center rounded-full transition-colors"
              style={{
                width: '26px',
                height: '26px',
                background: strokeSize === s && !erasing ? 'rgba(14,165,233,0.15)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <div
                className="rounded-full"
                style={{
                  width: Math.max(4, s * 0.8),
                  height: Math.max(4, s * 0.8),
                  background: dark ? '#e2e8f0' : '#374151',
                }}
              />
            </button>
          ))}
        </div>

        <div style={{ width: '1px', height: '20px', background: borderColor }} />

        {/* Eraser */}
        <button
          onClick={() => setErasing((v) => !v)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all"
          style={{
            background: erasing ? 'rgba(14,165,233,0.15)' : 'transparent',
            color: erasing ? '#0ea5e9' : textSecondary,
            border: erasing ? '1px solid rgba(14,165,233,0.3)' : '1px solid transparent',
            cursor: 'pointer',
          }}
          title="지우개"
        >
          <Eraser size={14} />
          <span>지우개</span>
        </button>

        {/* Clear all */}
        <button
          onClick={clearCanvas}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all"
          style={{
            background: 'transparent',
            color: textSecondary,
            border: '1px solid transparent',
            cursor: 'pointer',
          }}
          title="전체 지우기"
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ef4444'
            e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = textSecondary
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Trash2 size={14} />
          <span>지우기</span>
        </button>

        <div style={{ width: '1px', height: '20px', background: borderColor }} />

        {/* Apply */}
        <button
          onClick={handleApply}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{
            background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
            color: '#ffffff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Check size={14} />
          <span>적용</span>
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded-lg p-1.5 transition-colors"
          style={{
            background: 'transparent',
            color: textSecondary,
            border: 'none',
            cursor: 'pointer',
          }}
          title="닫기"
          onMouseEnter={(e) => { e.currentTarget.style.color = dark ? '#e2e8f0' : '#1a1d2e' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = textSecondary }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Image + Canvas layer */}
      <div
        className="relative"
        style={{ maxWidth: '92vw', maxHeight: 'calc(95vh - 100px)', borderRadius: '12px', overflow: 'hidden' }}
      >
        <img
          ref={imgRef}
          src={preview}
          alt="draw"
          onLoad={() => setImgLoaded(true)}
          draggable={false}
          style={{
            display: 'block',
            maxWidth: '92vw',
            maxHeight: 'calc(95vh - 100px)',
            objectFit: 'contain',
            userSelect: 'none',
          }}
        />
        {imgLoaded && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            style={{ cursor: erasing ? 'cell' : 'crosshair', touchAction: 'none' }}
            onMouseDown={startDraw}
            onMouseMove={doDraw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={doDraw}
            onTouchEnd={endDraw}
          />
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
