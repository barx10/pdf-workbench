import { PDFDocument } from 'pdf-lib'
import { v4 as uuidv4 } from 'uuid'
import type { FileRecord, PageRecord, FormFieldRecord } from '../store/useStore'

export async function loadPdfFile(file: File): Promise<{ fileRecord: FileRecord; pageRecords: PageRecord[] }> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })

  const pageCount = pdfDoc.getPageCount()
  const fileId = uuidv4()

  // Extract AcroForm fields
  const formFields: FormFieldRecord[] = []
  try {
    const form = pdfDoc.getForm()
    const fields = form.getFields()
    for (const field of fields) {
      let value = ''
      let type = field.constructor.name

      try {
        // Try to get text field value
        const tf = form.getTextField(field.getName())
        value = tf.getText() ?? ''
        type = 'TextField'
      } catch {
        try {
          const cb = form.getCheckBox(field.getName())
          value = cb.isChecked() ? 'true' : 'false'
          type = 'CheckBox'
        } catch {
          try {
            const dd = form.getDropdown(field.getName())
            value = dd.getSelected()[0] ?? ''
            type = 'Dropdown'
          } catch {
            value = ''
          }
        }
      }

      formFields.push({ name: field.getName(), type, value })
    }
  } catch {
    // No form fields — that's fine
  }

  const fileRecord: FileRecord = {
    id: fileId,
    file,
    originalName: file.name,
    pageCount,
    pdfDoc,
    formFields,
  }

  const pageRecords: PageRecord[] = Array.from({ length: pageCount }, (_, i) => ({
    id: uuidv4(),
    fileId,
    pageIndex: i,
    excluded: false,
    rotation: 0,
    cropBox: undefined,
    stamps: [],
    redactions: [],
    ocrData: undefined,
    ocrApplied: false,
  }))

  return { fileRecord, pageRecords }
}
