import { useState } from 'react'
import { FileText, Layers, Type, Square, Trash2, RotateCw, Crop, ChevronDown, ChevronRight, Crosshair } from 'lucide-react'
import { useStore } from '../store/useStore'
import { translations } from '../i18n'

export function RightSidebar() {
  const {
    files, pageOrder, selectedPageId,
    pendingStampText, setPendingStampText,
    removeStamp, removeRedaction,
    setPageCropBox, setPageRotation,
    updateFormField, lang,
  } = useStore()
  const t = translations[lang]

  const [formOpen, setFormOpen]     = useState(true)
  const [stampOpen, setStampOpen]   = useState(true)
  const [redactOpen, setRedactOpen] = useState(true)

  const selectedPage = pageOrder.find((p) => p.id === selectedPageId)
  const selectedFile = selectedPage ? files.find((f) => f.id === selectedPage.fileId) : null

  if (!selectedPage || !selectedFile) {
    return (
      <aside className="sidebar sidebar-right">
        <div className="inspector-header">
          <div className="inspector-title">{t.inspector}</div>
        </div>
        <div className="empty-inspector">
          <div className="empty-inspector-icon">
            <Crosshair size={18} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>{t.noPageSelected}</p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.noPageHint}</p>
          </div>
        </div>
        <div style={{ padding: '12px', borderTop: '1px solid var(--border-faint)' }}>
          <label style={{ display: 'block', fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            {t.stampText}
          </label>
          <input
            type="text"
            value={pendingStampText}
            onChange={(e) => setPendingStampText(e.target.value)}
            placeholder={t.stampPlaceholder}
            className="field-input"
          />
        </div>
      </aside>
    )
  }

  const pdfPage = selectedFile.pdfDoc.getPage(selectedPage.pageIndex)
  const pageWidth = pdfPage.getWidth()
  const pageHeight = pdfPage.getHeight()

  return (
    <aside className="sidebar sidebar-right">
      <div className="inspector-header">
        <div className="inspector-title">{t.inspector}</div>
        <div className="inspector-subtitle">{selectedFile.originalName}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Page info */}
        <div className="inspector-section">
          <div className="inspector-section-header" style={{ cursor: 'default' }}>
            <FileText size={11} />
            {t.pageInfo}
          </div>
          <PropRow label={t.labelPage}     value={`${selectedPage.pageIndex + 1} / ${selectedFile.pageCount}`} />
          <PropRow label={t.labelSize}     value={`${Math.round(pageWidth)} × ${Math.round(pageHeight)} pt`} />
          <PropRow label={t.labelRotation} value={`${selectedPage.rotation}°`} />
          <PropRow
            label={t.labelStatus}
            value={selectedPage.excluded ? t.statusExcluded : t.statusIncluded}
            accent={selectedPage.excluded ? 'red' : 'green'}
          />
          {selectedPage.cropBox && <PropRow label={t.labelCrop}    value={t.statusApplied} accent="blue" />}
          {selectedPage.ocrApplied && <PropRow label={t.labelOcr} value={t.statusApplied} accent="green" />}

          <div className="inspector-rotate-row">
            <button
              onClick={() => setPageRotation(selectedPage.id, (selectedPage.rotation - 90 + 360) % 360)}
              className="rotate-seg-btn"
            >
              <RotateCw size={11} style={{ transform: 'scaleX(-1)' }} /> -90°
            </button>
            <button
              onClick={() => setPageRotation(selectedPage.id, (selectedPage.rotation + 90) % 360)}
              className="rotate-seg-btn"
            >
              <RotateCw size={11} /> +90°
            </button>
          </div>

          {selectedPage.cropBox && (
            <button
              onClick={() => setPageCropBox(selectedPage.id, undefined)}
              style={{
                marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '6px', borderRadius: 7, fontSize: 11,
                background: 'rgba(248,113,113,0.08)', color: 'var(--red)',
                border: '1px solid rgba(248,113,113,0.2)', cursor: 'pointer',
              }}
            >
              <Crop size={11} /> {t.clearCrop}
            </button>
          )}
        </div>

        {/* AcroForm Fields */}
        <Collapsible
          icon={<Layers size={11} />}
          title={t.formFields}
          open={formOpen}
          onToggle={() => setFormOpen(!formOpen)}
          count={selectedFile.formFields.length}
        >
          {selectedFile.formFields.length === 0 ? (
            <p style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t.noFormFields}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedFile.formFields.map((field) => (
                <div key={field.name}>
                  <label style={{ display: 'block', fontSize: 9.5, color: 'var(--text-muted)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={field.name}>
                    {field.name} <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>({field.type})</span>
                  </label>
                  {field.type === 'CheckBox' ? (
                    <input
                      type="checkbox"
                      checked={field.value === 'true'}
                      onChange={(e) => updateFormField(selectedFile.id, field.name, e.target.checked ? 'true' : 'false')}
                      style={{ accentColor: 'var(--gold)' }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => updateFormField(selectedFile.id, field.name, e.target.value)}
                      className="field-input"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </Collapsible>

        {/* Text Stamps */}
        <Collapsible
          icon={<Type size={11} />}
          title={t.textStamps}
          open={stampOpen}
          onToggle={() => setStampOpen(!stampOpen)}
          count={selectedPage.stamps.length}
        >
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              {t.stampText}
            </label>
            <input
              type="text"
              value={pendingStampText}
              onChange={(e) => setPendingStampText(e.target.value)}
              placeholder={t.stampPlaceholder}
              className="field-input"
            />
          </div>
          {selectedPage.stamps.length === 0 ? (
            <p style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t.noStamps}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {selectedPage.stamps.map((stamp) => (
                <div key={stamp.id} className="annotation-row">
                  <span className="annotation-row-text">{stamp.text}</span>
                  <span className="annotation-row-coord">{Math.round(stamp.x)},{Math.round(stamp.y)}</span>
                  <button onClick={() => removeStamp(selectedPage.id, stamp.id)} className="icon-btn danger" style={{ flexShrink: 0 }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Collapsible>

        {/* Redactions */}
        <Collapsible
          icon={<Square size={11} />}
          title={t.redactions}
          open={redactOpen}
          onToggle={() => setRedactOpen(!redactOpen)}
          count={selectedPage.redactions.length}
        >
          {selectedPage.redactions.length === 0 ? (
            <p style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t.noRedactions}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {selectedPage.redactions.map((r, i) => (
                <div key={r.id} className="annotation-row">
                  <div style={{ width: 12, height: 12, background: '#000', borderRadius: 2, flexShrink: 0, border: '1px solid var(--border-default)' }} />
                  <span className="annotation-row-text">{t.redactions} {i + 1}</span>
                  <span className="annotation-row-coord">{Math.round(r.width)}×{Math.round(r.height)}pt</span>
                  <button onClick={() => removeRedaction(selectedPage.id, r.id)} className="icon-btn danger" style={{ flexShrink: 0 }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Collapsible>
      </div>
    </aside>
  )
}

function PropRow({ label, value, accent }: { label: string; value: string; accent?: 'red' | 'green' | 'blue' }) {
  const colorMap = { red: 'var(--red)', green: 'var(--green)', blue: 'var(--blue)' }
  return (
    <div className="prop-row">
      <span className="prop-label">{label}</span>
      <span className="prop-value" style={accent ? { color: colorMap[accent] } : {}}>{value}</span>
    </div>
  )
}

function Collapsible({ icon, title, children, open, onToggle, count }: {
  icon: React.ReactNode; title: string; children: React.ReactNode
  open: boolean; onToggle: () => void; count?: number
}) {
  return (
    <div className="inspector-section" style={{ padding: 0 }}>
      <button
        onClick={onToggle}
        className="inspector-section-header"
        style={{ width: '100%', textAlign: 'left', padding: '14px 16px 0', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
      >
        <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
        <span style={{ flex: 1 }}>{title}</span>
        {count !== undefined && count > 0 && (
          <span className="inspector-badge">{count}</span>
        )}
        {open
          ? <ChevronDown size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          : <ChevronRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        }
      </button>
      {open && <div style={{ padding: '12px 16px 14px' }}>{children}</div>}
    </div>
  )
}
