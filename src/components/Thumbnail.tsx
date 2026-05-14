import { useEffect, useRef, useState, memo } from 'react'
import type { DraggableProvided } from '@hello-pangea/dnd'
import type { PageRecord } from '../store/useStore'
import { renderPageToDataUrl } from '../utils/pdfRenderer'

interface Props {
  page: PageRecord
  fileName: string
  pdfBytes: ArrayBuffer | null
  provided: DraggableProvided | null
  isSelected: boolean
  compact?: boolean // bare image only, used inside LeftSidebar rows
}

export const Thumbnail = memo(function Thumbnail({ page, pdfBytes, compact }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const rendered = useRef(false)

  useEffect(() => {
    if (!pdfBytes || rendered.current) return
    rendered.current = true
    let cancelled = false
    renderPageToDataUrl(pdfBytes, page.pageIndex, compact ? 0.3 : 0.5)
      .then(({ dataUrl }) => { if (!cancelled) { setDataUrl(dataUrl); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [pdfBytes, page.pageIndex, compact])

  if (compact) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-800">
        {loading && <div className="w-3 h-3 border border-indigo-500 border-t-transparent rounded-full animate-spin" />}
        {dataUrl && (
          <img
            src={dataUrl}
            alt={`Side ${page.pageIndex + 1}`}
            className="w-full h-full object-contain"
            style={{ transform: `rotate(${page.rotation}deg)` }}
          />
        )}
      </div>
    )
  }

  // Full thumbnail card (legacy / unused now, kept for possible future use)
  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-800 aspect-[3/4]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {dataUrl && (
        <img src={dataUrl} alt={`Side ${page.pageIndex + 1}`}
          className="w-full h-full object-contain"
          style={{ transform: `rotate(${page.rotation}deg)` }} />
      )}
    </div>
  )
})
