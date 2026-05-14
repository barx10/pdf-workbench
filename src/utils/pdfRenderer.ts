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
