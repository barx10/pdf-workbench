# Pro PDF Workbench — Project Description, Requirements & Tech Specs

## Overview

A 100% feature-complete, production-ready "Pro PDF Workbench" built as a single-page React application. All PDF processing is performed entirely client-side for privacy and speed — no external APIs, no backend.

---

## Part 1 — Core Requirements

### 1. Technical Stack

| Concern | Library |
|---------|---------|
| PDF Engine | `pdf-lib` — all document manipulation (merging, excluding, modifying) |
| Rendering | `react-pdf` / `pdfjs-dist` — render PDF pages to high-quality canvases |
| State | `Zustand` — global "Project State" tracking multiple files and modifications |
| File Upload | `react-dropzone` — drag-and-drop file upload |
| Page Reorder | `@hello-pangea/dnd` — drag-to-reorder thumbnails |
| OCR | `tesseract.js` — client-side text recognition |
| Styling | Tailwind CSS |
| Icons | Lucide React |

### 2. Core Functionality

#### Multi-File Upload
- Users can upload multiple PDFs.
- Store as array of objects: `{ id, file, originalName, pages: [] }`.
- Support dragging pages across different source files to reorder them globally.

#### Page-Level Control
- **Thumbnail Gallery**: Display every page of every uploaded PDF as a thumbnail.
- **Exclusion Logic**: Each thumbnail has a checkbox or "eye" icon. If unchecked, that page index is excluded from the final export.
- **Reordering**: Users drag thumbnails to change the sequence of the final merged document.

#### Smart Detection & Auto-Fill
- "Scan Document" feature using `pdf-lib` → `getForm().getFields()`.
- Map AcroForm fields (Name, Address, Date, etc.) to a sidebar "Form Editor".
- Updating sidebar inputs syncs values back to the PDF immediately.
- Graceful fallback message if no form fields are detected.

#### Direct Editing — Text Stamps
- Users click a point on a page to add a text overlay.
- Stamp is centered on the click coordinate.
- `pdf-lib` `drawText` burns this text into PDF coordinates on export.

### 3. UI/UX Design

#### Layout — Three Panes
- **Left Sidebar**: Document list + "Global Actions" (Merge/Export, Clear All).
- **Center Workspace**: Gallery of thumbnails; excluded pages grayed out.
- **Right Sidebar — "Smart Inspector"**: Detected form fields or properties of selected page.

#### Visual Feedback
- "Processing…" loading state when merging large files.
- Clean, professional SaaS aesthetic: Slate/Gray scales, Indigo primary buttons.

### 4. Export Requirements ("Build" Step)

When the user clicks "Export":
1. `PDFDocument.create()`.
2. Loop through active, reordered pages in state.
3. `copyPages` + `addPage` to assemble.
4. Trigger browser download via Blob URL.

### 5. Constraints
- No external APIs — all processing is client-side.
- Auto-detect logic must be resilient to PDFs without embedded form fields.

---

## Part 2 — Advanced Feature Additions

### 1. Permanent Redaction Engine
- "Redact" mode in the Smart Inspector.
- User draws a rectangle over sensitive content → coordinates saved.
- **Export**: `pdf-lib` draws a solid black rectangle over those coordinates.
- Coordinate scaling (mathematically exact):
  ```
  pdf_x = (pixel_x / canvas_width) * pdf_page_width
  pdf_y = (pixel_y / canvas_height) * pdf_page_height
  ```

### 2. Client-Side OCR (Searchable PDF)
- "Scan for Text" button per page.
- `tesseract.js` processes the page canvas image.
- "Apply OCR" layers **invisible text** at detected coordinates via `pdf-lib`.
- Exported PDF becomes searchable and selectable.

### 3. AcroForm Logic (Enhanced)
- Auto-detect existing PDF fields on upload.
- Dynamic sidebar form — updating a field updates `pdf-lib` field values immediately.

### 4. Page Cropping & Sanitisation
- "Crop" tool that modifies the `CropBox` of specific pages.
- **Privacy Scrub on Export**: Strip all metadata (Title, Author, Subject, Keywords, Creator, Producer) and clear the `updateInfo` stack.

### 5. The Build & Export Pipeline (Sequential Async)

```
Export Button →
  1. PDFDocument.create()
  2. Map through Zustand pageOrder (respecting reorder + exclusions)
  3. Per page:
       a. copyPages
       b. apply rotation
       c. apply setCropBox
       d. apply drawText (stamps)
       e. draw black rectangles (redactions)
       f. apply invisible text (OCR)
  4. Merge → Blob → immediate browser download
```

---

## Data Model (Zustand Store)

```ts
interface FileRecord {
  id: string;
  file: File;
  originalName: string;
  pageCount: number;
  pdfDoc: PDFDocument; // loaded pdf-lib document
}

interface PageRecord {
  id: string;
  fileId: string;
  pageIndex: number; // original index in source PDF
  excluded: boolean;
  rotation: number;  // degrees: 0, 90, 180, 270
  cropBox?: { x: number; y: number; width: number; height: number };
  stamps: TextStamp[];
  redactions: Redaction[];
  ocrText?: OcrResult[];
}

interface TextStamp {
  x: number; // PDF points
  y: number;
  text: string;
  fontSize: number;
  color: string;
}

interface Redaction {
  x: number; // PDF points
  y: number;
  width: number;
  height: number;
}

interface OcrResult {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FormFieldRecord {
  fileId: string;
  fieldName: string;
  fieldType: string;
  value: string;
}
```

---

## Project File Structure

```
src/
  store/
    useStore.ts          # Zustand global store
  components/
    LeftSidebar.tsx      # File list + global actions
    CenterWorkspace.tsx  # DnD thumbnail gallery
    RightSidebar.tsx     # Smart Inspector
    Thumbnail.tsx        # Single page thumbnail card
    DropZone.tsx         # react-dropzone upload area
    RedactionOverlay.tsx # Canvas overlay for drawing redaction rects
    StampOverlay.tsx     # Click-to-place text stamp
  utils/
    pdfRenderer.ts       # pdfjs-dist canvas rendering helpers
    pdfExporter.ts       # Full export pipeline (pdf-lib)
    ocrProcessor.ts      # tesseract.js wrapper
    coordinateUtils.ts   # Pixel ↔ PDF-point coordinate math
  App.tsx
  main.tsx
  index.css
PROJECT_SPEC.md          # This file
```

---

## UI Design Tokens

- **Primary**: Indigo (`indigo-600`, `indigo-700`)
- **Backgrounds**: Slate (`slate-900`, `slate-800`, `slate-700`)
- **Surface**: `slate-800` cards, `slate-700` hover
- **Text**: `white`, `slate-300`, `slate-400`
- **Danger / Redact**: `red-500`, `red-700`
- **Success**: `emerald-500`
- **Border**: `slate-600`

---

## Non-Negotiable Constraints

1. No placeholders, no "future implementation" comments, no missing logic.
2. Every button must have its corresponding logic fully wired to the `pdf-lib` engine.
3. All PDF processing is 100% client-side.
4. Coordinate math for redactions and stamps must be mathematically exact.
5. Export pipeline must handle all operations in sequence: reorder → exclude → rotate → crop → stamp → redact → OCR → download.
