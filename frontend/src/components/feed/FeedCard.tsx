import { useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
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
}

export function FeedCard({ item, currentUserId, onEdit, onDelete }: FeedCardProps) {
  const { entry, profile, style, photos, likes, comments, userHasLiked } = item
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
      const signed = await getSignedUrl(firstPhoto.storage_path)
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
          <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 font-bold text-sm shrink-0">
            {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-100 truncate">{profile?.display_name ?? profile?.username}</p>
            <p className="text-xs text-slate-400">Posted {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</p>
            <p className="text-xs text-slate-500">Tasted {format(new Date(entry.tasted_at), 'PPP p')}</p>
          </div>
        </div>

        {/* Beer info */}
        <div>
          <h3 className="font-bold text-lg text-amber-400 leading-tight">{entry.name}</h3>
          {entry.brewery && <p className="text-sm text-slate-400">{entry.brewery}</p>}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StarRating value={entry.rating} size="sm" />
            {style && (
              <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{style.name}</span>
            )}
            {entry.abv && (
              <span className="text-xs text-slate-400">{entry.abv}% ABV</span>
            )}
          </div>
        </div>

        {entry.notes && <p className="text-sm text-slate-300 leading-relaxed">{entry.notes}</p>}

        {/* Actions */}
        <div className="flex items-center gap-4 pt-1 border-t border-slate-700">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-sm transition-colors ${userHasLiked ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'}`}
          >
            <span>{userHasLiked ? '🍺' : '🫗'}</span>
            <span>{likes.length}</span>
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span>💬</span>
            <span>{comments.length}</span>
          </button>

          {isOwner && (
            <>
              <button
                onClick={() => onEdit?.(entry.id)}
                className="text-sm text-slate-400 hover:text-amber-400 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete?.(entry.id)}
                className="text-sm text-slate-400 hover:text-red-400 transition-colors"
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
                <span className="font-medium text-slate-300 shrink-0">{c.user_id === currentUserId ? 'You' : c.user_id.slice(0, 6)}</span>
                <span className="text-slate-400">{c.content}</span>
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
