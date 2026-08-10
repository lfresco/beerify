import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { FeedEntry } from '@/types/database'

export function useFeed() {
  const user = useAuthStore((s) => s.user)

  return useQuery({
    queryKey: ['feed', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 2,  // 2 minutes - reduce refetches
    gcTime: 1000 * 60 * 10,    // keep in cache 10 min
    queryFn: async (): Promise<FeedEntry[]> => {
      // Fetch entries visible to me (RLS handles group filtering)
      // Select only needed fields to reduce egress
      const { data: entries, error } = await supabase
        .from('beer_entries')
        .select(`
          id, user_id, beer_brand_id, name, brewery, style_id, abv, rating, notes,
          location_type, place_provider, place_id, place_name, city, latitude, longitude, place_key,
          tasted_at, created_at,
          profiles(id, username, display_name, avatar_url),
          beer_styles(id, name),
          beer_brands(id, name),
          photos(id, storage_path),
          likes(user_id),
          comments(id, beer_entry_id, user_id, content, created_at, updated_at, profiles(id, username, display_name, avatar_url)),
          beer_entry_tags(id, beer_entry_id, tagged_user_id, tagged_by_id, created_at, profiles!tagged_user_id(id, username, display_name, avatar_url))
        `)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) throw error

      return (entries ?? []).map((row: any) => ({
        entry: {
          id: row.id,
          user_id: row.user_id,
          beer_brand_id: row.beer_brand_id,
          name: row.name,
          brewery: row.brewery,
          style_id: row.style_id,
          abv: row.abv,
          rating: row.rating,
          notes: row.notes,
          location_type: row.location_type,
          place_provider: row.place_provider,
          place_id: row.place_id,
          place_name: row.place_name,
          city: row.city,
          latitude: row.latitude,
          longitude: row.longitude,
          place_key: row.place_key,
          tasted_at: row.tasted_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
        },
        profile: row.profiles,
        style: row.beer_styles,
        brand: row.beer_brands,
        photos: row.photos ?? [],
        likes: row.likes ?? [],
        comments: (row.comments ?? []).map((comment: any) => ({
          id: comment.id,
          beer_entry_id: comment.beer_entry_id,
          user_id: comment.user_id,
          content: comment.content,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          author: comment.profiles ?? null,
        })),
        tags: (row.beer_entry_tags ?? []).map((tag: any) => ({
          id: tag.id,
          beer_entry_id: tag.beer_entry_id,
          tagged_user_id: tag.tagged_user_id,
          tagged_by_id: tag.tagged_by_id,
          created_at: tag.created_at,
          taggedProfile: tag.profiles ?? null,
        })),
        userHasLiked: (row.likes ?? []).some((l: any) => l.user_id === user?.id),
      }))
    },
  })
}

export function useUpdateEntry() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string
      values: {
        name: string
        brewery: string | null
        style_id: number | null
        abv: number | null
        rating: number
        notes: string | null
        location_type: 'bar' | 'home' | 'city' | null
        place_provider: string | null
        place_id: string | null
        place_name: string | null
        city: string | null
        latitude: number | null
        longitude: number | null
        place_key: string | null
        tasted_at: string
      }
    }) => {
      const { error } = await supabase
        .from('beer_entries')
        .update(values)
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed'] }),
  })
}

export function useDeleteEntry() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('beer_entries')
        .delete()
        .eq('id', entryId)

      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed'] }),
  })
}

export function useToggleLike() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async ({ entryId, hasLiked }: { entryId: string; hasLiked: boolean }) => {
      if (hasLiked) {
        await supabase.from('likes').delete().match({ beer_entry_id: entryId, user_id: user!.id })
      } else {
        await supabase.from('likes').insert({ beer_entry_id: entryId, user_id: user!.id })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed'] }),
  })
}

export function useAddComment() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async ({ entryId, content }: { entryId: string; content: string }) => {
      const { error } = await supabase.from('comments').insert({
        beer_entry_id: entryId,
        user_id: user!.id,
        content,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed'] }),
  })
}
