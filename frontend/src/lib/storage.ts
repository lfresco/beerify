import { supabase } from '@/lib/supabase'

const BUCKET = 'beer-images'

// Cache signed URLs in memory to avoid regenerating them repeatedly
const urlCache = new Map<string, { url: string; expires: number }>()

export interface SignedImageTransform {
  width?: number
  height?: number
  quality?: number
  resize?: 'cover' | 'contain' | 'fill'
  format?: 'origin'
}

interface SignedUrlOptions {
  expiresIn?: number
  transform?: SignedImageTransform
}

export async function getSignedUrl(storagePath: string, options?: SignedUrlOptions): Promise<string | null> {
  const expiresIn = options?.expiresIn ?? 86400
  const transformKey = JSON.stringify(options?.transform ?? {})
  const cacheKey = `${storagePath}:${expiresIn}:${transformKey}`
  const cached = urlCache.get(cacheKey)
  // Return cached URL if it won't expire in the next 5 minutes
  if (cached && cached.expires > Date.now() + 5 * 60 * 1000) {
    return cached.url
  }

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn, {
    transform: options?.transform,
  })
  if (error) return null

  urlCache.set(cacheKey, { url: data.signedUrl, expires: Date.now() + expiresIn * 1000 })
  return data.signedUrl
}

export async function uploadPhoto(file: File, userId: string, entryId: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `beer_photos/${userId}/${entryId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '31536000', upsert: false })  // 1 year cache

  if (error) throw error
  return path
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to decode image file'))
    }
    image.src = objectUrl
  })
}

export async function compressPhotoForUpload(
  file: File,
  options?: { maxDimension?: number; quality?: number },
): Promise<File> {
  const maxDimension = options?.maxDimension ?? 1600
  const quality = options?.quality ?? 0.72

  const image = await loadImage(file)
  const longEdge = Math.max(image.width, image.height)
  const scale = longEdge > maxDimension ? maxDimension / longEdge : 1
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Failed to initialize canvas context for image compression')
  }

  context.drawImage(image, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/webp', quality)
  })

  if (!blob) {
    throw new Error('Failed to encode compressed image')
  }

  if (blob.size >= file.size && scale === 1) {
    return file
  }

  const baseName = file.name.replace(/\.[^/.]+$/, '')
  return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() })
}

export async function deletePhoto(storagePath: string) {
  await supabase.storage.from(BUCKET).remove([storagePath])
}
