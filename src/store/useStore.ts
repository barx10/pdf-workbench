import { create } from 'zustand'
import { PDFDocument } from 'pdf-lib'
import { translations, type Lang } from '../i18n'

export interface TextStamp {
  id: string
  x: number // PDF points — center X
  y: number // PDF points — center Y
  text: string
  fontSize: number
  color: string
  rotation: number // degrees, CCW in PDF convention
}

export interface Redaction {
  id: string
  x: number // PDF points
  y: number // PDF points
  width: number // PDF points
  height: number // PDF points
}

export interface OcrResult {
  text: string
  x: number // PDF points
  y: number // PDF points
  width: number // PDF points
  height: number // PDF points
  confidence: number
}

export interface PageRecord {
  id: string
  fileId: string
  pageIndex: number
  excluded: boolean
  rotation: number
  cropBox?: { x: number; y: number; width: number; height: number }
  stamps: TextStamp[]
  redactions: Redaction[]
  ocrData?: OcrResult[]
  ocrApplied: boolean
}

export interface FormFieldRecord {
  name: string
  type: string
  value: string
}

export interface FileRecord {
  id: string
  file: File
  originalName: string
  pageCount: number
  pdfDoc: PDFDocument
  formFields: FormFieldRecord[]
}

export type ActiveTool = 'select' | 'stamp' | 'redact' | 'crop' | 'ocr'

interface StoreState {
  files: FileRecord[]
  pageOrder: PageRecord[]
  selectedPageId: string | null
  activeTool: ActiveTool
  pendingStampText: string
  isProcessing: boolean
  processingMessage: string
  lang: Lang
  theme: 'dark' | 'light'

  addFile: (record: FileRecord, pages: PageRecord[]) => void
  removeFile: (fileId: string) => void
  clearAll: () => void

  setPageOrder: (pages: PageRecord[]) => void
  togglePageExclusion: (pageId: string) => void
  setSelectedPage: (pageId: string | null) => void

  setActiveTool: (tool: ActiveTool) => void
  setPendingStampText: (text: string) => void
  toggleLang: () => void
  toggleTheme: () => void

  addStamp: (pageId: string, stamp: TextStamp) => void
  removeStamp: (pageId: string, stampId: string) => void

  addRedaction: (pageId: string, redaction: Redaction) => void
  removeRedaction: (pageId: string, redactionId: string) => void

  applyOcr: (pageId: string, data: OcrResult[]) => void
  clearOcr: (pageId: string) => void

  setPageCropBox: (
    pageId: string,
    cropBox: { x: number; y: number; width: number; height: number } | undefined
  ) => void
  setPageRotation: (pageId: string, rotation: number) => void

  updateFormField: (fileId: string, fieldName: string, value: string) => void

  setProcessing: (isProcessing: boolean, message?: string) => void
}

export const useStore = create<StoreState>((set) => ({
  files: [],
  pageOrder: [],
  selectedPageId: null,
  activeTool: 'select',
  pendingStampText: 'Konfidensielt',
  isProcessing: false,
  processingMessage: '',
  lang: 'no',
  theme: 'light',

  addFile: (record, pages) =>
    set((state) => ({
      files: [...state.files, record],
      pageOrder: [...state.pageOrder, ...pages],
    })),

  removeFile: (fileId) =>
    set((state) => ({
      files: state.files.filter((f) => f.id !== fileId),
      pageOrder: state.pageOrder.filter((p) => p.fileId !== fileId),
      selectedPageId:
        state.selectedPageId &&
        state.pageOrder.find((p) => p.id === state.selectedPageId)?.fileId === fileId
          ? null
          : state.selectedPageId,
    })),

  clearAll: () => set({ files: [], pageOrder: [], selectedPageId: null }),

  setPageOrder: (pages) => set({ pageOrder: pages }),

  togglePageExclusion: (pageId) =>
    set((state) => ({
      pageOrder: state.pageOrder.map((p) =>
        p.id === pageId ? { ...p, excluded: !p.excluded } : p
      ),
    })),

  setSelectedPage: (pageId) => set({ selectedPageId: pageId }),

  setActiveTool: (tool) => set({ activeTool: tool }),
  setPendingStampText: (text) => set({ pendingStampText: text }),
  toggleLang: () => set((state) => {
    const nextLang: Lang = state.lang === 'en' ? 'no' : 'en'
    const oldDefault = translations[state.lang].stampDefault
    const newDefault = translations[nextLang].stampDefault
    // Sync stamp text only when it still matches the previous default
    const nextStamp = state.pendingStampText === oldDefault ? newDefault : state.pendingStampText
    return { lang: nextLang, pendingStampText: nextStamp }
  }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

  addStamp: (pageId, stamp) =>
    set((state) => ({
      pageOrder: state.pageOrder.map((p) =>
        p.id === pageId ? { ...p, stamps: [...p.stamps, stamp] } : p
      ),
    })),

  removeStamp: (pageId, stampId) =>
    set((state) => ({
      pageOrder: state.pageOrder.map((p) =>
        p.id === pageId ? { ...p, stamps: p.stamps.filter((s) => s.id !== stampId) } : p
      ),
    })),

  addRedaction: (pageId, redaction) =>
    set((state) => ({
      pageOrder: state.pageOrder.map((p) =>
        p.id === pageId ? { ...p, redactions: [...p.redactions, redaction] } : p
      ),
    })),

  removeRedaction: (pageId, redactionId) =>
    set((state) => ({
      pageOrder: state.pageOrder.map((p) =>
        p.id === pageId
          ? { ...p, redactions: p.redactions.filter((r) => r.id !== redactionId) }
          : p
      ),
    })),

  applyOcr: (pageId, data) =>
    set((state) => ({
      pageOrder: state.pageOrder.map((p) =>
        p.id === pageId ? { ...p, ocrData: data, ocrApplied: true } : p
      ),
    })),

  clearOcr: (pageId) =>
    set((state) => ({
      pageOrder: state.pageOrder.map((p) =>
        p.id === pageId ? { ...p, ocrData: undefined, ocrApplied: false } : p
      ),
    })),

  setPageCropBox: (pageId, cropBox) =>
    set((state) => ({
      pageOrder: state.pageOrder.map((p) =>
        p.id === pageId ? { ...p, cropBox } : p
      ),
    })),

  setPageRotation: (pageId, rotation) =>
    set((state) => ({
      pageOrder: state.pageOrder.map((p) =>
        p.id === pageId ? { ...p, rotation } : p
      ),
    })),

  updateFormField: (fileId, fieldName, value) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId
          ? {
              ...f,
              formFields: f.formFields.map((field) =>
                field.name === fieldName ? { ...field, value } : field
              ),
            }
          : f
      ),
    })),

  setProcessing: (isProcessing, message = '') =>
    set({ isProcessing, processingMessage: message }),
}))
