/**
 * Converts pixel coordinates (from UI canvas) to PDF point coordinates.
 * PDF origin is bottom-left; canvas origin is top-left.
 */
export function pixelToPdfCoords(
  pixelX: number,
  pixelY: number,
  canvasWidth: number,
  canvasHeight: number,
  pdfWidth: number,
  pdfHeight: number
): { x: number; y: number } {
  const x = (pixelX / canvasWidth) * pdfWidth
  // Flip Y axis: PDF 0,0 is bottom-left, canvas 0,0 is top-left
  const y = pdfHeight - (pixelY / canvasHeight) * pdfHeight
  return { x, y }
}

/**
 * Converts a pixel rectangle to a PDF point rectangle.
 * Returns { x, y, width, height } in PDF points where y is bottom-left origin.
 */
export function pixelRectToPdfRect(
  pixelX: number,
  pixelY: number,
  pixelWidth: number,
  pixelHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  pdfWidth: number,
  pdfHeight: number
): { x: number; y: number; width: number; height: number } {
  const x = (pixelX / canvasWidth) * pdfWidth
  const width = (pixelWidth / canvasWidth) * pdfWidth
  const height = (pixelHeight / canvasHeight) * pdfHeight
  // PDF y is measured from bottom; flip and account for rect height
  const y = pdfHeight - (pixelY / canvasHeight) * pdfHeight - height
  return { x, y, width, height }
}

/**
 * Converts PDF point coordinates to pixel coordinates for display.
 */
export function pdfToPixelCoords(
  pdfX: number,
  pdfY: number,
  pdfWidth: number,
  pdfHeight: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const x = (pdfX / pdfWidth) * canvasWidth
  const y = canvasHeight - (pdfY / pdfHeight) * canvasHeight
  return { x, y }
}
