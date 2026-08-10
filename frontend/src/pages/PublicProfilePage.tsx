import { format } from 'date-fns'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { FeedCard } from '@/components/feed/FeedCard'
import { useAuthStore } from '@/store/auth'
import type { FeedEntry } from '@/types/database'

export default function PublicProfilePage() {
  const { username } = useParams()
  const currentUser = useAuthStore((s) => s.user)

  const profileQuery = useQuery({
    queryKey: ['public-profile', username],
    enabled: !!username,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const entriesQuery = useQuery({
    queryKey: ['public-profile', username, 'entries'],
    enabled: !!profileQuery.data?.id,
    queryFn: async (): Promise<FeedEntry[]> => {
      const { data: entries, error } = await supabase
        .from('beer_entries')
        .select(`
          id, user_id, beer_brand_id, name, brewery, style_id, abv, rating, notes, tasted_at, created_at,
          profiles(id, username, display_name, avatar_url),
          beer_styles(id, name),
          beer_brands(id, name),
          photos(id, storage_path),
          likes(user_id),
          comments(id, beer_entry_id, user_id, content, created_at, updated_at, profiles(id, username, display_name, avatar_url)),
          beer_entry_tags(id, beer_entry_id, tagged_user_id, tagged_by_id, created_at, profiles!tagged_user_id(id, username, display_name, avatar_url))
        `)
        .eq('user_id', profileQuery.data!.id)
        .order('created_at', { ascending: false })
        .limit(20)

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
        userHasLiked: (row.likes ?? []).some((l: any) => l.user_id === currentUser?.id),
      }))
    },
  })

  if (profileQuery.isLoading) {
    return <div className="max-w-xl mx-auto px-4 py-8 text-slate-400">Loading profile...</div>
  }

  if (!profileQuery.data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <Card className="p-5 text-center">
          <p className="text-slate-300">User not found.</p>
          <Link to="/" className="text-amber-400 text-sm hover:underline mt-2 inline-block">Back to feed</Link>
        </Card>
      </div>
    )
  }

  const profile = profileQuery.data
  const isSelf = profile.id === currentUser?.id

  return (
    <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex items-start gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name ?? profile.username}
              className="w-16 h-16 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 text-2xl font-bold shrink-0">
              {profile.display_name?.[0]?.toUpperCase() ?? profile.username?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-100">{profile.display_name ?? profile.username}</h1>
            <p className="text-sm text-slate-400">@{profile.username}</p>
            {profile.created_at && (
              <p className="text-xs text-slate-500 mt-1">Member since {format(new Date(profile.created_at), 'PPP')}</p>
            )}
            {profile.bio && <p className="text-sm text-slate-300 mt-2">{profile.bio}</p>}
            {isSelf && (
              <Link to="/profile" className="text-amber-400 text-xs hover:underline mt-2 inline-block">
                Edit your profile
              </Link>
            )}
          </div>
        </div>
      </Card>

      <h2 className="text-base font-semibold text-slate-200">Recent beers</h2>

      {entriesQuery.isLoading && <p className="text-sm text-slate-400">Loading beers...</p>}
      {entriesQuery.error && <p className="text-sm text-red-400">Failed to load entries.</p>}
      {!entriesQuery.isLoading && (entriesQuery.data?.length ?? 0) === 0 && (
        <Card className="p-4 text-sm text-slate-400">No beers logged yet.</Card>
      )}

      {entriesQuery.data?.map((item) => (
        <FeedCard key={item.entry.id} item={item} currentUserId={currentUser?.id ?? ''} />
      ))}
    </div>
  )
}
