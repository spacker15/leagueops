'use client'

import { useState, useRef } from 'react'
import { Upload, X } from 'lucide-react'
import { createClient } from '@/supabase/client'
import toast from 'react-hot-toast'

interface LogoUploadProps {
  currentUrl: string | null
  storagePath: string // e.g. "programs/16/logo" or "teams/117/logo"
  onUploaded: (url: string | null) => void
  size?: number // px, default 48
}

export function LogoUpload({ currentUrl, storagePath, onUploaded, size = 48 }: LogoUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB')
      return
    }

    // Preview
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    // Upload
    setUploading(true)
    const sb = createClient()
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${storagePath}.${ext}`

    const { error } = await sb.storage
      .from('program-assets')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (error) {
      toast.error('Upload failed: ' + error.message)
      setUploading(false)
      return
    }

    const { data: urlData } = sb.storage.from('program-assets').getPublicUrl(path)
    const url = urlData.publicUrl
    setPreview(url)
    onUploaded(url)
    setUploading(false)
    toast.success('Logo uploaded')
  }

  function clearLogo() {
    setPreview(null)
    onUploaded(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative rounded-lg border border-border overflow-hidden flex items-center justify-center bg-surface flex-shrink-0"
        style={{ width: size, height: size }}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Logo" className="w-full h-full object-cover" />
            <button
              onClick={clearLogo}
              className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
            >
              <X size={10} className="text-white" />
            </button>
          </>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full h-full flex flex-col items-center justify-center text-muted hover:text-white transition-colors"
          >
            <Upload size={14} />
            <span className="text-[8px] font-cond font-bold mt-0.5">
              {uploading ? '...' : 'LOGO'}
            </span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      {preview && (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-[10px] font-cond font-bold text-blue-400 hover:text-blue-300 transition-colors"
        >
          {uploading ? 'UPLOADING...' : 'CHANGE'}
        </button>
      )}
    </div>
  )
}
