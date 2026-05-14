import { useState, useCallback, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { Trash2, Download, Globe, Sun, Moon, Upload, GripVertical, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { useStore } from '../store/useStore'
import { exportPdf, downloadBlob } from '../utils/pdfExporter'
import { loadPdfFile } from '../utils/pdfLoader'
import { translations } from '../i18n'
import { Thumbnail } from './Thumbnail'

export function LeftSidebar() {
  const {
    files, pageOrder, setPageOrder,
    removeFile, clearAll, setProcessing, isProcessing,
    selectedPageId, setSelectedPage,
    lang, toggleLang, theme, toggleTheme,
    togglePageExclusion,
  } = useStore()
  const t = translations[lang]

  const [pdfBytesMap, setPdfBytesMap] = useState<Record<string, ArrayBuffer>>({})

  useEffect(() => {
    for (const file of files) {
      if (!pdfBytesMap[file.id]) {
        file.file.arrayBuffer().then((buf) => {
          setPdfBytesMap((prev) => ({ ...prev, [file.id]: buf }))
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const pdfs = acceptedFiles.filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (!pdfs.length) return
    setProcessing(true, t.processing)
    try {
      for (const file of pdfs) {
        const { fileRecord, pageRecords } = await loadPdfFile(file)
        useStore.getState().addFile(fileRecord, pageRecords)
      }
    } catch (e) { console.error(e) }
    finally { setProcessing(false) }
  }, [setProcessing, t])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }, multiple: true,
  })

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const newOrder = Array.from(pageOrder)
    const [moved] = newOrder.splice(result.source.index, 1)
    newOrder.splice(result.destination.index, 0, moved)
    setPageOrder(newOrder)
  }

  const handleExport = async () => {
    if (!files.length) return
    setProcessing(true, t.assembling)
    try {
      const bytes = await exportPdf(files, pageOrder, (msg) => setProcessing(true, msg))
      downloadBlob(bytes, `workbench-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      console.error(e)
      alert(t.exportFailed)
    } finally { setProcessing(false) }
  }

  const activeCount = pageOrder.filter((p) => !p.excluded).length
  const fileNameMap: Record<string, string> = {}
  for (const f of files) fileNameMap[f.id] = f.originalName

  return (
    <aside className="sidebar sidebar-left">

      {/* Header */}
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div className="app-wordmark">PDF<span>Pro</span></div>
            <div className="app-edition">{t.appEdition}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={toggleLang} className="meta-btn" title="Bytt språk">
              <Globe size={11} />{t.langToggle}
            </button>
            <button onClick={toggleTheme} className="meta-btn" title="Bytt tema">
              {theme === 'dark' ? <Sun size={11} /> : <Moon size={11} />}
            </button>
          </div>
        </div>

        <div {...getRootProps()} className={`dropzone-compact${isDragActive ? ' active' : ''}`}>
          <input {...getInputProps()} />
          <Upload size={13} style={{ flexShrink: 0 }} />
          <span>{isDragActive ? t.dropActive : t.dropIdle}</span>
        </div>
      </div>

      {/* Thumbnail list */}
      <div className="thumb-list">
        {pageOrder.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, padding: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.noFiles}</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="pages" direction="vertical">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {(() => {
                    let lastFileId: string | null = null
                    return pageOrder.map((page, index) => {
                      const showHeader = page.fileId !== lastFileId
                      lastFileId = page.fileId
                      return (
                        <div key={page.id}>
                          {showHeader && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 8 }}>
                              <span className="file-group-label" style={{ flex: 1 }} title={fileNameMap[page.fileId]}>
                                {fileNameMap[page.fileId]}
                              </span>
                              <button
                                onClick={() => removeFile(page.fileId)}
                                className="icon-btn danger"
                                title={t.removeFile}
                                style={{ flexShrink: 0 }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                          <Draggable draggableId={page.id} index={index}>
                            {(dp, snapshot) => (
                              <div
                                ref={dp.innerRef}
                                {...dp.draggableProps}
                                className={`thumb-row${page.id === selectedPageId ? ' selected' : ''}${page.excluded ? ' excluded' : ''}`}
                                style={{
                                  ...dp.draggableProps.style,
                                  ...(snapshot.isDragging ? { boxShadow: 'var(--shadow-md)', transform: dp.draggableProps.style?.transform } : {}),
                                }}
                                onClick={() => {
                                  setSelectedPage(page.id === selectedPageId ? null : page.id)
                                  document.getElementById(`page-view-${page.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                }}
                              >
                                {/* Drag handle */}
                                <div
                                  {...dp.dragHandleProps}
                                  className="icon-btn"
                                  style={{ cursor: 'grab', flexShrink: 0 }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <GripVertical size={11} />
                                </div>

                                {/* Thumbnail */}
                                <div className="thumb-img-wrap">
                                  <Thumbnail
                                    page={page}
                                    fileName=""
                                    pdfBytes={pdfBytesMap[page.fileId] ?? null}
                                    provided={null}
                                    isSelected={false}
                                    compact
                                  />
                                </div>

                                {/* Info */}
                                <div className="thumb-info">
                                  <div className="thumb-page-num">s.{page.pageIndex + 1}</div>
                                  <div className="thumb-badges">
                                    {page.stamps.length > 0 && (
                                      <span className="thumb-badge thumb-badge-gold">W×{page.stamps.length}</span>
                                    )}
                                    {page.redactions.length > 0 && (
                                      <span className="thumb-badge thumb-badge-red">R×{page.redactions.length}</span>
                                    )}
                                    {page.ocrApplied && (
                                      <span className="thumb-badge thumb-badge-green">OCR</span>
                                    )}
                                  </div>
                                </div>

                                {/* Exclude toggle */}
                                <div className="thumb-actions" style={{ opacity: undefined }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); togglePageExclusion(page.id) }}
                                    className={`icon-btn${page.excluded ? ' danger' : ''}`}
                                    title={page.excluded ? t.statusIncluded : t.statusExcluded}
                                  >
                                    {page.excluded
                                      ? <EyeOff size={12} style={{ color: 'var(--red)' }} />
                                      : <Eye size={12} />
                                    }
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        </div>
                      )
                    })
                  })()}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        {files.length > 0 && (
          <p className="page-count-label">{t.pagesInOutput(activeCount)}</p>
        )}
        <button
          onClick={handleExport}
          disabled={!files.length || isProcessing || activeCount === 0}
          className="btn btn-primary"
        >
          {isProcessing ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          {isProcessing ? t.processing : t.exportPdf}
        </button>
        <button
          onClick={clearAll}
          disabled={!files.length || isProcessing}
          className="btn btn-ghost"
        >
          <Trash2 size={12} />{t.clearAll}
        </button>
      </div>
    </aside>
  )
}
