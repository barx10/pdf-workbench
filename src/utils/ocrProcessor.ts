import Tesseract from 'tesseract.js'
import type { OcrResult } from '../store/useStore'

export async function runOcr(
  canvas: HTMLCanvasElement,
  pdfWidth: number,
  pdfHeight: number,
  onProgress?: (pct: number) => void
): Promise<OcrResult[]> {
  const result = await Tesseract.recognize(canvas, 'eng', {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100))
      }
    },
  })

  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  const results: OcrResult[] = []

  // Tesseract result type - access words via the data object
  const data = result.data as unknown as {
    words: Array<{
      text: string
      confidence: number
      bbox: { x0: number; y0: number; x1: number; y1: number }
    }>
  }

  for (const word of data.words ?? []) {
    if (word.confidence < 30) continue
    const { x0, y0, x1, y1 } = word.bbox

    const pdfX = (x0 / canvasWidth) * pdfWidth
    const pdfY = pdfHeight - (y1 / canvasHeight) * pdfHeight
    const pdfW = ((x1 - x0) / canvasWidth) * pdfWidth
    const pdfH = ((y1 - y0) / canvasHeight) * pdfHeight

    results.push({
      text: word.text,
      x: pdfX,
      y: pdfY,
      width: pdfW,
      height: pdfH,
      confidence: word.confidence,
    })
  }

  return results
}
