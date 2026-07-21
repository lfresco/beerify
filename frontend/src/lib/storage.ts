import { supabase } from '@/lib/supabase'

const BUCKET = 'beer-images'

// Cache signed URLs in memory to avoid regenerating them repeatedly
const urlCache = new Map<string, { url: string; expires: number }>()

export async function getSignedUrl(storagePath: string, expiresIn = 86400): Promise<string | null> {
  const cached = urlCache.get(storagePath)
  // Return cached URL if it won't expire in the next 5 minutes
  if (cached && cached.expires > Date.now() + 5 * 60 * 1000) {
    return cached.url
  }

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn)
  if (error) return null

  urlCache.set(storagePath, { url: data.signedUrl, expires: Date.now() + expiresIn * 1000 })
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

export async function deletePhoto(storagePath: string) {
  await supabase.storage.from(BUCKET).remove([storagePath])
}
