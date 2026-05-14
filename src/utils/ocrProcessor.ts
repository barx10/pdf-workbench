import Tesseract from 'tesseract.js'
import type { OcrResult } from '../store/useStore'

// pdfRegion: the area of the PDF page this canvas represents, in PDF points (Y from bottom).
// For full-page OCR pass { x:0, y:0, width:pdfW, height:pdfH }.
export async function runOcr(
  canvas: HTMLCanvasElement,
  pdfRegion: { x: number; y: number; width: number; height: number },
  onProgress?: (pct: number) => void
): Promise<OcrResult[]> {
  const result = await Tesseract.recognize(canvas, 'nor+eng', {
    workerPath: '/tesseract-worker.min.js',
    corePath: '/tesseract-core.js',
    logger: (m: { status: string; progress: number }) => {
      if (onProgress) {
        if (m.status === 'loading tesseract core') onProgress(5)
        else if (m.status === 'loading language traineddata') onProgress(15)
        else if (m.status === 'initializing api') onProgress(25)
        else if (m.status === 'recognizing text') onProgress(30 + Math.round(m.progress * 70))
      }
    },
  })

  const cw = canvas.width
  const ch = canvas.height
  const results: OcrResult[] = []

  // In tesseract.js v7, words are nested: blocks → paragraphs → lines → words
  type TWord = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }
  type TLine  = { words: TWord[] }
  type TPara  = { lines: TLine[] }
  type TBlock = { paragraphs: TPara[] }
  const data = result.data as unknown as { blocks: TBlock[] | null }

  const allWords: TWord[] = []
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const word of line.words ?? []) {
          allWords.push(word)
        }
      }
    }
  }

  for (const word of allWords) {
    if (word.confidence < 30) continue
    const { x0, y0, x1, y1 } = word.bbox

    // Map canvas pixel coords → PDF coords within the region
    const pdfX = pdfRegion.x + (x0 / cw) * pdfRegion.width
    const pdfY = pdfRegion.y + (1 - y1 / ch) * pdfRegion.height
    const pdfW = ((x1 - x0) / cw) * pdfRegion.width
    const pdfH = ((y1 - y0) / ch) * pdfRegion.height

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
