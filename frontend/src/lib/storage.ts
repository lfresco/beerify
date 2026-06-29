import { supabase } from '@/lib/supabase'

const BUCKET = 'beer-images'

export function getPublicUrl(storagePath: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
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
