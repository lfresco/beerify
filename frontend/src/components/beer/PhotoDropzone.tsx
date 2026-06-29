import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

interface PhotoDropzoneProps {
  onFile: (file: File) => void
  preview?: string | null
}

export function PhotoDropzone({ onFile, preview }: PhotoDropzoneProps) {
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const display = localPreview ?? preview

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0]
      if (!file) return
      setLocalPreview(URL.createObjectURL(file))
      onFile(file)
    },
    [onFile],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10 MB
  })

  return (
    <div
      {...getRootProps()}
      className={`relative rounded-2xl border-2 border-dashed transition-colors cursor-pointer
        ${isDragActive ? 'border-amber-400 bg-amber-400/10' : 'border-slate-600 hover:border-slate-500'}
        ${display ? 'p-0 overflow-hidden' : 'p-8 flex flex-col items-center justify-center gap-2 text-slate-400'}`}
    >
      <input {...getInputProps()} />
      {display ? (
        <>
          <img src={display} alt="Preview" className="w-full max-h-64 object-cover" />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center">
            <span className="opacity-0 hover:opacity-100 text-white text-sm font-medium transition-opacity">Change photo</span>
          </div>
        </>
      ) : (
        <>
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">{isDragActive ? 'Drop it here!' : 'Drag a photo or click to pick one'}</p>
          <p className="text-xs text-slate-500">JPG, PNG, WEBP up to 10 MB</p>
        </>
      )}
    </div>
  )
}
