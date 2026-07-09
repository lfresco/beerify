import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { FeedEntry } from '@/types/database'

export function useFeed() {
  const user = useAuthStore((s) => s.user)

  return useQuery({
    queryKey: ['feed', user?.id],
    enabled: !!user,
    staleTime: 1000 * 30,
    queryFn: async (): Promise<FeedEntry[]> => {
      // Fetch entries visible to me (RLS handles group filtering)
      const { data: entries, error } = await supabase
        .from('beer_entries')
        .select(`
          *,
          profiles(*),
          beer_styles(*),
          beer_brands(*),
          photos(*),
          likes(*),
          comments(*)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

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
          tasted_at: row.tasted_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
        },
        profile: row.profiles,
        style: row.beer_styles,
        brand: row.beer_brands,
        photos: row.photos ?? [],
        likes: row.likes ?? [],
        comments: row.comments ?? [],
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
