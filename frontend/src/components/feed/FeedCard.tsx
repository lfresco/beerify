import { useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { StarRating } from '@/components/ui/StarRating'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getSignedUrl } from '@/lib/storage'
import { useToggleLike, useAddComment } from '@/hooks/useFeed'
import type { FeedEntry } from '@/types/database'

interface FeedCardProps {
  item: FeedEntry
  currentUserId: string
  onEdit?: (entryId: string) => void
  onDelete?: (entryId: string) => void
  /** When true, renders the compact desktop row layout */
  desktopRow?: boolean
}

export function FeedCard({ item, currentUserId, onEdit, onDelete, desktopRow = false }: FeedCardProps) {
  const { entry, profile, style, photos, likes, comments, tags, userHasLiked } = item
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const toggleLike = useToggleLike()
  const addComment = useAddComment()

  const firstPhoto = photos[0]

  useEffect(() => {
    let mounted = true
    async function loadPhotoUrl() {
      if (!firstPhoto?.storage_path) {
        setPhotoUrl(null)
        return
      }
      const signed = await getSignedUrl(firstPhoto.storage_path, {
        transform: { width: 960, height: 560, quality: 60, resize: 'cover' },
      })
      if (mounted) setPhotoUrl(signed)
    }
    void loadPhotoUrl()
    return () => {
      mounted = false
    }
  }, [firstPhoto?.storage_path])

  function handleLike() {
    toggleLike.mutate({ entryId: entry.id, hasLiked: userHasLiked })
  }

  function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim()) return
    addComment.mutate(
      { entryId: entry.id, content: commentText.trim() },
      { onSuccess: () => setCommentText('') },
    )
  }

  const isOwner = currentUserId === entry.user_id

  // ── Desktop row layout ──────────────────────────────────────────
  if (desktopRow) {
    return (
      <div
        className="grid items-stretch hover:bg-[#161616] transition-colors cursor-default"
        style={{
          gridTemplateColumns: '3px 60px 1fr auto',
          borderBottom: '1px solid var(--divider)',
        }}
      >
        {/* Left accent strip */}
        <div style={{ background: 'var(--card-border)' }} />

        {/* Thumbnail */}
        <div className="flex items-center justify-center text-2xl"
             style={{ background: 'var(--card-bg)', borderRight: '1px solid var(--divider)', opacity: 0.7 }}>
          {photoUrl
            ? <img src={photoUrl} alt={entry.name} className="w-full h-full object-cover" style={{ filter: 'grayscale(30%)' }} />
            : <span>🍺</span>
          }
        </div>

        {/* Body */}
        <div className="py-3 px-4">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[11px] font-bold tracking-[0.06em] uppercase"
                  style={{ color: 'var(--text-secondary)' }}>
              {profile?.display_name ?? profile?.username}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
              {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
            </span>
          </div>
          <div className="text-[18px] font-black tracking-[-0.03em] leading-tight text-white mb-0.5">
            {entry.name}
          </div>
          <div className="text-[11px] font-light mb-1.5" style={{ color: '#666' }}>
            {[entry.brewery, style?.name, entry.abv ? `${entry.abv}% ABV` : null]
              .filter(Boolean).join(' · ')}
          </div>
          {entry.notes && (
            <div className="text-xs font-light leading-relaxed" style={{ color: '#888' }}>
              {entry.notes}
            </div>
          )}
        </div>

        {/* Right: rating + venue + likes */}
        <div className="flex flex-col items-end justify-between py-3 pr-4 pl-0" style={{ minWidth: '72px' }}>
          <div>
            <span className="text-[26px] font-black tracking-[-0.04em] leading-none text-white">
              {entry.rating}
            </span>
            <span className="text-[12px] font-light" style={{ color: 'var(--text-dim)' }}>/5</span>
          </div>
          <div className="text-right">
            {(entry.place_name || entry.city) && (
              <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                {entry.place_name ?? entry.city}
              </div>
            )}
            <div className="text-[11px] font-bold" style={{ color: 'var(--text-dim)' }}>
              ♥ {likes.length}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Mobile card layout (unchanged) ─────────────────────────────
  return (
    <Card className="overflow-hidden">
      {firstPhoto && photoUrl && (
        <img
          src={photoUrl}
          alt={entry.name}
          className="w-full h-56 object-cover"
          loading="lazy"
        />
      )}

      <div className="p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link
            to={`/people/${profile?.username ?? ''}`}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-black font-bold text-sm shrink-0"
          >
            {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
          </Link>
          <div className="flex-1 min-w-0">
            <Link to={`/people/${profile?.username ?? ''}`}
                  className="font-semibold truncate hover:opacity-70 transition-opacity block"
                  style={{ color: 'var(--text-primary)' }}>
              {profile?.display_name ?? profile?.username}
            </Link>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Posted {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Tasted {format(new Date(entry.tasted_at), 'PPP p')}
            </p>
          </div>
        </div>

        {/* Beer info */}
        <div>
          <h3 className="font-black text-[22px] tracking-[-0.04em] leading-tight text-white mb-1">
            {entry.name}
          </h3>
          {entry.brewery && (
            <p className="text-sm font-light" style={{ color: 'var(--text-secondary)' }}>{entry.brewery}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StarRating value={entry.rating} size="sm" />
            {style && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'var(--card-border)', color: 'var(--text-secondary)' }}>
                {style.name}
              </span>
            )}
            {entry.abv && (
              <span className="text-xs font-bold text-white">{entry.abv}% ABV</span>
            )}
          </div>
        </div>

        {entry.notes && (
          <p className="text-sm font-light leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {entry.notes}
          </p>
        )}

        {(entry.place_name || entry.city) && (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            📍 {entry.place_name ?? (entry.location_type === 'home' ? 'Home' : 'City')}
            {entry.city ? `, ${entry.city}` : ''}
          </p>
        )}

        {tags.length > 0 && (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            With{' '}
            {tags.map((tag, index) => {
              const taggedName = tag.taggedProfile?.display_name ?? tag.taggedProfile?.username ?? 'Unknown'
              const taggedUsername = tag.taggedProfile?.username
              return (
                <span key={tag.id}>
                  {taggedUsername ? (
                    <Link to={`/people/${taggedUsername}`} className="text-white hover:underline font-medium">
                      {taggedName}
                    </Link>
                  ) : (
                    <span>{taggedName}</span>
                  )}
                  {index < tags.length - 1 ? ', ' : ''}
                </span>
              )
            })}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 pt-1" style={{ borderTop: '1px solid var(--divider)' }}>
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              userHasLiked ? 'text-white font-bold' : 'hover:text-white'
            }`}
            style={{ color: userHasLiked ? 'var(--text-primary)' : 'var(--text-dim)' }}
          >
            <span>{userHasLiked ? '🍺' : '🫗'}</span>
            <span>{likes.length}</span>
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 text-sm transition-colors hover:text-white"
            style={{ color: 'var(--text-dim)' }}
          >
            <span>💬</span>
            <span>{comments.length}</span>
          </button>

          {isOwner && (
            <>
              <button
                onClick={() => onEdit?.(entry.id)}
                className="text-sm transition-colors hover:text-white"
                style={{ color: 'var(--text-dim)' }}
              >
                Edit
              </button>
              <button
                onClick={() => onDelete?.(entry.id)}
                className="text-sm text-red-500 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>

        {/* Comments */}
        {showComments && (
          <div className="flex flex-col gap-2">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2 text-sm">
                <span className="font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>
                  {c.user_id === currentUserId
                    ? 'You'
                    : (c.author?.display_name ?? c.author?.username ?? 'Unknown')}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>{c.content}</span>
              </div>
            ))}
            <form onSubmit={handleComment} className="flex gap-2 mt-1">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 text-sm py-1"
              />
              <Button type="submit" size="sm" loading={addComment.isPending}>Post</Button>
            </form>
          </div>
        )}
      </div>
    </Card>
  )
}
