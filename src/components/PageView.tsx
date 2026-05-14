import { useEffect, useRef, useState, useCallback, memo } from 'react'
import { useStore, type PageRecord, type FileRecord } from '../store/useStore'
import { renderPageToImageData } from '../utils/pdfRenderer'
import { pixelRectToPdfRect } from '../utils/coordinateUtils'
import { runOcr } from '../utils/ocrProcessor'
import { translations } from '../i18n'
import { v4 as uuidv4 } from 'uuid'
import { EyeOff } from 'lucide-react'

interface Props {
  page: PageRecord
  file: FileRecord
  isSelected: boolean
  onSelect: () => void
}

export const PageView = memo(function PageView({ page, file, isSelected, onSelect }: Props) {
  const { activeTool, pendingStampText, addStamp, addRedaction, setPageCropBox, applyOcr, setProcessing, lang } = useStore()
  const t = translations[lang]

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const pdfDimsRef = useRef({ width: 0, height: 0 })
  const [rendered, setRendered] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const drawStart = useRef<{ x: number; y: number } | null>(null)

  // Lazy render via IntersectionObserver
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setRendered(true) }, { rootMargin: '300px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const renderCanvas = useCallback(async () => {
    if (!canvasRef.current) return
    const bytes = await file.file.arrayBuffer()
    const { canvas: src } = await renderPageToImageData(bytes, page.pageIndex, 1.5)

    const pdfPage = file.pdfDoc.getPage(page.pageIndex)
    const pw = pdfPage.getWidth()
    const ph = pdfPage.getHeight()
    pdfDimsRef.current = { width: pw, height: ph }

    const dest = canvasRef.current
    dest.width = src.width
    dest.height = src.height
    if (overlayRef.current) {
      overlayRef.current.width = src.width
      overlayRef.current.height = src.height
    }

    const ctx = dest.getContext('2d')!
    ctx.drawImage(src, 0, 0)

    for (const r of page.redactions) {
      ctx.fillStyle = '#000'
      ctx.fillRect((r.x / pw) * src.width, src.height - ((r.y + r.height) / ph) * src.height,
        (r.width / pw) * src.width, (r.height / ph) * src.height)
    }

    for (const s of page.stamps) {
      const cx = (s.x / pw) * src.width
      const cy = src.height - (s.y / ph) * src.height
      const fs = (s.fontSize / Math.min(pw, ph)) * Math.min(src.width, src.height)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(-(s.rotation * Math.PI) / 180)
      ctx.font = `bold ${fs}px sans-serif`
      ctx.fillStyle = s.color
      ctx.globalAlpha = 0.35
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(s.text, 0, 0)
      ctx.globalAlpha = 1
      ctx.restore()
    }

    if (page.cropBox) {
      const cx = Math.round((page.cropBox.x / pw) * src.width)
      const cy = Math.round(src.height - ((page.cropBox.y + page.cropBox.height) / ph) * src.height)
      const cw = Math.round((page.cropBox.width / pw) * src.width)
      const ch = Math.round((page.cropBox.height / ph) * src.height)

      ctx.fillStyle = 'rgba(0,0,0,0.58)'
      ctx.fillRect(0, 0, src.width, cy)
      ctx.fillRect(0, cy + ch, src.width, src.height - cy - ch)
      ctx.fillRect(0, cy, cx, ch)
      ctx.fillRect(cx + cw, cy, src.width - cx - cw, ch)

      ctx.strokeStyle = '#4ade80'
      ctx.lineWidth = 2
      ctx.strokeRect(cx, cy, cw, ch)
    }
  }, [file, page.pageIndex, page.redactions, page.stamps, page.cropBox])

  useEffect(() => { if (rendered) renderCanvas() }, [rendered, renderCanvas])

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const el = overlayRef.current!
    const rect = el.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (el.width / rect.width),
      y: (e.clientY - rect.top) * (el.height / rect.height),
    }
  }

  const isInteractive = isSelected && activeTool !== 'select'

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    onSelect()
    if (!isSelected) return
    if (activeTool === 'stamp') {
      const { width: pw, height: ph } = pdfDimsRef.current
      if (!pw) return
      const diag = Math.sqrt(pw * pw + ph * ph)
      const fontSize = Math.round(diag / (Math.max(pendingStampText.length, 1) * 0.6))
      addStamp(page.id, { id: uuidv4(), x: pw / 2, y: ph / 2, text: pendingStampText, fontSize, color: '#9ca3af', rotation: 45 })
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelected || activeTool === 'select' || activeTool === 'stamp') return
    drawStart.current = getPos(e)
    setIsDrawing(true)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart.current || !overlayRef.current) return
    const ov = overlayRef.current
    const ctx = ov.getContext('2d')!
    const pos = getPos(e)
    ctx.clearRect(0, 0, ov.width, ov.height)
    const x = Math.min(drawStart.current.x, pos.x)
    const y = Math.min(drawStart.current.y, pos.y)
    const w = Math.abs(pos.x - drawStart.current.x)
    const h = Math.abs(pos.y - drawStart.current.y)
    if (activeTool === 'redact') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#f87171'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, w, h)
    } else if (activeTool === 'crop') {
      ctx.strokeStyle = '#4ade80'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])
    }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart.current || !canvasRef.current) return
    const pos = getPos(e)
    const cw = canvasRef.current.width
    const ch = canvasRef.current.height
    const { width: pw, height: ph } = pdfDimsRef.current
    const px = Math.min(drawStart.current.x, pos.x)
    const py = Math.min(drawStart.current.y, pos.y)
    const pw2 = Math.abs(pos.x - drawStart.current.x)
    const ph2 = Math.abs(pos.y - drawStart.current.y)
    if (pw2 >= 5 && ph2 >= 5) {
      const rect = pixelRectToPdfRect(px, py, pw2, ph2, cw, ch, pw, ph)
      if (activeTool === 'redact') addRedaction(page.id, { id: uuidv4(), ...rect })
      else if (activeTool === 'crop') setPageCropBox(page.id, rect)
    }
    overlayRef.current?.getContext('2d')!.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height)
    setIsDrawing(false)
    drawStart.current = null
  }

  const handleOcr = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setProcessing(true, t.scanOcr + ' (laster…)')
    try {
      const bytes = await file.file.arrayBuffer()
      const { canvas } = await renderPageToImageData(bytes, page.pageIndex, 2.0)
      const { width: pw, height: ph } = pdfDimsRef.current
      if (!pw) { alert('Siden er ikke rendret ennå — prøv igjen om et sekund.'); return }
      const results = await runOcr(canvas, pw, ph, (pct) => {
        setProcessing(true, `${t.scanOcr} ${pct}%`)
      })
      if (results.length > 0) {
        applyOcr(page.id, results)
      } else {
        alert('Ingen tekst funnet. OCR fungerer kun på skannede (bilde-baserte) PDF-er, ikke på tekst-baserte PDF-er.')
      }
    } catch (err) {
      console.error('OCR feil:', err)
      alert('OCR feilet. Sjekk internettforbindelsen — Tesseract laster språkdata fra CDN første gang (~20 MB).')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div ref={containerRef} id={`page-view-${page.id}`} style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Label row */}
      <div className="page-card-label">
        <span className={`page-num-chip${isSelected ? ' selected' : ''}`} style={isSelected ? { background: 'var(--gold-dim)', borderColor: 'rgba(232,197,71,0.3)', color: 'var(--gold)' } : {}}>
          s.{page.pageIndex + 1}
        </span>
        <div className="page-status-badges">
          {page.excluded && (
            <span className="page-status-badge" style={{ background: 'rgba(248,113,113,0.12)', color: 'var(--red)' }}>
              <EyeOff size={9} style={{ display: 'inline', marginRight: 3 }} />{t.statusExcluded}
            </span>
          )}
          {page.stamps.length > 0 && (
            <span className="page-status-badge" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
              W×{page.stamps.length}
            </span>
          )}
          {page.redactions.length > 0 && (
            <span className="page-status-badge" style={{ background: 'rgba(248,113,113,0.12)', color: 'var(--red)' }}>
              R×{page.redactions.length}
            </span>
          )}
          {page.ocrApplied && (
            <span className="page-status-badge" style={{ background: 'rgba(74,222,128,0.12)', color: 'var(--green)' }}>
              OCR ✓
            </span>
          )}
          {activeTool === 'ocr' && isSelected && (
            <button
              onClick={handleOcr}
              style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 4,
                background: 'rgba(167,139,250,0.12)', color: 'var(--violet)',
                border: '1px solid rgba(167,139,250,0.2)', cursor: 'pointer',
              }}
            >
              {t.scanOcr}
            </button>
          )}
        </div>
      </div>

      {/* Page canvas */}
      <div
        className={`page-card${isSelected ? ' selected' : ''}${page.excluded ? ' excluded' : ''}`}
        onClick={() => { if (!isSelected) onSelect() }}
      >
        {!rendered ? (
          <div className="skeleton" style={{ aspectRatio: '3/4', minHeight: 160 }} />
        ) : (
          <>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
            <canvas
              ref={overlayRef}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                cursor: isInteractive ? 'crosshair' : isSelected ? 'default' : 'pointer',
              }}
              onClick={handleClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            />
          </>
        )}
      </div>
    </div>
  )
})
