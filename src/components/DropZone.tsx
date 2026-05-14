import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText } from 'lucide-react'
import { useStore } from '../store/useStore'
import { loadPdfFile } from '../utils/pdfLoader'
import { translations } from '../i18n'

export function DropZone() {
  const { addFile, setProcessing, lang } = useStore()
  const t = translations[lang]

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const pdfFiles = acceptedFiles.filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
      if (pdfFiles.length === 0) return

      setProcessing(true, t.processing)
      try {
        for (const file of pdfFiles) {
          const { fileRecord, pageRecords } = await loadPdfFile(file)
          addFile(fileRecord, pageRecords)
        }
      } catch (err) {
        console.error('Failed to load PDF:', err)
      } finally {
        setProcessing(false)
      }
    },
    [addFile, setProcessing, t]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
  })

  return (
    <div
      {...getRootProps()}
      className={`
        flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
        ${isDragActive
          ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
          : 'border-slate-600 bg-slate-800/50 hover:border-indigo-500 hover:bg-slate-800'
        }
      `}
    >
      <input {...getInputProps()} />
      <div className={`p-3 rounded-full ${isDragActive ? 'bg-indigo-500/20' : 'bg-slate-700'}`}>
        {isDragActive ? (
          <FileText className="w-7 h-7 text-indigo-400" />
        ) : (
          <Upload className="w-7 h-7 text-slate-400" />
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-200">
          {isDragActive ? t.dropActive : t.dropIdle}
        </p>
        <p className="text-xs text-slate-500 mt-1">{t.dropHint}</p>
      </div>
    </div>
  )
}
