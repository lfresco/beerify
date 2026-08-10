import { format } from 'date-fns'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useFriends } from '@/hooks/useFriends'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FeedCard } from '@/components/feed/FeedCard'
import { useAuthStore } from '@/store/auth'
import type { FeedEntry } from '@/types/database'

export default function PublicProfilePage() {
  const { username } = useParams()
  const currentUser = useAuthStore((s) => s.user)
  const {
    friends,
    requests,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
  } = useFriends()

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
        userHasLiked: (row.likes ?? []).some((l: any) => l.user_id === currentUser?.id),
      }))
    },
  })

  const statsQuery = useQuery({
    queryKey: ['public-profile', username, 'stats'],
    enabled: !!profileQuery.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beer_entries')
        .select('rating, style_id, created_at')
        .eq('user_id', profileQuery.data!.id)

      if (error) throw error

      const entries = data ?? []
      const totalBeers = entries.length
      const avgRating = totalBeers
        ? entries.reduce((sum, row) => sum + (row.rating ?? 0), 0) / totalBeers
        : 0
      const stylesTried = new Set(entries.map((row) => row.style_id).filter(Boolean)).size
      const activeMonths = new Set(entries.map((row) => row.created_at.slice(0, 7))).size

      return { totalBeers, avgRating, stylesTried, activeMonths }
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
  const hasAcceptedRequest = [
    ...(requests.data?.incoming ?? []),
    ...(requests.data?.outgoing ?? []),
  ].some((request) => (
    request.status === 'accepted'
    && (request.requester_id === profile.id || request.recipient_id === profile.id)
  ))
  const isFriend = (friends.data ?? []).some((friend) => friend.profile.id === profile.id) || hasAcceptedRequest
  const incomingRequest = (requests.data?.incoming ?? []).find(
    (request) => request.requester_id === profile.id && request.status === 'pending',
  )
  const outgoingRequest = (requests.data?.outgoing ?? []).find(
    (request) => request.recipient_id === profile.id && request.status === 'pending',
  )

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
            {!isSelf && (
              <div className="mt-3 flex flex-wrap gap-2">
                {isFriend ? (
                  <span className="text-xs text-emerald-300 bg-emerald-900/30 border border-emerald-700 px-2 py-1 rounded-full">
                    Friends
                  </span>
                ) : incomingRequest ? (
                  <>
                    <Button
                      size="sm"
                      loading={acceptRequest.isPending}
                      onClick={() => acceptRequest.mutate(incomingRequest.id)}
                    >
                      Accept request
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={declineRequest.isPending}
                      onClick={() => declineRequest.mutate(incomingRequest.id)}
                    >
                      Decline
                    </Button>
                  </>
                ) : outgoingRequest ? (
                  <>
                    <span className="text-xs text-slate-300 bg-slate-800 border border-slate-600 px-2 py-1 rounded-full">
                      Request pending
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={cancelRequest.isPending}
                      onClick={() => cancelRequest.mutate(outgoingRequest.id)}
                    >
                      Cancel request
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    loading={sendRequest.isPending}
                    onClick={() => sendRequest.mutate(profile.id)}
                  >
                    Add friend
                  </Button>
                )}
              </div>
            )}
            {!isSelf && sendRequest.error && (
              <p className="text-xs text-red-400 mt-2">{(sendRequest.error as Error).message}</p>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-100 mb-3">User stats</h2>
        {statsQuery.isLoading ? (
          <p className="text-sm text-slate-400">Loading stats...</p>
        ) : statsQuery.error ? (
          <p className="text-sm text-red-400">Failed to load stats.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-3">
              <p className="text-xs text-slate-400">Beers logged</p>
              <p className="text-2xl font-bold text-amber-400">{statsQuery.data?.totalBeers ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-3">
              <p className="text-xs text-slate-400">Average rating</p>
              <p className="text-2xl font-bold text-amber-400">{(statsQuery.data?.avgRating ?? 0).toFixed(1)}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-3">
              <p className="text-xs text-slate-400">Styles tried</p>
              <p className="text-2xl font-bold text-amber-400">{statsQuery.data?.stylesTried ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-3">
              <p className="text-xs text-slate-400">Active months</p>
              <p className="text-2xl font-bold text-amber-400">{statsQuery.data?.activeMonths ?? 0}</p>
            </div>
          </div>
        )}
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
