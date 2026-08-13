import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Link } from 'react-router-dom'
import { StarRating } from '@/components/ui/StarRating'
import { getSignedUrl } from '@/lib/storage'
import { useToggleLike } from '@/hooks/useFeed'
import type { FeedEntry } from '@/types/database'

interface DesktopFeaturedCardProps {
  item: FeedEntry
  currentUserId: string
  onEdit?: (entryId: string) => void
  onDelete?: (entryId: string) => void
}

export function DesktopFeaturedCard({ item, currentUserId, onEdit, onDelete }: DesktopFeaturedCardProps) {
  const { entry, profile, style, photos, likes, userHasLiked } = item
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const toggleLike = useToggleLike()
  const firstPhoto = photos[0]

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!firstPhoto?.storage_path) { setPhotoUrl(null); return }
      const signed = await getSignedUrl(firstPhoto.storage_path, {
        transform: { width: 840, height: 560, quality: 70, resize: 'cover' },
      })
      if (mounted) setPhotoUrl(signed)
    }
    void load()
    return () => { mounted = false }
  }, [firstPhoto?.storage_path])

  const isOwner = currentUserId === entry.user_id

  return (
    <div className="flex-shrink-0" style={{ background: '#111' }}>
      {/* Photo area — 200px tall with ABV overlay */}
      <div className="relative h-[200px] flex items-end overflow-hidden"
           style={{ background: '#1a1a1a', borderBottom: '3px solid #fff' }}>
        {photoUrl
          ? <img src={photoUrl} alt={entry.name}
                 className="absolute inset-0 w-full h-full object-cover"
                 style={{ filter: 'grayscale(20%) brightness(0.7)' }} />
          : <div className="absolute inset-0 flex items-center justify-center text-[72px] opacity-10">🍺</div>
        }
        {/* ABV big number */}
        <div className="relative z-10 px-4 pb-3">
          {entry.abv != null ? (
            <span className="text-[48px] font-black tracking-[-0.05em] leading-none text-white">
              {entry.abv}
              <span className="text-[18px] font-light text-[#888] align-super">%</span>
            </span>
          ) : (
            <span className="text-[24px] font-black text-[#888]">—%</span>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="p-4">
        {/* Style tag */}
        <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-1" style={{ color: '#888' }}>
          {style?.name ?? 'Beer'}
        </div>

        {/* Beer name */}
        <div className="text-[30px] font-black tracking-[-0.04em] leading-[1.05] text-white mb-0.5">
          {entry.name}
        </div>

        {/* Brewery */}
        <div className="text-[13px] font-light mb-3" style={{ color: '#888' }}>
          {entry.brewery ?? ''}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 mb-3" style={{ border: '1px solid #222' }}>
          <div className="px-3 py-2.5" style={{ borderRight: '1px solid #222' }}>
            <div className="text-[9px] font-bold tracking-[0.12em] uppercase mb-0.5" style={{ color: '#555' }}>Rating</div>
            <div className="text-[20px] font-black tracking-[-0.03em] text-white leading-none">{entry.rating}/5</div>
          </div>
          <div className="px-3 py-2.5" style={{ borderRight: '1px solid #222' }}>
            <div className="text-[9px] font-bold tracking-[0.12em] uppercase mb-0.5" style={{ color: '#555' }}>Style</div>
            <div className="text-[12px] font-black text-white leading-tight mt-0.5">{style?.name ?? '—'}</div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[9px] font-bold tracking-[0.12em] uppercase mb-0.5" style={{ color: '#555' }}>Likes</div>
            <div className="text-[20px] font-black tracking-[-0.03em] text-white leading-none">{likes.length}</div>
          </div>
        </div>

        {/* Stars */}
        <div className="mb-3">
          <StarRating value={entry.rating} size="xl" />
        </div>

        {/* Tasting note */}
        {entry.notes && (
          <div className="text-[13px] font-light leading-relaxed mb-3"
               style={{ color: '#aaa', borderTop: '1px solid #222', paddingTop: '12px' }}>
            {entry.notes}
          </div>
        )}

        {/* Location */}
        {(entry.place_name || entry.city) && (
          <div className="text-[12px] mb-3" style={{ color: '#666' }}>
            📍 {entry.place_name ?? (entry.location_type === 'home' ? 'Home' : 'City')}
            {entry.city ? `, ${entry.city}` : ''}
          </div>
        )}
      </div>

      {/* Social bar — white strip */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white text-black">
        <div className="flex items-center gap-2">
          <Link to={`/people/${profile?.username ?? ''}`}
                className="w-6 h-6 rounded-full bg-black flex items-center justify-center text-white text-[9px] font-black shrink-0">
            {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
          </Link>
          <span className="text-[11px] font-black uppercase tracking-[0.05em]">
            {profile?.display_name ?? profile?.username}
          </span>
          {isOwner && (
            <div className="flex gap-2 ml-2">
              <button onClick={() => onEdit?.(entry.id)}
                      className="text-[11px] font-bold text-gray-500 hover:text-black transition-colors">
                Edit
              </button>
              <button onClick={() => onDelete?.(entry.id)}
                      className="text-[11px] font-bold text-red-500 hover:text-red-700 transition-colors">
                Delete
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleLike.mutate({ entryId: entry.id, hasLiked: userHasLiked })}
            className="text-[11px] font-bold transition-colors"
            style={{ color: userHasLiked ? '#000' : '#888' }}
          >
            {userHasLiked ? '🍺' : '🫗'} {likes.length}
          </button>
          <span className="text-[11px] text-gray-400">
            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  )
}
