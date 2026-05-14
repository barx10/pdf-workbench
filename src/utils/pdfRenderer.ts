import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

// PDF.js transfers the ArrayBuffer to its worker, which detaches the original.
// Always .slice(0) to hand a fresh copy so the caller's buffer survives.

export async function renderPageToDataUrl(
  pdfBytes: ArrayBuffer,
  pageIndex: number,
  scale = 0.4
): Promise<{ dataUrl: string; width: number; height: number }> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes.slice(0)) }).promise
  const page = await pdf.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, canvas, viewport }).promise

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.85),
    width: viewport.width,
    height: viewport.height,
  }
}

// Extract embedded text from a PDF page using PDF.js (accurate for text-based PDFs).
// Returns items in the same OcrResult shape so callers can treat them uniformly.
// Pass a region (PDF points, Y from bottom) to filter to a specific area.
export async function extractPageText(
  pdfBytes: ArrayBuffer,
  pageIndex: number,
  region?: { x: number; y: number; width: number; height: number }
): Promise<Array<{ text: string; x: number; y: number; width: number; height: number; confidence: number }>> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes.slice(0)) }).promise
  const page = await pdf.getPage(pageIndex + 1)
  const content = await page.getTextContent()

  const results: Array<{ text: string; x: number; y: number; width: number; height: number; confidence: number }> = []

  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue
    const x = item.transform[4]
    const y = item.transform[5]
    const h = Math.abs(item.transform[3]) || 10
    const w = (item as { width?: number }).width ?? h * item.str.length * 0.6

    if (region) {
      if (x < region.x || x > region.x + region.width) continue
      if (y < region.y || y > region.y + region.height) continue
    }

    results.push({ text: item.str, x, y, width: w, height: h, confidence: 100 })
  }

  // Sort top-to-bottom (PDF y is from bottom, so descending y = top of page first),
  // then left-to-right within the same line (items within 4pt of each other in y).
  results.sort((a, b) => {
    const yDiff = (b.y + b.height) - (a.y + a.height)
    if (Math.abs(yDiff) > 4) return yDiff
    return a.x - b.x
  })

  return results
}

export async function renderPageToImageData(
  pdfBytes: ArrayBuffer,
  pageIndex: number,
  scale = 2.0
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes.slice(0)) }).promise
  const page = await pdf.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, canvas, viewport }).promise

  return { canvas, width: viewport.width, height: viewport.height }
}
