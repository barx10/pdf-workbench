import { useStore } from '../store/useStore'
import { PageView } from './PageView'
import { translations } from '../i18n'
import { Type, Square, Scissors, Scan, RotateCcw, RotateCw, MousePointer2 } from 'lucide-react'

export function CenterWorkspace() {
  const {
    files, pageOrder, selectedPageId, setSelectedPage,
    activeTool, setActiveTool,
    pendingStampText, setPendingStampText,
    setPageRotation,
    isProcessing, processingMessage, lang,
  } = useStore()
  const t = translations[lang]

  const selectedPage = pageOrder.find((p) => p.id === selectedPageId)
  const fileMap = Object.fromEntries(files.map((f) => [f.id, f]))

  const tools = [
    { id: 'select' as const, icon: <MousePointer2 size={13} />, label: lang === 'no' ? 'Velg' : 'Select' },
    { id: 'stamp'  as const, icon: <Type size={13} />,          label: t.stamp },
    { id: 'redact' as const, icon: <Square size={13} />,        label: t.redact },
    { id: 'crop'   as const, icon: <Scissors size={13} />,      label: t.crop },
    { id: 'ocr'    as const, icon: <Scan size={13} />,          label: t.scanOcr },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div className="center-toolbar">
        <div className="tool-group">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id as typeof activeTool)}
              className={`tool-btn${activeTool === tool.id ? ` active-${tool.id}` : ''}`}
            >
              {tool.icon}
              <span>{tool.label}</span>
            </button>
          ))}
        </div>

        {activeTool === 'stamp' && (
          <input
            type="text"
            value={pendingStampText}
            onChange={(e) => setPendingStampText(e.target.value)}
            placeholder={t.stampPlaceholder}
            className="stamp-input"
          />
        )}

        {selectedPage && (
          <>
            <div className="toolbar-divider" />
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setPageRotation(selectedPage.id, (selectedPage.rotation - 90 + 360) % 360)}
                className="rotate-btn"
                title={t.rotateLeft}
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={() => setPageRotation(selectedPage.id, (selectedPage.rotation + 90) % 360)}
                className="rotate-btn"
                title={t.rotateRight}
              >
                <RotateCw size={13} />
              </button>
            </div>
          </>
        )}

        <div className="toolbar-counter">
          {pageOrder.length > 0 && (
            <span>{t.includedPages(pageOrder.filter((p) => !p.excluded).length, pageOrder.length)}</span>
          )}
        </div>
      </div>

      {/* Processing banner */}
      {isProcessing && (
        <div className="processing-banner">
          <div className="processing-dot" />
          <span className="processing-text">{processingMessage || t.processing}</span>
        </div>
      )}

      {/* Page scroll area */}
      {files.length === 0 ? (
        <div className="welcome-state">
          <h2 className="welcome-title">{t.welcomeTitle}</h2>
          <p className="welcome-sub">{t.welcomeSub}</p>
        </div>
      ) : (
        <div className="page-viewer">
          {(() => {
            let lastFileId: string | null = null
            return pageOrder.map((page) => {
              const showSep = page.fileId !== lastFileId
              lastFileId = page.fileId
              const file = fileMap[page.fileId]
              if (!file) return null
              return (
                <div key={page.id} className="page-card-wrap animate-fade-in">
                  {showSep && (
                    <div className="file-separator">
                      <div className="file-separator-line" />
                      <span className="file-separator-label">{file.originalName}</span>
                      <div className="file-separator-line" />
                    </div>
                  )}
                  <PageView
                    page={page}
                    file={file}
                    isSelected={page.id === selectedPageId}
                    onSelect={() => setSelectedPage(page.id === selectedPageId ? null : page.id)}
                  />
                </div>
              )
            })
          })()}
        </div>
      )}
    </div>
  )
}
