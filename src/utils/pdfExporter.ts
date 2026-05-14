import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import type { FileRecord, PageRecord } from '../store/useStore'

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) / 255
  const g = parseInt(clean.substring(2, 4), 16) / 255
  const b = parseInt(clean.substring(4, 6), 16) / 255
  return { r, g, b }
}

export async function exportPdf(
  files: FileRecord[],
  pageOrder: PageRecord[],
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  const outputDoc = await PDFDocument.create()

  // Strip metadata for privacy
  outputDoc.setTitle('')
  outputDoc.setAuthor('')
  outputDoc.setSubject('')
  outputDoc.setKeywords([])
  outputDoc.setCreator('')
  outputDoc.setProducer('')

  const font = await outputDoc.embedFont(StandardFonts.Helvetica)
  const activePagesInOrder = pageOrder.filter((p) => !p.excluded)

  for (let i = 0; i < activePagesInOrder.length; i++) {
    const pageRecord = activePagesInOrder[i]
    onProgress?.(`Processing page ${i + 1} of ${activePagesInOrder.length}…`)

    const sourceFile = files.find((f) => f.id === pageRecord.fileId)
    if (!sourceFile) continue

    // Re-load the source PDF bytes for copying (pdf-lib requires loading fresh)
    const sourceBytes = await sourceFile.file.arrayBuffer()
    const sourceDoc = await PDFDocument.load(sourceBytes)

    const [copiedPage] = await outputDoc.copyPages(sourceDoc, [pageRecord.pageIndex])
    outputDoc.addPage(copiedPage)

    const page = outputDoc.getPage(outputDoc.getPageCount() - 1)
    const { width: pdfW, height: pdfH } = page.getSize()

    // Apply rotation
    if (pageRecord.rotation !== 0) {
      const existingRotation = copiedPage.getRotation().angle
      copiedPage.setRotation(degrees((existingRotation + pageRecord.rotation) % 360))
    }

    // Apply CropBox
    if (pageRecord.cropBox) {
      const { x, y, width, height } = pageRecord.cropBox
      page.setCropBox(x, y, width, height)
    }

    // Apply watermark stamps (centered, rotated)
    for (const stamp of pageRecord.stamps) {
      const color = hexToRgb(stamp.color)
      const θ = ((stamp.rotation ?? 0) * Math.PI) / 180
      const textWidth = font.widthOfTextAtSize(stamp.text, stamp.fontSize)
      const ascent = stamp.fontSize * 0.35

      // Translate origin so rotated text is visually centered at (stamp.x, stamp.y)
      const x = stamp.x - (textWidth / 2) * Math.cos(θ) + ascent * Math.sin(θ)
      const y = stamp.y - (textWidth / 2) * Math.sin(θ) - ascent * Math.cos(θ)

      page.drawText(stamp.text, {
        x,
        y,
        size: stamp.fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
        opacity: 0.35,
        rotate: degrees(stamp.rotation ?? 0),
      })
    }

    // Apply redactions — solid black rectangles
    for (const redaction of pageRecord.redactions) {
      page.drawRectangle({
        x: redaction.x,
        y: redaction.y,
        width: redaction.width,
        height: redaction.height,
        color: rgb(0, 0, 0),
        opacity: 1,
      })
    }

    // Apply OCR invisible text layer
    if (pageRecord.ocrApplied && pageRecord.ocrData) {
      for (const word of pageRecord.ocrData) {
        try {
          const fontSize = Math.max(word.height * 0.8, 4)
          page.drawText(word.text, {
            x: word.x,
            y: word.y,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
            opacity: 0, // invisible — only for text selection/search
          })
        } catch {
          // Skip malformed OCR words
        }
      }
    }
  }

  // Apply AcroForm field values from the source documents
  onProgress?.('Finalizing document…')

  const pdfBytes = await outputDoc.save()
  return pdfBytes
}

export function downloadBlob(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
