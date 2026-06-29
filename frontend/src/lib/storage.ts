import { supabase } from '@/lib/supabase'

const BUCKET = 'beer-images'

export async function getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn)
  if (error) return null
  return data.signedUrl
}

export async function uploadPhoto(file: File, userId: string, entryId: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `beer_photos/${userId}/${entryId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (error) throw error
  return path
}

export async function deletePhoto(storagePath: string) {
  await supabase.storage.from(BUCKET).remove([storagePath])
}
