import { useRef, useState, useEffect, useCallback } from 'react'
import { RotateCcw, RotateCw, Square, Type, Scissors, Scan, CheckCircle } from 'lucide-react'
import { useStore, type PageRecord } from '../store/useStore'
import { renderPageToImageData } from '../utils/pdfRenderer'
import { pixelRectToPdfRect } from '../utils/coordinateUtils'
import { runOcr } from '../utils/ocrProcessor'
import { translations } from '../i18n'
import { v4 as uuidv4 } from 'uuid'

interface Props {
  page: PageRecord
}

type DrawMode = 'stamp' | 'redact' | 'crop' | null

export function PageEditor({ page }: Props) {
  const { files, pendingStampText, addStamp, addRedaction, setPageCropBox, setPageRotation, applyOcr, setProcessing, lang } = useStore()
  const t = translations[lang]

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const pdfDimsRef = useRef({ width: 0, height: 0 })
  const [pdfDimsState, setPdfDimsState] = useState({ width: 0, height: 0 })
  const [drawMode, setDrawMode] = useState<DrawMode>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const drawStart = useRef<{ x: number; y: number } | null>(null)
  const [ocrProgress, setOcrProgress] = useState<number | null>(null)

  const file = files.find((f) => f.id === page.fileId)

  const renderPage = useCallback(async () => {
    if (!file || !canvasRef.current) return
    const bytes = await file.file.arrayBuffer()
    const { canvas: src } = await renderPageToImageData(bytes, page.pageIndex, 1.5)

    const pdfPage = file.pdfDoc.getPage(page.pageIndex)
    const pw = pdfPage.getWidth()
    const ph = pdfPage.getHeight()
    pdfDimsRef.current = { width: pw, height: ph }
    setPdfDimsState({ width: pw, height: ph })

    const dest = canvasRef.current
    if (!dest) return
    dest.width = src.width
    dest.height = src.height
    if (overlayRef.current) {
      overlayRef.current.width = src.width
      overlayRef.current.height = src.height
    }

    const ctx = dest.getContext('2d')!
    ctx.drawImage(src, 0, 0)

    // Draw redactions
    for (const r of page.redactions) {
      const rx = (r.x / pw) * src.width
      const ry = src.height - ((r.y + r.height) / ph) * src.height
      ctx.fillStyle = 'black'
      ctx.fillRect(rx, ry, (r.width / pw) * src.width, (r.height / ph) * src.height)
    }

    // Draw watermark stamps (centered, large, diagonal)
    for (const s of page.stamps) {
      const cx = (s.x / pw) * src.width
      const cy = src.height - (s.y / ph) * src.height
      const canvasFontSize = (s.fontSize / Math.min(pw, ph)) * Math.min(src.width, src.height)
      ctx.save()
      ctx.translate(cx, cy)
      // Canvas Y is flipped vs PDF — negative angle gives same visual "/" diagonal
      ctx.rotate(-(s.rotation * Math.PI) / 180)
      ctx.font = `bold ${canvasFontSize}px sans-serif`
      ctx.fillStyle = s.color
      ctx.globalAlpha = 0.35
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(s.text, 0, 0)
      ctx.globalAlpha = 1
      ctx.restore()
    }

    // Draw crop box
    if (page.cropBox) {
      const cx2 = (page.cropBox.x / pw) * src.width
      const cy2 = src.height - ((page.cropBox.y + page.cropBox.height) / ph) * src.height
      ctx.strokeStyle = '#6366f1'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(cx2, cy2, (page.cropBox.width / pw) * src.width, (page.cropBox.height / ph) * src.height)
      ctx.setLineDash([])
    }
  }, [file, page.pageIndex, page.redactions, page.stamps, page.cropBox])

  useEffect(() => { renderPage() }, [renderPage])

  const getRelativePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode || drawMode === 'stamp') return
    drawStart.current = getRelativePos(e)
    setIsDrawing(true)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart.current || !overlayRef.current) return
    const overlay = overlayRef.current
    const ctx = overlay.getContext('2d')!
    const pos = getRelativePos(e)
    ctx.clearRect(0, 0, overlay.width, overlay.height)
    const x = Math.min(drawStart.current.x, pos.x)
    const y = Math.min(drawStart.current.y, pos.y)
    const w = Math.abs(pos.x - drawStart.current.x)
    const h = Math.abs(pos.y - drawStart.current.y)
    if (drawMode === 'redact') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, w, h)
    } else if (drawMode === 'crop') {
      ctx.strokeStyle = '#6366f1'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 3])
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])
    }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart.current || !overlayRef.current || !canvasRef.current) return
    const pos = getRelativePos(e)
    const cw = canvasRef.current.width
    const ch = canvasRef.current.height
    const { width: pw, height: ph } = pdfDimsRef.current
    const pixX = Math.min(drawStart.current.x, pos.x)
    const pixY = Math.min(drawStart.current.y, pos.y)
    const pixW = Math.abs(pos.x - drawStart.current.x)
    const pixH = Math.abs(pos.y - drawStart.current.y)
    if (pixW >= 5 && pixH >= 5) {
      if (drawMode === 'redact') {
        addRedaction(page.id, { id: uuidv4(), ...pixelRectToPdfRect(pixX, pixY, pixW, pixH, cw, ch, pw, ph) })
      } else if (drawMode === 'crop') {
        setPageCropBox(page.id, pixelRectToPdfRect(pixX, pixY, pixW, pixH, cw, ch, pw, ph))
      }
    }
    overlayRef.current.getContext('2d')!.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height)
    setIsDrawing(false)
    drawStart.current = null
  }

  // Stamp = full-page watermark, always centered, ignores click position
  const handleClick = (_e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawMode !== 'stamp') return
    const { width: pw, height: ph } = pdfDimsRef.current
    if (!pw || !ph) return

    // Font size: scale so text roughly spans the shorter diagonal dimension
    const diagonal = Math.sqrt(pw * pw + ph * ph)
    const textLen = Math.max(pendingStampText.length, 1)
    const fontSize = Math.round((diagonal * 0.55) / textLen)

    addStamp(page.id, {
      id: uuidv4(),
      x: pw / 2,
      y: ph / 2,
      text: pendingStampText,
      fontSize,
      color: '#9ca3af', // gray-400
      rotation: 45,
    })
  }

  const handleOcr = async () => {
    if (!file) return
    setProcessing(true, t.scanOcr)
    setOcrProgress(0)
    try {
      const bytes = await file.file.arrayBuffer()
      const { canvas } = await renderPageToImageData(bytes, page.pageIndex, 2.0)
      const { width: pw, height: ph } = pdfDimsRef.current
      const results = await runOcr(canvas, pw, ph, (pct) => setOcrProgress(pct))
      if (results.length > 0) applyOcr(page.id, results)
    } finally {
      setProcessing(false)
      setOcrProgress(null)
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap flex-shrink-0">
        <span className="text-xs font-medium text-slate-300">{t.pageEditor}</span>
        {pdfDimsState.width > 0 && (
          <span className="text-[10px] text-slate-600">
            {Math.round(pdfDimsState.width)}×{Math.round(pdfDimsState.height)}pt
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 flex-wrap">
          <button onClick={() => setPageRotation(page.id, (page.rotation - 90 + 360) % 360)}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors" title={t.rotateLeft}>
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setPageRotation(page.id, (page.rotation + 90) % 360)}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors" title={t.rotateRight}>
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-600 mx-0.5" />
          {(['stamp', 'redact', 'crop'] as DrawMode[]).map((mode) => (
            <button key={mode!}
              onClick={() => setDrawMode(drawMode === mode ? null : mode)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                drawMode === mode
                  ? mode === 'stamp' ? 'bg-slate-500 text-white'
                  : mode === 'redact' ? 'bg-red-700 text-white'
                  : 'bg-emerald-700 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {mode === 'stamp' && <Type className="w-3 h-3" />}
              {mode === 'redact' && <Square className="w-3 h-3" />}
              {mode === 'crop' && <Scissors className="w-3 h-3" />}
              {mode === 'stamp' ? t.stamp : mode === 'redact' ? t.redact : t.crop}
            </button>
          ))}
          <button onClick={handleOcr} disabled={ocrProgress !== null}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors disabled:opacity-50">
            {ocrProgress !== null ? (
              <><div className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />{ocrProgress}%</>
            ) : page.ocrApplied ? (
              <><CheckCircle className="w-3 h-3 text-emerald-400" />{t.ocrDone}</>
            ) : (
              <><Scan className="w-3 h-3" />{t.scanOcr}</>
            )}
          </button>
        </div>
      </div>

      {/* Canvas — fills remaining panel height, scrollable */}
      <div className="relative border border-slate-700 rounded overflow-auto flex-1 min-h-0 bg-slate-900">
        <canvas ref={canvasRef} className="block" style={{ maxWidth: '100%' }} />
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: drawMode ? 'crosshair' : 'default' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={drawMode === 'stamp' ? handleClick : undefined}
        />
      </div>

      {drawMode && (
        <p className="text-[10px] text-slate-500 mt-1 flex-shrink-0">
          {drawMode === 'stamp' && t.hintStamp}
          {drawMode === 'redact' && t.hintRedact}
          {drawMode === 'crop' && t.hintCrop}
        </p>
      )}
    </div>
  )
}
